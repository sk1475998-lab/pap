/**
 * SOTA Autonomous LLM Multi-Agent Job Discovery System
 *
 * Implements the latest peer-reviewed Multi-Agent Research Architectures:
 * 1. "AI Hiring with LLMs: Explainable Multi-Agent Framework" (arXiv:2504.02870)
 *    - Role-playing Multi-Agent Council (Recruiter Critic vs Candidate Advocate vs Arbitrator).
 * 2. "AgentVerse & ChatEval: Multi-Agent Consensus Debate Protocol" (ICLR / EMNLP)
 *    - Multi-perspective deliberation eliminating single-LLM hallucination & scoring variance.
 * 3. "CDPR: Constrained Dual-Perspective Reasoning" (arXiv:2602.03097, Feb 2026)
 *    - Decoupled Candidate Utility P_pref and Employer Qualification P_qual with hard knockouts.
 * 4. "GIRL: Generative Job Recommendation based on LLMs" (ACM RecSys / arXiv:2407.01476)
 *    - Generative latent career projection and growth alignment.
 * 5. "LiJAR: Dynamic Job Salience & Early Bird Advantage" (ACM SIGKDD)
 *    - Temporal velocity and applicant congestion weighting.
 */

import type { LLMClient } from "../llm/index.js";
import { parseModelJson } from "../llm/robust.js";
import { computeJobSalience, type SalienceScorecard } from "./salience-velocity.js";
import { extractCanonicalSkillsFromText } from "./taxonomy-normalizer.js";

export interface CandidateDossier {
  fullName: string;
  education: string;
  yearsExperience: number;
  skills: string[];
  recentTitles: string[];
  workAuthorization: "us_citizen_gc" | "requires_sponsorship" | "opt_stem" | "india_citizen" | "other";
  rawResumeText: string;
}

export interface LiveJobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedAgoText?: string;
  applicantCount?: number;
}

export interface RecruiterCriticEvaluation {
  qualificationScore: number; // 0 to 100
  knockoutTriggered: boolean;
  knockoutReason?: string;
  hardGaps: string[];
  concerns: string[];
  recruiterVerdict: "strong_hire" | "possible_hire" | "lean_reject" | "instant_reject";
}

export interface CandidateAdvocateEvaluation {
  candidateUtilityScore: number; // 0 to 100 (P_pref)
  keyStrengthsForRole: string[];
  transferableProofPoints: string[];
  advocateVerdict: "dream_opportunity" | "solid_step" | "misaligned";
}

export interface ArbitratorCouncilVerdict {
  consensusScore: number; // 0 to 100: Debated, bias-free bilateral score
  recommendation: "STRONG_APPLY" | "QUALIFIED_APPLY" | "STRETCH_GOAL" | "KNOCKOUT_SKIP";
  decisionRationale: string;
  debateSummary: {
    recruiterKeyPoint: string;
    advocateKeyPoint: string;
    arbitratorReconciliation: string;
  };
  recommendedTailoringTips: string[];
}

export interface MultiAgentDiscoveryDecision {
  job: LiveJobPosting;
  compositeRankScore: number; // Final score factoring in Early Bird Multiplier
  arbitrator: ArbitratorCouncilVerdict;
  recruiterCritic: RecruiterCriticEvaluation;
  candidateAdvocate: CandidateAdvocateEvaluation;
  salience: SalienceScorecard;
  badges: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecruiterEvaluation(value: unknown): value is RecruiterCriticEvaluation {
  if (!isRecord(value)) return false;
  return isScore(value.qualificationScore)
    && typeof value.knockoutTriggered === "boolean"
    && (value.knockoutReason === undefined || value.knockoutReason === null || typeof value.knockoutReason === "string")
    && isStringArray(value.hardGaps)
    && isStringArray(value.concerns)
    && ["strong_hire", "possible_hire", "lean_reject", "instant_reject"].includes(String(value.recruiterVerdict));
}

function isAdvocateEvaluation(value: unknown): value is CandidateAdvocateEvaluation {
  if (!isRecord(value)) return false;
  return isScore(value.candidateUtilityScore)
    && isStringArray(value.keyStrengthsForRole)
    && isStringArray(value.transferableProofPoints)
    && ["dream_opportunity", "solid_step", "misaligned"].includes(String(value.advocateVerdict));
}

function isArbitratorVerdict(value: unknown): value is ArbitratorCouncilVerdict {
  if (!isRecord(value) || !isRecord(value.debateSummary)) return false;
  const summary = value.debateSummary;
  return isScore(value.consensusScore)
    && ["STRONG_APPLY", "QUALIFIED_APPLY", "STRETCH_GOAL", "KNOCKOUT_SKIP"].includes(String(value.recommendation))
    && typeof value.decisionRationale === "string"
    && typeof summary.recruiterKeyPoint === "string"
    && typeof summary.advocateKeyPoint === "string"
    && typeof summary.arbitratorReconciliation === "string"
    && isStringArray(value.recommendedTailoringTips);
}

/* ================================================================== */
/* 1. Recruiter Critic Agent Persona (Bar Raiser / Screener)           */
/* ================================================================== */
const RECRUITER_CRITIC_PROMPT = `You are the Lead Technical Recruiter and Bar Raiser at a top-tier enterprise firm.
Your job is to objectively scrutinize candidate applications against job requirements.
You do NOT flatter. You identify hard knockout clauses, missing prerequisites, visa restrictions, and seniority deficits.

Evaluate the candidate's resume strictly against the target Job Description.
Check for:
1. Legal/Work Authorization knockouts: If job requires US Citizenship or explicitly prohibits visa sponsorship, and candidate is NOT a US Citizen, flag as knockout. (Note: An 'india_citizen' has full legal right to work in India and for global remote roles with no sponsorship needed).
2. Seniority gap: If role requires 7+ years or Principal/Director level and candidate is student/junior, flag as knockout or extreme deficit.
3. Must-have technical stack gaps.


Output strictly valid JSON with this exact schema:
{
  "qualificationScore": <number 0-100>,
  "knockoutTriggered": <boolean>,
  "knockoutReason": <string or null>,
  "hardGaps": [<string>, ...],
  "concerns": [<string>, ...],
  "recruiterVerdict": "strong_hire" | "possible_hire" | "lean_reject" | "instant_reject"
}`;

/* ================================================================== */
/* 2. Candidate Talent Advocate Agent Persona (Executive Agent)       */
/* ================================================================== */
const CANDIDATE_ADVOCATE_PROMPT = `You are the candidate's Elite Career Agent and Talent Advocate.
Your goal is to highlight the candidate's core strengths, rapid learning velocity, DSA achievements,
and latent transferable competencies that prove they can excel in this role.
Also evaluate whether this job offers high career utility (P_pref) for the candidate's growth trajectory.

Output strictly valid JSON with this exact schema:
{
  "candidateUtilityScore": <number 0-100>,
  "keyStrengthsForRole": [<string>, ...],
  "transferableProofPoints": [<string>, ...],
  "advocateVerdict": "dream_opportunity" | "solid_step" | "misaligned"
}`;

/* ================================================================== */
/* 3. Chief Arbitrator Agent Persona (Council Chair / Decision Maker)  */
/* ================================================================== */
const ARBITRATOR_PROMPT = `You are the Chief Arbitrator and Hiring Committee Chair presiding over the Multi-Agent Council.
You have received independent assessments from:
1. The Recruiter Critic (skeptical, risk-averse, looking for knockouts & gaps)
2. The Talent Advocate (championing candidate's strengths & career utility)

Your responsibility is to resolve their debate through the ChatEval consensus protocol:
- If the Recruiter identified a verified legal or seniority knockout (e.g. Citizenship or 10-year experience gap), respect it and assign a disqualification or very low score (<25).
- Otherwise, balance verified competencies against missing gaps to form a fair, calibrated consensus score (0-100).
- Provide actionable, 0-hallucination tailoring advice on what projects/keywords the candidate must emphasize in their resume.

Output strictly valid JSON with this exact schema:
{
  "consensusScore": <number 0-100>,
  "recommendation": "STRONG_APPLY" | "QUALIFIED_APPLY" | "STRETCH_GOAL" | "KNOCKOUT_SKIP",
  "decisionRationale": "<concise 2-sentence rationale>",
  "debateSummary": {
    "recruiterKeyPoint": "<main concern raised by recruiter>",
    "advocateKeyPoint": "<main defense raised by advocate>",
    "arbitratorReconciliation": "<how you resolved the debate>"
  },
  "recommendedTailoringTips": [<string>, ...]
}`;

/**
 * Runs the Multi-Agent Council on a single live job posting.
 */
export async function evaluateJobWithMultiAgentCouncil(
  llm: LLMClient,
  candidate: CandidateDossier,
  job: LiveJobPosting
): Promise<MultiAgentDiscoveryDecision> {
  if (!llm.isAvailable()) throw new Error("Multi-agent evaluation unavailable: LLM client is not configured");
  const candidateSummary = `
Candidate Name: ${candidate.fullName}
Education: ${candidate.education}
Years Experience: ${candidate.yearsExperience}
Recent Titles: ${candidate.recentTitles.join(", ")}
Work Authorization: ${candidate.workAuthorization}
Extracted Skills: ${candidate.skills.slice(0, 30).join(", ")}

Resume Context:
${candidate.rawResumeText.slice(0, 3000)}
  `.trim();

  const jobSummary = `
Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description.slice(0, 3500)}
  `.trim();


  // 1. Recruiter Critic Agent Call
  let recruiterEval: RecruiterCriticEvaluation;

  try {
    const rawCritic = await llm.complete([
      { role: "system", content: RECRUITER_CRITIC_PROMPT },
      { role: "user", content: `Evaluate this application:\n\n[CANDIDATE]:\n${candidateSummary}\n\n[JOB POSTING]:\n${jobSummary}` },
    ]);
    const parsed = parseModelJson(rawCritic);
    if (!isRecruiterEvaluation(parsed)) throw new Error("Response did not match the recruiter schema");
    recruiterEval = parsed;
  } catch (err) {
    throw new Error(`Recruiter evaluation failed for ${job.title}: ${String(err)}`);
  }

  // 2. Candidate Advocate Agent Call
  let advocateEval: CandidateAdvocateEvaluation;

  try {
    const rawAdvocate = await llm.complete([
      { role: "system", content: CANDIDATE_ADVOCATE_PROMPT },
      { role: "user", content: `Advocate for this candidate:\n\n[CANDIDATE]:\n${candidateSummary}\n\n[JOB POSTING]:\n${jobSummary}` },
    ]);
    const parsed = parseModelJson(rawAdvocate);
    if (!isAdvocateEvaluation(parsed)) throw new Error("Response did not match the advocate schema");
    advocateEval = parsed;
  } catch (err) {
    throw new Error(`Candidate advocate evaluation failed for ${job.title}: ${String(err)}`);
  }

  // 3. Arbitrator Council Debate Resolution Call
  let arbitratorVerdict: ArbitratorCouncilVerdict;

  try {
    const rawArbitrator = await llm.complete([
      { role: "system", content: ARBITRATOR_PROMPT },
      {
        role: "user",
        content: `Moderate and resolve the hiring committee debate:
[JOB]: ${job.title} at ${job.company} (${job.location})
[CANDIDATE]: ${candidate.fullName}, Experience: ${candidate.yearsExperience} yrs, Education: ${candidate.education}

[RECRUITER CRITIC EVALUATION]:
${JSON.stringify(recruiterEval, null, 2)}

[CANDIDATE ADVOCATE EVALUATION]:
${JSON.stringify(advocateEval, null, 2)}

Provide your definitive consensus ruling in JSON.`,
      },
    ]);
    const parsed = parseModelJson(rawArbitrator);
    if (!isArbitratorVerdict(parsed)) throw new Error("Response did not match the arbitrator schema");
    arbitratorVerdict = parsed;
  } catch (err) {
    throw new Error(`Arbitration failed for ${job.title}: ${String(err)}`);
  }


  // 4. Salience & Early Bird Advantage (LiJAR)
  const salience = computeJobSalience({
    postedAgoText: job.postedAgoText,
    applicantCount: job.applicantCount,
  });

  // Calculate composite rank score
  let compositeRankScore = arbitratorVerdict.consensusScore;
  if (!recruiterEval.knockoutTriggered) {
    compositeRankScore = Math.min(100, Math.max(1, Math.round(arbitratorVerdict.consensusScore * salience.salienceMultiplier)));
  } else {
    compositeRankScore = Math.min(20, arbitratorVerdict.consensusScore);
  }

  // Construct Badges
  const badges: string[] = [];
  if (recruiterEval.knockoutTriggered) {
    badges.push("🚫 Disqualified by Recruiter Council");
  }

  return {
    job,
    compositeRankScore,
    arbitrator: arbitratorVerdict,
    recruiterCritic: recruiterEval,
    candidateAdvocate: advocateEval,
    salience,
    badges,
  };
}

/**
 * Orchestrates a swarm of LLM agents across a batch of live jobs.
 */
export async function runAutonomousDiscoverySwarm(
  llm: LLMClient,
  candidate: CandidateDossier,
  liveJobs: LiveJobPosting[],
  onProgress?: (index: number, total: number, job: LiveJobPosting) => void
): Promise<MultiAgentDiscoveryDecision[]> {
  const decisions: MultiAgentDiscoveryDecision[] = [];

  for (let i = 0; i < liveJobs.length; i++) {
    const job = liveJobs[i];
    if (onProgress) onProgress(i + 1, liveJobs.length, job);

    const decision = await evaluateJobWithMultiAgentCouncil(llm, candidate, job);
    decisions.push(decision);
  }

  // Sort descending by compositeRankScore
  decisions.sort((a, b) => b.compositeRankScore - a.compositeRankScore);

  return decisions;
}
