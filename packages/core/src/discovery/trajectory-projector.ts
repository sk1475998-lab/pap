/**
 * Career Trajectory Projector — Inspired by STEP (Sequential Trajectory of Employment Prediction, LinkedIn Research / arXiv:2404.18182)
 *
 * Evaluates candidate career progression vector against job seniority.
 * Models whether a job represents a natural next step, lateral transition,
 * or unrealistic leap (overqualified / underqualified).
 */

export type SeniorityLevel =
  | "intern"
  | "entry_level"     // 0-2 years, Associate, Junior, Graduate
  | "mid_level"       // 2-5 years, Software Engineer, Data Scientist
  | "senior"          // 5-8 years, Senior, Lead
  | "staff_principal" // 8-12+ years, Staff, Principal, Architect
  | "executive";      // VP, Director, Head of

export interface CandidateCareerProfile {
  yearsExperience: number;
  graduationYear?: number;
  recentTitles: string[];
}

export interface TrajectoryProjection {
  candidateSeniority: SeniorityLevel;
  jobSeniority: SeniorityLevel;
  trajectoryFitScore: number; // 0 to 100
  transitionType: "natural_promotion" | "lateral" | "ideal_entry" | "overqualified" | "underqualified";
  rationale: string;
}

const SENIORITY_RANK: Record<SeniorityLevel, number> = {
  intern: 0,
  entry_level: 1,
  mid_level: 2,
  senior: 3,
  staff_principal: 4,
  executive: 5,
};

/**
 * Infers candidate's current seniority from experience years, graduation date, and titles.
 */
export function inferCandidateSeniority(candidate: CandidateCareerProfile): SeniorityLevel {
  const titles = candidate.recentTitles.map((t) => t.toLowerCase()).join(" ");

  // Direct title heuristics
  if (/\b(director|vp|vice president|chief|head of)\b/.test(titles)) return "executive";
  if (/\b(staff|principal|architect|distinguished)\b/.test(titles)) return "staff_principal";
  if (/\b(senior|sr\.?|lead)\b/.test(titles) && candidate.yearsExperience >= 3) return "senior";
  if (/\b(intern|internship|trainee|apprentice|student)\b/.test(titles) && candidate.yearsExperience < 2) return "intern";
  if (/\b(junior|entry level|associate)\b/.test(titles) && candidate.yearsExperience <= 2.5) return "entry_level";

  // Graduation year heuristic (if current year >= grad year)
  const currentYear = new Date().getFullYear();
  if (candidate.graduationYear && candidate.graduationYear >= currentYear) {
    return "intern";
  }

  // Experience year fallback
  if (candidate.yearsExperience <= 1) return candidate.graduationYear && candidate.graduationYear >= currentYear ? "intern" : "entry_level";
  if (candidate.yearsExperience < 4) return "mid_level";
  if (candidate.yearsExperience < 8) return "senior";
  if (candidate.yearsExperience < 14) return "staff_principal";
  return "executive";
}

/**
 * Infers target job required seniority from title and description text.
 */
export function inferJobSeniority(title: string, description: string = ""): SeniorityLevel {
  const text = `${title} ${description}`.toLowerCase();

  if (/\b(intern|internship|student|co-op|summer trainee|graduate intern)\b/.test(title.toLowerCase())) {
    return "intern";
  }
  if (/\b(director|vp|vice president|head of|chief)\b/.test(title.toLowerCase())) {
    return "executive";
  }
  if (/\b(staff|principal|architect|distinguished|lead architect)\b/.test(title.toLowerCase())) {
    return "staff_principal";
  }
  if (/\b(senior|sr\.?|lead engineer|tech lead|team lead)\b/.test(title.toLowerCase())) {
    return "senior";
  }
  if (/\b(entry level|junior|associate|graduate|fresh|new grad|trainee|0-1 years?|0-2 years?)\b/.test(text)) {
    return "entry_level";
  }
  if (/\b(5\+|6\+|7\+|8\+|9\+|10\+)\s*(?:years|yrs)/.test(text)) {
    return "senior";
  }
  if (/\b(3\+|4\+|2-5|3-5)\s*(?:years|yrs)/.test(text)) {
    return "mid_level";
  }

  return "mid_level";
}

/**
 * Projects trajectory compatibility between candidate profile and target job role.
 */
export function projectCareerTrajectory(
  candidate: CandidateCareerProfile,
  jobTitle: string,
  jobDescription: string = ""
): TrajectoryProjection {
  const candidateSeniority = inferCandidateSeniority(candidate);
  const jobSeniority = inferJobSeniority(jobTitle, jobDescription);

  const candRank = SENIORITY_RANK[candidateSeniority];
  const jobRank = SENIORITY_RANK[jobSeniority];
  const rankDiff = jobRank - candRank;

  // STEP-style transition logic
  if (candRank === 0 && jobRank === 0) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 100,
      transitionType: "ideal_entry",
      rationale: "Direct match for academic or student internship.",
    };
  }

  if (candRank === 0 && jobRank === 1) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 95,
      transitionType: "natural_promotion",
      rationale: "Natural progression from intern to full-time entry level role.",
    };
  }

  if (rankDiff === 0) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 92,
      transitionType: "lateral",
      rationale: "Solid lateral transition matching current experience tier.",
    };
  }

  if (rankDiff === 1) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 88,
      transitionType: "natural_promotion",
      rationale: "Healthy upward career progression step.",
    };
  }

  if (rankDiff === 2) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 45,
      transitionType: "underqualified",
      rationale: "Role demands 2 seniority tiers above current verified tenure.",
    };
  }

  if (rankDiff >= 3) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 15,
      transitionType: "underqualified",
      rationale: "Significant underqualification gap; high risk of instant rejection.",
    };
  }

  // Negative diff: overqualified
  if (rankDiff === -1) {
    return {
      candidateSeniority,
      jobSeniority,
      trajectoryFitScore: 70,
      transitionType: "overqualified",
      rationale: "Candidate exceeds standard requirements; high qualification probability.",
    };
  }

  return {
    candidateSeniority,
    jobSeniority,
    trajectoryFitScore: 25,
    transitionType: "overqualified",
    rationale: "Substantial overqualification; candidate may be filtered out as flight-risk.",
  };
}
