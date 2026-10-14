import { defineContentScript } from "wxt/utils/define-content-script";

/**
 * Demo-page entry: forces orchestrator injection on the sandbox demo-job page
 * bundled with the extension (public/demo-job.html). The normal JOB_HOST_MATCHES
 * set only covers real job boards; this entrypoint covers the extension's own
 * chrome-extension://<id>/demo-job.html URL so users can try autofill without
 * a real ATS.
 */
export default defineContentScript({
  // WXT requires http(s)-style host matches for MV3; we additionally run on
  // <all_urls> but immediately return unless the page is the extension's own
  // demo-job.html (caught by the protocol+pathname check below).
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // Only activate on the extension's own demo-job.html page.
    if (
      location.protocol !== "chrome-extension:" &&
      location.protocol !== "moz-extension:" &&
      location.protocol !== "extension:"
    ) return;
    if (!/demo-job\.html/i.test(location.pathname)) return;
    if ((window as any).__sja_demo_injected) return;
    (window as any).__sja_demo_injected = true;

    // Directly request orchestrator injection (the normal detector gates on
    // job-host URLs; the demo page is a special case).
    function inject() {
      try {
        chrome.runtime.sendMessage({
          type: "SJA:INJECT_ORCHESTRATOR",
          payload: { url: location.href, reason: "demo-page" },
        });
      } catch {}
    }
    inject();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "SJA:AUTOFILL") inject();
    });
  },
});
