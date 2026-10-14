/**
 * Tab-driven submitter for the fleet's LIVE mode.
 *
 * This is the honest bridge between the parallel fleet planner and the proven
 * single-tab autopilot engine. For each job the fleet decides to submit, we:
 *
 *   1. Open the job URL in a background tab.
 *   2. Wait for it to finish loading.
 *   3. Inject the orchestrator (agent.js) — the same runtime the popup/side
 *      panel use — and fire SJA:AUTOPILOT, exactly the path a user gets when
 *      they click "Auto-apply this job".
 *   4. Report how many fields the autopilot filled.
 *
 * We DO NOT claim silent end-to-end submission. Autopilot honors the user's
 * existing safety settings (autonomousMode / final-submit policy). If the user
 * has not enabled auto-submit, the tab is filled and left for review — which is
 * the truthful, safe behavior. The fleet UI labels this "assisted apply", not
 * "auto-submit".
 *
 * Tabs are heavy, so live mode runs at a low concurrency regardless of the
 * planner's worker count (enforced by the caller).
 */
import type { SubmitFn } from "@superjob/crew/fleet";
import { diagLog } from "./diagnostics.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForTabComplete(tabId: number, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  // Poll tab status; onUpdated can miss the transition for already-loaded tabs.
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return;
    } catch {
      return; // tab closed
    }
    await sleep(400);
  }
}

/**
 * Build a SubmitFn that drives the real autopilot in a background tab.
 * `openActive: false` keeps tabs in the background so a 10-job run doesn't
 * hijack the user's foreground.
 */
export function createTabSubmitter(opts: { openActive?: boolean } = {}): SubmitFn {
  return async ({ job }) => {
    let tabId: number | undefined;
    try {
      const tab = await chrome.tabs.create({ url: job.url, active: opts.openActive ?? false });
      tabId = tab.id;
      if (tabId == null) return { outcome: "no-tab", filledFields: 0, error: "Could not open tab" };

      await waitForTabComplete(tabId);
      await sleep(600); // let the page settle / SPA hydrate

      // Inject the orchestrator runtime (idempotent — guarded in-page).
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content-scripts/agent.js"],
        });
      } catch (e) {
        // chrome-extension:// and blocked pages can't be scripted.
        void diagLog("background", "fleet-submit-inject-failed", {
          level: "warn",
          data: { url: job.url, error: String(e) },
        });
      }
      await sleep(400);

      // Get a REAL fill count from the synchronous AUTOFILL handler. The
      // AUTOPILOT handler only replies {ok:true} and then runs the engine
      // asynchronously, so reading `filled` from its response always yielded 0.
      // AUTOFILL returns {filled, skipped} once the orchestrator has booted.
      let filled = 0;
      let delivered = false;
      for (let attempt = 0; attempt < 3 && !delivered; attempt++) {
        try {
          const res: any = await chrome.tabs.sendMessage(tabId, { type: "SJA:AUTOFILL" });
          delivered = true;
          if (res && typeof res === "object" && typeof res.filled === "number") {
            filled = res.filled;
          }
        } catch {
          await sleep(300 * (attempt + 1));
        }
      }

      if (!delivered) {
        return {
          outcome: "assist-unavailable",
          filledFields: 0,
          error: "Autopilot could not start on this page (unsupported or blocked).",
        };
      }

      // Now drive the full autopilot loop (open Easy Apply, fill each step,
      // advance, and submit ONLY if the user enabled auto-submit). Fire-and-
      // forget: the orchestrator honors the user's safety settings in storage.
      try {
        await chrome.tabs.sendMessage(tabId, { type: "SJA:AUTOPILOT" });
      } catch {
        // The AUTOFILL pass above already ran; autopilot advancement is a bonus.
      }

      return { outcome: "assisted", filledFields: filled };
    } catch (e) {
      return {
        outcome: "error",
        filledFields: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    // Note: we intentionally leave the tab open. The autopilot may be awaiting
    // user review/OTP/final-submit per the user's safety settings. Closing it
    // would destroy in-progress applications.
  };
}
