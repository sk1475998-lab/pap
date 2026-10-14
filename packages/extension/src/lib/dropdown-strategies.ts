/**
 * Dropdown Strategies — pluggable handlers for every dropdown variant.
 *
 * Each strategy implements detect → getOptions → selectOption so the
 * autofill engine can fill React Select, MUI Autocomplete, Ant Design,
 * Workday web components, virtualized lists, and native <select> elements.
 */

import type { DetectedField } from "@superjob/core";
import { queryNode } from "./ats-adapter.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Strategy interface                                                  */
/* ------------------------------------------------------------------ */

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownStrategy {
  readonly id: string;
  readonly name: string;
  /** True if this strategy can handle the given element. */
  detect(el: Element): boolean;
  /** Scrape all available options from the open dropdown. */
  getOptions(el: Element): Promise<DropdownOption[]>;
  /** Select the best-matching option for the given value. */
  selectOption(el: Element, value: string): Promise<boolean>;
  /** True if the dropdown supports multiple selections (tags). */
  isMultiSelect(el: Element): boolean;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase().trim();
  if (h === n) return true;
  if (h.includes(n) || n.includes(h)) return true;
  // Levenshtein for short strings (country/state names with typos)
  if (n.length > 2 && h.length > 2 && n.length < 30 && h.length < 30) {
    return levenshtein(n, h) <= Math.max(1, Math.floor(Math.min(n.length, h.length) * 0.25));
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m]![n]!;
}

function matchMonthOrYear(value: string, options: DropdownOption[]): DropdownOption | undefined {
  const v = value.toLowerCase().trim();
  const num = parseInt(v.replace(/[^0-9]/g, ""), 10);

  const months = [
    ["jan", "january", "1", "01"],
    ["feb", "february", "2", "02"],
    ["mar", "march", "3", "03"],
    ["apr", "april", "4", "04"],
    ["may", "may", "5", "05"],
    ["jun", "june", "6", "06"],
    ["jul", "july", "7", "07"],
    ["aug", "august", "8", "08"],
    ["sep", "september", "9", "09"],
    ["oct", "october", "10", "10"],
    ["nov", "november", "11", "11"],
    ["dec", "december", "12", "12"]
  ];

  let monthIndex = -1;
  if (!isNaN(num) && num >= 1 && num <= 12) {
    monthIndex = num - 1;
  } else {
    monthIndex = months.findIndex(m => m.includes(v));
  }

  if (monthIndex >= 0) {
    const monthPatterns = months[monthIndex]!;
    for (const opt of options) {
      const ol = opt.label.toLowerCase().trim();
      const ov = opt.value.toLowerCase().trim();
      if (monthPatterns.some(p => ol === p || ov === p || ol.startsWith(p))) {
        return opt;
      }
    }
  }

  if (!isNaN(num) && num >= 1900 && num <= 2100) {
    const yearStr = String(num);
    const shortYearStr = yearStr.slice(-2);
    for (const opt of options) {
      const ol = opt.label.toLowerCase().trim();
      const ov = opt.value.toLowerCase().trim();
      if (ol.includes(yearStr) || ov.includes(yearStr) || ol === shortYearStr || ov === shortYearStr) {
        return opt;
      }
    }
  }

  return undefined;
}

function bestMatch(value: string, options: DropdownOption[]): DropdownOption | undefined {
  const v = value.toLowerCase().trim();
  // Exact value match
  let match = options.find((o) => o.value.toLowerCase() === v);
  if (match) return match;
  // Exact label match
  match = options.find((o) => o.label.toLowerCase() === v);
  if (match) return match;

  // Month/Year specialized matching
  match = matchMonthOrYear(value, options);
  if (match) return match;

  // Synonym matching (common ATS dropdown synonyms)
  match = synonymMatch(v, options);
  if (match) return match;

  // Abbreviation matching (US, UK, IN, etc.)
  match = abbreviationMatch(v, options);
  if (match) return match;

  // Split-comma list match (for matching a skill from profile skills list against predefined dropdown options)
  if (v.includes(",")) {
    const parts = v.split(",").map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const partMatch = options.find((o) => o.value.toLowerCase() === part || o.label.toLowerCase() === part);
      if (partMatch) return partMatch;
    }
    // Fuzzy match on individual parts
    for (const part of parts) {
      const partMatch = options.find((o) => fuzzyMatch(part, o.label) || fuzzyMatch(part, o.value));
      if (partMatch) return partMatch;
    }
  }

  // Fuzzy label match
  match = options.find((o) => fuzzyMatch(v, o.label));
  if (match) return match;
  // Fuzzy value match
  match = options.find((o) => fuzzyMatch(v, o.value));
  if (match) return match;
  // Numeric comparison (e.g. "3" matches "3 years")
  const num = parseFloat(v.replace(/[^0-9.]/g, ""));
  if (!isNaN(num)) {
    match = options.find((o) => {
      const n = parseFloat(o.label.replace(/[^0-9.]/g, ""));
      return !isNaN(n) && n === num;
    });
    if (match) return match;
  }
  // Yes/No normalization
  if (/^(y|yes|true|1|authorized|eligible)$/i.test(v)) {
    match = options.find((o) => /yes|true|1|authorized/i.test(o.label));
    if (match) return match;
  }
  if (/^(n|no|false|0|unauthorized|ineligible)$/i.test(v)) {
    match = options.find((o) => /^no$|false|0|not\b/i.test(o.label));
    if (match) return match;
  }

  // Language proficiency smart resolver (adapted from AutoApplyMax)
  const isLanguageQ = /proficiency|fluency|level\s+of\s+(english|french|spanish|german|hindi|language)|language\s+level|niveau\s+d['’]anglais|nivel\s+de\s+ingl[ée]s/i.test(v) ||
    options.some(o => /\b(native|fluent|bilingual|mothertongue)\b/i.test(o.label));
  if (isLanguageQ && options.length >= 2) {
    const nativeOpt = options.find(o => /\b(native|bilingual|mothertongue|mother\s+tongue|langue\s+maternelle|nativo)\b/i.test(o.label));
    if (nativeOpt) return nativeOpt;
    const fluentOpt = options.find(o => /\b(fluent|full\s+professional|professional\s+working|courant|avanc[eé]|fluido)\b/i.test(o.label));
    if (fluentOpt) return fluentOpt;
    const advancedOpt = options.find(o => /\b(professional|advanced|conversational|intermediate|working\s+knowledge)\b/i.test(o.label));
    if (advancedOpt) return advancedOpt;
  }

  // Fallback: pick the first option with a non-empty value & label (excluding place-holders)
  const fallback = options.find((o) => {
    const val = o.value.trim();
    const lbl = o.label.toLowerCase().trim();
    return val !== "" && !/^(select|month|year|choose|default|\-+|please\s*select)$/i.test(lbl);
  });
  if (fallback) return fallback;

  return undefined;
}

/** Synonym matching for common ATS dropdown values */
const SYNONYMS: Record<string, string[]> = {
  "united states": ["usa", "us", "u.s.", "u.s.a.", "united states of america", "america"],
  "united kingdom": ["uk", "u.k.", "britain", "great britain", "england"],
  "india": ["in", "bharat"],
  "remote": ["work from home", "wfh", "anywhere", "distributed"],
  "hybrid": ["mixed", "flexible", "partially remote"],
  "onsite": ["in office", "in-person", "on-site", "on premises"],
  "full-time": ["full time", "fulltime", "ft"],
  "part-time": ["part time", "parttime", "pt"],
  "contract": ["contractor", "temporary", "temp"],
  "internship": ["intern", "trainee"],
  "yes": ["y", "true", "1", "authorized", "eligible"],
  "no": ["n", "false", "0", "not authorized", "ineligible"],
};

function synonymMatch(value: string, options: DropdownOption[]): DropdownOption | undefined {
  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    const allForms = [canonical, ...synonyms];
    if (allForms.some(f => f === value || f.includes(value) || value.includes(f))) {
      // Found the synonym group — now find the best option from the dropdown
      for (const form of allForms) {
        const match = options.find(o => {
          const l = o.label.toLowerCase().trim();
          const v = o.value.toLowerCase().trim();
          return l === form || v === form || l.includes(form) || v.includes(form);
        });
        if (match) return match;
      }
    }
  }
  return undefined;
}

/** Abbreviation matching for country/state codes */
function abbreviationMatch(value: string, options: DropdownOption[]): DropdownOption | undefined {
  const abbreviations: Record<string, string> = {
    "us": "united states", "usa": "united states", "uk": "united kingdom",
    "in": "india", "au": "australia", "de": "germany",
    "fr": "france", "jp": "japan", "sg": "singapore", "ae": "uae",
    "ny": "new york", "tx": "texas", "fl": "florida",
    "wa": "washington", "ma": "massachusetts", "il": "illinois",
  };
  const expanded = abbreviations[value.toLowerCase()];
  if (expanded) {
    return options.find(o => {
      const l = o.label.toLowerCase().trim();
      return l === expanded || l.includes(expanded) || l === value;
    });
  }
  return undefined;
}

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el as HTMLElement);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
}

function dispatchFullEventSequence(el: HTMLElement, value?: string) {
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("focusin", { bubbles: true }));
  if (value !== undefined) {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  el.dispatchEvent(new Event("focusout", { bubbles: true }));
}

function clickElementWithMouseEvents(el: HTMLElement) {
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function setInputValueRobust(el: HTMLInputElement, value: string) {
  el.focus();
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("focusin", { bubbles: true }));

  // Simulate keydown event for typing start
  el.dispatchEvent(new KeyboardEvent("keydown", { key: value[0] || "a", bubbles: true, cancelable: true }));

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  // Simulate input event
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));

  // Simulate keyup event for typing end
  el.dispatchEvent(new KeyboardEvent("keyup", { key: value.slice(-1) || "a", bubbles: true, cancelable: true }));

  // Dispatch change and blur
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  el.dispatchEvent(new Event("focusout", { bubbles: true }));
}

async function waitForElement(
  selector: string,
  root: ParentNode = document,
  timeoutMs = 2000
): Promise<Element | null> {
  const existing = root.querySelector(selector);
  if (existing) return existing;
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(root === document ? document.body : (root as Element), {
      childList: true,
      subtree: true,
    });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

async function clickAndWaitForDropdown(
  triggerEl: HTMLElement,
  menuSelectors: string[],
  root: ParentNode = document,
  waitMs = 600
): Promise<Element | null> {
  triggerEl.focus();
  triggerEl.click();
  await sleep(150);
  for (const sel of menuSelectors) {
    const menu = root.querySelector(sel);
    if (menu && isVisible(menu)) return menu;
  }
  // Wait for menu to appear
  await sleep(waitMs);
  for (const sel of menuSelectors) {
    const menu = root.querySelector(sel);
    if (menu && isVisible(menu)) return menu;
  }
  return null;
}

function scrapeOptionsFromMenu(menu: Element): DropdownOption[] {
  const items = menu.querySelectorAll("[role=option], li, [class*='option'], [class*='item']");
  const options: DropdownOption[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const label = item.textContent?.trim() ?? "";
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const value = item.getAttribute("data-value") ?? item.getAttribute("value") ?? label;
    options.push({ value, label });
  }
  return options;
}

/* ------------------------------------------------------------------ */
/* 1. React Select Strategy                                            */
/* ------------------------------------------------------------------ */

export const ReactSelectStrategy: DropdownStrategy = {
  id: "react-select",
  name: "React Select",

  detect(el: Element): boolean {
    // React Select wraps in a container with css-* classes
    const container = el.closest("[class*='__control'], [class*='-control'], [class*='css-']");
    if (container && container.querySelector("[class*='__value-container'], [class*='__indicators']")) {
      return true;
    }
    // Check parent/grandparent for react-select class patterns
    const parent = el.parentElement?.closest("[class*='react-select'], [class*='Select__']");
    if (parent) return true;
    // Input inside a react-select container
    if (el.tagName === "INPUT" && el.closest("[class*='__control']")) return true;
    return false;
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const container = this._getContainer(el);
    if (!container) return [];
    const control = container.querySelector("[class*='__control']") as HTMLElement;
    if (!control) return [];
    const menu = await clickAndWaitForDropdown(control, [
      "[class*='__menu']",
      "[class*='__menu-list']",
    ], document, 500);
    if (!menu) return [];
    return scrapeOptionsFromMenu(menu);
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const container = this._getContainer(el);
    if (!container) return false;

    // Clear existing value
    const clearBtn = container.querySelector("[class*='__clear-indicator']") as HTMLElement;
    if (clearBtn) clearBtn.click();

    // Find or create the input
    const input = container.querySelector("input") as HTMLInputElement;
    const control = container.querySelector("[class*='__control']") as HTMLElement;
    if (!input && !control) return false;

    // Click to open
    (control ?? input)?.click();
    await sleep(200);

    // Type to filter
    if (input) {
      setInputValueRobust(input, value);
    }
    await sleep(400); // Wait for filter/async load

    // Find menu and select best match
    const menu = document.querySelector("[class*='__menu-list'], [class*='__menu']");
    if (!menu) {
      // Try keyboard selection
      if (input) {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        await sleep(100);
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
      return true;
    }

    const items = menu.querySelectorAll("[class*='option'], [role=option]");
    const mapped = [...items].map((item) => ({
      element: item as HTMLElement,
      value: item.getAttribute("data-value") ?? item.getAttribute("value") ?? item.textContent?.trim() ?? "",
      label: item.textContent?.trim() ?? "",
    }));
    const match = bestMatch(value, mapped);
    if (match) {
      const matchedItem = mapped.find((m) => m.value === match.value && m.label === match.label);
      if (matchedItem) {
        clickElementWithMouseEvents(matchedItem.element);
        return true;
      }
    }
    // Fallback: click first option
    const first = menu.querySelector("[class*='option'], [role=option]") as HTMLElement;
    if (first) {
      clickElementWithMouseEvents(first);
      return true;
    }
    // Keyboard fallback
    if (input) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    return true;
  },

  isMultiSelect(el: Element): boolean {
    const container = this._getContainer(el);
    if (!container) return false;
    return Boolean(
      container.querySelector("[class*='__multi-value']") ||
      container.classList.contains("is-multi") ||
      container.querySelector("[class*='__value-container--is-multi']")
    );
  },

  _getContainer(el: Element): Element | null {
    return (
      el.closest("[class*='react-select'], [class*='Select__'], [class*='css-']") ??
      el.closest("[class*='__control']")?.parentElement ??
      null
    );
  },
} as DropdownStrategy & { _getContainer(el: Element): Element | null };

/* ------------------------------------------------------------------ */
/* 2. Material UI Autocomplete / Select Strategy                       */
/* ------------------------------------------------------------------ */

export const MuiStrategy: DropdownStrategy = {
  id: "mui",
  name: "Material UI",

  detect(el: Element): boolean {
    return Boolean(
      el.closest("[class*='MuiAutocomplete'], [class*='MuiSelect'], [class*='MuiTextField']") ||
      el.closest("[class*='mui-'], .MuiInputBase-root") ||
      (el.getAttribute("role") === "combobox" && el.closest("[class*='Mui']"))
    );
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const trigger = (el.closest("[class*='MuiSelect-select']") ??
      el.closest("[class*='MuiAutocomplete']")?.querySelector("input") ??
      el) as HTMLElement;
    trigger.click();
    await sleep(300);
    // MUI renders Popper/Menu in a portal at document root
    const menu =
      document.querySelector("[class*='MuiAutocomplete-popper'] [role=listbox]") ??
      document.querySelector("[class*='MuiMenu-paper'] [role=listbox]") ??
      document.querySelector("[class*='MuiPopover-paper'] ul[role=listbox]") ??
      document.querySelector("[role=listbox]");
    if (!menu) return [];
    return scrapeOptionsFromMenu(menu);
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const input = (el.closest("[class*='MuiAutocomplete']")?.querySelector("input") ??
      el) as HTMLInputElement;

    if (input.tagName === "INPUT") {
      setInputValueRobust(input, value);
      await sleep(400);
    } else {
      (input as HTMLElement).click();
      await sleep(300);
    }

    // Find portal-mounted listbox
    const listbox =
      document.querySelector("[class*='MuiAutocomplete-popper'] [role=listbox]") ??
      document.querySelector("[role=listbox]:not([hidden])");
    if (listbox) {
      const options = scrapeOptionsFromMenu(listbox);
      const match = bestMatch(value, options);
      if (match) {
        const optionEl = [...listbox.querySelectorAll("[role=option], li")].find(
          (o) => o.textContent?.trim() === match.label
        ) as HTMLElement | undefined;
        if (optionEl) {
          clickElementWithMouseEvents(optionEl);
          return true;
        }
      }
      const first = listbox.querySelector("[role=option], li") as HTMLElement;
      if (first) { clickElementWithMouseEvents(first); return true; }
    }

    // Keyboard fallback for select
    if (input.tagName === "INPUT") {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(100);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    return true;
  },

  isMultiSelect(el: Element): boolean {
    const auto = el.closest("[class*='MuiAutocomplete']");
    return Boolean(auto?.querySelector("[class*='MuiChip']"));
  },
};

/* ------------------------------------------------------------------ */
/* 3. Ant Design Select Strategy                                       */
/* ------------------------------------------------------------------ */

export const AntDesignStrategy: DropdownStrategy = {
  id: "ant-design",
  name: "Ant Design",

  detect(el: Element): boolean {
    return Boolean(
      el.closest(".ant-select, [class*='ant-select']") ||
      el.closest(".ant-cascader, .ant-tree-select")
    );
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const selector = el.closest(".ant-select") as HTMLElement;
    if (!selector) return [];
    selector.click();
    await sleep(300);
    const dropdown =
      document.querySelector(".ant-select-dropdown:not(.ant-select-dropdown-hidden)") ??
      document.querySelector("[class*='ant-select-dropdown']");
    if (!dropdown) return [];
    const items = dropdown.querySelectorAll(
      ".ant-select-item-option, [class*='ant-select-item-option']"
    );
    return [...items].map((item) => ({
      value: item.getAttribute("data-value") ?? item.getAttribute("title") ?? item.textContent?.trim() ?? "",
      label: item.textContent?.trim() ?? "",
    }));
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const container = el.closest(".ant-select") as HTMLElement;
    if (!container) return false;

    // Open dropdown
    container.click();
    await sleep(200);

    // Type in search input
    const searchInput = container.querySelector(
      ".ant-select-selection-search-input, input[class*='ant-select']"
    ) as HTMLInputElement;
    if (searchInput) {
      setInputValueRobust(searchInput, value);
      await sleep(350);
    }

    // Find and click matching option
    const dropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)"
    );
    if (dropdown) {
      const items = dropdown.querySelectorAll(".ant-select-item-option");
      const options: DropdownOption[] = [...items].map((item) => ({
        value: item.getAttribute("data-value") ?? item.textContent?.trim() ?? "",
        label: item.textContent?.trim() ?? "",
      }));
      const match = bestMatch(value, options);
      if (match) {
        const optEl = [...items].find(
          (o) => o.textContent?.trim() === match.label
        ) as HTMLElement | undefined;
        if (optEl) { clickElementWithMouseEvents(optEl); return true; }
      }
      const first = items[0] as HTMLElement;
      if (first) { clickElementWithMouseEvents(first); return true; }
    }
    return false;
  },

  isMultiSelect(el: Element): boolean {
    const container = el.closest(".ant-select");
    return Boolean(
      container?.classList.contains("ant-select-multiple") ||
      container?.querySelector(".ant-select-selection-overflow")
    );
  },
};

/* ------------------------------------------------------------------ */
/* 4. Workday Web Component Strategy                                   */
/* ------------------------------------------------------------------ */

export const WorkdayStrategy: DropdownStrategy = {
  id: "workday",
  name: "Workday",

  detect(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    return (
      tag.startsWith("wd-") ||
      Boolean(el.closest("[data-automation-id*='select'], [data-automation-id*='dropdown']")) ||
      Boolean(el.closest("wd-select, wd-popup, wd-combobox")) ||
      Boolean(el.closest("[class*='WDAC'], [class*='WD-']"))
    );
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const container = this._getContainer(el);
    if (!container) return [];

    // Click to open popup
    const trigger = (container.querySelector("[data-automation-id*='icon'], button, [role='button']") ??
      container) as HTMLElement;
    trigger.click();
    await sleep(500);

    // Workday renders popup in a portal or shadow root
    const popup =
      document.querySelector("[data-automation-id*='promptOption'], [data-automation-id*='selectWidget']") ??
      document.querySelector("[class*='promptDropdown'], [class*='WDPL']") ??
      document.querySelector("[role=listbox]");
    if (!popup) return [];
    return scrapeOptionsFromMenu(popup);
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const container = this._getContainer(el);
    if (!container) return false;

    // Try input-based combobox first
    const input = container.querySelector("input") as HTMLInputElement;
    if (input) {
      input.click();
      setInputValueRobust(input, value);
      await sleep(600); // Workday is slow
    } else {
      // Click the control to open
      (container as HTMLElement).click();
      await sleep(500);
    }

    // Find prompt options
    const popup =
      document.querySelector("[data-automation-id*='promptOption']") ??
      document.querySelector("[class*='promptDropdown']") ??
      document.querySelector("[role=listbox]:not([hidden])");
    if (popup) {
      const items = popup.querySelectorAll(
        "[data-automation-id*='promptOption'] [data-automation-id*='label'], " +
        "[role=option], li, [class*='option']"
      );
      const options: DropdownOption[] = [...items]
        .map((item) => ({
          value: item.getAttribute("data-automation-id") ?? item.textContent?.trim() ?? "",
          label: item.textContent?.trim() ?? "",
        }))
        .filter((o) => o.label);
      const match = bestMatch(value, options);
      if (match) {
        const optEl = [...items].find((o) => o.textContent?.trim() === match.label) as HTMLElement;
        if (optEl) {
          optEl.scrollIntoView?.({ block: "center" });
          await sleep(100);
          clickElementWithMouseEvents(optEl);
          return true;
        }
      }
      // Scroll through virtualized list to find option
      return await this._scrollAndFind(popup, value);
    }

    // Keyboard fallback
    if (input) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(150);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    return true;
  },

  isMultiSelect(el: Element): boolean {
    const container = this._getContainer(el);
    return Boolean(
      container?.querySelector("[data-automation-id*='multi']") ||
      container?.querySelector("[class*='multi']")
    );
  },

  async _scrollAndFind(popup: Element, value: string): Promise<boolean> {
    const scrollContainer = popup.querySelector("[style*='overflow']") ?? popup;
    const maxScrolls = 10;
    for (let i = 0; i < maxScrolls; i++) {
      const items = popup.querySelectorAll("[role=option], li, [class*='option']");
      for (const item of items) {
        if (fuzzyMatch(value, item.textContent?.trim() ?? "")) {
          (item as HTMLElement).scrollIntoView?.({ block: "center" });
          await sleep(100);
          clickElementWithMouseEvents(item as HTMLElement);
          return true;
        }
      }
      (scrollContainer as HTMLElement).scrollTop += 200;
      await sleep(200);
    }
    return false;
  },

  _getContainer(el: Element): Element | null {
    return (
      el.closest("wd-select, wd-combobox, wd-popup") ??
      el.closest("[data-automation-id*='select'], [data-automation-id*='dropdown']") ??
      el.closest("[class*='WDAC']") ??
      el.parentElement
    );
  },
} as DropdownStrategy & {
  _getContainer(el: Element): Element | null;
  _scrollAndFind(popup: Element, value: string): Promise<boolean>;
};

/* ------------------------------------------------------------------ */
/* 5. Virtualized Dropdown Strategy                                    */
/* ------------------------------------------------------------------ */

export const VirtualizedStrategy: DropdownStrategy = {
  id: "virtualized",
  name: "Virtualized List",

  detect(el: Element): boolean {
    const parent = el.parentElement?.parentElement;
    if (!parent) return false;
    return Boolean(
      parent.querySelector("[class*='virtual'], [class*='Virtual']") ||
      parent.querySelector("[style*='position: absolute'][style*='top:']") ||
      el.closest("[class*='windowed'], [class*='virtualized']")
    );
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    // Can only see currently rendered options — need to scroll
    const container = this._getScrollContainer(el);
    if (!container) return [];
    const allOptions: DropdownOption[] = [];
    const seen = new Set<string>();
    const maxScrolls = 15;
    for (let i = 0; i < maxScrolls; i++) {
      const items = container.querySelectorAll("[role=option], li, [class*='option']");
      for (const item of items) {
        const label = item.textContent?.trim() ?? "";
        if (label && !seen.has(label)) {
          seen.add(label);
          allOptions.push({ value: label, label });
        }
      }
      (container as HTMLElement).scrollTop += 300;
      await sleep(150);
    }
    return allOptions;
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    // First try: type to filter (if input is available)
    const input = el.closest("[role=combobox]") ?? el;
    if (input instanceof HTMLInputElement) {
      setInputValueRobust(input, value);
      await sleep(400);
    }

    // Scroll to find and click
    const container = this._getScrollContainer(el);
    if (!container) return false;
    const maxScrolls = 15;
    (container as HTMLElement).scrollTop = 0;
    await sleep(100);

    for (let i = 0; i < maxScrolls; i++) {
      const items = container.querySelectorAll("[role=option], li, [class*='option']");
      for (const item of items) {
        if (fuzzyMatch(value, item.textContent?.trim() ?? "")) {
          (item as HTMLElement).scrollIntoView?.({ block: "center" });
          await sleep(100);
          clickElementWithMouseEvents(item as HTMLElement);
          return true;
        }
      }
      (container as HTMLElement).scrollTop += 300;
      await sleep(200);
    }
    return false;
  },

  isMultiSelect(): boolean {
    return false;
  },

  _getScrollContainer(el: Element): Element | null {
    let node: Element | null = el;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowY === "auto" || style.overflowY === "scroll") return node;
      node = node.parentElement;
    }
    return el.closest("[role=listbox]");
  },
} as DropdownStrategy & { _getScrollContainer(el: Element): Element | null };

/* ------------------------------------------------------------------ */
/* 6. Native HTML Select Strategy (improved)                           */
/* ------------------------------------------------------------------ */

export const NativeSelectStrategy: DropdownStrategy = {
  id: "native-select",
  name: "Native Select",

  detect(el: Element): boolean {
    return el.tagName === "SELECT";
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const select = el as HTMLSelectElement;
    return Array.from(select.options).map((o) => ({
      value: o.value,
      label: o.textContent?.trim() ?? o.value,
    }));
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const select = el as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => ({
      value: o.value,
      label: o.textContent?.trim() ?? o.value,
    }));
    const match = bestMatch(value, options);
    if (!match) return false;

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, match.value);
    else select.value = match.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  },

  isMultiSelect(el: Element): boolean {
    return (el as HTMLSelectElement).multiple;
  },
};

/* ------------------------------------------------------------------ */
/* 7. Generic ARIA Listbox Strategy (catch-all)                        */
/* ------------------------------------------------------------------ */

export const AriaListboxStrategy: DropdownStrategy = {
  id: "aria-listbox",
  name: "ARIA Listbox",

  detect(el: Element): boolean {
    // Element has a linked listbox via aria-controls/aria-owns
    const linkedId = el.getAttribute("aria-controls") ?? el.getAttribute("aria-owns");
    if (linkedId && document.getElementById(linkedId)?.getAttribute("role") === "listbox") return true;
    // Element is a combobox
    if (el.getAttribute("role") === "combobox") return true;
    // Parent has a combobox role
    if (el.closest("[role=combobox]")) return true;
    return false;
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const combobox = el.closest("[role=combobox]") ?? el;
    (combobox as HTMLElement).click();
    (combobox as HTMLElement).focus?.();
    await sleep(200);

    let listbox: Element | null = null;
    const linkedId = combobox.getAttribute("aria-controls") ?? combobox.getAttribute("aria-owns");
    for (let i = 0; i < 4; i++) {
      listbox = (linkedId ? document.getElementById(linkedId) : null) ??
        document.querySelector("[role=listbox]:not([hidden])") ??
        document.querySelector("[class*='listbox']:not([hidden])") ??
        document.querySelector("[class*='dropdown']:not([hidden]) ul");
      if (listbox && isVisible(listbox)) break;
      await sleep(150);
    }
    if (!listbox) return [];
    return scrapeOptionsFromMenu(listbox);
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const input = (el instanceof HTMLInputElement ? el : el.querySelector("input")) as HTMLInputElement;

    if (input) {
      input.click();
      setInputValueRobust(input, value);
      await sleep(400);
    } else {
      (el as HTMLElement).click();
      await sleep(300);
    }

    let listbox: Element | null = null;
    const linkedId = el.getAttribute("aria-controls") ?? el.getAttribute("aria-owns") ??
      el.closest("[role=combobox]")?.getAttribute("aria-controls");
    for (let i = 0; i < 4; i++) {
      listbox = (linkedId ? document.getElementById(linkedId) : null) ??
        document.querySelector("[role=listbox]:not([hidden])") ??
        document.querySelector("[class*='listbox']:not([hidden])") ??
        document.querySelector("[class*='dropdown']:not([hidden]) ul");
      if (listbox && isVisible(listbox)) break;
      await sleep(150);
    }

    if (listbox) {
      const items = listbox.querySelectorAll("[role=option], li, [class*='option'], [class*='item']");
      const mapped = [...items].map((item) => ({
        element: item as HTMLElement,
        value: item.getAttribute("data-value") ?? item.textContent?.trim() ?? "",
        label: item.textContent?.trim() ?? "",
      }));
      const match = bestMatch(value, mapped);
      if (match) {
        const matchedItem = mapped.find((m) => m.value === match.value && m.label === match.label);
        if (matchedItem) {
          clickElementWithMouseEvents(matchedItem.element);
          return true;
        }
      }
      if (items[0]) { clickElementWithMouseEvents(items[0] as HTMLElement); return true; }
    }

    // Keyboard fallback
    if (input) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(100);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    return true;
  },

  isMultiSelect(el: Element): boolean {
    const listbox = el.getAttribute("aria-controls") ?? el.getAttribute("aria-owns");
    if (listbox) {
      const lb = document.getElementById(listbox);
      return lb?.getAttribute("aria-multiselectable") === "true";
    }
    return false;
  },
};

/* ------------------------------------------------------------------ */
/* 8. Modern Headless / Radix UI / Ashby / Floating Portal Strategy   */
/* ------------------------------------------------------------------ */

export const RadixHeadlessStrategy: DropdownStrategy = {
  id: "radix-headless",
  name: "Radix / Headless / Ashby Portal",

  detect(el: Element): boolean {
    if (el.hasAttribute("data-radix-collection-item")) return true;
    if (
      el.getAttribute("data-state") !== null &&
      (el.getAttribute("aria-haspopup") === "listbox" ||
        el.getAttribute("aria-haspopup") === "menu" ||
        el.getAttribute("role") === "combobox")
    ) {
      return true;
    }
    if (el.hasAttribute("data-headlessui-state")) return true;
    if (
      el.matches?.(
        "[data-testid*='select'], [data-testid*='dropdown'], [class*='ashby-select'], [class*='ashby-dropdown'], [class*='select__control']"
      )
    ) {
      return true;
    }
    if (
      el.querySelector?.(
        "[data-radix-collection-item], [data-headlessui-state], [data-testid*='select'], [data-testid*='dropdown']"
      )
    ) {
      return true;
    }
    if (
      el.tagName === "BUTTON" &&
      (el.getAttribute("aria-haspopup") === "listbox" ||
        el.getAttribute("aria-haspopup") === "menu" ||
        el.getAttribute("role") === "combobox")
    ) {
      return true;
    }
    return false;
  },

  async getOptions(el: Element): Promise<DropdownOption[]> {
    const trigger = (el.tagName === "BUTTON" ? el : el.querySelector("button") ?? el) as HTMLElement;
    clickElementWithMouseEvents(trigger);
    await sleep(250);

    const menu = await findFloatingPortalMenu();
    if (!menu) return [];
    return scrapeOptionsFromMenu(menu);
  },

  async selectOption(el: Element, value: string): Promise<boolean> {
    const trigger = (el.tagName === "BUTTON" ? el : el.querySelector("button") ?? el) as HTMLElement;
    clickElementWithMouseEvents(trigger);
    await sleep(250);

    const menu = await findFloatingPortalMenu();
    if (!menu) {
      // Keyboard fallback on trigger
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await sleep(100);
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return true;
    }

    const items = menu.querySelectorAll(
      "[role=option], [data-radix-collection-item], li, [class*='option'], [class*='item'], [data-headlessui-state*='active']"
    );
    const mapped = [...items].map((item) => ({
      element: item as HTMLElement,
      value: item.getAttribute("data-value") ?? item.textContent?.trim() ?? "",
      label: item.textContent?.trim() ?? "",
    }));

    const match = bestMatch(value, mapped);
    if (match) {
      const matchedItem = mapped.find((m) => m.value === match.value && m.label === match.label);
      if (matchedItem) {
        clickElementWithMouseEvents(matchedItem.element);
        await sleep(150);
        return true;
      }
    }

    if (mapped[0]) {
      clickElementWithMouseEvents(mapped[0].element);
      return true;
    }

    return false;
  },

  isMultiSelect(el: Element): boolean {
    return el.getAttribute("aria-multiselectable") === "true";
  },
};

async function findFloatingPortalMenu(): Promise<Element | null> {
  const portalSelectors = [
    "[data-radix-popper-content-wrapper]",
    "[data-radix-select-viewport]",
    "[data-floating-ui-portal]",
    "[data-headlessui-state*='open']",
    "[role='listbox']:not([hidden])",
    "[data-testid*='select-menu']",
    "[data-testid*='dropdown-menu']",
    ".ashby-select-menu",
    "div[id*='radix-']",
    "div[class*='select-menu']",
    "div[class*='dropdown-menu']",
  ];

  for (let i = 0; i < 5; i++) {
    for (const sel of portalSelectors) {
      const found = document.querySelector(sel);
      if (found && isVisible(found)) return found;
    }
    await sleep(80);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Strategy registry & detection                                       */
/* ------------------------------------------------------------------ */

/** Ordered by specificity — first match wins. */
const STRATEGIES: DropdownStrategy[] = [
  WorkdayStrategy,
  ReactSelectStrategy,
  RadixHeadlessStrategy,
  MuiStrategy,
  AntDesignStrategy,
  VirtualizedStrategy,
  AriaListboxStrategy,
  NativeSelectStrategy,
];

/**
 * Detect which dropdown strategy to use for a given element.
 * Returns null if no strategy matches (element is not a dropdown).
 */
export function detectDropdownStrategy(el: Element): DropdownStrategy | null {
  for (const strategy of STRATEGIES) {
    if (strategy.detect(el)) return strategy;
  }
  return null;
}

/**
 * Fill any dropdown type using the auto-detected strategy.
 * This is the single entry point for all dropdown filling.
 */
export async function fillAnyDropdown(
  field: DetectedField,
  value: string
): Promise<boolean> {
  const el = queryNode(field.selector);
  if (!el) return false;

  const strategy = detectDropdownStrategy(el);
  if (!strategy) return false;

  // For multi-select, split value by comma and select each
  const isMulti = strategy.isMultiSelect(el) || field.fieldKey === "skills" || field.fieldKey === "languages" || /skills|languages|awards/i.test(field.label);
  if (isMulti && value.includes(",")) {
    const values = value.split(",").map((v) => v.trim()).filter(Boolean);
    let anySuccess = false;
    for (const v of values) {
      const ok = await strategy.selectOption(el, v);
      if (ok) anySuccess = true;
      await sleep(250);
    }
    return anySuccess;
  }

  return strategy.selectOption(el, value);
}

// Re-export helpers for use in other modules
export { fuzzyMatch, bestMatch, levenshtein, clickElementWithMouseEvents, setInputValueRobust };
