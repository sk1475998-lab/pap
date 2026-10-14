/**
 * Email monitor routes — IMAP scanning & background watcher with per-tenant isolation
 */
import { Router } from "express";
import { readProfile, type Profile } from "@superjob/core";
import { scanInbox, watchInbox, type WatchHandle, type EmailScanResult } from "@superjob/email-monitor";
import { asyncRoute, type AuthedRequest } from "../lib/tenant.js";

export const emailRouter = Router();

interface UserWatchState {
  watcher: WatchHandle | null;
  lastScanResult: EmailScanResult | null;
  running: boolean;
}

const watchersByUser = new Map<string, UserWatchState>();

function getWatchState(userId: string): UserWatchState {
  let state = watchersByUser.get(userId);
  if (!state) {
    state = { watcher: null, lastScanResult: null, running: false };
    watchersByUser.set(userId, state);
  }
  return state;
}

// GET /api/email/status — per-tenant watcher status
emailRouter.get(
  "/status",
  asyncRoute(async (req, res) => {
    const userId = (req as AuthedRequest).user?.userId ?? "default";
    const state = getWatchState(userId);
    res.json({
      ok: true,
      running: state.running,
      scansCompleted: state.watcher ? state.watcher.scanCount() : 0,
      lastScan: state.lastScanResult,
    });
  }),
);

// POST /api/email/scan — one-time scan
emailRouter.post(
  "/scan",
  asyncRoute(async (req, res) => {
    const userId = (req as AuthedRequest).user?.userId ?? "default";
    const state = getWatchState(userId);
    const profile = await readProfile<Profile>();
    const imapConfig = (profile as any)?.imapConfig || req.body?.imapConfig;

    if (!imapConfig?.user || !imapConfig?.password) {
      return res.status(400).json({
        ok: false,
        error: "IMAP credentials not configured in profile. Add your IMAP host, user, and password in Profile settings.",
      });
    }

    const result = await scanInbox({
      imap: imapConfig,
      sinceDays: req.body?.sinceDays ?? 7,
      maxScan: req.body?.maxScan ?? 50,
    });

    state.lastScanResult = result;
    res.json({ ok: true, data: result });
  }),
);

// POST /api/email/watch/start — start background watcher for this tenant
emailRouter.post(
  "/watch/start",
  asyncRoute(async (req, res) => {
    const userId = (req as AuthedRequest).user?.userId ?? "default";
    const state = getWatchState(userId);

    if (state.running) {
      return res.json({ ok: true, message: "Watcher already running for this user", running: true });
    }

    const profile = await readProfile<Profile>();
    const imapConfig = (profile as any)?.imapConfig || req.body?.imapConfig;

    if (!imapConfig?.user || !imapConfig?.password) {
      return res.status(400).json({
        ok: false,
        error: "IMAP credentials not configured in profile.",
      });
    }

    const intervalMs = (req.body?.intervalMinutes ?? 15) * 60 * 1000;

    state.watcher = watchInbox(
      { imap: imapConfig },
      intervalMs,
      {
        onScanComplete: (result) => {
          state.lastScanResult = result;
        },
        onError: (err) => {
          console.error(`[Email Monitor Error: user ${userId}]:`, err.message);
        },
      },
    );

    state.running = true;
    res.json({ ok: true, message: "Email monitor started", running: true, intervalMinutes: intervalMs / 60000 });
  }),
);

// POST /api/email/watch/stop — stop background watcher for this tenant
emailRouter.post(
  "/watch/stop",
  asyncRoute(async (req, res) => {
    const userId = (req as AuthedRequest).user?.userId ?? "default";
    const state = getWatchState(userId);

    if (state.watcher) {
      state.watcher.stop();
      state.watcher = null;
    }
    state.running = false;
    res.json({ ok: true, message: "Email monitor stopped", running: false });
  }),
);
