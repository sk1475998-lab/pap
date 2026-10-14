/**
 * Operation Zero-Defect: Robust Retry & Backoff
 * Provides exponential backoff, offline queuing, and jitter for all network requests.
 * Jitter modes (Adaptation 5/10xProductivity MIT merge): `true` keeps the
 * original ±20% band around the exponential delay; `"equal"` uses AWS-style
 * equal jitter — uniform in [delay/2, delay] (ported to human-pacing).
 */
import { equalJitterDelayMs } from "./human-pacing.js";

export type RetryJitter = boolean | "equal";

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: RetryJitter;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "jitter">> & { jitter: RetryJitter } = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
};

/**
 * Pure backoff computation (no timers, no global RNG) — unit-testable with an
 * injected rnd. `attempt` is 1-based (first retry = attempt 1).
 */
export function retryBackoffDelayMs(
  attempt: number,
  options: Omit<RetryOptions, "onRetry"> & { rnd?: () => number } = {}
): number {
  const config = {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: 10_000, // not used by the pure fn; only backoff shape matters
    ...options,
  };
  const rnd = options.rnd ?? Math.random;
  const n = Math.max(1, Math.floor(attempt));
  // Exponential backoff, then jitter, then cap — identical to the original
  // runtime ordering (jitter applies to the uncapped exponent).
  const exponential = config.baseDelayMs * Math.pow(config.factor, n - 1);
  let delay =
    config.jitter === "equal"
      ? equalJitterDelayMs(exponential, rnd)
      : config.jitter
        ? exponential * (0.8 + rnd() * 0.4)
        : exponential;
  delay = Math.min(delay, config.maxDelayMs);
  return delay;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;

  while (true) {
    try {
      // Check offline status before attempting (if explicitly false in browser environment)
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Network offline");
      }

      const response = await fetch(input, init);

      // Retry on 429 Rate Limit or 5xx Server Errors
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        const retryAfter = response.headers?.get?.("retry-after");
        let serverWaitMs = 0;
        if (retryAfter) {
          const seconds = /^\s*\d+(?:\.\d+)?\s*$/.test(retryAfter) ? Number(retryAfter) : NaN;
          if (Number.isFinite(seconds) && seconds >= 0) {
            serverWaitMs = seconds * 1000;
          } else {
            const retryAt = Date.parse(retryAfter);
            if (Number.isFinite(retryAt)) serverWaitMs = Math.max(0, retryAt - Date.now());
          }
        }
        let isQuotaExhausted = false;
        if (response.status === 429) {
          try {
            const clone = response.clone();
            const body = await clone.json();
            const msg = body?.error?.message || "";
            if (/quota exceeded|check your plan and billing/i.test(msg)) {
              isQuotaExhausted = true;
            }
            if (serverWaitMs === 0) {
              const details = body?.error?.details;
              if (Array.isArray(details)) {
                for (const item of details) {
                  if (item?.retryDelay) {
                    const s = parseFloat(String(item.retryDelay));
                    if (!isNaN(s) && s > 0) {
                      serverWaitMs = Math.min(Math.ceil(s * 1000) + 1000, config.maxDelayMs);
                      break;
                    }
                  }
                }
              }
            }
          } catch {}
        }
        const err = new Error(`HTTP Error ${response.status}: ${response.statusText || (isQuotaExhausted ? 'Quota Exceeded' : 'Rate Limited')}`);
        (err as any).retryAfterMs = Math.min(serverWaitMs, config.maxDelayMs);
        (err as any).status = response.status;
        (err as any).quotaExhausted = isQuotaExhausted;
        throw err;
      }

      return response;
    } catch (error) {
      attempt++;
      if (attempt > config.maxRetries || (error as any)?.quotaExhausted) {
        throw error;
      }

      let delay = Math.min((error as any)?.retryAfterMs || retryBackoffDelayMs(attempt, options), config.maxDelayMs);
      if ((error as any)?.status === 429 || String((error as any)?.message).includes("429")) {
        delay = Math.min(Math.max(delay, 2500 * attempt), config.maxDelayMs);
      }
      if (options.onRetry) {
        options.onRetry(error as Error, attempt, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
