/**
 * Tailor Agent — prepares customized application materials per job.
 *
 * For each recommended job:
 *   - generates a tailored cover letter (LLM if available, template otherwise)
 *   - identifies resume adjustments to close ATS keyword gaps
 *
 * Only processes jobs the Scorer recommended (not skipped).
 */
import type { Agent, AgentContext, TailoredArtifact } from "../framework.js";
import { analyzeATS, generateCoverLetter, createLLM, sanitizeForPromptInjection } from "@superjob/core";

export function createTailor(): Agent {
  return {
    name: "Tailor",
    role: "Application Writer",
    goal: "Craft tailored cover letters and resume suggestions for each recommended job",
    backstory:
      "A professional resume writer who knows how to speak the ATS language while " +
      "keeping every word honest and grounded in the candidate's real experience.",
    async execute(ctx: AgentContext): Promise<string> {
      const { profile, scored, llmConfig } = ctx.blackboard;
      const llm = createLLM(llmConfig);

      const recommended = scored.filter((s) => s.recommendation !== "skip");
      ctx.log(`Tailoring materials for ${recommended.length} jobs…`);

      for (const scored of recommended) {
        // cover letter
        const { text, source } = await generateCoverLetter(
          { title: scored.job.title, company: scored.job.company, description: sanitizeForPromptInjection(scored.job.description).sanitized },
          profile,
          llm
        );

        // ATS gap analysis → resume adjustment suggestions
        const adjustments: string[] = [];
        if (profile.masterResumeText && scored.job.description) {
          const ats = analyzeATS(profile.masterResumeText, scored.job.description);
          adjustments.push(...ats.gaps.slice(0, 5).map((g) => g.term));
        }

        ctx.blackboard.tailored.push({
          job: scored.job,
          score: scored.score,
          coverLetter: text,
          resumeAdjustments: adjustments,
          source,
        });
      }

      const llmCount = ctx.blackboard.tailored.filter((t) => t.source === "llm").length;
      ctx.log(`Generated ${ctx.blackboard.tailored.length} cover letters (${llmCount} via LLM).`);
      return `Tailored ${ctx.blackboard.tailored.length} applications`;
    },
  };
}
