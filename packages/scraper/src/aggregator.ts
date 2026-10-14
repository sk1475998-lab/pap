/**
 * Aggregator — runs multiple board scrapers in parallel and merges results.
 *
 * This is the main entry point for job discovery. It implements the crew's
 * JobSource interface so it drops straight into the Researcher agent.
 *
 * Usage:
 *   const agg = new JobAggregator();
 *   agg.use(ArbeitnowScraper);
 *   agg.use(RemoteOkScraper);
 *   const jobs = await agg.discover("python engineer", "Remote", 50);
 *
 * Or use the default aggregator with all boards enabled:
 *   const jobs = await defaultAggregator.discover("python engineer", "Remote", 50);
 */
import type { Job } from "@superjob/core";
import type { JobBoardScraper, ScrapeParams } from "./framework.js";
import { dedupeJobs } from "./framework.js";

export interface AggregatorOptions extends Partial<ScrapeParams> {
  /** which board IDs to enable (default: all) */
  enabledBoards?: string[];
  /** per-board limit multiplier (each board gets limit * this many results) */
  perBoardMultiplier?: number;
  /** company board names for Greenhouse/Lever (e.g. ["airbnb","stripe"]) */
  companyBoards?: string[];
  /** Maximum time to wait for an individual board before continuing. */
  sourceTimeoutMs?: number;
}

export interface BoardDiscoveryStatus {
  board: string;
  status: "succeeded" | "failed";
}

export interface AggregatedDiscovery {
  jobs: Job[];
  boardStatuses: BoardDiscoveryStatus[];
}

export class JobAggregator implements JobBoardScraper {
  readonly id = "aggregator";
  readonly name = "Aggregator";
  private boards: JobBoardScraper[] = [];

  use(scraper: JobBoardScraper): this {
    this.boards.push(scraper);
    return this;
  }

  get enabledBoards(): string[] {
    return this.boards.map((b) => b.id);
  }

  async discover(
    keywords: string,
    location: string,
    limit: number,
    opts: AggregatorOptions = {}
  ): Promise<Job[]> {
    return (await this.discoverWithStatus(keywords, location, limit, opts)).jobs;
  }

  async discoverWithStatus(
    keywords: string,
    location: string,
    limit: number,
    opts: AggregatorOptions = {}
  ): Promise<AggregatedDiscovery> {
    const enabled = opts.enabledBoards;
    const activeBoards = enabled
      ? this.boards.filter((b) => enabled.includes(b.id))
      : this.boards;

    if (activeBoards.length === 0) return { jobs: [], boardStatuses: [] };

    // each board gets a bit more than its fair share so dedup doesn't shrink
    // us below the requested limit
    const multiplier = opts.perBoardMultiplier ?? 1.5;
    const perBoardLimit = Math.ceil((limit / activeBoards.length) * multiplier);

    const params: ScrapeParams = {
      keywords,
      location,
      limit: perBoardLimit,
      delayMs: opts.delayMs ?? 500,
      proxyUrl: opts.proxyUrl,
      companyBoards: opts.companyBoards,
    };
    const sourceTimeoutMs = Math.max(1, opts.sourceTimeoutMs ?? 30_000);

    // Keep provider failures distinct from a successful search that found nothing.
    const results = await Promise.allSettled(
      activeBoards.map(async (board) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Job source exceeded ${sourceTimeoutMs}ms deadline`));
          }, sourceTimeoutMs);
        });
        try {
          return await Promise.race([
            board.discover(keywords, location, perBoardLimit, {
              ...params,
              signal: controller.signal,
            }),
            timedOut,
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      })
    );

    const allJobs: Job[] = [];
    const boardStatuses: BoardDiscoveryStatus[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const board = activeBoards[index];
      if (!result || !board) continue;
      if (result.status === "fulfilled") {
        allJobs.push(...result.value.map((job) => ({ ...job, source: job.source || board.id })));
        boardStatuses.push({ board: board.id, status: "succeeded" });
      } else {
        boardStatuses.push({ board: board.id, status: "failed" });
      }
    }

    const deduped = dedupeJobs(allJobs);
    return { jobs: deduped.slice(0, limit), boardStatuses };
  }
}

/* ------------------------------------------------------------------ */
/* Default aggregator with all boards enabled                          */
/* ------------------------------------------------------------------ */

import { ArbeitnowScraper } from "./boards/arbeitnow.js";
import { RemoteOkScraper } from "./boards/remoteok.js";
import { GreenhouseScraper, LeverScraper } from "./boards/company.js";
import { IndeedScraper } from "./boards/indeed.js";

export function createDefaultAggregator(): JobAggregator {
  return new JobAggregator()
    .use(ArbeitnowScraper)
    .use(RemoteOkScraper)
    .use(GreenhouseScraper)
    .use(LeverScraper)
    .use(IndeedScraper);
}

/** Pre-built aggregator instance (all boards). */
export const defaultAggregator = createDefaultAggregator();
