/**
 * Lightweight cross-tab application locks.
 * MV3 content scripts can run in multiple tabs; this prevents duplicate
 * submissions for the same canonical job while still allowing normal multi-step
 * refills in the owning tab.
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";

const STORAGE_KEY = "applicationLocks";
const LOCK_TTL_MS = 10 * 60 * 1000;
const owner = crypto.randomUUID();

interface LockRecord { key: string; owner: string; expiresAt: number }

async function operate(op: "acquire" | "refresh" | "release", key: string): Promise<boolean> {
  if (!isChromeRuntimeValid()) throw new Error("Cannot manage application lock: extension storage is unavailable.");
  const response = await chrome.runtime.sendMessage({
    type: "SJA:APPLICATION_LOCK",
    payload: { op, key, owner, ttlMs: LOCK_TTL_MS },
  }) as { ok?: boolean; acquired?: boolean; error?: string } | undefined;
  if (!response?.ok) throw new Error(response?.error || "Application lock storage operation failed.");
  return response.acquired === true;
}

export async function acquireApplicationLock(key: string): Promise<boolean> {
  return operate("acquire", key);
}

export async function refreshApplicationLock(key: string): Promise<void> {
  await operate("refresh", key);
}

export async function releaseApplicationLock(key: string): Promise<void> {
  await operate("release", key);
}
