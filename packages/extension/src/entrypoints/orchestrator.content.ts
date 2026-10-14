import { defineContentScript } from "wxt/utils/define-content-script";
import { JOB_HOST_MATCHES } from "@/lib/permission-policy.js";

/**
 * Legacy injection target retained as a tiny compatibility shim.
 * The production heavy runtime is `content-scripts/agent.js`, injected by the
 * background service worker after permission-policy validation.
 */
export default defineContentScript({
  matches: [...JOB_HOST_MATCHES],
  registration: "runtime",
  main() {
    chrome.runtime.sendMessage({
      type: "SJA:INJECT_ORCHESTRATOR",
      payload: { url: location.href, reason: "legacy-orchestrator-shim" },
    }).catch(() => {});
  },
});
