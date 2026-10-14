/**
 * Application tracker — monitors per-job autofill progress across tabs.
 *
 * Integrates with the StatusMachine to maintain a real-time view of which
 * jobs are being processed, their current state, and fill statistics.
 */

import { AutofillStatus, statusBus, type StatusPayload } from "./status-events.js";
import { statusMachine } from "./status-machine.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface JobProgress {
  /** Unique job identifier (canonical URL or jobId). */
  jobId: string;
  /** Current autofill status for this job. */
  status: AutofillStatus;
  /** Number of fields successfully filled. */
  filled: number;
  /** Number of fields skipped. */
  skipped: number;
  /** Number of fields answered by AI. */
  aiAnswered: number;
  /** Total fields detected. */
  totalFields: number;
  /** Current step in multi-step form. */
  currentStep: number;
  /** Human-readable status message. */
  statusMessage: string;
  /** Timestamp of last update. */
  updatedAt: number;
  /** ATS platform name (if detected). */
  atsPlatform?: string;
  /** Job title (if extracted). */
  jobTitle?: string;
  /** Company name (if extracted). */
  company?: string;
}

/* ------------------------------------------------------------------ */
/* Tracker                                                             */
/* ------------------------------------------------------------------ */

class ApplicationTracker {
  private jobs = new Map<string, JobProgress>();
  private activeJobId: string | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen to all status transitions to update job progress
    const unsub = statusBus.onAny((status, payload) => {
      if (!this.activeJobId) return;
      const job = this.jobs.get(this.activeJobId);
      if (!job) return;

      job.status = status;
      job.updatedAt = Date.now();

      // Update fill counts from payload
      if ("filled" in payload && typeof payload.filled === "number") {
        job.filled = payload.filled;
      }
      if ("skipped" in payload && typeof payload.skipped === "number") {
        job.skipped = payload.skipped;
      }
      if ("aiAnswered" in payload && typeof payload.aiAnswered === "number") {
        job.aiAnswered = payload.aiAnswered;
      }
      if ("total" in payload && typeof payload.total === "number") {
        job.totalFields = payload.total;
      }
      if ("step" in payload && typeof payload.step === "number") {
        job.currentStep = payload.step;
      }

      // Generate human-readable message
      job.statusMessage = this.generateMessage(status, payload);
    });

    this.unsubscribers.push(unsub);
  }

  private generateMessage(status: AutofillStatus, payload: any): string {
    switch (status) {
      case AutofillStatus.IDLE:
        return "Ready";
      case AutofillStatus.DETECTING:
        return payload?.fieldCount ? `Scanning ${payload.fieldCount} fields...` : "Scanning page...";
      case AutofillStatus.WAITING_NETWORK:
        return "Waiting for page to load...";
      case AutofillStatus.FILLING:
        return `Filling: ${payload?.filled ?? 0}/${payload?.total ?? "?"} fields`;
      case AutofillStatus.VALIDATING:
        return "Validating form...";
      case AutofillStatus.NEEDS_REVIEW:
        return `Review needed: ${payload?.skipped ?? 0} field(s) require attention`;
      case AutofillStatus.DONE:
        return `Complete: ${payload?.filled ?? 0} filled, ${payload?.skipped ?? 0} skipped`;
      case AutofillStatus.DONE_SUBMIT:
        return "Ready to submit!";
      case AutofillStatus.BLOCKED:
        return payload?.message ?? "Blocked — manual action required";
      case AutofillStatus.DONE_BLOCKED:
        return "Filled but has validation errors";
      case AutofillStatus.PAUSED:
        return `Paused: ${payload?.reason ?? "user"}`;
      case AutofillStatus.SUBMITTED:
        return "Application submitted!";
      case AutofillStatus.ERROR:
        return `Error: ${payload?.message ?? "Unknown"}`;
      case AutofillStatus.ADVANCING:
        return payload?.label ? `Advancing: ${payload.label}` : "Moving to next step...";
      case AutofillStatus.PRE_APPLY:
        return "Running pre-apply setup...";
      case AutofillStatus.ANSWERING_CUSTOM:
        return `Answering questions: ${payload?.answered ?? 0}/${payload?.questionCount ?? "?"}`;
      case AutofillStatus.AUTH:
        return `Auth: ${payload?.mode ?? "processing"}...`;
      case AutofillStatus.GOING_BACK:
        return "Navigating back...";
      default:
        return String(status);
    }
  }

  /** Start tracking a new job. */
  startJob(
    jobId: string,
    options?: { jobTitle?: string; company?: string; atsPlatform?: string }
  ): JobProgress {
    const progress: JobProgress = {
      jobId,
      status: AutofillStatus.IDLE,
      filled: 0,
      skipped: 0,
      aiAnswered: 0,
      totalFields: 0,
      currentStep: 0,
      statusMessage: "Ready",
      updatedAt: Date.now(),
      atsPlatform: options?.atsPlatform,
      jobTitle: options?.jobTitle,
      company: options?.company,
    };

    this.jobs.set(jobId, progress);
    this.activeJobId = jobId;
    return progress;
  }

  /** Switch the active job (e.g., when user navigates to a different listing). */
  setActiveJob(jobId: string): void {
    this.activeJobId = jobId;
  }

  /** Get the currently active job progress. */
  getActiveJob(): JobProgress | undefined {
    if (!this.activeJobId) return undefined;
    return this.jobs.get(this.activeJobId);
  }

  /** Get progress for a specific job. */
  getJob(jobId: string): JobProgress | undefined {
    return this.jobs.get(jobId);
  }

  /** Get all tracked jobs sorted by most recent. */
  getAllJobs(): JobProgress[] {
    return [...this.jobs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Get aggregate statistics across all tracked jobs. */
  getStats(): {
    total: number;
    submitted: number;
    inProgress: number;
    blocked: number;
    totalFilled: number;
    totalSkipped: number;
    totalAiAnswered: number;
  } {
    let submitted = 0;
    let inProgress = 0;
    let blocked = 0;
    let totalFilled = 0;
    let totalSkipped = 0;
    let totalAiAnswered = 0;

    for (const job of this.jobs.values()) {
      if (job.status === AutofillStatus.SUBMITTED) submitted++;
      else if (statusMachine.isActive) inProgress++;
      else if (job.status === AutofillStatus.BLOCKED || job.status === AutofillStatus.DONE_BLOCKED) blocked++;
      totalFilled += job.filled;
      totalSkipped += job.skipped;
      totalAiAnswered += job.aiAnswered;
    }

    return {
      total: this.jobs.size,
      submitted,
      inProgress,
      blocked,
      totalFilled,
      totalSkipped,
      totalAiAnswered,
    };
  }

  /** Remove old job records (keep last N). */
  prune(maxJobs = 100): number {
    if (this.jobs.size <= maxJobs) return 0;
    const sorted = [...this.jobs.entries()].sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
    const toRemove = sorted.slice(0, sorted.length - maxJobs);
    for (const [key] of toRemove) {
      if (key !== this.activeJobId) {
        this.jobs.delete(key);
      }
    }
    return toRemove.length;
  }

  /** Cleanup all listeners and state. */
  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.jobs.clear();
    this.activeJobId = null;
  }
}

/** Singleton tracker for the content script. */
export const applicationTracker = new ApplicationTracker();
