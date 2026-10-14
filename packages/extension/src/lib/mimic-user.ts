/**
 * MimicUser — Human-like DOM interaction simulator.
 *
 * Simulates realistic user interactions (typing, clicking, selecting) with
 * proper event sequences so React/Vue/Angular SPAs register the changes.
 *
 * Key features:
 * - Character-by-character typing with random delays
 * - Full mouse event sequences for clicks
 * - Scroll-into-view before interactions
 * - Custom event detail marker to distinguish from real user events
 * - Checkbox/radio/file upload/select handling
 */

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Standard single click event detail (1). Avoid non-standard markers like 9999 which trigger bot detectors. */
export const MIMIC_EVENT_DETAIL = 1;

/** Min/max delay (ms) between typed characters. */
const TYPE_DELAY_MIN = 25;
const TYPE_DELAY_MAX = 75;

/** Delay after finishing typing before blur. */
const POST_TYPE_DELAY = 80;

/** Delay after a click before continuing. */
const CLICK_SETTLE_DELAY = 60;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randomDelay(min = TYPE_DELAY_MIN, max = TYPE_DELAY_MAX): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ------------------------------------------------------------------ */
/* Native setters — bypass React/Vue controlled component wrappers     */
/* ------------------------------------------------------------------ */

const NATIVE_INPUT_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  } catch {
    return undefined;
  }
})();

const NATIVE_TA_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  } catch {
    return undefined;
  }
})();

const NATIVE_CHECKED_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  } catch {
    return undefined;
  }
})();

const NATIVE_SELECT_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  } catch {
    return undefined;
  }
})();

/* ------------------------------------------------------------------ */
/* Event factories                                                     */
/* ------------------------------------------------------------------ */

function makeMouseEvent(type: string, el: HTMLElement, init: Partial<MouseEventInit> = {}): MouseEvent {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  // NOTE: Do NOT set a custom `detail` value here.
  // Real single-clicks have detail=1 (browser default). Any non-standard value
  // (e.g. 9999) is a deterministic anti-bot fingerprint flagged by DataDome,
  // Cloudflare, and LinkedIn's SDUI fraud monitor.
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x + window.screenX,
    screenY: y + window.screenY,
    ...init,
  });
}

function makeKeyboardEvent(type: string, key: string, code?: string): KeyboardEvent {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key,
    code: code ?? `Key${key.toUpperCase()}`,
    keyCode: key.charCodeAt(0),
    which: key.charCodeAt(0),
  });
}

function makeInputEvent(data: string | null = null): InputEvent {
  return new InputEvent("input", {
    bubbles: true,
    cancelable: false,
    data,
    inputType: "insertText",
  });
}

/* ------------------------------------------------------------------ */
/* Visibility & scroll helpers                                         */
/* ------------------------------------------------------------------ */

function scrollIntoViewIfNeeded(el: HTMLElement): void {
  try {
    const rect = el.getBoundingClientRect();
    const inView =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    if (!inView) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  } catch {
    /* non-critical */
  }
}

function findVisibleParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const isHidden =
    el.offsetParent === null ||
    el.style.display === "none" ||
    el.style.visibility === "hidden" ||
    el.style.opacity === "0";
  if (!isHidden) return el;
  return findVisibleParent(el.parentElement);
}

/* ------------------------------------------------------------------ */
/* Core interaction methods                                            */
/* ------------------------------------------------------------------ */

export interface MimicInputOptions {
  /** If true, overwrite even if the field already has a value. */
  ignoreExistingValue?: boolean;
  /** Dispatch a blur event after typing. Default true. */
  triggerBlurEvent?: boolean;
  /** Dispatch keydown events per character. Default true. */
  triggerKeyDownEvent?: boolean;
  /** Wait for network after interaction. */
  waitForNetworkAfterInteraction?: boolean;
  /** Clear field before typing. Default true. */
  clearBefore?: boolean;
}

/**
 * Type a value into an input/textarea with realistic per-character events.
 */
export async function mimicInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  options: MimicInputOptions = {}
): Promise<void> {
  const {
    ignoreExistingValue = false,
    triggerBlurEvent = true,
    triggerKeyDownEvent = true,
    clearBefore = true,
  } = options;

  if (!el) return;

  // Skip if already has the correct value
  if (!ignoreExistingValue && el.value === value) return;

  scrollIntoViewIfNeeded(el);
  await sleep(randomDelay(30, 60));

  // Focus
  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

  // Clear existing value if needed
  if (clearBefore && el.value) {
    const setter = el instanceof HTMLTextAreaElement ? NATIVE_TA_SETTER : NATIVE_INPUT_SETTER;
    if (setter) setter.call(el, "");
    else el.value = "";
    el.dispatchEvent(makeInputEvent(null));
  }

  // Type character by character
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (triggerKeyDownEvent) {
      el.dispatchEvent(makeKeyboardEvent("keydown", char));
    }
    el.dispatchEvent(makeKeyboardEvent("keypress", char));

    // Set value up to current position
    const partial = value.substring(0, i + 1);
    const setter = el instanceof HTMLTextAreaElement ? NATIVE_TA_SETTER : NATIVE_INPUT_SETTER;
    if (setter) setter.call(el, partial);
    else el.value = partial;

    el.dispatchEvent(makeInputEvent(char));
    el.dispatchEvent(makeKeyboardEvent("keyup", char));

    // Random delay between keystrokes
    if (i < value.length - 1) {
      await sleep(randomDelay());
    }
  }

  // Change event
  await sleep(POST_TYPE_DELAY);
  el.dispatchEvent(new Event("change", { bubbles: true }));

  // Blur
  if (triggerBlurEvent) {
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }
}

/**
 * Set a value instantly (no per-character typing) with full event dispatch.
 * Faster alternative for non-critical fields.
 */
export function mimicSetValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  options: { triggerBlurEvent?: boolean } = {}
): void {
  if (!el) return;
  const { triggerBlurEvent = true } = options;

  scrollIntoViewIfNeeded(el);

  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

  const setter = el instanceof HTMLTextAreaElement ? NATIVE_TA_SETTER : NATIVE_INPUT_SETTER;
  if (setter) setter.call(el, value);
  else el.value = value;

  el.dispatchEvent(makeKeyboardEvent("keydown", "a"));
  el.dispatchEvent(makeInputEvent(value));
  el.dispatchEvent(makeKeyboardEvent("keyup", "a"));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  if (triggerBlurEvent) {
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }
}

/**
 * Click an element with a realistic mouse event sequence.
 */
export async function mimicClick(el: HTMLElement | null): Promise<void> {
  if (!el) return;

  const visibleEl = findVisibleParent(el) ?? el;
  scrollIntoViewIfNeeded(visibleEl);
  await sleep(randomDelay(20, 50));

  el.dispatchEvent(makeMouseEvent("pointerover", el));
  el.dispatchEvent(makeMouseEvent("mouseover", el));
  el.dispatchEvent(makeMouseEvent("pointerenter", el));
  el.dispatchEvent(makeMouseEvent("mouseenter", el));
  el.dispatchEvent(makeMouseEvent("pointermove", el));
  el.dispatchEvent(makeMouseEvent("mousemove", el));
  el.dispatchEvent(makeMouseEvent("pointerdown", el, { button: 0 }));
  el.dispatchEvent(makeMouseEvent("mousedown", el, { button: 0 }));
  el.focus?.();
  el.dispatchEvent(makeMouseEvent("pointerup", el, { button: 0 }));
  el.dispatchEvent(makeMouseEvent("mouseup", el, { button: 0 }));
  el.dispatchEvent(makeMouseEvent("click", el, { button: 0 }));

  await sleep(CLICK_SETTLE_DELAY);
}

/**
 * Toggle a checkbox (native or custom).
 */
export async function mimicCheckbox(el: HTMLInputElement | null): Promise<void> {
  if (!el) return;

  scrollIntoViewIfNeeded(el);
  await sleep(randomDelay(20, 40));

  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

  // Toggle using native setter
  const newChecked = !el.checked;
  if (NATIVE_CHECKED_SETTER) NATIVE_CHECKED_SETTER.call(el, newChecked);
  else el.checked = newChecked;

  el.dispatchEvent(makeMouseEvent("click", el));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

  await sleep(CLICK_SETTLE_DELAY);
}

/**
 * Select an option in a native <select> element.
 */
export async function mimicSelect(
  el: HTMLSelectElement | null,
  value: string
): Promise<boolean> {
  if (!el) return false;

  scrollIntoViewIfNeeded(el);
  await sleep(randomDelay(20, 40));

  // Find matching option
  const options = Array.from(el.options);
  const match =
    options.find((o) => o.value === value) ??
    options.find((o) => o.textContent?.trim().toLowerCase() === value.toLowerCase()) ??
    options.find((o) => o.textContent?.trim().toLowerCase().includes(value.toLowerCase()));

  if (!match) return false;

  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

  if (NATIVE_SELECT_SETTER) NATIVE_SELECT_SETTER.call(el, match.value);
  else el.value = match.value;

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

  await sleep(CLICK_SETTLE_DELAY);
  return true;
}

/**
 * Upload a file by setting the input's .files via DataTransfer.
 */
export async function mimicFileUpload(
  el: HTMLInputElement | null,
  file: File
): Promise<boolean> {
  if (!el || el.type !== "file") return false;

  scrollIntoViewIfNeeded(el);

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  el.files = dataTransfer.files;

  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));

  await sleep(200);
  return true;
}

/**
 * Press Enter on an element (useful for confirming autocomplete selections).
 */
export async function mimicPressEnter(el: HTMLElement | null): Promise<void> {
  if (!el) return;

  const enterInit: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
  };

  el.dispatchEvent(new KeyboardEvent("keydown", enterInit));
  el.dispatchEvent(new KeyboardEvent("keypress", enterInit));
  el.dispatchEvent(new KeyboardEvent("keyup", enterInit));

  await sleep(CLICK_SETTLE_DELAY);
}

/**
 * Set value on a contenteditable element.
 */
export async function mimicContentEditable(
  el: HTMLElement | null,
  value: string
): Promise<void> {
  if (!el) return;

  scrollIntoViewIfNeeded(el);
  el.focus();
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));

  el.textContent = value;

  el.dispatchEvent(makeInputEvent(value));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

  await sleep(POST_TYPE_DELAY);
}
