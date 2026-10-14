/**
 * Pipeline Runner — wraps Playwright + SourceAdapter + runPipeline
 * with WebSocket broadcasting for real-time dashboard updates.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GAP 2.1 FIX — Multi-Tenant Concurrency
 * ─────────────────────────────────────────────────────────────────────────────
 * BEFORE: A single global `state.running` flag meant only ONE user could run
 * the autopilot at a time. User B was blocked with HTTP 409 while User A ran.
 *
 * AFTER: Per-user job state map (`userStates`). Each user gets an independent
 * RunnerState keyed by their userId. Concurrency is bounded by MAX_CONCURRENT
 * (default: 3 simultaneous Playwright instances on the free-tier container).
 * Each user's Playwright context is fully isolated with a per-user profile
 * directory (already present: `.playwright-profiles/<userId>`).
 *
 * Production upgrade path: Replace the in-process map with BullMQ + Redis so
 * workers can run in separate containers. The job payload is the same SearchParams
 * object. The queue worker calls runInBackground(userId, profile, settings, overrides).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { chromium, type BrowserContext } from "playwright";
import {
  getStore,
  normalizeAgentSettings,
  readProfile,
  readApplications,
  touchSyncKey,
  writeApplications,
  type AgentSettings,
  type Profile,
} from "@superjob/core";
import {
  runPipeline,
  LinkedInAdapter,
  IndeedAdapter,
  GlassdoorAdapter,
  NaukriAdapter,
  createGenericAdapter,
  type SourceAdapter,
  type PipelineHooks,
  type SearchParams,
} from "@superjob/applier";

import { currentUser, runAsUser, userFromUserId } from "./lib/tenant.js";

/** Maximum number of simultaneous Playwright instances in this process. */
const MAX_CONCURRENT = Number(process.env.SUPERJOB_MAX_CONCURRENT ?? 3);

export interface RunnerState {
  running: boolean;
  todayCount: number;
  totalApplied: number;
  sessionId: string | null;
  /** Who this run belongs to. */
  ownerId: string | null;
}

/**
 * GAP 2.1 FIX: Per-user state map replaces the single global `state` object.
 * Key: userId  Value: RunnerState
 */
const userStates = new Map<string, RunnerState>();

/**
 * Per-user BrowserContext references. Kept separate so we can close a specific
 * user's browser without affecting others.
 */
const userBrowserCtx = new Map<string, BrowserContext>();

/** Legacy: exported for the API routes that check global status. */
export const state: RunnerState = {
  running: false,
  todayCount: 0,
  totalApplied: 0,
  sessionId: null,
  ownerId: null,
};

// Keep the legacy singleton state in sync with the user-state map aggregate.
function syncGlobalState() {
  const anyRunning = [...userStates.values()].some((s) => s.running);
  state.running = anyRunning;
}

function getUserState(userId: string): RunnerState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      running: false,
      todayCount: 0,
      totalApplied: 0,
      sessionId: null,
      ownerId: userId,
    });
  }
  return userStates.get(userId)!;
}

let broadcastFn: ((payload: object, audience?: string) => void) | null = null;

export function setBroadcast(fn: (payload: object, audience?: string) => void) {
  broadcastFn = fn;
}

/** Send a payload to one specific user's connected clients. */
function broadcastTo(userId: string, payload: object) {
  broadcastFn?.(payload, userId);
}

function logFor(userId: string, message: string, level: "info" | "success" | "warn" | "error" = "info") {
  broadcastTo(userId, { type: "log", message, level, ts: Date.now() });
  console.log(`[${level.toUpperCase()}][${userId.slice(0, 8)}] ${message}`);
}

function pushStatusFor(userId: string) {
  const s = getUserState(userId);
  broadcastTo(userId, {
    type: "status",
    running: s.running,
    todayCount: s.todayCount,
    totalApplied: s.totalApplied,
  });
}

// ── Legacy shims (for routes that read the global `state`) ───────────────────

/** @deprecated Use statusFor(userId) — retained for API route backward-compat */
function log(message: string, level: "info" | "success" | "warn" | "error" = "info") {
  broadcastFn?.({ type: "log", message, level, ts: Date.now() } as object, state.ownerId ?? undefined);
  console.log(`[${level.toUpperCase()}] ${message}`);
}

function pushStatus() {
  broadcastFn?.({ type: "status", running: state.running, todayCount: state.todayCount, totalApplied: state.totalApplied } as object, state.ownerId ?? undefined);
}
// ─────────────────────────────────────────────────────────────────────────────

export async function startAutopilot(overrides: Partial<SearchParams> & { urls?: string[] } = {}): Promise<void> {
  const owner = currentUser();

  // GAP 2.1 FIX: Check per-user state, not global state.
  // A user can only have one run at a time, but multiple users can run concurrently.
  if (owner) {
    const userState = getUserState(owner.userId);
    if (userState.running) {
      throw new Error("Autopilot already running for your account.");
    }

    // Bound total concurrency to prevent OOM on free-tier hosts.
    const activeCount = [...userStates.values()].filter((s) => s.running).length;
    if (activeCount >= MAX_CONCURRENT) {
      throw new Error(
        `Server at capacity (${MAX_CONCURRENT} concurrent runs). Try again in a few minutes, or use the browser extension to apply now.`,
      );
    }

    // Reserve the user's slot synchronously before the first await.
    userState.running = true;
    userState.todayCount = 0;
    userState.ownerId = owner.userId;
    userState.sessionId = `session_${Date.now()}`;

    // Update legacy global state for API routes that check it.
    state.running = true;
    state.ownerId = owner.userId;
    state.sessionId = userState.sessionId;

    const sessionId = userState.sessionId;

    try {
      const store = getStore();
      const profile = await readProfile<Profile>();
      if (!profile) throw new Error("No profile saved. Complete onboarding first.");
      const settings = normalizeAgentSettings(await store.get("settings"));
      broadcastTo(owner.userId, { type: "autopilot_started", sessionId, ts: Date.now() });
      pushStatusFor(owner.userId);

      // Run in background. The AsyncLocalStorage tenant context propagates.
      runInBackground(owner.userId, profile, settings, overrides).catch((e) => {
        logFor(owner.userId, `Fatal error: ${e.message}`, "error");
        stopAutopilotForUser(owner.userId);
      });
    } catch (error) {
      if (userState.sessionId === sessionId) {
        userState.running = false;
        userState.sessionId = null;
        userState.ownerId = null;
        syncGlobalState();
        pushStatusFor(owner.userId);
      }
      throw error;
    }
  } else {
    // No authenticated user in context — single-user local mode fallback.
    if (state.running) {
      throw new Error(
        state.ownerId
          ? "The shared apply engine is busy with another run. Try again in a few minutes, or use the browser extension to apply now."
          : "Autopilot already running",
      );
    }
    state.running = true;
    state.todayCount = 0;
    state.ownerId = null;
    state.sessionId = `session_${Date.now()}`;
    const sessionId = state.sessionId;
    try {
      const store = getStore();
      const profile = await readProfile<Profile>();
      if (!profile) throw new Error("No profile saved. Complete onboarding first.");
      const settings = normalizeAgentSettings(await store.get("settings"));
      broadcast({ type: "autopilot_started", sessionId, ts: Date.now() });
      pushStatus();
      runInBackgroundLegacy(profile, settings, overrides).catch((e) => {
        log(`Fatal error: ${e.message}`, "error");
        stopAutopilot();
      });
    } catch (error) {
      if (state.sessionId === sessionId) {
        state.running = false;
        state.sessionId = null;
        state.ownerId = null;
        pushStatus();
      }
      throw error;
    }
  }
}

/** Run for a specific authenticated user (multi-tenant path). */
async function runInBackground(
  userId: string,
  profile: Profile,
  settings: AgentSettings,
  overrides: Partial<SearchParams> & { urls?: string[] },
) {
  const userState = getUserState(userId);

  // We need to re-enter the user's ALS context since we're in a detached async chain.
  const user = await userFromUserId(userId);
  if (!user) {
    logFor(userId, "User no longer exists. Aborting autopilot.", "error");
    stopAutopilotForUser(userId);
    return;
  }

  try {
    logFor(userId, "🚀 Launching browser session...", "info");
    const headless = settings.search.headless;
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const profileDir = `.playwright-profiles/${safeUserId}`;

    const ctx = await chromium.launchPersistentContext(profileDir, {
      headless,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    userBrowserCtx.set(userId, ctx);

    logFor(userId, "✅ Browser ready.", "success");

    const source = settings.search.source;
    let adapter: SourceAdapter = LinkedInAdapter;
    if (overrides.urls && overrides.urls.length > 0) {
      adapter = createGenericAdapter(overrides.urls);
      logFor(userId, `📡 Target Platform: DIRECT CAREER SITES (${overrides.urls.length} URLs)`, "info");
    } else if (source === "indeed") {
      adapter = IndeedAdapter;
      logFor(userId, "📡 Target Platform: INDEED", "info");
    } else if (source === "glassdoor") {
      adapter = GlassdoorAdapter;
      logFor(userId, "📡 Target Platform: GLASSDOOR", "info");
    } else if (source === "naukri") {
      adapter = new NaukriAdapter();
      logFor(userId, "📡 Target Platform: NAUKRI", "info");
    } else {
      logFor(userId, "📡 Target Platform: LINKEDIN EASY APPLY", "info");
    }

    const p = profile as any;
    const s = settings.search;
    const params: SearchParams = {
      keywords: p.targetRoles?.join(", ") ?? p.preferences?.roleTitles?.join(", ") ?? "Software Engineer",
      location: p.preferredLocation ?? p.location ?? "Remote",
      limit: s.dailyLimit,
      maxApplications: s.dailyLimit,
      minScore: s.minMatchScore,
      dryRun: s.dryRun,
      delayMs: 1200,
      easyApplyOnly: s.easyApplyOnly,
      remoteOnly: p.workTypes?.includes("Remote") ?? false,
      under10Applicants: s.under10Applicants,
      datePosted: s.datePosted,
      gates: { blacklistKeywords: s.blacklistedCompanies },
      ...overrides,
    };

    logFor(userId, `🔍 Searching: "${params.keywords}" in "${params.location}"`, "info");
    logFor(userId, `⚙️ Limit: ${params.maxApplications}/day · Min score: ${params.minScore}% · Dry run: ${params.dryRun}`, "info");

    const hooks: PipelineHooks = {
      onDiscover: (n) => logFor(userId, `📄 Discovered ${n} job listings`, "info"),
      onDedup: (skipped, total) => logFor(userId, `♻️ Deduped ${skipped}/${total} already-seen jobs`, "info"),
      onScore: (title, score) =>
        score >= (params.minScore ?? 70)
          ? logFor(userId, `✅ Matched (${score}%): ${title}`, "info")
          : logFor(userId, `⏭️ Skipped (${score}% < ${params.minScore}%): ${title}`, "warn"),
      onApplyStart: (title) => logFor(userId, `📝 Applying to: ${title}`, "info"),
      onFill: (filled, skipped) => logFor(userId, `📋 Form filled: ${filled} fields (${skipped} skipped)`, "info"),
      onCoverLetter: (title, generated) =>
        logFor(userId, `📄 Cover letter ${generated ? "generated by AI" : "from template"} for: ${title}`, "info"),
      onRetry: (field, attempt, error) => logFor(userId, `🔁 Retry ${attempt} on field "${field}": ${error}`, "warn"),
      onOutcome: async (result) => {
        if (!userState.running) return;
        const { job, outcome, matchScore, filledFields } = result;
        const label =
          outcome === "applied"
            ? "✅ Applied"
            : outcome === "dry-run"
              ? "🧪 [DRY RUN] Applied"
              : outcome === "skipped-low-score"
                ? "⏭️ Skipped (low score)"
                : outcome === "skipped-gate"
                  ? "🛡️ Gated out"
                  : "❌ Failed";

        const msg = `${label}: ${job.title} @ ${job.company} · ${matchScore}% match · ${filledFields ?? 0} fields`;
        const lvl =
          outcome === "applied" || outcome === "dry-run"
            ? "success"
            : outcome.startsWith("skipped")
              ? "warn"
              : "error";
        logFor(userId, msg, lvl);

        if (outcome === "applied" || outcome === "dry-run") {
          userState.todayCount++;
          userState.totalApplied++;

          // Run the application save inside the user's ALS tenant namespace.
          await runAsUser(user, async () => {
            const now = Date.now();
            const apps = await readApplications<any>();
            apps.unshift({
              id: `app_${now}_${Math.random().toString(36).slice(2)}`,
              jobId: job.url ?? "",
              url: job.url ?? "",
              title: job.title,
              company: job.company ?? "Unknown",
              stage: outcome === "applied" ? "applied" : "saved",
              notes: outcome === "dry-run" ? "Dry run — form filled, not submitted." : "",
              appliedAt: outcome === "applied" ? now : undefined,
              updatedAt: now,
              matchScore: matchScore ?? 0,
              location: job.location ?? "",
              salary: (job as any).salary ?? "",
              source: adapter.id,
              filledFields: filledFields ?? 0,
              dryRun: outcome === "dry-run",
            });
            await writeApplications(apps);
            await touchSyncKey("applications", now);
          });

          pushStatusFor(userId);
          broadcastTo(userId, {
            type: "application_saved",
            outcome,
            stage: outcome === "applied" ? "applied" : "saved",
            job: { title: job.title, company: job.company, matchScore, url: job.url ?? "" },
          });
        }
      },
    };

    const report = await runPipeline(ctx, adapter, params, hooks);
    logFor(userId, `🏁 Session complete — Applied: ${report.applied}, Skipped: ${report.skipped}, Failed: ${report.failed}`, "success");
    logFor(userId, `⏱️ Duration: ${Math.round((report.durationMs ?? 0) / 60000)} min`, "info");
  } catch (e: any) {
    logFor(userId, `❌ Pipeline failed: ${e.message}`, "error");
  } finally {
    await userBrowserCtx.get(userId)?.close().catch(() => {});
    userBrowserCtx.delete(userId);
    stopAutopilotForUser(userId);
  }
}

/** Legacy single-user path (no ALS context — CLI / local dev). */
async function runInBackgroundLegacy(profile: Profile, settings: AgentSettings, overrides: Partial<SearchParams> & { urls?: string[] }) {
  let browserCtx: BrowserContext | null = null;
  try {
    log("🚀 Launching browser session...", "info");
    const headless = settings.search.headless;
    const profileDir = ".playwright-profiles/default";
    browserCtx = await chromium.launchPersistentContext(profileDir, {
      headless,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    log("✅ Browser ready.", "success");
    const source = settings.search.source;
    let adapter: SourceAdapter = LinkedInAdapter;
    if (overrides.urls?.length) {
      adapter = createGenericAdapter(overrides.urls);
    } else if (source === "indeed") adapter = IndeedAdapter;
    else if (source === "glassdoor") adapter = GlassdoorAdapter;
    else if (source === "naukri") adapter = new NaukriAdapter();

    const p = profile as any;
    const s = settings.search;
    const params: SearchParams = {
      keywords: p.targetRoles?.join(", ") ?? "Software Engineer",
      location: p.preferredLocation ?? p.location ?? "Remote",
      limit: s.dailyLimit,
      maxApplications: s.dailyLimit,
      minScore: s.minMatchScore,
      dryRun: s.dryRun,
      delayMs: 1200,
      easyApplyOnly: s.easyApplyOnly,
      remoteOnly: p.workTypes?.includes("Remote") ?? false,
      under10Applicants: s.under10Applicants,
      datePosted: s.datePosted,
      gates: { blacklistKeywords: s.blacklistedCompanies },
      ...overrides,
    };
    const hooks: PipelineHooks = {
      onDiscover: (n) => log(`📄 Discovered ${n} job listings`, "info"),
      onDedup: (skipped, total) => log(`♻️ Deduped ${skipped}/${total} already-seen jobs`, "info"),
      onScore: (title, score) => (score >= (params.minScore ?? 70) ? log(`✅ Matched (${score}%): ${title}`, "info") : log(`⏭️ Skipped: ${title}`, "warn")),
      onApplyStart: (title) => log(`📝 Applying to: ${title}`, "info"),
      onFill: (filled, skipped) => log(`📋 Form filled: ${filled} fields (${skipped} skipped)`, "info"),
      onCoverLetter: (title, generated) => log(`📄 Cover letter ${generated ? "AI" : "template"} for: ${title}`, "info"),
      onRetry: (field, attempt, error) => log(`🔁 Retry ${attempt} on field "${field}": ${error}`, "warn"),
      onOutcome: async (result) => {
        if (!state.running) return;
        const { job, outcome, matchScore, filledFields } = result;
        if (outcome === "applied" || outcome === "dry-run") {
          state.todayCount++;
          state.totalApplied++;
          const now = Date.now();
          const apps = await readApplications<any>();
          apps.unshift({
            id: `app_${now}_${Math.random().toString(36).slice(2)}`,
            jobId: job.url ?? "",
            url: job.url ?? "",
            title: job.title,
            company: job.company ?? "Unknown",
            stage: outcome === "applied" ? "applied" : "saved",
            notes: outcome === "dry-run" ? "Dry run — form filled, not submitted." : "",
            appliedAt: outcome === "applied" ? now : undefined,
            updatedAt: now,
            matchScore: matchScore ?? 0,
            location: job.location ?? "",
            source: adapter.id,
            filledFields: filledFields ?? 0,
            dryRun: outcome === "dry-run",
          });
          await writeApplications(apps);
          await touchSyncKey("applications", now);
          pushStatus();
          broadcastFn?.({ type: "application_saved", outcome, job: { title: job.title, company: job.company, matchScore, url: job.url ?? "" } } as object);
        }
      },
    };
    const report = await runPipeline(browserCtx, adapter, params, hooks);
    log(`🏁 Session complete — Applied: ${report.applied}, Skipped: ${report.skipped}, Failed: ${report.failed}`, "success");
  } catch (e: any) {
    log(`❌ Pipeline failed: ${e.message}`, "error");
  } finally {
    await browserCtx?.close().catch(() => {});
    stopAutopilot();
  }
}

// Legacy broadcast shim for the no-owner path
function broadcast(payload: object) {
  broadcastFn?.(payload, state.ownerId ?? undefined);
}

/**
 * Stop a specific user's autopilot run (multi-tenant path).
 */
function stopAutopilotForUser(userId: string): void {
  const userState = userStates.get(userId);
  if (!userState?.running) return;
  userState.running = false;
  userState.sessionId = null;
  userBrowserCtx.get(userId)?.close().catch(() => {});
  userBrowserCtx.delete(userId);
  broadcastTo(userId, { type: "autopilot_stopped", ts: Date.now() });
  pushStatusFor(userId);
  syncGlobalState();
}

/**
 * Stop the current run.
 *
 * @param requesterId when given, the stop only succeeds if that user owns the
 *   run. Internal callers (the pipeline's own `finally`) omit it to force a stop.
 * @returns false when a run exists but belongs to someone else.
 */
export function stopAutopilot(requesterId?: string): boolean {
  if (requesterId) {
    // GAP 2.1 FIX: Stop this specific user's run.
    const userState = userStates.get(requesterId);
    if (!userState?.running) return true;
    stopAutopilotForUser(requesterId);
    syncGlobalState();
    return true;
  }

  // Legacy path: stop whatever is running.
  if (!state.running) return true;
  state.running = false;
  // Also stop all user-level states (for global stop).
  for (const [uid, us] of userStates) {
    if (us.running) stopAutopilotForUser(uid);
  }
  state.sessionId = null;
  state.ownerId = null;
  broadcast({ type: "autopilot_stopped", ts: Date.now() });
  pushStatus();
  log("⏹️ Autopilot stopped.", "warn");
  return true;
}

export function getStatus(): RunnerState {
  return { ...state };
}

/**
 * Run status as seen by one user.
 * GAP 2.1 FIX: Returns per-user state, not global state.
 */
export function statusFor(userId: string | undefined): Omit<RunnerState, "ownerId"> & { owned: boolean } {
  if (!userId) return { running: false, todayCount: 0, totalApplied: 0, sessionId: null, owned: false };

  const userState = userStates.get(userId);
  if (!userState?.running) {
    return { running: false, todayCount: 0, totalApplied: 0, sessionId: null, owned: false };
  }
  return {
    running: userState.running,
    todayCount: userState.todayCount,
    totalApplied: userState.totalApplied,
    sessionId: userState.sessionId,
    owned: true,
  };
}

/**
 * True when another user (not `userId`) currently has an active run.
 * Still used by the API to decide whether to show a capacity warning.
 */
export function isBusyForOthers(userId: string | undefined): boolean {
  for (const [uid, us] of userStates) {
    if (us.running && uid !== userId) return true;
  }
  return false;
}
