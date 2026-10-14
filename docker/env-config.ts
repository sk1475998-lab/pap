/**
 * Shared Docker / API search configuration from environment variables.
 */
import { parseEnvBool } from "@superjob/core";

export interface DockerSearchConfig {
  keywords: string;
  location: string;
  limit: number;
  minScore: number;
  maxApplications: number;
  dryRun: boolean;
  scrape: boolean;
  boards: string[];
  companyBoards?: string[];
}

export function searchConfigFromEnv(overrides: Partial<DockerSearchConfig> = {}): DockerSearchConfig {
  const boards = (process.env.SEARCH_BOARDS ?? "arbeitnow,remoteok")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const companyRaw = process.env.SEARCH_COMPANY_BOARDS?.trim();
  const companyBoards = companyRaw
    ? companyRaw.split(",").map((b) => b.trim()).filter(Boolean)
    : undefined;

  return {
    keywords: overrides.keywords ?? process.env.SEARCH_KEYWORDS ?? "software engineer",
    location: overrides.location ?? process.env.SEARCH_LOCATION ?? "Remote",
    limit: overrides.limit ?? Number(process.env.SEARCH_LIMIT ?? 25),
    minScore: overrides.minScore ?? Number(process.env.SEARCH_MIN_SCORE ?? 50),
    maxApplications: overrides.maxApplications ?? Number(process.env.SEARCH_MAX_APPS ?? 5),
    dryRun: overrides.dryRun ?? parseEnvBool(process.env.DRY_RUN, true),
    scrape: overrides.scrape ?? parseEnvBool(process.env.SEARCH_SCRAPE, true),
    boards: overrides.boards ?? boards,
    companyBoards: overrides.companyBoards ?? companyBoards,
  };
}

export async function createJobSourceFromEnv(scrape = searchConfigFromEnv().scrape) {
  const cfg = searchConfigFromEnv();
  if (scrape) {
    const { createScraperSource } = await import("../packages/scraper/src/index.js");
    return createScraperSource({
      boards: cfg.boards,
      companyBoards: cfg.companyBoards,
      delayMs: 400,
    });
  }
  const { UrlListSource } = await import("../packages/crew/src/index.js");
  return new UrlListSource([]);
}
