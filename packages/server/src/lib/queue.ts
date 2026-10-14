/**
 * SuperJobAgent — BullMQ Job Queue (Gap 3.1 Fix)
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM: The current in-process Playwright runner blocks the HTTP thread and
 * crashes if the server restarts mid-session (all state lost, partial form
 * submissions remain open on LinkedIn/Workday).
 *
 * SOLUTION: A Redis-backed BullMQ queue separates HTTP request handling from
 * Playwright execution. Each "apply session" becomes a durable job:
 *   - Jobs survive server restarts (Redis persistence).
 *   - The HTTP request returns immediately with a jobId (202 Accepted).
 *   - The client polls GET /api/jobs/status/:jobId for progress.
 *   - Multiple worker containers can drain the queue (horizontal scaling).
 *
 * ARCHITECTURE:
 *   POST /api/autopilot/start
 *     └─ enqueueAutopilotJob() → Bull Queue → Redis
 *         └─ Worker (same process OR separate container)
 *             └─ runPipeline() → Playwright → LinkedIn/Indeed
 *                 └─ progress events → WebSocket broadcast
 *
 * DEPLOYMENT:
 *   - Tier 1 (single container): Worker runs in-process (current Docker setup).
 *   - Tier 2 (scale-out): Spawn separate worker containers pointed at same Redis.
 *     Set SUPERJOB_WORKER_ONLY=true to start a container as a pure worker.
 *
 * ACTIVATION:
 *   Requires REDIS_URL in .env. When REDIS_URL is absent, falls back gracefully
 *   to the existing in-process startAutopilot() so local dev needs nothing new.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SearchParams } from "@superjob/applier";

// Lazy BullMQ imports — avoids "cannot find module bullmq" if Redis isn't configured.
// We use dynamic import so the server starts clean without Redis in local dev.
let Queue: any;
let Worker: any;
let QueueEvents: any;

async function loadBullMQ() {
  if (Queue) return;
  try {
    const bullmq = await import("bullmq");
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    QueueEvents = bullmq.QueueEvents;
  } catch {
    throw new Error(
      "BullMQ is not installed. Run: npm install bullmq --workspace @superjob/server\n" +
      "Or set REDIS_URL to disable this check."
    );
  }
}

// ── Queue name constants ──────────────────────────────────────────────────────

export const QUEUE_AUTOPILOT = "sja:autopilot";
export const QUEUE_TAILOR    = "sja:tailor";
export const QUEUE_SCORE     = "sja:score";

// ── Job data types ───────────────────────────────────────────────────────────

export interface AutopilotJobData {
  userId: string;
  sessionId: string;
  overrides: Partial<SearchParams> & { urls?: string[] };
  enqueuedAt: number;
}

export interface TailorJobData {
  userId: string;
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
}

// ── Connection config ─────────────────────────────────────────────────────────

function redisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for BullMQ queue mode.");

  // BullMQ expects { host, port, username?, password? } not a URL string.
  // Parse once here; ioredis (BullMQ's underlying client) also accepts a URL
  // directly since ioredis 5.x — pass it through.
  return { url };
}

// ── Singleton queues (created once per process) ──────────────────────────────

let autopilotQueue: any = null;
let tailorQueue: any = null;

export async function getAutopilotQueue() {
  if (autopilotQueue) return autopilotQueue;
  await loadBullMQ();
  autopilotQueue = new Queue(QUEUE_AUTOPILOT, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 200 },  // keep last 200 completed jobs for dashboard
      removeOnFail:    { count: 500 },
    },
  });
  return autopilotQueue;
}

export async function getTailorQueue() {
  if (tailorQueue) return tailorQueue;
  await loadBullMQ();
  tailorQueue = new Queue(QUEUE_TAILOR, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 2000 },
      removeOnComplete: { count: 500 },
      removeOnFail:    { count: 200 },
    },
  });
  return tailorQueue;
}

// ── Enqueue helpers ──────────────────────────────────────────────────────────

/**
 * Add an autopilot apply session to the queue.
 * Returns the BullMQ job ID (used to poll status via GET /api/jobs/:id).
 */
export async function enqueueAutopilotJob(data: AutopilotJobData): Promise<string> {
  const q = await getAutopilotQueue();
  const job = await q.add("apply-session", data, {
    jobId: data.sessionId,  // deterministic ID — prevents duplicate sessions
    priority: 1,
  });
  return job.id as string;
}

/**
 * Add a resume tailoring job to the queue.
 */
export async function enqueueTailorJob(data: TailorJobData): Promise<string> {
  const q = await getTailorQueue();
  const job = await q.add("tailor-resume", data);
  return job.id as string;
}

// ── Status polling ────────────────────────────────────────────────────────────

export type JobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "unknown";

export interface JobStatusResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  result?: unknown;
  failReason?: string;
  enqueuedAt?: number;
  processedAt?: number;
  finishedAt?: number;
}

export async function getAutopilotJobStatus(jobId: string): Promise<JobStatusResult> {
  try {
    const q = await getAutopilotQueue();
    const job = await q.getJob(jobId);
    if (!job) return { jobId, status: "unknown", progress: 0 };

    const state = await job.getState();
    return {
      jobId,
      status: state as JobStatus,
      progress: typeof job.progress === "number" ? job.progress : 0,
      result: job.returnvalue ?? undefined,
      failReason: job.failedReason ?? undefined,
      enqueuedAt: job.timestamp,
      processedAt: job.processedOn ?? undefined,
      finishedAt: job.finishedOn ?? undefined,
    };
  } catch {
    return { jobId, status: "unknown", progress: 0 };
  }
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Start the autopilot BullMQ worker in the CURRENT process.
 *
 * In single-container deployments (current Tier 1): called from server/index.ts.
 * In multi-container Tier 2: run in a dedicated worker container with env
 *   SUPERJOB_WORKER_ONLY=true so it never starts the HTTP server.
 *
 * @param processor - The actual job processing function (pipeline-runner logic).
 *   Receives the userId and overrides, returns void.
 */
export async function startAutopilotWorker(
  processor: (data: AutopilotJobData, updateProgress: (pct: number) => void) => Promise<void>
): Promise<void> {
  await loadBullMQ();

  const worker = new Worker(
    QUEUE_AUTOPILOT,
    async (job: any) => {
      const data = job.data as AutopilotJobData;
      const updateProgress = async (pct: number) => {
        await job.updateProgress(pct);
      };
      await processor(data, updateProgress);
    },
    {
      connection: redisConnection(),
      concurrency: Number(process.env.SUPERJOB_MAX_CONCURRENT ?? 3),
      // Playwright sessions can take 20–40 minutes for a 50-job run.
      lockDuration: 60 * 60 * 1000,  // 1 hour lock
    }
  );

  worker.on("completed", (job: any) => {
    console.log(`[queue] Autopilot job ${job.id} completed for user ${job.data?.userId}`);
  });

  worker.on("failed", (job: any, err: Error) => {
    console.error(`[queue] Autopilot job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err: Error) => {
    console.error("[queue] Worker error:", err.message);
  });

  console.log(`[queue] Autopilot worker started (concurrency=${process.env.SUPERJOB_MAX_CONCURRENT ?? 3})`);
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function getQueueHealth(): Promise<{
  available: boolean;
  autopilot?: { waiting: number; active: number; completed: number; failed: number };
}> {
  if (!process.env.REDIS_URL) return { available: false };
  try {
    const q = await getAutopilotQueue();
    const [waiting, active, completed, failed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
    ]);
    return { available: true, autopilot: { waiting, active, completed, failed } };
  } catch {
    return { available: false };
  }
}
