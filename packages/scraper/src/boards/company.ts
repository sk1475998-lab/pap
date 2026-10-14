/**
 * Company career-page scraper.
 *
 * Given a list of company career URLs, scrapes each one for open positions.
 * Detects the ATS type (Greenhouse, Lever, Ashby, Workday) and uses the
 * appropriate API/structure. Many ATS expose public JSON APIs:
 *
 *   Greenhouse:  https://boards-api.greenhouse.io/v1/boards/{company}/jobs
 *   Lever:       https://api.lever.co/v0/postings/{company}?mode=json
 *   Ashby:       https://api.ashbyhq.com/posting-api/job-board/{company}
 *
 * This makes company-level scraping reliable without HTML parsing.
 */
import type { Job } from "@superjob/core";
import type { JobBoardScraper, ScrapeParams } from "../framework.js";
import { fetchJson, makeJob, matchesSearchKeywords, sleep } from "../framework.js";

export const GreenhouseScraper: JobBoardScraper = {
  id: "greenhouse",
  name: "Greenhouse Boards",

  async discover(keywords: string, _location: string, limit: number, params?: ScrapeParams): Promise<Job[]> {
    const defaultBoards = ["gitlab", "cloudflare", "canonical", "elastic"];
    const boards = (params?.companyBoards && params.companyBoards.length > 0) ? params.companyBoards : defaultBoards;

    const delayMs = params?.delayMs ?? 400;
    const jobs: Job[] = [];
    for (const board of boards) {
      if (jobs.length >= limit) break;
      const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
      const data = await fetchJson<{ jobs: any[] }>(url, {
        delayMs,
        signal: params?.signal,
      });
      if (!data?.jobs) continue;

      for (const job of data.jobs) {
        if (jobs.length >= limit) break;
        const title = job.title ?? "";
        const searchable = `${title} ${(job.metadata ?? []).map((m: any) => m.value).join(" ")} ${job.content ?? ""}`;
        if (!matchesSearchKeywords(keywords, searchable)) continue;

        const dept = job.departments?.[0]?.name ?? "";
        const loc = job.location?.name ?? "";
        const description = job.content ?? "";

        jobs.push(
          makeJob({
            title,
            company: job.offices?.[0]?.name ?? board,
            location: loc,
            description: String(description).replace(/<[^>]*>/g, "").slice(0, 10000),
            source: "greenhouse",
            url: job.absolute_url ?? `https://boards.greenhouse.io/${board}/jobs/${job.id}`,
          })
        );
      }
      await sleep(delayMs);
    }
    return jobs;
  },
};

export const LeverScraper: JobBoardScraper = {
  id: "lever",
  name: "Lever Boards",

  async discover(keywords: string, _location: string, limit: number, params?: ScrapeParams): Promise<Job[]> {
    const defaultBoards = ["netflix", "spotify", "datadog"];
    const boards = (params?.companyBoards && params.companyBoards.length > 0) ? params.companyBoards : defaultBoards;

    const delayMs = params?.delayMs ?? 400;
    const jobs: Job[] = [];
    for (const board of boards) {
      if (jobs.length >= limit) break;
      const url = `https://api.lever.co/v0/postings/${board}?mode=json`;
      const data = await fetchJson<any[]>(url, {
        delayMs,
        signal: params?.signal,
      });
      if (!Array.isArray(data)) continue;

      for (const posting of data) {
        if (jobs.length >= limit) break;
        const title = posting.text ?? "";
        const searchable = `${title} ${posting.categories?.team ?? ""} ${(posting.tags ?? []).join(" ")} ${posting.descriptionPlain ?? ""} ${posting.description ?? ""}`;
        if (!matchesSearchKeywords(keywords, searchable)) continue;

        const descBlocks = posting.description ?? "";
        const description = String(descBlocks).replace(/<[^>]*>/g, "");

        jobs.push(
          makeJob({
            title,
            company: posting.categories?.company ?? board,
            location: posting.categories?.location ?? "",
            description: description.slice(0, 10000),
            remote: /remote/i.test(posting.categories?.location ?? ""),
            source: "lever",
            url: posting.hostedUrl ?? `https://jobs.lever.co/${board}/${posting.id}`,
          })
        );
      }
      await sleep(delayMs);
    }
    return jobs;
  },
};
