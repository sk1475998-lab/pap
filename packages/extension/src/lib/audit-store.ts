/**
 * Persist last autofill audit session for Settings UI + diagnostics.
 */
import type { RunAuditReport } from "@superjob/core";
import { idbDeleteOld, idbList, idbPut } from "./idb-store.js";
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { isLocalApiStreamingEnabled } from "./diagnostics.js";

const STORAGE_KEY = "lastAudit";
const HISTORY_KEY = "auditHistory";
const MAX_HISTORY = 20;

export async function saveRunAudit(report: RunAuditReport): Promise<void> {
  if (!isChromeRuntimeValid()) return;

  // Local API streaming is explicitly opt-in because audit reports include
  // application URLs and field-result values.
  if (await isLocalApiStreamingEnabled()) {
    const isBackground = typeof window === "undefined";
    if (!isBackground && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        const p = chrome.runtime.sendMessage({
          type: "SJA:STREAM_AUDIT",
          payload: report
        });
        if (p && typeof (p as any).catch === "function") {
          (p as any).catch(() => {});
        }
      } catch {}
    } else {
      fetch("http://localhost:3000/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "audit", report }),
      }).catch(() => {});
    }
  }

  try {
    await idbPut("audits", { id: `audit_${report.ts ?? Date.now()}_${Math.random().toString(36).slice(2)}`, updatedAt: Date.now(), report });
    void idbDeleteOld("audits", 200);
  } catch {
    /* IndexedDB unavailable: fall back to chrome.storage history below */
  }
  try {
    const raw = await chrome.storage.local.get(HISTORY_KEY);
    const history: RunAuditReport[] = Array.isArray(raw[HISTORY_KEY]) ? raw[HISTORY_KEY] : [];
    history.push(report);
    const trimmed = history.slice(-MAX_HISTORY);
    await chrome.storage.local.set({
      [STORAGE_KEY]: report,
      [HISTORY_KEY]: trimmed,
    });
  } catch {
    /* context invalidated */
  }
}

export async function getLastAudit(): Promise<RunAuditReport | null> {
  if (!isChromeRuntimeValid()) return null;
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    return (raw[STORAGE_KEY] as RunAuditReport) ?? null;
  } catch {
    return null;
  }
}

export async function getAuditHistory(limit = 10): Promise<RunAuditReport[]> {
  if (!isChromeRuntimeValid()) return [];
  try {
    const rows = await idbList<{ report: RunAuditReport }>("audits", limit);
    if (rows.length) return rows.map((r) => r.report);
  } catch {
    /* fall back */
  }
  try {
    const raw = await chrome.storage.local.get(HISTORY_KEY);
    const history: RunAuditReport[] = Array.isArray(raw[HISTORY_KEY]) ? raw[HISTORY_KEY] : [];
    return history.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export async function exportAuditHistoryJson(): Promise<string> {
  const history = await getAuditHistory(MAX_HISTORY);
  return JSON.stringify(history, null, 2);
}
