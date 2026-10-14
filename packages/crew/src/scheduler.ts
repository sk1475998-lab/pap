/**
 * Scheduler — runs the crew on a recurring interval.
 *
 * This is the "always-on" brain: in a Docker container it runs the full
 * discover→score→tailor→apply pipeline every N hours, so new job postings
 * are caught automatically while you sleep.
 *
 * Uses setInterval (not node-cron) to keep zero external deps. Honors a
 * SIGTERM/SIGINT for clean Docker shutdown.
 */
import type { Crew } from "./framework.js";
import type { Blackboard, SearchRequest, LogEntry } from "./framework.js";
import type { Profile, LLMConfig } from "@superjob/core";

export interface ScheduleConfig {
  intervalMs: number;
  search: SearchRequest;
  profile: Profile;
  llmConfig: LLMConfig;
  /** stop after this many runs (0 = infinite) */
  maxRuns: number;
  onRunStart?: (runNumber: number) => void;
  onRunComplete?: (summary: string) => void;
  onLog?: (entry: LogEntry) => void;
}

export interface SchedulerHandle {
  start: () => void;
  stop: () => void;
  runCount: () => number;
}

export function createScheduler(crew: Crew, config: ScheduleConfig): SchedulerHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let runs = 0;
  let stopped = false;

  async function runOnce() {
    if (stopped) return;
    runs++;
    config.onRunStart?.(runs);

    const initial: Omit<Blackboard, "runId" | "startedAt" | "log" | "discovered" | "scored" | "tailored" | "applied"> = {
      profile: config.profile,
      llmConfig: config.llmConfig,
      searchParams: config.search,
    };

    try {
      const result = await crew.kickoff(initial);
      config.onRunComplete?.(result.summary);
      if (config.onLog) {
        for (const entry of result.log) config.onLog(entry);
      }
    } catch (e) {
      config.onLog?.({
        agent: "scheduler",
        message: `Run ${runs} failed: ${e instanceof Error ? e.message : String(e)}`,
        level: "error",
        timestamp: Date.now(),
      });
    }

    if (stopped) return;
    if (config.maxRuns > 0 && runs >= config.maxRuns) {
      config.onLog?.({
        agent: "scheduler",
        message: `Reached max runs (${config.maxRuns}). Stopping.`,
        level: "info",
        timestamp: Date.now(),
      });
      return;
    }

    timer = setTimeout(runOnce, config.intervalMs);
  }

  // graceful shutdown
  const shutdown = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return {
    start: () => {
      config.onLog?.({
        agent: "scheduler",
        message: `Scheduler started — every ${(config.intervalMs / 1000 / 60).toFixed(0)} min, max ${config.maxRuns || "∞"} runs.`,
        level: "info",
        timestamp: Date.now(),
      });
      void runOnce();
    },
    stop: shutdown,
    runCount: () => runs,
  };
}
