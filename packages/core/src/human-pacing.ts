/**
 * Human pacing governor — human-like typing cadence + jittered backoff.
 *
 * LICENSE / ATTRIBUTION:
 * This module is a TypeScript adaptation of `workflows/linkedin_automation/pacing/*`
 * from the MIT-licensed repository "10xProductivity" (ZhixiangLuo/10xProductivity),
 * Copyright (c) 2026 10xProductivity Contributors (MIT License). It is used here
 * under that license; the full MIT notice is preserved in THIRD_PARTY_NOTICES.md.
 * Changes for SJA: TypeScript port, pure/injectable random sources, per-keystroke
 * and post-keystroke split, configurable policies, no wall-clock side effects in
 * the pure functions (sleeping is done by the caller or by `humanTypeText`).
 * The design also merges the cadence philosophy of SJA's existing mimic-user
 * (character-by-character typing with random delays).
 *
 * All pure samplers accept an injectable `rnd` (default Math.random) so tests
 * can drive them deterministically.
 */

export type Rnd = () => number;

function clampLoHi(lo: number, hi: number): [number, number] {
  return lo <= hi ? [lo, hi] : [hi, lo];
}

/** Uniform integer in [min,max] inclusive. */
export function randomIntIn(min: number, max: number, rnd: Rnd = Math.random): number {
  const [lo, hi] = clampLoHi(min, max);
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

/** Uniform float in [min,max). */
export function randomFloatIn(min: number, max: number, rnd: Rnd = Math.random): number {
  const [lo, hi] = clampLoHi(min, max);
  return lo + rnd() * (hi - lo);
}

/** ms of delay between two keystrokes (Playwright per-key `delay`). */
export function keystrokeDelayMs(
  opts: { minMs?: number; maxMs?: number; rnd?: Rnd } = {}
): number {
  const min = opts.minMs ?? 50;
  const max = opts.maxMs ?? 200;
  return randomIntIn(min, max, opts.rnd ?? Math.random);
}

/**
 * Micro-pause *after* typing a key, based on its character class
 * (mirrors the human cadence of pausing after punctuation and spaces):
 *   - space / newline / tab  : 40–220 ms
 *   - . ! ? , ; :            : 120–380 ms
 *   - /                      : 80–200 ms
 *   - any other character    : 0 ms (cadence only)
 */
export function postKeystrokePauseMs(ch: string, rnd: Rnd = Math.random): number {
  if (/[ \n\t]/.test(ch)) return randomIntIn(40, 220, rnd);
  if (/[.!?,;:]/.test(ch)) return randomIntIn(120, 380, rnd);
  if (ch === "/") return randomIntIn(80, 200, rnd);
  return 0;
}

export interface HesitationPolicy {
  /** probability of a "thinking" pause (default 0.06) */
  thinkP?: number;
  /** probability of a long hesitation pause (default 0.015) */
  hesitateP?: number;
  /** range of the short "thinking" pause, ms (default 250–900) */
  thinkMinMs?: number;
  thinkMaxMs?: number;
  /** range of the long hesitation pause, ms (default 900–1800) */
  hesitateMinMs?: number;
  hesitateMaxMs?: number;
}

/**
 * A human occasionally hesitates mid-typing. Returns 0 most of the time;
 * otherwise a short "thinking" pause (default ~6 %) or a rarer long hesitation
 * (default ~1.5 %, drawn independently, like the reference).
 */
export function hesitationPauseMs(
  policy: HesitationPolicy = {},
  rnd: Rnd = Math.random
): number {
  const thinkP = policy.thinkP ?? 0.06;
  const hesitateP = policy.hesitateP ?? 0.015;
  if (rnd() < thinkP) {
    return randomIntIn(policy.thinkMinMs ?? 250, policy.thinkMaxMs ?? 900, rnd);
  }
  if (rnd() < hesitateP) {
    return randomIntIn(policy.hesitateMinMs ?? 900, policy.hesitateMaxMs ?? 1800, rnd);
  }
  return 0;
}

export interface TypingPolicy {
  /** length under which type-character input is strongly preferred. */
  shortLen?: number;
  /** length between short and medium (default 160) for the medium band. */
  mediumLen?: number;
  /** length above which pasted input is preferred. */
  longLen?: number;
  /** p(type) for short text (default 0.82). */
  shortTypeP?: number;
  /** p(type) for medium text (default 0.52). */
  mediumTypeP?: number;
  /** p(type) for long text (default 0.28). */
  longTypeP?: number;
}

/**
 * Choose between character-by-character typing and clipboard-style paste for a
 * piece of text, based on its length (short messages look more human typed;
 * long ones are pasted more often). Returns "type" | "paste".
 */
export function inputModeForLength(
  text: string,
  policy: TypingPolicy = {},
  rnd: Rnd = Math.random
): "type" | "paste" {
  const n = text.length;
  const short = policy.shortLen ?? 72;
  const medium = policy.mediumLen ?? 160;
  const pType =
    n <= short
      ? (policy.shortTypeP ?? 0.82)
      : n <= medium
        ? (policy.mediumTypeP ?? 0.52)
        : (policy.longTypeP ?? 0.28);
  return rnd() < pType ? "type" : "paste";
}

/** ms delay with equal jitter uniform in [base/2, base]. */
export function equalJitterDelayMs(baseMs: number, rnd: Rnd = Math.random): number {
  if (baseMs <= 0) return 0;
  const half = baseMs / 2;
  return half + rnd() * half;
}

/** equal-jitter in hours (base expressed in hours) — for daily backoff plans. */
export function equalJitterDelayHours(baseHours: number, rnd: Rnd = Math.random): number {
  return equalJitterDelayMs(baseHours * 3_600_000, rnd) / 3_600_000;
}

/** Seconds from `now` until the next local midnight (0 at exact midnight rollover). */
export function secondsUntilNextLocalMidnight(now: Date = new Date()): number {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(0, (tomorrow.getTime() - now.getTime()) / 1000);
}

/** Minimal sink interface a driver must provide for `humanTypeText`. */
export interface TypeSink {
  /** Type a single character with the given inter-key delay. */
  typeChar(ch: string, delayMs: number): Promise<void> | void;
  /** Clipboard-style bulk insert. */
  insertText(text: string): Promise<void> | void;
  /** Sleep is injected so tests can use delay 0. */
  sleep(ms: number): Promise<void> | void;
}

export interface HumanTypeOptions extends TypingPolicy {
  minKeyMs?: number;
  maxKeyMs?: number;
  /** force mode instead of length-based policy */
  mode?: "type" | "paste";
  /** set false in tests to skip pauses/hesitations for determinism */
  pauses?: boolean;
  rnd?: Rnd;
}

/**
 * Drive a TypeSink to enter `text` the way a person would: for short text,
 * character-by-character with per-key jitter and micro-pauses; for long text,
 * increasingly often clipboard-style with small pauses around it.
 */
export async function humanTypeText(sink: TypeSink, text: string, opts: HumanTypeOptions = {}): Promise<void> {
  const rnd = opts.rnd ?? Math.random;
  const pauses = opts.pauses ?? true;
  const mode = opts.mode ?? inputModeForLength(text, opts, rnd);
  if (mode === "paste") {
    if (pauses) await sink.sleep(randomIntIn(100, 320, rnd));
    await sink.insertText(text);
    if (pauses) await sink.sleep(randomIntIn(50, 200, rnd));
    return;
  }
  for (const ch of text) {
    if (ch === "\n") {
      // Enter key via a newline char contract — caller maps it to key press.
      await sink.typeChar("\n", keystrokeDelayMs({ minMs: opts.minKeyMs, maxMs: opts.maxKeyMs, rnd }));
      continue;
    }
    if (ch === "\r") continue;
    const delay = keystrokeDelayMs({ minMs: opts.minKeyMs, maxMs: opts.maxKeyMs, rnd });
    await sink.typeChar(ch, delay);
    if (!pauses) continue;
    const micro = postKeystrokePauseMs(ch, rnd);
    if (micro > 0) await sink.sleep(micro);
    const hesitate = hesitationPauseMs({}, rnd);
    if (hesitate > 0) await sink.sleep(hesitate);
  }
}
