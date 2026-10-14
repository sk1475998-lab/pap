/**
 * The resume bank in extension storage.
 *
 * The cap-and-prune logic used to live here as its own copy (`keys.slice(0, len-50)`,
 * i.e. oldest by *insertion order*), while the server route kept an array of an
 * entirely different shape under the same `resumeVersions` key. Both now go through
 * core's `upsertResumeVersion`/`listResumeVersions`, so "oldest" means the same
 * thing on both sides and a version tailored in the cloud is the same object the
 * extension looks up by `canonicalJobKey` when the user opens that posting.
 */
import { listResumeVersions, upsertResumeVersion, type ResumeVersion } from "@superjob/core";
import { isChromeRuntimeValid } from "./runtime-guard.js";

const STORAGE_KEY = "resumeVersions";

async function readMap(): Promise<Record<string, ResumeVersion>> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const value = raw[STORAGE_KEY];
  // A legacy array (the old server shape) is not a bank this code can read, and its
  // bullets were fabricated, so it is ignored rather than migrated.
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, ResumeVersion>;
}

export async function saveResumeVersion(version: ResumeVersion): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const map = upsertResumeVersion(await readMap(), version);
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

export async function getResumeVersion(jobKey: string): Promise<ResumeVersion | undefined> {
  if (!isChromeRuntimeValid()) return undefined;
  return (await readMap())[jobKey];
}

/** Every saved version, newest first. */
export async function getResumeVersions(): Promise<ResumeVersion[]> {
  if (!isChromeRuntimeValid()) return [];
  return listResumeVersions(await readMap());
}

/** Remove one saved version. Returns whether there was one to remove. */
export async function deleteResumeVersion(jobKey: string): Promise<boolean> {
  if (!isChromeRuntimeValid()) return false;
  const map = await readMap();
  if (!map[jobKey]) return false;
  const next = { ...map };
  delete next[jobKey];
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return true;
}
