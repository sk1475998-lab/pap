import { defineContentScript } from "wxt/utils/define-content-script";
import { detectATSPlatform } from "@/lib/ats-detector.js";
import { isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { JOB_HOST_MATCHES, decideInjectionForUrl } from "@/lib/permission-policy.js";

export default defineContentScript({
  // Match all URLs so the detector can run on arbitrary company career pages
  // (the actual heavy orchestrator is still gated by decideInjectionForUrl +
  // the form/input heuristic below, and is only injected on demand).
  matches: ["<all_urls>"],
  allFrames: true,
  runAt: "document_idle",
  main() {
    let orchestratorInjected = false;

    function checkAndInject(force = false) {
      if (orchestratorInjected && !force) return;

      // Fast-path: known job hosts always pass. For unknown hosts, require either
      // a job-URL keyword, enough form inputs, or an explicit user-triggered force.
      const urlMatches = /apply|career|recruit|job|workday|greenhouse|lever|ashby|icims|position|opening|resume|cv/i.test(location.href);
      const policy = decideInjectionForUrl(location.href);

      const hasLinkedIn = isLinkedInJobsUrl();
      const hasAts = hasLinkedIn ? null : detectATSPlatform();
      const inputs = document.querySelectorAll("input:not([type=hidden]), select, textarea");
      const inFrame = window.top !== window;
      const looksLikeForm =
        inputs.length >= 4 ||
        (inFrame && inputs.length > 0 && document.querySelector("form") !== null);
      const isJobPage = force || hasLinkedIn || !!hasAts || looksLikeForm || policy.allowed;

      if (!isJobPage) return;

      // If policy doesn't outright allow (e.g. unknown http(s) page), we only
      // auto-inject when the URL looks like a job page OR there's a big form.
      // The background will still attempt executeScript thanks to activeTab or
      // optional <all_urls> host permission.
      orchestratorInjected = true;
      chrome.runtime.sendMessage(
        { type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: force ? "manual" : (policy.allowed ? policy.reason : "form-heuristic") } },
        (response) => {
          const error = chrome.runtime.lastError?.message ||
            (response?.ok === false ? response.error : undefined);
          if (error) console.warn("[Super Job Agent] Autofill injection failed:", error);
        }
      );
    }

    // Check immediately on load
    checkAndInject();

    // Check on DOM modifications to support dynamic SPA transitions (debounced).
    // Watch childList + attributes (class/role/style) because many SPAs toggle
    // visibility rather than adding/removing nodes when steps mount.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        checkAndInject();
      }, 400);
    });
    observer.observe(document.body ?? document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "role", "aria-hidden", "style"],
    });

    // Proactive re-checks for SPAs that render forms without producing many
    // mutations (Workday/Taleo/Oracle sometimes show a spinner then mount the
    // form in one pass). The INJECT_ORCHESTRATOR message is idempotent thanks
    // to the __SJA_ORCHESTRATOR_CREATED__ guard in the orchestrator.
    setTimeout(() => checkAndInject(), 1500);
    setTimeout(() => checkAndInject(), 4000);
    setTimeout(() => checkAndInject(), 8000);

    const trustedDashboardOrigin = (origin: string): Promise<boolean> => new Promise((resolve) => {
      chrome.storage.local.get("sja_cloud_url", (stored) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        try {
          const apiUrl = typeof stored.sja_cloud_url === "string" && stored.sja_cloud_url
            ? stored.sja_cloud_url
            : "http://localhost:3001/api";
          const configured = new URL(apiUrl);
          const sender = new URL(origin);
          const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
          resolve(
            sender.origin === configured.origin ||
            (sender.protocol === configured.protocol &&
              sender.port === configured.port &&
              isLoopback(sender.hostname) &&
              isLoopback(configured.hostname)),
          );
        } catch {
          resolve(false);
        }
      });
    });

    const postSyncResult = (response?: { ok?: boolean; error?: string }, runtimeError?: string) => {
      const ok = !runtimeError && response?.ok === true;
      window.postMessage({
        type: "SJA_SYNC_COMPLETED",
        source: "sja_extension",
        ok,
        ...(!ok ? { error: runtimeError || response?.error || "The extension did not confirm cloud sync." } : {}),
      }, location.origin);
    };

    const requestCloudSync = () => {
      try {
        chrome.runtime.sendMessage({ type: "SJA_FORCE_SYNC" }, (response) => {
          postSyncResult(response, chrome.runtime.lastError?.message);
        });
      } catch (error) {
        postSyncResult(undefined, error instanceof Error ? error.message : "The extension runtime is unavailable.");
      }
    };

    // The bridge is restricted to the configured dashboard origin. Its token is
    // stored only after that check, then used for the normal authenticated sync.
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || typeof event.data !== "object" ||
          event.data.source !== "sja_dashboard") return;

      void trustedDashboardOrigin(event.origin).then((trusted) => {
        if (!trusted) return;

        if (event.data.type === "SJA_SET_AUTH_TOKEN") {
          const token = event.data.token;
          if (typeof token !== "string" || !token.trim() || token.length > 16_384) return;
          const normalizedToken = token.trim();
          chrome.storage.local.get("sja_cloud_token", (stored) => {
            if (chrome.runtime.lastError) {
              postSyncResult(undefined, chrome.runtime.lastError.message);
              return;
            }
            if (stored.sja_cloud_token === normalizedToken) {
              requestCloudSync();
              return;
            }
            chrome.storage.local.set({ sja_cloud_token: normalizedToken }, () => {
              if (chrome.runtime.lastError) {
                postSyncResult(undefined, chrome.runtime.lastError.message);
                return;
              }
              requestCloudSync();
            });
          });
        } else if (event.data.type === "SJA_FORCE_SYNC") {
          requestCloudSync();
        } else if (event.data.type === "SJA_PING_EXTENSION") {
          window.postMessage({
            type: "SJA_EXTENSION_PONG",
            source: "sja_extension",
            version: chrome.runtime.getManifest()?.version || "0.1.5",
            installed: true,
          }, location.origin);
        }
      });
    });

    void trustedDashboardOrigin(location.origin).then((trusted) => {
      if (!trusted) return;
      window.postMessage({
        type: "SJA_EXTENSION_ANNOUNCE",
        source: "sja_extension",
        version: chrome.runtime.getManifest()?.version || "0.1.5",
        installed: true,
      }, location.origin);
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "SJA:AUTOFILL" || msg?.type === "SJA:INJECT_ORCHESTRATOR" || msg?.type === "SJA:AUTOPILOT") {
        checkAndInject(true);
      }
    });
  },
});
