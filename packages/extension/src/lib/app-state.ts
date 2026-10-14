/**
 * Application state — persisted to chrome.storage (survives reload).
 *
 * Enhanced with:
 * - FAILED state blocking with cooldown (1 hour)
 * - TTL-based cleanup (30-day expiry)
 * - LRU eviction instead of FIFO
 * - Better jobKey normalization across ATS URLs
 * - Cross-session deduplication helpers
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { canonicalJobKey } from "@superjob/core";

export type ApplicationPhase =
  | "DISCOVERED"
  | "OPENED"
  | "IN_PROGRESS"
  | "NEEDS_USER"
  | "AWAITING_OTP"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "DUPLICATE";

export interface ApplicationRecord {
  jobKey: string;
  url: string;
  title: string;
  company: string;
  phase: ApplicationPhase;
  updatedAt: number;
  failCount?: number;
  errorMessage?: string;
}

const STORAGE_KEY = "applicationStates";
const MAX_RECORDS = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FAILED_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const IN_PROGRESS_LOCK_MS = 10 * 60 * 1000; // multi-tab duplicate protection

const memory = new Map<string, ApplicationRecord>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/* ------------------------------------------------------------------ */
/* Job key normalization                                                */
/* ------------------------------------------------------------------ */

/** Extract a canonical job ID from any ATS URL. */
export function jobKey(url: string, title = "", company = ""): string {
  return canonicalJobKey(url, title, company);
}

/* ------------------------------------------------------------------ */
/* Hydrate / persist                                                   */
/* ------------------------------------------------------------------ */

export async function hydrateApplicationStates(): Promise<void> {
  if (hydrated || !isChromeRuntimeValid()) return;
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    const list = Array.isArray(raw[STORAGE_KEY]) ? (raw[STORAGE_KEY] as ApplicationRecord[]) : [];
    
    // Self-healing migration: Load the actual database applications list
    // to filter out any false-positive "SUBMITTED" or "CONFIRMED" records.
    // This repairs state corrupted by the previous submit-guard bug.
    const { getApplications } = await import("./store.js");
    const actualApps = await getApplications().catch(() => []);
    const actualJobIds = new Set(actualApps.map((a) => a.jobId));

    const now = Date.now();
    for (const rec of list) {
      // Skip expired records (TTL cleanup on load)
      if (now - rec.updatedAt > TTL_MS) continue;

      // If it is in a terminal applied state but not in the database, heal it
      if (rec.phase === "SUBMITTED" || rec.phase === "CONFIRMED") {
        const canonicalId = rec.jobKey.replace("linkedin:", "");
        if (!actualJobIds.has(rec.url) && !actualJobIds.has(canonicalId) && !actualJobIds.has(rec.jobKey)) {
          // Drop or reset this record to heal the local storage
          continue;
        }
      }

      memory.set(rec.jobKey, rec);
    }
  } catch {
    /* storage unavailable */
  }
  hydrated = true;
}

function schedulePersist() {
  if (!isChromeRuntimeValid()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      // Operation Zero-Defect: Fix Multi-Tab State Collisions
      // Read current storage to prevent concurrent tabs from clobbering each other
      const raw = await chrome.storage.local.get(STORAGE_KEY);
      const list = Array.isArray(raw[STORAGE_KEY]) ? (raw[STORAGE_KEY] as ApplicationRecord[]) : [];
      
      const merged = new Map<string, ApplicationRecord>();
      for (const rec of list) {
        merged.set(rec.jobKey, rec);
      }
      
      // Merge current tab's memory over the read state
      for (const [key, rec] of memory) {
        merged.set(key, rec);
      }
      
      // LRU eviction: sort by updatedAt desc, keep MAX_RECORDS
      const sorted = [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
      await chrome.storage.local.set({ [STORAGE_KEY]: sorted.slice(0, MAX_RECORDS) });
    } catch (e) {
      console.error("Failed to persist app state safely:", e);
    }
  }, 400);
}

/* ------------------------------------------------------------------ */
/* Query / update                                                      */
/* ------------------------------------------------------------------ */

export function getApplicationState(key: string): ApplicationRecord | undefined {
  return memory.get(key);
}

export function setApplicationPhase(
  key: string,
  phase: ApplicationPhase,
  meta: { url: string; title: string; company: string },
  errorMessage?: string
): ApplicationRecord {
  const existing = memory.get(key);
  const failCount = phase === "FAILED"
    ? (existing?.failCount ?? 0) + 1
    : existing?.failCount ?? 0;

  const rec: ApplicationRecord = {
    jobKey: key,
    url: meta.url,
    title: meta.title,
    company: meta.company,
    phase,
    updatedAt: Date.now(),
    failCount,
    errorMessage: errorMessage ?? existing?.errorMessage,
  };
  memory.set(key, rec);
  schedulePersist();
  return rec;
}

/**
 * Should we block autofill for this job?
 *
 * Blocks if:
 * - Already SUBMITTED or CONFIRMED
 * - Currently AWAITING_OTP
 * - FAILED within cooldown period (1 hour)
 * - Marked as DUPLICATE
 */
export function shouldBlockAutofill(key: string): boolean {
  const rec = memory.get(key);
  if (!rec) return false;

  const { phase, updatedAt, failCount = 0 } = rec;

  // Terminal states — always block
  if (phase === "SUBMITTED" || phase === "CONFIRMED" || phase === "DUPLICATE") return true;

  // OTP pending — block
  if (phase === "AWAITING_OTP") return true;

  // IN_PROGRESS is intentionally not a hard block here because multi-step ATS
  // forms need repeat autofill on the same page. Cross-tab locks should use
  // acquireApplicationLock()/releaseApplicationLock below.

  // Failed — block during cooldown, then allow retry
  if (phase === "FAILED") {
    const elapsed = Date.now() - updatedAt;
    // Increase cooldown with fail count (exponential backoff: 1h, 2h, 4h, max 24h)
    const cooldown = Math.min(
      FAILED_COOLDOWN_MS * Math.pow(2, Math.min(failCount - 1, 4)),
      24 * 60 * 60 * 1000
    );
    return elapsed < cooldown;
  }

  return false;
}

export function listApplicationStates(): ApplicationRecord[] {
  return [...memory.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Get all job keys that have been submitted or confirmed (for cross-session dedup). */
export function getAppliedJobKeys(): Set<string> {
  const keys = new Set<string>();
  for (const [key, rec] of memory) {
    if (rec.phase === "SUBMITTED" || rec.phase === "CONFIRMED") {
      keys.add(key);
    }
  }
  return keys;
}

/** Check if we've already applied to a job (by URL or normalized key). */
export function hasAlreadyApplied(url: string, title = "", company = ""): boolean {
  const key = jobKey(url, title, company);
  const rec = memory.get(key);
  return rec?.phase === "SUBMITTED" || rec?.phase === "CONFIRMED" || false;
}

/** Purge expired records. Call periodically or on extension startup. */
export function purgeExpiredRecords(): number {
  const now = Date.now();
  let purged = 0;
  for (const [key, rec] of memory) {
    if (now - rec.updatedAt > TTL_MS) {
      memory.delete(key);
      purged++;
    }
  }
  if (purged > 0) schedulePersist();
  return purged;
}
