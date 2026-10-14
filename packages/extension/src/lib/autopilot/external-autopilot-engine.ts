/**
 * External ATS autopilot engine.
 *
 * Extracted from content.ts runExternalAutopilot().
 * Handles non-LinkedIn ATS platforms: cookie dismiss → apply button →
 * login → entity-processor fill → generic fill → advance.
 */
import { isChromeRuntimeValid } from "@/lib/runtime-guard.js";
import { isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { scanPage } from "@/lib/autofill.js";
import { isApplicationForm } from "@/lib/detector.js";
import { isLoginPage } from "@/lib/login-agent.js";
import { authService } from "@/lib/auth/auth-service.js";
import { extractJobFromPage } from "@/lib/job-extract.js";
import { hasAlreadyApplied, jobKey, setApplicationPhase, shouldBlockAutofill } from "@/lib/app-state.js";
import { validateProfile } from "@superjob/core";
import { acquireApplicationLock, refreshApplicationLock, releaseApplicationLock } from "@/lib/application-lock.js";
import { getMatchingAtsConfig, getMatchingAtsConfigFull } from "@/lib/ats-adapter.js";
import { EntityProcessor, profileToUserData } from "@/lib/entity-processor.js";
import { retrieveCustomQuestionElements, extractCustomQuestionFields, fillCustomQuestions } from "@/lib/custom-question-handler.js";
import { clickFormAdvance, isSubmitButtonPresent, clickAddButtons, waitForPageTransition } from "@/lib/navigation.js";
import { attemptExternalSubmission, waitForExternalSubmissionConfirmation } from "./external-submission-confirmation.js";
import { installNetworkMonitor, waitForNetworkIdle } from "@/lib/network-monitor.js";
import { withAutofillGuard } from "@/lib/autofill-guard.js";
import { diagLog } from "@/lib/diagnostics.js";
import { getLLM, addApplication } from "@/lib/store.js";
import { reportApplicationToCloud } from "@/lib/sync/sync-client.js";
import { canApply, recordApplicationQuota } from "@/lib/quota/quota-client.js";
import { statusMachine } from "@/lib/lifecycle/status-machine.js";
import { AutofillStatus } from "@/lib/lifecycle/status-events.js";
import { checkStagnant, buildExternalStepHash } from "./stagnant-detector.js";
import { detectValidationErrors, dismissErrorBanners, attemptAutoRecovery } from "@/lib/form-error-recovery.js";
import { collectDeepRoots } from "@/lib/dom-deep-scan.js";
import { sleep, isPlatformDailyLimitReached } from "@/lib/linkedin-autopilot.js";
import type { AutopilotState } from "./autopilot-state.js";
import type { Profile } from "@superjob/core";
import type { SidePanelHandle } from "@/lib/side-panel.js";

export interface ExternalEngineCallbacks {
  runAutofill: (track: boolean) => Promise<{ filled: number; skipped: number }>;
  getPanel: () => SidePanelHandle | null;
  getSettings: () => Promise<{
    autonomousMode: boolean;
    autoAdvanceSteps: boolean;
    autoLogin: boolean;
    autoSubmit: boolean;
    autoSubmitLogin?: boolean;
    verifyBeforeAdvance?: boolean;
  }>;
  getProfile: () => Promise<Profile | null>;
  tryAutoLogin: () => Promise<void>;
}

export class ExternalAutopilotEngine {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private kickstartTimer: ReturnType<typeof setTimeout> | null = null;
  private kickstartArmed = false;

  constructor(
    private readonly state: AutopilotState,
    private readonly cb: ExternalEngineCallbacks
  ) {}

  /**
   * Schedule a small number of proactive retries during the first ~12 seconds
   * after the orchestrator boots on an external tab. Some ATS SPAs
   * (Workday, iCIMS, Oracle) render the form asynchronously *after* the
   * load event fires and without producing enough DOM mutations to
   * trigger the MutationObserver-based idle scheduler, so a freshly
   * opened external tab used to sit on the job-description page forever
   * showing "⏸ External ATS detected..." and never start filling.
   * These delayed ticks ensure the autopilot actually notices the form
   * once it appears, without affecting steady-state performance
   * (the early-return `stepHash === lastExternalStepHash` guard makes
   * these a no-op once filling is underway).
   */
  armKickstart(): void {
    if (this.kickstartArmed) return;
    this.kickstartArmed = true;
    const delays = [800, 2000, 4500, 9000];
    for (const d of delays) {
      setTimeout(() => {
        try { void this.run(); } catch { /* no-op */ }
      }, d);
    }
    // Cleanup flag after the longest delay so a future navigation can re-arm.
    this.kickstartTimer = setTimeout(() => { this.kickstartArmed = false; this.kickstartTimer = null; }, 12000);
  }

  async run(): Promise<void> {
    if (!isChromeRuntimeValid()) return;
    if (isLinkedInJobsUrl()) return;
    if (this.state.otpPaused || this.state.userInterrupted) return;

    // Defensive: reset the lifecycle machine if it got stuck in SUBMITTED
    // from a prior page, so transitions on the new ATS page don't get rejected.
    try { statusMachine.reset("external-run-tick"); } catch { /* */ }

    // Detect if user manually advanced step while autopilot was paused
    if (this.state.externalVerifyStepPaused) {
      const atsConfigLite = getMatchingAtsConfig(location.href);
      const atsConfig = atsConfigLite ? await getMatchingAtsConfigFull(location.href) : null;
      const hasConfigEntities = Boolean(atsConfig?.entities?.length);
      const { fields } = (await import("@/lib/autofill.js")).scanPage();
      const stepHash = buildExternalStepHash(hasConfigEntities, atsConfig?.atsName, fields);

      if (this.state.lastExternalStepHash && stepHash !== this.state.lastExternalStepHash) {
        this.state.externalVerifyStepPaused = false;
        this.state.stagnantCount = 0;
        void diagLog("external-autopilot", "external-manual-advance-resume", { message: "Step changed while paused. Resuming autopilot." });
      }
      if (this.state.externalVerifyStepPaused) return; // Still paused
    }

    if (this.hasCaptcha()) {
      this.cb.getPanel()?.setStatus("⏸ CAPTCHA detected: Please solve it to continue.");
      this.state.externalVerifyStepPaused = true;
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "captcha" });

      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        const job = extractJobFromPage();
        const key = jobKey(location.href.split("?")[0], job.title, job.company);
        void chrome.runtime.sendMessage({
          type: "SJA:PUSH_REVIEW_ITEM",
          payload: {
            jobId: `captcha-${key}`,
            jobTitle: job.title || "CAPTCHA Verification Required",
            company: job.company || location.hostname,
            matchScore: 100,
            confidence: 100,
            tier: "HUMAN_REVIEW",
            reviewType: "captcha",
            jobUrl: location.href,
            filledFields: 0,
            totalFields: 1,
            lowConfidenceFields: ["CAPTCHA Challenge"],
            tailoredResume: "",
            coverLetter: "",
            reasoning: [{ step: 0, thought: `Automated CAPTCHA challenge detected on ${location.hostname}`, action: "PAUSE_FOR_HUMAN_CAPTCHA" }],
            createdAt: Date.now(),
            ttl: Date.now() + 15 * 60 * 1000,
            idempotencyKey: `captcha-${key}-${Math.floor(Date.now() / 60000)}`,
            decision: "pending",
          },
        }).catch(() => null);
      }
      return;
    }

    const settings = await this.cb.getSettings();
    if (!settings.autonomousMode) return;

    // 1. Cookie banners
    this.dismissCookieBanners();

    // 2. Click Apply Now if on a job listing (not yet on form)
    if (this.clickApplyButton()) { await sleep(800); return; }

    // 3. Login autofill
    if (isLoginPage()) { await this.cb.tryAutoLogin(); return; }

    const profile = await this.cb.getProfile();

    // Click "Add" buttons to expand sections
    const expanded = await clickAddButtons(profile);
    if (expanded) {
      await sleep(400);
    }

    // 4. Resolve ATS config
    const atsConfigLite = getMatchingAtsConfig(location.href);
    const atsConfig = atsConfigLite ? await getMatchingAtsConfigFull(location.href) : null;
    const hasConfigEntities = Boolean(atsConfig?.entities?.length);
    const { fields } = (await import("@/lib/autofill.js")).scanPage();
    if (fields.length === 0 && !hasConfigEntities) return;

    const stepHash = buildExternalStepHash(hasConfigEntities, atsConfig?.atsName, fields);
    const { isStagnant } = checkStagnant(this.state, stepHash, this.state.lastExternalStepHash);
    if (isStagnant) {
      this.cb.getPanel()?.setStatus("⏸ Stuck step detected: Please complete this step manually.");
      this.state.externalVerifyStepPaused = true;
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "stagnant" });
      return;
    }
    if (stepHash === this.state.lastExternalStepHash) return;

    const urlKey = location.href.split("?")[0];
    const job = extractJobFromPage();
    const key = jobKey(urlKey, job.title, job.company);
    
    // FIX: Check for duplicate application before starting
    if (hasAlreadyApplied(urlKey)) {
      this.cb.getPanel()?.setStatus("✓ Already applied to this job");
      void diagLog("external-autopilot", "duplicate-prevented", {
        message: "Prevented duplicate application",
        data: { url: urlKey, title: job.title, company: job.company }
      });
      return;
    }
    
    if (shouldBlockAutofill(key)) return;

    // Platform daily quota wall detection (Naukri, Internshala, Indeed, etc.)
    if (isPlatformDailyLimitReached()) {
      this.cb.getPanel()?.setStatus("🛑 Daily application limit reached on this platform. Autopilot paused.");
      this.state.externalVerifyStepPaused = true;
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "quota_exceeded" });
      return;
    }

    // Quota check (Freemium gating)
    const quotaCheck = await canApply();
    if (!quotaCheck.allowed) {
      this.cb.getPanel()?.setStatus(`🔒 ${quotaCheck.reason}`);
      this.state.externalVerifyStepPaused = true;
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "quota_exceeded" });
      return;
    }

    // Profile is already fetched above
    if (!profile || !validateProfile(profile).complete) {
      this.cb.getPanel()?.setStatus("Complete Profile in extension first");
      return;
    }

    const locked = await acquireApplicationLock(key);
    if (!locked) {
      this.cb.getPanel()?.setStatus("Another tab is already handling this job");
      return;
    }

    this.state.externalAutopilotBusy = true;
    statusMachine.transition(AutofillStatus.DETECTING, { fieldCount: fields.length });
    try {
      // Run Auth automation service before filling
      const atsName = atsConfig?.atsName || location.hostname;
      const authResult = await authService.process(profile, { atsName, autoSubmit: settings.autoSubmit });
      if (!authResult.success) {
        if (authResult.needsUserAction) {
          this.cb.getPanel()?.setStatus(authResult.message || "⏸ Auth action required");
          this.state.externalVerifyStepPaused = true;
          statusMachine.transition(AutofillStatus.PAUSED, {
            reason: authResult.mode === "captcha" ? "captcha" : "user",
            message: authResult.message
          });
        }
        return;
      }

      this.cb.getPanel()?.setStatus("🤖 Filling fields…");
      this.cb.getPanel()?.clearFillLog();
      let totalFilled = 0;
      let totalSkipped = 0;

      if (hasConfigEntities && atsConfig) {
        // Pre-apply network wait
        if (atsConfig.networkOptions?.blacklistedUrlParts) {
          installNetworkMonitor(atsConfig.networkOptions.blacklistedUrlParts);
        }
        if ((atsConfig as any).globalOptions?.waitForAllRequestsBeforeFillingStep) {
          statusMachine.transition(AutofillStatus.WAITING_NETWORK, { timeoutMs: 8000 });
          this.cb.getPanel()?.setStatus("🤖 Waiting for page to load…");
          await waitForNetworkIdle({ timeout: 8000, useQuietPeriod: true, quietPeriod: 500 });
        }

        const userData = profileToUserData(profile);
        const processor = new EntityProcessor(atsConfig, userData);

        if ((atsConfig as any).preApply?.entities?.length) {
          statusMachine.transition(AutofillStatus.PRE_APPLY, { action: "pre-apply" });
          this.cb.getPanel()?.setStatus("🤖 Pre-apply setup…");
          await processor.processPreApply();
          await sleep(500);
        }

        statusMachine.transition(AutofillStatus.FILLING, { filled: 0, total: 0 });
        this.cb.getPanel()?.setStatus("🤖 Filling known fields…");
        const entityResult = await processor.processAll();
        totalFilled += entityResult.filledCount;
        totalSkipped += entityResult.skippedCount;

        // Custom questions via LLM
        const filledIds = processor.getFilledFields();
        const customElements = retrieveCustomQuestionElements(filledIds, (atsConfig as any).customQuestions?.selectors);
        if (customElements.length > 0) {
          statusMachine.transition(AutofillStatus.ANSWERING_CUSTOM, { questionCount: customElements.length, answered: 0 });
          this.cb.getPanel()?.setStatus(`🤖 Answering ${customElements.length} custom questions…`);
          const customFields = extractCustomQuestionFields(customElements);
          if (customFields.length > 0) {
            const llm = await getLLM();
            const cqResult = await fillCustomQuestions(customFields, profile, llm, filledIds);
            totalFilled += cqResult.filled;
            totalSkipped += cqResult.skipped;
          }
        }

        // FIX: Add retry logic for network failures with exponential backoff
        const genericResult = await this.retryAutofillWithBackoff(key, 3);
        if (genericResult) { totalFilled += genericResult.filled; totalSkipped += genericResult.skipped; }
      } else {
        // FIX: Add retry logic for network failures with exponential backoff
        const result = await this.retryAutofillWithBackoff(key, 3);
        if (result) { totalFilled = result.filled; totalSkipped = result.skipped; }
      }

      this.state.lastExternalStepHash = stepHash;
      this.cb.getPanel()?.setStatus(`🤖 Filled ${totalFilled}, skipped ${totalSkipped}`);
      this.state.lastAutofillFieldCount = fields.length;
      if (totalSkipped === 0) this.state.externalAutofillDone = urlKey;
      this.state.lastExternalFieldCount = fields.length;
      setApplicationPhase(key, totalSkipped > 0 ? "NEEDS_USER" : "IN_PROGRESS", job);
      
      // FIX: Track telemetry for autonomous success rate
      void diagLog("telemetry", "autofill-complete", {
        data: {
          platform: atsConfig?.atsName || location.hostname,
          filled: totalFilled,
          skipped: totalSkipped,
          successRate: totalFilled / (totalFilled + totalSkipped),
          hasConfig: !!atsConfig,
          fieldCount: fields.length
        }
      });

      // Error recovery — Reflexion & LATS self-healing loop
      const errors = detectValidationErrors(atsConfig);
      if (errors.length > 0) {
        this.cb.getPanel()?.setStatus(`🤖 Auto-healing ${errors.length} validation error(s) via Reflexion…`);
        statusMachine.transition(AutofillStatus.VALIDATING, { errorCount: errors.length });
        const recovery = await attemptAutoRecovery(atsConfig);
        if (recovery.recovered > 0) {
          totalFilled += recovery.recovered;
          this.cb.getPanel()?.setStatus(`✓ Self-healed ${recovery.recovered} validation error(s)`);
        }
        dismissErrorBanners(atsConfig);
        const remaining = detectValidationErrors(atsConfig);
        if (remaining.length > 0) {
          this.state.externalVerifyStepPaused = true;
          statusMachine.transition(AutofillStatus.NEEDS_REVIEW, {
            filled: totalFilled,
            skipped: totalSkipped,
            missingFields: remaining.map((e) => e.label),
          });
          this.cb.getPanel()?.setVerifyPrompt(true, totalFilled, "Fix validation errors");
          await releaseApplicationLock(key);
          return;
        }
      }

      // "Verify each step before continuing" — pause before auto-advancing or submitting.
      const wantsStepVerification = settings.verifyBeforeAdvance !== false;
      if (wantsStepVerification) {
        this.state.externalVerifyStepPaused = true;
        if (isSubmitButtonPresent()) {
          statusMachine.transition(AutofillStatus.DONE_SUBMIT, { filled: totalFilled, skipped: totalSkipped });
          if (settings.autoSubmit) {
            this.startSubmitCountdown(async () => {
              statusMachine.transition(AutofillStatus.ADVANCING, { step: 0 });
              this.cb.getPanel()?.setStatus("🤖 Submitting automatically…");
              await this.submitWithConfirmation(job);
            });
          } else {
            this.cb.getPanel()?.setStatus("⏸ Review required: Please review, then click Submit/Approve manually.");
            this.cb.getPanel()?.setVerifyPrompt(true, totalFilled, "Final Submission");
          }
        } else {
          statusMachine.transition(AutofillStatus.NEEDS_REVIEW, {
            filled: totalFilled, skipped: totalSkipped, missingFields: [],
          });
          this.cb.getPanel()?.setVerifyPrompt(true, totalFilled, "Review & continue");
          this.cb.getPanel()?.setStatus(
            `⏸ Step filled (${totalFilled} fields). Review, then click Approve & Continue — or disable "Verify each step" for hands-free.`
          );
        }
        await releaseApplicationLock(key);
        return;
      }

      // Submit gate (hands-free path, verify off)
      if (isSubmitButtonPresent()) {
        if (settings.autoSubmit) {
          this.startSubmitCountdown(async () => {
            statusMachine.transition(AutofillStatus.ADVANCING, { step: 0 });
            this.cb.getPanel()?.setStatus("🤖 Submitting automatically…");
            await this.submitWithConfirmation(job);
          });
        } else {
          this.state.externalVerifyStepPaused = true;
          this.cb.getPanel()?.setStatus("⏸ Ready for submission — review and click Submit manually.");
          this.cb.getPanel()?.setVerifyPrompt(true, totalFilled, "Final Submission");
        }
        await releaseApplicationLock(key);
        return;
      }

      if (settings.autoAdvanceSteps) {
        await sleep(500);
        await waitForNetworkIdle({ timeout: 2000, quietPeriod: 200 }).catch(() => {});
        statusMachine.transition(AutofillStatus.ADVANCING, { step: 0 });
        this.cb.getPanel()?.setStatus("🤖 Advancing step…");
        const advanced = clickFormAdvance(false);
        if (advanced) {
          await waitForPageTransition(5000);
          this.state.lastExternalStepHash = "";
        } else {
          // No next button found — stop and prompt user
          this.state.externalVerifyStepPaused = true;
          this.cb.getPanel()?.setStatus("⏸ No Next button found — please advance manually.");
          this.cb.getPanel()?.setVerifyPrompt(true, totalFilled, "Manual advance needed");
        }
      }
    } catch (e) {
      void diagLog("external-autopilot", "error", { level: "error", message: e instanceof Error ? e.message : String(e) });
      statusMachine.transition(AutofillStatus.ERROR, { message: e instanceof Error ? e.message : String(e) });
    } finally {
      await releaseApplicationLock(key);
      this.state.externalAutopilotBusy = false;
    }
  }

  private async recordApplication(job: { url: string; title: string; company: string }): Promise<void> {
    const stableUrl = job.url || location.href.split("?")[0];
    const appRecord = {
      id: `app_${Date.now()}`,
      jobId: stableUrl,
      url: stableUrl,
      title: job.title || document.title || "Applied Role",
      company: job.company || location.hostname,
      stage: "applied" as const,
      appliedAt: Date.now(),
      updatedAt: Date.now(),
      source: "external-ats",
    };
    await addApplication(appRecord as any);
    void reportApplicationToCloud(appRecord);
    void recordApplicationQuota();
    const key = jobKey(stableUrl, job.title, job.company);
    setApplicationPhase(key, "SUBMITTED", { url: stableUrl, title: job.title, company: job.company });
    statusMachine.transition(AutofillStatus.SUBMITTED, { jobId: stableUrl, company: job.company, title: job.title });
    void diagLog("external-autopilot", "recorded-application", { data: { title: job.title, company: job.company, url: stableUrl } });
  }

  private async submitWithConfirmation(job: { url: string; title: string; company: string }): Promise<void> {
    const message = "Submit was clicked, but the ATS did not confirm receipt. Check the application page; it has not been marked as applied.";
    const outcome = await attemptExternalSubmission(
      () => clickFormAdvance(true) === "submit",
      () => waitForExternalSubmissionConfirmation(),
      () => this.recordApplication(job),
      () => {
        this.state.externalVerifyStepPaused = true;
        this.cb.getPanel()?.setVerifyPrompt(false);
        this.cb.getPanel()?.setStatus(`⚠ ${message}`);
        statusMachine.transition(AutofillStatus.PAUSED, { reason: "manual", message });
      }
    );
    if (outcome === "confirmed") this.state.lastExternalStepHash = "";
  }

  startSubmitCountdown(onComplete: () => Promise<void>): void {
    this.clearCountdown();
    let seconds = 3; // Operation Zero-Defect: Dropped from 10s to 3s for faster autonomous apply
    this.cb.getPanel()?.setSubmitCountdownActive(true);
    this.cb.getPanel()?.setSubmitCountdown(seconds);
    this.cb.getPanel()?.setStatus(`Reviewing final step — auto-submitting in ${seconds}s`);

    this.countdownInterval = setInterval(() => {
      seconds--;
      this.cb.getPanel()?.setSubmitCountdown(seconds);
      this.cb.getPanel()?.setStatus(`Reviewing final step — auto-submitting in ${seconds}s`);
      if (seconds <= 0) {
        this.clearCountdown();
        void onComplete().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.cb.getPanel()?.setStatus(`⚠ Submission could not be completed: ${message}`);
          void diagLog("external-autopilot", "submit-countdown-failed", { level: "error", message });
        });
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

  async submitImmediately(key: string): Promise<void> {
    this.clearCountdown();
    this.state.externalVerifyStepPaused = false;
    statusMachine.transition(AutofillStatus.ADVANCING, { step: 0 });
    this.cb.getPanel()?.setStatus("🤖 Submitting immediately…");
    const job = extractJobFromPage();
    await this.submitWithConfirmation(job);
  }

  cancelCountdown(): void {
    this.clearCountdown();
    this.state.externalVerifyStepPaused = true;
    this.cb.getPanel()?.setStatus("⏸ Auto-submit paused. Review and submit manually.");
    statusMachine.transition(AutofillStatus.PAUSED, { reason: "manual" });
  }

  /**
   * FIX: Retry autofill with exponential backoff for transient network failures
   */
  private async retryAutofillWithBackoff(key: string, maxRetries: number): Promise<{ filled: number; skipped: number } | null> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await withAutofillGuard(async () => {
          await refreshApplicationLock(key);
          return this.cb.runAutofill(false);
        });
        
        if (result && result.filled > 0) {
          if (attempt > 0) {
            void diagLog("external-autopilot", "retry-success", {
              message: `Autofill succeeded on retry ${attempt + 1}`,
              data: { filled: result.filled, skipped: result.skipped }
            });
          }
          return result;
        }
        
        // Zero fields filled - might be transient issue, retry
        if (attempt < maxRetries - 1) {
          const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          void diagLog("external-autopilot", "retry-zero-fields", {
            level: "warn",
            message: `Zero fields filled on attempt ${attempt + 1}, retrying after ${delayMs}ms`,
            data: { attempt: attempt + 1, maxRetries }
          });
          await sleep(delayMs);
          continue;
        }
        
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries - 1) {
          const delayMs = 1000 * Math.pow(2, attempt);
          void diagLog("external-autopilot", "retry-error", {
            level: "warn",
            message: `Autofill failed on attempt ${attempt + 1}: ${lastError.message}`,
            data: { attempt: attempt + 1, maxRetries, delayMs }
          });
          await sleep(delayMs);
          continue;
        }
      }
    }
    
    if (lastError) {
      void diagLog("external-autopilot", "retry-exhausted", {
        level: "error",
        message: `All ${maxRetries} autofill attempts failed: ${lastError.message}`
      });
    }
    return null;
  }

  /**
   * FIX: Check CAPTCHA visibility before pausing (prevent false positives)
   */
  private hasCaptcha(): boolean {
    const selectors = [
      ".g-recaptcha", ".h-captcha",
      "[id*='cf-turnstile']", "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha.com']", "iframe[src*='arkoselabs.com']",
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          // FIX: Check visibility - must have non-zero dimensions and be in viewport
          if (rect.width > 0 && rect.height > 0) {
            const style = getComputedStyle(el as HTMLElement);
            if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) {
              return true;
            }
          }
        }
      } catch {}
    }
    return false;
  }

  private dismissCookieBanners(): void {
    const popupSelectors = [
      "#credential_picker_container",
      "iframe[id='google-one-tap-iframe']",
      "#credential_picker_iframe",
      "[id*='google-one-tap']",
      "iframe[src*='autofill.yandex.ru']",
      "[class*='LoginPromptContent_']"
    ];

    const roots = collectDeepRoots();
    for (const root of roots) {
      for (const selector of popupSelectors) {
        try {
          const els = (root as any).querySelectorAll(selector);
          for (const el of els) {
            if (el && (el as HTMLElement).style.display !== "none") {
              (el as HTMLElement).style.display = "none";
              (el as HTMLElement).style.setProperty("display", "none", "important");
            }
          }
        } catch {}
      }
    }

    const patterns = [
      /accept\s*all\s*cookies/i, /accept\s*all/i, /accept\s*cookies/i,
      /allow\s*all\s*cookies/i, /allow\s*all/i, /agree\s*to\s*all/i,
      /i\s*accept/i, /^accept$/i, /i\s*agree/i, /^agree$/i,
      /got\s*it/i, /accept\s*&\s*close/i, /allow\s*cookies/i, /consent\s*to\s*all/i,
      /agree\s*&\s*continue/i, /accept\s*recommended/i, /allow\s*recommended/i,
      /^ok$/i, /close\s*cookie/i
    ];

    for (const root of roots) {
      try {
        const buttons = Array.from((root as any).querySelectorAll("button, [role='button'], a.btn, input[type='button']")) as HTMLElement[];
        for (const btn of buttons) {
          const rect = (btn as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const text = (btn.textContent || (btn as HTMLInputElement).value || "").trim();
          if (patterns.some((p) => p.test(text))) {
            (btn as HTMLElement).click();
            void diagLog("autopilot", "dismiss-cookie-banner", { data: { text } });
          }
        }
      } catch {}
    }
  }

  private clickApplyButton(): boolean {
    const { fields } = scanPage?.() ?? { fields: [] };
    if (isApplicationForm(fields)) return false;
    const applyPatterns = [
      /^apply\s+now$/i, /^apply\s+for\s+this\s+job$/i, /^apply$/i,
      /^start\s+application$/i, /^job\s+apply$/i, /^begin\s+application$/i,
      /^apply\s+here$/i, /^apply\s+on\s+.*$/i, /^continue\s+to\s+apply$/i,
      /^submit\s+application$/i, /^create\s+profile$/i, /^sign\s+in\s+to\s+apply$/i,
    ];
    const buttons = Array.from(document.querySelectorAll("button, a, [role='button'], input[type='submit']"));

    // Score candidates so we pick the most visible / primary CTA, not a hidden
    // duplicate that some career pages nest inside nav/aside/script templates.
    // (Earlier builds would pick the first DOM match and click hidden Apply
    // links in sidebars, which made the autopilot appear stuck — navigation
    // fired but to the wrong destination or to no destination at all.)
    let best: HTMLElement | null = null;
    let bestScore = -1;
    let bestText = "";
    for (const btn of buttons) {
      const el = btn as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 16) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) continue;
      // Require element to be inside the viewport-ish area (skip fixed navs/footers)
      if (rect.bottom < 0 || rect.top > (window.innerHeight + 200)) continue;
      const text = (el.textContent || (el as HTMLInputElement).value || "").replace(/\s+/g, " ").trim();
      if (!applyPatterns.some((p) => p.test(text))) continue;
      if (el instanceof HTMLAnchorElement && el.href.startsWith("mailto:")) continue;

      // Skip buttons inside obvious non-content containers (nav, footer, aside,
      // cookie banners, hidden modals).
      let insideBlocklist = false;
      let cur: HTMLElement | null = el;
      for (let i = 0; i < 6 && cur; i++, cur = cur.parentElement) {
        const tag = cur.tagName;
        if (tag === "NAV" || tag === "FOOTER" || tag === "ASIDE") { insideBlocklist = true; break; }
        const cls = typeof cur.className === "string" ? cur.className : "";
        if (/cookie|banner|nav|footer|sidebar|hidden|modal/i.test(cls)) { insideBlocklist = true; break; }
      }
      if (insideBlocklist) continue;

      // Score: prefer "Apply Now" / "Start application" in the main page area,
      // with larger size (primary CTA) and higher placement (near top).
      let score = 0;
      if (/apply\s+now|start\s+application|begin\s+application|apply\s+for\s+this/i.test(text)) score += 20;
      if (/^apply$/i.test(text)) score += 10;
      score += Math.min(rect.width * rect.height / 1000, 30); // bigger CTA scores higher, capped
      score += Math.max(0, 40 - Math.floor(rect.top / 20)); // higher on page (lower top) scores higher
      if (score > bestScore) {
        best = el;
        bestScore = score;
        bestText = text;
      }
    }

    if (best) {
      best.click();
      void diagLog("autopilot", "click-external-apply", { data: { text: bestText, score: bestScore } });
      return true;
    }
    return false;
  }
}