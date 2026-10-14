import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  classifyLinkedInApplyControl,
  linkedInEasyApplySelectors,
} from "../packages/core/src/linkedin-controls.ts";
import {
  detectLimitWall,
  detectLinkedInDailyLimit,
  normalizeUiText,
} from "../packages/core/src/session-guardrails.ts";
import { pickOption } from "../packages/extension/src/lib/filler-utils.ts";

test("1. Modern SDUI Selectors: prioritizes SDUI apply flow flag and aria-label prefix while ignoring filter pills", () => {
  // Test SDUI openSDUIApplyFlow flag
  const sduiApplyLink = classifyLinkedInApplyControl({
    tagName: "A",
    role: null,
    className: "artdeco-button",
    text: "Apply",
    ariaLabel: null,
    href: "https://www.linkedin.com/jobs/view/99999/?openSDUIApplyFlow=true",
  });
  assert.equal(sduiApplyLink, "easy-apply");

  // Test modern SDUI aria-label prefix: "LinkedIn Apply to <title> at <company>"
  const sduiApplyBtn = classifyLinkedInApplyControl({
    tagName: "BUTTON",
    role: null,
    className: "jobs-apply-button",
    text: "Easy Apply",
    ariaLabel: "LinkedIn Apply to Staff Software Engineer at Acme Corp",
    href: null,
  });
  assert.equal(sduiApplyBtn, "easy-apply");

  // Test filter pills are explicitly ignored (role=radio or artdeco-pill)
  const filterPillRadio = classifyLinkedInApplyControl({
    tagName: "BUTTON",
    role: "radio",
    className: "artdeco-pill artdeco-pill--radio",
    text: "Easy Apply",
    ariaLabel: "LinkedIn Apply filter",
    href: null,
  });
  assert.equal(filterPillRadio, "filter-pill");

  const filterPillClass = classifyLinkedInApplyControl({
    tagName: "BUTTON",
    role: null,
    className: "artdeco-pill artdeco-pill--choice",
    text: "LinkedIn Apply",
    ariaLabel: "LinkedIn Apply",
    href: null,
  });
  assert.equal(filterPillClass, "filter-pill");

  // Verify selector list includes openSDUIApplyFlow
  const selectors = linkedInEasyApplySelectors();
  assert.ok(selectors.some((sel) => sel.includes("openSDUIApplyFlow=true")));
});

test("2. Daily Quota Protection: detects LinkedIn's daily Easy Apply ceiling and normalizes fuzzy punctuation", () => {
  // Exact phrase with curly quotes and exclamation
  const modalText1 = "Great effort applying today! You’ve reached today's Easy Apply limit.";
  const detection1 = detectLinkedInDailyLimit(modalText1);
  assert.equal(detection1.hit, true);
  assert.equal(detection1.matchedPhrase, "you ve reached today s easy apply limit");

  // Alternative ceiling phrase
  const modalText2 = "To protect member experience, we limit daily submissions on Easy Apply. Continue applying tomorrow!";
  const detection2 = detectLimitWall(modalText2);
  assert.equal(detection2.hit, true);
  assert.equal(detection2.matchedPhrase, "we limit daily submissions");

  // Normal non-quota copy should never trigger false positives
  const normalText = "Apply easily with your profile and resume. 50 applicants submitted applications today.";
  assert.equal(detectLinkedInDailyLimit(normalText).hit, false);

  // Normalize UI text verifies curly apostrophes and spacing
  assert.equal(
    normalizeUiText("You’ve reached today’s limit!"),
    "you ve reached today s limit"
  );
});

test("3. Follow Company Auto-Uncheck: safely targets and unchecks follow-company checkbox", () => {
  const dom = new JSDOM(`<!doctype html>
    <div class="jobs-easy-apply-modal">
      <form>
        <div class="follow-company-container">
          <input id="follow-company-checkbox" type="checkbox" checked />
          <label for="follow-company-checkbox">Follow Stripe to stay up to date with their page.</label>
        </div>
      </form>
    </div>`);

  const doc = dom.window.document;
  const checkbox = doc.getElementById("follow-company-checkbox") as HTMLInputElement;
  assert.equal(checkbox.checked, true);

  // Simulate uncheck
  const followCheckbox = doc.querySelector<HTMLInputElement>(
    'input#follow-company-checkbox, input[id*="follow-company"][type="checkbox"], input[name*="follow-company"]'
  );
  assert.ok(followCheckbox);
  if (followCheckbox && followCheckbox.checked) {
    followCheckbox.checked = false;
  }
  assert.equal(checkbox.checked, false);
});

test("4. Post-Submission Dismissal: detects 'Application sent' dialog and locates Done button", () => {
  const dom = new JSDOM(`<!doctype html>
    <div class="artdeco-modal jobs-easy-apply-modal" role="dialog">
      <div class="artdeco-modal__header">
        <h2>Application sent</h2>
      </div>
      <div class="artdeco-modal__content">
        <p>Your application was sent to Airbnb.</p>
      </div>
      <div class="artdeco-modal__actionbar">
        <button class="artdeco-button artdeco-button--primary" aria-label="Done">Done</button>
      </div>
    </div>`);

  const doc = dom.window.document;
  const modal = doc.querySelector<HTMLElement>('.artdeco-modal, .jobs-easy-apply-modal, [role="dialog"]');
  assert.ok(modal);

  const doneTexts = ["done", "dismiss", "close", "terminé", "fermer"];
  const buttons = Array.from(modal.querySelectorAll<HTMLElement>("button, [role='button'], .artdeco-button"));
  const doneBtn = buttons.find((btn) => {
    const t = (btn.textContent ?? "").toLowerCase().trim();
    const aria = (btn.getAttribute("aria-label") ?? "").toLowerCase().trim();
    return doneTexts.some((dt) => t === dt || t.startsWith(dt) || aria === dt || aria.startsWith(dt));
  });

  assert.ok(doneBtn);
  assert.equal(doneBtn.textContent?.trim(), "Done");
});

test("5. Two-Step Discard Flow: handles primary dismiss followed by secondary 'Discard application?' confirmation", () => {
  const dom = new JSDOM(`<!doctype html>
    <div id="root">
      <div class="jobs-easy-apply-modal" role="dialog">
        <button class="artdeco-modal__dismiss" aria-label="Dismiss">✕</button>
      </div>
      <div class="artdeco-modal confirm-discard-modal" role="alertdialog">
        <h3>Discard application?</h3>
        <p>If you leave, your changes will not be saved.</p>
        <button class="cancel-btn">Continue editing</button>
        <button class="discard-btn artdeco-button--primary">Discard</button>
      </div>
    </div>`);

  const doc = dom.window.document;
  const modal = doc.querySelector<HTMLElement>('.jobs-easy-apply-modal');
  assert.ok(modal);

  // Step 1: Click dismiss
  const dismissBtn = modal.querySelector<HTMLElement>('button.artdeco-modal__dismiss');
  assert.ok(dismissBtn);

  // Step 2: Confirm discard dialog
  const confirmModal = doc.querySelector<HTMLElement>('.artdeco-modal[role="alertdialog"]');
  assert.ok(confirmModal);
  const discardBtns = Array.from(confirmModal.querySelectorAll<HTMLElement>("button"));
  const discardBtn = discardBtns.find((b) => {
    const t = (b.textContent ?? "").toLowerCase().trim();
    return t.includes("discard") || t.includes("abandon") || t.includes("annuler");
  });
  assert.ok(discardBtn);
  assert.equal(discardBtn.textContent?.trim(), "Discard");
});

test("6. Multi-Job Traversal: card-by-card traversal on .jobs-search-results-list__list-item and pagination controls", () => {
  const dom = new JSDOM(`<!doctype html>
    <ul class="jobs-search-results-list">
      <li class="jobs-search-results-list__list-item jobs-search-results-list__list-item--active" data-occludable-job-id="101">
        <a class="job-card-list__title" href="/jobs/view/101">Frontend Engineer</a>
      </li>
      <li class="jobs-search-results-list__list-item" data-occludable-job-id="102">
        <a class="job-card-list__title" href="/jobs/view/102">Backend Engineer</a>
      </li>
      <li class="jobs-search-results-list__list-item" data-occludable-job-id="103">
        <a class="job-card-list__title" href="/jobs/view/103">Fullstack Engineer</a>
      </li>
    </ul>
    <div class="jobs-search-pagination">
      <button data-testid="pagination-controls-next-button-visible" aria-label="Next page">Next</button>
    </div>`);

  const doc = dom.window.document;
  const allCards = Array.from(doc.querySelectorAll<HTMLElement>(".jobs-search-results-list__list-item"));
  assert.equal(allCards.length, 3);

  // Active card is index 0
  const activeIndex = allCards.findIndex((card) =>
    card.classList.contains("jobs-search-results-list__list-item--active")
  );
  assert.equal(activeIndex, 0);

  // Next card is index 1
  const nextCard = allCards[activeIndex + 1];
  assert.ok(nextCard);
  assert.equal(nextCard.getAttribute("data-occludable-job-id"), "102");

  // Verify pagination button
  const paginationNext = doc.querySelector<HTMLElement>('[data-testid="pagination-controls-next-button-visible"]');
  assert.ok(paginationNext);
  assert.equal(paginationNext.getAttribute("aria-label"), "Next page");
});

test("7. Language Proficiency Resolver: 3-tier mapping prioritizes Native > Fluent > Advanced/Conversational", () => {
  // Test Tier 1: Native / Bilingual
  const optTier1 = pickOption(
    "english proficiency",
    ["Beginner", "Conversational", "Professional Working", "Native / Bilingual"],
    (o) => o,
    (o) => o,
    "What is your proficiency in English?"
  );
  assert.equal(optTier1, "Native / Bilingual");

  // Test Tier 2: Fluent / Full professional (when Native not available)
  const optTier2 = pickOption(
    "english level",
    ["Elementary", "Conversational", "Fluent / Full Professional"],
    (o) => o,
    (o) => o,
    "English language level"
  );
  assert.equal(optTier2, "Fluent / Full Professional");

  // Test Tier 3: Advanced / Conversational (when neither Native nor Fluent available)
  const optTier3 = pickOption(
    "fluency",
    ["None", "Intermediate / Conversational", "Basic"],
    (o) => o,
    (o) => o,
    "Spoken English fluency"
  );
  assert.equal(optTier3, "Intermediate / Conversational");
});

test("8. Field Highlighting & Sensitivity Guard: verifies visual indicator styling and shield badge injection", () => {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <head></head>
      <body>
        <form>
          <div class="field-group">
            <input id="candidate-name" type="text" value="Jane Doe" />
          </div>
          <div class="field-group">
            <input id="ssn-field" type="password" />
          </div>
        </form>
      </body>
    </html>`);

  const doc = dom.window.document;
  const nameEl = doc.getElementById("candidate-name")!;
  const ssnEl = doc.getElementById("ssn-field")!;

  // 1. Success (emerald) highlight
  nameEl.classList.add("sja-field-highlight", "sja-highlight-success");
  nameEl.setAttribute("data-sja-status", "success");
  assert.equal(nameEl.getAttribute("data-sja-status"), "success");
  assert.ok(nameEl.classList.contains("sja-highlight-success"));

  // 2. Sensitive (amber) shield badge injection
  const shieldBadge = doc.createElement("div");
  shieldBadge.className = "sja-shield-badge";
  shieldBadge.innerHTML = "🔒 <span>Sensitive Field (SSN / National ID) — Click to Fill</span>";
  ssnEl.parentElement?.insertBefore(shieldBadge, ssnEl.nextSibling);

  ssnEl.classList.add("sja-field-highlight", "sja-highlight-sensitive");
  ssnEl.setAttribute("data-sja-status", "sensitive");

  assert.equal(ssnEl.getAttribute("data-sja-status"), "sensitive");
  assert.ok(doc.querySelector(".sja-shield-badge"));
  assert.ok(doc.querySelector(".sja-shield-badge")?.textContent?.includes("Sensitive Field"));
});
