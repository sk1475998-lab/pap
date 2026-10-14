/**
 * Apply worker — the full pipeline for ONE job, designed to run concurrently
 * with many peers. It is self-contained and side-effect-free except through
 * the injected `submitFn`, so N of these can run at once safely.
 *
 * Pipeline: score → readiness gate → enhance resume (non-destructive) →
 *           cover letter → submit (or preview).
 */
import {
  assessApplicationReadiness,
  generateCoverLetter,
  createLLM,
  type Job,
  type Profile,
  type LLMConfig,
  type LLMClient,
} from "@superjob/core";
import { enhanceResumeForJob } from "./resume-enhancer.js";
import type { FleetJobResult, FleetJobStatus, SubmitFn } from "./types.js";

export interface WorkerDeps {
  profile: Profile;
  llmConfig: LLMConfig;
  minScore: number;
  dryRun: boolean;
  submitFn?: SubmitFn;
  maxKeywordsPerResume: number;
  /** Shared LLM client (created once per fleet run, reused across workers). */
  llm: LLMClient;
  /** Emit a status transition for this job. */
  emit: (status: FleetJobStatus) => void;
}

export async function runApplyWorker(job: Job, deps: WorkerDeps): Promise<FleetJobResult> {
  const startedAt = Date.now();
  const base: FleetJobStatus = {
    jobId: job.id,
    url: job.url,
    title: job.title,
    company: job.company,
    phase: "queued",
    startedAt,
    updatedAt: startedAt,
  };

  const transition = (patch: Partial<FleetJobStatus>): FleetJobStatus => {
    Object.assign(base, patch, { updatedAt: Date.now() });
    deps.emit({ ...base });
    return base;
  };

  const finish = (patch: Partial<FleetJobStatus>, extra?: Partial<FleetJobResult>): FleetJobResult => {
    const s = transition({ ...patch, durationMs: Date.now() - startedAt });
    return { ...s, ...extra };
  };

  try {
    // (1) Score + readiness gate.
    //
    // Autonomous apply proceeds on "apply" AND "review" (review = proceed with
    // caution). We only gate hard on "blocked" (safety: scam/duplicate/excluded
    // company) and "skip" (score genuinely below threshold). `allowReviewBelowScore`
    // keeps a soft-fail as "review" rather than collapsing it to "skip", so a
    // near-miss profile-completeness gap doesn't silently drop the job.
    transition({ phase: "scoring" });
    const readiness = assessApplicationReadiness(deps.profile, job, {
      minScore: deps.minScore,
      allowReviewBelowScore: true,
    });

    if (readiness.decision === "blocked" || readiness.decision === "skip") {
      return finish({
        phase: "gated",
        score: readiness.score,
        message:
          readiness.issues
            .filter((i) => i.severity === "blocked" || i.severity === "error")
            .map((i) => i.message)
            .join("; ") ||
          `Below minimum score (${readiness.score}/${deps.minScore}).`,
      });
    }

    // (2) Non-destructive resume enhancement.
    transition({ phase: "enhancing", score: readiness.score });
    const enhancement = await enhanceResumeForJob(
      deps.profile,
      job.description || `${job.title} ${job.company}`,
      deps.llm,
      { maxKeywords: deps.maxKeywordsPerResume },
    );

    // (3) Tailored cover letter (LLM or honest template).
    const { text: coverLetter } = await generateCoverLetter(
      { title: job.title, company: job.company, description: job.description },
      deps.profile,
      deps.llm,
    );

    // (4) Submit or preview.
    const canSubmit = !!deps.submitFn && !deps.dryRun;
    if (!canSubmit) {
      return finish(
        {
          phase: "preview",
          score: readiness.score,
          atsBefore: enhancement.atsScoreBefore,
          atsAfter: enhancement.atsScoreAfter,
          message: deps.dryRun ? "Dry-run: prepared, not submitted." : "Prepared (no submitter attached).",
        },
        { enhancement, coverLetter },
      );
    }

    transition({
      phase: "submitting",
      score: readiness.score,
      atsBefore: enhancement.atsScoreBefore,
      atsAfter: enhancement.atsScoreAfter,
    });
    const res = await deps.submitFn!({
      job,
      coverLetter,
      enhancedResumeText: enhancement.enhancedResumeText,
    });

    if (res.error) {
      return finish(
        { phase: "failed", filledFields: res.filledFields, error: res.error },
        { enhancement, coverLetter },
      );
    }

    return finish(
      {
        phase: "applied",
        filledFields: res.filledFields,
        message: res.outcome,
        atsBefore: enhancement.atsScoreBefore,
        atsAfter: enhancement.atsScoreAfter,
      },
      { enhancement, coverLetter },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return finish({ phase: "failed", error });
  }
}

/** Convenience: build a shared LLM client from a config. */
export function buildLLM(cfg: LLMConfig): LLMClient {
  return createLLM(cfg);
}
