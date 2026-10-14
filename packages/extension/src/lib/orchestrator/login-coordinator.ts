import type { SidePanelHandle } from "@/lib/side-panel.js";
import type { AutopilotState } from "@/lib/autopilot/autopilot-state.js";
import { diagLog } from "@/lib/diagnostics.js";
import { extractJobFromPage } from "@/lib/job-extract.js";
import { jobKey, setApplicationPhase } from "@/lib/app-state.js";
import { getCredentialForHost } from "@/lib/credential-store.js";
import { autofillLogin, findOtpFields, isLoginPage, startOtpWatch, stopOtpWatch } from "@/lib/login-agent.js";
import { getAgentSettings, getProfile } from "@/lib/store.js";
import { statusMachine } from "@/lib/lifecycle/status-machine.js";
import { AutofillStatus } from "@/lib/lifecycle/status-events.js";
import type { AutofillResponse } from "@/lib/messaging.js";

export interface LoginCoordinatorDeps {
  state: AutopilotState;
  getPanel: () => SidePanelHandle | null;
  isRuntimeValid: () => boolean;
  runAutofill: (track?: boolean) => Promise<AutofillResponse>;
}

export function createLoginCoordinator({ state, getPanel, isRuntimeValid, runAutofill }: LoginCoordinatorDeps) {
  async function tryAutoLogin(): Promise<void> {
    if (!isRuntimeValid()) return;
    const host = location.hostname;
    if (state.loginAttemptedForHost === host) return;
    if (!isLoginPage()) return;
    const settings = await getAgentSettings();
    if (!settings.autoLogin) return;
    let cred = await getCredentialForHost(host);
    if (!cred) {
      const profile = await getProfile();
      if (profile?.defaultLoginEmail && profile?.defaultLoginPassword) {
        cred = { id: "default", hostname: host, email: profile.defaultLoginEmail, password: profile.defaultLoginPassword, updatedAt: Date.now() };
      }
    }
    if (!cred) return;
    state.loginAttemptedForHost = host;
    getPanel()?.setStatus("🔐 Filling login credentials…");
    const settings2 = await getAgentSettings();
    const result = await autofillLogin(cred, { autoSubmit: settings2.autoSubmitLogin });
    if (result.filled) getPanel()?.setStatus(result.submitted ? "🔐 Login submitted" : "🔐 Login filled — submit manually if needed");
  }

  function injectOtpCode(code: string): boolean {
    const fields = findOtpFields();
    if (fields.length === 0) return false;
    const clean = code.replace(/\D/g, "");
    if (fields.length === 1) {
      const input = fields[0];
      input.focus();
      input.value = clean;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (fields.length > 1) {
      for (let i = 0; i < Math.min(fields.length, clean.length); i++) {
        const input = fields[i];
        input.focus();
        input.value = clean[i];
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a.btn, input[type='submit']"));
    const verifyBtn = candidates.find((b) => {
      const txt = (b.textContent || (b as HTMLInputElement).value || "").trim().toLowerCase();
      return /verify|submit|continue|confirm|proceed|validate/i.test(txt);
    });
    if (verifyBtn) {
      setTimeout(() => verifyBtn.click(), 300);
    }

    void resumeAfterOtp();
    return true;
  }

  function setupOtpWatch(): void {
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "SJA:INJECT_OTP" && typeof msg.code === "string") {
          injectOtpCode(msg.code);
        } else if (msg?.type === "SJA:RESUME_AUTOPILOT") {
          void resumeAfterOtp();
        }
      });
    }

    void getAgentSettings().then((settings) => {
      if (settings.pauseOnOtp === false) return;
      startOtpWatch({
        onDetected: (count) => {
          if (state.otpPaused) return;
          state.otpPaused = true;
          const job = extractJobFromPage();
          const key = jobKey(location.href.split("?")[0], job.title, job.company);
          setApplicationPhase(key, "AWAITING_OTP", job);
          getPanel()?.setAwaitingOtp(true, count);
          getPanel()?.setStatus("⏸ Paused — enter OTP on page or in Review Queue");
          statusMachine.transition(AutofillStatus.PAUSED, { reason: "otp" });
          void diagLog("autopilot", "otp-pause", { data: { fields: count } });

          // Push to Review Queue so the user is alerted in SidePanel / notifications
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            void chrome.runtime.sendMessage({
              type: "SJA:PUSH_REVIEW_ITEM",
              payload: {
                jobId: key,
                jobTitle: job.title || "Authentication Verification Required",
                company: job.company || location.hostname,
                matchScore: 100,
                confidence: 100,
                tier: "HUMAN_REVIEW",
                reviewType: "otp",
                otpLength: count,
                jobUrl: location.href,
                filledFields: 0,
                totalFields: count,
                lowConfidenceFields: ["OTP / Verification Code"],
                tailoredResume: "",
                coverLetter: "",
                reasoning: [{ step: 0, thought: `Two-factor or OTP verification prompt detected on ${location.hostname}`, action: "PAUSE_FOR_HUMAN_OTP" }],
                createdAt: Date.now(),
                ttl: Date.now() + 15 * 60 * 1000,
                idempotencyKey: `otp-${key}-${Math.floor(Date.now() / 60000)}`,
                decision: "pending",
              },
            }).catch(() => null);
          }
        },
        onFilled: () => void resumeAfterOtp(),
      });
    });
  }

  async function resumeAfterOtp(): Promise<void> {
    if (!state.otpPaused) return;
    state.otpPaused = false;
    getPanel()?.setAwaitingOtp(false);
    getPanel()?.setStatus("OTP entered — continuing…");
    const job = extractJobFromPage();
    const key = jobKey(location.href.split("?")[0], job.title, job.company);
    setApplicationPhase(key, "IN_PROGRESS", job);
    await runAutofill(false);
  }

  return { tryAutoLogin, setupOtpWatch, resumeAfterOtp, stopOtpWatch, injectOtpCode };
}
