/**
 * autopilot-state.ts â€” GAP-MV3-01 Fix
 *
 * Provides a transactional state machine for the Autopilot engine that survives
 * Chrome MV3 service worker termination.
 *
 * MV3 service workers are killed after ~30 seconds of idle time. Any in-flight
 * autopilot execution that stores its state in module-level variables loses all
 * progress when Chrome evicts the worker. This module persists checkpoints to
 * chrome.storage.local BEFORE every DOM action, so a restarted worker can
 * resume from the last verified step.
 *
 * Design:
 *   - One active session at a time (keyed by SJA_AUTOPILOT_STATE_KEY).
 *   - Every checkpoint write is atomic (chrome.storage.local.set is atomic).
 *   - Recovery happens on chrome.runtime.onInstalled and service-worker startup.
 *   - Sessions are automatically expired after MAX_SESSION_AGE_MS.
 */

const SJA_AUTOPILOT_STATE_KEY = "sja:autopilot:session";
const MAX_SESSION_AGE_MS = 30 * 60 * 1000; // 30 minutes: any older session is stale

export type AutopilotStage =
  | "IDLE"
  | "SEARCHING"
  | "OPENING_JOB"
  | "FILLING_FORM"
  | "NAVIGATING_STEP"
  | "REVIEWING"
  | "SUBMITTING"
  | "COMPLETED"
  | "FAILED";

export interface AutopilotCheckpoint {
  /** Unique session ID (UUID or timestamp-based). */
  sessionId: string;
  /** Current automation stage. */
  stage: AutopilotStage;
  /** Zero-based page/step index within a multi-page ATS form. */
  stepIndex: number;
  /** Canonical job key (URL hash) of the active job. */
  jobKey: string;
  /** Human-readable job title for diagnostics. */
  jobTitle: string;
  /** Company name for diagnostics. */
  company: string;
  /** Tab ID where the automation is running. */
  tabId?: number;
  /** Epoch ms when this checkpoint was written. Used for stale detection. */
  updatedAt: number;
  /** Optional error message if stage is FAILED. */
  error?: string;
  /** Number of retry attempts at current step. */
  retryCount: number;
}

/** Returns true if the Chrome runtime API is accessible (i.e., inside extension). */
function isExtensionRuntime(): boolean {
  try {
    return typeof chrome !== "undefined" && typeof chrome.storage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Save an autopilot checkpoint to persistent storage.
 * Call this BEFORE every DOM interaction so progress survives service worker eviction.
 */
export async function saveAutopilotCheckpoint(
  checkpoint: Omit<AutopilotCheckpoint, "updatedAt">
): Promise<void> {
  if (!isExtensionRuntime()) return;
  const full: AutopilotCheckpoint = { ...checkpoint, updatedAt: Date.now() };
  await chrome.storage.local.set({ [SJA_AUTOPILOT_STATE_KEY]: full });
}

/**
 * Read the current autopilot session. Returns null if no active session or the
 * session has exceeded MAX_SESSION_AGE_MS.
 */
export async function readAutopilotCheckpoint(): Promise<AutopilotCheckpoint | null> {
  if (!isExtensionRuntime()) return null;
  const data = await chrome.storage.local.get(SJA_AUTOPILOT_STATE_KEY);
  const cp = data[SJA_AUTOPILOT_STATE_KEY] as AutopilotCheckpoint | undefined;
  if (!cp) return null;
  // Evict stale sessions â€” a 30min+ old session is definitely dead
  if (Date.now() - cp.updatedAt > MAX_SESSION_AGE_MS) {
    await clearAutopilotCheckpoint();
    return null;
  }
  return cp;
}

/**
 * Clear the active autopilot session from storage.
 * Call this on successful completion or unrecoverable failure.
 */
export async function clearAutopilotCheckpoint(): Promise<void> {
  if (!isExtensionRuntime()) return;
  await chrome.storage.local.remove(SJA_AUTOPILOT_STATE_KEY);
}

/**
 * Advance the checkpoint to the next step.
 * Preserves all other fields and resets retryCount.
 */
export async function advanceAutopilotStep(
  current: AutopilotCheckpoint,
  newStage: AutopilotStage,
  newStepIndex?: number
): Promise<void> {
  await saveAutopilotCheckpoint({
    ...current,
    stage: newStage,
    stepIndex: newStepIndex ?? current.stepIndex + 1,
    retryCount: 0,
  });
}

/**
 * Record a retry attempt at the current step.
 * Increments retryCount. The caller should check retryCount against its limit.
 */
export async function recordAutopilotRetry(
  current: AutopilotCheckpoint,
  error?: string
): Promise<AutopilotCheckpoint> {
  const updated: AutopilotCheckpoint = {
    ...current,
    retryCount: current.retryCount + 1,
    error,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [SJA_AUTOPILOT_STATE_KEY]: updated });
  return updated;
}

/**
 * Create a fresh session checkpoint.
 * Call this at the beginning of every new automation run.
 */
export function createAutopilotSession(
  jobKey: string,
  jobTitle: string,
  company: string,
  tabId?: number
): Omit<AutopilotCheckpoint, "updatedAt"> {
  return {
    sessionId: `sja-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage: "SEARCHING",
    stepIndex: 0,
    jobKey,
    jobTitle,
    company,
    tabId,
    retryCount: 0,
  };
}