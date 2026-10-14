/**
 * Review Agent — HITL Tiered Approval
 *
 * Adopted from: Enterprise HITL (Human-in-the-Loop) production research,
 * 2025. Risk-tiered review gates: not all-or-nothing HITL — confidence-based
 * routing so low-risk applications go straight through while high-risk ones
 * get a human gate with an Evidence Pack that takes <10 seconds to review.
 *
 * Three tiers:
 *   AUTO_SUBMIT  → confidence ≥ 90 AND all required fields filled AND no skipped fields
 *   HUMAN_REVIEW → confidence ≥ 60 OR some optional fields skipped — show Evidence Pack
 *   REJECT       → confidence < 40 OR critical fields missing — do not apply
 *
 * Evidence Pack (sent to Review Queue UI):
 *   - Job title, company, match score
 *   - Filled vs total fields with confidence breakdown
 *   - Tailored resume diff
 *   - Cover letter
 *   - Screenshot (visual proof)
 *   - Full ReAct trace (audit)
 *   - 24h TTL — stale packs auto-expire
 *   - Idempotency key — prevents double-submit
 *
 * The extension's Review Queue tab renders these Evidence Packs as cards
 * with ✅ Approve / ❌ Reject / ✏️ Edit buttons.
 */

import type { Agent, AgentContext } from "../framework.js";
import type {
  ApplicationArtifact,
  EvidencePack,
  RiskTier,
  SOPBlackboard,
  TailoringArtifact,
} from "../sop.js";
import { getStore } from "@superjob/core";

/* ------------------------------------------------------------------ */
/* Risk Tier Configuration                                               */
/* ------------------------------------------------------------------ */

const RISK_TIERS = {
  AUTO_SUBMIT: {
    minConfidence: 90,
    maxSkippedRequired: 0,    // zero required fields skipped
    minFieldFillPct: 0.95,    // ≥95% of fields filled
  },
  HUMAN_REVIEW: {
    minConfidence: 55,
    maxSkippedRequired: 2,    // allow up to 2 optional skipped
    minFieldFillPct: 0.70,    // ≥70% of fields filled
  },
  // Below HUMAN_REVIEW thresholds → REJECT
} as const;

export const REVIEW_QUEUE_STORE_KEY = "sja_review_queue";

/* ------------------------------------------------------------------ */
/* Review Agent                                                          */
/* ------------------------------------------------------------------ */

export interface ReviewAgentOptions {
  /** Override thresholds per run (e.g. for aggressive mode) */
  autoSubmitMinConfidence?: number;
  reviewMinConfidence?: number;
  /** Called when AUTO_SUBMIT tier is reached */
  onAutoSubmit?: (pack: EvidencePack) => Promise<{ ok: boolean; error?: string }>;
}

export function createReviewAgent(opts: ReviewAgentOptions = {}): Agent {
  return {
    name: "Review Agent",
    role: "Quality Gate & Risk Classifier",
    goal:
      "Classify every application by risk tier, route low-risk to auto-submit, " +
      "medium-risk to evidence-backed human review, high-risk to rejection",
    backstory:
      "A senior compliance officer who ensures every application meets the bar. " +
      "Uses evidence packs so human reviewers can decide in under 10 seconds. " +
      "Never lets a sloppy application hurt the candidate's reputation.",

    async execute(ctx: AgentContext): Promise<string> {
      const sopBoard = ctx.blackboard as unknown as SOPBlackboard;
      const applications: ApplicationArtifact[] = sopBoard.applied ?? [];

      if (applications.length === 0) {
        ctx.log("[Review] No applications to review.", "warn");
        return "No applications to review";
      }

      const autoThreshold = opts.autoSubmitMinConfidence ?? RISK_TIERS.AUTO_SUBMIT.minConfidence;
      const reviewThreshold = opts.reviewMinConfidence ?? RISK_TIERS.HUMAN_REVIEW.minConfidence;

      let autoSubmitted = 0;
      let humanQueued = 0;
      let rejected = 0;

      for (const app of applications) {
        const tier = classifyRiskTier(app, autoThreshold, reviewThreshold);
        const pack = buildEvidencePack(app, tier);

        ctx.log(
          `[Review] ${app.job.title}@${app.job.company}: confidence=${pack.confidence} → ${tier}`
        );

        if (tier === "AUTO_SUBMIT") {
          // Go straight to submit
          if (opts.onAutoSubmit && !ctx.blackboard.searchParams?.dryRun) {
            try {
              const result = await opts.onAutoSubmit(pack);
              if (result.ok) {
                app.outcome = "applied";
                pack.decision = "approved";
                pack.decidedAt = Date.now();
                autoSubmitted++;
                ctx.log(`[Review] ✓ AUTO-SUBMITTED: ${app.job.title}`);
              } else {
                app.outcome = "failed";
                app.failureReason = result.error;
                ctx.log(`[Review] ✗ AUTO-SUBMIT failed: ${result.error}`, "error");
              }
            } catch (e) {
              app.outcome = "failed";
              app.failureReason = e instanceof Error ? e.message : String(e);
            }
          } else {
            // dry-run
            app.outcome = "preview";
            pack.decision = "pending";
            autoSubmitted++;
            ctx.log(`[Review] Preview AUTO_SUBMIT: ${app.job.title}`);
          }
        } else if (tier === "HUMAN_REVIEW") {
          // Enqueue for human review
          sopBoard.reviewQueue = sopBoard.reviewQueue ?? [];
          // Idempotency: don't add the same job twice
          const alreadyQueued = sopBoard.reviewQueue.some(
            (p) => p.idempotencyKey === pack.idempotencyKey
          );
          if (!alreadyQueued) {
            sopBoard.reviewQueue.push(pack);
            await persistReviewQueue(sopBoard.reviewQueue);
            humanQueued++;
            app.outcome = "review";
            ctx.log(`[Review] ⏳ QUEUED FOR REVIEW: ${app.job.title} (expires in 24h)`);
          }
        } else {
          // REJECT
          rejected++;
          app.outcome = "failed";
          app.failureReason = "Rejected by Review Agent: confidence below threshold";
          ctx.log(`[Review] ✗ REJECTED: ${app.job.title} (confidence ${pack.confidence} < ${reviewThreshold})`, "warn");
        }
      }

      const summary =
        `Review complete: ${autoSubmitted} auto-submitted, ` +
        `${humanQueued} queued for human review, ${rejected} rejected`;
      ctx.log(`[Review] ${summary}`);
      return summary;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Risk Classifier                                                        */
/* ------------------------------------------------------------------ */

function classifyRiskTier(
  app: ApplicationArtifact,
  autoThreshold: number,
  reviewThreshold: number
): RiskTier {
  const confidence = computeApplicationConfidence(app);
  const fillPct =
    app.fieldsAttempted > 0
      ? app.fieldsFilled / app.fieldsAttempted
      : 0;

  // AUTO_SUBMIT: very high confidence + nearly all fields filled + no required skipped
  if (
    confidence >= autoThreshold &&
    fillPct >= RISK_TIERS.AUTO_SUBMIT.minFieldFillPct &&
    (app.fieldsSkipped?.length ?? 0) === 0
  ) {
    return "AUTO_SUBMIT";
  }

  // HUMAN_REVIEW: medium confidence, most fields filled, limited skipped
  if (
    confidence >= reviewThreshold &&
    fillPct >= RISK_TIERS.HUMAN_REVIEW.minFieldFillPct
  ) {
    return "HUMAN_REVIEW";
  }

  return "REJECT";
}

function computeApplicationConfidence(app: ApplicationArtifact): number {
  if (!app.confidencePerField || Object.keys(app.confidencePerField).length === 0) {
    // Estimate from fill rate
    if (app.fieldsAttempted === 0) return 0;
    return Math.round((app.fieldsFilled / app.fieldsAttempted) * 75);
  }

  const values = Object.values(app.confidencePerField);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round(avg);
}

/* ------------------------------------------------------------------ */
/* Evidence Pack Builder                                                  */
/* ------------------------------------------------------------------ */

function buildEvidencePack(app: ApplicationArtifact, tier: RiskTier): EvidencePack {
  const confidence = computeApplicationConfidence(app);
  const fillPct =
    app.fieldsAttempted > 0
      ? Math.round((app.fieldsFilled / app.fieldsAttempted) * 100)
      : 0;

  return {
    jobId: app.jobId,
    jobTitle: app.job.title,
    company: app.job.company,
    matchScore: 0, // filled by scorer
    confidence,
    tier,
    filledFields: app.fieldsFilled,
    totalFields: app.fieldsAttempted,
    lowConfidenceFields: app.fieldsSkipped ?? [],
    tailoredResume: app.tailoring?.tailoredResumeText ?? "",
    coverLetter: app.tailoring?.coverLetter ?? "",
    screenshotBase64: app.screenshotPath,
    reasoning: app.applyTrace ?? [],
    createdAt: Date.now(),
    ttl: Date.now() + 24 * 60 * 60 * 1000,
    idempotencyKey: `review_${app.jobId}_${app.retries}`,
    decision: "pending",
  };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                            */
/* ------------------------------------------------------------------ */

async function persistReviewQueue(queue: EvidencePack[]): Promise<void> {
  try {
    const store = getStore();
    // Prune expired packs before saving
    const now = Date.now();
    const active = queue.filter((p) => p.ttl > now);
    await store.set(REVIEW_QUEUE_STORE_KEY, active);
  } catch {
    // Non-fatal — review queue is in memory as fallback
  }
}

export async function loadReviewQueue(): Promise<EvidencePack[]> {
  try {
    const store = getStore();
    const raw = await store.get<EvidencePack[]>(REVIEW_QUEUE_STORE_KEY);
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter((p) => p.ttl > now && p.decision === "pending");
  } catch {
    return [];
  }
}

export async function enqueueReviewItem(pack: EvidencePack): Promise<void> {
  try {
    const store = getStore();
    const raw = await store.get<EvidencePack[]>(REVIEW_QUEUE_STORE_KEY) ?? [];
    // Deduplicate by jobId or idempotencyKey
    const filtered = raw.filter((p) => p.jobId !== pack.jobId && p.idempotencyKey !== pack.idempotencyKey);
    filtered.unshift(pack);
    await store.set(REVIEW_QUEUE_STORE_KEY, filtered);
  } catch { /* non-fatal */ }
}

export async function approveReviewItem(jobId: string): Promise<void> {
  try {
    const store = getStore();
    const raw = await store.get<EvidencePack[]>(REVIEW_QUEUE_STORE_KEY) ?? [];
    const updated = raw.map((p) =>
      p.jobId === jobId
        ? { ...p, decision: "approved" as const, decidedAt: Date.now() }
        : p
    );
    await store.set(REVIEW_QUEUE_STORE_KEY, updated);
  } catch { /* non-fatal */ }
}

export async function rejectReviewItem(jobId: string): Promise<void> {
  try {
    const store = getStore();
    const raw = await store.get<EvidencePack[]>(REVIEW_QUEUE_STORE_KEY) ?? [];
    const updated = raw.map((p) =>
      p.jobId === jobId
        ? { ...p, decision: "rejected" as const, decidedAt: Date.now() }
        : p
    );
    await store.set(REVIEW_QUEUE_STORE_KEY, updated);
  } catch { /* non-fatal */ }
}

/* ------------------------------------------------------------------ */
/* Summary helper for UI                                                  */
/* ------------------------------------------------------------------ */

export interface ReviewQueueSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expiringSoon: EvidencePack[]; // TTL < 2h
}

export function summarizeReviewQueue(queue: EvidencePack[]): ReviewQueueSummary {
  const now = Date.now();
  return {
    total: queue.length,
    pending: queue.filter((p) => p.decision === "pending").length,
    approved: queue.filter((p) => p.decision === "approved").length,
    rejected: queue.filter((p) => p.decision === "rejected").length,
    expiringSoon: queue.filter((p) => p.ttl - now < 2 * 60 * 60 * 1000),
  };
}
