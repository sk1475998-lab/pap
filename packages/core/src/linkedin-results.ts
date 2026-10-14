/**
 * LinkedIn job-search results — versioned layout strategy + no-results
 * detection.
 *
 * LICENSE / ATTRIBUTION:
 * TypeScript adaptation of the results-list layout strategy in
 * `apps/backend/supabase/functions/_shared/parsers/linkedin.ts` (function
 * `parseLinkedInJobs`, the versioned `jobsList` probing: v1 legacy
 * `.jobs-search__results-list`, v2 logged-in `li[data-occludable-job-id]` /
 * `.scaffold-layout__list`, v3 new feed modules `data-view-name=...`, v4 AI
 * search `componentkey=SearchResultsMainContent`) and its no-results selectors
 * from the MIT-licensed repository "first2apply" (beastx-ro), Copyright (c)
 * beastx-ro contributors (MIT License), used under that license (notice
 * preserved in THIRD_PARTY_NOTICES.md). Changes for SJA: exposed as a pure
 * selector catalog + a version-picking helper that takes DOM presence flags
 * (instead of a DOMParser dependency), plus result-count/date normalization
 * helpers inspired by the same parser.
 */

/** Selectors that indicate the results list is empty / no matching jobs. */
export const LINKEDIN_NO_RESULTS_SELECTORS: readonly string[] = [
  ".no-results",
  ".jobs-search-no-results-banner",
  ".jobs-semantic-search__no-results",
  "svg#empty-room-small",
];

/** Versioned results-list container + card selector strategies. */
export interface LinkedinResultsStrategy {
  version: number;
  /** Short human label for logging/diagnostics. */
  label: string;
  /** Container selector whose presence indicates this layout. */
  container: string;
  /** Selector for individual job result items inside the container. */
  card: string;
}

export const LINKEDIN_RESULTS_STRATEGIES: readonly LinkedinResultsStrategy[] = [
  {
    version: 1,
    label: "legacy-search-results",
    container: ".jobs-search__results-list",
    card: "li",
  },
  {
    version: 2,
    label: "logged-in-list",
    container: "ul li[data-occludable-job-id]",
    card: "li",
  },
  {
    version: 3,
    label: "feed-module",
    container:
      'div[data-view-name="jobs-home-infinite-jymbii-jobs-feed-module"], ' +
      'div[data-view-name="jobs-home-top-jymbii-jobs-feed-module"]',
    card: 'div[data-view-name="job-card"]',
  },
  {
    version: 4,
    label: "ai-search",
    container: 'div[componentkey="SearchResultsMainContent"]',
    card: "div[data-view-tracking-scope]",
  },
];

/** Convenience alias for the classic pre-login and logged-in list selectors. */
export function linkedInResultsContainerSelectors(): string[] {
  return [
    ".jobs-search-results-list",
    ".jobs-search__results-list",
    ".scaffold-layout__list-container",
    LINKEDIN_RESULTS_STRATEGIES[1].container,
  ];
}

export interface ResultsDomFlags {
  legacyList: boolean;
  loggedInList: boolean;
  feedModule: boolean;
  aiSearch: boolean;
}

/**
 * Pick the results strategy version to use given which layout DOM structures
 * are present. Returns the first matching strategy (1→4) or 0 when none is
 * detected. Pure + unit-testable.
 */
export function pickLinkedInResultsVersion(flags: ResultsDomFlags): number {
  if (flags.legacyList) return 1;
  if (flags.loggedInList) return 2;
  if (flags.feedModule) return 3;
  if (flags.aiSearch) return 4;
  return 0;
}

/** True when any of the known no-results selectors would be present. */
export function isNoResultsFlag(flags: {
  noResultsPresent: boolean;
}): boolean {
  return flags.noResultsPresent;
}

export interface LinkedinListMeta {
  /** Parsed item count when the list is present (else 0). */
  count: number;
  /** True when a results list was actually found (vs no-results page). */
  listFound: boolean;
  /** Which layout version produced this reading (0 = none). */
  version: number;
}

/**
 * Pure summarizer for the flags a DOM scan produces — the Playwright adapter
 * calls it after probing selectors, tests call it directly.
 */
export function summarizeLinkedInResults(
  flags: ResultsDomFlags & { noResultsPresent: boolean; cardCount: number }
): LinkedinListMeta {
  if (flags.noResultsPresent) {
    return { count: 0, listFound: false, version: 0 };
  }
  const version = pickLinkedInResultsVersion(flags);
  return { count: version > 0 ? flags.cardCount : 0, listFound: version > 0, version };
}

/** "2 weeks ago", "30+ days ago", "Just now" → best-effort epoch ms (0 unknown). */
export function parseLinkedInRelativeDate(text: string, now: number = Date.now()): number {
  const t = text.toLowerCase();
  const day = 86_400_000;
  const m = t.match(/(\d+)\s*\+?\s*(hour|day|week|month)s?\s+ago/);
  if (!m) {
    if (/just now|moments? ago/.test(t)) return now;
    if (/yesterday/.test(t)) return now - day;
    return 0;
  }
  const n = Number(m[1]);
  const unit = m[2];
  const mult =
    unit === "hour" ? 3_600_000 : unit === "day" ? day : unit === "week" ? 7 * day : 30 * day;
  return now - n * mult;
}

/** Best-effort epoch ms for absolute "Posted on 2026-08-12"-style values. */
export function parseLinkedInAbsoluteDate(text: string): number {
  const m = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return 0;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d)).getTime();
}
