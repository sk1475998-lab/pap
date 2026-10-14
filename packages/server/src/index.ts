/**
 * SuperJobAgent — cloud API.
 *
 * Enterprise-grade REST + WebSocket backend:
 *  - Profile, Settings, Applications CRUD — per user, behind real auth
 *  - `/api/sync` — the cloud half of the one-fill contract (see routes/sync.ts)
 *  - Autopilot (real Playwright pipeline)
 *  - Resume ATS scoring + cover letter generation
 *  - Interview prep + STAR story bank
 *  - India Intelligence (salary, company tiers, Leetcode)
 *  - Outreach message generation
 *  - Analytics aggregation
 *  - Real-time WebSocket log streaming
 *
 * EVERY data shape here comes from `@superjob/core`. The server owns no schema
 * of its own: it previously invented `status` where core says `stage`, and its
 * own settings defaults, so cloud-written rows were invisible to the extension
 * and vice versa. That class of bug is what made "fill it twice" feel necessary.
 *
 * Start: npx tsx src/index.ts
 * URL:   http://localhost:3001
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __server_dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__server_dir, "../../../.env") });
dotenv.config();

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  getStore,
  isApplicationStage,
  normalizeAgentSettings,
  readLLMConfig,
  readProfile,
  writeLLMConfig,
  writeProfile,
  describeLLMConfig,
  readApplications,
  writeApplications,
  touchSyncKey,
  type Profile,
} from "@superjob/core";
import {
  isBusyForOthers,
  setBroadcast,
  startAutopilot,
  statusFor,
  stopAutopilot,
} from "./pipeline-runner.js";
import { startAutopilotWorker, getQueueHealth, enqueueAutopilotJob } from "./lib/queue.js";
import { resumeRouter } from "./routes/resume.js";
import { interviewRouter } from "./routes/interview.js";
import { outreachRouter } from "./routes/outreach.js";
import { jobsRouter } from "./routes/jobs.js";
import { emailRouter } from "./routes/email.js";
import { indiaRouter } from "./routes/india.js";
import { authRouter, redeemWsTicket } from "./routes/auth.js";
import { syncRouter } from "./routes/sync.js";
import { billingRouter } from "./routes/billing.js";
import { applicationResponseStats, appsRouter } from "./routes/apps.js";
import { sendApplicationQuotaExceeded, withApplicationQuota } from "./lib/application-quota.js";
import { notificationsRouter } from "./routes/notifications.js";
import { chatRouter } from "./routes/chat.js";
import { llmRouter } from "./routes/llm.js";
import { alertsRouter } from "./routes/alerts.js";
import { companyRouter } from "./routes/company.js";
import { careerRouter } from "./routes/career.js";
import { skillsRouter } from "./routes/skills.js";
import { atsConfigRouter } from "./routes/ats-config.js";
import {
  initObservability,
  requestIdMiddleware,
  errorMonitoringMiddleware,
  getSystemMetrics,
} from "./lib/observability.js";
import { testSupabaseConnection, isSupabaseConfigured } from "./lib/supabase.js";
import { scheduler } from "./scheduler.js";
import {
  asyncRoute,
  installTenantResolver,
  optionalAuth,
  requireAuth,
  userFromToken,
  userFromUserId,
  type AuthedRequest,
} from "./lib/tenant.js";

// Must run before any request touches core's store: it redirects `getStore()` to
// the current request's tenant namespace. Idempotent.
installTenantResolver();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const DASHBOARD_HTML = path.join(ROOT, "dashboard.html");

// ── Express setup ─────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// Request correlation ID tracing (Gap Observability Fix)
app.use(requestIdMiddleware);

app.use(
  cors({
    // Allowlist explicit origins instead of wildcard `*`.
    // The extension uses chrome-extension:// origins; the dashboard is served from
    // the same origin (same host) so it does not need CORS at all. Wildcarding all
    // origins allows any malicious website that tricks a user into visiting it to
    // make credentialed API calls using whatever bearer token is stored in
    // localStorage — we don't want that.
    //
    // In production, add your deployed dashboard URL to SUPERJOB_ALLOWED_ORIGINS.
    // Example: SUPERJOB_ALLOWED_ORIGINS=https://app.superjobagent.com,https://superjobagent.com
    origin: (origin, callback) => {
      const configuredOrigins = new Set(
        (process.env.SUPERJOB_ALLOWED_ORIGINS ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      // Same-origin requests (dashboard served from the same host) have no Origin header.
      if (!origin) return callback(null, true);

      if (configuredOrigins.has(origin)) return callback(null, true);

      // Extension origins are always allowed — they are sandboxed by the browser.
      if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
        return callback(null, true);
      }

      // Localhost dev origins are always allowed in non-production.
      if (process.env.NODE_ENV !== "production" &&
        (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) {
        return callback(null, true);
      }

      // Local dev allows all origins in non-production
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Block unlisted origins cleanly in production
      callback(null, false);
    },
    exposedHeaders: ["X-Superjob-Token"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve ONLY the dashboard. The previous `express.static(ROOT)` published the
// entire monorepo over HTTP — source, package manifests, any .env or store.json
// sitting in the repo root — to anyone who guessed a path.
app.get("/", (_req, res) => res.sendFile(DASHBOARD_HTML));
app.get("/dashboard.html", (_req, res) => res.sendFile(DASHBOARD_HTML));

// ── WebSocket ─────────────────────────────────────────────────────────────────
/**
 * The live log stream is per-user and authenticated.
 *
 * GAP 7.1 FIX — Secure WS ticket exchange:
 *   PREFERRED: Client calls POST /api/auth/ws-ticket → receives a 30-second
 *   single-use nonce → opens wss://...?ticket=<nonce>.
 *   The nonce is invalidated the moment the connection is accepted, so it is
 *   worthless in reverse-proxy access logs.
 *
 *   BACKWARD COMPAT: ?token=<bearer> still works for existing extension builds
 *   and old dashboard tabs. Emit a deprecation warning so operators can track
 *   migration progress in server logs.
 */
interface ClientMeta {
  userId: string;
}
const wss = new WebSocketServer({ server: httpServer });
const clients = new Map<WebSocket, ClientMeta>();

/**
 * @param audience userId to deliver to. Omit only for server-lifecycle messages
 * that belong to nobody. Every user-data broadcast MUST pass an audience.
 */
function broadcast(payload: object, audience?: string) {
  const msg = JSON.stringify(payload);
  for (const [ws, meta] of clients) {
    if (audience !== undefined && meta.userId !== audience) continue;
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

setBroadcast(broadcast);

wss.on("connection", async (ws, req) => {
  let user: Awaited<ReturnType<typeof userFromToken>> = undefined;
  try {
    const params = new URL(req.url ?? "/", "http://localhost").searchParams;
    const ticket = params.get("ticket") ?? undefined;
    const legacyToken = params.get("token") ?? undefined;

    if (ticket) {
      // ── Secure path: redeem single-use ticket (Gap 7.1 fix) ────────────────
      const userId = redeemWsTicket(ticket);
      if (userId) user = await userFromUserId(userId);
    } else if (legacyToken) {
      // ── Legacy path: direct bearer token in query string ────────────────────
      // Deprecated — log warning so operators can track migration.
      if (process.env.NODE_ENV === "production") {
        console.warn("[ws] DEPRECATED: client connected with ?token= query param. Migrate to POST /api/auth/ws-ticket + ?ticket= for PCI-DSS compliance.");
      }
      user = await userFromToken(legacyToken);
    }
  } catch {
    user = undefined;
  }

  if (!user) {
    try {
      ws.send(JSON.stringify({ type: "unauthorized", message: "Sign in to stream live activity." }));
    } catch {}
    ws.close(1008, "unauthorized");
    return;
  }

  clients.set(ws, { userId: user.userId });
  ws.send(JSON.stringify({ type: "connected", message: "🟢 SuperJobAgent server connected" }));
  ws.send(JSON.stringify({ type: "status", ...statusFor(user.userId) }));
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

// ── Sub-routers ───────────────────────────────────────────────────────────────
// Auth is public by necessity (it is how you get a token). Sync is gated inside
// its own router. Everything below that reads or writes user data is gated here.
app.use("/api/auth", authRouter);
app.use("/api/sync", syncRouter);
app.use("/api/billing", billingRouter);
app.use("/api/jobs", requireAuth, jobsRouter);
app.use("/api/resume", requireAuth, resumeRouter);
app.use("/api/india", requireAuth, indiaRouter);
app.use("/api/interview", requireAuth, interviewRouter);
app.use("/api/outreach", requireAuth, outreachRouter);
app.use("/api/email", requireAuth, emailRouter);
app.use("/api/apps", requireAuth, appsRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/chat", requireAuth, chatRouter);
app.use("/api/llm", requireAuth, llmRouter);
app.use("/api/alerts", requireAuth, alertsRouter);
app.use("/api/career", requireAuth, careerRouter);
app.use("/api/skills", requireAuth, skillsRouter);
// Reference data, not user data: employer open postings, tech stacks, and tracked history.
app.use("/api/company", optionalAuth, companyRouter);
// ATS Config Cloud Sync (Gap 9.6 Fix)
app.use("/api/ats-config", atsConfigRouter);

// ── Scheduler ─────────────────────────────────────────────────────────────────
app.get("/api/scheduler/status", requireAuth, (_req, res) => res.json({ ok: true, data: scheduler.getStatus() }));
app.post("/api/scheduler/start", requireAuth, (req, res) => {
  scheduler.start(req.body);
  res.json({ ok: true, message: "Scheduler started", data: scheduler.getStatus() });
});
app.post("/api/scheduler/stop", requireAuth, (_req, res) => {
  scheduler.stop();
  res.json({ ok: true, message: "Scheduler stopped", data: scheduler.getStatus() });
});


// ── Health ────────────────────────────────────────────────────────────────────
// Deliberately public and deliberately thin: a free-tier host pings this to
// decide whether the instance is alive, so it must not require auth and must not
// leak who is signed in or what they are doing.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "2.1.0", ts: Date.now() });
});

// Runtime telemetry and system metrics (Gap Observability Fix)
app.get("/api/health/metrics", (_req, res) => {
  res.json({ ok: true, metrics: { ...getSystemMetrics(), supabaseConfigured: isSupabaseConfigured() } });
});

// Supabase cloud connectivity test
app.get(
  "/api/supabase/status",
  asyncRoute(async (_req, res) => {
    const status = await testSupabaseConnection();
    res.json({ ok: status.ok, supabase: status });
  }),
);

// Gap 3.1: BullMQ queue health (auth-protected — reveals queue depth).
app.get(
  "/api/queue/health",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const health = await getQueueHealth();
    res.json({ ok: true, data: health });
  }),
);

// ── Profile ───────────────────────────────────────────────────────────────────
app.get(
  "/api/profile",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const profile = await readProfile<Profile>();
    res.json({ ok: true, data: profile ?? null });
  }),
);

app.post(
  "/api/profile",
  requireAuth,
  asyncRoute(async (req, res) => {
    const existing = (await readProfile<Profile>()) ?? ({} as Profile);
    // Stamp updatedAt so the merge has a clock: `mergeSyncState` uses
    // `profile.updatedAt` as the profile's authority, and an unstamped cloud
    // write would lose every race against the extension.
    const now = Date.now();

    // SECURITY: allowlist the fields that are valid on a Profile. This prevents
    // req.body from clobbering internal account fields (tier, stripeCustomerId,
    // tokenEpoch) that live on UserRecord, not on Profile, but could silently
    // coexist in the store if merged without restriction.
    // Unknown keys are simply dropped — this is forward-compatible because a
    // new Profile field only becomes writable once it is added to this list.
    const PROFILE_WRITABLE_KEYS = new Set([
      "firstName", "lastName", "middleName", "fullName", "email", "phone",
      "preferredName", "pronouns", "dateOfBirth", "nationality", "maritalStatus",
      "phoneCountryCode", "alternatePhone", "city", "state", "country", "address",
      "addressLine2", "pincode", "location", "linkedin",
      "github", "website", "jobTitle", "summary", "bio", "yearsOfExperience",
      "currentCTC", "expectedCTC", "noticePeriod", "noticePeriodDays",
      "lastWorkingDay", "immediateJoiner", "willingToRelocate", "remotePreference",
      "workAuthorization", "requiresSponsorship", "salaryExpectation",
      "minSalary", "annualCurrentSalary", "annualExpectedSalary",
      "pan", "aadhaar", "passportNumber", "gender", "pronouns",
      "drivingLicenseNumber", "birthDay", "birthMonth", "birthYear",
      "portfolio", "twitter", "citizenship", "visaType", "visaExpiryDate",
      "i94ExpiryDate", "salaryCurrency", "ctcCurrency", "referralSource",
      "referralName", "hasDrivingLicense", "hasOwnVehicle", "hasMilitaryService",
      "smoker", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
      "gpa", "graduationYear", "graduationDate",
      "skills", "skillsList", "certifications", "languages", "awards",
      "publications", "ethnicity", "veteranStatus", "disabilityStatus",
      "workExperience", "education", "projects", "story",
      "defaultLoginPassword", "imapConfig", "smtpConfig",
      "preferredLocation", "targetRoles", "targetCompanies", "blacklistedCompanies",
      "jobPreferences",
      "salaryBand", "storyBank", "qa", "savedAnswers",
      "customFields",
      "updatedAt", // intentionally last — we override it below
    ]);

    const raw = (req.body ?? {}) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (PROFILE_WRITABLE_KEYS.has(k)) sanitized[k] = v;
    }

    const merged = { ...existing, ...sanitized, updatedAt: now } as Profile;
    await writeProfile(merged);
    await touchSyncKey("profile", now);
    broadcast(
      { type: "log", message: `👤 Profile updated: ${(merged as any).firstName ?? ""} ${(merged as any).lastName ?? ""}`, level: "info", ts: now },
      (req as AuthedRequest).user!.userId,
    );
    res.json({ ok: true, data: merged });
  }),
);

// ── Settings ──────────────────────────────────────────────────────────────────
app.get(
  "/api/settings",
  requireAuth,
  asyncRoute(async (_req, res) => {
    // One shape, defined in core. The server used to answer with its own
    // `getDefaultSettings()` literal, so the dashboard and the extension were
    // editing two different objects under the same `settings` key.
    const settings = normalizeAgentSettings(await getStore().get("settings"));

    const safeLLMConfig = describeLLMConfig(await readLLMConfig());

    res.json({ ok: true, data: settings, llmConfig: safeLLMConfig });
  }),
);

app.post(
  "/api/settings",
  requireAuth,
  asyncRoute(async (req, res) => {
    const store = getStore();
    const existing = normalizeAgentSettings(await store.get("settings"));
    const incoming = normalizeAgentSettings(req.body);
    // normalizeAgentSettings fills defaults for anything absent, so a partial
    // POST would otherwise reset the rest. Merge against what is stored, and
    // only take `search` keys the body actually mentioned.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const bodySearch = (body.search ?? {}) as Record<string, unknown>;
    const mentioned = (k: string) => k in bodySearch || k in body;
    const search: Record<string, unknown> = { ...existing.search };
    for (const [k, v] of Object.entries(incoming.search)) if (mentioned(k)) search[k] = v;
    const top: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) if (k !== "search" && k in body) top[k] = v;

    const merged = normalizeAgentSettings({ ...top, search });
    await store.set("settings", merged);
    await touchSyncKey("settings");
    const savedLLMConfig =
      body.llm && typeof body.llm === "object"
        ? await writeLLMConfig(body.llm)
        : await readLLMConfig();
    if (body.llm && typeof body.llm === "object") {
      await touchSyncKey("llmConfig");
    }
    broadcast({ type: "log", message: "⚙️ Settings updated", level: "info", ts: Date.now() }, (req as AuthedRequest).user!.userId);
    res.json({ ok: true, data: merged, llmConfig: describeLLMConfig(savedLLMConfig) });
  }),
);

// ── Applications ──────────────────────────────────────────────────────────────
/**
 * `stage` is the canonical field (core's ApplicationSchema). These routes used
 * to filter and write `status`, a field core has never had, so the cloud's
 * filters matched nothing the extension wrote and its analytics reported zero
 * interviews forever. `?status=` is still accepted as an alias so an older
 * dashboard build keeps working.
 */
app.get(
  "/api/applications",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { stage, status, source, limit } = req.query as Record<string, string>;
    const wanted = stage ?? status;
    let apps = await readApplications<any>();
    if (wanted && wanted !== "all") apps = apps.filter((a: any) => a.stage === wanted);
    if (source && source !== "all") apps = apps.filter((a: any) => a.source === source);
    if (limit) apps = apps.slice(0, Math.max(0, parseInt(limit, 10) || 0));
    res.json({ ok: true, data: apps, total: apps.length });
  }),
);

app.post(
  "/api/applications",
  requireAuth,
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const apps = await readApplications<any>();
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Client-supplied fields first, then the ones the SERVER owns. `id` must not
    // be spoofable (a chosen id can overwrite an existing row on the next merge),
    // and `updatedAt` must be the server clock or a stale dashboard tab would win
    // the next sync. `stage` is validated against core's list rather than trusted.
    const stage = isApplicationStage(body.stage) ? body.stage : "applied";
    if (body.stage !== undefined && !isApplicationStage(body.stage)) {
      return res.status(400).json({ ok: false, error: "Unknown application stage.", code: "BAD_STAGE" });
    }

    const newApp = {
      jobId: String(body.jobId ?? body.url ?? ""),
      url: String(body.url ?? ""),
      title: String(body.title ?? body.jobTitle ?? ""),
      company: String(body.company ?? ""),
      notes: "",
      matchScore: Number(body.matchScore ?? 0) || 0,
      ...body,
      id: `app_${now}_${Math.random().toString(36).slice(2, 7)}`,
      stage,
      appliedAt: stage === "saved" ? undefined : Number(body.appliedAt ?? now) || now,
      updatedAt: now,
    };
    // SECURITY / DoS: cap the stored list to prevent unbounded disk growth.
    // A user that POSTs applications faster than they are cleaned up would
    // otherwise exhaust disk space on the free-tier instance.
    const MAX_APPLICATIONS = 5000;
    const persist = async () => {
      apps.unshift(newApp);
      await writeApplications(apps.slice(0, MAX_APPLICATIONS));
      return newApp;
    };
    const user = (req as AuthedRequest).user;
    if (user && stage !== "saved") {
      const quota = await withApplicationQuota(user, persist);
      if (!quota.allowed) return sendApplicationQuotaExceeded(res, quota);
    } else {
      await persist();
    }
    await touchSyncKey("applications", now);
    broadcast({ type: "application_saved", data: newApp }, (req as AuthedRequest).user!.userId);
    res.json({ ok: true, data: newApp });
  }),
);

app.patch(
  "/api/applications/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const apps = await readApplications<any>();
    const idx = apps.findIndex((a: any) => a.id === req.params.id);
    if (idx < 0) return res.status(404).json({ ok: false, error: "Not found" });
    const now = Date.now();
    const patch = { ...(req.body ?? {}) } as Record<string, unknown>;
    // Accept the legacy field name from an older dashboard build, but store the
    // canonical one.
    if (patch.status && !patch.stage) {
      patch.stage = patch.status;
      delete patch.status;
    }
    if ("stage" in patch && !isApplicationStage(patch.stage)) {
      return res.status(400).json({
        ok: false,
        error: `Unknown stage "${String(patch.stage)}".`,
        code: "BAD_STAGE",
      });
    }
    // Reaching a real stage for the first time is when the application was sent;
    // without this, a row moved saved → applied from the dashboard never gets an
    // `appliedAt` and drops out of every "sent" count.
    const nextStage = (patch.stage as string | undefined) ?? apps[idx].stage;
    const appliedAt =
      nextStage !== "saved" && !apps[idx].appliedAt ? now : apps[idx].appliedAt;
    const updated = { ...apps[idx], ...patch, appliedAt, id: apps[idx].id, updatedAt: now };
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
    res.json({ ok: true, data: updated });
  }),
);

app.delete(
  "/api/applications/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const apps = await readApplications<any>();
    const filtered = apps.filter((a: any) => a.id !== req.params.id);
    if (filtered.length === apps.length) return res.status(404).json({ ok: false, error: "Not found" });
    await writeApplications(filtered);
    await touchSyncKey("applications");
    res.json({ ok: true });
  }),
);

// ── Analytics ─────────────────────────────────────────────────────────────────
app.get(
  "/api/analytics",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const apps = await readApplications<any>();
    const bySource: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    let totalScore = 0;
    let totalFields = 0;

    for (const a of apps) {
      const src = a.source ?? "unknown";
      const stage = a.stage ?? "saved";
      bySource[src] = (bySource[src] ?? 0) + 1;
      byStage[stage] = (byStage[stage] ?? 0) + 1;
      totalScore += a.matchScore ?? 0;
      totalFields += a.filledFields ?? 0;
      const day = new Date(a.appliedAt ?? a.updatedAt ?? Date.now()).toISOString().slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }

    const responseStats = applicationResponseStats(apps);
    const submitted = responseStats.sent;
    const interviews = apps.filter((a: any) => a.stage === "interview").length;
    const offers = apps.filter((a: any) => a.stage === "offer").length;

    res.json({
      ok: true,
      data: {
        total: apps.length,
        submitted,
        avgMatchScore: apps.length ? Math.round(totalScore / apps.length) : 0,
        avgFieldsFilled: apps.length ? Math.round(totalFields / apps.length) : 0,
        totalFieldsFilled: totalFields,
        responseRate: responseStats.responseRate,
        progressionRate: responseStats.progressionRate,
        interviews,
        offers,
        bySource,
        byStage,
        /** Legacy alias so an older dashboard build still renders its chart. */
        byStatus: byStage,
        dailyCounts,
        hoursSaved: Math.round(submitted * 0.4 * 10) / 10, // ~24 min per manual app
      },
    });
  }),
);

// ── Autopilot ─────────────────────────────────────────────────────────────────
/**
 * The server-side Playwright runner is ONE browser per process, so these routes
 * are authenticated and ownership-checked. Unauthenticated, they let any caller
 * drive a real browser that is signed into somebody's LinkedIn and submit
 * applications as them; unowned, any signed-in user could stop another user's run.
 */
app.post(
  "/api/autopilot/start",
  requireAuth,
  asyncRoute(async (req, res) => {
    const userId = (req as AuthedRequest).user!.userId;
    if (isBusyForOthers(userId)) {
      return res.status(409).json({
        ok: false,
        code: "ENGINE_BUSY",
        error: "The shared apply engine is busy with another run. Try again shortly, or apply now with the browser extension.",
      });
    }
    try {
      await startAutopilot(req.body ?? {});
      res.json({ ok: true, message: "Autopilot started", status: statusFor(userId) });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e.message });
    }
  }),
);

app.post("/api/autopilot/stop", requireAuth, (req, res) => {
  const userId = (req as AuthedRequest).user!.userId;
  if (!stopAutopilot(userId)) {
    return res.status(403).json({ ok: false, code: "NOT_OWNER", error: "That run belongs to another session." });
  }
  res.json({ ok: true, message: "Autopilot stopped", status: statusFor(userId) });
});

app.get("/api/autopilot/status", requireAuth, (req, res) => {
  const userId = (req as AuthedRequest).user!.userId;
  res.json({ ok: true, ...statusFor(userId), busy: isBusyForOthers(userId) });
});

// ── Skills gap / company intel ────────────────────────────────────────────────
// Both used to be defined a second time HERE, inline, as `app.get("/api/skills/gaps")`
// and `app.get("/api/company/:name")`. Express matches in registration order and
// `app.use("/api/skills", …)` / `app.use("/api/company", …)` are mounted above, so
// those copies were unreachable dead code — and the inline skills version had a
// smaller role map than the router's, so the "duplicate" was also the worse one.
// The routers are the single implementation. See routes/skills.ts, routes/company.ts.

// ── Dashboard SPA static serving (Gap 4.1 Fix) ───────────────────────────────
const candidateDistDirs = [
  path.resolve(__server_dir, "../../../dist/dashboard"),
  path.resolve(process.cwd(), "dist/dashboard"),
  path.resolve(__server_dir, "../../dashboard/dist"),
];
const distDashboard = candidateDistDirs.find((d) => fs.existsSync(path.join(d, "index.html"))) || candidateDistDirs[0];

if (fs.existsSync(distDashboard)) {
  app.use(express.static(distDashboard));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(distDashboard, "index.html"));
  });
}

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));

// ── Observability Error Monitoring (Gap Observability Fix) ───────────────────
app.use(errorMonitoringMiddleware);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
// A managed free tier routes traffic to the container, so the process must bind
// 0.0.0.0 there. Locally it stays on the loopback: this API drives a browser that
// is signed into the user's job boards, and binding 0.0.0.0 on a laptop exposes
// that to everything on the café Wi-Fi. Explicit HOST always wins.
const HOST = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
httpServer.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  initObservability().catch(() => {});
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  🚀  SuperJobAgent  cloud API             ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
  console.log(`   Dashboard   http://${shown}:${PORT}`);
  console.log(`   API         http://${shown}:${PORT}/api`);
  console.log(`   WebSocket   ws://${shown}:${PORT}?ticket=<nonce> (secure)`);
  console.log(`   Bound to    ${HOST}:${PORT}\n`);

  // ── Gap 3.1: BullMQ Worker Bootstrap ──────────────────────────────────────
  // Tier 1 (single container, current default): HTTP + worker in-process.
  // Tier 2 (scale-out): Run dedicated worker containers with SUPERJOB_WORKER_ONLY=true
  //   pointing at the same REDIS_URL — they drain the queue in parallel.
  if (process.env.REDIS_URL) {
    startAutopilotWorker(async (data, updateProgress) => {
      const { runAsUser, userFromUserId } = await import("./lib/tenant.js");
      const user = await userFromUserId(data.userId);
      if (!user) throw new Error(`User ${data.userId} not found for queued autopilot job`);
      await runAsUser(user, () => startAutopilot(data.overrides));
      await updateProgress(100);
    }).catch((err: Error) => {
      console.error("[queue] Failed to start BullMQ worker:", err.message);
      console.warn("[queue] To enable: npm install bullmq --workspace @superjob/server");
    });
    console.log(`   Queue       BullMQ (Redis: ${process.env.REDIS_URL.replace(/:[^:@]+@/, ":***@")})`);
  } else {
    console.log(`   Queue       In-process (set REDIS_URL to enable BullMQ)`);
  }
});

export {};
