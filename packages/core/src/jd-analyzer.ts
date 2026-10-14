/**
 * JD analyzer — deterministic job-description analysis (no LLM).
 *
 * Enhanced with comprehensive skill extraction from job descriptions
 * using pattern matching across 100+ technical skills, frameworks,
 * cloud platforms, databases, and soft skills.
 */
import { analyzeATS } from "./ats.js";
import { scoreMatch, type MatchOutput } from "./matcher.js";
import { inferMatches } from "./skill-graph.js";
import { analyzeVisaSponsorship, type VisaAnalysis } from "./visa-verify.js";
import { extractFromText, type ExtractionResult } from "./skill-extractor.js";

export interface JdAnalysis {
  score: number;
  matched: string[];
  missing: string[];
  inferred: { job: string; via: string }[];
  atsScore: number;
  atsGaps: string[];
  atsCovered: string[];
  reasons: string[];
  isInactive: boolean;
  inactiveReasons: string[];
  visa?: VisaAnalysis;
  /** Comprehensive skill extraction from JD */
  extractedSkills?: ExtractionResult;
}

export function detectInactiveJob(description: string): { isInactive: boolean; reasons: string[] } {
  const desc = description.toLowerCase().trim();
  const reasons: string[] = [];

  if (desc.length < 30 && desc.length > 0) {
    reasons.push("Job description is extremely short, which often indicates an expired or placeholder page.");
  }

  const inactivePhrases = [
    "no longer accepting applications",
    "position has been filled",
    "job has expired",
    "applications are closed",
    "this job is inactive",
    "listing has expired",
    "hiring has concluded",
    "position closed",
    "this role is closed",
    "no longer active",
    "application deadline has passed",
    "this posting has expired",
    "this job is no longer available"
  ];

  for (const phrase of inactivePhrases) {
    if (desc.includes(phrase)) {
      reasons.push(`Job description contains expiration phrase: "${phrase}".`);
    }
  }

  return {
    isInactive: reasons.length > 0,
    reasons
  };
}

export function analyzeJobDescription(input: {
  resumeText: string;
  jobDescription: string;
  profileSkills?: string[];
  companyName?: string;
}): JdAnalysis {
  const match: MatchOutput = scoreMatch(input);
  const ats = analyzeATS(input.resumeText, input.jobDescription);
  const inferred = inferMatches(
    [...match.missing, ...ats.gaps.map((g) => g.term)],
    input.profileSkills ?? []
  );

  const inferredJobs = new Set(inferred.map((i) => i.job));
  const adjustedMissing = match.missing.filter((m) => !inferredJobs.has(m));

  let score = match.score;
  if (inferred.length > 0) {
    score = Math.min(100, score + Math.min(15, inferred.length * 3));
  }

  const reasons = [...match.reasons];
  if (inferred.length) {
    reasons.push(
      `Inferred ${inferred.length} match(es) via skill graph (e.g. ${inferred[0]!.job} via ${inferred[0]!.via}).`
    );
  }

  const inactiveCheck = detectInactiveJob(input.jobDescription);
  if (inactiveCheck.isInactive) {
    reasons.push("Warning: This job posting appears to be inactive or expired.");
  }

  const visa = input.companyName ? analyzeVisaSponsorship(input.companyName, input.jobDescription) : undefined;

  // Extract comprehensive skills from job description
  const extractedSkills = extractFromText(input.jobDescription);

  return {
    score,
    matched: match.matched,
    missing: adjustedMissing,
    inferred,
    atsScore: ats.score,
    atsGaps: ats.gaps.map((g) => g.term).slice(0, 12),
    atsCovered: ats.covered.map((g) => g.term).slice(0, 12),
    reasons,
    isInactive: inactiveCheck.isInactive,
    inactiveReasons: inactiveCheck.reasons,
    visa,
    extractedSkills,
  };
}
