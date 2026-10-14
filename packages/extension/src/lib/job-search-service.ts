/**
 * Job Search Service — Enterprise autonomous job discovery.
 *
 * Runs from the background/service-worker to avoid CORS in the popup.
 * Combines:
 *   - public feeds and ATS APIs (Arbeitnow, RemoteOK, Greenhouse, Lever, Indeed)
 *   - direct deep links to major Indian & global job boards (Naukri,
 *     LinkedIn, Apna, Instahyre, Cutshort, Hirist, foundit/Monster, Glassdoor,
 *     Wellfound) with query-builder helpers
 *   - Neural smart matching against the local profile (no backend call)
 *
 * Security: all results are scored locally; no profile data leaves the browser.
 */
import {
  recommendJobs,
  jobRecommendationCacheKey,
  type RecommendationBatch,
  buildCandidateDiscoveryProfile,
  evaluateSingleJobDiscovery,
  type JobListingContext,
} from "@superjob/core";
import type { Job, Profile } from "@superjob/core";
import type { BoardDiscoveryStatus } from "@superjob/scraper";
import { nanoid } from "nanoid";


/* ------------------------------------------------------------------ */
/* Search filters                                                      */
/* ------------------------------------------------------------------ */

export type JobBoardId =
  | "arbeitnow"
  | "remoteok"
  | "indeed"
  | "linkedin"
  | "naukri"
  | "apna"
  | "instahyre"
  | "cutshort"
  | "hirist"
  | "foundit"
  | "glassdoor"
  | "wellfound"
  | "greenhouse"
  | "lever";

export interface AdvancedSearchFilters {
  keywords: string;
  location: string;
  experienceYears?: number;
  remote?: "any" | "remote" | "hybrid" | "onsite";
  minSalaryLpa?: number; // INR LPA for India, USD k for global
  salaryCurrency?: "INR" | "USD" | "GBP" | "EUR";
  jobType?: "any" | "fulltime" | "internship" | "contract" | "parttime";
  postedWithinDays?: number;
  minMatchScore?: number;
  excludeCompanies?: string[];
  includeCompanies?: string[];
  sources?: JobBoardId[];
  limit?: number;
  indiaOnly?: boolean;
}

export interface SearchResultJob extends Job {
  matchScore: number | null;
  decision: "apply_now" | "tailor_first" | "review" | "save" | "skip";
  reasons: string[];
  quickApplySupported: boolean; // true if SJA's ATS config covers this URL
  deepLinkUrl: string;
}

export interface SearchResultSet {
  query: AdvancedSearchFilters;
  scrapedJobs: SearchResultJob[];
  deepLinks: { id: JobBoardId; name: string; url: string; countHint?: number }[];
  total: number;
  generatedAt: number;
  recommendation?: RecommendationBatch;
  discovery: {
    boardStatuses: BoardDiscoveryStatus[];
    message?: string;
  };
}

/* ------------------------------------------------------------------ */
/* Board catalog — Multi-board routing                                */
/* ------------------------------------------------------------------ */

interface BoardDescriptor {
  id: JobBoardId;
  name: string;
  region: "global" | "india";
  scraper?: boolean; // true when we have an in-browser scraper/API
  ats?: boolean;    // true when it's a careers ATS (Greenhouse/Lever)
  buildUrl?: (q: AdvancedSearchFilters) => string;
  quickApplyHosts: string[];
}

const JOB_BOARDS: BoardDescriptor[] = [
  {
    id: "linkedin", name: "LinkedIn", region: "global",
    quickApplyHosts: ["linkedin.com", "www.linkedin.com"],
    buildUrl: (q) => {
      const k = encodeURIComponent(q.keywords || "software engineer");
      const loc = encodeURIComponent(q.location || "India");
      const fJt = q.jobType === "internship" ? "1" : q.jobType === "contract" ? "2" : q.jobType === "parttime" ? "3" : "";
      const fWt = q.remote === "remote" ? "2" : q.remote === "onsite" ? "1" : q.remote === "hybrid" ? "3" : "";
      const params = new URLSearchParams({ keywords: k, location: loc });
      if (fJt) params.set("f_JT", fJt);
      if (fWt) params.set("f_WT", fWt);
      if (q.postedWithinDays && q.postedWithinDays <= 1) params.set("f_TPR", "r86400");
      else if (q.postedWithinDays && q.postedWithinDays <= 7) params.set("f_TPR", "r604800");
      else if (q.postedWithinDays && q.postedWithinDays <= 30) params.set("f_TPR", "r2592000");
      return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    },
  },
  {
    id: "naukri", name: "Naukri.com", region: "india",
    quickApplyHosts: ["naukri.com", "www.naukri.com"],
    buildUrl: (q) => {
      const k = encodeURIComponent(q.keywords || "software engineer");
      const loc = encodeURIComponent(q.location || "bangalore");
      let url = `https://www.naukri.com/${k.replace(/%20/g,"-")}-jobs-in-${loc.replace(/%20/g,"-")}`;
      const params = new URLSearchParams();
      if (q.postedWithinDays) params.set("jobAge", String(q.postedWithinDays));
      if (q.remote === "remote") params.set("wfhType", "2");
      if (q.experienceYears != null) {
        params.set("experience", `${Math.max(0,q.experienceYears)}`);
      }
      if (q.minSalaryLpa) params.set("ctcFilter", String(Math.round(q.minSalaryLpa)));
      const qs = params.toString();
      return qs ? `${url}?${qs}` : url;
    },
  },
  {
    id: "indeed", name: "Indeed", region: "global", scraper: true,
    quickApplyHosts: ["indeed.com", "in.indeed.com"],
    buildUrl: (q) => {
      const params = new URLSearchParams({ q: q.keywords || "software engineer", l: q.location || "India" });
      if (q.jobType === "internship") params.set("jt", "internship");
      else if (q.jobType === "contract") params.set("jt", "contract");
      else if (q.jobType === "parttime") params.set("jt", "parttime");
      if (q.remote === "remote") params.set("sc", "0kf:attr(DSQF7);");
      if (q.postedWithinDays && q.postedWithinDays <= 3) params.set("fromage", "3");
      else if (q.postedWithinDays && q.postedWithinDays <= 7) params.set("fromage", "7");
      else if (q.postedWithinDays && q.postedWithinDays <= 30) params.set("fromage", "30");
      return `https://in.indeed.com/jobs?${params.toString()}`;
    },
  },
  {
    id: "apna", name: "Apna", region: "india",
    quickApplyHosts: ["apna.co", "apna.in"],
    buildUrl: (q) => `https://apna.co/job?query=${encodeURIComponent(q.keywords || "software engineer")}&city=${encodeURIComponent(q.location || "Bangalore")}`,
  },
  {
    id: "instahyre", name: "Instahyre", region: "india",
    quickApplyHosts: ["instahyre.com"],
    buildUrl: (q) => `https://www.instahyre.com/job-results/?search=${encodeURIComponent(q.keywords || "software engineer")}&location=${encodeURIComponent(q.location || "Bangalore")}`,
  },
  {
    id: "cutshort", name: "Cutshort", region: "india",
    quickApplyHosts: ["cutshort.io"],
    buildUrl: (q) => `https://cutshort.io/jobs?search=${encodeURIComponent(q.keywords || "software engineer")}&location=${encodeURIComponent(q.location || "India")}`,
  },
  {
    id: "hirist", name: "Hirist", region: "india",
    quickApplyHosts: ["hirist.com"],
    buildUrl: (q) => `https://www.hirist.tech/search?query=${encodeURIComponent(q.keywords || "software engineer")}&location=${encodeURIComponent(q.location || "Bangalore")}`,
  },
  {
    id: "foundit", name: "foundit (Monster)", region: "india",
    quickApplyHosts: ["foundit.in", "monsterindia.com"],
    buildUrl: (q) => `https://www.foundit.in/srp/results?query=${encodeURIComponent(q.keywords || "software engineer")}&locations=${encodeURIComponent(q.location || "bangalore")}`,
  },
  {
    id: "glassdoor", name: "Glassdoor", region: "global",
    quickApplyHosts: ["glassdoor.co.in", "glassdoor.com"],
    buildUrl: (q) => `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${encodeURIComponent(q.keywords)}&locT=C&locKeyword=${encodeURIComponent(q.location || "India")}`,
  },
  {
    id: "wellfound", name: "Wellfound (AngelList)", region: "global",
    quickApplyHosts: ["wellfound.com", "angel.co"],
    buildUrl: (q) => `https://wellfound.com/role/l/${encodeURIComponent(q.keywords || "software-engineer")}/${encodeURIComponent((q.location||"india").toLowerCase().replace(/\s+/g,"-"))}`,
  },
  {
    id: "arbeitnow", name: "Arbeitnow (free API)", region: "global", scraper: true,
    quickApplyHosts: ["arbeitnow.com"],
    buildUrl: (q) => `https://www.arbeitnow.com/jobs?search=${encodeURIComponent(q.keywords || "")}`,
  },
  {
    id: "remoteok", name: "RemoteOK (free API)", region: "global", scraper: true,
    quickApplyHosts: ["remoteok.com"],
    buildUrl: (q) => `https://remoteok.com/remote-${encodeURIComponent((q.keywords||"dev").toLowerCase().split(/\s+/).join("-"))}-jobs`,
  },
  {
    id: "greenhouse", name: "Greenhouse (4 configured company boards)", region: "global", scraper: true, ats: true,
    quickApplyHosts: ["boards.greenhouse.io", "job-boards.greenhouse.io"],
  },
  {
    id: "lever", name: "Lever (3 configured company boards)", region: "global", scraper: true, ats: true,
    quickApplyHosts: ["jobs.lever.co"],
  },
];

export function listJobBoards(region?: "global" | "india"): BoardDescriptor[] {
  return JOB_BOARDS.filter((b) => !region || b.region === region);
}

/* ------------------------------------------------------------------ */
/* Quick-apply host check — uses bundled SJA ATS permissions          */
/* ------------------------------------------------------------------ */

const QUICK_APPLY_HOSTS = new Set<string>([
  ...JOB_BOARDS.flatMap((b) => b.quickApplyHosts),
  "boards.greenhouse.io","job-boards.greenhouse.io","boards.eu.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com","ashbyhq.com",
  "*.myworkdayjobs.com","*.myworkdaysite.com","wd5.myworkdaytasks.com",
  "*.icims.com","*.icims.eu",
  "*.jobvite.com",
  "*.bamboohr.com","*.bamboohr.co.uk",
  "*.breezy.hr",
  "*.workable.com",
  "*.applytojob.com",
  "*.taleo.net",
  "*.adp.com","recruiting.adp.com",
  "*.paylocity.com",
  "*.oraclecloud.com","*.hcmcloud.oraclecloud.com",
  "*.eightfold.ai",
  "*.smartrecruiters.com",
  "*.successfactors.eu","*.sap.com",
  "*.brassring.com",
  "*.freshteam.com",
  "*.zohorecruit.com",
  "*.ceipal.com",
  "*.harri.com",
  "*.manatal.com",
  "*.pinpointhq.com",
  "*.jobadder.com",
  "*.newtonsoftware.com",
  "*.recruiterbox.com",
  "meta.wd1.myworkdayjobs.com",
]);

export function doesSjaSupportQuickApply(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return [...QUICK_APPLY_HOSTS].some((h) => {
      if (h.startsWith("*.")) return host.endsWith(h.slice(2)) || host === h.slice(2);
      return host === h || host.endsWith("." + h);
    });
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/* Scraper run — pulls JSON boards, scores them locally                */
/* ------------------------------------------------------------------ */

interface ScraperSearchResult {
  jobs: Job[];
  boardStatuses: BoardDiscoveryStatus[];
  startupError?: string;
}

const SCRAPER_BOARD_IDS: readonly JobBoardId[] = [
  "arbeitnow",
  "remoteok",
  "indeed",
  "greenhouse",
  "lever",
];

async function runScrapers(
  query: AdvancedSearchFilters,
  enabled: JobBoardId[],
): Promise<ScraperSearchResult> {
  const activeBoards = enabled.filter((board) => SCRAPER_BOARD_IDS.includes(board));
  if (activeBoards.length === 0) return { jobs: [], boardStatuses: [] };

  try {
    // Dynamic import keeps extension bundle small; works in background MV3.
    const { createDefaultAggregator } = await import("@superjob/scraper");
    const agg = createDefaultAggregator();
    const limit = Math.min(query.limit ?? 30, 60);
    const discovered = await agg.discoverWithStatus(query.keywords, query.location || "remote", limit, {
      enabledBoards: activeBoards,
      sourceTimeoutMs: 30_000,
    });
    return { jobs: discovered.jobs, boardStatuses: discovered.boardStatuses };
  } catch (e) {
    console.warn("[SJA:search] scraper unavailable (offline/CORS?)", e);
    const message = e instanceof Error ? e.message : String(e);
    return {
      jobs: [],
      boardStatuses: activeBoards.map((board) => ({ board, status: "failed" })),
      startupError: message.slice(0, 180),
    };
  }
}

function postingAgeText(postedAt?: string): string | undefined {
  if (!postedAt) return undefined;
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return undefined;

  const elapsedHours = (Date.now() - timestamp) / 3_600_000;
  if (elapsedHours < 0) return undefined;
  if (elapsedHours < 24) return `${Math.max(1, Math.ceil(elapsedHours))} hours ago`;
  if (elapsedHours < 24 * 7) return `${Math.ceil(elapsedHours / 24)} days ago`;
  return `${Math.ceil(elapsedHours / (24 * 7))} weeks ago`;
}

function applyLocalFilters(jobs: Job[], q: AdvancedSearchFilters): Job[] {
  const exclude = (q.excludeCompanies ?? []).map((c) => c.toLowerCase());
  const include = (q.includeCompanies ?? []).map((c) => c.toLowerCase());
  const days = q.postedWithinDays ? q.postedWithinDays * 86400000 : 0;
  return jobs.filter((j) => {
    if (exclude.length && exclude.some((c) => (j.company || "").toLowerCase().includes(c))) return false;
    if (include.length && !include.some((c) => (j.company || "").toLowerCase().includes(c))) return false;
    if (q.remote === "remote" && !j.remote && !/(remote|wfh|work.from.home)/i.test(j.location + " " + j.description)) return false;
    if (q.remote === "onsite" && (j.remote || /remote/i.test(j.location))) return false;
    if (days && j.postedAt) {
      try {
        const t = new Date(j.postedAt).getTime();
        if (Date.now() - t > days) return false;
      } catch { /* ignore */ }
    }
    return true;
  });
}

function toSearchResult(job: Job): SearchResultJob {
  return {
    ...job,
    id: job.id || nanoid(),
    matchScore: null,
    decision: "review",
    reasons: [],
    quickApplySupported: doesSjaSupportQuickApply(job.url),
    deepLinkUrl: job.url,
  };
}

/* ------------------------------------------------------------------ */
/* Public entry point — used by background message handler             */
/* ------------------------------------------------------------------ */

export async function runAdvancedSearch(
  profile: Profile | null,
  query: AdvancedSearchFilters
): Promise<SearchResultSet> {
  const effectiveQuery: AdvancedSearchFilters = {
    ...query,
    keywords: (query.keywords || "").trim(),
    location: (query.location || (query.indiaOnly ? "India" : "Remote")).trim(),
    limit: Math.min(query.limit ?? 25, 60),
    sources: query.sources && query.sources.length ? query.sources : ["arbeitnow", "remoteok"],
  };

  const scraperBoards = (effectiveQuery.sources ?? []).filter((board) =>
    SCRAPER_BOARD_IDS.includes(board)
  );
  const scraperResult = await runScrapers(effectiveQuery, scraperBoards);
  const filtered = applyLocalFilters(scraperResult.jobs, effectiveQuery);

  let scored: SearchResultJob[] = filtered.map(toSearchResult);

  if (profile) {
    const candidateCtx = buildCandidateDiscoveryProfile({
      fullName: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Candidate",
      rawSkills: profile.skills || [],
      yearsExperience: Number.parseFloat(profile.yearsOfExperience) || 0,
      graduationYear: Number.parseInt(profile.education?.[0]?.graduationYear ?? "", 10) || undefined,
      recentTitles: profile.experience?.map((e) => e.title).filter(Boolean) || [],
      workAuthorization: profile.workAuthorization ? (profile.workAuthorization as any) : "other",
      preferredWorkModality: (profile.jobPreferences?.remotePreference as any) || "any",
      preferredLocations: profile.jobPreferences?.locations || [],
    });

    scored = scored.map((s) => {
      const jobCtx: JobListingContext = {
        id: s.id,
        title: s.title,
        company: s.company,
        location: s.location,
        description: s.description,
        url: s.url,
        postedAgoText: postingAgeText(s.postedAt),
      };
      const rec = evaluateSingleJobDiscovery(candidateCtx, jobCtx);
      const reasons: string[] = [];
      if (rec.badges.length) reasons.push(rec.badges.join(" | "));
      reasons.push(rec.headline);
      if (rec.skillOverlap.matchedSkills.length) {
        reasons.push(`Skills: ${rec.skillOverlap.matchedSkills.map((m) => m.name).slice(0, 4).join(", ")}`);
      }
      if (rec.skillOverlap.missingSkills.length) {
        reasons.push(`Gaps: ${rec.skillOverlap.missingSkills.map((m) => m.name).slice(0, 3).join(", ")}`);
      }

      let decision: SearchResultJob["decision"] = "review";
      if (!rec.bilateralFit.knockoutPassed) {
        decision = "skip";
      } else if (rec.compositeScore >= 80) {
        decision = "apply_now";
      } else if (rec.compositeScore >= 50) {
        decision = "tailor_first";
      }

      return {
        ...s,
        matchScore: rec.compositeScore,
        decision,
        reasons,
      };
    });

    // Honor the "minimum match score" search control
    if (effectiveQuery.minMatchScore && effectiveQuery.minMatchScore > 0) {
      scored = scored.filter((s) => (s.matchScore ?? -1) >= effectiveQuery.minMatchScore!);
    }
    scored.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
  }


  // Build deep links for every enabled board (Federated multi-portal search)
  const desiredBoards = (effectiveQuery.sources && effectiveQuery.sources.length
    ? JOB_BOARDS.filter((b) => effectiveQuery.sources!.includes(b.id))
    : JOB_BOARDS);
  const deepLinks = desiredBoards.flatMap((b) => b.buildUrl ? [{
    id: b.id, name: b.name, url: b.buildUrl(effectiveQuery),
  }] : []);

  const failedBoards = scraperResult.boardStatuses
    .filter((board) => board.status === "failed")
    .map((board) => board.board);
  const discoveryMessage = scraperResult.startupError
    ? `Live search could not start: ${scraperResult.startupError}`
    : scraperResult.boardStatuses.length === 0
      ? "No live API sources were selected. Use the board links to search on those sites."
      : failedBoards.length === scraperResult.boardStatuses.length
        ? "All selected live job sources failed. This is a source outage, not confirmation that no matching jobs exist."
        : failedBoards.length > 0
          ? "Some live job sources failed; these results may be incomplete."
          : !profile && scored.length > 0
            ? "Create or complete your profile to get personalized fit recommendations. These postings are currently unscored."
            : scored.length === 0
              ? "Live sources responded, but no postings met the selected search and match filters."
              : undefined;

  return {
    query: effectiveQuery,
    scrapedJobs: scored,
    deepLinks,
    total: scored.length,
    generatedAt: Date.now(),
    discovery: {
      boardStatuses: scraperResult.boardStatuses,
      ...(discoveryMessage ? { message: discoveryMessage } : {}),
    },
  };
}

/** Quick-apply helper — opens a job URL in a new tab so SJA's autopilot can
 *  engage (the content script sees the ATS selectors from ats-config-chunks). */
export async function openQuickApplyTab(url: string): Promise<number | undefined> {
  const tab = await chrome.tabs.create({ url, active: true });
  return tab.id;
}
