/**
 * Job quality / scam / freshness heuristics.
 * Used before spending time or risking reputation on an application.
 */
import type { Job, Profile } from "./types.js";

export type JobRiskLevel = "low" | "medium" | "high" | "blocked";

export interface JobRiskSignal {
  code: string;
  level: JobRiskLevel;
  message: string;
}

export interface JobRiskAssessment {
  level: JobRiskLevel;
  scorePenalty: number;
  shouldApply: boolean;
  needsReview: boolean;
  signals: JobRiskSignal[];
  /** How old the posting is, from the board's own date. Never invented. */
  age: PostingAge;
}

/* ------------------------------- posting age ------------------------------- */

export type PostingFreshness = "fresh" | "stale" | "likely-ghost" | "unknown";

export interface PostingAge {
  /** Whole days since the board's published date. `null` when there is no date. */
  daysSincePosted: number | null;
  freshness: PostingFreshness;
  /** One renderable sentence that cites the real age, or says there isn't one. */
  reason: string;
}

const DAY_MS = 86_400_000;
/** Age bands. The boundaries are a heuristic; the age they are applied to is not. */
export const STALE_AFTER_DAYS = 30;
export const GHOST_AFTER_DAYS = 60;

/**
 * How old a posting is — the honest version.
 *
 * `"unknown"` is a first-class answer and the important one. Not every board
 * publishes a date, and the server route that used to render this badge filled
 * the hole with `Math.floor(Math.random() * 18) + 1`, then fed that number to a
 * ghost-job detector and printed a confidence percentage about it. A UI showing
 * "🟢 Active (4d)" for a posting whose age nobody knows is worse than a UI
 * showing nothing, because the user acts on it.
 */
export function assessPostingAge(postedAt?: string, now: number = Date.now()): PostingAge {
  const parsed = postedAt ? Date.parse(postedAt) : NaN;
  if (!Number.isFinite(parsed)) {
    return {
      daysSincePosted: null,
      freshness: "unknown",
      reason: "This board did not publish a posting date, so the age is unknown.",
    };
  }
  const days = Math.floor((now - parsed) / DAY_MS);
  if (days < 0) {
    // A future date is bad source data. Calling it "0 days — fresh!" would be
    // manufacturing freshness out of a parsing artefact.
    return {
      daysSincePosted: null,
      freshness: "unknown",
      reason: "The posting date from this board is in the future and cannot be trusted.",
    };
  }
  if (days >= GHOST_AFTER_DAYS) {
    return {
      daysSincePosted: days,
      freshness: "likely-ghost",
      reason: `Open for ${days} days — often an evergreen or ghost posting rather than a role being filled.`,
    };
  }
  if (days >= STALE_AFTER_DAYS) {
    return {
      daysSincePosted: days,
      freshness: "stale",
      reason: `Open for ${days} days — confirm the role is still live before investing in a tailored application.`,
    };
  }
  return {
    daysSincePosted: days,
    freshness: "fresh",
    reason: days <= 1 ? "Posted within the last day." : `Posted ${days} days ago.`,
  };
}

const CLOSED_RE = /\b(no longer accepting|position has been filled|job is closed|posting has expired|no longer available|not accepting applications|application deadline has passed)\b/i;
const SCAM_RE = /\b(w-?4|bank account|wire transfer|crypto|telegram|whatsapp only|pay.*training fee|registration fee|security deposit|gift card|government id|passport scan|ssn|social security)\b/i;
const LOW_QUALITY_RE = /\b(urgent hiring|work from home.*earn|no interview|easy money|unlimited income|daily payout)\b/i;
const UNPAID_RE = /\b(unpaid|volunteer only|equity only|commission only)\b/i;

function push(signals: JobRiskSignal[], code: string, level: JobRiskLevel, message: string) {
  signals.push({ code, level, message });
}

export function assessJobRisk(job: Pick<Job, "title" | "company" | "description" | "url" | "location" | "postedAt">, profile?: Partial<Profile>): JobRiskAssessment {
  const text = `${job.title} ${job.company} ${job.location} ${job.description} ${job.url}`;
  const signals: JobRiskSignal[] = [];

  if (!job.description || job.description.trim().length < 80) {
    push(signals, "thin-description", "medium", "Job description is too thin to verify fit.");
  }
  if (CLOSED_RE.test(text)) {
    push(signals, "closed-job", "blocked", "Posting appears closed or expired.");
  }
  if (SCAM_RE.test(text)) {
    push(signals, "scam-sensitive-data", "blocked", "Posting asks for suspicious payment, ID, bank, or off-platform data.");
  }
  if (LOW_QUALITY_RE.test(text)) {
    push(signals, "low-quality-copy", "high", "Posting contains high-spam/low-quality wording.");
  }
  if (UNPAID_RE.test(text)) {
    push(signals, "unpaid-or-commission", "high", "Posting may be unpaid, equity-only, or commission-only.");
  }

  const excluded = profile?.jobPreferences?.excludedCompanies ?? [];
  if (excluded.some((c) => c && job.company.toLowerCase().includes(c.toLowerCase()))) {
    push(signals, "excluded-company", "blocked", "Company is on the candidate's excluded-company list.");
  }

  if (/remote/i.test(`${job.location} ${job.description}`) && /\b(us only|u\.s\. only|united states only|must reside in|only candidates in)\b/i.test(text)) {
    push(signals, "remote-location-restricted", "medium", "Remote role appears geographically restricted.");
  }

  // `postedAt` was in this signature from the start and was never read, so the
  // one risk signal every job seeker checks first — is this posting still real? —
  // was missing from the assessment that gates autopilot.
  const age = assessPostingAge(job.postedAt);
  if (age.freshness === "likely-ghost") push(signals, "likely-ghost", "high", age.reason);
  else if (age.freshness === "stale") push(signals, "stale-posting", "medium", age.reason);

  const rank: Record<JobRiskLevel, number> = { low: 0, medium: 1, high: 2, blocked: 3 };
  const max = signals.reduce<JobRiskLevel>((acc, s) => (rank[s.level] > rank[acc] ? s.level : acc), "low");
  const scorePenalty = signals.reduce((sum, s) => sum + (s.level === "medium" ? 5 : s.level === "high" ? 15 : s.level === "blocked" ? 100 : 0), 0);
  return {
    level: max,
    scorePenalty,
    shouldApply: max !== "blocked",
    needsReview: max === "medium" || max === "high",
    signals,
    age,
  };
}

export function adjustedMatchScore(score: number, risk: JobRiskAssessment): number {
  return Math.max(0, Math.min(100, Math.round(score - risk.scorePenalty)));
}
