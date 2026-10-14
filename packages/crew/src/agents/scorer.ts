/**
 * Scorer Agent — evaluates each discovered job against the resume.
 *
 * UPGRADED to RAG-powered scoring (arXiv:2504.02870):
 *   1. Fast path: deterministic keyword matcher (sub-ms, always runs)
 *   2. RAG layer: retrieve relevant industry knowledge → ground LLM prompt
 *   3. LLM layer: produce score, matched/missing skills, recommendation
 *
 * The RAG layer prevents the LLM from hallucinating scores by grounding
 * evaluation against real 2025 Indian tech market data.
 */
import type { Agent, AgentContext, ScoredJob } from "../framework.js";
import { assessApplicationReadiness } from "@superjob/core";
import { ragScoreMatch } from "../rag-context.js";

export function createScorer(): Agent {
  return {
    name: "Scorer",
    role: "Match Analyst",
    goal: "Score every job against the candidate's resume and recommend the best fits",
    backstory:
      "A meticulous analyst who reads job descriptions line by line and never lets " +
      "a good fit slip through — or a bad one waste the candidate's time.",
    async execute(ctx: AgentContext): Promise<string> {
      const { profile, discovered, searchParams } = ctx.blackboard;

      if (!profile.masterResumeText) {
        ctx.log("No resume on file — cannot score. Add a resume first.", "warn");
        return "Skipped (no resume)";
      }

      ctx.log(`Scoring ${discovered.length} jobs…`);

      for (const job of discovered) {
        const readiness = assessApplicationReadiness(profile, job, {
          minScore: searchParams.minScore,
          allowReviewBelowScore: true,
        });
        const match = readiness.match;
        let reasoning = [
          match.reasons.join(" "),
          ...readiness.issues.map((i) => `${i.severity.toUpperCase()}: ${i.message}`),
        ].filter(Boolean).join(" ");
        let recommendation: ScoredJob["recommendation"] =
          readiness.decision === "apply" ? "apply" : readiness.decision === "review" ? "review" : "skip";

        // RAG-LLM reasoning layer (arXiv:2504.02870)
        // Retrieves industry knowledge → grounds LLM prompt → better scores
        if (ctx.think && readiness.decision !== "blocked" && readiness.score >= searchParams.minScore * 0.7 && job.description) {
          try {
            const ragResult = await ragScoreMatch(
              {
                resumeText: profile.masterResumeText ?? "",
                jobDescription: job.description,
                jobTitle: job.title,
                company: job.company,
                candidateSkills: profile.skills,
              },
              ctx.think
            );
            // Blend deterministic score with RAG score (70% RAG, 30% deterministic for reliability)
            const blendedScore = Math.round(ragResult.score * 0.7 + readiness.score * 0.3);
            reasoning = ragResult.reasoning;
            recommendation =
              ragResult.recommendation === "APPLY" ? "apply" :
              ragResult.recommendation === "REVIEW" ? "review" : "skip";

            // Update scored job with RAG-enriched data
            const scoredEntry: ScoredJob = {
              job,
              score: blendedScore,
              matched: ragResult.matchedSkills,
              missing: ragResult.missingSkills,
              reasoning,
              recommendation,
            };
            ctx.blackboard.scored.push(scoredEntry);
            continue; // Skip the push below
          } catch {
            // Fall through to simple scoring if RAG fails
          }
        }

        ctx.blackboard.scored.push({
          job,
          score: readiness.score,
          matched: match.matched,
          missing: match.missing,
          reasoning,
          recommendation,
        });
      }

      // sort best-first
      ctx.blackboard.scored.sort((a, b) => b.score - a.score);

      const applyable = ctx.blackboard.scored.filter((s) => s.recommendation !== "skip");
      ctx.log(
        `${ctx.blackboard.scored.length} scored — ` +
          `${applyable.length} recommended (${ctx.blackboard.scored.length - applyable.length} skipped).`
      );
      return `Scored ${ctx.blackboard.scored.length} jobs, ${applyable.length} recommended`;
    },
  };
}
