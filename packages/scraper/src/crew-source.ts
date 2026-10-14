/**
 * Crew integration — wraps the aggregator as a @superjob/crew JobSource.
 *
 * This is the glue that connects job discovery to the multi-agent pipeline.
 * The Researcher agent calls `source.discover()` and gets real job listings.
 *
 * Usage in a crew:
 *   import { createScraperSource } from "@superjob/scraper";
 *   const source = createScraperSource({
 *     boards: ["arbeitnow", "remoteok", "indeed"],
 *     companyBoards: ["airbnb", "stripe"],
 *   });
 *   const crew = createJobSearchCrew(source);
 */
import type { Job } from "@superjob/core";
import type { JobSource } from "./framework.js";
import { JobAggregator, type AggregatorOptions } from "./aggregator.js";
import { ArbeitnowScraper } from "./boards/arbeitnow.js";
import { RemoteOkScraper } from "./boards/remoteok.js";
import { IndeedScraper } from "./boards/indeed.js";
import { GreenhouseScraper } from "./boards/company.js";
import { LeverScraper } from "./boards/company.js";

const ALL_BOARDS: Record<string, typeof ArbeitnowScraper> = {
  arbeitnow: ArbeitnowScraper,
  remoteok: RemoteOkScraper,
  indeed: IndeedScraper,
  greenhouse: GreenhouseScraper,
  lever: LeverScraper,
};

export interface ScraperSourceOptions extends AggregatorOptions {
  /** which board IDs to enable (default: ["arbeitnow","remoteok"]) */
  boards?: string[];
  /** company board slugs for Greenhouse/Lever */
  companyBoards?: string[];
  /** delay between requests (ms) */
  delayMs?: number;
}

/** Build a JobSource backed by live scraping. */
export function createScraperSource(opts: ScraperSourceOptions = {}): JobSource {
  const enabledBoards = opts.boards ?? ["arbeitnow", "remoteok"];
  const agg = new JobAggregator();

  for (const boardId of enabledBoards) {
    const board = ALL_BOARDS[boardId];
    if (board) {
      // for Greenhouse/Lever we pass companyBoards through the params
      if (boardId === "greenhouse" || boardId === "lever") {
        if (opts.companyBoards && opts.companyBoards.length > 0) {
          agg.use(board);
        }
      } else {
        agg.use(board);
      }
    }
  }

  return {
    async discover(keywords: string, location: string, limit: number): Promise<Job[]> {
      return agg.discover(keywords, location, limit, {
        enabledBoards,
        companyBoards: opts.companyBoards,
        delayMs: opts.delayMs,
      });
    },
  };
}
