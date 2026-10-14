import { createLLM, getStore, DEFAULT_LLM_CONFIG, type LLMConfig } from "@superjob/core";
import { fetchEmails } from "./imap-client.js";
import { classifyEmail } from "./classifiers/classifier.js";
import { syncEmailToTracker } from "./tracker-sync.js";
import type { EmailScanResult, EmailUpdate, ImapConfig, JobEmail } from "./types.js";

export interface MonitorHooks {
  onFetch?: (count: number) => void;
  onClassify?: (email: JobEmail) => void;
  onUpdate?: (update: EmailUpdate) => void;
}

export interface MonitorConfig { imap: ImapConfig; llm?: LLMConfig; sinceDays?: number; maxScan?: number }

export async function scanInbox(config: MonitorConfig, hooks: MonitorHooks = {}): Promise<EmailScanResult> {
  let llmConfig = config.llm;
  if (!llmConfig) {
    const stored = await getStore().get<Partial<LLMConfig>>("llmConfig");
    llmConfig = { ...DEFAULT_LLM_CONFIG, ...(stored ?? {}) };
  }
  const llm = createLLM(llmConfig);
  const rawEmails = await fetchEmails({ ...config.imap, sinceDays: config.sinceDays ?? 7, maxScan: config.maxScan ?? 100 });
  hooks.onFetch?.(rawEmails.length);
  if (rawEmails.length === 0) return { scanned: 0, classified: 0, byCategory: {}, updates: [] };

  const updates: EmailUpdate[] = [];
  const byCategory: Record<string, number> = {};
  let classified = 0;

  for (const raw of rawEmails) {
    const email = await classifyEmail(raw, llm);
    if (email.category === "irrelevant") continue;
    classified++;
    byCategory[email.category] = (byCategory[email.category] ?? 0) + 1;
    hooks.onClassify?.(email);
    const update = await syncEmailToTracker(email);
    if (update.matchedApplication || update.created) { updates.push(update); hooks.onUpdate?.(update); }
  }
  return { scanned: rawEmails.length, classified, byCategory, updates };
}

export interface WatchHandle { stop: () => void; scanCount: () => number }

export function watchInbox(config: MonitorConfig, intervalMs: number, hooks: MonitorHooks & { onScanComplete?: (r: EmailScanResult) => void; onError?: (e: Error) => void } = {}): WatchHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scans = 0; let stopped = false;
  const run = async () => {
    if (stopped) return; scans++;
    try { const r = await scanInbox(config, hooks); hooks.onScanComplete?.(r); }
    catch (e) { hooks.onError?.(e instanceof Error ? e : new Error(String(e))); }
    if (!stopped) timer = setTimeout(run, intervalMs);
  };
  const shutdown = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    process.removeListener("SIGTERM", shutdown);
    process.removeListener("SIGINT", shutdown);
  };
  process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
  void run();
  return { stop: shutdown, scanCount: () => scans };
}
