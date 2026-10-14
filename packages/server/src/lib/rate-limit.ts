/**
 * In-memory rate limiting.
 *
 * Two endpoints genuinely need it before this API faces the internet:
 *   - login / register  → otherwise an attacker can grind passwords for free
 *   - sync              → one client in a loop can exhaust a free-tier instance
 *
 * Deliberately in-process and dependency-free: no Redis to pay for, and a
 * single free-tier instance is the deployment target.
 *
 * ⚠️  SCALING LIMITATION: This limiter is per-process. If you scale to multiple
 * instances (Docker swarm, Kubernetes, ECS), each instance has its own counter
 * and an attacker can round-robin between them to get N × limit attempts.
 *
 * For multi-instance deployments, replace the `consume()` / `refund()` calls
 * at the call sites with a Redis-backed sliding-window limiter such as
 * `ioredis` + Lua script or the `rate-limiter-flexible` package.
 *
 * This file emits a startup warning when NODE_ENV=production so the operator
 * is reminded to evaluate the scaling posture.
 */

if (process.env.NODE_ENV === "production") {
  // Emit once on startup so it appears in the first log line, not buried in a
  // request. Use stderr so it is visible even when stdout is redirected.
  process.stderr.write(
    "[rate-limit] WARNING: Using in-memory rate limiter in production. " +
    "This is per-instance. Set SUPERJOB_ALLOWED_ORIGINS and evaluate Redis-backed " +
    "rate limiting if running more than one instance.\n",
  );
}

interface Bucket {
  /** Tokens remaining in the current window. */
  tokens: number;
  /** When the window resets (epoch ms). */
  resetAt: number;
}

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a long-running process does not grow unbounded. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Consume one token for `key`. Returns whether the caller may proceed.
 *
 * Fixed-window rather than sliding: cheaper, and the imprecision at a window
 * boundary does not matter for either use case here.
 */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitVerdict {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { tokens: rule.limit - 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
  }
  if (existing.tokens <= 0) {
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, existing.resetAt - now) };
  }
  existing.tokens -= 1;
  return { allowed: true, remaining: existing.tokens, retryAfterMs: 0 };
}

/** Give a token back — used when an attempt turns out to have been legitimate. */
export function refund(key: string, rule: RateLimitRule, now = Date.now()): void {
  const b = buckets.get(key);
  if (b && b.resetAt > now) b.tokens = Math.min(rule.limit, b.tokens + 1);
}

/** Forget a key entirely, e.g. after a successful login. */
export function reset(key: string): void {
  buckets.delete(key);
}

/** Client identity for anonymous limits. Trusts a proxy header only if present. */
export function clientKey(req: { ip?: string; headers: Record<string, unknown> }): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === "string" ? fwd.split(",")[0] : undefined;
  return String(first ?? req.ip ?? "unknown").trim() || "unknown";
}

/* Named rules, so the numbers live in one place.
 *
 * LOGIN_RULE: 5 attempts per 10 min per IP. Low enough to block brute-force
 * but high enough that a user who fat-fingers three times and waits a moment
 * can still sign in without calling support.
 *
 * REGISTER_RULE: 5 per hour per IP — a human registering takes longer than
 * 5 accounts and then stops, so the window matches normal usage.
 *
 * SYNC_RULE: 120 per minute per authenticated user (2 req/s sustained). The
 * extension polls every 30s, so this allows 4× headroom.
 */
export const LOGIN_RULE: RateLimitRule = { limit: 5, windowMs: 10 * 60 * 1000 };
export const REGISTER_RULE: RateLimitRule = { limit: 5, windowMs: 60 * 60 * 1000 };
export const SYNC_RULE: RateLimitRule = { limit: 120, windowMs: 60 * 1000 };
export const LLM_RULE: RateLimitRule = { limit: 60, windowMs: 60 * 1000 };
