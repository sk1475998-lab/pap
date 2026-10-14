/**
 * Generic form navigation — Next, Continue, Submit on external ATS pages.
 *
 * Enhanced with:
 * - Flexible text matching (no anchor-only regex)
 * - aria-label reading for icon-only buttons
 * - Workday data-automation-id support
 * - Page transition verification
 * - Validation error detection
 * - Loading spinner awareness
 */

import { clickAtsAction, getValidationErrors } from "./ats-adapters.js";
import { getMatchingAtsConfig, getElementByXPath, isElementVisible } from "./ats-adapter.js";
import { waitForNetworkIdle, isNetworkIdle } from "./network-monitor.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for an element matched by XPath to disappear from the DOM.
 * Used for loading spinners defined in ATS configs.
 */
async function waitForXPathToDisappear(
  xpaths: string[],
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let found = false;
    for (const xpath of xpaths) {
      const el = getElementByXPath(xpath);
      if (el && isElementVisible(el)) {
        found = true;
        break;
      }
    }
    if (!found) return;
    await sleep(200);
  }
}

/**
 * Check if the ATS has loading spinners currently visible.
 * Uses ATS-config-defined loadingSpinnerXPath if available.
 */
function hasAtsLoadingSpinner(): boolean {
  const atsConfig = getMatchingAtsConfig(location.href);
  if (atsConfig?.loadingSpinnerXPath) {
    for (const xpath of atsConfig.loadingSpinnerXPath) {
      const el = getElementByXPath(xpath);
      if (el && isElementVisible(el)) return true;
    }
  }
  if (atsConfig?.formLoadingXPaths) {
    for (const xpath of atsConfig.formLoadingXPaths) {
      const el = getElementByXPath(xpath);
      if (el && isElementVisible(el)) return true;
    }
  }
  return false;
}

/** Patterns that indicate an advance/next button (case-insensitive, partial match OK). */
const ADVANCE_PATTERNS = [
  "next", "continue", "proceed", "review",
  "save and continue", "save & continue",
  "go to next", "next step", "continue to",
  "review your application", "review application",
  "save and next", "save & next",
  "apply now", "apply for this job",
  "easy apply",
];

const SUBMIT_PATTERNS = [
  "submit", "submit application", "submit my application",
  "send application", "complete application",
  "apply", "apply now", "submit & apply",
  "confirm and submit", "confirm & submit",
  "finish", "complete",
];

/** Patterns that indicate a dismiss/close button — should NOT be clicked. */
const DISMISS_PATTERNS = [
  "dismiss", "close", "cancel", "discard", "not now",
  "save for later", "remind me later", "skip",
  "go back", "back", "previous",
];

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el as HTMLElement);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
}

function buttonText(el: Element): string {
  // Check aria-label first (for icon-only buttons)
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();
  // Then check value for input[type=submit]
  if (el instanceof HTMLInputElement) return el.value?.trim() ?? "";
  // Then check text content
  return el.textContent?.trim() ?? "";
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[→←↑↓▶►▷▹➤➜→]/g, "") // Remove arrow characters
    .replace(/\s+/g, " ")
    .trim();
}

function matchesPattern(text: string, patterns: string[]): boolean {
  const norm = normalizeText(text);
  if (!norm || norm.length > 60) return false;
  return patterns.some((p) => {
    if (norm === p) return true;
    if (norm.startsWith(p)) return true;
    if (norm.includes(p)) return true;
    return false;
  });
}

function isDismissButton(text: string): boolean {
  return matchesPattern(text, DISMISS_PATTERNS);
}

/** Check if the page currently has validation errors. */
function hasValidationErrors(): boolean {
  const errorSelectors = [
    ".field-error:not([hidden])",
    "[aria-invalid='true']",
    ".form-error:not([hidden])",
    ".validation-error:not([hidden])",
    ".error-message:not([hidden])",
    ".artdeco-inline-feedback--error",
    ".jobs-easy-apply-form-element__error",
  ];
  for (const sel of errorSelectors) {
    const errors = document.querySelectorAll(sel);
    for (const err of errors) {
      if (isVisible(err) && err.textContent?.trim()) return true;
    }
  }
  return false;
}

/** Check if a loading spinner is visible. */
function isLoading(): boolean {
  const spinners = document.querySelectorAll(
    "[class*='spinner'], [class*='loading'], [class*='loader'], " +
    "[class*='Spinner'], [class*='Loading'], " +
    "[role='progressbar'], [aria-busy='true'], " +
    ".artdeco-spinner"
  );
  for (const s of spinners) {
    if (isVisible(s)) return true;
  }
  return false;
}

/**
 * Click the Next/Continue/Submit button on the current form.
 *
 * @param submit - If true, also allow clicking submit buttons
 * @returns "next" | "submit" | false
 */
export function clickFormAdvance(submit = false): "next" | "submit" | false {
  const atsConfig = getMatchingAtsConfig(location.href);
  if (atsConfig) {
    // Check for validation errors before advancing
    if (atsConfig.validationErrorXPaths) {
      for (const xpath of atsConfig.validationErrorXPaths) {
        const err = getElementByXPath(xpath);
        if (err && isElementVisible(err) && err.textContent?.trim()) {
          return false;
        }
      }
    }

    // Check error banners
    if (atsConfig.errorBannerXPaths) {
      for (const xpath of atsConfig.errorBannerXPaths) {
        const err = getElementByXPath(xpath);
        if (err && isElementVisible(err) && err.textContent?.trim()) {
          return false;
        }
      }
    }

    // Check for loading spinners — don't advance while loading
    if (hasAtsLoadingSpinner()) {
      return false;
    }

    if (submit && atsConfig.submitButtonPaths) {
      for (const xpath of atsConfig.submitButtonPaths) {
        const btn = getElementByXPath(xpath);
        if (btn && isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
          btn.click();
          // Post-click: wait for loading spinners to disappear
          void postClickWait(atsConfig);
          return "submit";
        }
      }
    }

    if (atsConfig.nextStepButtonPaths) {
      for (const xpath of atsConfig.nextStepButtonPaths) {
        const btn = getElementByXPath(xpath);
        if (btn && isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
          btn.click();
          // Post-click: wait for loading spinners to disappear
          void postClickWait(atsConfig);
          return "next";
        }
      }
    }
  }

  // Don't advance if there are validation errors
  if (hasValidationErrors() || getValidationErrors().length > 0) return false;

  // Don't advance if page is loading
  if (isLoading()) return false;

  // Platform-specific adapter path first. This is more reliable than generic
  // button text matching for Workday/Oracle/SAP/iCIMS/Taleo and friends.
  const adapterAction = clickAtsAction(submit);
  if (adapterAction === "submit") return "submit";
  if (adapterAction === "next" || adapterAction === "review") return "next";

  const candidates = [
    ...document.querySelectorAll<HTMLElement>(
      "button, input[type=submit], input[type=button], " +
      "a[role=button], [role=button], " +
      "[data-automation-id*='bottom-navigation'] button, " +
      "[data-automation-id*='footer'] button, " +
      ".jobs-easy-apply-footer button, " +
      "[class*='form-footer'] button, " +
      "[class*='form-actions'] button, " +
      "[class*='btn-primary'], [class*='btn-submit']"
    ),
  ].filter(isVisible);

  // Score each candidate
  const scored: { el: HTMLElement; score: number; type: "next" | "submit" }[] = [];

  for (const btn of candidates) {
    const text = buttonText(btn);
    if (!text) continue;
    if (isDismissButton(text)) continue;
    if ((btn as HTMLButtonElement).disabled) continue;

    const norm = normalizeText(text);

    // Check submit patterns
    if (matchesPattern(text, SUBMIT_PATTERNS)) {
      if (submit) {
        scored.push({ el: btn, score: 100, type: "submit" });
      }
      continue; // Don't click submit if not allowed
    }

    // Check advance patterns
    if (matchesPattern(text, ADVANCE_PATTERNS)) {
      // Higher score for primary/action buttons
      let score = 50;
      if (btn.classList.contains("artdeco-button--primary")) score += 20;
      if (btn.getAttribute("data-easy-apply-next-button") !== null) score += 30;
      if (/primary|action|main/i.test(btn.className)) score += 10;
      if (norm === "next" || norm === "continue") score += 15;
      scored.push({ el: btn, score, type: "next" });
    }
  }

  // Sort by score descending, click the best one
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]) {
    scored[0].el.click();
    return scored[0].type;
  }

  // Fallback: find any primary button in a footer area
  const footerBtn = document.querySelector<HTMLElement>(
    ".jobs-easy-apply-footer button.artdeco-button--primary:not([disabled]), " +
    "[class*='form-footer'] button[class*='primary']:not([disabled]), " +
    "[data-automation-id*='bottom-navigation'] button:not([disabled])"
  );
  if (footerBtn && isVisible(footerBtn)) {
    const text = buttonText(footerBtn);
    if (!isDismissButton(text)) {
      const isSubmit = matchesPattern(text, SUBMIT_PATTERNS);
      if (isSubmit && !submit) return false;
      footerBtn.click();
      return isSubmit ? "submit" : "next";
    }
  }

  return false;
}

/**
 * Async post-click wait: wait for network idle and ATS-specific spinners.
 * Called after clicking a button but runs asynchronously (fire-and-forget).
 */
async function postClickWait(atsConfig: ReturnType<typeof getMatchingAtsConfig>): Promise<void> {
  if (!atsConfig) return;

  // Wait for form loading spinners
  if (atsConfig.formLoadingAfterNextStepClick && atsConfig.formLoadingXPaths?.length) {
    await waitForXPathToDisappear(atsConfig.formLoadingXPaths, 8000);
  }

  // Wait for loading spinner
  if (atsConfig.loadingSpinnerXPath?.length) {
    await waitForXPathToDisappear(atsConfig.loadingSpinnerXPath, 5000);
  }

  // Wait for network to settle
  try {
    await waitForNetworkIdle({ timeout: 5000, quietPeriod: 300 });
  } catch {
    /* timeout is acceptable */
  }
}

/**
 * Wait for the page to transition after clicking an advance button.
 * Returns true if a transition was detected.
 *
 * Enhanced: also checks for network idle state and ATS-specific spinners.
 */
export async function waitForPageTransition(timeoutMs = 5000): Promise<boolean> {
  const startUrl = location.href;
  const startDom = document.body.innerHTML.length;
  const startTime = Date.now();
  const atsConfig = getMatchingAtsConfig(location.href);

  // First, wait for ATS-specific loading indicators
  if (atsConfig?.formLoadingXPaths?.length) {
    const loadingEl = getElementByXPath(atsConfig.formLoadingXPaths[0]);
    if (loadingEl && isElementVisible(loadingEl)) {
      await waitForXPathToDisappear(atsConfig.formLoadingXPaths, Math.min(timeoutMs, 8000));
      return true;
    }
  }

  while (Date.now() - startTime < timeoutMs) {
    // URL changed
    if (location.href !== startUrl) return true;
    // Significant DOM change (new step rendered)
    const nowDom = document.body.innerHTML.length;
    if (Math.abs(nowDom - startDom) > 500) return true;
    // Loading spinner appeared and disappeared
    if (isLoading() || hasAtsLoadingSpinner()) {
      // Wait for loading to finish
      while ((isLoading() || hasAtsLoadingSpinner()) && Date.now() - startTime < timeoutMs) {
        await sleep(200);
      }
      // Also wait for network to settle after spinner disappears
      try {
        await waitForNetworkIdle({ timeout: 3000, quietPeriod: 200 });
      } catch { /* ok */ }
      return true;
    }
    // Check if network is busy (AJAX-driven step transitions)
    if (!isNetworkIdle()) {
      try {
        await waitForNetworkIdle({ timeout: Math.max(1000, timeoutMs - (Date.now() - startTime)), quietPeriod: 300 });
      } catch { /* ok */ }
      const nowDom2 = document.body.innerHTML.length;
      if (Math.abs(nowDom2 - startDom) > 300) return true;
    }
    await sleep(200);
  }
  return false;
}

export function detectPageStepLabel(): string {
  const active = document.querySelector(
    "[aria-current=step], .active.step, .step.active, " +
    "[class*='step'][class*='current'], [class*='step'][class*='active'], " +
    "[class*='wizard-step'][class*='active'], " +
    ".jobs-easy-apply-content [class*='step'], " +
    "[data-automation-id*='step'][class*='active']"
  );
  return active?.textContent?.trim().slice(0, 60) ?? "";
}

export function isSubmitButtonPresent(): boolean {
  const atsConfig = getMatchingAtsConfig(location.href);
  if (atsConfig?.submitButtonPaths) {
    for (const xpath of atsConfig.submitButtonPaths) {
      const btn = getElementByXPath(xpath);
      if (btn && isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
        return true;
      }
    }
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    "button, input[type=submit], input[type=button], a[role=button], [role=button]"
  )).filter(isVisible);

  for (const btn of candidates) {
    const text = buttonText(btn);
    if (!text) continue;
    if (isDismissButton(text)) continue;
    if ((btn as HTMLButtonElement).disabled) continue;

    if (matchesPattern(text, SUBMIT_PATTERNS)) {
      return true;
    }
  }
  return false;
}

export async function clickAddButtons(profile?: any, doc: Document = document): Promise<boolean> {
  const experienceCount = profile?.experience?.length ?? 0;
  const educationCount = profile?.education?.length ?? 0;

  // Count current company/job-title inputs on page
  const companyInputs = Array.from(doc.querySelectorAll("input, textarea")).filter(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const name = el.getAttribute("name") || "";
    const id = el.getAttribute("id") || "";
    const placeholder = el.getAttribute("placeholder") || "";
    return /company|employer|organization|job.*title/i.test(name + id + placeholder);
  }).length;

  // Count current school/degree inputs on page
  const schoolInputs = Array.from(doc.querySelectorAll("input, textarea")).filter(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const name = el.getAttribute("name") || "";
    const id = el.getAttribute("id") || "";
    const placeholder = el.getAttribute("placeholder") || "";
    return /school|university|degree|major|field.*study/i.test(name + id + placeholder);
  }).length;

  const addPatterns = [
    { pattern: /add\s+(work|experience|job|employment|history)/i, allowed: companyInputs < experienceCount },
    { pattern: /add\s+(school|education|degree|qualification)/i, allowed: schoolInputs < educationCount },
    { pattern: /add\s+(another|more|new|row)/i, allowed: companyInputs < experienceCount || schoolInputs < educationCount },
    { pattern: /^add$/i, allowed: companyInputs < experienceCount || schoolInputs < educationCount }
  ];

  const buttons = Array.from(doc.querySelectorAll<HTMLElement>("button, a, [role='button'], input[type='button']"));
  let clicked = false;
  for (const btn of buttons) {
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const text = (btn.textContent || (btn as HTMLInputElement).value || "").trim();
    
    const match = addPatterns.find(p => p.pattern.test(text));
    if (match && match.allowed) {
      btn.click();
      clicked = true;
      console.log(`[SJA:autopilot] Expanded form section by clicking button: "${text}"`);
      await sleep(400); // Allow new inputs to render in DOM
      break; // Click one button at a time to let DOM settle and re-evaluate next run
    }
  }
  return clicked;
}

export interface StepTransitionResult {
  transitioned: boolean;
  validationErrors: string[];
  currentStepLabel: string;
  isSubmitStep: boolean;
}

/**
 * Enterprise SPA step transition monitor grounded in AgentQ & Reflexion.
 * Awaits asynchronous page mutation, verifies network idle, checks for inline ATS errors,
 * and identifies if the wizard advanced or reached final submission.
 */
export async function waitForStepTransition(timeoutMs = 6000): Promise<StepTransitionResult> {
  const transitioned = await waitForPageTransition(timeoutMs);
  // Short settling pause for React / Angular / Vue reconciliation
  await sleep(250);

  const validationErrors = getValidationErrors();
  const currentStepLabel = detectPageStepLabel();
  const isSubmitStep = isSubmitButtonPresent();

  return {
    transitioned,
    validationErrors,
    currentStepLabel,
    isSubmitStep,
  };
}
