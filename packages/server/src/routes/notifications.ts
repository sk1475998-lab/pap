/**
 * `/api/notifications` — follow-up nudges, interview reminders, deadlines.
 *
 * The reminder generator below used to test `app.status`, a field core has never
 * written. Nothing in the product sets it, so every branch was dead: this endpoint
 * returned only manually-created notifications and the automatic follow-up nudges
 * — the actual reason the feature exists — never fired once. It now reads core's
 * canonical `stage`.
 */
import { Router } from "express";
import { getStore, readApplications } from "@superjob/core";
import { asyncRoute } from "../lib/tenant.js";

export const notificationsRouter = Router();

export interface Notification {
  id: string;
  type: "follow_up" | "interview" | "offer_deadline" | "system" | "new_match";
  title: string;
  body: string;
  applicationId?: string;
  company?: string;
  dueAt?: number;
  read: boolean;
  createdAt: number;
  priority: "high" | "medium" | "low";
}

/** Days after applying before we suggest a follow-up. */
const FOLLOW_UP_AFTER_DAYS = 7;
/** …and when it becomes urgent. */
const FOLLOW_UP_URGENT_DAYS = 14;
const DAY_MS = 86_400_000;

const days = (ms: number) => Math.floor(ms / DAY_MS);

// GET /api/notifications?unread=true
notificationsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const now = Date.now();
    const store = getStore();
    let stored = (await store.get<Notification[]>("notifications")) ?? [];

    const apps = await readApplications<any>();
    const reminders: Notification[] = [];
    const already = (id: string, type: Notification["type"]) =>
      stored.some((n) => n.applicationId === id && n.type === type);

    for (const app of apps) {
      const label = `${app.title ?? "A role"} at ${app.company ?? "a company"}`;

      // Upcoming interview, within three days.
      if (app.stage === "interview" && Number(app.nextActionDate) > 0) {
        const until = days(Number(app.nextActionDate) - now);
        if (until >= 0 && until <= 3 && !already(app.id, "interview")) {
          reminders.push({
            id: `notif_int_${app.id}`,
            type: "interview",
            title: until === 0 ? "Interview today" : `Interview in ${until} day${until === 1 ? "" : "s"}`,
            body: label,
            applicationId: app.id,
            company: app.company,
            dueAt: Number(app.nextActionDate),
            read: false,
            createdAt: now,
            priority: until === 0 ? "high" : "medium",
          });
        }
      }

      // Applied, still waiting, gone quiet. `appliedAt` is optional on a saved
      // row, so fall back to the row's own clock rather than computing with NaN.
      if (app.stage === "applied") {
        const sentAt = Number(app.appliedAt ?? app.updatedAt ?? 0);
        const since = sentAt > 0 ? days(now - sentAt) : -1;
        if (since >= FOLLOW_UP_AFTER_DAYS && !already(app.id, "follow_up")) {
          reminders.push({
            id: `notif_fu_${app.id}`,
            type: "follow_up",
            title: "Follow up needed",
            body: `${label} — ${since} days since you applied`,
            applicationId: app.id,
            company: app.company,
            dueAt: sentAt + FOLLOW_UP_AFTER_DAYS * DAY_MS,
            read: false,
            createdAt: now,
            priority: since >= FOLLOW_UP_URGENT_DAYS ? "high" : "low",
          });
        }
      }

      // An offer with a deadline is the one thing here that is genuinely urgent.
      if (app.stage === "offer" && Number(app.offerDeadline) > 0 && !already(app.id, "offer_deadline")) {
        const left = days(Number(app.offerDeadline) - now);
        if (left >= 0 && left <= 7) {
          reminders.push({
            id: `notif_off_${app.id}`,
            type: "offer_deadline",
            title: left === 0 ? "Offer expires today" : `Offer expires in ${left} day${left === 1 ? "" : "s"}`,
            body: label,
            applicationId: app.id,
            company: app.company,
            dueAt: Number(app.offerDeadline),
            read: false,
            createdAt: now,
            priority: "high",
          });
        }
      }
    }

    // Materialize reminders with stable IDs so they can be marked read and remain
    // read across requests. Preserve an existing read flag if the trigger still
    // applies on a later refresh.
    const known = new Map(stored.map((notification) => [notification.id, notification]));
    const additions = reminders
      .filter((reminder) => !known.has(reminder.id))
      .map((reminder) => ({ ...reminder, read: known.get(reminder.id)?.read ?? false }));
    if (additions.length) {
      stored = [...additions, ...stored].slice(0, 100);
      await store.set("notifications", stored);
    }
    const visible = req.query.unread === "true" ? stored.filter((n) => !n.read) : stored;

    res.json({
      ok: true,
      data: visible,
      unread: stored.filter((n) => !n.read).length,
    });
  }),
);

// POST /api/notifications - add a notification
notificationsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const notifs = (await store.get<Notification[]>("notifications")) ?? [];
    const notif: Notification = {
      title: "",
      body: "",
      type: "system",
      ...(req.body ?? {}),
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      createdAt: Date.now(),
      priority: (req.body?.priority ?? "medium") as Notification["priority"],
    };
    notifs.unshift(notif);
    await store.set("notifications", notifs.slice(0, 100));
    res.json({ ok: true, data: notif });
  }),
);

// PATCH /api/notifications/:id/read - mark as read
notificationsRouter.patch(
  "/:id/read",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const notifs = (await store.get<Notification[]>("notifications")) ?? [];
    const idx = notifs.findIndex((n) => n.id === req.params.id);
    // Generated reminders are computed per request and have no stored row, so a
    // miss is expected rather than an error — but say which happened instead of
    // reporting success for a write that never occurred.
    if (idx === -1) return res.json({ ok: true, persisted: false });
    notifs[idx].read = true;
    await store.set("notifications", notifs);
    res.json({ ok: true, persisted: true });
  }),
);

// POST /api/notifications/read-all
notificationsRouter.post(
  "/read-all",
  asyncRoute(async (_req, res) => {
    const store = getStore();
    const notifs = (await store.get<Notification[]>("notifications")) ?? [];
    await store.set("notifications", notifs.map((n) => ({ ...n, read: true })));
    res.json({ ok: true });
  }),
);
