/**
 * Application readiness engine.
 *
 * A quality gate that decides whether the agent should apply, skip, or request
 * human review. It combines profile completeness, match score, job-risk/scam
 * detection, ATS keyword gaps, and user/company preferences.
 */
import type { Job, Profile } from "./types.js";
import { analyzeJobDescription } from "./jd-analyzer.js";
import { adjustedMatchScore, assessJobRisk, type JobRiskAssessment } from "./job-risk.js";
import { scoreMatch } from "./matcher.js";
import type { MatchResult } from "./types.js";
import { validateProfile, type ProfileValidation } from "./profile-complete.js";

export type ReadinessDecision = "apply" | "review" | "skip" | "blocked";

export interface ApplicationReadinessIssue {
  code: string;
  severity: "info" | "warning" | "error" | "blocked";
  message: string;
}

export interface ApplicationReadinessReport {
  decision: ReadinessDecision;
  confidence: number;
  score: number;
  rawMatchScore: number;
  profileScore: number;
  match: MatchResult;
  risk: JobRiskAssessment;
  profile: ProfileValidation;
  matchedKeywords: string[];
  missingKeywords: string[];
  inferredKeywords: { job: string; via: string }[];
  issues: ApplicationReadinessIssue[];
  nextActions: string[];
}

export interface ReadinessOptions {
  minScore?: number;
  allowReviewBelowScore?: boolean;
  maxMissingRequiredProfileFields?: number;
  requireResume?: boolean;
}

function issue(
  issues: ApplicationReadinessIssue[],
  code: string,
  severity: ApplicationReadinessIssue["severity"],
  message: string
) {
  issues.push({ code, severity, message });
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function assessApplicationReadiness(
  profile: Profile,
  job: Pick<Job, "title" | "company" | "description" | "url" | "location" | "postedAt">,
  opts: ReadinessOptions = {}
): ApplicationReadinessReport {
  const minScore = opts.minScore ?? 60;
  const profileValidation = validateProfile(profile);
  const match = scoreMatch({
    resumeText: profile.masterResumeText || profile.summary || profile.skills.join(" "),
    jobDescription: job.description || `${job.title} ${job.company}`,
    profileSkills: profile.skills,
  });
  const risk = assessJobRisk(job, profile);
  const score = adjustedMatchScore(match.score, risk);
  const jd = analyzeJobDescription({
    resumeText: profile.masterResumeText || "",
    jobDescription: job.description || `${job.title} ${job.company}`,
    profileSkills: profile.skills,
  });

  const issues: ApplicationReadinessIssue[] = [];

  if (opts.requireResume !== false && !profile.masterResumeText?.trim()) {
    issue(issues, "missing-resume", "blocked", "No resume text is available for scoring/tailoring.");
  }
  for (const f of profileValidation.missingRequired) {
    issue(issues, `missing-profile-${f.key}`, "error", `Missing required profile field: ${f.label}`);
  }
  for (const s of risk.signals) {
    issue(issues, `risk-${s.code}`, s.level === "blocked" ? "blocked" : s.level === "high" ? "error" : "warning", s.message);
  }
  if (score < minScore) {
    issue(issues, "low-match-score", opts.allowReviewBelowScore ? "warning" : "error", `Risk-adjusted match score ${score} is below threshold ${minScore}.`);
  }
  if (jd.missing.length > 8) {
    issue(issues, "many-keyword-gaps", "warning", `Many JD keywords are missing from the resume (${jd.missing.length}).`);
  }
  if (profile.jobPreferences?.excludedCompanies?.some((c) => c && job.company.toLowerCase().includes(c.toLowerCase()))) {
    issue(issues, "excluded-company", "blocked", "Company is excluded in candidate preferences.");
  }

  const blocked = issues.some((i) => i.severity === "blocked") || !risk.shouldApply;
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let decision: ReadinessDecision;
  if (blocked) decision = "blocked";
  else if (errorCount > (opts.maxMissingRequiredProfileFields ?? 0)) decision = opts.allowReviewBelowScore ? "review" : "skip";
  else if (score < minScore) decision = opts.allowReviewBelowScore ? "review" : "skip";
  else if (warningCount > 0 || risk.needsReview || score < 75) decision = "review";
  else decision = "apply";

  const confidence = clamp((score * 0.65) + (profileValidation.score * 0.25) - (warningCount * 5) - (errorCount * 15) - (blocked ? 100 : 0));
  const nextActions: string[] = [];

  if (profileValidation.missingRequired.length) {
    nextActions.push(`Complete profile: ${profileValidation.missingRequired.slice(0, 4).map((f) => f.label).join(", ")}`);
  }
  if (jd.missing.length) nextActions.push(`Consider adding relevant truthful keywords: ${jd.missing.slice(0, 8).join(", ")}`);
  if (risk.signals.length) nextActions.push(`Review job risk: ${risk.signals.slice(0, 3).map((s) => s.message).join("; ")}`);
  if (score < minScore) nextActions.push(`Skip or tailor resume before applying; score is ${score}/${minScore}.`);
  if (!nextActions.length) nextActions.push("Ready to apply. Review final form before submit.");

  return {
    decision,
    confidence,
    score,
    rawMatchScore: match.score,
    profileScore: profileValidation.score,
    match,
    risk,
    profile: profileValidation,
    matchedKeywords: jd.matched,
    missingKeywords: jd.missing,
    inferredKeywords: jd.inferred,
    issues,
    nextActions,
  };
}
