/**
 * Form validation error recovery.
 *
 * After autofill, some ATS platforms display validation errors for fields
 * that were filled incorrectly or left empty.  This module:
 *  1. Detects validation errors using ATS-config XPaths + generic heuristics
 *  2. Returns structured error info for the autopilot to act on
 *  3. Provides utilities to dismiss error banners
 *  4. Auto-retry: re-fills fields that have validation errors
 *  5. Pre-submit validation: checks all required fields before submit
 *
 * High-precision root selector error-banner and validation recovery logic.
 */
import type { AtsConfig } from "@/lib/ats-configs-data.js";
import { classifyLabel } from "@superjob/core";
import { setReactValue, isReactControlled } from "./fiber-injector.js";
import { shouldSkipElement } from "./detector.js";

/* ─── Types ───────────────────────────────────────────────────────── */

export interface ValidationError {
  label: string;
  message: string;
  element: Element;
  fromConfig: boolean;
}

export interface ErrorBanner {
  message: string;
  element: Element;
  dismissed: boolean;
}

/* ─── Generic selectors ──────────────────────────────────────────── */

const GENERIC_ERROR_SELECTORS = [
  ".invalid-feedback",
  ".field-error",
  ".error-message",
  ".form-error",
  "[class*='error'][class*='message']",
  "[class*='validation'][class*='error']",
  "[class*='field'][class*='error']",
  "[aria-invalid='true']",
  "[aria-errormessage]",
  ".WGUD",
  "[data-automation-id='errorMessage']",
  ".error_message",
  ".js-error",
  ".application-field .error",
  ".icims-error",
  ".errMsg",
  ".error-placeholder",
];

const BANNER_SELECTORS = [
  "[class*='alert'][class*='error']",
  "[class*='notification'][class*='error']",
  "[role='alert']",
  ".snackbar--error",
  "[class*='toast'][class*='error']",
  "[data-automation-id='FORM_ERROR']",
  "[data-automation-id='validationError']",
];

const MAX_ERROR_TEXT = 200;

/* ─── Detection ──────────────────────────────────────────────────── */

/**
 * Detect inline validation errors on the page.
 * Uses ATS-config XPaths (if provided) plus generic CSS heuristics.
 */
export function detectValidationErrors(atsConfig?: AtsConfig | null): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<Element>();

  // ATS-config driven
  const xpaths: string[] = (atsConfig as any)?.validationErrorXPaths ?? [];
  for (const xpath of xpaths) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as Element;
        if (!el || seen.has(el)) continue;
        seen.add(el);
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || "";
        if (!text) continue;
        errors.push({ label: resolveErrorLabel(el), message: text.slice(0, MAX_ERROR_TEXT), element: el, fromConfig: true });
      }
    } catch { /* invalid xpath */ }
  }

  // Generic CSS selectors
  for (const selector of GENERIC_ERROR_SELECTORS) {
    try {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || "";
        if (!text || text.length < 3) continue;
        const rect = (el as HTMLElement).getBoundingClientRect?.();
        if (rect && rect.width === 0 && rect.height === 0) continue;
        errors.push({ label: resolveErrorLabel(el), message: text.slice(0, MAX_ERROR_TEXT), element: el, fromConfig: false });
      }
    } catch { /* selector not valid */ }
  }

  return errors;
}

/**
 * Detect dismissible error banners.
 */
export function detectErrorBanners(atsConfig?: AtsConfig | null): ErrorBanner[] {
  const banners: ErrorBanner[] = [];
  const seen = new Set<Element>();

  const xpaths: string[] = (atsConfig as any)?.errorBannerXPaths ?? [];
  for (const xpath of xpaths) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i) as Element;
        if (!el || seen.has(el)) continue;
        seen.add(el);
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || "";
        banners.push({ message: text.slice(0, MAX_ERROR_TEXT), element: el, dismissed: false });
      }
    } catch {}
  }

  for (const sel of BANNER_SELECTORS) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || "";
        if (!text) continue;
        banners.push({ message: text.slice(0, MAX_ERROR_TEXT), element: el, dismissed: false });
      }
    } catch {}
  }

  return banners;
}

/**
 * Try to dismiss all visible error banners by clicking their close buttons.
 * Returns the number dismissed.
 */
export function dismissErrorBanners(atsConfig?: AtsConfig | null): number {
  const banners = detectErrorBanners(atsConfig);
  let dismissed = 0;
  for (const banner of banners) {
    const closeBtn = (banner.element as HTMLElement).querySelector<HTMLElement>(
      "button[aria-label*='close'], button[aria-label*='dismiss'], button.close, [class*='close']"
    );
    if (closeBtn) {
      try { closeBtn.click(); banner.dismissed = true; dismissed++; } catch {}
    }
  }
  return dismissed;
}

/**
 * Count empty required fields on the page.
 */
export function countEmptyRequiredFields(root: ParentNode = document): number {
  const controls = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type=hidden]):not([type=file]):not([type=submit]), textarea, select"
    )
  );
  let missing = 0;
  for (const el of controls) {
    if ((el as HTMLInputElement).disabled) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const required = el.required || el.getAttribute("aria-required") === "true";
    if (!required) continue;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      const name = el.name;
      if (name) {
        const group = Array.from(root.querySelectorAll<HTMLInputElement>(
          `input[name="${CSS.escape(name)}"]`
        ));
        if (!group.some((x) => x.checked)) missing++;
      } else if (!el.checked) missing++;
    } else if (!el.value?.trim()) {
      missing++;
    }
  }
  return missing;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function resolveErrorLabel(errorEl: Element): string {
  const id = errorEl.id;
  if (id) {
    const field = document.querySelector<HTMLElement>(`[aria-describedby="${CSS.escape(id)}"]`);
    if (field) {
      return (
        field.getAttribute("aria-label") ||
        field.closest("label")?.textContent?.trim() ||
        field.getAttribute("name") ||
        id
      );
    }
  }
  let cursor: Element | null = errorEl.parentElement;
  for (let depth = 0; depth < 4 && cursor; depth++) {
    const label = cursor.querySelector("label");
    if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 80);
    cursor = cursor.parentElement;
  }
  return "Unknown field";
}

/* ─── Auto-recovery ──────────────────────────────────────────────────── */

/** Error patterns that suggest a specific fix */
export interface ErrorFix {
  fieldLabel: string;
  errorMessage: string;
  suggestedAction: "refill" | "clear-and-refill" | "select-option" | "check-format" | "user-action";
  formatHint?: string;
  fieldKey?: string;
}

/**
 * Analyze validation errors and suggest fixes.
 * Maps common ATS error messages to actionable fixes.
 */
export function analyzeErrorsForFixes(errors: ValidationError[]): ErrorFix[] {
  return errors.map((err) => {
    const msg = err.message.toLowerCase();
    const label = err.label;
    const fieldKey = classifyLabel(label);

    // Format-specific errors
    if (/phone|mobile|contact.*number/.test(msg) && /format|invalid|valid/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "check-format", formatHint: "Use international format: +{country code}{number}", fieldKey };
    }
    if (/email/.test(msg) && /format|invalid|valid/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "check-format", formatHint: "Use standard email format: name@domain.com", fieldKey };
    }
    if (/date/.test(msg) && /format|invalid/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "check-format", formatHint: "Try MM/DD/YYYY or DD/MM/YYYY format", fieldKey };
    }
    if (/numeric|number|digit/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "check-format", formatHint: "Enter only numbers, no spaces or special characters", fieldKey };
    }

    // Required field errors
    if (/required|mandatory|compulsory|must/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "refill", fieldKey };
    }

    // Invalid selection
    if (/select|choose|pick|option/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "select-option", fieldKey };
    }

    // Generic invalid value — clear and refill
    if (/invalid|incorrect|wrong|not valid|unacceptable/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "clear-and-refill", fieldKey };
    }

    // File-related errors
    if (/file|upload|document|resume|pdf|doc/.test(msg)) {
      return { fieldLabel: label, errorMessage: err.message, suggestedAction: "user-action", formatHint: "Upload a valid PDF/DOCX resume file", fieldKey };
    }

    // Default: needs user action
    return { fieldLabel: label, errorMessage: err.message, suggestedAction: "user-action", fieldKey };
  });
}

/**
 * Pre-submit validation: comprehensive check before clicking submit.
 */
export interface PreSubmitValidation {
  isValid: boolean;
  emptyRequired: { label: string; element: Element; fieldKey: string }[];
  validationErrors: ValidationError[];
  errorBanners: ErrorBanner[];
  fixes: ErrorFix[];
  summary: string;
}

export function preSubmitValidation(atsConfig?: AtsConfig | null): PreSubmitValidation {
  const validationErrors = detectValidationErrors(atsConfig);
  const errorBanners = detectErrorBanners(atsConfig);
  const emptyRequired: { label: string; element: Element; fieldKey: string }[] = [];

  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type=hidden]):not([type=file]):not([type=submit]), textarea, select"
    )
  );

  for (const el of controls) {
    if ((el as HTMLInputElement).disabled) continue;
    // Real visibility & template guard
    if ((el as HTMLElement).offsetParent === null && window.getComputedStyle(el).position !== "fixed") continue;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
    if (el.closest("[aria-hidden='true'], [inert], template, .hidden, [style*='display: none'], [data-automation-id*='template']")) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const required = el.required || el.getAttribute("aria-required") === "true";
    if (!required) continue;

    const label = resolveErrorLabel(el);
    if (!label || shouldSkipElement(el, label)) continue;
    const fieldKey = classifyLabel(label);

    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      const name = el.name;
      if (name) {
        const group = Array.from(document.querySelectorAll<HTMLInputElement>(
          `input[name="${CSS.escape(name)}"]`
        ));
        if (!group.some((x) => x.checked)) {
          emptyRequired.push({ label, element: el, fieldKey });
        }
      } else if (!el.checked) {
        emptyRequired.push({ label, element: el, fieldKey });
      }
    } else if (!el.value?.trim()) {
      emptyRequired.push({ label, element: el, fieldKey });
    }
  }

  // Deduplicate emptyRequired entries by element and label
  const dedupedEmptyRequired = emptyRequired.filter((item, index, self) =>
    index === self.findIndex((t) => t.element === item.element || (t.label === item.label && t.label.length > 2))
  );

  const fixes = analyzeErrorsForFixes(validationErrors);
  const isValid = dedupedEmptyRequired.length === 0 && validationErrors.length === 0 && errorBanners.filter(b => !b.dismissed).length === 0;

  const summary = isValid
    ? "All fields validated successfully"
    : `${dedupedEmptyRequired.length} empty required, ${validationErrors.length} validation error(s), ${errorBanners.filter(b => !b.dismissed).length} banner(s)`;

  return { isValid, emptyRequired: dedupedEmptyRequired, validationErrors, errorBanners, fixes, summary };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * LATS-style Reflective Format Mutators.
 * Generates candidate mutations for fields that failed environmental validation.
 */
export function generateFormatMutations(fieldKey: string, currentValue: string, errorMessage: string): string[] {
  const mutations: string[] = [];
  const lowerMsg = errorMessage.toLowerCase();

  if (fieldKey === "phone" || /phone|mobile/i.test(lowerMsg)) {
    const digits = currentValue.replace(/\D/g, "");
    if (digits.length >= 7) {
      mutations.push(digits);
      if (digits.length === 10) {
        mutations.push(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`); // (123) 456-7890
        mutations.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`); // 123-456-7890
        mutations.push(`+1${digits}`); // +11234567890
        mutations.push(`+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
      } else if (digits.length === 11 && digits.startsWith("1")) {
        const national = digits.slice(1);
        mutations.push(national);
        mutations.push(`(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`);
        mutations.push(`+${digits}`);
      } else if (digits.length > 10) {
        mutations.push(`+${digits}`);
        mutations.push(digits.slice(-10));
      }
    }
  } else if (fieldKey === "date" || /date/i.test(lowerMsg)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
      const [y, m, d] = currentValue.split("-");
      mutations.push(`${m}/${d}/${y}`);
      mutations.push(`${d}/${m}/${y}`);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(currentValue)) {
      const [m, d, y] = currentValue.split("/");
      mutations.push(`${y}-${m}-${d}`);
      mutations.push(`${d}/${m}/${y}`);
    }
  } else if (/numeric|number|digit/i.test(lowerMsg)) {
    mutations.push(currentValue.replace(/[^\d.]/g, ""));
    mutations.push(currentValue.replace(/\D/g, ""));
  }

  // Check character limits (e.g. "Max 50 characters", "cannot exceed 100")
  const limitMatch = lowerMsg.match(/(?:max|maximum|at most|cannot exceed|limit of?)\s*(\d+)\s*(?:char|letter)/i);
  if (limitMatch && limitMatch[1]) {
    const limit = parseInt(limitMatch[1], 10);
    if (!isNaN(limit) && limit > 0 && currentValue.length > limit) {
      mutations.unshift(currentValue.slice(0, limit).trim());
    }
  }

  return mutations.filter((m) => m && m !== currentValue);
}

/**
 * Attempt auto-recovery: fix fillable errors automatically using LATS reflection.
 */
export async function attemptAutoRecovery(
  atsConfig?: AtsConfig | null,
  refillCallback?: (fieldKey: string, label: string) => Promise<boolean>
): Promise<{ recovered: number; remaining: number; details: ErrorFix[] }> {
  const errors = detectValidationErrors(atsConfig);
  const fixes = analyzeErrorsForFixes(errors);
  let recovered = 0;

  for (const fix of fixes) {
    // 1. Format-specific errors: apply LATS reflective mutation
    if (fix.suggestedAction === "check-format" && fix.fieldKey) {
      const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      for (const inp of inputs) {
        const lbl = resolveErrorLabel(inp);
        if (classifyLabel(lbl) === fix.fieldKey && inp.value) {
          const originalVal = inp.value;
          const mutations = generateFormatMutations(fix.fieldKey, originalVal, fix.errorMessage);
          for (const mutatedVal of mutations) {
            inp.focus();
            // C4 FIX: Use setReactValue to bypass React controlled-component override
            // Raw assignment (inp.value = ...) is silently discarded on React-based ATS
            // platforms like Greenhouse, Lever, Ashby, and Eightfold.
            if (isReactControlled(inp)) {
              setReactValue(inp as HTMLInputElement | HTMLTextAreaElement, mutatedVal);
            } else {
              inp.value = mutatedVal;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
            }
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
            await sleep(150);

            // Check if error message for this element cleared
            const currentErrors = detectValidationErrors(atsConfig);
            if (!currentErrors.some((e) => e.label === fix.fieldLabel)) {
              recovered++;
              break;
            }
          }
          break;
        }
      }
      continue;
    }

    // 2. Refill and Clear-and-Refill
    if (fix.suggestedAction === "refill" || fix.suggestedAction === "clear-and-refill") {
      if (fix.suggestedAction === "clear-and-refill") {
        const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        for (const inp of inputs) {
          const lbl = resolveErrorLabel(inp);
          if (classifyLabel(lbl) === fix.fieldKey) {
            setReactValue(inp, "");
            break;
          }
        }
      }

      if (refillCallback && fix.fieldKey) {
        try {
          const success = await refillCallback(fix.fieldKey, fix.fieldLabel);
          if (success) recovered++;
        } catch { /* recovery failed */ }
      }
    }
  }

  dismissErrorBanners(atsConfig);
  const remainingErrors = detectValidationErrors(atsConfig);
  return { recovered, remaining: remainingErrors.length, details: fixes };
}