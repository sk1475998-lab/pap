import type { AutofillResponse } from "@/lib/messaging.js";
import type { SidePanelHandle } from "@/lib/side-panel.js";
import type { AutopilotState } from "@/lib/autopilot/autopilot-state.js";
import { detectStepChange } from "@superjob/core";
import { autofill, scanPage } from "@/lib/autofill.js";
import { diagLog } from "@/lib/diagnostics.js";
import { extractJobFromPage } from "@/lib/job-extract.js";
import { isLoginPage } from "@/lib/login-agent.js";
import { ensureResumeAvailable } from "@/lib/resume-store.js";
import { addApplication, getAgentSettings, getLLM, getProfile, getProfileLookup, saveProfile } from "@/lib/store.js";
import { reportApplicationToCloud } from "@/lib/sync/sync-client.js";
import { detectATSPlatform } from "@/lib/ats-detector.js";

export interface AutofillRunnerDeps {
  state: AutopilotState;
  getPanel: () => SidePanelHandle | null;
  scheduleStepRefill: () => void;
  getLastScore: () => number;
}

function isValidApplicationUrl(url: string): boolean {
  return !/post-apply|next-best-action|ApplicationMethods|applicationmethods|thank.?you|confirmation|success|already.?applied/i.test(url);
}

export function createAutofillRunner({ state, getPanel, scheduleStepRefill, getLastScore }: AutofillRunnerDeps): (track?: boolean) => Promise<AutofillResponse> {
  return async function runAutofill(track = false): Promise<AutofillResponse> {
    const panel = getPanel();
    if (state.autofillRunning) {
      void diagLog("autofill", "concurrent-blocked", { message: "Concurrent autofill attempt blocked" });
      return { filled: 0, skipped: 0, details: [], aiAnswered: 0 };
    }
    state.autofillRunning = true;
    state.autofillLastStart = Date.now();

    try {
      if (state.otpPaused) {
        panel?.setStatus("⏸ Paused for OTP — enter code then Resume");
        return { filled: 0, skipped: 0, details: [], aiAnswered: 0 };
      }
      await ensureResumeAvailable();
      const profile = await getProfile();
      if (!profile) return { filled: 0, skipped: 0, details: [], aiAnswered: 0 };
      const lookup = await getProfileLookup();
      const llm = await getLLM();

      const atsPlatform = detectATSPlatform();
      if (atsPlatform) {
        void diagLog("autofill", "ats-detected", { data: { platform: atsPlatform.platform.id, name: atsPlatform.platform.name, confidence: atsPlatform.confidence, method: atsPlatform.method } });
        panel?.setStatus(`🤖 Detected ${atsPlatform.platform.name} — filling fields…`);
      }

      panel?.setStatus("🤖 Filling fields…");
      const settings = await getAgentSettings();
      void diagLog("autofill", "start", {
        data: {
          profileKeys: Object.keys(profile).sort(),
          lookupSample: Object.fromEntries(Object.entries(lookup).slice(0, 5).map(([k,v]) => [k, typeof v === "string" ? v.slice(0,30) : typeof v])),
        }
      });
      const result = await autofill(lookup, profile, llm, {
        onProgress: (msg: string) => getPanel()?.setStatus(msg),
        onFieldFilled: async (entry) => {
          getPanel()?.addFillLogEntry(entry);
          try {
            const { getFillHistory, saveFillHistory } = await import("@/lib/store.js");
            const job = extractJobFromPage();
            const history = await getFillHistory();
            history.push({ id: `fh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), url: location.href, company: job.company || "Web", jobTitle: job.title || "Job Form", label: entry.label, value: entry.value, filledBy: "AI" });
            await saveFillHistory(history.slice(-300));
          } catch {}
        },
        showCursor: settings.autonomousMode,
      });

      await saveProfile(profile);
      state.lastAutofillFieldCount = result.fields?.length ?? 0;

      const missingFields = (result as any).missingFields ?? [];
      getPanel()?.setMissingFields(missingFields);
      getPanel()?.setNeedsUser(missingFields.length > 0);

      void diagLog("autofill", "complete", { data: { filled: result.filled, skipped: result.skipped, aiAnswered: result.aiAnswered } });
      const statusMsg = `${result.filled} filled, ${result.skipped} skipped`;
      if (missingFields.length > 0) {
        getPanel()?.setStatus(`${statusMsg} — fill ${missingFields.length} field(s) manually, then Continue`);
      } else {
        const tip = result.audit?.recommendations[0];
        getPanel()?.setStatus(tip ? `${statusMsg} · ${tip.slice(0, 55)}` : statusMsg);
      }
      if (result.skipped > 0) scheduleStepRefill();

      if (track && !Boolean(document.querySelector('input[type="password"]')) && !isLoginPage() && isValidApplicationUrl(extractJobFromPage().url)) {
        const job = extractJobFromPage();
        const appItem = { id: `app_${Date.now()}`, jobId: job.url, url: job.url, title: job.title, company: job.company, stage: "saved" as const, updatedAt: Date.now(), matchScore: getLastScore() };
        await addApplication(appItem as any);
        void reportApplicationToCloud(appItem);
      }
      return {
        filled: result.filled,
        skipped: result.skipped,
        details: result.details,
        aiAnswered: result.aiAnswered,
        missingFields,
      };
    } catch (e) {
      void diagLog("autofill", "error", {
        level: "error",
        message: e instanceof Error ? e.message : String(e),
        data: { stack: e instanceof Error ? e.stack : undefined },
      });
      // Don't throw — surface the error back to the caller as part of the response
      // so the UI can show it instead of the message port closing.
      return {
        filled: 0, skipped: 0, details: [], aiAnswered: 0,
        error: e instanceof Error ? `${e.message}\n${e.stack?.split("\n").slice(0,5).join("\n") ?? ""}` : String(e),
      } as any;
    } finally {
      state.autofillRunning = false;
      state.autofillLastEnd = Date.now();
    }
  };
}

export function scheduleStepRefillFactory(state: AutopilotState, runAutofill: (track?: boolean) => Promise<AutofillResponse>, isRuntimeValid: () => boolean): () => void {
  let stepRefillTimer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (stepRefillTimer) clearTimeout(stepRefillTimer);
    stepRefillTimer = setTimeout(() => {
      if (!isRuntimeValid()) return;
      const { fields } = scanPage();
      if (detectStepChange(state.lastAutofillFieldCount, "", fields.length, "")) {
        state.lastAutofillFieldCount = fields.length;
        void diagLog("audit", "step-detected", { message: "New form step detected — re-running autofill", data: { fields: fields.length } });
        void runAutofill(false);
      }
    }, 800);
  };
}
