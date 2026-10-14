/**
 * LinkedIn Easy Apply autopilot engine.
 *
 * Extracted from content.ts runAutopilot() / handleAdvance() / recordApplication().
 * Manages the full LinkedIn Easy Apply loop as a clean class with typed state.
 */
import {
  clickEasyApplyButton,
  clickNextButton,
  getEasyApplyStepHash,
  getLinkedInJobId,
  isLinkedInAlreadyApplied,
  isLinkedInApplicationSubmitted,
  isLinkedInJobDetail,
  selectLinkedInResumeIfNeeded,
  sleep,
  waitForEasyApplyModal,
  isLinkedInSubmitButtonPresent,
  animateAndClick,
  waitForLinkedInSubmissionConfirmation,
  isLinkedInDailyLimitReached,
  dismissLinkedInPostSubmissionModal,
  discardLinkedInApplication,
  advanceToNextLinkedInJobCard,
} from "@/lib/linkedin-autopilot.js";
import { isLinkedInEasyApplyOpen, isLinkedInJobsUrl, getLinkedInScanRoot } from "@/lib/linkedin.js";
import { isChromeRuntimeValid } from "@/lib/runtime-guard.js";
import { extractJobFromPage, type EarlyAdvantageInfo } from "@/lib/job-extract.js";
import { jobKey, setApplicationPhase, hasAlreadyApplied } from "@/lib/app-state.js";
import { addApplication, getLLM } from "@/lib/store.js";
import { reportApplicationToCloud } from "@/lib/sync/sync-client.js";
import { diagLog } from "@/lib/diagnostics.js";
import { recordTimelineEvent } from "@/lib/observability-timeline.js";
import { detectPageStepLabel } from "@/lib/navigation.js";
import { statusMachine } from "@/lib/lifecycle/status-machine.js";
import { AutofillStatus } from "@/lib/lifecycle/status-events.js";
import { authorizeAutopilotSubmitWindow } from "@/lib/submit-guard.js";
import { checkStagnant } from "./stagnant-detector.js";
import { getResumeVersion, saveResumeVersion } from "@/lib/resume-version-store.js";
import { canApply, recordApplicationQuota } from "@/lib/quota/quota-client.js";
import { getResumeBlob, resumeBlobToFile } from "@/lib/resume-store.js";
import { analyzeJobDescription } from "@superjob/core";
import { isExternalApplyJob, getExternalApplyUrl, openExternalApplyTab, getExternalApplyButton } from "@/lib/linkedin-external-apply.js";
import type { AutopilotState } from "./autopilot-state.js";
import type { Profile, AgentSettings } from "@superjob/core";
import type { SidePanelHandle } from "@/lib/side-panel.js";
import { isLinkedInResumeUploadable } from "./linkedin-resume-policy.js";

const MAX_AUTOPILOT_STEPS = 15;

/** Callbacks injected from the orchestrator. */
export interface LinkedInEngineCallbacks {
  runAutofill: (track: boolean) => Promise<{ filled: number; skipped: number; missingFields?: import("@superjob/core").DetectedField[] }>;
  getPanel: () => SidePanelHandle | null;
  getSettings: () => Promise<AgentSettings>;
  getProfile: () => Promise<Profile | null>;
  onStopped: (jobId: string, message: string) => void;
}

interface JobFilterEvaluation {
  passed: boolean;
  reason?: string;
}

function matchesFilterWord(text: string, word: string): boolean {
  if (!text || !word) return false;
  const lowerText = text.toLowerCase();
  const lowerWord = word.toLowerCase().trim();
  if (!lowerWord) return false;

  // For short terms (<= 4 characters e.g. "lead", "vp", "qa", "dev", "intern"), require whole word boundaries
  if (lowerWord.length <= 4) {
    const escaped = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(text);
  }
  return lowerText.includes(lowerWord);
}

function extractRequiredExperienceYears(text: string): number {
  if (!text) return 0;
  const patterns = [
    /(?:requires?|requiring|minimum|at\s+least|\+)?\s*(\d+)\+?\s*(?:to|-|\s*–\s*)?\s*(?:\d+)?\s*(?:years?|yrs?|ans?|années?|años?|jahre?|anni?)\s*(?:of\s*)?(?:experience|exp|relevant\s+experience|professional\s+experience|work\s+experience)/gi,
    /\b(\d+)\+?\s*(?:years?|yrs?)\s+required\b/gi,
  ];
  const foundYears: number[] = [];
  for (const pat of patterns) {
    const matches = text.matchAll(pat);
    for (const m of matches) {
      const num = parseInt(m[1], 10);
      if (num > 0 && num <= 30) foundYears.push(num);
    }
  }
  return foundYears.length > 0 ? Math.max(...foundYears) : 0;
}

export function evaluateJobAgainstFilters(
  job: { title: string; company: string; description: string },
  settings: AgentSettings
): JobFilterEvaluation {
  const { titleKeywords = [], titleBlacklist = [], blacklistedCompanies = [], maxExperienceYears = 0 } = settings.search ?? {};

  // 1. Company Blacklist
  if (blacklistedCompanies.length > 0 && job.company) {
    const hitCompany = blacklistedCompanies.find((b) => matchesFilterWord(job.company, b));
    if (hitCompany) {
      return { passed: false, reason: `Company "${job.company}" is blacklisted ("${hitCompany}")` };
    }
  }

  // 2. Job Title Blacklist / Skip Words (highest priority)
  if (titleBlacklist.length > 0 && job.title) {
    const hitTitleSkip = titleBlacklist.find((b) => matchesFilterWord(job.title, b));
    if (hitTitleSkip) {
      return { passed: false, reason: `Title contains blacklisted keyword "${hitTitleSkip}"` };
    }
  }

  // 3. Job Title Target Keywords (whitelist)
  if (titleKeywords.length > 0 && job.title) {
    const matchedWhitelist = titleKeywords.some((w) => matchesFilterWord(job.title, w));
    if (!matchedWhitelist) {
      return { passed: false, reason: `Title does not match target keywords (${titleKeywords.join(", ")})` };
    }
  }

  // 4. Maximum Experience Required Ceiling
  if (maxExperienceYears > 0) {
    const titleYears = extractRequiredExperienceYears(job.title);
    if (titleYears > maxExperienceYears) {
      return { passed: false, reason: `Requires ${titleYears}+ yrs exp (max allowed: ${maxExperienceYears})` };
    }
    const descSlice = (job.description ?? "").slice(0, 3500);
    const descYears = extractRequiredExperienceYears(descSlice);
    if (descYears > maxExperienceYears) {
      return { passed: false, reason: `Requires ${descYears}+ yrs exp (max allowed: ${maxExperienceYears})` };
    }
  }

  // 5. Early Applicant Volume Gate (Under 10 Applicants setting)
  const candidateEarly = (job as any).earlyAdvantage as EarlyAdvantageInfo | undefined;
  if (settings.search?.under10Applicants && candidateEarly?.applicantCount && candidateEarly.applicantCount > 10) {
    return { passed: false, reason: `Has ${candidateEarly.applicantCount} applicants (gate set to <10)` };
  }

  return { passed: true };
}

function isValidApplicationUrl(url: string): boolean {
  return !/post-apply|next-best-action|ApplicationMethods|applicationmethods|thank.?you|confirmation|success|already.?applied/i.test(url);
}

function safeHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export class LinkedInAutopilotEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private resumeUploadedThisStep = false;
  private externalApplyOpenedForJob = ""; // Track which job's external URL we already opened
  private easyApplyClickAttempts = 0;
  private lastAttemptedJobId = "";

  constructor(
    private readonly state: AutopilotState,
    private readonly cb: LinkedInEngineCallbacks
  ) {}

  scheduleRun(delayMs = 300): void {
    if (this.state.autopilotDoneForJob && isLinkedInJobsUrl()) return;
    this.clearTimer();
    this.timer = setTimeout(() => void this.run(), delayMs);
  }

  clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  /** Forget which job's external ATS we already opened so a fresh run can open it again. */
  resetExternalMemo(): void {
    this.externalApplyOpenedForJob = "";
  }

  async run(): Promise<void> {
    if (!isChromeRuntimeValid()) return;
    if (this.state.autopilotBusy || !isLinkedInJobsUrl() || this.state.userInterrupted) return;

    // Defensive: if the lifecycle machine somehow got stuck in SUBMITTED from
    // a previous page/job, reset it at the top of every run so transitions
    // like FILLING / DETECTING / ADVANCING are allowed again.
    try { statusMachine.reset("linkedin-run-tick"); } catch { /* */ }

    // Detect if user manually advanced step while autopilot was paused
    if (this.state.verifyStepPaused) {
      if (isLinkedInEasyApplyOpen()) {
        const stepHash = getEasyApplyStepHash();
        if (this.state.lastStepHash && stepHash !== this.state.lastStepHash) {
          this.state.verifyStepPaused = false;
          this.state.stagnantCount = 0;
          void diagLog("autopilot", "linkedin-manual-advance-resume", { message: "Step changed while paused. Resuming autopilot." });
        }
      }
      if (this.state.verifyStepPaused) return; // Still paused
    }

    if (this.hasCaptcha()) {
      this.cb.getPanel()?.setStatus("⏸ CAPTCHA detected: Please solve it to continue.");
      this.state.verifyStepPaused = true;
      return;
    }

    const settings = await this.cb.getSettings();
    if (!settings.autonomousMode) return;

    // Quota check (Freemium gating)
    const quotaCheck = await canApply();
    if (!quotaCheck.allowed) {
      this.cb.getPanel()?.setStatus(`🔒 ${quotaCheck.reason}`);
      this.state.verifyStepPaused = true;
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "quota_exceeded" });
      return;
    }

    const profile = await this.cb.getProfile();
    if (!profile?.masterResumeText?.trim()) {
      // No usable resume text. Surface actionable guidance; if a stored PDF
      // blob exists AND a profile object exists, continue (tailoring will be
      // skipped but the stored PDF can still be uploaded for the fill).
      const p = this.cb.getPanel();
      if (p) p.setStatus("⏸ Add your resume on the web dashboard, then sync the extension");
      if (!profile) return; // nothing to fill from without any profile
      const { hasResumeBlob } = await import("@/lib/resume-store.js").catch(() => ({ hasResumeBlob: async () => false }));
      if (!(await hasResumeBlob())) return;
    }

    const jobId = getLinkedInJobId();
    if (jobId && this.state.autopilotDoneForJob === jobId) {
      this.cb.getPanel()?.setStatus("✓ Applied — select another job");
      if (settings.autonomousMode) {
        void advanceToNextLinkedInJobCard().then((advanced) => {
          if (advanced) this.scheduleRun(1800);
        });
      }
      return;
    }

    // LinkedIn's visible applied state is authoritative. Older builds could
    // mark SUBMITTED before LinkedIn confirmed it, so an unconfirmed local
    // record must never permanently block a new Easy Apply attempt.
    if (isLinkedInAlreadyApplied()) {
      if (jobId) this.stop(jobId, "✓ Already applied");
      if (settings.autonomousMode) {
        void advanceToNextLinkedInJobCard().then((advanced) => {
          if (advanced) this.scheduleRun(1800);
        });
      }
      return;
    }
    if (hasAlreadyApplied(location.href)) {
      const staleJob = extractJobFromPage();
      const staleKey = jobKey(location.href, staleJob.title, staleJob.company);
      setApplicationPhase(staleKey, "OPENED", staleJob);
      void diagLog("autopilot", "linkedin-stale-submitted-state-reset", {
        level: "warn",
        data: { jobId, title: staleJob.title, company: staleJob.company },
      });
    }

    this.state.autopilotBusy = true;
    try {
      if (settings.autoClickEasyApply && isLinkedInJobDetail() && !isLinkedInEasyApplyOpen()) {
        // Pre-apply candidate filter evaluation (whitelist, blacklist, exp ceiling)
        const currentJob = extractJobFromPage();
        const filterEval = evaluateJobAgainstFilters(currentJob, settings);
        if (!filterEval.passed) {
          const skipMsg = `⏭ Skipped: ${filterEval.reason}`;
          this.cb.getPanel()?.setStatus(skipMsg);
          void diagLog("autopilot", "linkedin-job-skipped-filter", {
            level: "info",
            message: skipMsg,
            data: { jobId, title: currentJob.title, company: currentJob.company, reason: filterEval.reason },
          });
          if (jobId) this.state.autopilotDoneForJob = jobId;
          if (settings.autonomousMode) {
            void advanceToNextLinkedInJobCard().then((advanced) => {
              if (advanced) this.scheduleRun(2000);
            });
          }
          return;
        }
        // Check if this job uses external apply (not Easy Apply).
        // IMPORTANT: Do NOT auto-open the external ATS. Earlier builds did
        // that and it kept hijacking the LinkedIn jobs tab (users reported
        // "IDFC opens every time" — the detector picked up sidebar/sponsored
        // "Apply now" links). Now we surface a clear prompt + button on the
        // side panel and let the user (or an explicit "Auto-apply" action)
        // confirm before leaving LinkedIn. Autonomous external-apply is only
        // triggered when autoApplyExternals is on AND we have a confident URL.
        if (isExternalApplyJob()) {
          const externalUrl = getExternalApplyUrl();
          const host = externalUrl ? safeHost(externalUrl) : "";
          if (externalUrl && host && settings.autoApplyExternals === true) {
            // Open the external ATS in an active tab so Chrome runs with full interactivity
            // and does not throttle background DOM events or requestAnimationFrame.
            this.cb.getPanel()?.setStatus(`🤖 External ATS detected (${host}) — opening application…`);
            void diagLog("autopilot", "external-apply-auto-open", { data: { jobId, url: externalUrl } });
            const tabId = await openExternalApplyTab(externalUrl, { active: true });
            if (tabId) {
              this.cb.getPanel()?.setStatus(`✓ Opened ${host} — autofilling application.`);
              if (jobId) this.externalApplyOpenedForJob = jobId;
            } else {
              this.cb.getPanel()?.setStatus(`⚠ External apply ready — click "Apply on ${host}" in the panel.`);
            }
            // Don't record as applied yet — the external autopilot will do
            // that when it actually submits. Return and wait for user/job change.
            return;
          }
          // Default assistive path: show the URL + a clickable affordance on
          // the panel. The FAB will also offer "Apply on company website".
          this.cb.getPanel()?.setStatus(
            host
              ? `⏸ External ATS: ${host}. Click "Apply on company website" below to start.`
              : "⏸ This job uses External Apply. Click Apply on LinkedIn, then SJA will autofill the new tab."
          );
          this.cb.getPanel()?.setExternalApplyPrompt?.(externalUrl, host);
          return;
        }

        if (isLinkedInDailyLimitReached()) {
          this.state.verifyStepPaused = true;
          this.cb.getPanel()?.setStatus("🛑 LinkedIn daily Easy Apply limit reached (~50-100 applies/day). Autopilot paused to protect your account.");
          statusMachine.transition(AutofillStatus.PAUSED, { reason: "quota_exceeded" });
          return;
        }

        if (this.lastAttemptedJobId !== jobId) {
          this.lastAttemptedJobId = jobId;
          this.easyApplyClickAttempts = 0;
        }

        this.cb.getPanel()?.setStatus("🤖 Clicking Easy Apply…");
        void diagLog("autopilot", "click-easy-apply", { data: { jobId, attempt: this.easyApplyClickAttempts + 1 } });
        const clicked = await clickEasyApplyButton();
        if (clicked) {
          this.easyApplyClickAttempts++;
          const opened = await waitForEasyApplyModal(8000);
          this.state.lastStepHash = "";
          this.state.lastActionClickedHash = "";
          if (!opened) {
            if (isLinkedInDailyLimitReached()) {
              this.state.verifyStepPaused = true;
              this.cb.getPanel()?.setStatus("🛑 LinkedIn daily Easy Apply limit reached (~50-100 applies/day). Autopilot paused to protect your account.");
              statusMachine.transition(AutofillStatus.PAUSED, { reason: "quota_exceeded" });
              return;
            }

            if (this.easyApplyClickAttempts >= 3) {
              void diagLog("autopilot", "easy-apply-modal-max-retries", {
                level: "warn",
                message: `Easy Apply modal not detected after ${this.easyApplyClickAttempts} attempts for job ${jobId}. Advancing or pausing.`,
              });
              this.easyApplyClickAttempts = 0;
              if (jobId) this.state.autopilotDoneForJob = jobId;
              if (settings.autonomousMode) {
                this.cb.getPanel()?.setStatus("⏭ Easy Apply modal did not open. Moving to next job…");
                void advanceToNextLinkedInJobCard().then((advanced) => {
                  if (advanced) this.scheduleRun(2000);
                });
              } else {
                this.cb.getPanel()?.setStatus("⏸ Easy Apply modal did not appear. Click Easy Apply manually to continue.");
                this.state.verifyStepPaused = true;
                statusMachine.transition(AutofillStatus.PAUSED, { reason: "manual" });
              }
              return;
            }

            // Modal may still be animating / LinkedIn may be slow — reschedule.
            void diagLog("autopilot", "easy-apply-modal-delayed", {
              level: "warn",
              message: `Easy Apply clicked but modal not detected within 8s (attempt ${this.easyApplyClickAttempts}/3); rescheduling.`,
            });
            this.scheduleRun(1500);
            return;
          }
          this.easyApplyClickAttempts = 0;
        } else {
          // Couldn't find an Easy Apply button — try once more after short delay,
          // then fall back to waiting for user click.
          void diagLog("autopilot", "easy-apply-button-not-found", {
            level: "warn",
            message: "Easy Apply button not found on this pass; will retry.",
          });
          this.scheduleRun(1500);
          return;
        }
      }
      if (!isLinkedInEasyApplyOpen()) {
        // No modal open yet (user may be on job list page) — poll gently.
        if (settings.autoClickEasyApply && isLinkedInJobDetail()) this.scheduleRun(1500);
        return;
      }
      if (isLinkedInApplicationSubmitted()) {
        if (jobId) {
          await this.recordApplication(profile);
          await dismissLinkedInPostSubmissionModal();
          this.stop(jobId, "✓ Application submitted");
        }
        return;
      }

      const stepHash = getEasyApplyStepHash();
      const { isStagnant } = checkStagnant(this.state, stepHash, this.state.lastStepHash);
      if (isStagnant) {
        if (this.state.lastActionClickedHash === stepHash) {
          void diagLog("autopilot", "stagnant-reset-click", { message: "Step transition took too long. Clearing click lock to retry." });
          this.state.lastActionClickedHash = "";
          this.state.lastStepHash = "";
          this.scheduleRun(500);
          return;
        }
        this.cb.getPanel()?.setStatus("⏸ Autopilot paused: Step did not advance. Please resolve manually.");
        this.state.verifyStepPaused = true;
        this.state.autopilotBusy = false;
        statusMachine.transition(AutofillStatus.PAUSED, { reason: "stagnant" });
        return;
      }

      const stepChanged = stepHash !== this.state.lastStepHash;
      if (stepChanged) {
        this.resumeUploadedThisStep = false;
      }
      if (settings.autoFillSteps && stepChanged) {
        // ── Phase 3: Recon-Act scan before every fill step ──────────────────
        // Discover all current modal fields → broadcast to background for
        // Tool Archive persistence.  Zero-cost on cache-hit; builds strategy on miss.
        try {
          const { scanLinkedInEasyApplyFields } = await import("@/lib/linkedin.js");
          const detectedFields = scanLinkedInEasyApplyFields();
          if (detectedFields.length > 0) {
            void diagLog("autopilot", "recon-scan", {
              data: { stepHash, fieldCount: detectedFields.length },
            });
            // Serialize and persist so Recon Agent has fresh field metadata
            chrome.runtime.sendMessage({
              type: "SJA:TOOL_ARCHIVE_UPDATE",
              payload: {
                archiveJson: JSON.stringify({ stepHash, fields: detectedFields, url: location.href }),
              },
            }).catch(() => {});
          }
        } catch { /* non-fatal — Recon is advisory, never blocks the fill */ }
        // ────────────────────────────────────────────────────────────────────
        await this.handleResumeSelectionAndUpload(profile);

        statusMachine.transition(AutofillStatus.FILLING, { filled: 0, total: 0 });
        this.cb.getPanel()?.setStatus("🤖 Filling fields…");
        this.cb.getPanel()?.clearFillLog();
        const result = await this.cb.runAutofill(false);
        this.state.lastStepHash = stepHash;
        this.cb.getPanel()?.setStatus(`🤖 Filled ${result.filled}, skipped ${result.skipped}`);
        void diagLog("autopilot", "filled-step", { data: { filled: result.filled, skipped: result.skipped } });

        // Additional/assessment questions are the explicit user decision point.
        // Never click Next while the runner has surfaced fields for review.
        if (result.missingFields?.length) {
          this.state.verifyStepPaused = true;
          statusMachine.transition(AutofillStatus.NEEDS_REVIEW, {
            filled: result.filled,
            skipped: result.skipped,
            missingFields: result.missingFields.map((field) => field.label),
          });
          this.cb.getPanel()?.setVerifyPrompt(true, result.filled, "Answer additional questions");
          this.cb.getPanel()?.setStatus(`⏸ ${result.missingFields.length} additional question(s) need your answer before continuing.`);
          void diagLog("autopilot", "linkedin-additional-questions-paused", {
            data: { count: result.missingFields.length, labels: result.missingFields.map((field) => field.label) },
          });
          return;
        }

        // "Verify each step before continuing" — pause for manual Approve even
        // when autoAdvanceSteps is on, so the user stays in the loop. Default
        // is OFF (hands-free); toggle via the Settings checkbox.
        const wantsStepVerification = settings.verifyBeforeAdvance === true;
        if (wantsStepVerification && settings.autoAdvanceSteps) {
          this.state.verifyStepPaused = true;
          statusMachine.transition(AutofillStatus.NEEDS_REVIEW, {
            filled: result.filled,
            skipped: result.skipped,
            missingFields: [],
          });
          this.cb.getPanel()?.setVerifyPrompt(true, result.filled, "Review & continue");
          this.cb.getPanel()?.setStatus(
            `⏸ Step filled (${result.filled} fields). Review, then click Approve & Continue — or disable "Verify each step" for hands-free.`
          );
          void diagLog("autopilot", "verify-step-pause", {
            data: { filled: result.filled, skipped: result.skipped },
          });
          return;
        }

        if (settings.autoAdvanceSteps) {
          await sleep(400);
          await this.advanceStep(stepHash, jobId, profile, settings);
        }
      } else if (settings.autoFillSteps && !stepChanged) {
        // Already-filled step (e.g., LinkedIn prefilled contact info) — advance if allowed.
        if (this.state.lastActionClickedHash === stepHash) {
          this.cb.getPanel()?.setStatus("🤖 Waiting for step transition...");
          return;
        }
        if (settings.verifyBeforeAdvance === true) {
          // Wait for user approval
          if (!this.state.verifyStepPaused) {
            this.state.verifyStepPaused = true;
            this.cb.getPanel()?.setVerifyPrompt(true, 0, "Review & continue");
            this.cb.getPanel()?.setStatus("⏸ Step ready — review and click Approve & Continue.");
          }
          return;
        }
        await this.handleResumeSelectionAndUpload(profile);
        await sleep(500);
        await this.advanceStep(stepHash, jobId, profile, settings);
      }
    } catch (e) {
      const failJob = extractJobFromPage();
      const failKey = jobKey(location.href, failJob.title, failJob.company);
      setApplicationPhase(failKey, "FAILED", failJob, e instanceof Error ? e.message : String(e));
      void diagLog("autopilot", "error", { level: "error", message: e instanceof Error ? e.message : String(e) });
      void recordTimelineEvent("autopilot-error", e instanceof Error ? e.message : String(e));
      statusMachine.transition(AutofillStatus.ERROR, { message: e instanceof Error ? e.message : String(e) });
    } finally {
      this.state.autopilotBusy = false;
    }
  }

  async handleResumeSelectionAndUpload(profile: Profile): Promise<void> {
    const root = getLinkedInScanRoot();
    
    // Look for resume container in multiple possible locations
    let resumeContainer = root.querySelector('.jobs-document-upload-redesign, .jobs-document-upload__container, .jobs-resume-list');
    if (!resumeContainer) {
      // Fallback: search in document body for any resume-related upload container
      resumeContainer = document.querySelector('[class*="document-upload"], [class*="resume-upload"], [class*="file-upload"]');
    }
    if (!resumeContainer) {
      // Last resort: search for any file input in the Easy Apply modal
      const modal = document.querySelector('[class*="modal"], [class*="apply"], [class*="easy-apply"]');
      if (modal) {
        const inputs = modal.querySelectorAll<HTMLInputElement>('input[type="file"]');
        for (const input of inputs) {
          if (input.accept?.includes("pdf") || input.accept?.includes("doc") || input.accept?.includes("txt")) {
            resumeContainer = input.closest('.jobs-document-upload-redesign, .jobs-document-upload__container, .jobs-resume-list, [class*="document"], [class*="upload"], [class*="file"]');
            if (resumeContainer) break;
          }
        }
      }
    }
    
    if (!resumeContainer) {
      void diagLog("autopilot", "linkedin-resume-container-not-found", { level: "warn", message: "Resume container not found - resume upload skipped" });
      return; // Not on resume step
    }

    // Guard against repeated uploads on the same step
    if (this.resumeUploadedThisStep) return;

    // 1. Check if a resume is already selected/checked
    const selected = resumeContainer.querySelector('[aria-checked="true"], input[type=radio]:checked');
    if (selected) {
      void diagLog("autopilot", "linkedin-resume-selected", { message: "A resume is already selected on LinkedIn" });
      return;
    }

    // 2. Try selecting an existing resume card
    const selectedOld = await selectLinkedInResumeIfNeeded();
    if (selectedOld) {
      void diagLog("autopilot", "linkedin-resume-selected-existing", { message: "Selected existing resume on LinkedIn" });
      return;
    }

    // 3. If no existing resume, we need to upload a tailored resume!
    this.cb.getPanel()?.setStatus("🤖 Tailoring resume for LinkedIn Easy Apply…");
    const job = extractJobFromPage();
    const key = jobKey(location.href, job.title, job.company);
    const version = await getResumeVersion(key);

    let tailoredText = version?.tailoredText;

    if (!tailoredText && profile.masterResumeText && job.description && job.description.length > 50) {
      // Generate tailoring on the fly
      try {
        const llm = await getLLM();
        if (llm.isAvailable()) {
          const analysis = analyzeJobDescription({
            resumeText: profile.masterResumeText,
            jobDescription: job.description,
            profileSkills: profile.skills,
            companyName: job.company
          });
          const missingKeywords = [...new Set([...analysis.missing, ...analysis.atsGaps])].slice(0, 10);
          if (missingKeywords.length > 0) {
            const { tailorResumeExperience, generateTailoredResumeText } = await import("@superjob/core");
            const tailoredExp = await tailorResumeExperience(profile, missingKeywords, llm);
            tailoredText = generateTailoredResumeText(profile, tailoredExp, missingKeywords);
            await saveResumeVersion({
              jobKey: key,
              title: job.title,
              company: job.company,
              score: analysis.score,
              atsScore: analysis.atsScore,
              suggestedAdditions: [],
              keywordGaps: missingKeywords,
              createdAt: Date.now(),
              tailoredText
            });
          }
        }
      } catch (err) {
        void diagLog("autopilot", "linkedin-tailor-error", { level: "warn", message: `Failed to tailor on the fly: ${err}` });
      }
    }

    // Tailored text is converted into a real DOCX before upload. Never upload
    // a disguised plain-text draft to LinkedIn.
    if (tailoredText) this.cb.getPanel()?.setTailoredResume(tailoredText);

    const stored = await getResumeBlob();
    let fileToUpload: File | undefined;
    if (tailoredText) {
      const { textToDocx } = await import("@superjob/core");
      const generatedDocx = textToDocx(tailoredText);
      // Copy to a fresh ArrayBuffer-backed view for DOM File compatibility.
      const uploadBytes = new Uint8Array(generatedDocx.byteLength);
      uploadBytes.set(generatedDocx);
      const fileName = `${profile.firstName || ""}_${profile.lastName || ""}_Resume_Tailored.docx`
        .replace(/^_+|_+$/g, "")
        .replace(/\s+/g, "_") || "Resume_Tailored.docx";
      fileToUpload = new File(
        [uploadBytes],
        fileName,
        { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
      );
      void diagLog("autopilot", "linkedin-tailored-docx-created", { data: { fileName } });
    } else if (stored && isLinkedInResumeUploadable(stored)) {
      fileToUpload = resumeBlobToFile(stored);
    }

    if (!fileToUpload) {
      this.resumeUploadedThisStep = true;
      this.cb.getPanel()?.setStatus("⏸ Upload a valid PDF or DOCX resume in Profile before continuing.");
      void diagLog("autopilot", "linkedin-resume-valid-file-required", {
        level: "warn",
        data: { fileName: stored?.fileName, mimeType: stored?.mimeType },
      });
      return;
    }

    // Find file input element (inside container, or globally in document as fallback)
    let fileInput = resumeContainer.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) {
      fileInput = root.querySelector<HTMLInputElement>('input[type="file"]');
    }

    if (fileInput) {
      this.resumeUploadedThisStep = true;
      const dt = new DataTransfer();
      dt.items.add(fileToUpload);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));

      // Also try dispatching drop event if dropzone exists
      const dropZone = fileInput.closest("[class*='drop'], [class*='upload'], [class*='drag']");
      if (dropZone) {
        dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
      }

      this.cb.getPanel()?.setStatus("✓ Valid PDF/DOCX resume uploaded successfully.");
      void diagLog("autopilot", "linkedin-resume-uploaded", {
        message: `Uploaded validated resume: ${fileToUpload.name}`,
        data: { mimeType: fileToUpload.type },
      });
      await sleep(800); // Reduced from 1500ms
    } else {
      void diagLog("autopilot", "linkedin-file-input-not-found", { level: "warn", message: "File input element not found in resume step" });
    }
  }

  startSubmitCountdown(onComplete: () => Promise<void>): void {
    this.clearCountdown();
    let seconds = 3; // User-selected final review window before autonomous submit
    this.cb.getPanel()?.setSubmitCountdownActive(true);
    this.cb.getPanel()?.setSubmitCountdown(seconds);
    this.cb.getPanel()?.setStatus(`Reviewing final step — auto-submitting in ${seconds}s`);

    this.countdownInterval = setInterval(() => {
      seconds--;
      this.cb.getPanel()?.setSubmitCountdown(seconds);
      this.cb.getPanel()?.setStatus(`Reviewing final step — auto-submitting in ${seconds}s`);
      if (seconds <= 0) {
        this.clearCountdown();
        authorizeAutopilotSubmitWindow();
        void onComplete();
      }
    }, 1000);
  }

  clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.cb.getPanel()?.setSubmitCountdownActive(false);
  }

  async submitImmediately(jobId: string, profile: Profile): Promise<void> {
    this.clearCountdown();
    this.state.verifyStepPaused = false;
    authorizeAutopilotSubmitWindow();
    const action = await clickNextButton(true);
    await this.handleAdvance(action, jobId, profile);
  }

  cancelCountdown(): void {
    this.clearCountdown();
    this.state.verifyStepPaused = true;
    this.cb.getPanel()?.setVerifyPrompt(true, 0, "Final Submission");
    this.cb.getPanel()?.setStatus("⏸ Auto-submit paused. Review and click Approve & Continue or submit manually.");
    statusMachine.transition(AutofillStatus.PAUSED, { reason: "manual" });
  }

  /**
   * Shared "advance the current step" logic:
   *  - If submit button is visible, either countdown-auto-submit or wait for manual submit.
   *  - Otherwise click Next/Continue.
   * Also detects required-but-unfilled radio/checkbox groups and pauses if any are found.
   */
  private async advanceStep(
    stepHash: string,
    jobId: string,
    profile: Profile | null,
    settings: { autoSubmit?: boolean; autoAdvanceSteps?: boolean }
  ): Promise<void> {
    // Look for obviously-unfilled required fields (radio groups, checkboxes,
    // required selects) in the modal. Missing text inputs are usually caught
    // by the runner, but radio/checkbox groups often slip through.
    const root = getLinkedInScanRoot();
    const requiredGroups = this.findUnfilledRequiredGroups(root);
    if (requiredGroups.length > 0) {
      this.state.verifyStepPaused = true;
      const labels = requiredGroups.slice(0, 5).map((g) => g.label).filter(Boolean);
      this.cb.getPanel()?.setVerifyPrompt(true, 0, "Answer required questions");
      this.cb.getPanel()?.setStatus(
        `⏸ ${requiredGroups.length} required question(s) need your answer: ${labels.join(", ")}`
      );
      statusMachine.transition(AutofillStatus.NEEDS_REVIEW, {
        filled: 0, skipped: requiredGroups.length, missingFields: labels,
      });
      void diagLog("autopilot", "unfilled-required-groups", {
        data: { count: requiredGroups.length, labels },
      });
      return;
    }

    const isSubmit = isLinkedInSubmitButtonPresent();
    if (isSubmit) {
      this.state.verifyStepPaused = true;
      statusMachine.transition(AutofillStatus.DONE_SUBMIT, { filled: 0, skipped: 0 });
      if (settings.autoSubmit) {
        this.startSubmitCountdown(async () => {
          if (this.state.lastActionClickedHash === stepHash) return;
          const action = await clickNextButton(true);
          if (profile) await this.handleAdvance(action, jobId, profile);
        });
      } else {
        this.cb.getPanel()?.setVerifyPrompt(true, 0, "Submit application");
        this.cb.getPanel()?.setStatus("⏸ Ready for submission — review and click Submit manually, or Approve & Continue.");
      }
      return;
    }
    if (this.state.lastActionClickedHash === stepHash) {
      this.cb.getPanel()?.setStatus("🤖 Waiting for step transition...");
      return;
    }
    const action = await clickNextButton(false);
    if (profile) await this.handleAdvance(action, jobId, profile);
  }

  /**
   * Find required fieldsets (radio/checkbox groups) that have nothing selected
   * AND look like they need user input (work authorization, sponsorship,
   * veteran status, disability, etc.).
   */
  private findUnfilledRequiredGroups(root: ParentNode): Array<{ label: string; el: Element }> {
    const out: Array<{ label: string; el: Element }> = [];
    const fieldsets = Array.from(root.querySelectorAll<HTMLFieldSetElement>(
      "fieldset, .jobs-easy-apply-form-element, div[class*='form-element'], div[class*='question']"
    ));
    for (const fs of fieldsets) {
      // Skip non-relevant containers
      const rect = (fs as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Does it contain radios/checkboxes?
      const radios = fs.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
      if (radios.length === 0) continue;
      // Is any checked?
      const checked = Array.from(radios).some((r) => r.checked);
      if (checked) continue;
      // Is it required? (aria-required, required, or red asterisk)
      const reqStar = fs.querySelector('[aria-hidden="true"], .required')?.textContent?.includes("*");
      const reqAttr = fs.querySelector("[required], [aria-required='true']");
      const ariaReq = fs.getAttribute("aria-required") === "true";
      const text = (fs.textContent ?? "").toLowerCase();
      const looksQuestion = /required|sponsor|authori|veteran|disability|gender|ethnic|pronouns|race|commute|notice|salary|ctc|experience|education|relocat|legally|permit/i.test(text);
      if (reqStar || reqAttr || ariaReq || looksQuestion) {
        // Grab the label
        const lab =
          fs.querySelector("label, legend, span[class*='label'], .jobs-easy-apply-form-section__title") ||
          fs.querySelector("h3, h4");
        const label = (lab?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "(required)";
        out.push({ label, el: fs });
      }
    }
    return out;
  }

  async handleAdvance(
    action: Awaited<ReturnType<typeof clickNextButton>>,
    jobId: string,
    profile: Profile
  ): Promise<void> {
    if (!action) return;
    this.state.autopilotStepCount++;
    void diagLog("autopilot", "advance", { data: { action, step: this.state.autopilotStepCount } });
    statusMachine.transition(AutofillStatus.ADVANCING, { step: this.state.autopilotStepCount, label: detectPageStepLabel() });
    
    // Track the step where the action was clicked to avoid double clicking
    this.state.lastActionClickedHash = getEasyApplyStepHash();

    if (action === "submit") {
      const confirmed = await waitForLinkedInSubmissionConfirmation();
      if (confirmed) {
        await this.recordApplication(profile);
        await dismissLinkedInPostSubmissionModal();
        if (jobId) this.stop(jobId, "✓ Application submitted");
        const settings = await this.cb.getSettings();
        if (settings.autonomousMode) {
          void advanceToNextLinkedInJobCard().then((advanced) => {
            if (advanced) this.scheduleRun(2500);
          });
        }
        return;
      }
      // A closed modal or an applied-looking job card is not proof of submission.
      // Preserve the job as in-progress and make the user verify LinkedIn's result.
      this.state.verifyStepPaused = true;
      this.cb.getPanel()?.setVerifyPrompt(true, 0, "Confirm LinkedIn submission");
      this.cb.getPanel()?.setStatus("⏸ Submit clicked, but LinkedIn confirmation was not detected. Verify before continuing.");
      void diagLog("autopilot", "linkedin-submit-unconfirmed", {
        level: "warn",
        data: { jobId, timeoutMs: 8_000 },
      });
      return;
    }
    if (action === "done" || !isLinkedInEasyApplyOpen()) {
      if (isLinkedInApplicationSubmitted()) {
        await this.recordApplication(profile);
        await dismissLinkedInPostSubmissionModal();
        if (jobId) this.stop(jobId, "✓ Application complete");
        const settings = await this.cb.getSettings();
        if (settings.autonomousMode) {
          void advanceToNextLinkedInJobCard().then((advanced) => {
            if (advanced) this.scheduleRun(2500);
          });
        }
      } else {
        this.state.verifyStepPaused = true;
        this.cb.getPanel()?.setVerifyPrompt(true, 0, "Confirm LinkedIn submission");
        this.cb.getPanel()?.setStatus("⏸ Easy Apply closed without a LinkedIn confirmation. Verify the application status.");
      }
      return;
    }
    if (this.state.autopilotStepCount >= MAX_AUTOPILOT_STEPS) {
      void diagLog("autopilot", "max-steps", { level: "warn", data: { jobId } });
      if (jobId) this.stop(jobId, "⚠ Stopped — too many steps");
      return;
    }
    this.cb.getPanel()?.setStatus("🤖 Next step…");
    this.state.lastStepHash = "";
    this.scheduleRun(1200);
  }

  stop(jobId: string, message: string): void {
    this.state.autopilotDoneForJob = jobId;
    this.state.lastStepHash = "";
    this.state.autopilotStepCount = 0;
    this.clearCountdown();
    this.clearTimer();
    if (message.startsWith("⚠") || message.startsWith("🛑") || message.includes("paused") || message.includes("stopped")) {
      if (isLinkedInEasyApplyOpen()) {
        void discardLinkedInApplication();
      }
    }
    this.cb.getPanel()?.setStatus(message);
    this.cb.onStopped(jobId, message);
    void diagLog("autopilot", "stopped", { message, data: { jobId } });
  }

  async recordApplication(profile: Profile): Promise<void> {
    const job = extractJobFromPage();
    if (!isValidApplicationUrl(job.url)) return;
    const jobId = getLinkedInJobId();
    const stableUrl = jobId ? `https://www.linkedin.com/jobs/view/${jobId}` : job.url;
    const appRecord = {
      id: `app_${Date.now()}`,
      jobId: jobId || stableUrl,
      url: stableUrl,
      title: job.title,
      company: job.company,
      stage: "applied" as const,
      appliedAt: Date.now(),
      updatedAt: Date.now(),
      matchScore: this.state.lastScore,
    };
    await addApplication(appRecord as any);
    void reportApplicationToCloud(appRecord);
    void recordApplicationQuota();
    const key = jobKey(stableUrl, job.title, job.company);
    setApplicationPhase(key, "SUBMITTED", { url: stableUrl, title: job.title, company: job.company });
    statusMachine.transition(AutofillStatus.SUBMITTED, { jobId: jobId || stableUrl, company: job.company, title: job.title });
    void diagLog("autopilot", "recorded-application", { data: { title: job.title, company: job.company } });
  }

  private hasCaptcha(): boolean {
    const selectors = [
      ".g-recaptcha", ".h-captcha",
      "[id*='cf-turnstile']", "[class*='cf-turnstile']",
      "iframe[title*='reCAPTCHA']", "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha.com']", "iframe[src*='challenges.cloudflare.com']",
      "iframe[src*='arkoselabs.com']", "iframe[src*='funcaptcha']",
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return true;
        }
      } catch {}
    }
    return false;
  }
}
