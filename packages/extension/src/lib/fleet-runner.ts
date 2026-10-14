/**
 * Fleet runner (background side).
 *
 * Wraps @superjob/crew's ApplyFleet so it runs inside the MV3 service worker,
 * where LLM fetches are CORS-free and the run survives the side panel closing.
 *
 * Live state is streamed to chrome.storage.local under FLEET_STATE_KEY on every
 * per-job transition (throttled). The side panel's Fleet tab subscribes to that
 * key via chrome.storage.onChanged, so the UI stays live without a long-lived
 * message port.
 *
 * v1 is PREVIEW-first: we tailor a fresh resume + cover letter per job and score
 * ATS before/after, in parallel, WITHOUT submitting. That is the headline
 * ("enhance resume per job without ever changing the original") and the safe
 * default. Actual end-to-end submission reuses the existing per-tab orchestrator
 * and is layered on separately.
 */
import { ApplyFleet, type FleetJobStatus, type FleetReport } from "@superjob/crew/fleet";
import type { Job, Profile, LLMConfig } from "@superjob/core";
import { createTabSubmitter } from "./tab-submitter.js";

export const FLEET_STATE_KEY = "sja:fleet:state";

export interface FleetRunState {
  runId: string;
  status: "running" | "done" | "aborted" | "error";
  startedAt: number;
  updatedAt: number;
  total: number;
  done: number;
  concurrency: number;
  dryRun: boolean;
  peakConcurrency: number;
  jobs: FleetJobStatus[];
  report?: FleetReport;
  error?: string;
}

export interface StartFleetOptions {
  concurrency?: number;
  minScore?: number;
  dryRun?: boolean;
  maxKeywordsPerResume?: number;
}

/**
 * Live (submit) runs open a real browser tab per job and drive the proven
 * single-tab autopilot. Tabs are heavy, so live mode is capped hard regardless
 * of the requested worker count — the preview planner can fan out to 10+, but
 * we never open 10 automation tabs at once.
 */
const MAX_LIVE_CONCURRENCY = 3;

let activeController: AbortController | null = null;
let activeRunId: string | null = null;

/** Throttled writer so a burst of transitions doesn't thrash storage. */
function makeThrottledWriter(minIntervalMs = 120) {
  let pending: FleetRunState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWrite = 0;

  const flush = () => {
    if (!pending) return;
    const snapshot = pending;
    pending = null;
    lastWrite = Date.now();
    void chrome.storage.local.set({ [FLEET_STATE_KEY]: snapshot });
  };

  return {
    write(state: FleetRunState) {
      pending = state;
      const since = Date.now() - lastWrite;
      if (since >= minIntervalMs) {
        if (timer) { clearTimeout(timer); timer = null; }
        flush();
      } else if (!timer) {
        timer = setTimeout(() => { timer = null; flush(); }, minIntervalMs - since);
      }
    },
    /** Force an immediate final write (bypasses throttle). */
    final(state: FleetRunState) {
      pending = state;
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
    },
  };
}

export async function readFleetState(): Promise<FleetRunState | null> {
  try {
    const raw = await chrome.storage.local.get(FLEET_STATE_KEY);
    return (raw?.[FLEET_STATE_KEY] as FleetRunState) ?? null;
  } catch {
    return null;
  }
}

export function abortFleetRun(): { aborted: boolean } {
  if (activeController) {
    activeController.abort();
    return { aborted: true };
  }
  return { aborted: false };
}

/**
 * Start a parallel apply/enhance run. Returns immediately with the runId; the
 * run continues in the background and streams state to storage.
 */
export async function startFleetRun(
  profile: Profile,
  llmConfig: LLMConfig,
  jobs: Job[],
  opts: StartFleetOptions = {},
): Promise<{ runId: string; total: number }> {
  // Only one run at a time — abort any prior run first.
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  const dryRun = opts.dryRun ?? true;
  const requested = Math.max(1, Math.min(opts.concurrency ?? 10, 20));
  // Live mode drives real tabs → cap hard. Preview is pure compute → fan out.
  const concurrency = dryRun ? requested : Math.min(requested, MAX_LIVE_CONCURRENCY);
  const runId = `fleet_${Date.now().toString(36)}`;
  activeRunId = runId;
  const startedAt = Date.now();

  const byId = new Map<string, FleetJobStatus>();
  const writer = makeThrottledWriter();
  let done = 0;

  const buildState = (
    status: FleetRunState["status"],
    extra: Partial<FleetRunState> = {},
  ): FleetRunState => ({
    runId,
    status,
    startedAt,
    updatedAt: Date.now(),
    total: jobs.length,
    done,
    concurrency,
    dryRun,
    peakConcurrency: 0,
    jobs: [...byId.values()],
    ...extra,
  });

  // Seed an initial "running" state so the UI shows the queue immediately.
  writer.final(buildState("running"));

  // LIVE mode drives the real per-tab orchestrator, whose autopilot engines
  // early-return unless autonomousMode is enabled. Turn on the fill/advance
  // settings so opened tabs actually get filled — but deliberately leave
  // autoSubmit untouched, preserving the "no surprise submit" guarantee (final
  // submission stays under the user's explicit control).
  if (!dryRun) {
    try {
      const { getStore, mergeAgentSettings } = await import("@superjob/core");
      const store = getStore();
      const cur = mergeAgentSettings(await store.get("settings"));
      await store.set("settings", {
        ...cur,
        autonomousMode: true,
        autoClickEasyApply: true,
        autoFillSteps: true,
        autoAdvanceSteps: true,
      });
    } catch {
      // Non-fatal: if settings can't be persisted the tabs still open; worst
      // case the engine no-ops rather than crashing the whole run.
    }
  }

  // In live mode, attach the real tab-driven autopilot submitter. In preview
  // mode we attach nothing, so the worker prepares (tailors + scores) only.
  const submitFn = dryRun ? undefined : createTabSubmitter({ openActive: false });

  const fleet = new ApplyFleet(
    { profile, llmConfig, jobs, concurrency, dryRun, submitFn, minScore: opts.minScore ?? 60, maxKeywordsPerResume: opts.maxKeywordsPerResume ?? 10, launchJitterMs: dryRun ? 150 : 1200 },
    {
      onJobUpdate: (s) => {
        byId.set(s.jobId, s);
        writer.write(buildState("running"));
      },
      onProgress: (d) => {
        done = d;
        writer.write(buildState("running"));
      },
    },
  );

  // Run without blocking the message handler.
  void (async () => {
    try {
      const report = await fleet.run(controller.signal);
      writer.final(
        buildState(controller.signal.aborted ? "aborted" : "done", {
          report,
          peakConcurrency: report.peakConcurrency,
          done: report.total,
        }),
      );
    } catch (e) {
      writer.final(buildState("error", { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (activeRunId === runId) {
        activeController = null;
        activeRunId = null;
      }
    }
  })();

  return { runId, total: jobs.length };
}

/* ─────────────────────────────────────────────────────────────────── */
/* Phase 3: Enterprise Crew Campaign                                    */
/* Wraps startFleetRun with full 7-agent crew orchestration.           */
/* If @superjob/crew fails to import (e.g. bundle split), falls back.  */
/* ─────────────────────────────────────────────────────────────────── */

export interface EnterpriseCampaignOptions extends StartFleetOptions {
  /** Emit rich agent-level events to chrome.storage for the Fleet live monitor. */
  verbose?: boolean;
}

/**
 * Launch a full multi-agent job campaign:
 *   Recon → Score → Tailor → Apply → Heal → Review
 *
 * Differences from plain startFleetRun:
 *   1. Recon Agent pre-scans the job board to build the Tool Archive
 *   2. Scoring Agent filters below minScore (default 60) before tailoring
 *   3. Healing Agent retries failed applications up to 3× with Reflexion+AgentQ
 *   4. Reviewer Agent routes risky applications to the HITL Review Queue
 */
export async function createEnterpriseJobCrew(
  profile: Profile,
  llmConfig: LLMConfig,
  jobs: Job[],
  opts: EnterpriseCampaignOptions = {},
): Promise<{ runId: string; total: number }> {
  try {
    const { createEnterpriseJobCrew: crewFactory } = await import("@superjob/crew");
    if (typeof crewFactory === "function") {
      const runId = `crew_${Date.now().toString(36)}`;
      const startedAt = Date.now();
      const dryRun = opts.dryRun ?? true;
      const writer = makeThrottledWriter();
      const byId = new Map<string, FleetJobStatus>();

      for (const j of jobs) {
        byId.set(j.id, {
          jobId: j.id,
          url: j.url,
          title: j.title,
          company: j.company,
          phase: "queued",
          startedAt,
          updatedAt: startedAt,
        });
      }

      const buildCrewState = (status: FleetRunState["status"], extra: Partial<FleetRunState> = {}): FleetRunState => ({
        runId,
        status,
        startedAt,
        updatedAt: Date.now(),
        total: jobs.length,
        done: [...byId.values()].filter((j) => ["applied", "preview", "gated", "skipped", "failed"].includes(j.phase)).length,
        concurrency: 1,
        dryRun,
        peakConcurrency: 1,
        jobs: [...byId.values()],
        ...extra,
      });

      writer.final(buildCrewState("running"));

      const submitFn = dryRun ? undefined : createTabSubmitter({ openActive: false });

      // Wrap input jobs in the JobSource interface expected by crew
      const staticSource = {
        name: "Fleet Candidate Queue",
        discover: async () => jobs,
      };

      const crew = crewFactory({
        source: staticSource,
        applierOpts: {
          submitFn: submitFn ? async (jobUrl: string, coverLetter: string, _ctx: any) => {
            const matchedJob = jobs.find((j) => j.url === jobUrl);
            if (!matchedJob) return { outcome: "not_found", filledFields: 0, error: "Job URL not found in queue" };
            return submitFn({ job: matchedJob, coverLetter, enhancedResumeText: "" });
          } : undefined,
        },
        reconOpts: { maxFailuresBeforeRebuild: 3 },
        healingOpts: { maxRetries: 3 },
        reviewOpts: { autoSubmitMinConfidence: 90 },
        lite: false,
      });

      // Launch multi-agent swarm asynchronously without blocking UI
      void (async () => {
        try {
          const result = await crew.kickoff(
            {
              profile,
              llmConfig,
              searchParams: {
                keywords: "",
                location: "",
                limit: jobs.length,
                maxApplications: jobs.length,
                dryRun,
                minScore: opts.minScore ?? 60,
              },
            },
            {
              onAgentStart: (agentName) => {
                writer.write(buildCrewState("running"));
              },
              onAgentDone: (agentName) => {
                writer.write(buildCrewState("running"));
              },
            }
          );

          // Update job statuses based on crew results
          for (const applied of result.blackboard.applied) {
            const prev = byId.get(applied.job.id);
            if (prev) {
              byId.set(applied.job.id, {
                ...prev,
                phase: dryRun ? "preview" : applied.error ? "failed" : "applied",
                score: applied.score,
                filledFields: applied.filledFields,
                error: applied.error,
                updatedAt: Date.now(),
              });
            }
          }

          // Mark scored & skipped jobs that were not applied
          for (const scored of result.blackboard.scored) {
            const prev = byId.get(scored.job.id);
            if (prev && prev.phase === "queued" && scored.recommendation === "skip") {
              byId.set(scored.job.id, {
                ...prev,
                phase: "skipped",
                score: scored.score,
                error: scored.reasoning || "Score below minimum threshold",
                updatedAt: Date.now(),
              });
            }
          }

          // Ensure any remaining jobs in queued transition cleanly to skipped
          for (const [id, job] of byId.entries()) {
            if (job.phase === "queued") {
              byId.set(id, {
                ...job,
                phase: "skipped",
                updatedAt: Date.now(),
              });
            }
          }

          writer.final(buildCrewState("done"));
        } catch (crewErr) {
          writer.final(buildCrewState("error", { error: crewErr instanceof Error ? crewErr.message : String(crewErr) }));
        }
      })();

      return { runId, total: jobs.length };
    }
  } catch (e) {
    console.warn("createEnterpriseJobCrew fallback to standard fleet:", e);
  }

  // Standard fleet fallback if crew package is unavailable
  return startFleetRun(profile, llmConfig, jobs, opts);
}
