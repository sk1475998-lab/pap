import { findDeepElement, findAllDeepElements } from "./dom-deep-scan.js";
/**
 * Filler — writes a value into a detected field AND triggers the events a
 * modern SPA (React/Vue/Angular) needs to actually pick up the change.
 *
 * Enhanced with:
 * - Full synthetic event sequence (focus → keydown → input → keyup → change → blur)
 * - Retry mechanism (up to 3 attempts with increasing delay)
 * - Support for _valueTracker and nativeInputValueSetter
 * - Date format detection and conversion
 * - Dropdown routing through strategy system
 * - Post-fill verification
 */
import type { DetectedField } from "@superjob/core";
import { fillCombobox, fillPhoneCountryCode, fillDropdownField } from "./dropdown-handler.js";
import { detectDropdownStrategy, fillAnyDropdown } from "./dropdown-strategies.js";
import { isYes, pickOption, formatDateValue } from "./filler-utils.js";
import { mimicSetValue, mimicContentEditable, mimicCheckbox as mimicCheckboxInput, mimicClick as mimicClickEl } from "./mimic-user.js";
import { isReactControlled, reactAwareFill, triggerReactClick, isReactSelect, fillReactSelect } from "./fiber-injector.js";

import { isXPath, queryNode, queryAllNodes } from "./ats-adapter.js";
import { diagLog } from "./diagnostics.js";
import { markProgrammaticAutofill } from "./programmatic-interaction.js";

/**
 * Query selector that pierces Shadow DOM boundaries.
 * Modern web components (Lit, Stencil, etc.) use Shadow DOM extensively.
 */
function queryShadowDeep(selector: string, root: ParentNode = document): Element | null {
  // First try normal query
  const found = queryNode(selector, root);
  if (found) return found;

  // Then pierce shadow roots
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot) {
      const inShadow = queryShadowDeep(selector, el.shadowRoot);
      if (inShadow) return inShadow;
    }
  }
  return null;
}

/**
 * Try to find and fill elements inside iframes (same-origin only).
 * Many ATS platforms embed application forms in iframes.
 */
function queryIframeDeep(selector: string): Element | null {
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) continue;
      const found = queryNode(selector, iframeDoc);
      if (found) return found;
      // Check nested iframes
      const nested = queryIframeInDoc(selector, iframeDoc);
      if (nested) return nested;
    } catch {
      // Cross-origin iframe — can't access
    }
  }
  return null;
}

function queryIframeInDoc(selector: string, doc: Document): Element | null {
  const found = queryNode(selector, doc);
  if (found) return found;
  const iframes = doc.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) continue;
      const nested = queryIframeInDoc(selector, iframeDoc);
      if (nested) return nested;
    } catch {}
  }
  return null;
}

/**
 * Enhanced query that checks: main document → shadow DOM → iframes.
 */
function queryDeep(selector: string): Element | null {
  return queryShadowDeep(selector) ?? queryIframeDeep(selector) ?? findDeepElement(selector);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NATIVE_SETTER = (() => {
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

function makeEvent(type: string, init: EventInit & Record<string, unknown> = {}): Event {
  const Ctor = (globalThis as Record<string, unknown>)[type === "input" ? "InputEvent" : "Event"] as
    | (new (eventType: string, eventInitDict?: EventInit) => Event)
    | undefined;
  try {
    return Ctor ? new Ctor(type, init) : new Event(type, init);
  } catch {
    return new Event(type, init);
  }
}

function makeKeyboardEvent(type: string, init: KeyboardEventInit = {}): Event {
  const Ctor = (globalThis as { KeyboardEvent?: new (eventType: string, eventInitDict?: KeyboardEventInit) => KeyboardEvent }).KeyboardEvent;
  try {
    return Ctor ? new Ctor(type, init) : new Event(type, init);
  } catch {
    return new Event(type, init);
  }
}

function makeMouseEvent(type: string, init: MouseEventInit = {}): Event {
  const Ctor = (globalThis as { MouseEvent?: new (eventType: string, eventInitDict?: MouseEventInit) => MouseEvent }).MouseEvent;
  try {
    return Ctor ? new Ctor(type, init) : new Event(type, init);
  } catch {
    return new Event(type, init);
  }
}

/**
 * Set value via native prototype setter + dispatch full event sequence.
 * This is the core trick that makes React/Vue/Angular pick up changes.
 * Now delegates to mimicSetValue for a more robust event sequence.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string, triggerBlur = true) {
  mimicSetValue(el, value, { triggerBlurEvent: triggerBlur });
}

export interface FillResult {
  field: DetectedField;
  ok: boolean;
  filledWith: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [200, 500, 1000];

export async function fillField(field: DetectedField, rawValue: unknown): Promise<FillResult> {
  const value = String(rawValue == null ? "" : typeof rawValue === "object" ? JSON.stringify(rawValue) : rawValue).trim();
  const success = (filledWith: string): FillResult => ({ field, ok: true, filledWith });
  const fail = (msg: string): FillResult => ({ field, ok: false, filledWith: msg });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fillFieldOnce(field, value);
      if (result.ok) {
        // Post-fill verification
        const verified = await verifyFill(field, result.filledWith);
        if (verified) {
          return result;
        }
        if (attempt === MAX_RETRIES - 1 || isTagField(field)) {
          return fail("value did not persist after filling");
        }
        // Value didn't stick — retry after delay
        await sleep(RETRY_DELAYS[attempt] ?? 500);
        continue;
      }
      // Fill failed — retry after delay
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt] ?? 500);
        continue;
      }
      return result;
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) {
        return fail(e instanceof Error ? e.message : "error");
      }
      await sleep(RETRY_DELAYS[attempt] ?? 500);
    }
  }
  return fail("max retries exceeded");
}

async function selectFirstDropdownOption(searchVal: string): Promise<boolean> {
  await sleep(350); // Wait for search results/dropdown options to render
  const selectors = [
    "[role='listbox'] [role='option']",
    "[role='listbox'] li",
    "[class*='suggestions'] [class*='option']",
    "[class*='typeahead'] div",
    "[class*='autocomplete'] div",
    "[class*='search-results'] li",
    "[class*='dropdown-menu'] li",
    "[class*='dropdown'] div",
    "[class*='dropdown'] li",
    ".jobs-search-box__typeahead-suggestion",
    "[class*='suggestion']",
  ];

  for (const selector of selectors) {
    try {
      const options = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((opt) => {
        const rect = opt.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && opt.textContent?.trim();
      });
      if (options.length > 0) {
        const best = options.find((opt) => opt.textContent?.toLowerCase().includes(searchVal.toLowerCase())) ?? options[0];
        if (best) {
          best.click();
          void diagLog("autofill", "dropdown-option-clicked", { message: `Clicked option: "${best.textContent?.trim()}"` });
          return true;
        }
      }
    } catch {}
  }
  return false;
}

async function triggerEnterKey(el: HTMLElement): Promise<void> {
  const keydownInit: KeyboardEventInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
  const keypressInit: KeyboardEventInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
  const keyupInit: KeyboardEventInit = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };

  const keydownEv = new KeyboardEvent("keydown", keydownInit);
  const keypressEv = new KeyboardEvent("keypress", keypressInit);
  const keyupEv = new KeyboardEvent("keyup", keyupInit);

  Object.defineProperty(keydownEv, "keyCode", { value: 13, writable: true });
  Object.defineProperty(keydownEv, "which", { value: 13, writable: true });
  Object.defineProperty(keypressEv, "keyCode", { value: 13, writable: true });
  Object.defineProperty(keypressEv, "which", { value: 13, writable: true });
  Object.defineProperty(keyupEv, "keyCode", { value: 13, writable: true });
  Object.defineProperty(keyupEv, "which", { value: 13, writable: true });

  el.dispatchEvent(keydownEv);
  el.dispatchEvent(keypressEv);
  el.dispatchEvent(keyupEv);
  await sleep(150);
}

async function fillFieldOnce(field: DetectedField, value: string): Promise<FillResult> {
  const success = (filledWith: string): FillResult => {
    void diagLog("autofill", "field-filled-success", {
      message: `✓ Filled [${field.label}] successfully with: "${filledWith}"`,
      data: { label: field.label, key: field.fieldKey, type: field.type }
    });
    return { field, ok: true, filledWith };
  };
  const fail = (msg: string): FillResult => {
    void diagLog("autofill", "field-filled-failure", {
      level: "warn",
      message: `⚠ Failed filling [${field.label}]: ${msg}`,
      data: { label: field.label, key: field.fieldKey, type: field.type, selector: field.selector }
    });
    return { field, ok: false, filledWith: msg };
  };

  // Radio buttons
  if (field.type === "radio") {
    void diagLog("autofill", "fill-type-radio", { message: `Attempting radio fill for [${field.label}]` });
    return fillRadio(field, value);
  }

  // Checkboxes
  if (field.type === "checkbox") {
    void diagLog("autofill", "fill-type-checkbox", { message: `Attempting checkbox fill for [${field.label}]` });
    return fillCheckbox(field, value);
  }

  // Check if element exists first (with Shadow DOM + iframe piercing)
  const el = queryNode(field.selector) ?? queryDeep(field.selector);
  if (!el) return fail("element not found in main document, shadows, or iframes");
  markProgrammaticAutofill(el);

  // Route through dropdown strategy system first
  const strategy = detectDropdownStrategy(el);
  if (strategy) {
    const strategyName = strategy.constructor.name || "UnknownStrategy";
    void diagLog("autofill", "fill-dropdown-strategy", { message: `Routing [${field.label}] to strategy: ${strategyName}` });
    const filled = await fillAnyDropdown(field, value);
    if (filled) return success(value);
    // If strategy failed but element is an input or textarea (e.g. LinkedIn school/university autocomplete),
    // fall back to direct text entry so the field is not left blank
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable) {
      void diagLog("autofill", "fill-dropdown-fallback-text", { message: `Dropdown strategy [${strategyName}] failed for [${field.label}], falling back to direct text input typing` });
    } else {
      return fail(`dropdown strategy [${strategyName}] failed`);
    }
  }

  // Native <select>
  if (field.type === "select") {
    void diagLog("autofill", "fill-type-select", { message: `Attempting native select fill for [${field.label}]` });
    return fillSelect(field, value);
  }

  // Combobox
  if (field.type === "combobox") {
    void diagLog("autofill", "fill-type-combobox", { message: `Attempting combobox fill for [${field.label}]` });
    // Try React Select first if detected
    if (isReactSelect(el)) {
      void diagLog("autofill", "react-select-detected", { message: `React Select component matched for [${field.label}]` });
      const filled = await fillReactSelect(el as HTMLElement, value);
      if (filled) return success(value);
    }
    const filled = await fillCombobox(field, value);
    return filled ? success(value) : fail("combobox options matching failed");
  }

  // Phone country code
  if (field.fieldKey === "phoneCountryCode" || /country\s*code|dial/i.test(field.label)) {
    void diagLog("autofill", "fill-phone-code", { message: `Attempting phone country code fill for [${field.label}]` });
    const filled = await fillPhoneCountryCode(value);
    if (filled) return success(value);
  }

  // Date fields — detect format and convert
  if (field.type === "date" || /date|birth|graduat|start.*date|end.*date/i.test(field.label)) {
    const input = el as HTMLInputElement;
    const formatted = formatDateValue(
      value,
      input.placeholder,
      input.type
    );
    void diagLog("autofill", "fill-date-format", { 
      message: `Formatting date for [${field.label}]: "${value}" -> "${formatted}" (placeholder: "${input.placeholder}", type: "${input.type}")` 
    });
    input.focus();
    setNativeValue(input, formatted);
    return success(formatted);
  }

  // Tag / Chip input simulation sequence (e.g. skills, languages, awards)
  if (isTagField(field) && el instanceof HTMLInputElement) {
    const tags = value.split(",").map((s) => s.trim()).filter(Boolean);
    void diagLog("autofill", "fill-tags", { message: `Simulating tag insertion for [${field.label}] with tags: ${JSON.stringify(tags)}` });
    el.focus();
    for (const tag of tags) {
      setNativeValue(el, tag, false); // DO NOT BLUR YET
      await sleep(150);

      // Try selecting from search suggestion list, fallback to Enter keypress
      const selected = await selectFirstDropdownOption(tag);
      if (!selected) {
        await triggerEnterKey(el);
      }
      await sleep(250);
    }
    setNativeValue(el, "", true); // Blur now that we've committed all tags
    return success(value);
  }

  // Standard text/textarea/number/email/tel/url inputs
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement
  ) {
    const isAutocompleteField = /skills|languages|awards|city|state|country|school|university|company|employer|major/i.test(field.label) ||
                                el.getAttribute("role") === "combobox" ||
                                el.getAttribute("autocomplete") === "on" ||
                                el.getAttribute("aria-autocomplete") === "list";

    // Use React-aware fill if the element is React-controlled
    if (isReactControlled(el)) {
      void diagLog("autofill", "react-fiber-fill", { message: `Using React fiber virtual-value tracker for [${field.label}]` });
      await reactAwareFill(el, value);
    } else {
      void diagLog("autofill", "standard-input-fill", { message: `Standard native input fill for [${field.label}]` });
      el.focus();
      setNativeValue(el, value);
    }

    // Try selecting from search suggestion list, fallback to Enter keypress for autocompletes
    if (isAutocompleteField && el instanceof HTMLInputElement) {
      const selected = await selectFirstDropdownOption(value);
      if (!selected) {
        await triggerEnterKey(el);
      }
    }

    return success(value);
  }

  // contenteditable elements (rich text editors)
  if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
    void diagLog("autofill", "contenteditable-fill", { message: `Simulating rich-text editor input events for [${field.label}]` });
    const htmlEl = el as HTMLElement;
    htmlEl.focus();
    htmlEl.textContent = value;
    htmlEl.dispatchEvent(makeEvent("input", { bubbles: true, data: value }));
    htmlEl.dispatchEvent(new Event("change", { bubbles: true }));
    htmlEl.dispatchEvent(new Event("blur", { bubbles: true }));
    return success(value);
  }

  return fail(`unsupported element tag/type: ${el.tagName}`);
}

function fillSelect(field: DetectedField, value: string): FillResult {
  const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as HTMLSelectElement | null;
  if (!el) {
    void diagLog("autofill", "select-failed-not-found", { level: "warn", message: `Select element [${field.label}] not found` });
    return { field, ok: false, filledWith: "not found" };
  }
  let match = pickOption(
    value,
    Array.from(el.options),
    (o) => o.textContent?.trim() ?? o.value,
    (o) => o.value,
    field.label
  );
  if (!match && (field.fieldKey === "email" || /email/i.test(field.label))) {
    const emailOpt = Array.from(el.options).find(o => o.value?.includes("@") || o.textContent?.includes("@"));
    if (emailOpt) match = emailOpt;
  }
  if (!match) {
    const optionsText = Array.from(el.options).map(o => `[${o.value}: ${o.textContent?.trim()}]`).join(", ");
    void diagLog("autofill", "select-option-not-found", {
      level: "info",
      message: `No matching option for value "${value}" in select [${field.label}]. Options available: ${optionsText}`
    });
    return { field, ok: false, filledWith: "no matching option" };
  }

  void diagLog("autofill", "select-option-matched", {
    message: `Matched option [${match.textContent?.trim()}] (value: "${match.value}") for select [${field.label}]`
  });

  el.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(el, match.value);
  else el.value = match.value;

  if (isReactControlled(el)) {
    const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (fiberKey) {
      const suffix = fiberKey.slice("__reactFiber$".length);
      const trackerKey = `__reactValueTracker$${suffix}`;
      (el as unknown as Record<string, unknown>)[trackerKey] = match.value;
    }
    const vt = (el as any)._valueTracker;
    if (vt && typeof vt.setValue === "function") {
      try { vt.setValue(""); } catch {}
    }
  }

  void diagLog("autofill", "select-event-dispatch", { message: `Dispatching focus, input, change, blur events on select [${field.label}]` });
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  return { field, ok: true, filledWith: match.value };
}

const cssEscape = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`));

async function fillRadio(field: DetectedField, value: string): Promise<FillResult> {
  const radios = (isXPath(field.selector) ? queryAllNodes(field.selector) : Array.from(document.querySelectorAll(field.selector))) as HTMLInputElement[];
  if (!radios.length) {
    // Try finding by name attribute as fallback
    const nameMatch = field.selector.match(/name="([^"]+)"/);
    if (nameMatch) {
      const byName = document.querySelectorAll<HTMLInputElement>(`input[name="${nameMatch[1]}"]`);
      radios.push(...Array.from(byName));
    }
  }
  if (!radios.length) {
    void diagLog("autofill", "radio-failed-not-found", { level: "warn", message: `Radio options for [${field.label}] not found` });
    return { field, ok: false, filledWith: "no radio buttons found" };
  }

  const match = pickOption(
    value,
    radios,
    (r) => field.options?.find((o) => o.value === r.value)?.label ?? labelSiblingText(r),
    (r) => r.value,
    field.label
  );
  if (!match) {
    const optionsText = radios.map(r => `[${r.value}: ${labelSiblingText(r)}]`).join(", ");
    void diagLog("autofill", "radio-option-not-found", {
      level: "warn",
      message: `No matching radio option for value "${value}" in [${field.label}]. Options: ${optionsText}`
    });
    return { field, ok: false, filledWith: "no matching option" };
  }

  void diagLog("autofill", "radio-option-matched", {
    message: `Matched radio option [${match.value}] (label: "${labelSiblingText(match)}") for radio group [${field.label}]`
  });

  // Try clicking the label first if it exists
  let labelEl: HTMLElement | null = null;
  const id = match.getAttribute("id");
  if (id) {
    labelEl = document.querySelector(`label[for="${cssEscape(id)}"]`);
  }
  if (!labelEl) {
    labelEl = match.closest("label");
  }
  if (labelEl) {
    void diagLog("autofill", "radio-label-click", { message: `Clicking parent/sibling label for radio option [${match.value}]` });
    await mimicClickEl(labelEl);
  }

  // Programmatic setter fallback
  if (!match.checked) {
    void diagLog("autofill", "radio-programmatic-check", { message: `Radio button did not get checked by label click. Triggering fallback programmatic check.` });
    if (NATIVE_CHECKED_SETTER) {
      NATIVE_CHECKED_SETTER.call(match, true);
    } else {
      match.checked = true;
    }
  }

  // Always dispatch React-compatible events on the input itself to sync framework state
  if (isReactControlled(match)) {
    triggerReactClick(match);
    match.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // Dispatch full event sequence for React/Vue/Angular
    match.dispatchEvent(new Event("focus", { bubbles: true }));
    match.dispatchEvent(makeMouseEvent("mousedown", { bubbles: true }));
    match.dispatchEvent(makeMouseEvent("mouseup", { bubbles: true }));
    match.dispatchEvent(makeMouseEvent("click", { bubbles: true }));
    match.dispatchEvent(new Event("input", { bubbles: true }));
    match.dispatchEvent(new Event("change", { bubbles: true }));
    match.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  return { field, ok: true, filledWith: match.value };
}

async function fillCheckbox(field: DetectedField, value: string): Promise<FillResult> {
  const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as HTMLInputElement | null;
  if (!el) {
    void diagLog("autofill", "checkbox-failed-not-found", { level: "warn", message: `Checkbox element [${field.label}] not found` });
    return { field, ok: false, filledWith: "not found" };
  }
  markProgrammaticAutofill(el);
  const want = isYes(value);
  void diagLog("autofill", "checkbox-matched", { message: `Checkbox [${field.label}] matched. Desired checked state: ${want}` });
  if (el.checked !== want) {
    let labelEl: HTMLElement | null = null;
    const id = el.getAttribute("id");
    if (id) {
      labelEl = document.querySelector(`label[for="${cssEscape(id)}"]`);
    }
    if (!labelEl) {
      labelEl = el.closest("label");
    }

    if (labelEl) {
      void diagLog("autofill", "checkbox-label-click", { message: `Clicking label for checkbox [${field.label}]` });
      await mimicClickEl(labelEl);
    }

    if (el.checked !== want) {
      void diagLog("autofill", "checkbox-programmatic-check", { message: `Checkbox status did not sync. Running programmatic fallback checked set.` });
      if (NATIVE_CHECKED_SETTER) {
        NATIVE_CHECKED_SETTER.call(el, want);
      } else {
        el.checked = want;
      }

      if (isReactControlled(el)) {
        triggerReactClick(el);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.dispatchEvent(new Event("focus", { bubbles: true }));
        el.dispatchEvent(makeMouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(makeMouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(makeMouseEvent("click", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }
  }
  return { field, ok: true, filledWith: String(want) };
}

function labelSiblingText(radio: HTMLInputElement): string {
  const wrap = radio.closest("label");
  if (wrap) return wrap.textContent?.replace(radio.value, "").trim() ?? "";
  const sib = radio.nextElementSibling;
  if (sib?.tagName === "LABEL") return sib.textContent?.trim() ?? "";
  // Also check preceding label
  const prev = radio.previousElementSibling;
  if (prev?.tagName === "LABEL") return prev.textContent?.trim() ?? "";
  return radio.value;
}

/**
 * Verify that the fill actually took effect.
 * Returns true if the element's current value matches what we set.
 */
async function verifyFill(field: DetectedField, expectedValue: string): Promise<boolean> {
  try {
    if (field.type === "radio") {
      const radios = (isXPath(field.selector)
        ? queryAllNodes(field.selector)
        : Array.from(document.querySelectorAll(field.selector))) as HTMLInputElement[];
      return radios.some((radio) => radio.checked && radio.value === expectedValue);
    }

    if (field.type === "checkbox") {
      const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as HTMLInputElement | null;
      return Boolean(el && el.checked === isYes(expectedValue));
    }

    if (field.type === "file") {
      const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as HTMLInputElement | null;
      return Boolean(el?.files?.length);
    }

    const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as
      | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement | null;
    if (!el) return false;

    if (field.type === "combobox") {
      const currentText = (el as HTMLElement).innerText ?? el.textContent ?? "";
      const currentValue = (el as HTMLInputElement).value ?? "";
      return `${currentValue} ${currentText}`.toLowerCase().includes(expectedValue.toLowerCase());
    }

    if (
      isTagField(field) &&
      el instanceof HTMLInputElement
    ) {
      const renderedText = el.parentElement?.parentElement?.textContent ?? "";
      const tags = expectedValue.split(",").map((tag) => tag.trim()).filter(Boolean);
      return tags.length > 0 && tags.every((tag) =>
        renderedText.toLowerCase().includes(tag.toLowerCase())
      );
    }

    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox")
    ) {
      return (el.textContent ?? "").trim().includes(expectedValue.trim());
    }

    const currentValue = (el as HTMLInputElement).value?.trim() ?? "";
    if (!currentValue) return false;
    // Exact match or the element contains our value
    const expected = expectedValue.toLowerCase();
    const current = currentValue.toLowerCase();
    return current === expected || current.includes(expected) || expected.includes(current);
  } catch {
    return false;
  }
}

function isTagField(field: DetectedField): boolean {
  return field.fieldKey === "skills" ||
    field.fieldKey === "languages" ||
    field.fieldKey === "awards" ||
    /skills|languages|awards|hobbies/i.test(field.label);
}

export { isYes } from "./filler-utils.js";
export { isNo } from "./filler-utils.js";

export function fillFile(field: DetectedField, file: File): FillResult {
  const fail = (msg: string): FillResult => ({ field, ok: false, filledWith: msg });
  try {
    const el = (queryNode(field.selector) ?? queryDeep(field.selector)) as HTMLInputElement | null;
    if (!el) {
      // Try finding any visible file input on the page
      const fallback = document.querySelector<HTMLInputElement>(
        'input[type="file"]:not([hidden])'
      );
      if (!fallback) return fail("element not found");
      return doFileUpload(field, fallback, file);
    }
    if (el.type !== "file") return fail("not a file input");
    return doFileUpload(field, el, file);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "upload failed");
  }
}

function doFileUpload(field: DetectedField, el: HTMLInputElement, file: File): FillResult {
  const dt = new DataTransfer();
  dt.items.add(file);
  el.files = dt.files;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));

  // Also try dispatching drop event for drag-and-drop zones
  const dropZone = el.closest("[class*='drop'], [class*='upload'], [class*='drag']");
  if (dropZone) {
    const dropEvent = new DragEvent("drop", {
      bubbles: true,
      dataTransfer: dt,
    });
    dropZone.dispatchEvent(dropEvent);
  }

  return { field, ok: true, filledWith: file.name };
}

export function isResumeField(field: DetectedField): boolean {
  const label = field.label.toLowerCase();
  return (
    field.type === "file" ||
    field.fieldKey === "resumeFile" ||
    /resume|curriculum|vitae|\bcv\b|upload.*document|upload.*file|attach.*resume/i.test(label)
  );
}

export function autoCheckAgreements(): number {
  // Query across main document, shadow roots, and same-origin iframes
  const allCheckboxes: HTMLInputElement[] = [];
  
  // Main document
  allCheckboxes.push(...Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')));
  
  // Shadow DOM
  const allEls = document.querySelectorAll("*");
  for (const el of allEls) {
    if (el.shadowRoot) {
      allCheckboxes.push(...Array.from(el.shadowRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')));
    }
  }
  
  // Same-origin iframes
  const iframes = document.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        allCheckboxes.push(...Array.from(iframeDoc.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')));
      }
    } catch {}
  }
  
  const checkboxes = allCheckboxes.filter((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
  });

  const patterns = /agree|consent|terms|privacy|policy|condition|gdpr|acknowledg|declare|auth/i;
  let count = 0;

  for (const el of checkboxes) {
    if (el.checked) continue;

    const name = el.getAttribute("name") || "";
    const id = el.getAttribute("id") || "";
    const value = el.getAttribute("value") || "";
    const labelAttr = el.getAttribute("aria-label") || "";
    
    let labelText = "";
    if (id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) labelText = lbl.textContent || "";
      } catch {}
    }
    if (!labelText) {
      const parentLabel = el.closest("label");
      if (parentLabel) labelText = parentLabel.textContent || "";
    }
    if (!labelText) {
      const nextSib = el.nextElementSibling;
      if (nextSib && /label/i.test(nextSib.tagName)) labelText = nextSib.textContent || "";
    }

    const testStr = `${name} ${id} ${value} ${labelAttr} ${labelText}`.toLowerCase();
    if (patterns.test(testStr)) {
      el.focus();
      let labelEl = el.closest("label");
      if (!labelEl && id) {
        try {
          labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        } catch {}
      }
      if (labelEl) {
        (labelEl as HTMLElement).click();
      }
      
      if (!el.checked) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
        if (setter) setter.call(el, true);
        else el.checked = true;

        el.dispatchEvent(new Event("focus", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }
      count++;
    }
  }

  return count;
}
