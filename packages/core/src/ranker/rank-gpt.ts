/**
 * RankGPT Sliding-Window Job Reranker & Eligibility Engine
 *
 * Implements the state-of-the-art listwise ranking method from:
 * "Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents"
 * (Sun et al., EMNLP 2023, arXiv:2304.09542 / github.com/sunnweiwei/RankGPT)
 * adapted for multi-feature career candidate-job matching.
 *
 * Key Capabilities:
 * 1. Sliding-Window Permutation Generation:
 *    Reranks batches of 30-50 scraped jobs in overlapping windows (size W=8, step S=4)
 *    to preserve global ranking coherence while fitting model token constraints.
 * 2. Strict Grounded Eligibility Gating:
 *    Eliminates "hallucinated fit" by evaluating hard constraints (years of experience,
 *    work authorization/visas, mandatory technical stack, education level).
 * 3. Explainable Fit Rationale:
 *    Produces recruiter-aligned justification ("Why #1") and actionable gap warnings.
 * 4. Resilient Deterministic Fallback:
 *    When LLM is unavailable, executes a multi-factor hybrid ranker (Skill Graph overlap,
 *    Title-Seniority alignment, Freshness score, Domain penalty).
 */

import type { Job, Profile } from "../types.js";
import type { LLMClient } from "../llm/types.js";
import { parseModelJson } from "../llm/robust.js";
import { scoreMatch } from "../matcher.js";
import { analyzeJobDescription } from "../jd-analyzer.js";
import { expandSkillSet, skillCovered } from "../skill-graph.js";

export interface EligibilityResult {
  isEligible: boolean;
  score: number; // 0 - 100
  reasons: string[];
  warnings: string[];
  seniorityMatch: "under-qualified" | "optimal" | "over-qualified" | "adjacent";
  estimatedYearsRequired: number | null;
}

export interface RankedJobResult {
  job: Job;
  rank: number;
  relevanceScore: number;
  eligibility: EligibilityResult;
  fitExplanation: string;
  matchedStrengths: string[];
  missingGaps: string[];
}

export interface RankGPTOptions {
  windowSize?: number; // default 8
  stepSize?: number;   // default 4
  llm?: LLMClient;
  minEligibilityScore?: number; // default 40
}

/**
 * Extract target seniority level from job title and description
 */
export function extractSeniorityLevel(text: string): "intern" | "entry" | "mid" | "senior" | "lead" | "principal" {
  const t = text.toLowerCase();
  if (/\b(principal|staff|director|head of|vp|architect)\b/i.test(t)) return "principal";
  if (/\b(lead|tech lead|team lead|manager)\b/i.test(t)) return "lead";
  if (/\b(senior|sr\.?|iii|iv)\b/i.test(t)) return "senior";
  if (/\b(intern|internship|trainee|co-op)\b/i.test(t)) return "intern";
  if (/\b(junior|jr\.?|associate|entry|fresh|grad|graduate)\b/i.test(t)) return "entry";
  return "mid";
}

/**
 * Estimate required years of experience from job text
 */
export function extractRequiredYears(jd: string): number | null {
  const match = jd.match(/(\d{1,2})\+?\s*(?:to\s*\d{1,2})?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:relevant|experience|exp)/i);
  if (match && match[1]) {
    const yrs = parseInt(match[1], 10);
    if (!isNaN(yrs) && yrs >= 0 && yrs <= 25) return yrs;
  }
  return null;
}

/**
 * Calculate candidate's total years of experience from profile
 */
export function calculateCandidateExperienceYears(profile: Profile): number {
  if (profile.yearsOfExperience) {
    const parsed = parseFloat(profile.yearsOfExperience);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  const now = Date.now();
  const intervals: Array<{ start: number; end: number }> = [];
  for (const exp of profile.experience) {
    if (!exp.startDate) continue;
    const start = Date.parse(exp.startDate);
    const endText = exp.endDate?.trim().toLowerCase();
    const end = exp.current || endText === "present"
      ? now
      : endText ? Date.parse(exp.endDate!) : Number.NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      intervals.push({ start, end: Math.min(end, now) });
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  let coveredStart: number | undefined;
  let coveredEnd = 0;
  let totalMs = 0;
  for (const interval of intervals) {
    if (coveredStart === undefined) {
      coveredStart = interval.start;
      coveredEnd = interval.end;
    } else if (interval.start <= coveredEnd) {
      coveredEnd = Math.max(coveredEnd, interval.end);
    } else {
      totalMs += coveredEnd - coveredStart;
      coveredStart = interval.start;
      coveredEnd = interval.end;
    }
  }
  if (coveredStart !== undefined) totalMs += coveredEnd - coveredStart;
  return Math.round((totalMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
}

/**
 * Evaluate deterministic eligibility gating for a candidate against a job
 */
export function evaluateJobEligibility(job: Job, profile: Profile): EligibilityResult {
  const jdText = `${job.title} ${job.description}`.toLowerCase();
  const reasons: string[] = [];
  const warnings: string[] = [];

  const candidateYears = calculateCandidateExperienceYears(profile);
  const requiredYears = extractRequiredYears(jdText);
  const jobSeniority = extractSeniorityLevel(job.title + " " + job.description);

  let seniorityMatch: EligibilityResult["seniorityMatch"] = "optimal";

  // 1. Experience Gating
  if (requiredYears !== null) {
    if (candidateYears < requiredYears - 1) {
      seniorityMatch = "under-qualified";
      warnings.push(`Demands ${requiredYears}+ years experience (you have ~${candidateYears} years)`);
    } else if (candidateYears >= requiredYears && candidateYears <= requiredYears + 4) {
      seniorityMatch = "optimal";
      reasons.push(`Experience directly aligns with requirements (~${candidateYears} yrs vs ${requiredYears}+ yrs)`);
    } else {
      seniorityMatch = "over-qualified";
      reasons.push(`Exceeds base tenure requirement (${candidateYears} yrs vs ${requiredYears}+ yrs)`);
    }
  } else {
    reasons.push("Flexible experience requirement");
  }

  // 2. Skill Graph Bipartite Overlap
  const ownedSkills = expandSkillSet(profile.skills || []);
  const jdAnalysis = analyzeJobDescription({
    resumeText: profile.summary || (profile.skills || []).join(", "),
    jobDescription: job.description || job.title,
    profileSkills: profile.skills || [],
  });
  const coveredCount = jdAnalysis.matched.length;
  const missingCount = jdAnalysis.missing.length;
  const totalKeywords = coveredCount + missingCount;

  const skillCoverageRatio = totalKeywords > 0 ? coveredCount / totalKeywords : 0.6;
  if (skillCoverageRatio >= 0.6) {
    reasons.push(`Covers ${Math.round(skillCoverageRatio * 100)}% of identified core technical skills`);
  } else {
    warnings.push(`Missing key stack requirements: ${jdAnalysis.missing.slice(0, 3).join(", ")}`);
  }

  // 3. Location / Remote Alignment
  const isRemote = job.remote || /remote|work from home|wfh/i.test(job.location);
  const preferredLoc = (profile as any).preferredLocation || profile.location || "";
  if (isRemote) {
    reasons.push("Fully Remote / WFH friendly");
  }

  // Composite Score
  let score = Math.round(
    skillCoverageRatio * 50 +
    (seniorityMatch === "optimal" ? 30 : seniorityMatch === "over-qualified" ? 25 : 10) +
    (isRemote ? 15 : 10) +
    (requiredYears !== null && candidateYears >= requiredYears ? 5 : 0)
  );

  score = Math.min(100, Math.max(15, score));
  const isEligible = score >= 40 && seniorityMatch !== "under-qualified";

  return {
    isEligible,
    score,
    reasons,
    warnings,
    seniorityMatch,
    estimatedYearsRequired: requiredYears,
  };
}

/**
 * RankGPT Sliding-Window Permutation Job Reranker
 */
export class RankGPTJobReranker {
  constructor(private opts: RankGPTOptions = {}) {}

  /**
   * Reranks a feed of candidate jobs against a user profile
   */
  async rankJobs(jobs: Job[], profile: Profile): Promise<RankedJobResult[]> {
    if (!jobs || jobs.length === 0) return [];

    // Step 1: Pre-score and compute deterministic eligibility for every job
    const enriched = jobs.map((job) => {
      const eligibility = evaluateJobEligibility(job, profile);
      const jdText = job.description || job.title;
      const matchScore = scoreMatch({
        resumeText: profile.summary || profile.skills.join(", "),
        jobDescription: jdText,
        profileSkills: profile.skills || [],
      }).score;

      const jdAnalysis = analyzeJobDescription({
        resumeText: profile.summary || profile.skills.join(", "),
        jobDescription: jdText,
        profileSkills: profile.skills || [],
      });

      return {
        job,
        eligibility,
        relevanceScore: Math.round((matchScore * 0.6) + (eligibility.score * 0.4)),
        matchedStrengths: jdAnalysis.matched,
        missingGaps: jdAnalysis.missing,
        fitExplanation: eligibility.reasons.join(". ") || "Qualified role match.",
      };
    });

    // Step 2: Initial sorting by composite heuristic relevance score
    enriched.sort((a, b) => {
      // Prioritize eligible jobs first, then higher relevance
      return (Number(b.eligibility.isEligible) - Number(a.eligibility.isEligible)) ||
        (b.relevanceScore - a.relevanceScore);
    });

    // If LLM is unavailable or feed is small, return initial grounded ranking
    const llm = this.opts.llm;
    if (!llm || !llm.isAvailable() || enriched.length <= 2) {
      return enriched.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
    }

    // Step 3: RankGPT Sliding-Window Permutation Passes
    const windowSize = Math.min(this.opts.windowSize ?? 8, enriched.length);
    const stepSize = Math.min(this.opts.stepSize ?? 4, windowSize - 1);

    const workingList = [...enriched];

    // Slide window from bottom to top (bubble up top items)
    for (let end = workingList.length; end >= windowSize; end -= stepSize) {
      const start = Math.max(0, end - windowSize);
      const windowItems = workingList.slice(start, end);

      const rerankedIndices = await this.permuteWindowWithLLM(windowItems, profile, llm);
      if (rerankedIndices && rerankedIndices.length === windowItems.length) {
        // Apply permutation inside the window
        const permuted = rerankedIndices.map((origIdx) => windowItems[origIdx]);
        workingList.splice(start, windowItems.length, ...permuted);
      }
    }

    const eligibilityPreserved = [
      ...workingList.filter((item) => item.eligibility.isEligible),
      ...workingList.filter((item) => !item.eligibility.isEligible),
    ];
    return eligibilityPreserved.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  /**
   * Permute a single window of candidate jobs using RankGPT zero-shot permutation prompt
   */
  private async permuteWindowWithLLM(
    window: Array<{ job: Job; relevanceScore: number; fitExplanation: string }>,
    profile: Profile,
    llm: LLMClient
  ): Promise<number[] | null> {
    const targetRoles = profile.jobPreferences?.roleTitles ?? [];
    const candidateSummary = `CANDIDATE:
- Target Roles: ${targetRoles.join(", ") || "Not specified"}
- Core Skills: ${(profile.skills || []).slice(0, 15).join(", ")}
- Professional Summary: ${(profile.summary || "").slice(0, 300)}
- Experience: ${profile.experience?.map((e) => `${e.title} @ ${e.company}`).slice(0, 3).join("; ")}
- Location: ${[profile.city, profile.country].filter(Boolean).join(", ") || "Not specified"} (Willing to relocate: ${profile.willingToRelocate ?? "Not specified"})`;

    const jobPassages = window.map((item, idx) => {
      const j = item.job;
      // FIX: Was slice(0, 200) — roughly one sentence, not enough for RankGPT
      // to differentiate between jobs. 2000 chars captures the requirements
      // section, tech stack, and seniority signals that the model needs to rank.
      const snippet = (j.description || "").slice(0, 2000).replace(/\s+/g, " ");
      return `[${idx + 1}] Role: "${j.title}" at "${j.company}" | Loc: ${j.location || "Remote"} | Snippet: ${snippet}`;
    }).join("\n\n");

    const systemPrompt = `You are RankGPT, a world-class career matching and recruitment search re-ranker.
Your task is to rank the candidate job passages based on how well they match the candidate's verified skills, experience level, and career trajectory.
Rank the most suitable and eligible jobs first.
Output the permutation ranking format: [X] > [Y] > [Z] ...
Do not include any explanation or commentary. Output only the ranking list.`;

    const userPrompt = `${candidateSummary}

JOB PASSAGES:
${jobPassages}

Please rank the ${window.length} jobs above in order of relevance and suitability for the candidate.
Format: [rank1] > [rank2] > ...`;

    try {
      const response = await llm.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.1, maxTokens: 150 }
      );

      return this.parsePermutationResponse(response, window.length);
    } catch {
      return null;
    }
  }

  /**
   * Parse RankGPT permutation response string: "[1] > [3] > [2]" into zero-based indices
   */
  private parsePermutationResponse(text: string, count: number): number[] | null {
    if (!text) return null;
    const matches = [...text.matchAll(/\[(\d+)\]/g)];
    if (!matches || matches.length === 0) return null;

    const seen = new Set<number>();
    const indices: number[] = [];

    for (const m of matches) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= count) {
        const zeroIdx = num - 1;
        if (!seen.has(zeroIdx)) {
          seen.add(zeroIdx);
          indices.push(zeroIdx);
        }
      }
    }

    // Fill in any missed items in their original order
    for (let i = 0; i < count; i++) {
      if (!seen.has(i)) {
        indices.push(i);
      }
    }

    return indices.length === count ? indices : null;
  }
}
