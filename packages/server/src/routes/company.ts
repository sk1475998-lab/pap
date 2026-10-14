/**
 * `/api/company/:name` — what we actually know about an employer.
 *
 * WHAT THIS FILE USED TO BE, because it was the worst thing in the repo.
 *
 * A 170-line `COMPANY_DB` literal held five hand-written companies (Flipkart,
 * Razorpay, Swiggy, Google, Stripe) with invented review counts, invented CEO
 * approval percentages, invented salary bands, and invented employee reviews
 * carrying invented dates — `{ role: "SDE-2", rating: 5, pros: "Huge impact,
 * generous bonuses", date: "2 weeks ago" }`. Nobody wrote that review.
 *
 * For every OTHER company on earth it synthesised the same fields from the letters
 * of the company's name:
 *
 *     const hash = rawName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
 *     rating: 3.9 + (hash % 10) * 0.09,
 *     reviewsCount: 800 + (hash % 2000),
 *     ceoApproval: 80 + (hash % 18),
 *     interviewDifficulty: hash % 3 === 0 ? "Hard" : …
 *
 * The dashboard rendered the result under the heading "🏢 Company Culture &
 * Reviews (External Intel)" — attributing a character-code sum to a named data
 * provider. A user deciding whether to take an interview read "⭐ 4.4 · 89% CEO
 * approval · 2,140 reviews" about a company nobody had any data on, and the "cons"
 * list said negative things about real named employers on no evidence at all.
 *
 * There is no employer-review data source wired into this product. So this route
 * now serves only things that are true, from two real sources:
 *
 *   1. LIVE BOARD RESULTS for that employer — the same scraper the job feed uses,
 *      through the same cache. Real open postings, real URLs, real posted dates,
 *      real risk assessment from core.
 *   2. THE USER'S OWN TRACKER — their applications to this company, their stages,
 *      their response and interview counts, whether they have been ghosted.
 *
 * plus a stack ranked from the text of those real postings. Employer reviews are
 * reported as `null` with a machine-readable reason, so the UI can say "no
 * employer-review source is connected" instead of printing a hash.
 */
import { Router } from "express";
import {
  assessJobRisk,
  readApplications,
  readProfile,
  type JobRiskLevel,
  type PostingFreshness,
  type Profile,
} from "@superjob/core";
import { discover } from "../lib/discovery.js";
import { iconFor, rankSkills } from "../lib/job-presentation.js";
import { asyncRoute, type AuthedRequest } from "../lib/tenant.js";
import { isGhosted, type TrackedApplication } from "./apps.js";

export const companyRouter = Router();

/** How many board results to sift for postings belonging to this employer. */
const DISCOVERY_LIMIT = 25;

export interface CompanyPosting {
  id: string;
  title: string;
  location: string;
  url: string;
  source: string;
  salary: string;
  postedDaysAgo: number | null;
  freshness: PostingFreshness;
  freshnessReason: string;
  riskLevel: JobRiskLevel;
  riskSignals: string[];
  shouldApply: boolean;
}

export interface CompanyHistoryRow {
  id: string;
  title: string;
  stage: string;
  appliedAt?: number;
  updatedAt?: number;
  ghosted: boolean;
  url: string;
}

export interface CompanyIntel {
  /** Spelled as the postings (or the user's own rows) spell it. */
  name: string;
  /** Decoration. Deterministic on the name; carries no data. */
  ico: string;
  openPostings: {
    /** Null when every board failed — distinct from "this employer has none". */
    total: number | null;
    boardsFailed: boolean;
    cached: boolean;
    list: CompanyPosting[];
  };
  /** Skills ranked by how many of this employer's real postings ask for them. */
  stack: { skill: string; postings: number }[];
  yourHistory: {
    available: boolean;
    unavailableReason?: "sign-in-required";
    total: number;
    applied: number;
    interviewing: number;
    offers: number;
    rejected: number;
    ghosted: number;
    firstAppliedAt: number | null;
    lastActivityAt: number | null;
    rows: CompanyHistoryRow[];
  };
  /**
   * Employer ratings, CEO approval, work-life-balance scores, written reviews.
   * Always null: no review source is connected. See the file header for what used
   * to be here.
   */
  reviews: null;
  reviewsUnavailable: "no-employer-review-source";
  reviewsMessage: string;
}

/** Loose match: "Acme" should find "Acme Corp" and "acme, inc." and vice versa. */
function sameCompany(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\b(inc|llc|ltd|limited|pvt|private|corp|corporation|technologies|technology|labs|india)\b/g, "").replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

companyRouter.get(
  "/:name",
  asyncRoute(async (req, res) => {
    const requested = String(req.params.name ?? "").trim();
    if (!requested) {
      return res.status(400).json({ ok: false, error: "Company name is required." });
    }

    // The employer's own postings, from the boards. Location is deliberately blank:
    // the question is "what is open at this company", not "near me".
    const { jobs, cached, boardsFailed } = await discover(requested, "", DISCOVERY_LIMIT);
    const mine = jobs.filter((j) => sameCompany(j.company, requested));

    const user = (req as AuthedRequest).user;
    // optionalAuth leaves anonymous requests outside tenant context; core would
    // otherwise fall back to the process-wide base store. Never read user data
    // from that fallback for public company reference requests.
    const apps = user ? await readApplications<TrackedApplication>() : [];
    const history = apps.filter((a) => sameCompany(String(a.company ?? ""), requested));
    // Passed to the risk assessment so an employer on the user's own excluded list
    // is flagged here too, not only in the job feed.
    const profile = user ? await readProfile<Profile>() : undefined;

    // Prefer the employer's own spelling from a real posting over the URL fragment
    // the client happened to send.
    const name = mine[0]?.company || history[0]?.company || requested;
    const now = Date.now();

    const list: CompanyPosting[] = mine.map((job) => {
      const risk = assessJobRisk(job, profile);
      return {
        id: job.id,
        title: job.title,
        location: job.location,
        url: job.url,
        source: job.source,
        salary: job.salary,
        postedDaysAgo: risk.age.daysSincePosted,
        freshness: risk.age.freshness,
        freshnessReason: risk.age.reason,
        riskLevel: risk.level,
        riskSignals: risk.signals.map((s) => s.message),
        shouldApply: risk.shouldApply,
      };
    });

    const rows: CompanyHistoryRow[] = history.map((a) => ({
      id: a.id,
      title: a.title ?? "",
      stage: a.stage,
      appliedAt: a.appliedAt,
      updatedAt: a.updatedAt,
      ghosted: isGhosted(a, now),
      url: a.url ?? "",
    }));
    const stamps = rows.map((r) => r.appliedAt ?? 0).filter((n) => n > 0);
    const touched = rows.map((r) => r.updatedAt ?? r.appliedAt ?? 0).filter((n) => n > 0);

    const data: CompanyIntel = {
      name,
      ico: iconFor(name),
      openPostings: {
        total: boardsFailed ? null : list.length,
        boardsFailed,
        cached,
        list,
      },
      stack: rankSkills(mine),
      yourHistory: {
        available: Boolean(user),
        ...(!user ? { unavailableReason: "sign-in-required" as const } : {}),
        total: rows.length,
        applied: rows.filter((r) => r.stage === "applied").length,
        interviewing: rows.filter((r) => r.stage === "screening" || r.stage === "interview").length,
        offers: rows.filter((r) => r.stage === "offer").length,
        rejected: rows.filter((r) => r.stage === "rejected").length,
        ghosted: rows.filter((r) => r.ghosted).length,
        firstAppliedAt: stamps.length ? Math.min(...stamps) : null,
        lastActivityAt: touched.length ? Math.max(...touched) : null,
        rows,
      },
      reviews: null,
      reviewsUnavailable: "no-employer-review-source",
      reviewsMessage:
        "No employer-review source is connected, so this product shows no rating, CEO-approval or work-life-balance score for any company.",
    };

    res.json({ ok: true, data });
  }),
);
