/**
 * Session guardrails — daily-limit wall detection and no-progress stall watchdogs.
 *
 * Capability origin: reference repos AutoApplyMax (content-simple.js) and
 * autoApplylinkedin both keep an "activity timestamp" that they bump on every
 * successful automation step, use it to decide the run is *stuck* after a
 * silence budget, and pattern-match LinkedIn's public "daily Easy Apply limit"
 * copy so the bot stops gracefully instead of hammering a blocked account.
 *
 * Clean-room statement: this file is an independent re-expression of those
 * documented capabilities. No code was copied from any reference repository.
 * The daily-limit phrase list is LinkedIn's own public UI copy — the strings
 * are facts of the external product, not creative expression — and is matched
 * here with a defensive normalizer (case folding, curly-apostrophe handling,
 * punctuation stripping, whitespace collapsing) that the references did not
 * perform. The stall watchdog is a purpose-built timer state machine rather
 * than a port of any reference implementation.
 */

/**
 * LinkedIn "daily Easy Apply limit reached" wall copy, normalized for fuzzy
 * matching. Each entry is lower-case with single spaces (no punctuation).
 * The wall is typically shown in a modal/toast/banner and in `document.body`
 * inner text, e.g.:
 *   "Great effort applying today! You've reached today's Easy Apply limit."
 */
export const LINKEDIN_DAILY_LIMIT_PHRASES: readonly string[] = [
  "you ve reached today s easy apply limit",
  "reached today s easy apply limit",
  "great effort applying today",
  "we limit daily submissions",
  "continue applying tomorrow",
  "exceeded the daily application limit",
  "daily easy apply limit",
  "limit daily submissions",
  "you ve hit your daily application limit",
  "you ve reached the daily application limit",
];

/** Invariant: phrases are stored already-normalized; export is frozen. */
export const LINKEDIN_DAILY_LIMIT_PHRASES_N = LINKEDIN_DAILY_LIMIT_PHRASES.length;

/**
 * Normalize free-form UI text so fuzzy phrase matching survives case,
 * curly apostrophes, punctuation and whitespace differences.
 *   "You've reached today's Easy Apply limit!" -> "you ve reached today s easy apply limit"
 */
export function normalizeUiText(text: string): string {
  return text
    .toLowerCase()
    // Curly quotes/apostrophes (U+2018/2019) and typographic apostrophe U+02BC.
    .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
    // Keep only letters/digits/spaces; an apostrophe between letters becomes a
    // space so "today's" == "today s" regardless of source punctuation.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface LimitWallDetection {
  /** true when one of the limit-wall phrases occurs in the scanned text. */
  hit: boolean;
  /** the normalized phrase that matched (when hit). */
  matchedPhrase?: string;
}

/**
 * Scan free-form UI text (e.g. `document.body.innerText` or the text of
 * modal/toast containers) for a known apply-limit wall. Pass `phrases` to
 * detect a different provider's wall copy; defaults to the LinkedIn set.
 */
export function detectLimitWall(
  text: string,
  phrases: readonly string[] = LINKEDIN_DAILY_LIMIT_PHRASES
): LimitWallDetection {
  if (!text) return { hit: false };
  const haystack = normalizeUiText(text);
  if (haystack.length === 0) return { hit: false };
  for (const phrase of phrases) {
    const needle = normalizeUiText(phrase);
    if (needle.length > 0 && haystack.includes(needle)) {
      return { hit: true, matchedPhrase: phrase };
    }
  }
  return { hit: false };
}

/** LinkedIn alias — explicit intent for callers that only care about LinkedIn. */
export function detectLinkedInDailyLimit(text: string): LimitWallDetection {
  return detectLimitWall(text, LINKEDIN_DAILY_LIMIT_PHRASES);
}

/**
 * Scan a list of element texts (modal, toast, banner, body) and report the
 * first element that contains a wall phrase. Useful for DOM-driven callers
 * that want to attribute the wall to a specific container.
 */
export function detectLimitWallInElements(
  texts: readonly string[],
  phrases: readonly string[] = LINKEDIN_DAILY_LIMIT_PHRASES
): LimitWallDetection {
  for (const t of texts) {
    const d = detectLimitWall(t, phrases);
    if (d.hit) return d;
  }
  return { hit: false };
}

export interface StallWatchdogOptions {
  /** silence budget in ms; exceeded => the run is considered stalled. */
  stallMs: number;
  /** injectable clock for deterministic tests (defaults to Date.now). */
  now?: () => number;
  /** called exactly once per stall episode with the observed idle duration. */
  onStall?: (idleMs: number) => void;
}

export interface StallWatchdog {
  /** Record progress (a successful action). Resets the stall episode. */
  tick(): void;
  /** True once the silence budget has been exceeded since the last tick. */
  isStalled(): boolean;
  /** Milliseconds since the last tick (or creation). */
  idleMs(): number;
  /** Disable the watchdog permanently. */
  stop(): void;
}

/**
 * A wall-clock "no progress" watchdog: call `tick()` on every successful
 * automation action; poll `isStalled()` to learn that the run has been silent
 * for `stallMs`. `onStall` fires at most once per stall episode and re-arms
 * after the next `tick()`, so a watchdog can survive transient stalls.
 */
export function createStallWatchdog(options: StallWatchdogOptions): StallWatchdog {
  const now = options.now ?? Date.now;
  let lastTickAt = now();
  let stopped = false;
  let episodeFired = false;

  const api: StallWatchdog = {
    tick(): void {
      if (stopped) return;
      lastTickAt = now();
      episodeFired = false;
    },
    isStalled(): boolean {
      if (stopped) return false;
      const idle = now() - lastTickAt;
      if (idle <= options.stallMs) return false;
      if (!episodeFired) {
        episodeFired = true;
        try {
          options.onStall?.(idle);
        } catch {
          // Observers must not be able to break the guard loop.
        }
      }
      return true;
    },
    idleMs(): number {
      return now() - lastTickAt;
    },
    stop(): void {
      stopped = true;
    },
  };
  return api;
}
