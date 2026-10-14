/**
 * SOTA Job Discovery Engine — Synthesis of Top 5 Code-Based Research Implementations:
 *
 * 1. Constrained Dual-Perspective Reasoning (CDPR) [arXiv:2602.03097]
 *    - Decouples Candidate Preference P_pref from Employer Qualification P_qual.
 *    - Enforces Lagrangian knockout constraints (Visa sponsorship, experience boundaries).
 *
 * 2. WorkRB: Canonical Skill Ontology & Benchmark [ACM RecSys / arXiv:2407.01476]
 *    - ESCO / O*NET normalized multi-view skill taxonomy and synonym resolution.
 *
 * 3. STEP: Sequential Trajectory of Employment Prediction [arXiv:2404.18182]
 *    - Career progression transition matrix preventing underqualified / overqualified mismatches.
 *
 * 4. LiJAR: Dynamic Job Salience & Freshness Velocity [ACM SIGKDD]
 *    - Half-life time decay model and Early Applicant Advantage multiplier (<48h, <35 applicants).
 *
 * 5. RecBole-PJF: Bilateral Mutual Fit Optimization [ACM SIGIR / CIKM]
 *    - Mutual matching combining candidate preference and reciprocal employer qualification.
 */

import {
  extractCanonicalSkillsFromText,
  computeSkillOverlap,
  type CanonicalSkill,
  type SkillMatchMatrix,
} from "./taxonomy-normalizer.js";
import {
  projectCareerTrajectory,
  type TrajectoryProjection,
  type CandidateCareerProfile,
} from "./trajectory-projector.js";
import {
  computeJobSalience,
  type JobMarketDynamics,
  type SalienceScorecard,
} from "./salience-velocity.js";
import {
  evaluateBilateralFit,
  type BilateralMatchResult,
  type CandidateProfileContext,
  type JobListingContext,
} from "./dual-perspective-matcher.js";

export type CareerTrajectoryResult = TrajectoryProjection;
export type SkillOverlapResult = SkillMatchMatrix;

export type {
  CandidateProfileContext,
  JobListingContext,
  BilateralMatchResult,
  SalienceScorecard,
  TrajectoryProjection,
  SkillMatchMatrix,
  CanonicalSkill,
};

export interface DiscoveryFilterOptions {
  minScore?: number;                  // default: 40
  requireVisaSponsorship?: boolean;   // default: false
  excludeSaturated?: boolean;         // exclude > 300 applicants
  excludeStaleJobs?: boolean;         // exclude > 21 days old
  earlyBirdOnly?: boolean;            // only < 48 hours and < 35 applicants
  preferredModalities?: Array<"remote" | "hybrid" | "onsite">;
}

export interface DiscoveredJobRecommendation {
  job: JobListingContext;
  compositeScore: number;             // 0 to 100: Final calibrated ranking score
  bilateralFit: BilateralMatchResult;
  salience: SalienceScorecard;
  trajectory: TrajectoryProjection;
  skillOverlap: SkillMatchMatrix;
  badges: string[];
  headline: string;
}


/**
 * Normalizes a candidate's profile to the canonical discovery profile format.
 */
export function buildCandidateDiscoveryProfile(raw: {
  fullName: string;
  rawSkills: string[];
  yearsExperience: number;
  graduationYear?: number;
  recentTitles: string[];
  preferredTitles?: string[];
  workAuthorization?: CandidateProfileContext["workAuthorization"];
  preferredWorkModality?: CandidateProfileContext["preferredWorkModality"];
  preferredLocations?: string[];
}): CandidateProfileContext {
  const combinedSkillString = raw.rawSkills.join(", ");
  const skills = extractCanonicalSkillsFromText(combinedSkillString);

  return {
    fullName: raw.fullName,
    skills,
    yearsExperience: raw.yearsExperience,
    graduationYear: raw.graduationYear,
    recentTitles: raw.recentTitles,
    preferredTitles: raw.preferredTitles && raw.preferredTitles.length > 0
      ? raw.preferredTitles
      : raw.recentTitles,
    workAuthorization: raw.workAuthorization || "other",
    preferredWorkModality: raw.preferredWorkModality || "any",
    preferredLocations: raw.preferredLocations || [],
  };
}

/**
 * Evaluates a single job listing against a candidate's profile with all 5 models.
 */
export function evaluateSingleJobDiscovery(
  candidate: CandidateProfileContext,
  job: JobListingContext
): DiscoveredJobRecommendation {
  const jdText = `${job.title} ${job.company} ${job.location} ${job.description}`;

  // 1. WorkRB canonical skill extraction & overlap
  const jobSkills = extractCanonicalSkillsFromText(jdText);
  const skillOverlap = computeSkillOverlap(candidate.skills, jobSkills);

  // 2. STEP career trajectory projection
  const careerProfile: CandidateCareerProfile = {
    yearsExperience: candidate.yearsExperience,
    graduationYear: candidate.graduationYear,
    recentTitles: candidate.recentTitles,
  };
  const trajectory = projectCareerTrajectory(careerProfile, job.title, job.description);

  // 3. LiJAR dynamic job salience & velocity
  const marketDynamics: JobMarketDynamics = {
    postedAgoText: job.postedAgoText,
    applicantCount: job.applicantCount,
  };
  const salience = computeJobSalience(marketDynamics);

  // 4. CDPR & RecBole-PJF Bilateral fit (with Lagrangian knockouts)
  const bilateralFit = evaluateBilateralFit(candidate, job);

  // 5. Composite Final Score calculation
  let compositeScore = 0;

  if (bilateralFit.knockoutPassed) {
    const rawWeighted = bilateralFit.overallCompatibilityScore * salience.salienceMultiplier;
    compositeScore = Math.min(100, Math.max(1, Math.round(rawWeighted)));
  } else {
    // Punish hard knockout failures
    compositeScore = Math.min(20, bilateralFit.overallCompatibilityScore);
  }

  // Badges generation
  const badges: string[] = [];
  if (bilateralFit.visaStatus === "sponsor_verified") {
    badges.push("Sponsorship indicated in job text (unverified)");
  } else if (bilateralFit.visaStatus === "blocked_no_sponsorship") {
    badges.push("🚫 No Visa Sponsorship");
  }
  if (salience.isEarlyBird) {
    badges.push("Recently posted with lower listed applicant volume (heuristic)");
  }

  if (trajectory.transitionType === "natural_promotion") {
    badges.push("📈 Natural Promotion");
  } else if (trajectory.transitionType === "lateral") {
    badges.push("🎯 Lateral Match");
  }


  if (salience.isStaleOrGhostJob) {
    badges.push("Posting may be stale (heuristic)");
  }

  // Curated headline summary
  let headline = `${trajectory.transitionType.replace("_", " ").toUpperCase()}: ${bilateralFit.actionAdvice}`;
  if (!bilateralFit.knockoutPassed && bilateralFit.knockoutReason) {
    headline = `DISQUALIFIED: ${bilateralFit.knockoutReason}`;
  }

  return {
    job,
    compositeScore,
    bilateralFit,
    salience,
    trajectory,
    skillOverlap,
    badges,
    headline,
  };
}

/**
 * Primary SOTA Discovery Pipeline:
 * Evaluates, filters, and ranks candidate job listings.
 */
export function rankAndFilterJobs(
  candidate: CandidateProfileContext,
  jobs: JobListingContext[],
  options: DiscoveryFilterOptions = {}
): DiscoveredJobRecommendation[] {
  const minScore = options.minScore ?? 40;
  const requireVisa = options.requireVisaSponsorship ?? false;

  const recommendations: DiscoveredJobRecommendation[] = [];

  for (const job of jobs) {
    const rec = evaluateSingleJobDiscovery(candidate, job);

    // Filter 1: Hard Knockout enforcement
    if (!rec.bilateralFit.knockoutPassed && minScore > 20) {
      continue;
    }

    // Filter 2: Visa sponsorship requirement filter
    if (requireVisa && !["sponsor_verified", "no_sponsorship_required"].includes(rec.bilateralFit.visaStatus)) {
      continue;
    }

    // Filter 3: Modality filter
    if (options.preferredModalities && options.preferredModalities.length > 0) {
      const jdNorm = `${job.location} ${job.description}`.toLowerCase();
      const isRemote = jdNorm.includes("remote") || jdNorm.includes("wfh") || jdNorm.includes("work from home");
      const isHybrid = jdNorm.includes("hybrid");
      const isOnsite = !isRemote && !isHybrid;

      const matchesModality = options.preferredModalities.some((m) => {
        if (m === "remote" && isRemote) return true;
        if (m === "hybrid" && isHybrid) return true;
        if (m === "onsite" && isOnsite) return true;
        return false;
      });

      if (!matchesModality) continue;
    }

    // Filter 4: Saturated job filter
    if (options.excludeSaturated && rec.salience.congestionLevel === "saturated") {
      continue;
    }

    // Filter 5: Stale job filter
    if (options.excludeStaleJobs && rec.salience.isStaleOrGhostJob) {
      continue;
    }

    // Filter 6: Early bird only filter
    if (options.earlyBirdOnly && !rec.salience.isEarlyBird) {
      continue;
    }

    // Filter 7: Minimum composite score
    if (rec.compositeScore < minScore) {
      continue;
    }

    recommendations.push(rec);
  }

  // Sort descending by compositeScore, breaking ties by freshness score
  recommendations.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    return (b.salience.freshnessScore ?? -1) - (a.salience.freshnessScore ?? -1);
  });

  return recommendations;
}
