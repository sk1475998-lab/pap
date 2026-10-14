/** LinkedIn Easy Apply automation — click, fill, advance multi-step wizard. */

import {
  getLinkedInScanRoot,
  isLinkedInEasyApplyOpen,
  isLinkedInJobsUrl,
} from "./linkedin.js";
import { moveCursorTo, animateClick, hideCursor } from "./cursor-agent.js";
import { mimicClick } from "./mimic-user.js";
import { diagLog } from "./diagnostics.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AdvanceResult = "next" | "submit" | "done" | false;

export async function animateAndClick(el: HTMLElement): Promise<void> {
  try {
    await moveCursorTo(el);
    await animateClick();
    await mimicClick(el);
    hideCursor();
  } catch (err) {
    // Fallback: dispatch a synthetic click tagged with our mimic marker so the
    // user-interaction monitor doesn't interpret our own click as a real user
    // gesture (which would pause autopilot).
    try {
      const { MIMIC_EVENT_DETAIL } = await import("./mimic-user.js");
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, detail: MIMIC_EVENT_DETAIL, view: window }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, detail: MIMIC_EVENT_DETAIL, view: window }));
      el.dispatchEvent(new PointerEvent("click", { bubbles: true, cancelable: true, detail: MIMIC_EVENT_DETAIL, view: window, pointerType: "mimic" }));
    } catch {
      el.click();
    }
  }
}

export function isLinkedInJobDetail(url: string = location.href): boolean {
  if (!isLinkedInJobsUrl(url)) return false;
  if (isLinkedInEasyApplyOpen()) return false;

  // Direct job view URL
  if (/linkedin\.com\/jobs\/view\//i.test(url)) return true;

  // Split-view: /jobs/collections/*, /jobs/search/* with a currentJobId param
  try {
    const params = new URLSearchParams(url.includes("?") ? url.split("?")[1] : "");
    if (params.get("currentJobId")) return true;
  } catch {}

  // DOM-based detection: job detail pane visible in split-view
  if (document.querySelector(
    ".jobs-search__job-details, [class*='job-details-jobs-unified'], " +
    ".scaffold-layout__detail, .jobs-details, .jobs-details__main-content"
  )) return true;

  return false;
}

/** Stable job id from URL or active job card (split-view). */
export function getLinkedInJobId(doc: Document = document, url: string = location.href): string {
  // 1. URL path pattern
  const urlMatch = url.match(/\/jobs\/view\/(\d+)/);
  if (urlMatch) return urlMatch[1];

  // 2. Active list item card (split view)
  const active = doc.querySelector(
    '.jobs-search-results-list__list-item--active [data-occludable-job-id], ' +
    '.scaffold-layout__list-item--active [data-job-id], ' +
    '.jobs-search-results-list__list-item--active[data-occludable-job-id], ' +
    '.scaffold-layout__list-item--active[data-job-id]'
  );
  const activeId =
    active?.getAttribute("data-occludable-job-id") ?? active?.getAttribute("data-job-id");
  if (activeId) return activeId;

  // 3. Current job query parameter
  try {
    const searchParams = new URLSearchParams(url.includes("?") ? url.split("?")[1] : "");
    const currentJobId = searchParams.get("currentJobId");
    if (currentJobId) return currentJobId;
  } catch {}

  // 4. Specifically scoped job details pane container (avoiding first generic match in sidebar list)
  const detailContainer = doc.querySelector(
    '.jobs-search__job-details [data-job-id], ' +
    '.jobs-search__job-details [data-occludable-job-id], ' +
    '[class*="job-details-jobs-unified"] [data-job-id], ' +
    '[class*="job-details-jobs-unified"] [data-occludable-job-id]'
  );
  const detailId =
    detailContainer?.getAttribute("data-job-id") ?? detailContainer?.getAttribute("data-occludable-job-id");
  if (detailId) return detailId;

  // 5. Fallback generic match
  const detail = doc.querySelector("[data-job-id], [data-occludable-job-id]");
  const fromAttr =
    detail?.getAttribute("data-job-id") ?? detail?.getAttribute("data-occludable-job-id");
  if (fromAttr) return fromAttr;

  const title =
    doc
      .querySelector(
        ".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24"
      )
      ?.textContent?.trim() ?? "";
  return title ? `title:${title.slice(0, 80)}` : "";
}

/** Job already has an application — do not re-open Easy Apply. */
export function isLinkedInAlreadyApplied(doc: Document = document): boolean {
  const roots: ParentNode[] = [];
  
  // 1. Check open Easy Apply modal first
  const modal = doc.querySelector(
    '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], ' +
    '.artdeco-modal[class*="jobs-easy-apply"], .jobs-easy-apply-content, ' +
    '.jobs-easy-apply-form-container, .artdeco-modal--is-open'
  );
  if (modal) roots.push(modal);

  // 2. Check job details pane
  const detailsPane = doc.querySelector(
    ".jobs-search__job-details, .jobs-details, .jobs-details__main-content, " +
    "[class*='job-details-jobs-unified'], .scaffold-layout__detail, " +
    ".jobs-search-two-pane__details, [class*='job-details']"
  );
  if (detailsPane) roots.push(detailsPane);

  // 3. Check active/selected job card in the left list
  const activeCard = doc.querySelector(
    '.jobs-search-results-list__list-item--active, .scaffold-layout__list-item--active'
  );
  if (activeCard) roots.push(activeCard);

  // If no specific container is found, do NOT fall back to doc/body to avoid matching other sidebar list items!
  if (roots.length === 0) return false;

  for (const root of roots) {
    if (
      root.querySelector(".post-apply-timestamp, [data-test-post-apply-timestamp]") ||
      Array.from(root.querySelectorAll("button, span, strong, div")).some((el) => {
        // Only check elements that have direct text content (ignore large container divs)
        if (el.children.length > 2) return false;
        const text = (el.textContent ?? "").trim().toLowerCase();
        return text === "applied" ||
               text === "application sent" ||
               text.startsWith("applied on company") ||
               /^applied\s+\d+\s+(day|week|month|year)s?\s+ago$/i.test(text);
      })
    ) {
      return true;
    }
  }
  return false;
}

/** Success toast / confirmation after submit. Scoped to modal/toast only. */
export function isLinkedInApplicationSubmitted(doc: Document = document): boolean {
  // Explicit success markers are reliable; a generic visible toast is not.
  if (doc.querySelector("[data-test-easy-apply-success], .jobs-easy-apply-content__success")) {
    return true;
  }

  const successText = /application\s+(was\s+)?sent|successfully\s+applied|your\s+application\s+has\s+been\s+submitted|application\s+submitted/i;
  const feedback = doc.querySelectorAll(
    ".artdeco-inline-feedback--success, .artdeco-toast-item--visible"
  );
  for (const element of feedback) {
    if (successText.test(element.textContent ?? "")) return true;
  }

  // Never search body.textContent — job descriptions can contain these phrases.
  const scopedRoots = [
    doc.querySelector('.artdeco-modal__content'),
    doc.querySelector('.jobs-easy-apply-content'),
    doc.querySelector('[role="dialog"]'),
  ].filter(Boolean) as Element[];

  for (const root of scopedRoots) {
    const text = root.textContent ?? "";
    if (successText.test(text)) {
      return true;
    }
  }

  // Check for the platform's explicit post-apply state.
  const postApply = doc.querySelector('.post-apply-timeline, [data-test-post-apply]');
  if (postApply) return true;

  return false;
}

/** Wait for a scoped LinkedIn success signal after clicking Submit. */
export async function waitForLinkedInSubmissionConfirmation(timeoutMs = 8_000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (isLinkedInApplicationSubmitted()) return true;
    await sleep(250);
  }
  return false;
}

/** Dismiss any LinkedIn safety reminder dialog ("Job search safety reminder" -> "Continue applying"). */
export async function dismissSafetyReminderModal(doc: Document = document): Promise<boolean> {
  const dialogs = doc.querySelectorAll<HTMLElement>('[role="dialog"], .artdeco-modal');
  for (const modal of dialogs) {
    if (!isClickable(modal)) continue;
    const txt = (modal.textContent ?? "").toLowerCase();
    if (txt.includes("safety reminder") || txt.includes("rappel de sécurité") || txt.includes("continue applying") || txt.includes("continuer à postuler")) {
      const continueBtn = Array.from(modal.querySelectorAll<HTMLElement>("button, [role='button']")).find((b) => {
        const bt = (b.textContent ?? "").toLowerCase().trim();
        return bt.includes("continue applying") || bt.includes("continuer à postuler") || bt.includes("continue") || bt.includes("continuer") || bt.includes("understand");
      });
      if (continueBtn && isClickable(continueBtn)) {
        await animateAndClick(continueBtn);
        await sleep(350);
        return true;
      }
    }
  }
  return false;
}

/** Check if candidate has reached platform daily quota limit (LinkedIn, Naukri, Internshala, Indeed). */
export function isPlatformDailyLimitReached(doc: Document = document): boolean {
  const limitPhrases = [
    // LinkedIn
    "reached today's easy apply limit",
    "reached today's limit",
    "great effort applying today",
    "we limit daily submissions",
    "continue applying tomorrow",
    "save this job and continue applying tomorrow",
    "exceeded the daily application limit",
    "daily easy apply limit",
    "limit daily submissions",
    // Naukri / Shine / Foundit
    "applied to maximum jobs allowed for today",
    "reached your daily application quota",
    "daily apply limit reached",
    "maximum applications reached for today",
    "exhausted your daily quota",
    "daily application limit has been reached",
    // Internshala
    "daily application limit reached",
    "you can apply to maximum",
    "application limit exceeded for today",
    "reached your limit of applications today",
    // Indeed & Generic ATS
    "you've reached the application limit for today",
    "daily application limit",
    "daily quota exceeded",
    "maximum daily applications",
  ];

  // 1. Check scoped feedback, toast, or modal elements across ATS / job platforms
  const scopedElements = doc.querySelectorAll<HTMLElement>(
    '.artdeco-inline-feedback, .artdeco-toast-item, .artdeco-modal__content, [role="alert"], [role="dialog"], .toast, .alert, .modal-content, .drawer'
  );
  for (const el of scopedElements) {
    const text = (el.textContent ?? "").toLowerCase();
    for (const phrase of limitPhrases) {
      if (text.includes(phrase)) return true;
    }
  }

  // 2. Check document body if modal failed to appear
  const bodyText = (doc.body?.textContent ?? "").toLowerCase();
  for (const phrase of limitPhrases) {
    if (bodyText.includes(phrase)) return true;
  }

  return false;
}

/** Check if candidate has reached LinkedIn's daily Easy Apply quota limit (~50-100 applies/day). */
export function isLinkedInDailyLimitReached(doc: Document = document): boolean {
  return isPlatformDailyLimitReached(doc);
}

/** Click the Easy Apply button on job detail / split-view pane. */
export async function clickEasyApplyButton(doc: Document = document): Promise<boolean> {
  if (isLinkedInAlreadyApplied(doc)) return false;
  if (isLinkedInEasyApplyOpen(doc)) return true;

  // Auto-dismiss any safety reminder modal before attempting click
  await dismissSafetyReminderModal(doc);

  const preferredDetailPane = doc.querySelector(
    ".jobs-search__job-details, [class*='job-details-jobs-unified'], .scaffold-layout__detail, .jobs-details, [class*='job-details'], .job-view-layout"
  );
  const roots: ParentNode[] = preferredDetailPane
    ? [preferredDetailPane]
    : [doc.querySelector("main"), doc.body].filter(Boolean) as ParentNode[];

  // Build a candidate list of visible top-card action buttons.
  const candidates: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const root of roots) {
    const found = Array.from(root.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], .jobs-apply-button, [class*="apply-button"], ' +
      '[data-control-name*="inapply"], [data-control-name*="apply"], ' +
      'button[aria-label*="Easy Apply"], a[aria-label*="Easy Apply"], ' +
      'button[aria-label*="Apply to"], a[aria-label*="Apply to"], ' +
      'button[aria-label*="LinkedIn Apply"], a[aria-label*="LinkedIn Apply"], ' +
      'a[href*="openSDUIApplyFlow=true"]'
    ));
    for (const el of found) {
      if (!seen.has(el)) { seen.add(el); candidates.push(el); }
    }
  }

  // Score candidates: prefer top-card primary Easy Apply over sidebar "Apply" links.
  interface Scored { el: HTMLElement; score: number; }
  const scored: Scored[] = [];
  for (const el of candidates) {
    if (!isClickable(el)) continue;
    if (el.hasAttribute("disabled") || (el as any).disabled) continue;
    if (isDisabledElement(el)) continue;

    // Exclude header navigation, search filter bars, job search filters, or left search results list
    if (el.closest(".search-reusables__filter-list, .jobs-search-box, .global-nav, header, nav, [data-test-search-filter], .search-filters-bar, .jobs-search-results-list, .scaffold-layout__list")) {
      continue;
    }

    // Exclude search-filter radio pills
    if (el.getAttribute("role") === "radio" || el.classList.contains("artdeco-pill")) continue;

    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const ariaLabel = (el.getAttribute("aria-label") ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const dataCtrl = el.getAttribute("data-control-name") ?? "";
    const href = el.getAttribute("href") ?? "";

    // Skip "save"/"follow"/"not interested" etc.
    if (/^(save|follow|not interested|share)$/i.test(text) && !/easy apply/i.test(text)) continue;
    if (ariaLabel.includes("save") && !ariaLabel.includes("easy apply") && !ariaLabel.includes("apply to")) continue;

    let score = 0;
    // Modern LinkedIn signals: "linkedin apply to <title> at <company>" or "linkedin apply to this job"
    if (ariaLabel.startsWith("linkedin apply to") || ariaLabel.startsWith("apply to")) score += 120;
    if (href.includes("openSDUIApplyFlow=true")) score += 115;

    // Easy Apply exact / prefix match
    if (text === "easy apply") score += 100;
    else if (text.startsWith("easy apply")) score += 90;
    else if (text === "continue applying") score += 95;
    else if (text.includes("easy apply")) score += 60;
    if (ariaLabel.includes("easy apply")) score += 70;
    if (ariaLabel.includes("continue applying")) score += 70;
    if (dataCtrl.includes("inapply")) score += 80;
    if (dataCtrl.includes("apply")) score += 30;

    // LinkedIn applies primary-button styling to Easy Apply
    if (el.classList.contains("artdeco-button--primary")) score += 25;
    if (el.classList.contains("jobs-apply-button")) score += 40;
    if (String(el.className).includes("apply-button")) score += 20;

    // Top-card placement vs deep in card
    if (el.closest(".jobs-unified-top-card, [class*='top-card'], [class*='job-details-jobs-unified-top-card']")) {
      score += 20;
    }
    // Penalize "Apply on company website" / External apply — we handle that separately
    if (/company website|external|website/i.test(text) || /external|website/i.test(ariaLabel)) {
      score -= 500;
    }

    if (score > 0) scored.push({ el, score });
  }

  if (scored.length === 0) return false;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!.el;

  try {
    best.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  } catch {}
  await sleep(150);
  await animateAndClick(best);
  return true;
}

function isClickable(el: HTMLElement): boolean {
  if (!el || typeof el.getBoundingClientRect !== "function") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function isDisabledElement(el: HTMLElement): boolean {
  return el.hasAttribute("disabled") ||
         (el as any).disabled === true ||
         el.getAttribute("aria-disabled") === "true" ||
         el.classList.contains("disabled") ||
         el.classList.contains("artdeco-button--disabled");
}

/** Hash current wizard step so we re-fill when step changes. */
export function getEasyApplyStepHash(): string {
  const root = getLinkedInScanRoot();
  const heading =
    root.querySelector("h2, h3, .jobs-easy-apply-form-section__title")?.textContent?.trim() ?? "";
  const inputs = Array.from(root.querySelectorAll("input, textarea, select"))
    .map((el) => `${el.tagName}:${el.getAttribute("name") ?? el.id}:${labelForEl(el)}`)
    .join("|");
  return `${heading}::${inputs.slice(0, 500)}`;
}

function labelForEl(el: Element): string {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${id}"]`);
    if (lab?.textContent) return lab.textContent.trim().slice(0, 40);
  }
  return (el.getAttribute("aria-label") ?? el.getAttribute("name") ?? "").slice(0, 40);
}

/** Click Next / Continue / Review (optionally Submit). */
export async function clickNextButton(allowSubmit = false): Promise<AdvanceResult> {
  const root = getLinkedInScanRoot();

  // Check for validation errors before advancing — only error messages that are
  // VISIBLE (non-empty text + non-zero rect) block advancement.
  const errorEls = Array.from(root.querySelectorAll<HTMLElement>(
    '.artdeco-inline-feedback--error, .jobs-easy-apply-form-element__error, ' +
    '[aria-invalid="true"] ~ .artdeco-inline-feedback, ' +
    '.artdeco-inline-feedback--error .artdeco-inline-feedback__message'
  ));
  for (const err of errorEls) {
    if (!isClickable(err)) continue;
    const t = (err.textContent ?? "").trim();
    if (!t) continue;
    // Some LinkedIn feedback messages are informational, not blocking.
    if (/please|required|select|enter|invalid|valid|choose|complete/i.test(t)) {
      return false;
    }
  }

  const candidates = Array.from(root.querySelectorAll<HTMLElement>(
    'button, [role="button"], input[type="submit"], input[type="button"]'
  )).filter((b) => !isDisabledElement(b) && isClickable(b));

  // Score candidates: prefer the footer-area primary action button, avoid dismiss/back.
  interface Scored { el: HTMLElement; label: string; kind: "submit" | "next" | "dismiss" | "none"; }
  const scored: Scored[] = candidates.map((btn) => {
    const rawText = (btn.textContent ?? "").replace(/[\u2192\u2190\u2191\u2193\u25B6\u25BA]/g, "").trim();
    const ariaLabel = (btn.getAttribute("aria-label") ?? "").trim();
    const label = `${ariaLabel} ${rawText}`.toLowerCase().replace(/\s+/g, " ").trim();

    if (/dismiss|close|discard|cancel|not now|^go back$|^back$|previous|save for later/.test(label)) {
      return { el: btn, label, kind: "dismiss" };
    }
    if (/submit\b|send application|submit application/.test(label)) {
      return { el: btn, label, kind: "submit" };
    }
    if (
      /\bnext\b/.test(label) ||
      /\bcontinue\b/.test(label) ||
      /\breview\b/.test(label) ||
      /save and continue|save & continue|proceed/.test(label)
    ) {
      return { el: btn, label, kind: "next" };
    }
    return { el: btn, label, kind: "none" };
  });

  // 1. Submit (if allowed)
  if (allowSubmit) {
    const submit = scored.find((s) => s.kind === "submit");
    if (submit) {
      await uncheckFollowCompanyIfNeeded();
      await animateAndClick(submit.el);
      return "submit";
    }
  }

  // 2. Next/Continue
  const next = scored.find((s) => s.kind === "next");
  if (next) {
    await animateAndClick(next.el);
    return "next";
  }

  // 3. Fallback: primary action button in footer
  const primaryElements = Array.from(root.querySelectorAll<HTMLElement>(
    ".artdeco-button--primary, " +
    ".jobs-easy-apply-footer__primary-action button, " +
    "footer .artdeco-button--primary, " +
    "[class*='footer'] .artdeco-button--primary"
  )).filter((el) => !isDisabledElement(el) && isClickable(el));

  for (const primary of primaryElements) {
    const t = ((primary.textContent ?? "").toLowerCase().trim());
    const aria = (primary.getAttribute("aria-label") ?? "").toLowerCase();
    const combined = `${aria} ${t}`;
    if (/dismiss|close|cancel|back/.test(combined)) continue;
    if (/submit|send/.test(combined)) {
      if (!allowSubmit) return false;
      await uncheckFollowCompanyIfNeeded();
      await animateAndClick(primary);
      return "submit";
    }
    if (/next|continue|review|proceed/.test(combined) || t.length < 24) {
      // If the only primary button text doesn't contain a dismiss word, assume it advances.
      await animateAndClick(primary);
      return "next";
    }
  }

  if (!isLinkedInEasyApplyOpen()) return "done";
  return false;
}

/** Select the most recently uploaded resume card (or first if timestamps unavailable). */
export async function selectLinkedInResumeIfNeeded(): Promise<boolean> {
  const root = getLinkedInScanRoot();
  
  // Locate the resume upload or selection block specifically
  let resumeContainer = root.querySelector(
    '.jobs-document-upload-redesign, .jobs-document-upload__container, .jobs-resume-list, ' +
    '.jobs-resume-picker, [class*="resume-picker"], [class*="document-upload"], [class*="resume-list"], ' +
    '[data-test-document-upload], [data-test-resume-picker], fieldset[class*="resume"], .jobs-document-card'
  );
  if (!resumeContainer) {
    const resumeRadio = root.querySelector<HTMLInputElement>(
      'input[type="radio"][name*="resume"], input[type="radio"][id*="resume"], input[type="radio"][value*=".pdf"], ' +
      'input[type="radio"][id*="document-card"], .jobs-document-card input[type="radio"]'
    );
    if (resumeRadio) {
      resumeContainer = resumeRadio.closest("fieldset, .artdeco-form-item, [role='radiogroup'], form, div") || (root as Element);
    }
  }
  if (!resumeContainer) {
    return false;
  }

  void diagLog("autopilot", "linkedin-resume-container-matched", { message: "LinkedIn resume upload/selection container detected" });

  // Restrict checking checked state to inside the resume container only!
  const selected = resumeContainer.querySelector(
    '[aria-checked="true"], input[type=radio]:checked, [aria-selected="true"], [class*="-selected"], .selected, .checked'
  );
  if (selected) {
    void diagLog("autopilot", "linkedin-resume-selected-status", { message: "A resume card is already selected on the LinkedIn panel" });
    return true;
  }

  // Get all resume cards
  const cards = Array.from(resumeContainer.querySelectorAll<HTMLElement>(
    '[data-test="resume-card"], .jobs-document-upload__container, .jobs-resume-list__resume-item, ' +
    '.jobs-document-card, [class*="document-card"], [class*="resume-card"], .jobs-resume-picker__resume-list-item, ' +
    'li:has(input[type="radio"]), div:has(> input[type="radio"])'
  ));

  void diagLog("autopilot", "linkedin-resume-cards-scanned", { message: `Found ${cards.length} candidate resume card(s) on LinkedIn panel` });

  if (cards.length === 0) {
    // Fallback: raw radio buttons
    const radio = resumeContainer.querySelector<HTMLInputElement>('input[type=radio]') ||
      root.querySelector<HTMLInputElement>('input[type=radio][name*="resume"], input[type=radio][id*="resume"]');
    if (radio) {
      void diagLog("autopilot", "linkedin-resume-radio-fallback", { message: "No structured cards found. Attempting fallback click on raw radio input." });
      radio.checked = true;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      await animateAndClick(radio);
      return true;
    }
    return false;
  }

  // Prefer the most recently uploaded: look for timestamp text in each card
  let bestCard = cards[0]!;
  let bestTime = 0;
  const cardsMetadata: Record<string, string>[] = [];

  for (const [idx, card] of cards.entries()) {
    const labelText = card.querySelector('.jobs-document-upload__title, [class*="title"], label')?.textContent?.trim() ?? `Card #${idx}`;
    const timeText = card.querySelector('.jobs-document-upload__date, [class*="date"], time')?.textContent ?? "";
    const parsed = Date.parse(timeText);
    cardsMetadata.push({ label: labelText, dateText: timeText, parsedTimestamp: String(parsed) });

    if (!isNaN(parsed) && parsed > bestTime) {
      bestTime = parsed;
      bestCard = card;
    }
  }

  void diagLog("autopilot", "linkedin-resume-timestamp-evaluation", {
    message: `Evaluating resume dates. Best timestamp found: ${bestTime > 0 ? new Date(bestTime).toLocaleString() : "None"}`,
    data: { candidateCards: cardsMetadata }
  });

  // Click the best card (both the radio input and card wrapper/label)
  const radio = bestCard.querySelector<HTMLInputElement>('input[type=radio]') ||
    resumeContainer.querySelector<HTMLInputElement>('input[type=radio]');
  if (radio) {
    try {
      void diagLog("autopilot", "linkedin-resume-radio-click", { message: `Clicking radio input for selected card` });
      radio.checked = true;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      await animateAndClick(radio);
    } catch (err: any) {
      void diagLog("autopilot", "linkedin-resume-click-error", { level: "info", message: `Radio click failed: ${err.message}` });
    }
  }
  const label = bestCard.querySelector<HTMLLabelElement>('label') || bestCard.closest("label");
  if (label) {
    try {
      void diagLog("autopilot", "linkedin-resume-label-click", { message: `Clicking label for selected card` });
      await animateAndClick(label);
    } catch (err: any) {
      void diagLog("autopilot", "linkedin-resume-click-error", { level: "info", message: `Label click failed: ${err.message}` });
    }
  }
  try {
    void diagLog("autopilot", "linkedin-resume-card-click-fallback", { message: `Clicking card container wrapper element as fallback` });
    await animateAndClick(bestCard);
  } catch (err: any) {
    void diagLog("autopilot", "linkedin-resume-click-error", { level: "info", message: `Card container fallback click failed: ${err.message}` });
  }
  return true;
}

export async function waitForEasyApplyModal(timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isLinkedInEasyApplyOpen()) return true;
    await sleep(250);
  }
  return false;
}

export function isLinkedInSubmitButtonPresent(): boolean {
  if (!isLinkedInEasyApplyOpen()) return false;
  const root = getLinkedInScanRoot();
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(
    'button, [role="button"], input[type="submit"], input[type="button"]'
  )).filter(
    (b) => !isDisabledElement(b) && isClickable(b)
  );
  for (const btn of candidates) {
    const rawText = (btn.textContent ?? "").replace(/[\u2192\u2190\u2191\u2193\u25B6\u25BA]/g, "").trim();
    const ariaLabel = (btn.getAttribute("aria-label") ?? "").trim();
    const label = `${ariaLabel} ${rawText}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (/submit|send application/.test(label)) {
      return true;
    }
  }
  const primaryElements = Array.from(root.querySelectorAll<HTMLElement>(
    ".artdeco-button--primary, " +
    ".jobs-easy-apply-footer__primary-action button, " +
    "footer .artdeco-button--primary"
  )).filter((el) => !isDisabledElement(el) && isClickable(el));

  if (primaryElements.length > 0) {
    const primary = primaryElements[0];
    const t = (primary.textContent ?? "").toLowerCase().trim();
    if (/submit|send/.test(t)) {
      return true;
    }
  }
  return false;
}

/** Uncheck LinkedIn's "Follow company to stay up to date" checkbox on review step. */
export async function uncheckFollowCompanyIfNeeded(): Promise<boolean> {
  const root = getLinkedInScanRoot();
  const followCheckbox = root.querySelector<HTMLInputElement>(
    'input#follow-company-checkbox, input[id*="follow-company"][type="checkbox"], input[name*="follow-company"]'
  );
  if (followCheckbox && followCheckbox.checked) {
    const label = root.querySelector<HTMLElement>(`label[for="${CSS.escape(followCheckbox.id)}"]`);
    if (label && isClickable(label)) {
      await animateAndClick(label);
      void diagLog("autopilot", "linkedin-unfollow-company", { message: "Unfollowed company checkbox unchecked via label" });
      return true;
    } else {
      followCheckbox.click();
      void diagLog("autopilot", "linkedin-unfollow-company", { message: "Unfollowed company checkbox unchecked directly" });
      return true;
    }
  }
  return false;
}

/** Close/Dismiss LinkedIn's post-submission "Application sent" dialog by clicking Done. */
export async function dismissLinkedInPostSubmissionModal(doc: Document = document, maxAttempts = 6): Promise<boolean> {
  const doneTexts = ["done", "dismiss", "close", "terminé", "fermer"];
  for (let i = 0; i < maxAttempts; i++) {
    const modal = doc.querySelector<HTMLElement>(
      '.artdeco-modal, .jobs-easy-apply-modal, [role="dialog"]'
    );
    if (!modal || !isClickable(modal)) return true; // Modal already closed

    // Look for Done button by text or aria-label
    const buttons = Array.from(modal.querySelectorAll<HTMLElement>("button, [role='button'], .artdeco-button"));
    const doneBtn = buttons.find((btn) => {
      if (isDisabledElement(btn) || !isClickable(btn)) return false;
      const t = (btn.textContent ?? "").toLowerCase().trim();
      const aria = (btn.getAttribute("aria-label") ?? "").toLowerCase().trim();
      return doneTexts.some((dt) => t === dt || t.startsWith(dt) || aria === dt || aria.startsWith(dt));
    });

    if (doneBtn) {
      await animateAndClick(doneBtn);
      await sleep(350);
      void diagLog("autopilot", "linkedin-post-submission-done-clicked", { message: "Clicked Done on post-submission dialog" });
      return true;
    }

    // Fallback: dismiss/close button (X icon)
    const dismissBtn = modal.querySelector<HTMLElement>(
      'button.artdeco-modal__dismiss, button[aria-label*="Dismiss"], button[aria-label*="Close"]'
    );
    if (dismissBtn && isClickable(dismissBtn)) {
      await animateAndClick(dismissBtn);
      await sleep(350);
      void diagLog("autopilot", "linkedin-post-submission-dismiss-clicked", { message: "Clicked Dismiss on post-submission dialog" });
      return true;
    }

    await sleep(250);
  }
  return false;
}

/** Safe two-step discard of LinkedIn Easy Apply application if stuck or cancelled. */
export async function discardLinkedInApplication(doc: Document = document): Promise<boolean> {
  const modal = doc.querySelector<HTMLElement>('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]');
  if (!modal || !isClickable(modal)) return true;

  // 1. Click X (dismiss) button
  const closeBtn = modal.querySelector<HTMLElement>(
    'button.artdeco-modal__dismiss, button[aria-label*="Dismiss"], button[aria-label*="Close"]'
  );
  if (closeBtn && isClickable(closeBtn)) {
    await animateAndClick(closeBtn);
    await sleep(400);
  }

  // 2. Click Discard confirmation button if Artdeco confirmation modal appeared
  const confirmModal = doc.querySelector<HTMLElement>(
    '.artdeco-modal, [role="alertdialog"], [role="dialog"]'
  );
  if (confirmModal && isClickable(confirmModal)) {
    const discardBtns = Array.from(confirmModal.querySelectorAll<HTMLElement>("button, [role='button']"));
    const discardBtn = discardBtns.find((b) => {
      const t = (b.textContent ?? "").toLowerCase().trim();
      return t.includes("discard") || t.includes("abandon") || t.includes("annuler");
    });
    if (discardBtn && isClickable(discardBtn)) {
      await animateAndClick(discardBtn);
      await sleep(400);
      void diagLog("autopilot", "linkedin-discard-confirmed", { message: "Confirmed discard in secondary dialog" });
    }
  }

  return !isLinkedInEasyApplyOpen();
}

/**
 * Automatically find and navigate to the next job card in the search results list,
 * or advance to the next search results page if all cards on the current page have been seen.
 */
export async function advanceToNextLinkedInJobCard(doc: Document = document): Promise<boolean> {
  // 1. Locate all job card items in the search results list
  const cardSelectors = [
    ".jobs-search-results-list__list-item",
    ".scaffold-layout__list-item",
    "li[data-occludable-job-id]",
    ".jobs-job-board-list__item",
  ];
  const allCards = Array.from(doc.querySelectorAll<HTMLElement>(cardSelectors.join(", ")));
  if (allCards.length === 0) return false;

  // 2. Identify the currently active / selected card
  const activeCardIndex = allCards.findIndex((card) =>
    card.classList.contains("jobs-search-results-list__list-item--active") ||
    card.classList.contains("scaffold-layout__list-item--active") ||
    card.querySelector(".jobs-search-results-list__list-item--active, .scaffold-layout__list-item--active") !== null
  );

  let targetCard: HTMLElement | null = null;
  if (activeCardIndex >= 0 && activeCardIndex < allCards.length - 1) {
    targetCard = allCards[activeCardIndex + 1];
  } else if (activeCardIndex === -1 && allCards.length > 0) {
    targetCard = allCards[0];
  }

  if (targetCard) {
    targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(250);
    const clickTarget =
      targetCard.querySelector<HTMLElement>(
        "a.job-card-list__title, a.job-card-container__link, [data-control-id], a[href*='/jobs/view/'], button"
      ) ?? targetCard;
    if (clickTarget && isClickable(clickTarget)) {
      await animateAndClick(clickTarget);
      void diagLog("autopilot", "linkedin-next-card-clicked", {
        message: `Advanced to next job card (index ${activeCardIndex + 1} of ${allCards.length})`,
      });
      return true;
    }
  }

  // 3. If reached the end of the current page, attempt pagination next button
  const nextBtnSelectors = [
    '[data-testid="pagination-controls-next-button-visible"]',
    '[data-testid^="pagination-controls-next-button"]:not([data-testid$="hidden"])',
    'button[aria-label="View next page"]',
    'button[aria-label="Next page"]',
    '.artdeco-pagination__button--next',
    '.jobs-search-pagination button[aria-label*="next"]',
  ];
  for (const sel of nextBtnSelectors) {
    const nextBtn = doc.querySelector<HTMLElement>(sel);
    if (nextBtn && isClickable(nextBtn) && !nextBtn.hasAttribute("disabled") && nextBtn.getAttribute("aria-disabled") !== "true") {
      nextBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(250);
      await animateAndClick(nextBtn);
      void diagLog("autopilot", "linkedin-next-page-clicked", { message: "Advanced to next LinkedIn search results page" });
      return true;
    }
  }

  return false;
}

export { sleep };
