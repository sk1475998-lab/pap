/**
 * Jobs routes — live multi-source discovery, then deterministic scoring.
 *
 * EVERY FIELD SERVED FROM HERE IS SCRAPED OR COMPUTED, and anything that can be
 * neither is `null` with a reason attached. That is a reversal of what this file
 * used to do, and the list is worth keeping, because all of it shipped:
 *
 *   - Eleven hardcoded postings at real companies (Flipkart, Swiggy, Stripe,
 *     Supabase, Perplexity, Google …) were merged into live aggregator results
 *     with nothing to distinguish them. Their salaries were invented and their
 *     URLs do not resolve. A user could not tell them apart from a real posting;
 *     neither could autopilot, which would have opened a dead link and recorded
 *     an application against it.
 *   - `companyRating: 4.1 + Math.random() * 0.7` and
 *     `wlbScore: 3.8 + Math.random() * 0.9`, re-rolled per request, so a
 *     company's rating changed on every refresh. Both fields are gone: there is
 *     no employer-review data source wired up, so there is no honest number.
 *   - `postedDaysAgo: Math.floor(Math.random() * 18) + 1`, fed straight into a
 *     ghost-job detector that printed a confidence percentage about an age
 *     nobody knew. Age now comes from the board's own `postedAt` through core's
 *     `assessPostingAge`, and is `null` when the board publishes no date.
 *   - `ats = Math.min(98, Math.max(55, match - Math.floor(Math.random() * 8)))`,
 *     while core's real `analyzeATS` sat unused two packages away.
 *   - `match = 75` / `ats = 70` when there was no profile, and
 *     `catch { match = 78 }` when scoring threw. Both are now `null` with a
 *     machine-readable reason, so the UI asks for a résumé instead of inventing
 *     a fit the matcher never computed.
 *
 * What is left is one rule: scraped, computed, or null.
 */
import { Router } from "express";
import {
  analyzeATS,
  assessJobRisk,
  evaluateJobEligibility,
  readProfile,
  scoreMatch,
  type Job,
  type JobRiskLevel,
  type PostingFreshness,
  type Profile,
  earlyAdvantageFromPostingAge,
} from "@superjob/core";
import { discover, enabledBoards } from "../lib/discovery.js";
import { iconFor, tagsFor } from "../lib/job-presentation.js";
import { asyncRoute } from "../lib/tenant.js";

export const jobsRouter = Router();

/* ---------------------------------- scoring --------------------------------- */

/** Why a job carries no number. The UI turns this into one specific CTA. */
type MatchUnavailable = "no-profile";
type AtsUnavailable = "no-profile" | "no-resume-text";

/** An ATS parse looks for sections, contact details and bullets — it needs prose. */
const MIN_RESUME_CHARS_FOR_ATS = 200;

interface ScoringBasis {
  /** What to match against: the résumé if there is one, else the skills list. */
  resumeText: string;
  skills: string[];
  /** Enough résumé prose for `analyzeATS` to say anything meaningful. */
  hasResumeText: boolean;
  unavailable: MatchUnavailable | null;
}

/**
 * What this user can be scored against, decided once per request.
 *
 * A skills-only profile can be matched (keyword overlap is still real) but cannot
 * be ATS-analysed: running `analyzeATS` on `"React, TypeScript, Node.js"` reports
 * a low parse score for a document that does not exist, which the user would read
 * as a verdict on their actual résumé.
 */
function scoringBasis(profile: Profile | undefined): ScoringBasis {
  const resumeText = String(profile?.masterResumeText ?? "").trim();
  const skills = (profile?.skills ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!profile || (!resumeText && skills.length === 0)) {
    return { resumeText: "", skills: [], hasResumeText: false, unavailable: "no-profile" };
  }
  return {
    resumeText: resumeText || skills.join(", "),
    skills,
    hasResumeText: resumeText.length >= MIN_RESUME_CHARS_FOR_ATS,
    unavailable: null,
  };
}

/**
 * What to search for when the caller sends no query. Whatever this returns is
 * echoed back in the response so the UI can say "showing results for X" instead
 * of implying the user asked for it.
 */
function keywordsFrom(p: Record<string, unknown> | undefined): string {
  const asList = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean);
  const prefs = (p?.preferences ?? {}) as Record<string, unknown>;
  const roles = asList(p?.targetRoles).length ? asList(p?.targetRoles) : asList(prefs.roleTitles);
  if (roles.length) return roles.slice(0, 3).join(" ");
  const skills = asList(p?.skills);
  if (skills.length) return skills.slice(0, 3).join(" ");
  return "software engineer";
}

/* --------------------------------- response --------------------------------- */

export interface JobFeedItem extends Job {
  /** Decoration. See `iconFor`. */
  ico: string;
  tags: string[];
  /** Weighted keyword overlap with the résumé, 0–100, or null if unscoreable. */
  match: number | null;
  /** Core's ATS pass probability for this résumé against this JD, or null. */
  ats: number | null;
  matchUnavailable?: MatchUnavailable;
  atsUnavailable?: AtsUnavailable;
  /** Whole days since the board's own posted date. Null when it published none. */
  postedDaysAgo: number | null;
  freshness: PostingFreshness;
  freshnessReason: string;
  riskLevel: JobRiskLevel;
  /** Renderable risk messages from core — scam wording, closed posting, staleness. */
  riskSignals: string[];
  shouldApply: boolean;
  /** Card string: the real age, or an explicit admission there isn't one. */
  time: string;
  /** Standout Early Applicant Advantage (first2apply insight) */
  earlyAdvantage?: {
    isEarlyBird: boolean;
    /** Salience tier label (not a measured callback multiplier). */
    callbackMultiplier: string;
    salienceTier?: string;
    badgeText: string;
  } | null;
  /** Deterministic eligibility assessment */
  eligibility?: {
    isEligible: boolean;
    reasons: string[];
    warnings: string[];
    seniorityMatch: string;
  };
}

function toFeedItem(job: Job, profile: Profile | undefined, basis: ScoringBasis): JobFeedItem {
  const risk = assessJobRisk(job, profile);
  const jd = job.description?.trim() || job.title;

  let match: number | null = null;
  let ats: number | null = null;
  if (!basis.unavailable) {
    match = scoreMatch({
      resumeText: basis.resumeText,
      jobDescription: jd,
      profileSkills: basis.skills,
    }).score;
    // passProbability, not `score`: this number sits next to "ATS" in the UI and
    // the question the user is asking is whether the résumé gets through.
    if (basis.hasResumeText) ats = analyzeATS(basis.resumeText, jd).passProbability;
  }

  const days = risk.age.daysSincePosted;
  const adv = earlyAdvantageFromPostingAge(days);
  const earlyAdvantage: JobFeedItem["earlyAdvantage"] = adv
    ? {
        isEarlyBird: adv.isEarlyBird,
        callbackMultiplier: adv.salienceTier,
        salienceTier: adv.salienceTier,
        badgeText: adv.badgeText,
      }
    : null;

  let eligibility: JobFeedItem["eligibility"] = undefined;
  if (profile) {
    const elRes = evaluateJobEligibility(job, profile);
    eligibility = {
      isEligible: elRes.isEligible,
      reasons: elRes.reasons,
      warnings: elRes.warnings,
      seniorityMatch: elRes.seniorityMatch,
    };
  }

  return {
    ...job,
    ico: iconFor(job.company),
    tags: tagsFor(job),
    match,
    ats,
    ...(basis.unavailable ? { matchUnavailable: basis.unavailable } : {}),
    ...(ats === null ? { atsUnavailable: basis.unavailable ?? ("no-resume-text" as const) } : {}),
    postedDaysAgo: days,
    freshness: risk.age.freshness,
    freshnessReason: risk.age.reason,
    riskLevel: risk.level,
    riskSignals: risk.signals.map((s) => s.message),
    shouldApply: risk.shouldApply,
    time: days === null ? "Date not published" : days <= 0 ? "Today" : `${days}d ago`,
    earlyAdvantage,
    eligibility,
  };
}

// GET /api/jobs/search?q=&loc=&limit=&source=
jobsRouter.get(
  "/search",
  asyncRoute(async (req, res) => {
    const { q, loc, limit = "40", source } = req.query as Record<string, string>;
    const profile = await readProfile<Profile>();
    const p = profile as Record<string, unknown> | undefined;

    const keywords = q?.trim() || keywordsFrom(p);
    const location =
      loc?.trim() || String(p?.preferredLocation ?? p?.location ?? "").trim() || "Remote";
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));

    const {
      jobs,
      cached,
      boardsFailed,
      partialFailure,
      boardStatuses,
    } = await discover(keywords, location, maxLimit);
    const basis = scoringBasis(profile);
    const items = jobs.map((job) => toFeedItem(job, profile, basis));

    const filtered =
      source && source !== "all"
        ? items.filter((j) => j.source?.toLowerCase() === source.toLowerCase())
        : items;

    // Fit first — prioritized by shouldApply, then verified eligibility, then match score.
    filtered.sort(
      (a, b) =>
        Number(b.shouldApply) - Number(a.shouldApply) ||
        Number(b.eligibility?.isEligible ?? true) - Number(a.eligibility?.isEligible ?? true) ||
        (b.match ?? -1) - (a.match ?? -1),
    );

    const discoveryMessage = boardsFailed
      ? "No job board responded. That is a discovery outage, not an empty market — retry shortly."
      : partialFailure
        ? filtered.length === 0
          ? "Some job boards did not respond. No results were returned, so this is not a confirmed empty search — retry shortly."
          : "Some job boards did not respond. These results may be incomplete."
        : items.length === 0
          ? `No live postings matched "${keywords}" in ${location}. Try broader keywords or a wider location.`
          : undefined;
    const discoveryUnavailable = boardsFailed || (partialFailure && filtered.length === 0);

    res.status(discoveryUnavailable ? 503 : 200).json({
      ok: true,
      data: filtered.slice(0, maxLimit),
      total: filtered.length,
      keywords,
      location,
      // The boards actually queried, not a menu of ten logos we never call. The
      // old list advertised linkedin/naukri/glassdoor/google filters that could
      // only ever match the hardcoded seed rows, so seven of them were dead
      // controls in the dashboard the moment those rows were removed.
      sources: ["all", ...enabledBoards()],
      discovery: {
        cached,
        boardsFailed,
        partialFailure,
        boardStatuses,
        message: discoveryMessage,
      },
      scoring: basis.unavailable
        ? {
            available: false,
            reason: basis.unavailable,
            message: "Add your résumé text or skills to your profile to score these postings against you.",
          }
        : {
            available: true,
            ats: basis.hasResumeText,
            message: basis.hasResumeText
              ? undefined
              : "Add your résumé text for a real ATS read — a skills list has no sections or contact block to parse.",
          },
    });
  }),
);
