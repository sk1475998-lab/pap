/**
 * Fleet orchestrator — applies to many jobs in parallel with bounded
 * concurrency. This is the engine behind "apply to 10 jobs simultaneously".
 *
 * Design:
 *   - A fixed-size worker pool (default 10) pulls from a job queue.
 *   - Each slot runs one `runApplyWorker` to completion, then pulls the next.
 *   - Peak in-flight count is tracked to prove real parallelism.
 *   - A small launch jitter staggers the initial burst so we don't fire N
 *     identical network requests in the same event-loop tick.
 *   - An AbortSignal cancels: in-flight workers finish, queued jobs are marked
 *     skipped.
 *
 * The orchestrator itself performs no DOM / network work — it composes workers.
 * That keeps it identically usable from the extension service worker, the
 * Playwright applier, the CLI, and tests.
 */
import { buildLLM, runApplyWorker, type WorkerDeps } from "./apply-worker.js";
import type {
  FleetConfig,
  FleetHooks,
  FleetJobResult,
  FleetJobStatus,
  FleetReport,
} from "./types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ApplyFleet {
  private readonly config: Required<Omit<FleetConfig, "submitFn">> &
    Pick<FleetConfig, "submitFn">;
  private readonly hooks: FleetHooks;

  private inFlight = 0;
  private peakConcurrency = 0;
  private readonly statuses = new Map<string, FleetJobStatus>();

  constructor(config: FleetConfig, hooks: FleetHooks = {}) {
    this.config = {
      concurrency: Math.max(1, config.concurrency ?? 10),
      minScore: config.minScore ?? 60,
      dryRun: config.dryRun ?? true,
      launchJitterMs: config.launchJitterMs ?? 250,
      maxKeywordsPerResume: config.maxKeywordsPerResume ?? 10,
      profile: config.profile,
      llmConfig: config.llmConfig,
      jobs: config.jobs,
      submitFn: config.submitFn,
    };
    this.hooks = hooks;
  }

  /** Snapshot of current per-job statuses (for live UI polling). */
  snapshot(): FleetJobStatus[] {
    return [...this.statuses.values()];
  }

  async run(signal?: AbortSignal): Promise<FleetReport> {
    const runId = `fleet_${Date.now().toString(36)}`;
    const startedAt = Date.now();
    const { jobs, concurrency } = this.config;

    // Deduplicate by URL so the same posting isn't applied to twice in one run.
    const seen = new Set<string>();
    const queue = jobs.filter((j) => {
      const key = j.url || j.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const llm = buildLLM(this.config.llmConfig);
    const results: FleetJobResult[] = [];
    let done = 0;

    const emit = (status: FleetJobStatus) => {
      this.statuses.set(status.jobId, status);
      this.hooks.onJobUpdate?.(status);
    };

    // Seed every job as queued so the UI can render the full list immediately.
    for (const job of queue) {
      emit({
        jobId: job.id,
        url: job.url,
        title: job.title,
        company: job.company,
        phase: "queued",
        startedAt,
        updatedAt: startedAt,
      });
    }

    const deps: Omit<WorkerDeps, "emit"> = {
      profile: this.config.profile,
      llmConfig: this.config.llmConfig,
      minScore: this.config.minScore,
      dryRun: this.config.dryRun,
      submitFn: this.config.submitFn,
      maxKeywordsPerResume: this.config.maxKeywordsPerResume,
      llm,
    };

    let cursor = 0;
    const total = queue.length;

    const worker = async (slot: number): Promise<void> => {
      // Stagger the initial launch of each slot.
      if (this.config.launchJitterMs > 0) {
        await sleep(slot * this.config.launchJitterMs);
      }
      while (cursor < queue.length) {
        if (signal?.aborted) return;
        const job = queue[cursor++]!;

        this.inFlight++;
        this.peakConcurrency = Math.max(this.peakConcurrency, this.inFlight);
        try {
          const result = await runApplyWorker(job, { ...deps, emit });
          results.push(result);
        } finally {
          this.inFlight--;
          done++;
          this.hooks.onProgress?.(done, total);
        }
      }
    };

    const slots = Math.min(concurrency, queue.length);
    await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));

    // Any jobs left unstarted due to abort → mark skipped.
    if (signal?.aborted) {
      for (let i = cursor; i < queue.length; i++) {
        const job = queue[i]!;
        const s: FleetJobResult = {
          jobId: job.id,
          url: job.url,
          title: job.title,
          company: job.company,
          phase: "skipped",
          message: "Run aborted before this job started.",
          startedAt,
          updatedAt: Date.now(),
          durationMs: 0,
        };
        emit(s);
        results.push(s);
      }
    }

    const count = (p: FleetJobStatus["phase"]) => results.filter((r) => r.phase === p).length;
    return {
      runId,
      total,
      applied: count("applied"),
      preview: count("preview"),
      gated: count("gated"),
      skipped: count("skipped"),
      failed: count("failed"),
      concurrency,
      peakConcurrency: this.peakConcurrency,
      durationMs: Date.now() - startedAt,
      results,
    };
  }
}

/** One-shot helper: build + run a fleet. */
export async function applyToJobsInParallel(
  config: FleetConfig,
  hooks?: FleetHooks,
  signal?: AbortSignal,
): Promise<FleetReport> {
  return new ApplyFleet(config, hooks).run(signal);
}
