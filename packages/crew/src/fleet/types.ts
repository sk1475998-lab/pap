/**
 * Shared types for the parallel apply fleet.
 */
import type { Job, Profile, LLMConfig } from "@superjob/core";
import type { ResumeEnhancement } from "./resume-enhancer.js";

/** Lifecycle phases a single job moves through inside a worker. */
export type FleetPhase =
  | "queued"
  | "scoring"
  | "gated"        // failed the readiness gate — will not apply
  | "enhancing"    // tailoring resume + cover letter
  | "submitting"
  | "applied"
  | "preview"      // dry-run: prepared but not submitted
  | "skipped"
  | "failed";

/** Live status for one job in the fleet. Emitted on every transition. */
export interface FleetJobStatus {
  jobId: string;
  url: string;
  title: string;
  company: string;
  phase: FleetPhase;
  score?: number;
  atsBefore?: number;
  atsAfter?: number;
  filledFields?: number;
  message?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
  /** Wall-clock ms from queued to terminal phase. */
  durationMs?: number;
}

/**
 * The function that actually submits an application. Provided by the caller:
 *   - extension: drives the content-script autofill engine
 *   - applier package: drives Playwright
 *   - tests / dry-run: a stub
 * MUST resolve (never reject) — throw only for genuine infra errors.
 */
export type SubmitFn = (input: {
  job: Job;
  coverLetter: string;
  enhancedResumeText: string;
}) => Promise<{ outcome: string; filledFields: number; error?: string }>;

export interface FleetConfig {
  profile: Profile;
  llmConfig: LLMConfig;
  jobs: Job[];
  /** Max jobs processed at the same time. Default 10. */
  concurrency?: number;
  /** Minimum readiness score (0..100) required to apply. Default 60. */
  minScore?: number;
  /** When true, prepare everything but never submit. Default true (safe). */
  dryRun?: boolean;
  /**
   * Milliseconds of jitter between launching workers, to avoid hammering a
   * job board with 10 identical requests in the same tick. Default 250ms.
   */
  launchJitterMs?: number;
  /** Optional real submitter. Omitted → preview only regardless of dryRun. */
  submitFn?: SubmitFn;
  /** Cap keyword gaps woven into each tailored resume. Default 10. */
  maxKeywordsPerResume?: number;
}

export interface FleetHooks {
  onJobUpdate?: (status: FleetJobStatus) => void;
  onProgress?: (done: number, total: number) => void;
}

export interface FleetJobResult extends FleetJobStatus {
  enhancement?: ResumeEnhancement;
  coverLetter?: string;
}

export interface FleetReport {
  runId: string;
  total: number;
  applied: number;
  preview: number;
  gated: number;
  skipped: number;
  failed: number;
  concurrency: number;
  /** Peak number of workers that were in flight at the same time. */
  peakConcurrency: number;
  durationMs: number;
  results: FleetJobResult[];
}
