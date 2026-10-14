/**
 * User interaction monitor.
 *
 * Detects real user input events (keyboard, mouse, change) and sets the
 * `userInterrupted` flag on AutopilotState so autopilot can pause
 * gracefully.  After USER_IDLE_MS of silence it auto-resumes.
 *
 * Extracted from content.ts lines 1156-1192.
 */
import { MIMIC_EVENT_DETAIL } from "@/lib/mimic-user.js";
import type { AutopilotState } from "./autopilot-state.js";

/** Milliseconds of user silence before autopilot resumes. */
export const USER_IDLE_MS = 10_000;

/** Callbacks provided by the orchestrator to react to interrupt events. */
export interface UserInteractionCallbacks {
  onInterrupt: () => void;
  onResume: () => void;
}

export class UserInteractionMonitor {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly panelSelector = "#sja-persistent-docked-panel-container";

  constructor(
    private readonly state: AutopilotState,
    private readonly callbacks: UserInteractionCallbacks,
    private readonly idleMs = USER_IDLE_MS
  ) {}

  /** Install window-level event listeners. */
  install(): void {
    window.addEventListener("keydown", this.handle, true);
    window.addEventListener("mousedown", this.handle, true);
    window.addEventListener("input", this.handle, true);
    window.addEventListener("change", this.handle, true);
  }

  /** Remove all event listeners and cancel pending timer. */
  uninstall(): void {
    window.removeEventListener("keydown", this.handle, true);
    window.removeEventListener("mousedown", this.handle, true);
    window.removeEventListener("input", this.handle, true);
    window.removeEventListener("change", this.handle, true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private handle = (e: Event): void => {
    if (!e.isTrusted) return;
    if (e instanceof MouseEvent && (e as MouseEvent).detail === MIMIC_EVENT_DETAIL) return;
    // PointerEvents from our synthetic fallback (detail marker not always present on
    // click() — also check for the "mimic" pointerType we explicitly set).
    if (e instanceof PointerEvent && (e as PointerEvent).pointerType === "mimic") return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(this.panelSelector)) return;
    // Ignore clicks on the SJA FAB (shadow-DOM pill) — those are SJA UI, not LinkedIn interactions.
    if (target.closest("#sja-linkedin-fab-host")) return;
    // Don't pause autopilot when the user clicks a job card to navigate between
    // jobs (the page-observer fires linkedin-job-title and we'll reset anyway).
    if (target.closest('[data-job-id], [data-occludable-job-id], [class*="job-card"], .jobs-search-results-list__list-item, .scaffold-layout__list-item')) return;
    // Clicks on Easy Apply button itself are expected — don't treat as interruption.
    if (target.closest('button.jobs-apply-button, a.jobs-apply-button, [class*="jobs-apply-button"]')) return;

    if (this.timer) clearTimeout(this.timer);

    if (!this.state.userInterrupted) {
      this.state.userInterrupted = true;
      this.callbacks.onInterrupt();
    }

    this.timer = setTimeout(() => {
      this.state.userInterrupted = false;
      this.timer = null;
      this.callbacks.onResume();
    }, this.idleMs);
  };
}