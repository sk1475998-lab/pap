/**
 * Indeed scraper — parses public search results HTML.
 *
 * Indeed's search results embed structured data (JSON-LD) that we parse
 * to extract job listings. This avoids depending on fragile CSS selectors.
 *
 * URL: https://www.indeed.com/jobs?q=<keywords>&l=<location>&limit=<n>
 *
 * NOTE: Indeed actively blocks scrapers. This may fail or require a proxy.
 * The aggregator handles this gracefully — if Indeed returns empty, the
 * other boards still produce results.
 */
import type { Job } from "@superjob/core";
import type { JobBoardScraper, ScrapeParams } from "../framework.js";
import { fetchHtml, makeJob, decodeEntities, matchesSearchKeywords, sleep } from "../framework.js";

export const IndeedScraper: JobBoardScraper = {
  id: "indeed",
  name: "Indeed",

  async discover(keywords: string, location: string, limit: number, params?: ScrapeParams): Promise<Job[]> {
    const delayMs = params?.delayMs ?? 800; // be gentle with Indeed
    const country = params?.proxyUrl ? "us" : "us";
    const jobs: Job[] = [];

    // Indeed returns up to ~15 results per page
    const maxPages = Math.min(Math.ceil(limit / 15) + 1, 4); // cap at 4 pages

    for (let page = 0; page < maxPages && jobs.length < limit; page++) {
      const start = page * 10;
      const url =
        `https://${country}.indeed.com/jobs?` +
        new URLSearchParams({
          q: keywords,
          l: location,
          start: String(start),
          sort: "date",
        }).toString();

      const html = await fetchHtml(url, {
        delayMs,
        proxyUrl: params?.proxyUrl,
        signal: params?.signal,
      });
      if (!html) break;

      // Strategy 1: parse JSON-LD structured data (most reliable)
      const jsonLdJobs = parseJsonLd(html, limit - jobs.length)
        .filter((job) => matchesSearchKeywords(keywords, `${job.title} ${job.company} ${job.description}`));
      if (jsonLdJobs.length > 0) {
        jobs.push(...jsonLdJobs);
      } else {
        // Strategy 2: parse embedded MOZ_CONTAINERS / result cards
        const cardJobs = parseResultCards(html, limit - jobs.length)
          .filter((job) => matchesSearchKeywords(keywords, `${job.title} ${job.company} ${job.description}`));
        jobs.push(...cardJobs);
      }

      if (page < maxPages - 1) await sleep(delayMs);
    }

    return jobs.slice(0, limit);
  },
};

function parseJsonLd(html: string, limit: number): Job[] {
  const jobs: Job[] = [];
  // Indeed embeds job postings in JSON-LD <script type="application/ld+json">
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonLdRegex.exec(html)) !== null && jobs.length < limit) {
    try {
      const json = JSON.parse(match[1].trim());
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (jobs.length >= limit) break;
        if (item["@type"] !== "JobPosting") continue;

        const title = item.title ?? "";
        const company = item.hiringOrganization?.name ?? "";
        const location =
          item.jobLocation?.address?.addressLocality ??
          item.jobLocation?.name ??
          "";
        const description = item.description ?? "";
        const url = item.url ?? "";

        if (!title || !url) continue;

        jobs.push(
          makeJob({
            title: decodeEntities(title),
            company: decodeEntities(company),
            location: decodeEntities(String(location)),
            description: description.replace(/<[^>]*>/g, "").slice(0, 10000),
            remote: /remote/i.test(String(location)),
            source: "indeed",
            postedAt: item.datePosted,
            url,
          })
        );
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  return jobs;
}

function parseResultCards(html: string, limit: number): Job[] {
  const jobs: Job[] = [];
  // Indeed result cards contain job ids and data attributes
  // data-jk is the job key, which forms the URL
  const cardRegex = /data-jk=["']([a-f0-9]+)["'][^>]*>/gi;
  const seenJk = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null && jobs.length < limit) {
    const jk = match[1];
    if (seenJk.has(jk)) continue;
    seenJk.add(jk);

    // extract surrounding context for title/company
    const contextStart = Math.max(0, match.index - 2000);
    const contextEnd = Math.min(html.length, match.index + 2000);
    const context = html.slice(contextStart, contextEnd);

    const titleMatch = context.match(/(?:jobTitle|title)["']?\s*[:=]\s*["']([^"']{3,100})["']/i);
    const companyMatch = context.match(/(?:companyName|company)["']?\s*[:=]\s*["']([^"']{2,80})["']/i);
    const locMatch = context.match(/(?:formattedLocation|location)["']?\s*[:=]\s*["']([^"']{2,80})["']/i);

    const title = titleMatch ? decodeEntities(titleMatch[1]) : "";
    const company = companyMatch ? decodeEntities(companyMatch[1]) : "";
    const location = locMatch ? decodeEntities(locMatch[1]) : "";

    if (!title && !company) continue;

    jobs.push(
      makeJob({
        title,
        company,
        location,
        description: "",
        source: "indeed",
        url: `https://www.indeed.com/viewjob?jk=${jk}`,
      })
    );
  }
  return jobs;
}
