import { createProfile, normalizeQuestion } from "@superjob/core";
import { fillField } from "@/lib/filler.js";
import { diagLog } from "@/lib/diagnostics.js";
import { getLinkedInJobId, clickNextButton, isLinkedInSubmitButtonPresent } from "@/lib/linkedin-autopilot.js";
import { mountPanel, type SidePanelHandle } from "@/lib/side-panel.js";
import { clickFormAdvance, detectPageStepLabel, isSubmitButtonPresent } from "@/lib/navigation.js";
import { jobKey, setApplicationPhase } from "@/lib/app-state.js";
import { waitForPageTransition } from "@/lib/navigation.js";
import { ensureResumeAvailable } from "@/lib/resume-store.js";
import { installSubmitGuard } from "@/lib/submit-guard.js";
import { addApplication, getAgentSettings, getProfile, saveProfile } from "@/lib/store.js";
import { reportApplicationToCloud } from "@/lib/sync/sync-client.js";
import { recordApplicationQuota } from "@/lib/quota/quota-client.js";
import { statusMachine } from "@/lib/lifecycle/status-machine.js";
import { AutofillStatus } from "@/lib/lifecycle/status-events.js";
import { scanPage } from "@/lib/autofill.js";
import { extractJobFromPage } from "@/lib/job-extract.js";
import { isLinkedInEasyApplyOpen, isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { isApplicationForm } from "@/lib/detector.js";
import { openExternalApplyTab } from "@/lib/linkedin-external-apply.js";
import type { AutopilotState } from "@/lib/autopilot/autopilot-state.js";
import type { LinkedInAutopilotEngine } from "@/lib/autopilot/linkedin-autopilot-engine.js";
import type { ExternalAutopilotEngine } from "@/lib/autopilot/external-autopilot-engine.js";
import type { AutofillResponse } from "@/lib/messaging.js";

export interface PanelCoordinatorDeps {
  state: AutopilotState;
  getPanel: () => SidePanelHandle | null;
  setPanel: (panel: SidePanelHandle | null) => void;
  runAutofill: (track?: boolean) => Promise<AutofillResponse>;
  refreshScore: () => Promise<void>;
  runCoverLetterGeneration: () => Promise<void>;
  runResumeTailoring: () => Promise<void>;
  resumeAfterOtp: () => Promise<void>;
  tryAutoLogin: () => Promise<void>;
  setupOtpWatch: () => void;
  linkedInEngine: LinkedInAutopilotEngine;
  externalEngine: ExternalAutopilotEngine;
  applyJobChange: (jobId: string) => void;
}

export function createPanelCoordinator(deps: PanelCoordinatorDeps) {
  const { state, getPanel, setPanel, runAutofill, refreshScore, runCoverLetterGeneration, runResumeTailoring, resumeAfterOtp, tryAutoLogin, setupOtpWatch, linkedInEngine, externalEngine, applyJobChange } = deps;

  function setupPageAgent(): void {
    if (state.pageAgentStarted) return;
    state.pageAgentStarted = true;
    installSubmitGuard();
    void ensureResumeAvailable().then((ok) => { if (ok) void diagLog("profile", "resume-restored", { message: "Resume PDF available" }); });
    setupOtpWatch();
  }

  function tryMount(): void {
    const { platform, fields, hint } = scanPage();
    const onLinkedIn = isLinkedInJobsUrl();
    const easyApplyOpen = isLinkedInEasyApplyOpen();
    const looksLikeJob = onLinkedIn || (platform !== null && (!onLinkedIn || easyApplyOpen || fields.length > 0)) ||
      fields.length >= 4 || /apply|career|ripplehire|infosys|jobapply/i.test(location.href);

    let panel = getPanel();
    if (!looksLikeJob) {
      if (panel) {
        const isCurrentlyOnLinkedIn = location.hostname.includes("linkedin.com");
        const isCurrentlyOnLinkedInJobs = isLinkedInJobsUrl();
        if (isCurrentlyOnLinkedIn && !isCurrentlyOnLinkedInJobs) {
          document.getElementById("sja-persistent-docked-panel-container")?.remove();
          setPanel(null);
        }
      }
      return;
    }

    if (!panel || !document.getElementById("sja-persistent-docked-panel-container")) {
      panel = mountPanel({
        onAutofill: async () => {
          if (isLinkedInJobsUrl() && !isLinkedInEasyApplyOpen()) {
            getPanel()?.setStatus("🤖 Starting application...");
            await linkedInEngine.run();
          } else if (!isLinkedInJobsUrl()) {
            const { fields } = scanPage();
            if (!isApplicationForm(fields)) {
              getPanel()?.setStatus("🤖 Clicking Apply to start application...");
              await externalEngine.run();
            } else {
              await runAutofill(true);
            }
          } else {
            await runAutofill(true);
          }
        },
        onOpenExternalApply: async (url: string) => {
          getPanel()?.setStatus("🌐 Opening external ATS in new tab…");
          const tabId = await openExternalApplyTab(url, { active: true });
          if (tabId) getPanel()?.setStatus("✓ External ATS opened — autopilot will fill it.");
          else getPanel()?.setStatus("⚠ Couldn't open external tab.");
        },
        onContinue: async () => {
          getPanel()?.setNeedsUser(false);
          state.verifyStepPaused = false;
          state.externalVerifyStepPaused = false;
          const result = await runAutofill(false);
          if (isLinkedInJobsUrl() && !result.missingFields?.length) {
            linkedInEngine.scheduleRun(300);
          }
        },
        onNextStep: async () => {
          let action: any;
          if (isLinkedInJobsUrl() && isLinkedInEasyApplyOpen()) {
            action = await clickNextButton(false);
          } else {
            action = clickFormAdvance(false);
          }
          getPanel()?.setStatus(action ? "→ Clicked Next — filling…" : "No Next button found");
          setTimeout(() => void runAutofill(false), 1500);
        },
        onResumeOtp: () => void resumeAfterOtp(),
        onTailorResume: () => void runResumeTailoring(),
        onGenerateCoverLetter: () => void runCoverLetterGeneration(),
        onAnswerMissingField: async (field: any, value: string) => {
          try {
            await fillField(field, value);
            const norm = normalizeQuestion(field.label);
            const profile = await getProfile();
            if (profile) { profile.customAnswers[norm] = value; await saveProfile(profile); }
            void diagLog("autofill", "learned-missing-field", { data: { label: field.label, value } });
            void refreshScore();
            if (isLinkedInJobsUrl() && isLinkedInEasyApplyOpen()) {
              // Re-run the same step immediately. If no unresolved questions
              // remain, the LinkedIn engine resumes its normal auto-next flow.
              state.verifyStepPaused = false;
              linkedInEngine.scheduleRun(250);
            }
          } catch (err) { void diagLog("autofill", "answer-missing-error", { level: "error", message: String(err) }); }
        },
        onApproveStep: async () => {
          state.verifyStepPaused = false; state.externalVerifyStepPaused = false;
          getPanel()?.setStatus("🤖 Approved step — continuing autopilot…");
          if (isLinkedInJobsUrl()) {
            const settings = await getAgentSettings();
            const jobId = getLinkedInJobId();
            const profile = await getProfile();
            if (profile && settings.autoAdvanceSteps) {
              const isSubmit = isLinkedInSubmitButtonPresent();
              const action = await clickNextButton(isSubmit || settings.autoSubmit);
              await linkedInEngine.handleAdvance(action, jobId, profile);
            }
          } else {
            const settings = await getAgentSettings();
            if (settings.autoAdvanceSteps) {
              const isSubmit = isSubmitButtonPresent();
              const advanced = clickFormAdvance(isSubmit || settings.autoSubmit);
              if (advanced) {
                if (isSubmit) {
                  const job = extractJobFromPage();
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
                  const k = jobKey(stableUrl, job.title, job.company);
                  setApplicationPhase(k, "SUBMITTED", { url: stableUrl, title: job.title, company: job.company });
                  statusMachine.transition(AutofillStatus.SUBMITTED, { jobId: stableUrl, company: job.company, title: job.title });
                  void diagLog("external-autopilot", "recorded-application-approved", { data: { title: job.title, company: job.company, url: stableUrl } });
                }
                await waitForPageTransition(5000);
                state.lastExternalStepHash = "";
              }
            }
          }
        },
        onSkipJob: () => {
          const jobId = getLinkedInJobId();
          if (jobId) { linkedInEngine.stop(jobId, "✕ Skipped by user"); getPanel()?.setStatus("⏸ Autopilot skipped for this job"); }
        },
        onOnboardingComplete: async (obState) => {
          try {
            const nameParts = obState.name.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            const existingProfile = await getProfile();
            const updatedProfile = createProfile({ ...(existingProfile ?? {}), firstName, lastName, email: obState.email, phone: obState.phone, summary: obState.resumeText });
            await saveProfile(updatedProfile);
            void diagLog("onboarding", "completed", { message: "User onboarding completed and profile stored" });
            void refreshScore();
          } catch (err) {
            void diagLog("onboarding", "save-error", { level: "error", message: String(err) });
          }
        },
        onSubmitNow: async () => {
          const profile = await getProfile();
          if (isLinkedInJobsUrl()) {
            const jobId = getLinkedInJobId();
            if (profile) await linkedInEngine.submitImmediately(jobId, profile);
          } else {
            const job = extractJobFromPage();
            const key = jobKey(location.href.split("?")[0], job.title, job.company);
            await externalEngine.submitImmediately(key);
          }
        },
        onCancelSubmitCountdown: () => {
          if (isLinkedInJobsUrl()) linkedInEngine.cancelCountdown();
          else externalEngine.cancelCountdown();
        },
      });
      setPanel(panel);
      setupPageAgent();
      window.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const dismissBtn = target.closest("button.artdeco-modal__dismiss, [aria-label*='Dismiss'], [aria-label*='Dismiss Easy Apply']");
        if (dismissBtn) {
          const jobId = getLinkedInJobId();
          if (jobId) { linkedInEngine.stop(jobId, "⏸ Autopilot paused (modal closed)"); getPanel()?.setStatus("⏸ Autopilot paused (dismissed)"); }
        }
      }, true);
      void refreshScore();
    }

    getPanel()?.setPlatform(platform?.name ?? "Web form");
    const extractedJob = extractJobFromPage();
    getPanel()?.setPageContext({
      title: extractedJob.title,
      jobTitle: extractedJob.title,
      company: extractedJob.company,
      url: extractedJob.url
    });
    getPanel()?.setStep(detectPageStepLabel());
    if (hint && fields.length === 0 && !easyApplyOpen) getPanel()?.setStatus(hint);

    const jobId = getLinkedInJobId();
    if (onLinkedIn) {
      if (jobId) applyJobChange(jobId);
      linkedInEngine.scheduleRun(600);
    } else {
      void tryAutoLogin();
      void externalEngine.run();
    }
  }

  function ensureMounted(): void {
    // Force the panel to mount regardless of page heuristics. Used when the
    // user presses the toolbar icon / FAB / shortcut so the side panel is
    // always reachable even if the job-page detector is uncertain.
    if (!getPanel() || !document.getElementById("sja-persistent-docked-panel-container")) {
      tryMount();
    }
  }

  return { tryMount, setupPageAgent, ensureMounted };
}
