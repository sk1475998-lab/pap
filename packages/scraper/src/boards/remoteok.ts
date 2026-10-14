/**
 * RemoteOK scraper — free public JSON API.
 *
 * RemoteOK is a popular remote job board with a simple, unauthenticated
 * JSON API that returns structured job data.
 *
 * API: https://remoteok.com/api
 */
import type { Job } from "@superjob/core";
import type { JobBoardScraper, ScrapeParams } from "../framework.js";
import { fetchJson, makeJob, matchesSearchKeywords } from "../framework.js";

interface RemoteOkJob {
  slug?: string;
  id?: number;
  company: string;
  position: string;
  description: string;
  url?: string;
  location?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  date?: string;
}

export const RemoteOkScraper: JobBoardScraper = {
  id: "remoteok",
  name: "RemoteOK",

  async discover(keywords: string, _location: string, limit: number, params?: ScrapeParams): Promise<Job[]> {
    const delayMs = params?.delayMs ?? 300;
    const data = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api", {
      delayMs,
      signal: params?.signal,
    });
    if (!Array.isArray(data)) return [];

    // first element is a metadata object, skip it
    const listings = data.filter((d) => d && typeof d.company === "string");
    const jobs: Job[] = [];
    for (const item of listings) {
      if (jobs.length >= limit) break;

      const searchable = `${item.position} ${item.company} ${(item.tags ?? []).join(" ")} ${item.description}`;
      if (!matchesSearchKeywords(keywords, searchable)) continue;

      const salary =
        item.salary_min && item.salary_max
          ? `$${item.salary_min / 1000}k–$${item.salary_max / 1000}k`
          : "";

      jobs.push(
        makeJob({
          title: item.position,
          company: item.company,
          location: item.location || "Remote",
          description: (item.description ?? "").replace(/<[^>]*>/g, "").slice(0, 10000),
          remote: true,
          salary,
          source: "remoteok",
          postedAt: item.date,
          url: item.url || `https://remoteok.com/remote-jobs/${item.slug || item.id}`,
        })
      );
    }

    return jobs;
  },
};
