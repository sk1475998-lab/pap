/**
 * Structured diagnostic log — persisted ring buffer for pinpointing failures.
 * View in Settings → Diagnostics or export as JSON.
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";

export type DiagLevel = "info" | "warn" | "error";
export type DiagArea = "autopilot" | "autofill" | "profile" | "background" | "content" | "brain" | "audit" | "submit-guard" | "auth" | "external-autopilot" | "onboarding" | "orchestrator" | "recruiter-assistant" | "entitlement" | "telemetry" | "sync" | "billing";

export interface DiagEntry {
  ts: number;
  level: DiagLevel;
  area: DiagArea;
  event: string;
  message: string;
  data?: Record<string, unknown>;
  url?: string;
}

const STORAGE_KEY = "diagnostics";
const MAX_ENTRIES = 250;

let buffer: DiagEntry[] = [];
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!isChromeRuntimeValid()) {
    buffer = [];
    loaded = true;
    return;
  }
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    buffer = Array.isArray(raw[STORAGE_KEY]) ? (raw[STORAGE_KEY] as DiagEntry[]) : [];
  } catch {
    buffer = [];
  }
  loaded = true;
}

async function persist(): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: buffer.slice(-MAX_ENTRIES) });
  } catch {
    /* storage full or unavailable */
  }
}

export async function isLocalApiStreamingEnabled(): Promise<boolean> {
  if (!isChromeRuntimeValid()) return false;
  try {
    const raw = await chrome.storage.local.get("settings");
    return (raw.settings as { localApiStreamingEnabled?: unknown } | undefined)?.localApiStreamingEnabled === true;
  } catch {
    return false;
  }
}

async function streamLogToServer(entry: DiagEntry): Promise<void> {
  try {
    await fetch("http://localhost:3000/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "diag", entry }),
    });
  } catch {
    // Ignore server connection failures
  }
}

export async function diagLog(
  area: DiagArea,
  event: string,
  opts: { level?: DiagLevel; message?: string; data?: Record<string, unknown> } = {}
): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const entry: DiagEntry = {
    ts: Date.now(),
    level: opts.level ?? "info",
    area,
    event,
    message: opts.message ?? event,
    data: opts.data,
    url: typeof location !== "undefined" ? location.href.slice(0, 200) : undefined,
  };

  // Log to the local context console cleanly
  const tag = `[SJA:${area}]`;
  const formattedData = entry.data ? JSON.stringify(entry.data) : "";
  if (entry.level === "error") console.error(tag, entry.message, formattedData);
  else if (entry.level === "warn") console.info(tag, entry.message, formattedData);
  else console.debug(tag, entry.message, formattedData);

  // Delegate non-background context logging to background worker to bypass page CSP constraints
  const isBackground = typeof window === "undefined";
  if (!isBackground && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      const p = chrome.runtime.sendMessage({
        type: "SJA:LOG",
        payload: { area, event, level: opts.level, message: opts.message ?? event, data: opts.data }
      });
      if (p && typeof (p as any).catch === "function") {
        (p as any).catch(() => {});
      }
      return;
    } catch {
      // Fall back if background script is unreachable
    }
  }

  await ensureLoaded();
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(-MAX_ENTRIES);
  void persist();

  if (isBackground && await isLocalApiStreamingEnabled()) {
    void streamLogToServer(entry);
  }
}

export async function getDiagnostics(limit = 100): Promise<DiagEntry[]> {
  await ensureLoaded();
  return buffer.slice(-limit).reverse();
}

export async function clearDiagnostics(): Promise<void> {
  buffer = [];
  loaded = true;
  if (!isChromeRuntimeValid()) return;
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    /* context invalidated */
  }
}

export async function exportDiagnosticsJson(): Promise<string> {
  await ensureLoaded();
  return JSON.stringify(buffer, null, 2);
}

/** Capture uncaught errors/rejections into the diagnostic log. */
export function installExceptionLogging(context: "content" | "background" = "content"): void {
  const area: DiagArea = context === "background" ? "background" : "content";
  const target = typeof globalThis !== "undefined" ? globalThis : window;

  const shouldLog = (message: string, stack?: string, filename?: string): boolean => {
    const extId = typeof chrome !== "undefined" && chrome.runtime?.id ? chrome.runtime.id : "";
    
    // If it mentions chrome-extension:// but not our own id, ignore it
    if (message.includes("chrome-extension://")) {
      if (!extId || !message.includes(extId)) return false;
    }
    if (stack && stack.includes("chrome-extension://")) {
      if (!extId || !stack.includes(extId)) return false;
    }
    if (filename && filename.includes("chrome-extension://")) {
      if (!extId || !filename.includes(extId)) return false;
    }
    return true;
  };

  target.addEventListener("error", (ev: ErrorEvent) => {
    const message = ev.message || "Unknown error";
    const stack = ev.error instanceof Error ? ev.error.stack?.slice(0, 500) : undefined;
    if (!shouldLog(message, stack, ev.filename)) return;

    void diagLog(area, "uncaught-error", {
      level: "error",
      message,
      data: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack,
      },
    });
  });

  target.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack?.slice(0, 500) : String(reason).slice(0, 300);
    if (!shouldLog(message, stack)) return;

    void diagLog(area, "unhandled-rejection", {
      level: "error",
      message,
      data: {
        stack,
      },
    });
  });
}
