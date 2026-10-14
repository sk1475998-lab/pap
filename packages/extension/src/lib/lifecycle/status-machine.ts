/**
 * Application lifecycle status machine.
 *
 * Manages valid state transitions for the autofill lifecycle and emits
 * events through the StatusEventBus. Enforces that only valid transitions
 * are allowed, preventing impossible state combinations.
 */

import { AutofillStatus, statusBus, type StatusPayload } from "./status-events.js";

/* ------------------------------------------------------------------ */
/* Valid transitions map                                                */
/* ------------------------------------------------------------------ */

const VALID_TRANSITIONS: Record<AutofillStatus, AutofillStatus[]> = {
  [AutofillStatus.IDLE]: [
    AutofillStatus.DETECTING,
    AutofillStatus.AUTH,
    AutofillStatus.PRE_APPLY,
    AutofillStatus.PAUSED,
    AutofillStatus.FILLING,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.SUBMITTED,
  ],
  [AutofillStatus.DETECTING]: [
    AutofillStatus.WAITING_NETWORK,
    AutofillStatus.FILLING,
    AutofillStatus.DONE,
    AutofillStatus.BLOCKED,
    AutofillStatus.PAUSED,
    AutofillStatus.ERROR,
    AutofillStatus.IDLE,
    AutofillStatus.ADVANCING,
  ],
  [AutofillStatus.WAITING_NETWORK]: [
    AutofillStatus.FILLING,
    AutofillStatus.DETECTING,
    AutofillStatus.AUTH,
    AutofillStatus.PRE_APPLY,
    AutofillStatus.PAUSED,
    AutofillStatus.ERROR,
    AutofillStatus.IDLE,
    AutofillStatus.ADVANCING,
  ],
  [AutofillStatus.FILLING]: [
    AutofillStatus.VALIDATING,
    AutofillStatus.DONE,
    AutofillStatus.DONE_SUBMIT,
    AutofillStatus.DONE_BLOCKED,
    AutofillStatus.BLOCKED,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.PAUSED,
    AutofillStatus.ERROR,
    AutofillStatus.ANSWERING_CUSTOM,
    AutofillStatus.ADVANCING,
    AutofillStatus.DETECTING,
    AutofillStatus.WAITING_NETWORK,
    AutofillStatus.PRE_APPLY,
    AutofillStatus.FILLING,
  ],
  [AutofillStatus.VALIDATING]: [
    AutofillStatus.DONE,
    AutofillStatus.DONE_SUBMIT,
    AutofillStatus.DONE_BLOCKED,
    AutofillStatus.BLOCKED,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.ERROR,
    AutofillStatus.IDLE,
    AutofillStatus.PAUSED,
    AutofillStatus.FILLING,
  ],
  [AutofillStatus.NEEDS_REVIEW]: [
    AutofillStatus.FILLING,
    AutofillStatus.DONE_SUBMIT,
    AutofillStatus.BLOCKED,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.ADVANCING,
    AutofillStatus.DETECTING,
  ],
  [AutofillStatus.DONE]: [
    AutofillStatus.SUBMITTED,
    AutofillStatus.ADVANCING,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
    AutofillStatus.FILLING,
  ],
  [AutofillStatus.DONE_SUBMIT]: [
    AutofillStatus.SUBMITTED,
    AutofillStatus.BLOCKED,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.ADVANCING,
  ],
  [AutofillStatus.BLOCKED]: [
    AutofillStatus.FILLING,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.PAUSED,
    AutofillStatus.GOING_BACK,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
  ],
  [AutofillStatus.DONE_BLOCKED]: [
    AutofillStatus.FILLING,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
  ],
  [AutofillStatus.PAUSED]: [
    AutofillStatus.FILLING,
    AutofillStatus.DETECTING,
    AutofillStatus.IDLE,
    AutofillStatus.ADVANCING,
    AutofillStatus.ANSWERING_CUSTOM,
    AutofillStatus.SUBMITTED,
  ],
  [AutofillStatus.GOING_BACK]: [
    AutofillStatus.DETECTING,
    AutofillStatus.IDLE,
    AutofillStatus.PAUSED,
  ],
  [AutofillStatus.SUBMITTED]: [
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
    AutofillStatus.FILLING,
    AutofillStatus.PAUSED,
    AutofillStatus.NEEDS_REVIEW,
    AutofillStatus.ERROR,
  ],
  [AutofillStatus.ERROR]: [
    AutofillStatus.FILLING,
    AutofillStatus.DETECTING,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
  ],
  [AutofillStatus.ADVANCING]: [
    AutofillStatus.WAITING_NETWORK,
    AutofillStatus.DETECTING,
    AutofillStatus.FILLING,
    AutofillStatus.SUBMITTED,
    AutofillStatus.ERROR,
    AutofillStatus.IDLE,
    AutofillStatus.PAUSED,
  ],
  [AutofillStatus.PRE_APPLY]: [
    AutofillStatus.FILLING,
    AutofillStatus.WAITING_NETWORK,
    AutofillStatus.AUTH,
    AutofillStatus.ERROR,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
  ],
  [AutofillStatus.ANSWERING_CUSTOM]: [
    AutofillStatus.FILLING,
    AutofillStatus.DONE,
    AutofillStatus.DONE_SUBMIT,
    AutofillStatus.VALIDATING,
    AutofillStatus.ERROR,
    AutofillStatus.ADVANCING,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
  ],
  [AutofillStatus.AUTH]: [
    AutofillStatus.FILLING,
    AutofillStatus.WAITING_NETWORK,
    AutofillStatus.PAUSED,
    AutofillStatus.IDLE,
    AutofillStatus.DETECTING,
    AutofillStatus.ERROR,
  ],
};

/* ------------------------------------------------------------------ */
/* Status Machine class                                                */
/* ------------------------------------------------------------------ */

export class StatusMachine {
  private _status: AutofillStatus = AutofillStatus.IDLE;
  private _transitionCount = 0;
  private _history: Array<{ from: AutofillStatus | null; to: AutofillStatus; timestamp: number }> = [];
  private _maxHistory = 50;

  /** Current status. */
  get status(): AutofillStatus {
    return this._status;
  }

  /** Number of transitions performed. */
  get transitionCount(): number {
    return this._transitionCount;
  }

  /** Recent transition history (last 50). */
  get history(): ReadonlyArray<{ from: AutofillStatus | null; to: AutofillStatus; timestamp: number }> {
    return this._history;
  }

  /**
   * Transition to a new status. Validates the transition is allowed.
   * @returns true if transition succeeded, false if it was rejected.
   */
  transition<S extends AutofillStatus>(
    target: S,
    payload: StatusPayload[S],
    options?: { force?: boolean }
  ): boolean {
    if (target === this._status) {
      return true;
    }
    const allowed = VALID_TRANSITIONS[this._status];
    if (!options?.force && allowed && !allowed.includes(target)) {
      console.warn(
        `[StatusMachine] Invalid transition: ${this._status} -> ${target}. Allowed: ${allowed.join(", ")}`
      );
      return false;
    }

    const previous = this._status;
    this._status = target;
    this._transitionCount++;

    // Record history
    this._history.push({ from: previous, to: target, timestamp: Date.now() });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Emit to bus
    statusBus.emit(target, payload, previous);
    return true;
  }

  /**
   * Force transition without validation. Use only for emergency resets.
   */
  forceTransition<S extends AutofillStatus>(target: S, payload: StatusPayload[S]): void {
    this.transition(target, payload, { force: true });
  }

  /** Check if a transition is valid without performing it. */
  canTransition(target: AutofillStatus): boolean {
    const allowed = VALID_TRANSITIONS[this._status];
    return allowed ? allowed.includes(target) : false;
  }

  /** Get all valid next states from current status. */
  get validNextStates(): AutofillStatus[] {
    return VALID_TRANSITIONS[this._status] ?? [];
  }

  /** Check if the machine is in a terminal/idle state. */
  get isIdle(): boolean {
    return this._status === AutofillStatus.IDLE;
  }

  /** Check if the machine is in a blocked/error state. */
  get isStuck(): boolean {
    return [AutofillStatus.BLOCKED, AutofillStatus.DONE_BLOCKED, AutofillStatus.ERROR].includes(this._status);
  }

  /** Check if the machine is in a completed state. */
  get isComplete(): boolean {
    return [AutofillStatus.DONE, AutofillStatus.DONE_SUBMIT, AutofillStatus.SUBMITTED].includes(this._status);
  }

  /** Check if the machine is actively filling. */
  get isActive(): boolean {
    return [
      AutofillStatus.DETECTING,
      AutofillStatus.WAITING_NETWORK,
      AutofillStatus.FILLING,
      AutofillStatus.VALIDATING,
      AutofillStatus.ANSWERING_CUSTOM,
      AutofillStatus.AUTH,
      AutofillStatus.PRE_APPLY,
    ].includes(this._status);
  }

  /** Reset the machine to IDLE. */
  reset(reason?: string): void {
    this.forceTransition(AutofillStatus.IDLE, { reason: reason ?? "manual-reset" });
    this._transitionCount = 0;
    this._history = [];
  }
}

/** Singleton status machine for the content script. */
export const statusMachine = new StatusMachine();
