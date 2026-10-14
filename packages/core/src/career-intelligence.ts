import type { Application, ApplicationStage, Job, MatchResult, Profile } from "./types.js";
import { scoreMatch } from "./matcher.js";
import { analyzeJobDescription } from "./jd-analyzer.js";
import { assessJobRisk } from "./job-risk.js";
import { SalaryEngine } from "./salary-engine.js";

export type IntelligenceSignalKind =
  | "positive"
  | "warning"
  | "risk"
  | "opportunity"
  | "next_action";

export interface IntelligenceSignal {
  kind: IntelligenceSignalKind;
  label: string;
  scoreImpact: number;
  /** Null until calibrated against enough real outcomes. */
  confidence: number | null;
  evidence: string;
}

export interface OpportunityPrediction {
  matchScore: number;
  /** Heuristic scores are not calibrated probabilities; unavailable by default. */
  atsPassProbability: number | null;
  interviewProbability: number | null;
  recruiterResponseProbability: number | null;
  salarySuccessProbability: number | null;
  competitionLevel: "low" | "medium" | "high";
  stalePostingRisk: number;
  duplicateRisk: number;
  bestApplyWindow: "now" | "business_hours" | "wait_for_tailored_resume" | "skip";
}

export interface OpportunityRank {
  job: Job;
  overallScore: number;
  priority: "p0" | "p1" | "p2" | "skip";
  prediction: OpportunityPrediction;
  recommendedActions: string[];
  signals: IntelligenceSignal[];
  match: MatchResult;
}

export interface CareerMemoryEvent {
  id: string;
  type:
    | "application_saved"
    | "application_submitted"
    | "recruiter_response"
    | "interview"
    | "offer"
    | "rejection"
    | "manual_correction"
    | "preference";
  company?: string;
  title?: string;
  location?: string;
  skills?: string[];
  salary?: string;
  wording?: string;
  outcome?: ApplicationStage | "response" | "correction";
  ts: number;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface CareerMemory {
  version: 1;
  updatedAt: number;
  events: CareerMemoryEvent[];
  preferences: {
    companies: Record<string, number>;
    locations: Record<string, number>;
    skills: Record<string, number>;
    titles: Record<string, number>;
    wording: Record<string, number>;
  };
  outcomes: {
    applications: number;
    responses: number;
    interviews: number;
    offers: number;
    rejections: number;
  };
}

export interface IntelligenceDashboard {
  generatedAt: number;
  totals: Record<ApplicationStage | "total", number>;
  conversion: {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    rejectionRate: number;
  };
  averages: {
    matchScore: number;
    atsPassProbability: number | null;
    interviewProbability: number | null;
  };
  topCompanies: { company: string; count: number; score: number }[];
  topSkills: { skill: string; demand: number }[];
  recommendations: string[];
  funnel: { stage: ApplicationStage; count: number; percent: number }[];
}

const STAGES: ApplicationStage[] = ["saved", "applied", "screening", "interview", "offer", "rejected"];

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function norm(s = ""): string {
  return s.trim().toLowerCase();
}

function includesAny(text: string, words: string[]): boolean {
  const t = norm(text);
  return words.some((w) => t.includes(norm(w)));
}

function addSignal(signals: IntelligenceSignal[], signal: IntelligenceSignal): number {
  signals.push(signal);
  return signal.scoreImpact;
}

export function createCareerMemory(events: CareerMemoryEvent[] = []): CareerMemory {
  return foldCareerMemory({ version: 1, updatedAt: Date.now(), events: [], preferences: emptyPrefs(), outcomes: emptyOutcomes() }, events);
}

export function foldCareerMemory(memory: CareerMemory, events: CareerMemoryEvent[]): CareerMemory {
  const next: CareerMemory = {
    version: 1,
    updatedAt: Date.now(),
    events: [...memory.events],
    preferences: {
      companies: { ...memory.preferences.companies },
      locations: { ...memory.preferences.locations },
      skills: { ...memory.preferences.skills },
      titles: { ...memory.preferences.titles },
      wording: { ...memory.preferences.wording },
    },
    outcomes: { ...memory.outcomes },
  };

  for (const event of events) {
    next.events.push(event);
    const weight = event.weight ?? outcomeWeight(event);
    bump(next.preferences.companies, event.company, weight);
    bump(next.preferences.locations, event.location, weight);
    bump(next.preferences.titles, event.title, weight);
    for (const skill of event.skills ?? []) bump(next.preferences.skills, skill, weight);
    bump(next.preferences.wording, event.wording, Math.max(1, Math.round(weight / 2)));

    if (event.type === "application_submitted" || event.type === "application_saved") next.outcomes.applications += 1;
    if (event.type === "recruiter_response") next.outcomes.responses += 1;
    if (event.type === "interview") next.outcomes.interviews += 1;
    if (event.type === "offer") next.outcomes.offers += 1;
    if (event.type === "rejection") next.outcomes.rejections += 1;
  }
  // Keep memory bounded for browser storage and instant popup load.
  next.events = next.events.slice(-1000);
  return next;
}

export function careerMemoryFromApplications(applications: Application[]): CareerMemory {
  const events = applications.map((a): CareerMemoryEvent => ({
    id: `app:${a.id}`,
    type: a.stage === "saved" ? "application_saved" : "application_submitted",
    company: a.company,
    title: a.title,
    outcome: a.stage,
    ts: a.appliedAt ?? a.updatedAt ?? Date.now(),
    weight: stageWeight(a.stage),
    metadata: { matchScore: a.matchScore, url: a.url },
  }));
  return createCareerMemory(events);
}

export function rankOpportunity(profile: Profile, job: Job, opts: { applications?: Application[]; memory?: CareerMemory; now?: number } = {}): OpportunityRank {
  const resumeText = `${profile.masterResumeText ?? ""}
${profile.summary ?? ""}
${(profile.skills ?? []).join(" ")}`;
  const match = scoreMatch({ resumeText, jobDescription: job.description || `${job.title} ${job.company}`, profileSkills: profile.skills });
  const jd = analyzeJobDescription({ resumeText, jobDescription: job.description || `${job.title} ${job.company}`, profileSkills: profile.skills, companyName: job.company });
  const risk = assessJobRisk(job, profile);
  const freshness = scoreFreshness(job, opts.now);
  const salary = scoreSalaryFit(profile, job);
  const memory = opts.memory ?? careerMemoryFromApplications(opts.applications ?? []);
  const signals: IntelligenceSignal[] = [];

  let score = match.score;
  if (match.score >= 80) score += addSignal(signals, sig("positive", "Strong resume/JD alignment", 8, 90, `${match.matched.length} matched skills`));
  if (match.missing.length > 5) score += addSignal(signals, sig("warning", "Skill gaps detected", -6, 75, match.missing.slice(0, 5).join(", ")));

  const companyScore = memory.preferences.companies[norm(job.company)] ?? 0;
  const titleScore = memory.preferences.titles[norm(job.title)] ?? 0;
  const locationScore = memory.preferences.locations[norm(job.location)] ?? 0;
  const personalBoost = Math.min(12, companyScore + titleScore + locationScore);
  if (personalBoost > 0) score += addSignal(signals, sig("opportunity", "Personal preference fit", personalBoost, 80, "Matches your historical choices"));

  if (/\b(senior|staff|principal|lead)\b/i.test(`${job.title} ${job.description}`) && includesAny(profile.yearsOfExperience, ["0", "1"])) {
    score += addSignal(signals, sig("warning", "Seniority may be ambitious", -5, 60, "Job description suggests senior level"));
  }
  if (risk.scorePenalty > 45) score += addSignal(signals, sig("risk", "Posting risk flags", -Math.round(risk.scorePenalty / 8), 70, risk.signals.map((s) => s.message).slice(0, 2).join("; ")));
  if (freshness.status === "fresh") score += addSignal(signals, sig("positive", "Fresh posting", 6, 85, freshness.reason));
  if (freshness.status === "stale") score += addSignal(signals, sig("warning", "Stale posting", -10, 85, freshness.reason));
  if (salary.score >= 75) score += addSignal(signals, sig("positive", "Salary likely aligned", 5, 65, salary.reason));
  if (salary.score > 0 && salary.score < 45) score += addSignal(signals, sig("warning", "Salary may be below expectations", -5, 65, salary.reason));

  const duplicateRisk = duplicateProbability(job, opts.applications ?? []);
  if (duplicateRisk > 65) score += addSignal(signals, sig("risk", "Possible duplicate application", -18, 90, "Similar company/title/url already tracked"));

  // Scores from the local heuristic are not calibrated outcome probabilities.
  // Keep the prediction fields explicitly unavailable until trained calibration
  // data is available rather than presenting made-up percentages.
  const atsPassProbability = null;
  const interviewProbability = null;
  const recruiterResponseProbability = null;
  const salarySuccessProbability = null;
  const competitionLevel = inferCompetition(job, freshness.score, match.score);
  const stalePostingRisk = clamp(100 - freshness.score);
  const overallScore = clamp(score - stalePostingRisk * 0.08 - duplicateRisk * 0.12);
  const bestApplyWindow = duplicateRisk > 70 || overallScore < 35 ? "skip" : match.missing.length > 8 ? "wait_for_tailored_resume" : freshness.status === "fresh" ? "now" : "business_hours";
  const priority = overallScore >= 82 ? "p0" : overallScore >= 65 ? "p1" : overallScore >= 45 ? "p2" : "skip";

  const recommendedActions = recommendActions({ match, jd, riskScore: risk.scorePenalty, stalePostingRisk, duplicateRisk, salaryScore: salary.score, bestApplyWindow });

  return {
    job,
    overallScore,
    priority,
    prediction: {
      matchScore: match.score,
      atsPassProbability,
      interviewProbability,
      recruiterResponseProbability,
      salarySuccessProbability,
      competitionLevel,
      stalePostingRisk,
      duplicateRisk,
      bestApplyWindow,
    },
    recommendedActions,
    signals,
    match,
  };
}

export function rankOpportunities(profile: Profile, jobs: Job[], opts: { applications?: Application[]; memory?: CareerMemory; now?: number } = {}): OpportunityRank[] {
  const memo = opts.memory ?? careerMemoryFromApplications(opts.applications ?? []);
  return jobs.map((job) => rankOpportunity(profile, job, { ...opts, memory: memo })).sort((a, b) => b.overallScore - a.overallScore);
}

export function buildIntelligenceDashboard(applications: Application[], opts: { ranks?: OpportunityRank[]; memory?: CareerMemory; now?: number } = {}): IntelligenceDashboard {
  const totals = Object.fromEntries(STAGES.map((s) => [s, applications.filter((a) => a.stage === s).length])) as Record<ApplicationStage, number>;
  const total = applications.length;
  const applied = Math.max(1, totals.applied + totals.screening + totals.interview + totals.offer + totals.rejected);
  const ranks = opts.ranks ?? [];
  const memory = opts.memory ?? careerMemoryFromApplications(applications);
  const avgMatch = average(applications.map((a) => a.matchScore).filter(Boolean));
  const avgAts = averageNullable(ranks.map((r) => r.prediction.atsPassProbability));
  const avgInterview = averageNullable(ranks.map((r) => r.prediction.interviewProbability));

  const companyMap = new Map<string, { count: number; score: number }>();
  for (const app of applications) {
    const key = app.company || "Unknown";
    const cur = companyMap.get(key) ?? { count: 0, score: 0 };
    cur.count += 1;
    cur.score += app.matchScore || 0;
    companyMap.set(key, cur);
  }

  const recommendations: string[] = [];
  if (avgMatch && avgMatch < 65) recommendations.push("Raise average match score by tailoring resume bullets to the top missing JD keywords.");
  if (totals.interview === 0 && applied > 5) recommendations.push("Interview conversion is low: prioritize referrals and stronger opening summaries before more volume.");
  if (totals.offer === 0 && totals.interview > 2) recommendations.push("Add interview debrief notes and run salary/interview simulation before the next round.");
  if (ranks[0]?.priority === "p0") recommendations.push(`Apply now to ${ranks[0].job.company}: high-priority opportunity with ${ranks[0].overallScore}/100 score.`);
  if (recommendations.length === 0) recommendations.push("Pipeline is healthy. Keep applying to fresh high-match jobs and follow up every 5-7 business days.");

  return {
    generatedAt: opts.now ?? Date.now(),
    totals: { ...totals, total },
    conversion: {
      responseRate: pct(memory.outcomes.responses, applied),
      interviewRate: pct(totals.interview + totals.offer, applied),
      offerRate: pct(totals.offer, applied),
      rejectionRate: pct(totals.rejected, applied),
    },
    averages: {
      matchScore: clamp(avgMatch),
      atsPassProbability: avgAts === null ? null : clamp(avgAts),
      interviewProbability: avgInterview === null ? null : clamp(avgInterview),
    },
    topCompanies: [...companyMap.entries()].map(([company, v]) => ({ company, count: v.count, score: clamp(v.score / v.count) })).sort((a, b) => b.count - a.count || b.score - a.score).slice(0, 8),
    topSkills: Object.entries(memory.preferences.skills).map(([skill, demand]) => ({ skill, demand })).sort((a, b) => b.demand - a.demand).slice(0, 12),
    recommendations,
    funnel: STAGES.map((stage) => ({ stage, count: totals[stage], percent: pct(totals[stage], Math.max(1, total)) })),
  };
}

function emptyPrefs(): CareerMemory["preferences"] { return { companies: {}, locations: {}, skills: {}, titles: {}, wording: {} }; }
function emptyOutcomes(): CareerMemory["outcomes"] { return { applications: 0, responses: 0, interviews: 0, offers: 0, rejections: 0 }; }
function bump(map: Record<string, number>, key: string | undefined, n: number) { if (key?.trim()) map[norm(key)] = (map[norm(key)] ?? 0) + n; }
function stageWeight(stage: ApplicationStage): number { return ({ saved: 1, applied: 2, screening: 4, interview: 7, offer: 10, rejected: -2 } as Record<ApplicationStage, number>)[stage] ?? 1; }
function outcomeWeight(e: CareerMemoryEvent): number { return e.type === "offer" ? 10 : e.type === "interview" ? 7 : e.type === "recruiter_response" ? 5 : e.type === "rejection" ? -2 : 2; }
function sig(kind: IntelligenceSignalKind, label: string, scoreImpact: number, _confidence: number, evidence: string): IntelligenceSignal { return { kind, label, scoreImpact, confidence: null, evidence }; }
function duplicateProbability(job: Job, apps: Application[]): number {
  const url = norm(job.url).split("?")[0]; const company = norm(job.company); const title = norm(job.title);
  let risk = 0;
  for (const a of apps) {
    if (url && norm(a.url).split("?")[0] === url) risk = Math.max(risk, 95);
    if (company && title && norm(a.company) === company && similarity(norm(a.title), title) > 0.72) risk = Math.max(risk, 80);
  }
  return risk;
}
function similarity(a: string, b: string): number { const as = new Set(a.split(/\W+/).filter(Boolean)); const bs = new Set(b.split(/\W+/).filter(Boolean)); const inter = [...as].filter((x) => bs.has(x)).length; return inter / Math.max(1, Math.min(as.size, bs.size)); }
function historicalRate(memory: CareerMemory, key: "responses" | "interviews" | "offers"): number { return (memory.outcomes[key] ?? 0) / Math.max(1, memory.outcomes.applications); }
function inferCompetition(job: Job, freshnessScore: number, matchScore: number): "low" | "medium" | "high" { const text = norm(`${job.title} ${job.description}`); if (includesAny(text, ["intern", "graduate", "fresher", "remote"]) || freshnessScore < 35) return "high"; if (matchScore > 82 && freshnessScore > 70) return "low"; return "medium"; }
function recommendActions(ctx: { match: MatchResult; jd: ReturnType<typeof analyzeJobDescription>; riskScore: number; stalePostingRisk: number; duplicateRisk: number; salaryScore: number; bestApplyWindow: OpportunityPrediction["bestApplyWindow"] }): string[] {
  const actions: string[] = [];
  if (ctx.bestApplyWindow === "now") actions.push("Apply now while the posting is fresh.");
  if (ctx.bestApplyWindow === "business_hours") actions.push("Apply during recruiter business hours and schedule a follow-up reminder.");
  if (ctx.bestApplyWindow === "wait_for_tailored_resume") actions.push("Tailor resume first: missing keywords are likely to reduce ATS pass rate.");
  if (ctx.duplicateRisk > 70) actions.push("Skip or verify manually: this looks like a duplicate application.");
  if (ctx.match.missing.length) actions.push(`Add evidence for: ${ctx.match.missing.slice(0, 5).join(", ")}.`);
  if (ctx.salaryScore > 0 && ctx.salaryScore < 45) actions.push("Prepare a salary justification or deprioritize if compensation is firm.");
  if (ctx.riskScore > 45) actions.push("Review risk flags before submitting personal data.");
  return actions.slice(0, 6);
}

function scoreFreshness(job: Pick<Job, "postedAt" | "description">, now = Date.now()): { score: number; status: "fresh" | "normal" | "stale" | "unknown"; reason: string } {
  const text = `${job.postedAt ?? ""} ${job.description ?? ""}`.toLowerCase();
  if (/no longer accepting|expired|closed|filled/.test(text)) return { score: 0, status: "stale", reason: "Posting contains closed/expired wording." };
  if (!job.postedAt) return { score: 55, status: "unknown", reason: "No posting date available." };
  const parsed = Date.parse(job.postedAt);
  if (!Number.isFinite(parsed)) {
    if (/today|just posted|few hours/.test(text)) return { score: 95, status: "fresh", reason: "Posted very recently." };
    if (/30\+|month|months/.test(text)) return { score: 25, status: "stale", reason: "Posting appears older than a month." };
    return { score: 55, status: "unknown", reason: "Unparseable posting date." };
  }
  const days = Math.max(0, (now - parsed) / 86_400_000);
  if (days <= 3) return { score: 95, status: "fresh", reason: "Posted within 3 days." };
  if (days <= 14) return { score: 75, status: "normal", reason: "Posted within 2 weeks." };
  if (days <= 30) return { score: 48, status: "normal", reason: "Posted within 30 days." };
  return { score: 20, status: "stale", reason: "Posting is older than 30 days." };
}

function scoreSalaryFit(profile: Profile, job: Job): { score: number; reason: string } {
  const engine = new SalaryEngine();
  const jdSalary = engine.extractSalaryFromJD(`${job.salary ?? ""} ${job.description ?? ""}`);
  const expectedRaw = profile.expectedCTC || profile.salaryExpectation || profile.jobPreferences?.minSalary || "";
  const expected = Number(String(expectedRaw).replace(/[^0-9.]/g, ""));
  if (!jdSalary || !expected) return { score: 55, reason: "Not enough salary data to compare." };
  const max = jdSalary.max ?? jdSalary.min ?? 0;
  const min = jdSalary.min ?? max;
  if (!max) return { score: 55, reason: "Salary range is incomplete." };
  if (max >= expected) return { score: 90, reason: "Advertised range can meet expectation." };
  if (min >= expected * 0.8) return { score: 65, reason: "Salary may be negotiable but below target." };
  return { score: 35, reason: "Advertised salary appears below expectation." };
}

function average(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function averageNullable(xs: (number | null)[]): number | null {
  const available = xs.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length ? average(available) : null;
}
function pct(n: number, d: number): number { return clamp((n / Math.max(1, d)) * 100); }
