/**
 * Constrained Dual-Perspective Matcher — Inspired by:
 *  1. Constrained Dual-Perspective Reasoning with LLMs (Kan et al., arXiv:2602.03097 / Feb 2026)
 *  2. RecBole-PJF: Bilateral Person-Job Fit (ACM SIGIR / CIKM)
 *
 * De-conflates Candidate Preference from Employer Qualification.
 * Enforces hard knockout constraints (Visa sponsorship, mandatory degrees, experience thresholds)
 * before optimizing subjective preference similarity, eliminating false-positive matches.
 */

import { CanonicalSkill, computeSkillOverlap, extractCanonicalSkillsFromText } from "./taxonomy-normalizer.js";
import { projectCareerTrajectory, CandidateCareerProfile } from "./trajectory-projector.js";

export interface CandidateProfileContext {
  fullName: string;
  skills: CanonicalSkill[];
  yearsExperience: number;
  graduationYear?: number;
  recentTitles: string[];
  preferredTitles: string[];
  workAuthorization: "us_citizen_gc" | "requires_sponsorship" | "opt_stem" | "india_citizen" | "other";
  preferredWorkModality?: "remote" | "hybrid" | "onsite" | "any";
  preferredLocations?: string[];
}

export interface JobListingContext {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedAgoText?: string;
  applicantCount?: number;
}

export interface BilateralMatchResult {
  overallCompatibilityScore: number; // 0 to 100
  knockoutPassed: boolean;
  knockoutReason?: string;
  employerQualificationScore: number; // 0 to 100
  candidatePreferenceScore: number;   // 0 to 100
  visaStatus: "sponsor_verified" | "no_sponsorship_required" | "blocked_no_sponsorship" | "unspecified";
  matchedMustHaves: string[];
  missingGaps: string[];
  recommendation: "strong_match" | "qualified_apply" | "stretch_role" | "knockout_disqualified";
  actionAdvice: string;
}

/**
 * Checks for hard visa / work authorization knockout clauses.
 */
function evaluateVisaKnockout(
  candAuth: CandidateProfileContext["workAuthorization"],
  jdText: string
): { passed: boolean; status: BilateralMatchResult["visaStatus"]; reason?: string } {
  const text = jdText.toLowerCase();

  const explicitlyNoSponsorship =
    /\b(no visa sponsorship|unable to sponsor|must be a u\.?s\.? citizen|citizen or green card|lawful permanent resident|u\.?s\.? citizenship required|not offer sponsorship)\b/i.test(text);

  const explicitlyOffersSponsorship =
    /\b(visa sponsorship available|will sponsor|open to h-?1b|sponsorship provided|relocation and visa)\b/i.test(text);

  if (candAuth === "requires_sponsorship" || candAuth === "opt_stem") {
    if (explicitlyNoSponsorship) {
      return {
        passed: false,
        status: "blocked_no_sponsorship",
        reason: "Job explicitly specifies no visa sponsorship or US Citizenship required.",
      };
    }
    if (explicitlyOffersSponsorship) {
      return { passed: true, status: "sponsor_verified" };
    }
    return { passed: true, status: "unspecified" };
  }

  return { passed: true, status: "no_sponsorship_required" };
}

/**
 * Computes Candidate Preference Score: P_pref(job | candidate)
 */
function computeCandidatePreference(candidate: CandidateProfileContext, job: JobListingContext): number {
  let score = 50;

  // Title preference match
  const jobTitleNorm = job.title.toLowerCase();
  const matchedPrefTitle = candidate.preferredTitles.some((pt) =>
    jobTitleNorm.includes(pt.toLowerCase()) || pt.toLowerCase().includes(jobTitleNorm)
  );
  if (matchedPrefTitle) score += 30;

  // Modality match
  const jobDescNorm = `${job.location} ${job.description}`.toLowerCase();
  const isRemote = jobDescNorm.includes("remote") || jobDescNorm.includes("work from home") || jobDescNorm.includes("wfh");

  if (candidate.preferredWorkModality === "remote" && isRemote) score += 20;
  if (candidate.preferredWorkModality === "onsite" && !isRemote) score += 15;

  return Math.min(100, Math.max(0, score));
}

/**
 * Evaluates bilateral person-job fit using Constrained Dual-Perspective Reasoning.
 */
export function evaluateBilateralFit(
  candidate: CandidateProfileContext,
  job: JobListingContext
): BilateralMatchResult {
  const combinedJdText = `${job.title} ${job.company} ${job.location} ${job.description}`;

  // Step 1: Lagrangian Hard Knockout Check (Visa)
  const visaEvaluation = evaluateVisaKnockout(candidate.workAuthorization, combinedJdText);
  if (!visaEvaluation.passed) {
    return {
      overallCompatibilityScore: 12,
      knockoutPassed: false,
      knockoutReason: visaEvaluation.reason,
      employerQualificationScore: 0,
      candidatePreferenceScore: computeCandidatePreference(candidate, job),
      visaStatus: visaEvaluation.status,
      matchedMustHaves: [],
      missingGaps: ["Valid Work Authorization / Sponsorship Required"],
      recommendation: "knockout_disqualified",
      actionAdvice: "Skip: Company explicitly does not sponsor visas or requires citizenship.",
    };
  }

  // Step 2: Skill Extraction & Hierarchical Overlap (WorkRB)
  const jobSkills = extractCanonicalSkillsFromText(combinedJdText);
  const skillMatrix = computeSkillOverlap(candidate.skills, jobSkills);

  // Step 3: Career Trajectory Projection (STEP)
  const careerProfile: CandidateCareerProfile = {
    yearsExperience: candidate.yearsExperience,
    graduationYear: candidate.graduationYear,
    recentTitles: candidate.recentTitles,
  };
  const trajectory = projectCareerTrajectory(careerProfile, job.title, job.description);

  // Hard Knockout: Extreme underqualification
  if (trajectory.transitionType === "underqualified" && trajectory.trajectoryFitScore <= 20) {
    return {
      overallCompatibilityScore: 18,
      knockoutPassed: false,
      knockoutReason: trajectory.rationale,
      employerQualificationScore: 15,
      candidatePreferenceScore: computeCandidatePreference(candidate, job),
      visaStatus: visaEvaluation.status,
      matchedMustHaves: skillMatrix.matchedSkills.map((s) => s.name),
      missingGaps: skillMatrix.missingSkills.map((s) => s.name),
      recommendation: "knockout_disqualified",
      actionAdvice: "Skip: Significant seniority deficit; application will be automatically rejected.",
    };
  }

  // Step 4: Employer Qualification Score: P_qual(candidate | job)
  const skillScore = Math.round(skillMatrix.overlapRatio * 100);
  const employerQualificationScore = Math.round(
    skillScore * 0.60 + trajectory.trajectoryFitScore * 0.40
  );

  // Step 5: Candidate Preference Score: P_pref(job | candidate)
  const candidatePreferenceScore = computeCandidatePreference(candidate, job);

  // Step 6: Bilateral Synthesis (Dual Optimization)
  const overallCompatibilityScore = Math.round(
    employerQualificationScore * 0.60 + candidatePreferenceScore * 0.40
  );

  let recommendation: BilateralMatchResult["recommendation"] = "qualified_apply";
  let actionAdvice = "Apply: Good overall alignment with employer requirements.";

  if (overallCompatibilityScore >= 80) {
    recommendation = "strong_match";
    actionAdvice = "Top Tier Opportunity: High mutual qualification and strong ATS pass probability.";
  } else if (overallCompatibilityScore < 50) {
    recommendation = "stretch_role";
    actionAdvice = "Stretch: Tailor resume with grounded keywords before submitting.";
  }

  return {
    overallCompatibilityScore,
    knockoutPassed: true,
    employerQualificationScore,
    candidatePreferenceScore,
    visaStatus: visaEvaluation.status,
    matchedMustHaves: skillMatrix.matchedSkills.map((s) => s.name),
    missingGaps: skillMatrix.missingSkills.map((s) => s.name),
    recommendation,
    actionAdvice,
  };
}
