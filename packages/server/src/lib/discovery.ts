/**
 * Board discovery + its short-lived cache, in one place.
 *
 * This lived inside `routes/jobs.ts` and was needed a second time by
 * `routes/company.ts` (open roles at one employer). Copying it would have given us
 * two caches with two TTLs that evict independently — and, worse, two chances for
 * one of them to start caching something tenant-specific. It is here so there is
 * exactly one.
 *
 * WHAT MAY BE CACHED: scraped public postings, keyed by the query. Nothing scored
 * and nothing read from a profile ever enters this map, so it holds nothing
 * tenant-specific and cannot serve one user another user's data. Scoring re-runs
 * per request against the caller's own profile. That property is the entire reason
 * the cache is safe to keep process-wide, so do not be tempted to cache scored
 * items "while we're here".
 */
import { defaultAggregator, type BoardDiscoveryStatus } from "@superjob/scraper";
import type { Job } from "@superjob/core";

export const DISCOVERY_TTL_MS = 90_000;
export const DISCOVERY_CACHE_MAX = 40;

const discoveryCache = new Map<string, {
  at: number;
  jobs: Job[];
  boardStatuses: BoardDiscoveryStatus[];
}>();

export interface Discovery {
  jobs: Job[];
  cached: boolean;
  /** Every board threw or timed out. Distinct from "the market has nothing". */
  boardsFailed: boolean;
  partialFailure: boolean;
  boardStatuses: BoardDiscoveryStatus[];
}

export async function discover(
  keywords: string,
  location: string,
  limit: number,
): Promise<Discovery> {
  const key = `${keywords.toLowerCase()}|${location.toLowerCase()}|${limit}`;
  const hit = discoveryCache.get(key);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) {
    const failedCount = hit.boardStatuses.filter((board) => board.status === "failed").length;
    return {
      jobs: hit.jobs,
      cached: true,
      boardsFailed: hit.boardStatuses.length === 0 || failedCount === hit.boardStatuses.length,
      partialFailure: failedCount > 0 && failedCount < hit.boardStatuses.length,
      boardStatuses: hit.boardStatuses,
    };
  }

  try {
    const result = await defaultAggregator.discoverWithStatus(keywords, location, limit);
    const failedCount = result.boardStatuses.filter((board) => board.status === "failed").length;
    const boardsFailed = result.boardStatuses.length === 0 || failedCount === result.boardStatuses.length;
    const partialFailure = failedCount > 0 && failedCount < result.boardStatuses.length;

    // A total outage is never cached as a successful empty search. Nor is an
    // empty partial result: failed sources could have contained matching jobs.
    if (!boardsFailed && !(partialFailure && result.jobs.length === 0)) {
      if (discoveryCache.size >= DISCOVERY_CACHE_MAX) {
        const oldest = [...discoveryCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) discoveryCache.delete(oldest[0]);
      }
      discoveryCache.set(key, {
        at: Date.now(),
        jobs: result.jobs,
        boardStatuses: result.boardStatuses,
      });
    }
    return {
      jobs: result.jobs,
      cached: false,
      boardsFailed,
      partialFailure,
      boardStatuses: result.boardStatuses,
    };
  } catch {
    // Nothing is cached on failure, and the caller is told which failure it was.
    // An outage rendered as "No jobs found" sends the user off to fix a search
    // that was never the problem.
    return {
      jobs: [],
      cached: false,
      boardsFailed: true,
      partialFailure: false,
      boardStatuses: enabledBoards().map((board) => ({ board, status: "failed" })),
    };
  }
}

/** The boards actually queried — not a menu of logos we never call. */
export function enabledBoards(): string[] {
  return defaultAggregator.enabledBoards;
}
