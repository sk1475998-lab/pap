/**
 * @superjob/crew — Multi-Agent Orchestration Engine v2.0
 *
 * Research-backed 7-agent pipeline:
 *   1. Scout (Researcher) — Job discovery (ReAct loop)
 *   2. Match (Scorer)     — RAG-powered scoring (arXiv:2504.02870)
 *   3. Tailor             — Resume + cover letter per job
 *   4. Recon              — Form reconnaissance (Recon-Act, arXiv:2509.21072)
 *   5. Applier            — Form-fill + submit (AgentQ Actor-Critic)
 *   6. Healer             — Reflexion + retry (Reflexion + AgentQ)
 *   7. Reviewer           — HITL tiered approval (Evidence Pack)
 *
 * Zero-dependency TypeScript — runs in browser extension, Docker, CLI.
 */
export * from "./framework.js";
export * from "./sop.js";
export * from "./react-loop.js";

// Agents
export * from "./agents/researcher.js";
export * from "./agents/scorer.js";
export * from "./agents/tailor.js";
export * from "./agents/applier.js";
export * from "./agents/recon-agent.js";
export * from "./agents/healer.js";
export * from "./agents/reviewer.js";

// Fleet
export * from "./fleet/index.js";
export * from "./fleet/fleet-orchestrator.js";
export * from "./fleet/types.js";

// Scheduler / Ecosystem
export * from "./scheduler.js";
export * from "./agent-ecosystem.js";

// --- Factory functions ---
import { createResearcher, type JobSource } from "./agents/researcher.js";
import { createScorer } from "./agents/scorer.js";
import { createTailor } from "./agents/tailor.js";
import { createApplier, type ApplierOptions } from "./agents/applier.js";
import { createReconAgent, type ReconAgentOptions } from "./agents/recon-agent.js";
import { createHealingAgent, type HealingAgentOptions } from "./agents/healer.js";
import { createReviewAgent, type ReviewAgentOptions } from "./agents/reviewer.js";
import { Crew } from "./framework.js";

/** Build the default 4-agent crew (backward-compatible). */
export function createJobSearchCrew(source: JobSource, applierOpts: ApplierOptions = {}): Crew {
  return new Crew("Job Search Crew", [
    createResearcher(source),
    createScorer(),
    createTailor(),
    createApplier(applierOpts),
  ]);
}

export interface EnterpriseCrewOptions {
  source: JobSource;
  applierOpts?: ApplierOptions;
  reconOpts?: ReconAgentOptions;
  healingOpts?: HealingAgentOptions;
  reviewOpts?: ReviewAgentOptions;
  /** Skip Recon, Healing, Review agents (use for lightweight mode) */
  lite?: boolean;
}

/**
 * Enterprise 7-Agent Crew — the full research-backed pipeline.
 *
 * Pipeline order (MetaGPT SOP — each agent reads upstream artifact):
 *   Scout → Match → Tailor → [Recon → Applier → Healer → Reviewer]
 *
 * Drop-in replacement for createJobSearchCrew() with the full AI stack.
 */
export function createEnterpriseJobCrew(opts: EnterpriseCrewOptions): Crew {
  const agents = [
    createResearcher(opts.source),
    createScorer(),
    createTailor(),
  ];

  if (!opts.lite) {
    agents.push(createReconAgent(opts.reconOpts ?? {}));
  }

  agents.push(createApplier(opts.applierOpts ?? {}));

  if (!opts.lite) {
    // Wire the healer's executeRetryFn to the applier's submitFn so the
    // Healing Agent's winning recovery strategy is actually executed on the
    // browser instead of silently dropping into "preview mode".
    //
    // FABRICATION FIX: The original code passed an empty `healingOpts ?? {}`
    // which guaranteed `opts.executeRetryFn === undefined` every time, making
    // the entire Reflexion + AgentQ pipeline a no-op (lines 221-226 in
    // healer.ts always ran: "Preview mode — retry strategy documented but
    // not executed"). The LLM's corrective plan was generated and discarded.
    //
    // Now: if the caller provides a real `submitFn` via `applierOpts`, we
    // wrap it as the healer's executor so retries actually re-submit.
    const healingOpts = opts.healingOpts ?? {};
    if (!healingOpts.executeRetryFn && opts.applierOpts?.submitFn) {
      const submitFn = opts.applierOpts.submitFn;
      healingOpts.executeRetryFn = async (jobUrl, _strategy, ctx) => {
        // Re-invoke the browser applier for the failed job URL.
        // The strategy's BrowserAction[] is passed so callers that handle
        // executeRetryFn themselves can use fine-grained action sequences.
        // The default just re-runs the full apply pipeline for the URL with
        // an empty cover letter (the tailor already ran; re-use its output
        // from ctx.blackboard if available).
        const tailored = (ctx.blackboard as any).tailored as Array<{ job: { url: string }; coverLetter: string }> | undefined;
        const entry = tailored?.find((t) => t.job.url === jobUrl);
        const coverLetter = entry?.coverLetter ?? "";
        try {
          const res = await submitFn(jobUrl, coverLetter, ctx);
          return { success: res.outcome === "applied", filledFields: res.filledFields, error: res.error };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
      };
    }

    agents.push(createHealingAgent(healingOpts));
    agents.push(createReviewAgent(opts.reviewOpts ?? {}));
  }

  return new Crew("Enterprise Job Crew v2.0", agents);
}

