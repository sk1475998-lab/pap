/**
 * Shared autopilot state — single source of truth extracted from the
 * content.ts monolith. All autopilot engines read/write this object
 * rather than maintaining their own closure variables.
 */

export interface AutopilotState {
  // ── LinkedIn Easy Apply ──────────────────────────────
  /** Job ID currently being tracked on LinkedIn. */
  trackedJobId: string;
  /** Job ID for which autopilot has finished (prevent re-run). */
  autopilotDoneForJob: string;
  /** Step hash of the last processed LinkedIn step. */
  lastStepHash: string;
  /** Step hash where we last clicked Next or Submit to prevent double clicks. */
  lastActionClickedHash: string;
  /** Number of steps taken for the current LinkedIn application. */
  autopilotStepCount: number;
  /** True while the LinkedIn autopilot async loop is executing. */
  autopilotBusy: boolean;
  /** True if user manually paused the step-verification prompt. */
  verifyStepPaused: boolean;

  // ── External ATS autopilot ───────────────────────────
  /** URL for which external autofill has already been completed. */
  externalAutofillDone: string;
  /** Number of fields on the last external fill pass. */
  lastExternalFieldCount: number;
  /** Step hash of the last external ATS step. */
  lastExternalStepHash: string;
  /** True while the external autopilot async loop is executing. */
  externalAutopilotBusy: boolean;
  /** True if user manually paused the external verify prompt. */
  externalVerifyStepPaused: boolean;

  // ── Shared signals ───────────────────────────────────
  /** True after user interaction was detected — pauses all autopilot. */
  userInterrupted: boolean;
  /** True if OTP input is being awaited. */
  otpPaused: boolean;
  /** Host for which auto-login has already been attempted. */
  loginAttemptedForHost: string;
  /** True once setupPageAgent() has run. */
  pageAgentStarted: boolean;
  /** Count of consecutive steps with no progress. */
  stagnantCount: number;
  /** Count of autofill fields seen on last fill pass. */
  lastAutofillFieldCount: number;
  /** Last detected page step signature (for stagnant detection). */
  lastStepSignature: string;
  /** Last seen match score for the active job. */
  lastScore: number;
  /** True while an autofill run is in progress (race condition guard). */
  autofillRunning: boolean;
  /** Timestamp of last autofill start. */
  autofillLastStart: number;
  /** Timestamp of last autofill end. */
  autofillLastEnd: number;
}

/** Factory — create a fresh autopilot state. */
export function createAutopilotState(): AutopilotState {
  return {
    trackedJobId: "",
    autopilotDoneForJob: "",
    lastStepHash: "",
    lastActionClickedHash: "",
    autopilotStepCount: 0,
    autopilotBusy: false,
    verifyStepPaused: false,

    externalAutofillDone: "",
    lastExternalFieldCount: 0,
    lastExternalStepHash: "",
    externalAutopilotBusy: false,
    externalVerifyStepPaused: false,

    userInterrupted: false,
    otpPaused: false,
    loginAttemptedForHost: "",
    pageAgentStarted: false,
    stagnantCount: 0,
    lastAutofillFieldCount: 0,
    lastStepSignature: "",
    lastScore: 0,
    autofillRunning: false,
    autofillLastStart: 0,
    autofillLastEnd: 0,
  };
}

/** Reset LinkedIn autopilot fields without touching external state. */
export function resetLinkedInState(state: AutopilotState, reason?: string): void {
  state.lastStepHash = "";
  state.lastActionClickedHash = "";
  state.autopilotStepCount = 0;
  state.autopilotBusy = false;
  state.verifyStepPaused = false;
  if (reason) console.debug("[AutopilotState] LinkedIn reset:", reason);
}

/** Reset external autopilot fields without touching LinkedIn state. */
export function resetExternalState(state: AutopilotState): void {
  state.lastExternalStepHash = "";
  state.externalAutofillDone = "";
  state.externalVerifyStepPaused = false;
  state.externalAutopilotBusy = false;
}

/** Full reset for navigation events (URL change). */
export function resetOnNavigation(state: AutopilotState): void {
  resetLinkedInState(state, "navigation");
  resetExternalState(state);
  state.loginAttemptedForHost = "";
  state.stagnantCount = 0;
}

/** Handle a job-change event on LinkedIn. */
export function onJobChange(state: AutopilotState, newJobId: string): boolean {
  if (!newJobId || newJobId === state.trackedJobId) return false;
  state.trackedJobId = newJobId;
  state.autopilotDoneForJob = "";
  state.lastStepHash = "";
  state.lastActionClickedHash = "";
  state.autopilotStepCount = 0;
  state.stagnantCount = 0;
  state.verifyStepPaused = false;
  state.externalVerifyStepPaused = false;
  return true;
}