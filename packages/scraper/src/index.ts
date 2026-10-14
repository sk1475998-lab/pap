/**
 * @superjob/scraper — multi-source job discovery.
 *
 * Scrapes and aggregates job postings from multiple boards, implementing
 * the crew's JobSource interface so it drops into the Researcher agent.
 *
 * Sources:
 *   - Arbeitnow (free JSON API — remote/tech jobs)
 *   - RemoteOK (free JSON API — remote jobs)
 *   - Indeed (HTML parsing with JSON-LD fallback)
 *   - Greenhouse boards (company career pages via public API)
 *   - Lever boards (company career pages via public API)
 *
 * The aggregator runs all enabled boards in parallel, merges, and dedupes.
 */
export * from "./framework.js";
export * from "./aggregator.js";
export { ArbeitnowScraper } from "./boards/arbeitnow.js";
export { RemoteOkScraper } from "./boards/remoteok.js";
export { IndeedScraper } from "./boards/indeed.js";
export { GreenhouseScraper, LeverScraper } from "./boards/company.js";
export { createScraperSource } from "./crew-source.js";
