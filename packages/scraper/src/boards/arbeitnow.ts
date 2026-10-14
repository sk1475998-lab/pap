/**
 * Arbeitnow scraper — free public JSON API (no auth, no scraping).
 *
 * Arbeitnow aggregates remote/tech jobs from multiple sources and exposes
 * a clean JSON endpoint. This is the most reliable source since it's a
 * proper API, not HTML scraping.
 *
 * API: https://www.arbeitnow.com/api/job-board-api
 */
import type { Job } from "@superjob/core";
import type { JobBoardScraper } from "../framework.js";
import { fetchJson, makeJob, matchesSearchKeywords, sleep } from "../framework.js";

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links?: { next?: string };
}

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string | string[];
  created_at: number;
}

export const ArbeitnowScraper: JobBoardScraper = {
  id: "arbeitnow",
  name: "Arbeitnow",

  async discover(keywords: string, _location: string, limit: number, params?): Promise<Job[]> {
    const delayMs = params?.delayMs ?? 300;

    const jobs: Job[] = [];
    let url: string | undefined = "https://www.arbeitnow.com/api/job-board-api";
    let pages = 0;
    const maxPages = Math.ceil(limit / 20) + 1;

    while (url && jobs.length < limit && pages < maxPages) {
      pages++;
      const data: ArbeitnowResponse | null = await fetchJson<ArbeitnowResponse>(url, {
        delayMs,
        signal: params?.signal,
      });
      if (!data?.data) break;

      for (const item of data.data) {
        if (jobs.length >= limit) break;

        const searchable = `${item.title} ${item.company_name} ${item.tags.join(" ")} ${item.description}`;
        if (!matchesSearchKeywords(keywords, searchable)) continue;

        jobs.push(
          makeJob({
            title: item.title,
            company: item.company_name,
            location: Array.isArray(item.location)
              ? item.location.join(", ")
              : typeof item.location === "string" && item.location.trim()
                ? item.location.trim()
                : "Remote",
            description: item.description.slice(0, 10000),
            remote: item.remote,
            source: "arbeitnow",
            postedAt: new Date(item.created_at * 1000).toISOString(),
            url: item.url || `https://www.arbeitnow.com/job/${item.slug}`,
          })
        );
      }

      url = data.links?.next;
      if (url) await sleep(delayMs);
    }

    return jobs;
  },
};
