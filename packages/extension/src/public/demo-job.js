/**
 * Demo-job sandbox helpers. Loaded externally (no inline script) to comply
 * with MV3 default CSP of `script-src 'self'`.
 *
 * Also bootstraps the SJA orchestrator for the demo page. In MV3, content
 * scripts declared with `<all_urls>` do NOT match chrome-extension:// URLs, so
 * the normal content.ts / demo.content.ts injection path never fires on our
 * own demo-job.html. We ask the background to inject agent.js directly.
 */
(function () {
  function bindSubmit() {
    var form = document.getElementById("application");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      alert(
        "Submitted (demo). In real use, Super Job Agent would NOT auto-submit unless you enable it in Settings."
      );
    });
  }

  function bootstrapSJA() {
    if (window.__sja_demo_injected) return;
    // The chrome-extension: page has access to chrome.runtime.sendMessage.
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) return;
      chrome.runtime.sendMessage(
        { type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: "demo-page" } },
        function () {
          // Ignore lastError; injection is idempotent.
          void chrome.runtime.lastError;
        }
      );
      // Also listen for a direct AUTOFILL message from the extension UI.
      chrome.runtime.onMessage.addListener(function (msg) {
        if (msg && msg.type === "SJA:AUTOFILL") {
          chrome.runtime.sendMessage(
            { type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: "demo-page" } }
          );
        }
      });
      window.__sja_demo_injected = true;
    } catch (_) {
      // chrome.runtime may be unavailable if this file is served outside the extension
    }
  }

  function boot() {
    bindSubmit();
    bootstrapSJA();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
