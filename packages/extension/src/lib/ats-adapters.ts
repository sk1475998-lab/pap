/**
 * ATS finite-state adapter layer.
 *
 * This is the foundation for being reliable across Workday, Greenhouse, Lever,
 * Ashby, iCIMS, Taleo, Oracle HCM, SAP SuccessFactors and custom ATS pages.
 * It centralizes platform-specific selectors/labels instead of scattering them
 * across detector/navigation code.
 */
import { detectPlatform } from "./platforms.js";

export type AtsAction = "next" | "submit" | "review" | "none";

export interface AtsAdapter {
  id: string;
  name: string;
  rootSelectors: string[];
  nextSelectors: string[];
  submitSelectors: string[];
  validationSelectors: string[];
  confirmationSelectors: string[];
  closedText: RegExp[];
  nextText: RegExp[];
  submitText: RegExp[];
}

const COMMON_VALIDATION = [
  "[aria-invalid='true']",
  "[role='alert']",
  "[class*='error']:not([hidden])",
  "[class*='invalid']:not([hidden])",
  "[data-automation-id*='error']",
  ".field-error:not([hidden])",
  ".form-error:not([hidden])",
];

const COMMON_CONFIRM = [
  "[class*='success']",
  "[class*='confirmation']",
  "[data-automation-id*='confirmation']",
  "[data-test*='confirmation']",
];

const DEFAULT_NEXT_TEXT = [
  /^(next|continue|proceed|review)$/i,
  /save\s*(and|&)\s*(continue|next)/i,
  /continue\s+to/i,
  /review\s+(application|your application)/i,
];

const DEFAULT_SUBMIT_TEXT = [
  /^(submit|finish|complete)$/i,
  /submit\s+(application|my application|your application)/i,
  /(confirm|review)\s*(and|&)\s*submit/i,
  /send\s+application/i,
  /^apply\s+now$/i,
];

function adapter(partial: Partial<AtsAdapter> & Pick<AtsAdapter, "id" | "name">): AtsAdapter {
  return {
    id: partial.id,
    name: partial.name,
    rootSelectors: partial.rootSelectors ?? ["form", "main"],
    nextSelectors: partial.nextSelectors ?? [],
    submitSelectors: partial.submitSelectors ?? [],
    validationSelectors: [...COMMON_VALIDATION, ...(partial.validationSelectors ?? [])],
    confirmationSelectors: [...COMMON_CONFIRM, ...(partial.confirmationSelectors ?? [])],
    closedText: partial.closedText ?? [],
    nextText: [...DEFAULT_NEXT_TEXT, ...(partial.nextText ?? [])],
    submitText: [...DEFAULT_SUBMIT_TEXT, ...(partial.submitText ?? [])],
  };
}

export const ATS_ADAPTERS: AtsAdapter[] = [
  adapter({
    id: "workday",
    name: "Workday",
    rootSelectors: ["[data-automation-id='applyFlowPage']", "[data-automation-id]", "form", "main"],
    nextSelectors: [
      "button[data-automation-id='bottom-navigation-next-button']",
      "button[data-automation-id='pageFooterNextButton']",
      "button[data-automation-id*='Next']",
    ],
    submitSelectors: [
      "button[data-automation-id='bottom-navigation-submit-button']",
      "button[data-automation-id='submitApplication']",
      "button[data-automation-id*='Submit']",
    ],
    validationSelectors: ["[data-automation-id='errorMessage']", "[data-automation-id*='error']"],
    confirmationSelectors: ["[data-automation-id*='submitted']", "[data-automation-id*='confirmation']"],
    closedText: [/no longer accepting applications/i, /job posting is no longer available/i],
  }),
  adapter({
    id: "greenhouse",
    name: "Greenhouse",
    rootSelectors: ["#grnhse_app", "form", "main"],
    nextSelectors: ["button[type='button']", "input[type='button']"],
    submitSelectors: ["button[type='submit']", "input[type='submit']", "#submit_app"],
    validationSelectors: [".field-error-msg", ".error-message", ".error"],
    confirmationSelectors: ["#application_confirmation", ".application-confirmation"],
    closedText: [/this job is no longer available/i, /no longer accepting applications/i],
  }),
  adapter({
    id: "lever",
    name: "Lever",
    rootSelectors: [".application-form", "form", "main"],
    submitSelectors: ["button[type='submit']", ".postings-btn"],
    validationSelectors: [".error", ".application-error"],
    confirmationSelectors: [".confirmation", ".post-apply"],
    closedText: [/posting has expired/i, /no longer accepting applications/i],
  }),
  adapter({
    id: "ashby",
    name: "Ashby",
    rootSelectors: ["[data-testid*='application']", "form", "main"],
    nextSelectors: ["button[type='button']"],
    submitSelectors: ["button[type='submit']"],
    validationSelectors: ["[data-testid*='error']", "[class*='error']"],
    confirmationSelectors: ["[data-testid*='success']", "[class*='success']"],
  }),
  adapter({
    id: "icims",
    name: "iCIMS",
    rootSelectors: ["#icims_content_iframe", "form", "main"],
    nextSelectors: ["input[value*='Next']", "button[id*='next']", "a[id*='next']"],
    submitSelectors: ["input[value*='Submit']", "button[id*='submit']", "a[id*='submit']"],
    validationSelectors: [".iCIMS_Error", ".error"],
    confirmationSelectors: [".iCIMS_Confirmation", "[id*='confirmation']"],
  }),
  adapter({
    id: "taleo",
    name: "Taleo",
    rootSelectors: ["form", "#requisitionDescriptionInterface", "main"],
    nextSelectors: ["input[name*='next']", "input[value*='Next']", "button[id*='next']"],
    submitSelectors: ["input[name*='submit']", "input[value*='Submit']", "button[id*='submit']"],
    validationSelectors: [".errorMessage", ".error"],
    confirmationSelectors: ["[id*='thank']", "[id*='confirm']"],
  }),
  adapter({
    id: "oracle",
    name: "Oracle HCM",
    rootSelectors: ["[id*='requisition']", "form", "main"],
    nextSelectors: ["button[id*='next']", "button[title*='Next']", "button[aria-label*='Next']"],
    submitSelectors: ["button[id*='submit']", "button[title*='Submit']", "button[aria-label*='Submit']"],
    validationSelectors: [".AFErrorText", "[class*='Error']", "[aria-invalid='true']"],
    confirmationSelectors: ["[class*='confirmation']", "[id*='confirm']"],
  }),
  adapter({
    id: "successfactors",
    name: "SAP SuccessFactors",
    rootSelectors: ["[id*='career']", "form", "main"],
    nextSelectors: ["button[id*='next']", "button[title*='Next']"],
    submitSelectors: ["button[id*='submit']", "button[title*='Submit']"],
    validationSelectors: [".globalError", ".fieldError", "[aria-invalid='true']"],
    confirmationSelectors: ["[class*='confirmation']", "[id*='success']"],
  }),
  adapter({ id: "smartrecruiters", name: "SmartRecruiters", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']"] }),
  adapter({ id: "jobvite", name: "Jobvite", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']", "input[type='submit']"] }),
  adapter({ id: "bamboohr", name: "BambooHR", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']", "input[type='submit']"] }),
  adapter({ id: "workable", name: "Workable", rootSelectors: ["[data-ui='application-form']", "form", "main"], submitSelectors: ["button[type='submit']"] }),
  adapter({ id: "teamtailor", name: "Teamtailor", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']"] }),
  adapter({ id: "recruitee", name: "Recruitee", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']"] }),
  adapter({ id: "personio", name: "Personio", rootSelectors: ["form", "main"], submitSelectors: ["button[type='submit']"] }),
  adapter({ id: "generic", name: "Generic ATS", rootSelectors: ["form", "main", "body"] }),
];

export function getAtsAdapter(url = location.href, doc: Document = document): AtsAdapter {
  const platform = detectPlatform(url, doc);
  return ATS_ADAPTERS.find((a) => a.id === platform?.id) ?? ATS_ADAPTERS.find((a) => a.id === "generic")!;
}

function isJsdom(el: Element): boolean {
  return /jsdom/i.test(el.ownerDocument.defaultView?.navigator.userAgent ?? "");
}

export function isElementVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  const style = getComputedStyle(el as HTMLElement);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  if (rect.width === 0 && rect.height === 0 && !isJsdom(el)) return false;
  return true;
}

function textOf(el: Element): string {
  if (el instanceof HTMLInputElement) return el.value || el.getAttribute("aria-label") || el.getAttribute("title") || "";
  return el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "";
}

function disabled(el: Element): boolean {
  return Boolean((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true");
}

function candidateButtons(doc: Document, adapter: AtsAdapter, submit: boolean): HTMLElement[] {
  const selectors = [
    ...(submit ? adapter.submitSelectors : adapter.nextSelectors),
    "button",
    "input[type=submit]",
    "input[type=button]",
    "a[role=button]",
    "[role=button]",
  ];
  const out: HTMLElement[] = [];
  for (const sel of selectors) {
    try {
      out.push(...Array.from(doc.querySelectorAll<HTMLElement>(sel)));
    } catch {
      /* bad selector from a platform should not kill navigation */
    }
  }
  return [...new Set(out)].filter((el) => isElementVisible(el) && !disabled(el));
}

export function getValidationErrors(doc: Document = document, adapter = getAtsAdapter()): string[] {
  const out: string[] = [];
  for (const sel of adapter.validationSelectors) {
    try {
      for (const el of Array.from(doc.querySelectorAll(sel))) {
        if (!isElementVisible(el)) continue;
        const text = el.textContent?.replace(/\s+/g, " ").trim();
        if (text) out.push(text.slice(0, 160));
      }
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)].slice(0, 20);
}

export function isAtsConfirmationPage(doc: Document = document, adapter = getAtsAdapter()): boolean {
  const body = doc.body?.textContent ?? "";
  if (/\b(thank you|application submitted|successfully submitted|we received your application)\b/i.test(body)) return true;
  return adapter.confirmationSelectors.some((sel) => {
    try { return Boolean(doc.querySelector(sel)); } catch { return false; }
  });
}

export function isAtsClosedPage(doc: Document = document, adapter = getAtsAdapter()): boolean {
  const body = doc.body?.textContent ?? "";
  return adapter.closedText.some((re) => re.test(body));
}

export function findAtsActionButton(submit = false, doc: Document = document, adapter = getAtsAdapter()): { el: HTMLElement; action: AtsAction } | null {
  const errors = getValidationErrors(doc, adapter);
  if (errors.length) return null;

  const buttons = candidateButtons(doc, adapter, submit);
  const scored: { el: HTMLElement; score: number; action: AtsAction }[] = [];
  for (const btn of buttons) {
    const text = textOf(btn).replace(/\s+/g, " ").trim();
    if (/\b(cancel|close|back|previous|discard|not now|save for later)\b/i.test(text)) continue;

    const submitHit = adapter.submitText.some((re) => re.test(text));
    const nextHit = adapter.nextText.some((re) => re.test(text));
    const selectorBoost = adapter.submitSelectors.some((sel) => { try { return btn.matches(sel); } catch { return false; } }) ? 35 : 0;
    const nextBoost = adapter.nextSelectors.some((sel) => { try { return btn.matches(sel); } catch { return false; } }) ? 25 : 0;
    const primaryBoost = /primary|submit|next|continue|action/i.test(btn.className) ? 10 : 0;

    if (submit && submitHit) scored.push({ el: btn, score: 100 + selectorBoost + primaryBoost, action: "submit" });
    else if (nextHit) scored.push({ el: btn, score: 60 + nextBoost + primaryBoost, action: nextHit && /review/i.test(text) ? "review" : "next" });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best ? { el: best.el, action: best.action } : null;
}

export function clickAtsAction(submit = false, doc: Document = document, adapter = getAtsAdapter()): AtsAction | false {
  const hit = findAtsActionButton(submit, doc, adapter);
  if (!hit) return false;
  hit.el.click();
  return hit.action;
}
