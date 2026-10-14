/**
 * Stagnant-step detector.
 *
 * Tracks whether the autopilot has been stuck on the same step for too
 * many consecutive cycles.  Extracted from runAutopilot() and
 * runExternalAutopilot() in content.ts.
 */
import type { AutopilotState } from "./autopilot-state.js";

/** Default number of repeated step-hashes before declaring stagnant. 
 * FIX: Increased from 6 to 8 to reduce false positives on multi-step forms */
export const DEFAULT_MAX_STAGNANT = 8;

export interface StagnantResult {
  /** True when stagnant threshold was exceeded. */
  isStagnant: boolean;
  /** Current consecutive stagnant count after this check. */
  count: number;
}

/**
 * Check whether the step hash has changed.
 * Mutates state.stagnantCount as a side effect.
 * 
 * FIX: Increased threshold and added progress check to prevent false positives
 * on legitimate multi-step forms (e.g., Workday with 3-4 identical field sets)
 */
export function checkStagnant(
  state: AutopilotState,
  currentHash: string,
  lastHash: string,
  maxStagnant = DEFAULT_MAX_STAGNANT
): StagnantResult {
  if (currentHash === lastHash) {
    state.stagnantCount++;
    
    // FIX: Higher threshold if making progress (fields being filled)
    const recentFills = state.lastAutofillFieldCount > 0;
    const adjustedThreshold = recentFills ? maxStagnant * 2 : maxStagnant; // Double threshold if filling
    
    const isStagnant = state.stagnantCount >= adjustedThreshold;
    if (isStagnant) state.stagnantCount = 0;
    return { isStagnant, count: state.stagnantCount };
  }
  state.stagnantCount = 0;
  return { isStagnant: false, count: 0 };
}

/**
 * Build a step hash for the external ATS autopilot.
 */
export function buildExternalStepHash(
  hasConfigEntities: boolean,
  atsName?: string,
  fields?: Array<{ selector: string; type: string }>
): string {
  if (hasConfigEntities && atsName) {
    return `ats:${atsName}:${document.body?.innerHTML.length ?? 0}`;
  }
  return (fields ?? []).map((f) => `${f.selector}:${f.type}`).join("|");
}

export { getEasyApplyStepHash as buildLinkedInStepHash } from "@/lib/linkedin-autopilot.js";