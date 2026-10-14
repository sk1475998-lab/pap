/**
 * Scraper framework — shared infrastructure for every board scraper.
 *
 * Every scraper implements `JobBoardScraper`, which is compatible with
 * the crew's `JobSource` so scrapers drop straight into the Researcher.
 *
 * The HTTP client includes:
 *   - human-like headers + User-Agent rotation
 *   - per-request delay (rate limiting)
 *   - automatic retries with backoff
 *   - graceful failure (returns [], never throws — the pipeline keeps going)
 *
 * Security & TLS Architecture Note (P2-009):
 *   - All board scrapers target HTTPS endpoints, relying on Node's native TLS
 *     validation against root CA bundles.
 *   - TLS certificate pinning is intentionally omitted because third-party job
 *     board domains (Indeed, Arbeitnow, RemoteOK, Greenhouse, Lever) rotate certificates
 *     and CDN edge terminations frequently. Pinning keys would cause abrupt outages.
 *   - Target URLs must enforce HTTPS schemes before execution.
 */
import type { Job } from "@superjob/core";
import { nanoid } from "nanoid";

/* ------------------------------------------------------------------ */
/* Source interfaces                                                   */
/* ------------------------------------------------------------------ */

/** The minimal interface the crew's Researcher agent calls. */
export interface JobSource {
  discover(keywords: string, location: string, limit: number): Promise<Job[]>;
}

/** A board scraper with an id/name and the full discover signature. */
export interface JobBoardScraper {
  readonly id: string;
  readonly name: string;
  discover(keywords: string, location: string, limit: number, params?: ScrapeParams): Promise<Job[]>;
}

/* ------------------------------------------------------------------ */
/* Shared search params                                                */
/* ------------------------------------------------------------------ */

export interface ScrapeParams {
  keywords: string;
  location: string;
  limit: number;
  /** ms delay between requests (rate limiting) */
  delayMs?: number;
  /** optional proxy URL */
  proxyUrl?: string;
  /** company board slugs for Greenhouse/Lever (e.g. ["airbnb","stripe"]) */
  companyBoards?: string[];
  /** Aborts provider requests when the aggregator's per-source deadline expires. */
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/* HTTP client with rate limiting + retries                            */
/* ------------------------------------------------------------------ */

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
];

export interface FetchOptions {
  delayMs?: number;
  maxRetries?: number;
  proxyUrl?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const maxRetries = opts.maxRetries ?? 2;
  const delayMs = opts.delayMs ?? 500;
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const headers: Record<string, string> = {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    ...opts.headers,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (delayMs > 0 && attempt > 0) {
      await sleep(delayMs * attempt * 2);
    }
    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: opts.signal
          ? AbortSignal.any([opts.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      });
    } catch {
      if (opts.signal?.aborted) {
        throw new Error("Job source request was cancelled");
      }
      if (attempt < maxRetries) continue;
      throw new Error("Unable to reach job source after retries");
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries) continue;
      throw new Error(`HTTP ${res.status} from job source`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from job source`);
    const html = await res.text();
    if (!html.trim()) throw new Error("Empty response from job source");
    if (delayMs > 0) await sleep(delayMs + Math.random() * delayMs);
    return html;
  }
  throw new Error("Unable to reach job source");
}

/* ------------------------------------------------------------------ */
/* JSON fetch (for API-based sources)                                  */
/* ------------------------------------------------------------------ */

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  const html = await fetchHtml(url, {
    ...opts,
    headers: { ...opts.headers, Accept: "application/json" },
  });
  if (!html.trim()) throw new Error("Empty JSON response from job source");
  try {
    return JSON.parse(html) as T;
  } catch {
    throw new Error("Invalid JSON response from job source");
  }
}

/* ------------------------------------------------------------------ */
/* HTML utilities (no cheerio dependency)                              */
/* ------------------------------------------------------------------ */

export function extractText(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  return m?.[1]?.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim() ?? "";
}

export function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
    "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…",
  };
  return text.replace(/&[#a-z0-9]+;/gi, (e) => entities[e] ?? e);
}

export function extractAll(html: string, pattern: RegExp): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  while ((m = re.exec(html)) !== null) {
    matches.push(m);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return matches;
}

/** Create a Job object with sensible defaults. */
export function makeJob(partial: Partial<Job> & { url: string }): Job {
  return {
    id: partial.id ?? `job_${nanoid(8)}`,
    title: partial.title ?? "",
    company: partial.company ?? "",
    location: partial.location ?? "",
    description: partial.description ?? "",
    salary: partial.salary ?? "",
    remote: partial.remote ?? false,
    source: partial.source ?? "",
    postedAt: partial.postedAt,
    savedAt: Date.now(),
    url: partial.url,
  };
}

/* ------------------------------------------------------------------ */
/* Deduplication                                                       */
/* ------------------------------------------------------------------ */

export function dedupeJobs(jobs: Job[]): Job[] {
  const seenUrl = new Set<string>();
  const seenKey = new Set<string>();
  const out: Job[] = [];
  for (const job of jobs) {
    if (seenUrl.has(job.url)) continue;
    seenUrl.add(job.url);
    const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    out.push(job);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function urlEncode(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to"]);

export function matchesSearchKeywords(keywords: string, text: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/[^a-z0-9+#.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const normalizedQuery = normalize(keywords);
  if (!normalizedQuery) return true;

  const queryTokens = normalizedQuery.split(" ").filter((token) => !SEARCH_STOP_WORDS.has(token));
  if (queryTokens.length === 0) return true;

  const textTokens = new Set(normalize(text).split(" ").filter(Boolean));
  return queryTokens.every((token) => textTokens.has(token));
}
