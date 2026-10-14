/**
 * Typed event emitter for lifecycle status changes.
 *
 * Provides a strongly-typed pub/sub system so that any module (autopilot,
 * panel, telemetry) can subscribe to status transitions without tight coupling.
 */

/* ------------------------------------------------------------------ */
/* Status enum                                                         */
/* ------------------------------------------------------------------ */

/** All possible states of the autofill lifecycle. */
export enum AutofillStatus {
  /** No active autofill - waiting for user or trigger */
  IDLE = "IDLE",
  /** Scanning the page for fields */
  DETECTING = "DETECTING",
  /** Waiting for network to settle before filling */
  WAITING_NETWORK = "WAITING_NETWORK",
  /** Actively filling form fields */
  FILLING = "FILLING",
  /** Running validation checks after fill */
  VALIDATING = "VALIDATING",
  /** All fields filled, user should review */
  NEEDS_REVIEW = "NEEDS_REVIEW",
  /** All fields filled, ready to submit */
  DONE = "DONE",
  /** All fields filled and submit button detected */
  DONE_SUBMIT = "DONE_SUBMIT",
  /** Filling complete but blocked by validation errors */
  BLOCKED = "BLOCKED",
  /** Filling complete but blocked - submit button visible */
  DONE_BLOCKED = "DONE_BLOCKED",
  /** Paused by user or system (CAPTCHA, OTP, manual interrupt) */
  PAUSED = "PAUSED",
  /** Navigating back due to unrecoverable state */
  GOING_BACK = "GOING_BACK",
  /** Application was successfully submitted */
  SUBMITTED = "SUBMITTED",
  /** Error occurred */
  ERROR = "ERROR",
  /** Multi-step form advancing to next page */
  ADVANCING = "ADVANCING",
  /** Processing pre-apply actions (consent, cookie banners) */
  PRE_APPLY = "PRE_APPLY",
  /** Answering custom questions via LLM */
  ANSWERING_CUSTOM = "ANSWERING_CUSTOM",
  /** Handling auth (sign-in / sign-up) */
  AUTH = "AUTH",
}

/* ------------------------------------------------------------------ */
/* Status payload types                                                */
/* ------------------------------------------------------------------ */

export interface StatusPayload {
  [AutofillStatus.IDLE]: { reason?: string };
  [AutofillStatus.DETECTING]: { fieldCount?: number };
  [AutofillStatus.WAITING_NETWORK]: { timeoutMs?: number };
  [AutofillStatus.FILLING]: { filled: number; total: number; currentField?: string };
  [AutofillStatus.VALIDATING]: { errorCount?: number };
  [AutofillStatus.NEEDS_REVIEW]: { filled: number; skipped: number; missingFields: string[] };
  [AutofillStatus.DONE]: { filled: number; skipped: number; aiAnswered: number };
  [AutofillStatus.DONE_SUBMIT]: { filled: number; skipped: number; countdownMs?: number };
  [AutofillStatus.BLOCKED]: { source: string; message?: string };
  [AutofillStatus.DONE_BLOCKED]: { source: string; filled: number; skipped: number };
  [AutofillStatus.PAUSED]: { reason: "user" | "captcha" | "otp" | "manual" | "stagnant" | "quota_exceeded"; message?: string };
  [AutofillStatus.GOING_BACK]: { reason?: string };
  [AutofillStatus.SUBMITTED]: { jobId?: string; company?: string; title?: string };
  [AutofillStatus.ERROR]: { message: string; source?: string };
  [AutofillStatus.ADVANCING]: { step?: number; label?: string };
  [AutofillStatus.PRE_APPLY]: { action?: string };
  [AutofillStatus.ANSWERING_CUSTOM]: { questionCount: number; answered: number };
  [AutofillStatus.AUTH]: { mode: "sign-in" | "sign-up" | "verify"; atsName?: string };
}

/* ------------------------------------------------------------------ */
/* Event emitter                                                       */
/* ------------------------------------------------------------------ */

type Listener<S extends AutofillStatus = AutofillStatus> = (
  status: S,
  payload: StatusPayload[S],
  previousStatus: AutofillStatus | null
) => void;

type AnyListener = (
  status: AutofillStatus,
  payload: StatusPayload[AutofillStatus],
  previousStatus: AutofillStatus | null
) => void;

class StatusEventBus {
  private specificListeners = new Map<AutofillStatus, Set<Listener<any>>>();
  private globalListeners = new Set<AnyListener>();
  private lastStatus: AutofillStatus | null = null;

  /** Subscribe to a specific status transition. Returns an unsubscribe function. */
  on<S extends AutofillStatus>(status: S, listener: Listener<S>): () => void {
    if (!this.specificListeners.has(status)) {
      this.specificListeners.set(status, new Set());
    }
    this.specificListeners.get(status)!.add(listener);
    return () => this.specificListeners.get(status)?.delete(listener);
  }

  /** Subscribe to ALL status transitions. Returns an unsubscribe function. */
  onAny(listener: AnyListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /** Emit a status transition. Called internally by StatusMachine. */
  emit<S extends AutofillStatus>(
    status: S,
    payload: StatusPayload[S],
    previousStatus: AutofillStatus | null
  ): void {
    this.lastStatus = status;

    const specific = this.specificListeners.get(status);
    if (specific) {
      for (const listener of specific) {
        try {
          listener(status, payload, previousStatus);
        } catch (err) {
          console.error(`[StatusEventBus] listener error for ${status}:`, err);
        }
      }
    }

    for (const listener of this.globalListeners) {
      try {
        listener(status, payload as any, previousStatus);
      } catch (err) {
        console.error(`[StatusEventBus] global listener error for ${status}:`, err);
      }
    }
  }

  /** Get the most recently emitted status. */
  get current(): AutofillStatus | null {
    return this.lastStatus;
  }

  /** Reset the bus (for testing or full teardown). */
  reset(): void {
    this.specificListeners.clear();
    this.globalListeners.clear();
    this.lastStatus = null;
  }
}

/** Singleton event bus shared across the extension content script. */
export const statusBus = new StatusEventBus();
