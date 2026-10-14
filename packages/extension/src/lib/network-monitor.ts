/**
 * NetworkMonitor — tracks pending XHR/fetch requests to detect "network idle".
 *
 * Intercepts XMLHttpRequest and fetch to maintain a count of in-flight
 * requests. Provides `waitForNetworkIdle()` which resolves when no
 * requests have been pending for a configurable quiet period.
 *
 * Filters out tracking/analytics/blob URLs to avoid false "busy" signals.
 */

/* ------------------------------------------------------------------ */
/* Default blacklist — URLs that should not count as "pending"         */
/* ------------------------------------------------------------------ */

const DEFAULT_BLACKLIST = [
  "analytics",
  "tracking",
  "insights",
  "telemetry",
  "beacon",
  "pixel",
  "track",
  "blob:",
  "data:",
  "chrome-extension://",
  "hcaptcha.com",
  "recaptcha",
  "google-analytics.com",
  "googletagmanager.com",
  "facebook.com/tr",
  "doubleclick.net",
  "hotjar.com",
  "clarity.ms",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "sentry.io",
  "bugsnag.com",
  "fullstory.com",
  "newrelic.com",
  "nr-data.net",
];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let pendingCount = 0;
let customBlacklist: string[] = [];
let installed = false;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isBlacklisted(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  const allPatterns = [...DEFAULT_BLACKLIST, ...customBlacklist];
  return allPatterns.some((pattern) => lowerUrl.includes(pattern.toLowerCase()));
}

function increment(url: string): void {
  if (!isBlacklisted(url)) {
    pendingCount++;
  }
}

function decrement(url: string): void {
  if (!isBlacklisted(url)) {
    pendingCount = Math.max(0, pendingCount - 1);
  }
}

/* ------------------------------------------------------------------ */
/* Intercept XMLHttpRequest                                            */
/* ------------------------------------------------------------------ */

function interceptXHR(): void {
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { _networkMonitorUrl?: string },
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    this._networkMonitorUrl = String(url);
    return origOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { _networkMonitorUrl?: string },
    ...args: any[]
  ) {
    const url = this._networkMonitorUrl ?? "";
    increment(url);

    const onDone = () => decrement(url);
    this.addEventListener("load", onDone, { once: true });
    this.addEventListener("error", onDone, { once: true });
    this.addEventListener("abort", onDone, { once: true });
    this.addEventListener("timeout", onDone, { once: true });

    return origSend.apply(this, args as any);
  };
}

/* ------------------------------------------------------------------ */
/* Intercept fetch                                                     */
/* ------------------------------------------------------------------ */

function interceptFetch(): void {
  const origFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);

    increment(url);

    return origFetch
      .call(this, input, init)
      .then((response) => {
        decrement(url);
        return response;
      })
      .catch((err) => {
        decrement(url);
        throw err;
      });
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface NetworkIdleOptions {
  /** Maximum time (ms) to wait before giving up. Default 10000. */
  timeout?: number;
  /** How long (ms) the pending count must stay at 0. Default 500. */
  quietPeriod?: number;
  /** Use a quiet period check instead of instant zero. Default false. */
  useQuietPeriod?: boolean;
}

/**
 * Install the network interceptors. Safe to call multiple times.
 */
export function installNetworkMonitor(blacklistUrlParts?: string[]): void {
  if (blacklistUrlParts) {
    customBlacklist = blacklistUrlParts;
  }
  if (installed) return;
  installed = true;

  try {
    interceptXHR();
    interceptFetch();
  } catch (e) {
    console.warn("[NetworkMonitor] Failed to install interceptors:", e);
  }
}

/**
 * Get the current number of pending (in-flight) network requests.
 */
export function getPendingRequestCount(): number {
  return pendingCount;
}

/**
 * Wait until all tracked network requests have settled.
 *
 * @returns Promise that resolves when network is idle, or rejects on timeout.
 */
export function waitForNetworkIdle(options: NetworkIdleOptions = {}): Promise<void> {
  const { timeout = 10000, quietPeriod = 500, useQuietPeriod = false } = options;

  return new Promise<void>((resolve) => {
    const startTime = Date.now();
    let quietStart: number | null = null;

    const check = () => {
      // Timeout guard
      if (Date.now() - startTime > timeout) {
        resolve(); // Don't reject — just proceed
        return;
      }

      if (pendingCount === 0) {
        if (!useQuietPeriod) {
          resolve();
          return;
        }
        // Quiet period mode: pending must stay at 0 for `quietPeriod` ms
        if (quietStart === null) {
          quietStart = Date.now();
        }
        if (Date.now() - quietStart >= quietPeriod) {
          resolve();
          return;
        }
      } else {
        quietStart = null;
      }

      setTimeout(check, 100);
    };

    // If already idle, resolve quickly (but still check quiet period)
    if (pendingCount === 0 && !useQuietPeriod) {
      resolve();
      return;
    }

    check();
  });
}

/**
 * Check if the network is currently idle (no pending requests).
 */
export function isNetworkIdle(): boolean {
  return pendingCount === 0;
}

/**
 * Reset the monitor state. Useful for testing.
 */
export function resetNetworkMonitor(): void {
  pendingCount = 0;
  customBlacklist = [];
}
