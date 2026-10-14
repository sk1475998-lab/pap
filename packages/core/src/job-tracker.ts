/**
 * Job Tracking CRM — local-first job application tracker.
 *
 * Ported from first2apply's types (JobLabel, JobStatus, Note, AdvancedMatchingConfig)
 * and reimplemented with a local JSON-file store (upgradable to SQLite).
 *
 * This module provides full CRUD for tracking job applications through
 * their lifecycle: Considering → Submitted → Interviewing → Offer/Rejected/Ghosted.
 */

import { getStore } from "./storage.js";

/* ------------------------------------------------------------------ */
/* Types (ported from first2apply's libraries/core/src/types.ts)       */
/* ------------------------------------------------------------------ */

export const JOB_LABELS = {
  CONSIDERING: "Considering",
  SUBMITTED: "Submitted",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  GHOSTED: "Ghosted",
} as const;

export type JobLabel = (typeof JOB_LABELS)[keyof typeof JOB_LABELS];

export type JobStatus =
  | "new"
  | "applied"
  | "archived"
  | "deleted"
  | "processing"
  | "excluded_by_advanced_matching";

export interface TrackedJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  description?: string;
  source: string;
  status: JobStatus;
  labels: JobLabel[];
  matchScore?: number;
  appliedAt?: number;
  createdAt: number;
  updatedAt: number;
  excludeReason?: string;
}

export interface JobNote {
  id: string;
  jobId: string;
  text: string;
  files: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AdvancedMatchingConfig {
  blacklistedCompanies: string[];
  /** Custom ChatGPT/LLM prompt for AI-powered job filtering */
  aiFilterPrompt: string;
  /** Track AI API usage costs */
  aiApiCost: number;
  aiApiInputTokensUsed: number;
  aiApiOutputTokensUsed: number;
}

/* ------------------------------------------------------------------ */
/* Job Tracker Store                                                    */
/* ------------------------------------------------------------------ */

const STORE_KEY_TRACKED = "trackedJobs";
const STORE_KEY_NOTES = "jobNotes";
const STORE_KEY_MATCHING = "advancedMatching";

async function getTracked(): Promise<TrackedJob[]> {
  return ((await getStore().get<TrackedJob[]>(STORE_KEY_TRACKED)) ?? []);
}

async function saveTracked(jobs: TrackedJob[]): Promise<void> {
  await getStore().set(STORE_KEY_TRACKED, jobs);
}

export async function trackJob(job: Omit<TrackedJob, "id" | "createdAt" | "updatedAt" | "labels" | "status">): Promise<TrackedJob> {
  const jobs = await getTracked();
  const existing = jobs.find((j) => j.url === job.url);
  if (existing) {
    existing.updatedAt = Date.now();
    await saveTracked(jobs);
    return existing;
  }
  const tracked: TrackedJob = {
    ...job,
    id: `trk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    status: "new",
    labels: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.unshift(tracked);
  await saveTracked(jobs);
  return tracked;
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<TrackedJob | null> {
  const jobs = await getTracked();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return null;
  job.status = status;
  job.updatedAt = Date.now();
  await saveTracked(jobs);
  return job;
}

export async function updateJobLabels(jobId: string, labels: JobLabel[]): Promise<TrackedJob | null> {
  const jobs = await getTracked();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return null;
  job.labels = labels;
  job.updatedAt = Date.now();
  await saveTracked(jobs);
  return job;
}

export async function listJobs(filters?: {
  status?: JobStatus;
  source?: string;
  search?: string;
  labels?: JobLabel[];
}): Promise<TrackedJob[]> {
  let jobs = await getTracked();
  if (filters?.status) jobs = jobs.filter((j) => j.status === filters.status);
  if (filters?.source) jobs = jobs.filter((j) => j.source === filters.source);
  if (filters?.labels?.length) jobs = jobs.filter((j) => filters.labels!.some((l) => j.labels.includes(l)));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q)
    );
  }
  return jobs;
}

export async function getJobById(jobId: string): Promise<TrackedJob | null> {
  const jobs = await getTracked();
  return jobs.find((j) => j.id === jobId) ?? null;
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const jobs = await getTracked();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return false;
  jobs.splice(idx, 1);
  await saveTracked(jobs);
  return true;
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

async function getNotes(): Promise<JobNote[]> {
  return ((await getStore().get<JobNote[]>(STORE_KEY_NOTES)) ?? []);
}

async function saveNotes(notes: JobNote[]): Promise<void> {
  await getStore().set(STORE_KEY_NOTES, notes);
}

export async function addNote(jobId: string, text: string, files: string[] = []): Promise<JobNote> {
  const notes = await getNotes();
  const note: JobNote = {
    id: `note_${Date.now().toString(36)}`,
    jobId,
    text,
    files,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notes.unshift(note);
  await saveNotes(notes);
  return note;
}

export async function listNotes(jobId: string): Promise<JobNote[]> {
  const notes = await getNotes();
  return notes.filter((n) => n.jobId === jobId);
}

export async function deleteNote(noteId: string): Promise<boolean> {
  const notes = await getNotes();
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx < 0) return false;
  notes.splice(idx, 1);
  await saveNotes(notes);
  return true;
}

/* ------------------------------------------------------------------ */
/* Advanced Matching Config                                            */
/* ------------------------------------------------------------------ */

export async function getMatchingConfig(): Promise<AdvancedMatchingConfig> {
  return (
    (await getStore().get<AdvancedMatchingConfig>(STORE_KEY_MATCHING)) ?? {
      blacklistedCompanies: [],
      aiFilterPrompt: "",
      aiApiCost: 0,
      aiApiInputTokensUsed: 0,
      aiApiOutputTokensUsed: 0,
    }
  );
}

export async function updateMatchingConfig(
  update: Partial<Pick<AdvancedMatchingConfig, "blacklistedCompanies" | "aiFilterPrompt">>
): Promise<AdvancedMatchingConfig> {
  const config = await getMatchingConfig();
  if (update.blacklistedCompanies !== undefined) config.blacklistedCompanies = update.blacklistedCompanies;
  if (update.aiFilterPrompt !== undefined) config.aiFilterPrompt = update.aiFilterPrompt;
  await getStore().set(STORE_KEY_MATCHING, config);
  return config;
}

export async function isCompanyBlacklisted(company: string): Promise<boolean> {
  const config = await getMatchingConfig();
  const lower = company.toLowerCase();
  return config.blacklistedCompanies.some((b) => lower.includes(b.toLowerCase()));
}
