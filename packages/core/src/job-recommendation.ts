import type { Application, Job, Profile } from "./types.js";
import { rankOpportunity, type OpportunityRank } from "./career-intelligence.js";
import { analyzeIndiaOpportunity, type IndiaOpportunityInsight } from "./india-intelligence.js";
import { analyzeATS, type AtsAnalysis } from "./ats.js";
import { assessJobRisk } from "./job-risk.js";

export type RecommendationDecision = "apply_now" | "tailor_first" | "save" | "skip" | "review";
export type RecommendationReasonKind = "positive" | "warning" | "risk" | "action";

export interface JobRecommendationReason {
  kind: RecommendationReasonKind;
  label: string;
  detail: string;
  impact: number;
}

export interface RecommendedJob {
  job: Job;
  score: number;
  decision: RecommendationDecision;
  priority: "top" | "high" | "medium" | "low" | "skip";
  reasons: JobRecommendationReason[];
  actions: string[];
  ats: Pick<AtsAnalysis, "score" | "passProbability" | "requiredScore" | "parseScore" | "missingRequired" | "workday">;
  india: Pick<IndiaOpportunityInsight, "indiaScore" | "ctc" | "notice" | "trust" | "board" | "followUp">;
  opportunity: Pick<OpportunityRank, "overallScore" | "priority" | "prediction" | "recommendedActions">;
  cacheKey: string;
  computedAt: number;
}

export interface RecommendationBatch {
  generatedAt: number;
  total: number;
  top: RecommendedJob[];
  skipped: RecommendedJob[];
  summary: string;
  filters: {
    minScore: number;
    includeSkipped: boolean;
  };
}

export interface RecommendationOptions {
  applications?: Application[];
  minScore?: number;
  includeSkipped?: boolean;
  now?: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function hashText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function jobRecommendationCacheKey(job: Pick<Job, "url" | "title" | "company" | "description">): string {
  const stableUrl = (job.url || "").split("?")[0].toLowerCase();
  return [stableUrl, job.company?.toLowerCase() ?? "", job.title?.toLowerCase() ?? "", hashText(job.description ?? "")].join("|");
}

export function recommendJob(profile: Profile, job: Job, opts: RecommendationOptions = {}): RecommendedJob {
  const applications = opts.applications ?? [];
  const resumeText = `${profile.masterResumeText ?? ""}\n${profile.summary ?? ""}\n${(profile.skills ?? []).join(" ")}`;
  const jdText = job.description || `${job.title} ${job.company} ${job.location}`;
  const opportunity = rankOpportunity(profile, job, { applications, now: opts.now });
  const india = analyzeIndiaOpportunity(profile, job, applications);
  const ats = analyzeATS(resumeText, jdText);
  const risk = assessJobRisk(job, profile);
  const reasons: JobRecommendationReason[] = [];

  const duplicate = applications.some((a) => (a.url && job.url && a.url.split("?")[0] === job.url.split("?")[0]) || (a.company.toLowerCase() === job.company.toLowerCase() && a.title.toLowerCase() === job.title.toLowerCase()));

  let score =
    opportunity.overallScore * 0.28 +
    ats.passProbability * 0.22 +
    india.indiaScore * 0.2 +
    india.trust.score * 0.1 +
    ats.requiredScore * 0.1 +
    (india.ctc.fit === "above_expectation" ? 8 : india.ctc.fit === "negotiable" ? 4 : india.ctc.fit === "below_expectation" ? -10 : 0) +
    (india.notice.fit === "excellent" ? 6 : india.notice.fit === "good" ? 3 : india.notice.fit === "risky" ? -5 : india.notice.fit === "blocked" ? -12 : 0);

  if (duplicate) score -= 25;
  if (risk.level === "blocked") score -= 50;
  if (risk.level === "high") score -= 18;
  if (ats.missingRequired.length > 8) score -= 8;
  score = clamp(score);

  if (opportunity.overallScore >= 80) reasons.push({ kind: "positive", label: "Strong opportunity", detail: `Opportunity score ${opportunity.overallScore}/100.`, impact: 12 });
  if (ats.passProbability >= 75) reasons.push({ kind: "positive", label: "High ATS readiness", detail: `Enterprise ATS pass estimate ${ats.passProbability}/100.`, impact: 12 });
  else reasons.push({ kind: "warning", label: "ATS needs work", detail: `Missing required: ${ats.missingRequired.slice(0, 5).join(", ") || "improve parseability"}.`, impact: -10 });
  if (india.ctc.fit === "above_expectation") reasons.push({ kind: "positive", label: "CTC aligned", detail: india.ctc.explanation, impact: 8 });
  if (india.ctc.fit === "below_expectation") reasons.push({ kind: "warning", label: "CTC below expectation", detail: india.ctc.explanation, impact: -10 });
  if (india.notice.fit === "excellent" || india.notice.fit === "good") reasons.push({ kind: "positive", label: "Notice period fit", detail: india.notice.explanation, impact: 6 });
  if (india.notice.fit === "blocked" || india.notice.fit === "risky") reasons.push({ kind: "warning", label: "Notice period risk", detail: india.notice.explanation, impact: -8 });
  if (india.trust.warnings.length) reasons.push({ kind: "risk", label: "Trust warnings", detail: india.trust.warnings.slice(0, 3).join("; "), impact: -12 });
  if (duplicate) reasons.push({ kind: "risk", label: "Duplicate", detail: "Similar application is already tracked.", impact: -25 });

  const actions = buildActions(score, ats, india, opportunity, duplicate, risk.level === "blocked");
  const decision: RecommendationDecision = risk.level === "blocked" || duplicate || score < 40
    ? "skip"
    : ats.passProbability < 65 || ats.missingRequired.length > 5
      ? "tailor_first"
      : score >= 78
        ? "apply_now"
        : score >= 58
          ? "review"
          : "save";
  const priority: RecommendedJob["priority"] = decision === "skip" ? "skip" : score >= 85 ? "top" : score >= 72 ? "high" : score >= 55 ? "medium" : "low";

  return {
    job,
    score,
    decision,
    priority,
    reasons: reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 8),
    actions,
    ats: {
      score: ats.score,
      passProbability: ats.passProbability,
      requiredScore: ats.requiredScore,
      parseScore: ats.parseScore,
      missingRequired: ats.missingRequired,
      workday: ats.workday,
    },
    india: {
      indiaScore: india.indiaScore,
      ctc: india.ctc,
      notice: india.notice,
      trust: india.trust,
      board: india.board,
      followUp: india.followUp,
    },
    opportunity: {
      overallScore: opportunity.overallScore,
      priority: opportunity.priority,
      prediction: opportunity.prediction,
      recommendedActions: opportunity.recommendedActions,
    },
    cacheKey: jobRecommendationCacheKey(job),
    computedAt: opts.now ?? Date.now(),
  };
}

export function recommendJobs(profile: Profile, jobs: Job[], opts: RecommendationOptions = {}): RecommendationBatch {
  const minScore = opts.minScore ?? 45;
  const all = jobs.map((job) => recommendJob(profile, job, opts)).sort((a, b) => b.score - a.score);
  const top = all.filter((r) => r.score >= minScore && r.decision !== "skip");
  const skipped = all.filter((r) => r.score < minScore || r.decision === "skip");
  const selected = opts.includeSkipped ? all : top;
  const best = selected[0];
  return {
    generatedAt: opts.now ?? Date.now(),
    total: jobs.length,
    top: selected,
    skipped,
    summary: best
      ? `Best recommendation: ${best.job.title || "role"} at ${best.job.company || "company"} (${best.score}/100).`
      : "No recommended jobs yet. Open a job page or search results to score opportunities.",
    filters: { minScore, includeSkipped: Boolean(opts.includeSkipped) },
  };
}

function buildActions( score: number, ats: AtsAnalysis, india: IndiaOpportunityInsight, opportunity: OpportunityRank, duplicate: boolean, blocked: boolean): string[] {
  if (blocked) return ["Skip: blocked by trust/risk checks.", "Verify company legitimacy before sharing personal data."];
  if (duplicate) return ["Skip or verify: similar application already exists."];
  const actions: string[] = [];
  if (score >= 78 && ats.passProbability >= 70) actions.push("Apply now — this is a high-priority opportunity.");
  if (ats.missingRequired.length) actions.push(`Tailor resume for: ${ats.missingRequired.slice(0, 5).join(", ")}.`);
  if (india.ctc.recommendedAskLpa) actions.push(`Use CTC ask around ${india.ctc.recommendedAskLpa} LPA if recruiter asks.`);
  if (india.notice.fit === "risky" || india.notice.fit === "blocked") actions.push("Clarify notice period/buyout before applying.");
  if (india.trust.warnings.length) actions.push("Review fraud/privacy warnings before sharing data.");
  actions.push(...opportunity.recommendedActions.slice(0, 2));
  if (!actions.length) actions.push("Save and compare with fresher/high-ATS jobs.");
  return [...new Set(actions)].slice(0, 6);
}
