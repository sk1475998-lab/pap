/**
 * Healing Agent — Self-Critique + Retry via Reflexion + AgentQ
 *
 * Adopted from:
 *   1. Reflexion (Shinn et al., 2023) — "Language Agents with Verbal
 *      Reinforcement Learning". Reflexion generates a verbal self-reflection
 *      on failure and stores it in a persistent memory to guide future attempts.
 *      Webshop: 70% → 84% success after 3 reflection cycles.
 *
 *   2. AgentQ (Putta et al., 2024) — MCTS + Actor-Critic + DPO.
 *      Key insight: propose 3 candidate recovery strategies → critic chooses best.
 *      Llama-3 70B: 18.6% → 81% success on BookingTask with self-critique.
 *
 * Core flow (after any agent failure):
 *   1. Reflexion — LLM reads failure context + past attempts → writes a
 *      "New plan:" that avoids the same mistake.
 *   2. AgentQ Actor — generates 3 distinct retry strategies from the reflection.
 *   3. AgentQ Critic — evaluates all 3 → picks the safest, most promising.
 *   4. Execute the winning strategy.
 *   5. If successful → update Tool Archive (Recon-Act learning).
 *      If failed again → repeat up to maxRetries, then escalate to Review Queue.
 *
 * Reflexion few-shot examples:
 *   Taken verbatim from noahshinn/reflexion / webshop_runs/
 *   reflection_few_shot_examples.txt — real proven examples from the paper.
 */

import type { Agent, AgentContext } from "../framework.js";
import type {
  ApplicationArtifact,
  EvidencePack,
  ReActTrace,
  SOPBlackboard,
  CandidateAction,
  BrowserAction,
} from "../sop.js";
import { runReActLoop, createReflectTool } from "../react-loop.js";
import { recordStrategyFailure, recordStrategySuccess } from "./recon-agent.js";

/* ------------------------------------------------------------------ */
/* Reflexion Few-Shot Examples (from noahshinn/reflexion paper)          */
/* ------------------------------------------------------------------ */
const REFLEXION_FEW_SHOT = `
Instruction:
Fill in the LinkedIn Easy Apply form for a Software Engineer role at Acme Corp.
Step 1: Click Easy Apply → Modal opened
Step 2: Fill "Phone" with "+91 9182805541" → Error: format rejected, expected 10 digits only
Step 3: Retry same format → Error again
STATUS: FAIL

Next plan: In this attempt, I failed because I included the country code (+91) in a field that expects only 10 digits. Next time, I will strip the country code and enter only "9182805541". I will also check the field placeholder text first before entering any value.

Instruction:
Fill in the Workday form for a Data Engineer role at TechCorp.
Step 1: Clicked Apply → Redirected to external site
Step 2: Tried to fill resume → Resume upload button not visible
Step 3: Scrolled down → Found hidden upload section
Step 4: Uploaded resume → File type error (PDF required, got DOCX)
STATUS: FAIL

Next plan: In this attempt, I failed because the resume was in DOCX format. Next time, I will check if a PDF version is available before uploading. If not, I will skip the file upload and fill other fields manually. I should also scroll the page first to discover all form sections before starting to fill.
`.trim();

/* ------------------------------------------------------------------ */
/* Healing Agent                                                          */
/* ------------------------------------------------------------------ */

export interface HealingAgentOptions {
  maxRetries?: number;           // default 3
  /** Called to actually re-execute a retry strategy on the browser */
  executeRetryFn?: (jobUrl: string, strategy: BrowserAction[], ctx: AgentContext) =>
    Promise<{ success: boolean; filledFields?: number; error?: string }>;
}

export function createHealingAgent(opts: HealingAgentOptions = {}): Agent {
  return {
    name: "Healing Agent",
    role: "Expert Failure Recovery Specialist",
    goal: "Zero tolerance for avoidable failures — self-critique every failure and retry with a corrected plan",
    backstory:
      "A persistent debugger who never accepts 'failed' as the final answer. " +
      "Studies every failed application like a post-mortem, generates three alternative " +
      "recovery strategies, picks the best one, and retries — up to the limit. " +
      "Trained on Reflexion's verbal reinforcement and AgentQ's actor-critic MCTS.",

    async execute(ctx: AgentContext): Promise<string> {
      const sopBoard = ctx.blackboard as unknown as SOPBlackboard;
      if (!sopBoard.reflexionMemory) {
        sopBoard.reflexionMemory = new Map();
      }
      if (!sopBoard.reviewQueue) {
        sopBoard.reviewQueue = [];
      }

      const failedApplications = (sopBoard.applied ?? []).filter(
        (a) => a.outcome === "failed"
      );

      if (failedApplications.length === 0) {
        ctx.log("[Healing] No failures to heal — all applications succeeded ✓");
        return "No failures to heal";
      }

      ctx.log(`[Healing] Attempting to heal ${failedApplications.length} failed application(s)…`);
      let healed = 0;
      let escalated = 0;

      for (const failure of failedApplications) {
        const maxRetries = opts.maxRetries ?? 3;
        if (failure.retries >= maxRetries) {
          // Escalate to human review
          ctx.log(
            `[Healing] ${failure.job.title}@${failure.job.company} exceeded max retries (${maxRetries}) — escalating to Review Queue`,
            "warn"
          );
          escalateToReview(failure, sopBoard);
          escalated++;
          continue;
        }

        ctx.log(
          `[Healing] Healing: ${failure.job.title} @ ${failure.job.company} — Retry ${failure.retries + 1}/${maxRetries}`
        );

        // ================================================================
        // STEP 1: Reflexion — self-critique using past attempts
        // ================================================================
        const pastAttempts = sopBoard.reflexionMemory.get(failure.jobId) ?? [];
        const reflection = await generateReflection(
          failure,
          pastAttempts,
          ctx.think
        );
        ctx.log(`[Healing] Reflexion: ${reflection.slice(0, 120)}…`);

        // Store reflection in memory
        const updatedMemory = [...pastAttempts, reflection];
        // Keep last 3 reflections (Reflexion paper uses last 3 trials)
        const trimmedMemory = updatedMemory.slice(-3);
        sopBoard.reflexionMemory.set(failure.jobId, trimmedMemory);

        // P2-010: Prune the Map itself to prevent unbounded memory growth in long
        // sessions. When more than MAX_REFLEXION_JOBS jobs have entries, drop the
        // oldest ones (insertion order in JS Maps is FIFO, so iterating gives the
        // oldest entries first).
        const MAX_REFLEXION_JOBS = 500;
        if (sopBoard.reflexionMemory.size > MAX_REFLEXION_JOBS) {
          const toDelete = sopBoard.reflexionMemory.size - MAX_REFLEXION_JOBS;
          let deleted = 0;
          for (const key of sopBoard.reflexionMemory.keys()) {
            sopBoard.reflexionMemory.delete(key);
            if (++deleted >= toDelete) break;
          }
        }

        // ================================================================
        // STEP 2: AgentQ Actor — generate 3 candidate recovery strategies
        // ================================================================
        const candidates = await generateCandidateStrategies(
          failure,
          reflection,
          ctx.think
        );
        ctx.log(`[Healing] AgentQ Actor generated ${candidates.length} candidate strategies`);

        // ================================================================
        // STEP 3: AgentQ Critic — evaluate and select best strategy
        // ================================================================
        const winningStrategy = await criticSelectBestStrategy(
          candidates,
          failure,
          ctx.think
        );
        ctx.log(`[Healing] AgentQ Critic selected: "${winningStrategy.description}"`);

        // ================================================================
        // STEP 4: Execute retry with the winning strategy
        // ================================================================
        if (opts.executeRetryFn) {
          try {
            const retryResult = await opts.executeRetryFn(
              failure.job.url,
              winningStrategy.actionsToPerform,
              ctx
            );

            if (retryResult.success) {
              // Update the application artifact
              failure.outcome = "applied";
              failure.retries++;
              failure.fieldsFilled = retryResult.filledFields ?? failure.fieldsFilled;

              // Recon-Act: record strategy success so Tool Archive gets smarter
              if (sopBoard.toolArchive && failure.formSignature) {
                recordStrategySuccess(sopBoard.toolArchive, failure.formSignature);
              }

              ctx.log(
                `[Healing] ✓ HEALED: ${failure.job.title} @ ${failure.job.company} after ${failure.retries} retries`
              );
              healed++;
            } else {
              failure.retries++;
              failure.failureReason = retryResult.error ?? "Unknown error on retry";

              // Recon-Act: record failure
              if (sopBoard.toolArchive && failure.formSignature) {
                recordStrategyFailure(sopBoard.toolArchive, failure.formSignature);
              }

              ctx.log(
                `[Healing] ✗ Retry failed: ${retryResult.error} — will try again next cycle`,
                "warn"
              );
            }
          } catch (e) {
            failure.retries++;
            failure.failureReason = e instanceof Error ? e.message : String(e);
            ctx.log(`[Healing] Retry threw exception: ${failure.failureReason}`, "error");
          }
        } else {
          // No retry executor (preview mode): just log the reflection + strategy
          failure.retries++;
          failure.failureReason = `[Preview] Would retry with: ${winningStrategy.description}`;
          ctx.log(`[Healing] Preview mode — retry strategy documented but not executed`);
        }
      }

      const summary = `Healing complete: ${healed} healed, ${escalated} escalated to review, ${failedApplications.length - healed - escalated} still in progress`;
      ctx.log(`[Healing] ${summary}`);
      return summary;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Reflexion: generate verbal self-reflection                             */
/* ------------------------------------------------------------------ */

async function generateReflection(
  failure: ApplicationArtifact,
  pastAttempts: string[],
  think: AgentContext["think"]
): Promise<string> {
  const attemptsStr =
    pastAttempts.length > 0
      ? `\nPlans from past attempts:\n${pastAttempts.map((a, i) => `Trial #${i}: ${a}`).join("\n")}`
      : "";

  const traceStr = failure.applyTrace
    ?.slice(-5)
    .map((t) => `Step ${t.step}: ${t.action} → ${t.observation}`)
    .join("\n") ?? "No trace available";

  const query = `${REFLEXION_FEW_SHOT}

Instruction:
Fill in the application form for: ${failure.job.title} at ${failure.job.company}
URL: ${failure.job.url}
Failure reason: ${failure.failureReason ?? "Unknown error"}
Fields attempted: ${failure.fieldsAttempted}, Fields filled: ${failure.fieldsFilled}
Low confidence fields: ${failure.fieldsSkipped?.join(", ") || "none"}

Recent action trace:
${traceStr}
${attemptsStr}

New plan:`;

  const reflection = await think(
    query,
    "You are an expert job application agent analyzing why a form submission failed. " +
    "Be specific about what went wrong and provide a concrete corrective plan."
  );

  return reflection.trim();
}

/* ------------------------------------------------------------------ */
/* AgentQ Actor: generate 3 candidate strategies                         */
/* ------------------------------------------------------------------ */

async function generateCandidateStrategies(
  failure: ApplicationArtifact,
  reflection: string,
  think: AgentContext["think"]
): Promise<CandidateAction[]> {
  const strategyPrompt = `You are a web automation expert (AgentQ Actor).
A job application failed. Based on this reflection, propose THREE DIFFERENT recovery strategies.

Job: ${failure.job.title} at ${failure.job.company}
Failure: ${failure.failureReason}
Reflection: ${reflection}

Available action types: CLICK[selector], TYPE[selector, value], SCROLL[direction], SELECT[selector, option], WAIT[ms], GOTO_URL[url]

Output exactly 3 strategies as JSON array:
[
  {
    "id": 1,
    "description": "Brief strategy description",
    "reasoning": "Why this might work",
    "actionsToPerform": [{"type": "ACTION_TYPE", "selector": "...", "value": "..."}]
  },
  ...
]`;

  const raw = await think(strategyPrompt, "You are AgentQ Actor. Output valid JSON only.");

  try {
    const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }

  // Fallback strategies based on failure type
  return buildFallbackStrategies(failure);
}

/* ------------------------------------------------------------------ */
/* AgentQ Critic: evaluate and select the best strategy                  */
/* ------------------------------------------------------------------ */

async function criticSelectBestStrategy(
  candidates: CandidateAction[],
  failure: ApplicationArtifact,
  think: AgentContext["think"]
): Promise<CandidateAction> {
  if (candidates.length === 1) return candidates[0]!;

  const criticPrompt = `You are AgentQ Critic — an expert evaluator of web automation strategies.
Choose the BEST strategy from these candidates to recover a failed job application.

Failed job: ${failure.job.title} at ${failure.job.company}
Failure: ${failure.failureReason}
ATS platform: ${failure.formSignature?.split("_")[0] ?? "unknown"}

Candidates:
${candidates.map((c) => `ID ${c.id}: ${c.description}\nReasoning: ${c.reasoning}`).join("\n\n")}

Evaluate each option critically:
- Does it address the root cause?
- Is it safe (won't cause duplicate applications)?
- Is it the simplest effective approach?

Return ONLY a JSON object: {"selectedId": <id>, "confidence": <0-100>, "reasoning": "..."}`;

  const raw = await think(criticPrompt, "You are AgentQ Critic. Output valid JSON only. Pick the BEST strategy.");

  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const selected = candidates.find((c) => c.id === parsed.selectedId);
    if (selected) return selected;
  } catch {
    // fallback: pick first
  }

  return candidates[0]!;
}

/* ------------------------------------------------------------------ */
/* Fallback strategies for common failure types                          */
/* ------------------------------------------------------------------ */

function buildFallbackStrategies(failure: ApplicationArtifact): CandidateAction[] {
  return [
    {
      id: 1,
      description: "Retry skipping optional low-confidence fields",
      reasoning: "Some fields may not be required — skip them to unblock submission",
      actionsToPerform: [
        { type: "SCROLL", value: "down" },
        { type: "CLICK", selector: "button[data-control-name='continue_unify'], button[aria-label*='Continue'], button[aria-label*='Submit'], button[aria-label*='Next']" },
      ],
    },
    {
      id: 2,
      description: "Retry with alternative phone format (strip country code)",
      reasoning: "Phone number format mismatch is the most common failure cause. Clear the phone field and leave it for user review rather than typing a bad value.",
      actionsToPerform: [
        // NOTE: We intentionally leave `value` empty here.
        // The previous code mistakenly set value to `failure.job.url` (a URL string).
        // Typing a URL into a phone field causes form submission errors worse than the original.
        // The correct recovery is to clear the field and let the user fill it manually.
        { type: "TYPE", selector: "input[type='tel'], input[name*='phone'], input[name*='mobile']", value: "" },
        { type: "CLICK", selector: "button[aria-label*='Submit']" },
      ],
    },
    {
      id: 3,
      description: "Reload form and start fresh with slower human-like timing",
      reasoning: "Race conditions or stale form state can cause silent failures",
      actionsToPerform: [
        { type: "GOTO_URL", url: failure.job.url },
        { type: "WAIT", value: "2000" },
        { type: "CLICK", selector: "button[aria-label*='Easy Apply'], .jobs-apply-button" },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Escalate to Human Review Queue (HITL Paper 6)                         */
/* ------------------------------------------------------------------ */

function escalateToReview(failure: ApplicationArtifact, board: SOPBlackboard): void {
  const pack: EvidencePack = {
    jobId: failure.jobId,
    jobTitle: failure.job.title,
    company: failure.job.company,
    matchScore: 0,
    confidence: 0,
    tier: "HUMAN_REVIEW",
    filledFields: failure.fieldsFilled,
    totalFields: failure.fieldsAttempted,
    lowConfidenceFields: failure.fieldsSkipped ?? [],
    tailoredResume: failure.tailoring?.tailoredResumeText ?? "",
    coverLetter: failure.tailoring?.coverLetter ?? "",
    screenshotBase64: failure.screenshotPath,
    reasoning: failure.applyTrace ?? [],
    createdAt: Date.now(),
    ttl: Date.now() + 24 * 60 * 60 * 1000,   // 24h TTL
    idempotencyKey: `heal_${failure.jobId}_${Date.now()}`,
    decision: "pending",
  };

  board.reviewQueue = board.reviewQueue ?? [];
  board.reviewQueue.push(pack);
}

/* ------------------------------------------------------------------ */
/* Phase 3: Reflexion Memory Persistence                                 */
/* Serialize/deserialize the per-job verbal reflection memory to        */
/* chrome.storage.local so the Healing Agent survives SW eviction.      */
/* ------------------------------------------------------------------ */

/**
 * Serialize the Reflexion Memory Map for chrome.storage persistence.
 * Format: JSON array of [jobId, string[]] tuples.
 */
export function serializeReflexionMemory(memory: Map<string, string[]>): string {
  return JSON.stringify(Array.from(memory.entries()));
}

/**
 * Restore Reflexion Memory from a chrome.storage JSON blob.
 * Returns an empty Map on any parse error.
 */
export function deserializeReflexionMemory(json: string): Map<string, string[]> {
  try {
    const entries: [string, string[]][] = JSON.parse(json);
    if (!Array.isArray(entries)) return new Map();
    return new Map(
      entries.filter(([k, v]) => typeof k === "string" && Array.isArray(v))
    );
  } catch {
    return new Map();
  }
}
