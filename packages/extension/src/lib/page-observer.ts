/**
 * Enhanced SPA page observer.
 *
 * Replaces the basic MutationObserver + setInterval pattern in content.ts
 * with a proper debounced observer that:
 *  1. Detects URL changes (cross-SPA navigation)
 *  2. Detects structural DOM changes (new form steps without URL change)
 *  3. Watches for LinkedIn job-title changes without URL change
 *  4. Fires the appropriate callback with context about what changed
 *
 * High-frequency throttled DOM observer with step change detection.
 */
import { isChromeRuntimeValid } from "@/lib/runtime-guard.js";
import { isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { getLinkedInJobId } from "@/lib/linkedin-autopilot.js";

/** What caused the page-change event. */
export type ChangeReason = "url" | "structure" | "linkedin-job-title";

export interface PageChangeEvent {
  reason: ChangeReason;
  previousUrl: string;
  currentUrl: string;
  /** For linkedin-job-title: the new job title. */
  newJobTitle?: string;
  /** For linkedin-job-title: the new job ID. */
  newJobId?: string;
}

export interface PageObserverCallbacks {
  onPageChange: (event: PageChangeEvent) => void;
}

const STRUCTURAL_DEBOUNCE_MS = 300;
const LINKEDIN_TITLE_POLL_MS = 1500;

const LI_TITLE_SELECTORS = [
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
];

const EXTERNAL_ATS_PATTERN = /apply|career|greenhouse|lever|ashby|workday|icims|wellfound|ripplehire|bamboohr/i;

export class PageObserver {
  private mutationObserver: MutationObserver | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private linkedinTitleTimer: ReturnType<typeof setInterval> | null = null;

  private lastUrl = location.href;
  private lastLinkedInTitle = "";
  private lastFormSignature = "";

  constructor(
    private readonly callbacks: PageObserverCallbacks,
    private readonly throttleMs = STRUCTURAL_DEBOUNCE_MS
  ) {}

  /** Start observing. Safe to call multiple times. */
  start(): void {
    this.stop();
    this.lastLinkedInTitle = this.readLinkedInTitle();
    this.lastFormSignature = this.getFormSignature();

    this.mutationObserver = new MutationObserver(() => {
      if (this.throttleTimer) return;
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.handleMutation();
      }, this.throttleMs);
    });

    const target = document.body ?? document.documentElement;
    this.mutationObserver.observe(target, { childList: true, subtree: true });

    if (isLinkedInJobsUrl()) {
      this.startLinkedInTitlePoller();
    }
  }

  /** Stop observing and clean up timers. */
  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.throttleTimer = null;
    if (this.linkedinTitleTimer) clearInterval(this.linkedinTitleTimer);
    this.linkedinTitleTimer = null;
  }

  private getFormSignature(): string {
    const inputs = document.querySelectorAll("input, select, textarea");
    let sig = "";
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i] as HTMLInputElement;
      sig += `${el.tagName}:${el.name || ""}:${el.id || ""}:${el.type || ""};`;
    }
    return sig;
  }

  private handleMutation(): void {
    if (!isChromeRuntimeValid()) return;
    const currentUrl = location.href;
    const urlChanged = currentUrl !== this.lastUrl;

    if (urlChanged) {
      const prev = this.lastUrl;
      this.lastUrl = currentUrl;
      this.lastFormSignature = this.getFormSignature();
      this.callbacks.onPageChange({ reason: "url", previousUrl: prev, currentUrl });
      if (isLinkedInJobsUrl()) {
        this.startLinkedInTitlePoller();
      } else {
        if (this.linkedinTitleTimer) {
          clearInterval(this.linkedinTitleTimer);
          this.linkedinTitleTimer = null;
        }
      }
    } else if (!isLinkedInJobsUrl() && EXTERNAL_ATS_PATTERN.test(currentUrl)) {
      const currentSig = this.getFormSignature();
      if (currentSig !== this.lastFormSignature) {
        this.lastFormSignature = currentSig;
        this.callbacks.onPageChange({ reason: "structure", previousUrl: currentUrl, currentUrl });
      }
    }
  }

  private startLinkedInTitlePoller(): void {
    if (this.linkedinTitleTimer) return;
    this.linkedinTitleTimer = setInterval(() => {
      if (!isChromeRuntimeValid()) return;
      const title = this.readLinkedInTitle();
      if (title && title !== this.lastLinkedInTitle) {
        this.lastLinkedInTitle = title;
        const jobId = getLinkedInJobId() || `title:${title}`;
        this.callbacks.onPageChange({
          reason: "linkedin-job-title",
          previousUrl: location.href,
          currentUrl: location.href,
          newJobTitle: title,
          newJobId: jobId,
        });
      }
    }, LINKEDIN_TITLE_POLL_MS);
  }

  private readLinkedInTitle(): string {
    for (const sel of LI_TITLE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return "";
  }
}