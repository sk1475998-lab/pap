/**
 * `/api/apps` — the application tracker (list, Kanban, CSV export).
 *
 * WHY THIS FILE WAS REWRITTEN
 *
 * It declared its own `Application` interface with its own `status` field
 * (`wishlist | applied | phone | interview | offer | rejected | ghosted`) and
 * wrote it to the SAME store key core owns. So the store held two incompatible
 * row shapes under one key:
 *
 *   - a row created here had `status` and no `stage`, so it was invisible to the
 *     extension's tracker, to `/api/analytics`, and to the sync merge's stage
 *     comparison;
 *   - a row created by the extension had `stage` and no `status`, so it was
 *     invisible to this file's filters and counted in none of its stats.
 *
 * That is the "fill it twice / see it nowhere" bug in its purest form. Core's
 * `ApplicationSchema` is now the only row shape. The genuinely useful extras this
 * tracker adds (recruiter, tags, interview rounds, next action) stay as additive
 * optional fields, which sync carries along untouched.
 */
import { Router } from "express";
import {
  APPLICATION_STAGES,
  isApplicationStage,
  readApplications,
  touchSyncKey,
  writeApplications,
  type Application,
  type ApplicationStage,
} from "@superjob/core";
import { sendApplicationQuotaExceeded, withApplicationQuota } from "../lib/application-quota.js";
import { asyncRoute } from "../lib/tenant.js";
import type { AuthedRequest } from "../lib/tenant.js";

export const appsRouter = Router();

/**
 * Core's row plus tracker-only extras. `extends` on purpose: nothing core owns is
 * re-declared here, so a change to `ApplicationSchema` cannot silently diverge.
 */
export interface TrackedApplication extends Application {
  location?: string;
  salary?: string;
  source?: string;
  recruiterName?: string;
  recruiterLinkedIn?: string;
  nextActionDate?: number;
  tags?: string[];
  salaryOffered?: string;
  offerDeadline?: number;
  interviewRounds?: { type: string; date: number; notes: string }[];
  referral?: { name: string; email?: string };
}

/** A rejection is a response, but only screening/interview/offer are progression. */
export function applicationResponseStats(apps: TrackedApplication[]) {
  const sent = apps.filter((a) => Boolean(a.appliedAt) || a.stage !== "saved");
  const progressed = sent.filter((a) => ["screening", "interview", "offer"].includes(a.stage));
  const responded = sent.filter((a) => ["screening", "interview", "offer", "rejected"].includes(a.stage));
  return {
    sent: sent.length,
    responseRate: sent.length > 0 ? Math.round((responded.length / sent.length) * 100) : 0,
    progressionRate: sent.length > 0 ? Math.round((progressed.length / sent.length) * 100) : 0,
  };
}

/**
 * Vocabulary an older dashboard build (and this route's own former schema) used.
 * Accepted on input so nothing breaks; never written.
 */
const LEGACY_STAGE_ALIASES: Record<string, ApplicationStage> = {
  wishlist: "saved",
  phone: "screening",
  phone_screen: "screening",
  interviewing: "interview",
  submitted: "applied",
  // "ghosted" is not a stage the user sets — it is what silence looks like, and
  // it is derived below from how long a row has sat in `applied`.
  ghosted: "applied",
};

/** Days of silence after applying before the tracker calls a row ghosted. */
export const GHOSTED_AFTER_DAYS = 21;

function toStage(value: unknown): ApplicationStage | undefined {
  if (isApplicationStage(value)) return value;
  const key = String(value ?? "").trim().toLowerCase();
  return LEGACY_STAGE_ALIASES[key];
}

/**
 * Ghosted is computed, not stored: still sitting in `applied`, nothing has
 * touched it for three weeks. Storing it as a stage would mean asking the user to
 * maintain a field that only records the passage of time.
 *
 * Exported because `routes/company.ts` reports the same fact per employer. One
 * definition, or the tracker and the company panel will eventually disagree about
 * whether the user has been ghosted.
 */
export function isGhosted(a: Pick<TrackedApplication, "stage" | "updatedAt" | "appliedAt">, now: number): boolean {
  if (a.stage !== "applied") return false;
  const last = a.updatedAt || a.appliedAt || 0;
  if (!last) return false;
  return now - last > GHOSTED_AFTER_DAYS * 86_400_000;
}

/** One row as the tracker UI wants it: canonical fields + derived flags. */
function decorate(a: TrackedApplication, now: number) {
  return { ...a, ghosted: isGhosted(a, now) };
}

/* ------------------------------- list ------------------------------- */

// GET /api/apps?stage=&search=&source=   (`?status=` still accepted)
appsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const apps = await readApplications<TrackedApplication>();
    const { stage, status, search, source } = req.query as Record<string, string>;

    const wantedRaw = stage ?? status;
    let filtered = apps;
    if (wantedRaw && wantedRaw !== "all") {
      if (wantedRaw.toLowerCase() === "ghosted") {
        filtered = filtered.filter((a) => isGhosted(a, now));
      } else {
        const wanted = toStage(wantedRaw);
        // An unknown stage must return nothing, not everything. Silently ignoring
        // the filter is how a typo turns into "why is my Offers column full?".
        filtered = wanted ? filtered.filter((a) => a.stage === wanted) : [];
      }
    }
    if (source) filtered = filtered.filter((a) => a.source === source);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((a) =>
        `${a.title ?? ""} ${a.company ?? ""} ${a.notes ?? ""}`.toLowerCase().includes(q),
      );
    }

    // One pass, every stage present as a key so the Kanban never has to guess
    // which columns exist.
    const byStage = Object.fromEntries(APPLICATION_STAGES.map((s) => [s, 0])) as Record<ApplicationStage, number>;
    for (const a of apps) if (isApplicationStage(a.stage)) byStage[a.stage]++;

    const responseStats = applicationResponseStats(apps);
    const stats = {
      total: apps.length,
      applied: byStage.applied,
      interviewing: byStage.screening + byStage.interview,
      offers: byStage.offer,
      rejected: byStage.rejected,
      ghosted: apps.filter((a) => isGhosted(a, now)).length,
      byStage,
      ...responseStats,
    };

    res.json({ ok: true, data: filtered.map((a) => decorate(a, now)), stats, total: filtered.length });
  }),
);

/* ------------------------------ create ------------------------------ */

// POST /api/apps
appsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const apps = await readApplications<TrackedApplication>();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const requestedStage = body.stage ?? body.status;
    const stage = requestedStage === undefined ? "saved" : toStage(requestedStage);
    if (!stage) {
      return res.status(400).json({
        ok: false,
        code: "BAD_STAGE",
        error: `Unknown stage "${String(requestedStage)}". Expected one of: ${APPLICATION_STAGES.join(", ")}.`,
      });
    }

    const row: TrackedApplication = {
      // Client fields first; server-owned fields below cannot be spoofed.
      title: "",
      company: "",
      notes: "",
      tags: [],
      location: "",
      source: "manual",
      ...(body as Partial<TrackedApplication>),
      id: `app_${now}_${Math.random().toString(36).slice(2, 7)}`,
      jobId: String(body.jobId ?? body.url ?? ""),
      url: String(body.url ?? ""),
      stage,
      // A manual row has no score. `matchScore: 70` used to be invented here,
      // which put a number the matcher never produced next to real ones.
      matchScore: Number(body.matchScore ?? 0) || 0,
      appliedAt: stage === "saved" ? undefined : Number(body.appliedAt ?? now) || now,
      updatedAt: now,
    };

    const persist = async () => {
      apps.unshift(row);
      await writeApplications(apps);
      return row;
    };
    const user = (req as AuthedRequest).user;
    if (user && stage !== "saved") {
      const quota = await withApplicationQuota(user, persist);
      if (!quota.allowed) return sendApplicationQuotaExceeded(res, quota);
    } else {
      await persist();
    }
    await touchSyncKey("applications", now);
    res.json({ ok: true, data: decorate(row, now) });
  }),
);

/* ------------------------------ update ------------------------------ */

// PATCH /api/apps/:id — stage, notes, recruiter, next action …
appsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const apps = await readApplications<TrackedApplication>();
    const idx = apps.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Application not found" });

    const patch = { ...(req.body ?? {}) } as Record<string, unknown>;
    if (patch.status !== undefined && patch.stage === undefined) patch.stage = patch.status;
    delete patch.status;

    if (patch.stage !== undefined) {
      const stage = toStage(patch.stage);
      if (!stage) {
        return res.status(400).json({
          ok: false,
          code: "BAD_STAGE",
          error: `Unknown stage "${String(patch.stage)}". Expected one of: ${APPLICATION_STAGES.join(", ")}.`,
        });
      }
      patch.stage = stage;
    }

    const nextStage = (patch.stage as ApplicationStage | undefined) ?? apps[idx].stage;
    const updated = {
      ...apps[idx],
      ...(patch as Partial<TrackedApplication>),
      // Leaving `saved` for the first time is the moment it was sent.
      appliedAt: nextStage !== "saved" && !apps[idx].appliedAt ? now : apps[idx].appliedAt,
      id: apps[idx].id,
      updatedAt: now,
    };
    const persist = async () => {
      apps[idx] = updated;
      await writeApplications(apps);
      return updated;
    };
    const user = (req as AuthedRequest).user;
    if (user && nextStage !== "saved" && !apps[idx].appliedAt) {
      const quota = await withApplicationQuota(user, persist);
      if (!quota.allowed) return sendApplicationQuotaExceeded(res, quota);
    } else {
      await persist();
    }
    await touchSyncKey("applications", now);
    res.json({ ok: true, data: decorate(updated, now) });
  }),
);

/* ------------------------------ delete ------------------------------ */

appsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const apps = await readApplications<TrackedApplication>();
    const remaining = apps.filter((a) => a.id !== req.params.id);
    // 404 rather than a cheerful ok:true — a UI that deleted nothing should say so
    // instead of removing the row from view and letting it reappear on refresh.
    if (remaining.length === apps.length) {
      return res.status(404).json({ ok: false, error: "Application not found" });
    }
    await writeApplications(remaining);
    await touchSyncKey("applications");
    res.json({ ok: true });
  }),
);

/* -------------------------- interview round ------------------------- */

appsRouter.post(
  "/:id/interview",
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const apps = await readApplications<TrackedApplication>();
    const idx = apps.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Not found" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rounds = [...(apps[idx].interviewRounds ?? [])];
    rounds.push({
      type: String(body.type ?? "phone"),
      date: Number(body.date ?? now) || now,
      notes: String(body.notes ?? ""),
    });

    const updated: TrackedApplication = {
      ...apps[idx],
      interviewRounds: rounds,
      // Logging a round means they are interviewing — but never walk a row
      // BACKWARDS from offer, which is what an unconditional assignment did.
      stage: apps[idx].stage === "offer" ? "offer" : "interview",
      appliedAt: apps[idx].appliedAt ?? now,
      updatedAt: now,
    };
    const persist = async () => {
      apps[idx] = updated;
      await writeApplications(apps);
      return updated;
    };
    const user = (req as AuthedRequest).user;
    if (user && apps[idx].stage === "saved" && !apps[idx].appliedAt) {
      const quota = await withApplicationQuota(user, persist);
      if (!quota.allowed) return sendApplicationQuotaExceeded(res, quota);
    } else {
      await persist();
    }
    await touchSyncKey("applications", now);
    res.json({ ok: true, data: decorate(updated, now) });
  }),
);

/* ------------------------------ export ------------------------------ */

/**
 * Quote one CSV cell.
 *
 * Two things the previous version got wrong. It quoted only `notes`, so a company
 * called "Acme, Inc." silently shifted every later column by one. And it wrote
 * cell text through verbatim: a value beginning `=`, `+`, `-` or `@` is a formula
 * to Excel and Sheets, so a job title scraped from a hostile posting could run on
 * the user's machine when they opened their own export. Both are fixed here, in
 * one place, for every column.
 */
function csvCell(value: unknown): string {
  const raw = value === undefined || value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** ISO date, or empty — never the string "Invalid Date". */
function csvDate(ms: unknown): string {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// GET /api/apps/export — CSV of every row
appsRouter.get(
  "/export",
  asyncRoute(async (_req, res) => {
    const now = Date.now();
    const apps = await readApplications<TrackedApplication>();
    const headers = [
      "ID", "Title", "Company", "Location", "Stage", "Ghosted",
      "Match Score", "Source", "Applied At", "Last Update", "Notes", "URL",
    ];
    const rows = apps.map((a) =>
      [
        a.id, a.title, a.company, a.location, a.stage, isGhosted(a, now) ? "yes" : "",
        a.matchScore, a.source, csvDate(a.appliedAt), csvDate(a.updatedAt), a.notes, a.url,
      ]
        .map(csvCell)
        .join(","),
    );
    // \r\n and a UTF-8 BOM: Excel on Windows opens a bare-LF UTF-8 file as
    // mojibake, and this product's users have names it would mangle.
    const csv = "﻿" + [headers.map(csvCell).join(","), ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="applications-${csvDate(now)}.csv"`);
    res.send(csv);
  }),
);
