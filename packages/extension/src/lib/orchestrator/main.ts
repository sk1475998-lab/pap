/**
 * Content script orchestrator.
 *
 * Thin lifecycle coordinator for panel mount, page observation,
 * user interaction monitoring, autopilot scheduling, and message routing.
 * Feature logic lives in orchestrator/* coordinators to keep this entry chunk
 * maintainable and easier to audit.
 */
import { scanPage } from "@/lib/autofill.js";
import { diagLog, installExceptionLogging } from "@/lib/diagnostics.js";
import { extractJobFromPage, extractJobFromPageAsync, isJobPageUrl } from "@/lib/job-extract.js";
import { isLinkedInEasyApplyOpen, isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { mountPanel, type SidePanelHandle } from "@/lib/side-panel.js";
import { hydrateApplicationStates, purgeExpiredRecords } from "@/lib/app-state.js";
import { ensureResumeAvailable } from "@/lib/resume-store.js";
import { installSubmitGuard } from "@/lib/submit-guard.js";
import { getAgentSettings, getProfile } from "@/lib/store.js";
import { isChromeRuntimeValid } from "@/lib/runtime-guard.js";
import { MSG, type DetectResponse } from "@/lib/messaging.js";
import { installNetworkMonitor } from "@/lib/network-monitor.js";

import { PageObserver } from "@/lib/page-observer.js";
import { UserInteractionMonitor } from "@/lib/autopilot/user-interaction-monitor.js";
import { createAutopilotState, resetOnNavigation, resetLinkedInState, onJobChange as applyJobChange } from "@/lib/autopilot/autopilot-state.js";
import { createIdleDebouncedScheduler } from "@/lib/autopilot/event-scheduler.js";
import { LinkedInAutopilotEngine } from "@/lib/autopilot/linkedin-autopilot-engine.js";
import { ExternalAutopilotEngine } from "@/lib/autopilot/external-autopilot-engine.js";
import { createAutofillRunner, scheduleStepRefillFactory } from "@/lib/orchestrator/autofill-runner.js";
import { createJobIntelligence } from "@/lib/orchestrator/job-intelligence.js";
import { createLoginCoordinator } from "@/lib/orchestrator/login-coordinator.js";
import { createPanelCoordinator } from "@/lib/orchestrator/panel-coordinator.js";
import { mountLinkedInFab } from "@/lib/linkedin-fab.js";
import { statusMachine } from "@/lib/lifecycle/status-machine.js";

function setupPageWorldInterceptor(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;
    const type = event.data.type;
    if (type === "SJA_PAGE_ERROR") {
      void diagLog("content", "page-script-error", {
        level: "error",
        message: event.data.message || "Page script error",
        data: { stack: event.data.stack },
      });
    } else if (type === "SJA_PAGE_REJECTION") {
      void diagLog("content", "page-script-rejection", {
        level: "error",
        message: event.data.message || "Page script promise rejection",
        data: { stack: event.data.stack },
      });
    } else if (type === "SJA_PAGE_NETWORK_WARN") {
      // Skip chrome-extension:// probe noise (LinkedIn fingerprinting)
      const warnUrl: string = event.data.url ?? "";
      if (warnUrl.startsWith("chrome-extension://")) return;
      void diagLog("content", "page-network-warn", {
        level: "warn",
        message: `HTTP ${event.data.status} for ${warnUrl}`,
        data: { status: event.data.status, statusText: event.data.statusText },
      });
    } else if (type === "SJA_PAGE_NETWORK_ERROR") {
      const errUrl: string = event.data.url ?? "";
      if (errUrl.startsWith("chrome-extension://")) return;
      void diagLog("content", "page-network-error", {
        level: "error",
        message: `Fetch failed for ${errUrl}: ${event.data.error}`,
      });
    }
  });

}

/**
 * Create and wire the full content-script orchestrator.
 * Call once from content.ts main(). Idempotent: second call returns immediately
 * to prevent duplicate panels, listeners, and MutationObservers when the
 * background re-injects via chrome.scripting.executeScript.
 */
export async function createOrchestrator(): Promise<void> {
  if ((window as any).__SJA_ORCHESTRATOR_CREATED__) return;
  (window as any).__SJA_ORCHESTRATOR_CREATED__ = true;
  installExceptionLogging("content");
  installNetworkMonitor();
  setupPageWorldInterceptor();
  void hydrateApplicationStates().then(() => purgeExpiredRecords());

  const state = createAutopilotState();
  let panel: SidePanelHandle | null = null;
  let mountDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const getPanel = () => panel;
  const setPanel = (next: SidePanelHandle | null) => { panel = next; };

  let runAutofillRef: ReturnType<typeof createAutofillRunner>;
  const scheduleStepRefill = scheduleStepRefillFactory(state, (track) => runAutofillRef(track), isChromeRuntimeValid);
  const runAutofill = createAutofillRunner({ state, getPanel, scheduleStepRefill, getLastScore: () => state.lastScore });
  runAutofillRef = runAutofill;

  const jobIntelligence = createJobIntelligence({ state, getPanel, isRuntimeValid: isChromeRuntimeValid });

  const login = createLoginCoordinator({ state, getPanel, isRuntimeValid: isChromeRuntimeValid, runAutofill });

  const linkedInEngine = new LinkedInAutopilotEngine(state, {
    runAutofill: (track) => runAutofill(track),
    getPanel,
    getSettings: () => getAgentSettings(),
    getProfile: async () => (await getProfile()) ?? null,
    onStopped: (_jobId, _message) => { /* panel status already set by engine */ },
  });

  const externalEngine = new ExternalAutopilotEngine(state, {
    runAutofill: (track) => runAutofill(track),
    getPanel,
    getSettings: () => getAgentSettings(),
    getProfile: async () => (await getProfile()) ?? null,
    tryAutoLogin: () => login.tryAutoLogin(),
  });

  const panelCoordinator = createPanelCoordinator({
    state,
    getPanel,
    setPanel,
    runAutofill,
    refreshScore: jobIntelligence.refreshScore,
    runCoverLetterGeneration: jobIntelligence.runCoverLetterGeneration,
    runResumeTailoring: jobIntelligence.runResumeTailoring,
    resumeAfterOtp: login.resumeAfterOtp,
    tryAutoLogin: login.tryAutoLogin,
    setupOtpWatch: login.setupOtpWatch,
    linkedInEngine,
    externalEngine,
    applyJobChange: (jobId) => { applyJobChange(state, jobId); },
  });

  function debouncedTryMount(delayMs = 200): void {
    if (mountDebounceTimer) clearTimeout(mountDebounceTimer);
    mountDebounceTimer = setTimeout(() => panelCoordinator.tryMount(), delayMs);
  }

  const userMonitor = new UserInteractionMonitor(state, {
    onInterrupt: () => panel?.setStatus("⏸ Autopilot paused (User interacting...)"),
    onResume: () => {
      panel?.setStatus("🤖 User idle — resuming autopilot…");
      if (isLinkedInJobsUrl()) linkedInEngine.scheduleRun(500);
      else void externalEngine.run();
    },
  });
  userMonitor.install();

  const pageObserver = new PageObserver({
    onPageChange: (event) => {
      try {
        if (event.reason === "url") {
          resetOnNavigation(state);
          if (!isLinkedInJobsUrl()) {
            state.otpPaused = false;
            panel?.setAwaitingOtp(false);
          }
          debouncedTryMount(200);
          setTimeout(() => void jobIntelligence.refreshScore(), 300);
        } else if (event.reason === "structure") {
          debouncedTryMount(300);
          void externalEngine.run();
        } else if (event.reason === "linkedin-job-title" && event.newJobId) {
          applyJobChange(state, event.newJobId);
          linkedInEngine.scheduleRun(800);
        }
      } catch (e) {
        void diagLog("content", "observer-error", { level: "error", message: e instanceof Error ? e.message : String(e) });
      }
    },
  });
  pageObserver.start();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg?.type) {
          case MSG.DETECT: {
            const { platform, fields, hint, linkedInEasyApplyOpen } = scanPage();
            const job = await extractJobFromPageAsync();
            if (!isJobPageUrl(location.href) && !fields.length) { job.title = ""; job.company = ""; }
            sendResponse({ platform: platform?.id ?? null, fields: fields.slice(0, 200), job, hint, linkedInEasyApplyOpen } satisfies DetectResponse);
            break;
          }
          case MSG.AUTOFILL:
            sendResponse(await runAutofill(true));
            break;
          case MSG.GET_MATCH:
            sendResponse(await jobIntelligence.getMatchResponse());
            break;
          case MSG.CLEAR_PATTERNS: {
            try {
              const { clearAllPatterns, clearPatternsForOrigin } = await import("../pattern-cache.js");
              const scope = (msg as any)?.scope;
              if (scope === "origin") {
                await clearPatternsForOrigin(location.origin);
              } else {
                await clearAllPatterns();
              }
              sendResponse({ ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
            }
            break;
          }
          case "SJA:AUTOPILOT":
            resetLinkedInState(state, "manual-trigger");
            state.externalVerifyStepPaused = false;
            state.userInterrupted = false;
            state.autopilotDoneForJob = "";
            linkedInEngine.resetExternalMemo(); // allow re-opening the external ATS on a fresh run
            state.verifyStepPaused = false;
            // Reset lifecycle machine so stale SUBMITTED state from a prior job
            // never blocks a fresh run (this is what produced the
            // "Invalid transition: SUBMITTED -> FILLING" spam).
            try { statusMachine.reset("autopilot-trigger"); } catch { /* */ }
            // Ensure the side panel is mounted / visible for the new run.
            try { panelCoordinator.ensureMounted?.(); } catch { /* */ }
            if (isLinkedInJobsUrl()) {
              linkedInEngine.scheduleRun(100);
            } else {
              externalEngine.armKickstart();
              void externalEngine.run();
            }
            sendResponse({ ok: true });
            break;
          case "SJA:START_AUTONOMOUS_APPLY":
            // Fired by LinkedIn external-apply tab opener to kick off external autopilot.
            state.externalVerifyStepPaused = false;
            state.externalAutofillDone = "";
            state.lastExternalStepHash = "";
            state.externalAutopilotBusy = false;
            try { statusMachine.reset("external-apply-start"); } catch { /* */ }
            externalEngine.armKickstart();
            void externalEngine.run();
            sendResponse({ ok: true });
            break;
          case "SJA:NAV":
            resetOnNavigation(state);
            state.autopilotDoneForJob = "";
            state.trackedJobId = "";
            setTimeout(panelCoordinator.tryMount, 500);
            sendResponse({ ok: true });
            break;
          default:
            sendResponse(undefined);
        }
      } catch (e) {
        sendResponse({ error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  });

  panelCoordinator.tryMount();
  panelCoordinator.setupPageAgent();
  setTimeout(panelCoordinator.tryMount, 500);
  setTimeout(() => { void jobIntelligence.refreshScore(); linkedInEngine.scheduleRun(200); }, 1000);

  // LinkedIn FAB (shadow-DOM floating pill). No-op on non-LinkedIn pages.
  const unmountFab = isLinkedInJobsUrl() ? mountLinkedInFab() : null;

  // External ATS work is driven by route/form changes instead of a fixed
  // 1.5-second DOM scan. Mutation bursts are coalesced and run when idle.
  const externalScheduler = createIdleDebouncedScheduler(() => {
    if (!isChromeRuntimeValid() || isLinkedInJobsUrl()) return;
    return externalEngine.run();
  });
  const externalPageObserver = new MutationObserver(() => externalScheduler.schedule());
  externalPageObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", externalScheduler.schedule);
  window.addEventListener("hashchange", externalScheduler.schedule);
  externalScheduler.schedule();

  // FIX: Instantiate ApplyButtonDetector for job discovery on external sites
  const { ApplyButtonDetector } = await import("@superjob/ats-config");
  const applyDetector = new ApplyButtonDetector({
    interceptClicks: false, // Don't block clicks, just detect
    autoDetect: true,
    observeDebounce: 300,
  });
  applyDetector.start();
  void diagLog("orchestrator", "apply-detector-started", { 
    message: "Apply button detector initialized for autonomous job discovery" 
  });

  // LinkedIn-specific: watch for the Easy Apply modal appearing (e.g., user
  // clicked Easy Apply manually, or LinkedIn animated it in). Coalesce bursts
  // so we don't thrash the engine while the modal is still rendering.
  let linkedInModalDebounce: ReturnType<typeof setTimeout> | null = null;
  let linkedInModalSeen = false;
  if (isLinkedInJobsUrl()) {
    const linkedInModalObserver = new MutationObserver(() => {
      const isOpen = isLinkedInEasyApplyOpen();
      if (isOpen && !linkedInModalSeen) {
        linkedInModalSeen = true;
        if (linkedInModalDebounce) clearTimeout(linkedInModalDebounce);
        linkedInModalDebounce = setTimeout(() => {
          void getAgentSettings().then((s) => {
            if (s.autonomousMode && (s.autoFillSteps || s.autoAdvanceSteps)) {
              resetLinkedInState(state, "modal-appeared");
              state.verifyStepPaused = false;
              state.autopilotDoneForJob = "";
              linkedInEngine.scheduleRun(400);
            }
          });
        }, 500);
        panelCoordinator.tryMount();
      } else if (!isOpen) {
        linkedInModalSeen = false;
      }
    });
    linkedInModalObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "role", "aria-modal"] });
  }

  const cleanup = () => {
    externalScheduler.stop();
    externalPageObserver.disconnect();
    window.removeEventListener("popstate", externalScheduler.schedule);
    window.removeEventListener("hashchange", externalScheduler.schedule);
    pageObserver.stop();
    userMonitor.uninstall();
    login.stopOtpWatch();
    applyDetector.stop();
    if (unmountFab) unmountFab();
    if (panel) {
      document.getElementById("sja-persistent-docked-panel-container")?.remove();
      panel = null;
    }
  };

  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("beforeunload", cleanup, { once: true });
}
