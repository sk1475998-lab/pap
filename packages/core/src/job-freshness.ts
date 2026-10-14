/** Live job freshness check. Best-effort, safe to fail open in extension. */
import type { Job } from "./types.js";

export interface JobFreshnessResult {
  checked: boolean;
  live: boolean;
  reason: string;
  status?: number;
}

const CLOSED_RE = /\b(no longer accepting|position has been filled|job is closed|posting has expired|no longer available|not accepting applications|application deadline has passed|this job has been closed)\b/i;

export async function checkJobFreshness(job: Pick<Job, "url" | "description">, opts: { timeoutMs?: number } = {}): Promise<JobFreshnessResult> {
  if (!job.url || !/^https?:\/\//i.test(job.url) || typeof fetch === "undefined") {
    return { checked: false, live: true, reason: "No fetchable URL." };
  }
  const ac = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = ac ? setTimeout(() => ac.abort(), opts.timeoutMs ?? 7000) : undefined;
  try {
    const res = await fetch(job.url, {
      method: "GET",
      redirect: "follow",
      signal: ac?.signal,
      credentials: "omit",
    });
    const status = res.status;
    if (status === 404 || status === 410) return { checked: true, live: false, status, reason: `HTTP ${status}` };
    const text = (await res.text()).slice(0, 200_000);
    if (CLOSED_RE.test(text)) return { checked: true, live: false, status, reason: "Closed/expired wording found." };
    return { checked: true, live: res.ok, status, reason: res.ok ? "Posting appears live." : `HTTP ${status}` };
  } catch (e) {
    return { checked: false, live: true, reason: e instanceof Error ? e.message : "Freshness check failed." };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
