import { defineContentScript } from "wxt/utils/define-content-script";
import { JOB_HOST_MATCHES } from "@/lib/permission-policy.js";

export default defineContentScript({
  matches: [...JOB_HOST_MATCHES],
  world: "MAIN",
  runAt: "document_start",
  main() {
    // Lock postMessage target to this page's own origin.
    // The receiver (content.ts in ISOLATED world) already guards event.source !== window,
    // but using a specific origin prevents a forged page from ever receiving our telemetry.
    const _SELF_ORIGIN = window.location.origin || "*";
    if ((window as any).__sja_interceptor_installed) return;
    (window as any).__sja_interceptor_installed = true;

    // GAP-DOM-01 FIX: Shadow DOM Penetration (Closed & Open)
    // Hook Element.prototype.attachShadow so custom ATS web components
    // (Workday, Taleo, ADP) that create closed shadow roots are registered
    // and accessible for autofill deep scans.
    try {
      const origAttachShadow = Element.prototype.attachShadow;
      if (origAttachShadow && !(window as any).__sja_shadow_hook_installed) {
        (window as any).__sja_shadow_hook_installed = true;
        (window as any).__sja_shadow_roots = (window as any).__sja_shadow_roots || new Set();
        Element.prototype.attachShadow = function(init: ShadowRootInit) {
          const shadow = origAttachShadow.apply(this, arguments as any);
          try {
            (window as any).__sja_shadow_roots.add(shadow);
          } catch {}
          return shadow;
        };
      }
    } catch {}


    // Patterns in error messages / filenames / URLs that indicate noise we
    // never want to surface to the in-page panel (extension probes, CSP
    // violations, analytics, ResizeObserver loop warnings, etc).
    const ERROR_BLOCKLIST: string[] = [
    "chrome-extension:",
    "moz-extension:",
    "safari-web-extension:",
    "ResizeObserver loop",
    "Script error\\.?$",
    "Non-Error promise rejection",
    "undefined is not an object",
    "network error",
    "Failed to fetch",
    "cancelled",
    "user abort",
    "The user aborted a request",
    "Cannot read properties of null",
    "blocked by CORS",
    "Refused to load",
    "Refused to connect",
    "Refused to frame",
    "violated the following Content Security Policy",
    "gtag",
    "ga\\(",
    "fbevents",
    "hotjar",
    "clarity",
    "sentry",
    "datadog",
    "newrelic",
    "mixpanel",
    "segment",
  ];
    const ERROR_DENYLIST = new RegExp(ERROR_BLOCKLIST.join("|"), "i");

    window.addEventListener("error", (e) => {
      const msg = (e.message ?? "").toString();
      const src = (e.filename ?? "").toString();
      if (ERROR_DENYLIST.test(msg) || ERROR_DENYLIST.test(src)) return;
      window.postMessage({
        type: "SJA_PAGE_ERROR",
        message: e.message,
        stack: e.error instanceof Error ? e.error.stack : undefined
      }, _SELF_ORIGIN);
    });

    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      if (ERROR_DENYLIST.test(msg)) { e.preventDefault?.(); return; }
      window.postMessage({
        type: "SJA_PAGE_REJECTION",
        message: msg,
        stack: reason instanceof Error ? reason.stack : undefined
      }, _SELF_ORIGIN);
    });

    // URLs we should NEVER report as warnings — advertising, analytics,
    // tracking beacons, CDN telemetry, or extension probes.
    const NOISE_BLOCKLIST: string[] = [
    "doubleclick\\.net",
    "google-analytics\\.com",
    "googletagmanager\\.com",
    "facebook\\.net",
    "facebook\\.com/tr",
    "adservice\\.",
    "hotjar\\.com",
    "clarity\\.ms",
    "segment\\.com",
    "sentry-cdn\\.com",
    "newrelic\\.com",
    "datadog",
    "loggly",
    "mixpanel",
    "amplitude",
    "heapanalytics",
    "crazyegg",
    "fullstory",
    "quantummetric",
    "mouseflow",
    "luckyorange",
    "yandex",
    "baidu",
    "bing\\.com/ms",
    "criteo",
    "pubmatic",
    "rubiconproject",
    "adsafeprotected",
    "googleadservices",
    "google\\.com/ads",
    "googleapis\\.com/ads",
    "google\\.com/pagead",
    "googlesyndication",
    "scorecardresearch",
    "quantserve",
    "cdn-cgi/rum",
    "chrome-extension:",
    "moz-extension:",
    "safari-web-extension:",
  ];
    const NOISE_DENYLIST = new RegExp(NOISE_BLOCKLIST.join("|"), "i");

    const origFetch = window.fetch;
    if (origFetch) {
      window.fetch = async function(...args) {
        const reqUrl = String(typeof args[0] === "string" ? args[0] : (args[0] as any)?.url ?? args[0]);
        if (NOISE_DENYLIST.test(reqUrl)) {
          return origFetch.apply(this, args);
        }
        try {
          const res = await origFetch.apply(this, args);
          if (!res.ok && !NOISE_DENYLIST.test(res.url || reqUrl)) {
            window.postMessage({
              type: "SJA_PAGE_NETWORK_WARN",
              url: res.url,
              status: res.status,
              statusText: res.statusText
            }, _SELF_ORIGIN);
          }
          return res;
        } catch (err) {
          if (!NOISE_DENYLIST.test(reqUrl)) {
            window.postMessage({
              type: "SJA_PAGE_NETWORK_ERROR",
              url: reqUrl,
              error: err instanceof Error ? err.message : String(err)
            }, _SELF_ORIGIN);
          }
          throw err;
        }
      };
    }
  }
});
