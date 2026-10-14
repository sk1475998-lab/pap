/**
 * Observability timeline — structured event log (no LLM, complements diagnostics).
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";

export interface TimelineEvent {
  id: string;
  ts: number;
  kind: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

const STORAGE_KEY = "observabilityTimeline";
const MAX_EVENTS = 120;

async function readEvents(): Promise<TimelineEvent[]> {
  if (!isChromeRuntimeValid()) return [];
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(raw[STORAGE_KEY]) ? (raw[STORAGE_KEY] as TimelineEvent[]) : [];
  } catch {
    return [];
  }
}

export async function recordTimelineEvent(
  kind: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const ev: TimelineEvent = {
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    kind,
    message,
    url: typeof location !== "undefined" ? location.href.split("?")[0] : undefined,
    data,
  };
  try {
    const list = await readEvents();
    list.unshift(ev);
    await chrome.storage.local.set({ [STORAGE_KEY]: list.slice(0, MAX_EVENTS) });
  } catch {
    /* quota */
  }
}

export async function getTimeline(limit = 50): Promise<TimelineEvent[]> {
  return (await readEvents()).slice(0, limit);
}

export async function clearTimeline(): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function exportTimelineJson(): Promise<string> {
  return JSON.stringify(await readEvents(), null, 2);
}
