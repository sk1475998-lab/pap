/**
 * Dropdown / combobox handler — unified entry point.
 *
 * Routes all dropdown fills through the strategy registry so every
 * dropdown type (React Select, MUI, Ant Design, Workday, virtualized,
 * native <select>, ARIA combobox) is handled consistently.
 */
import type { DetectedField } from "@superjob/core";
import { queryNode } from "./ats-adapter.js";
import {
  fillAnyDropdown,
  detectDropdownStrategy,
  NativeSelectStrategy,
  fuzzyMatch,
  clickElementWithMouseEvents,
  setInputValueRobust,
} from "./dropdown-strategies.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Country code for phone fields                                       */
/* ------------------------------------------------------------------ */

const COUNTRY_CODE_MAP: Record<string, string> = {
  india: "+91", "in": "+91",
  "united states": "+1", us: "+1", usa: "+1",
  "united kingdom": "+44", uk: "+44", gb: "+44",
  canada: "+1", ca: "+1",
  australia: "+61", au: "+61",
  germany: "+49", de: "+49",
  france: "+33", fr: "+33",
  singapore: "+65", sg: "+65",
  japan: "+81", jp: "+81",
  china: "+86", cn: "+86",
  brazil: "+55", br: "+55",
  uae: "+971", "united arab emirates": "+971",
  netherlands: "+31", nl: "+31",
  ireland: "+353", ie: "+353",
  israel: "+972", il: "+972",
  sweden: "+46", se: "+46",
  switzerland: "+41", ch: "+41",
};

function resolveDialCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("+")) return v;
  return COUNTRY_CODE_MAP[v] ?? (v.length <= 3 ? `+${v}` : v);
}

/** Try to set phone country code via intl-tel-input, sibling dropdown, or custom widget.
 * FIX: Added retry logic with fallback to direct typing */
export async function fillPhoneCountryCode(value: string): Promise<boolean> {
  const dial = resolveDialCode(value);
  
  // Try up to 3 times with different approaches
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(500 * attempt); // Progressive delay
    }

  // 1. intl-tel-input flag dropdown
  const iti = document.querySelector(".iti, .intl-tel-input");
  if (iti) {
    const selected = iti.querySelector(
      ".iti__selected-country, .iti__selected-flag, .selected-flag"
    ) as HTMLElement | null;
    selected?.click();
    await sleep(250);
    const items = iti.querySelectorAll(
      ".iti__country, .country-list li, [class*='iti__country']"
    );
    for (const item of items) {
      const text = item.textContent ?? "";
      if (text.includes(dial) || fuzzyMatch(dial, text)) {
        clickElementWithMouseEvents(item as HTMLElement);
        await sleep(200);
        // Verify it was set
        const nowSelected = iti.querySelector(".iti__selected-country .iti__dial-code");
        if (nowSelected?.textContent?.includes(dial)) return true;
      }
    }
    // Scroll fallback for long lists
    const list = iti.querySelector(".iti__country-list, .country-list") as HTMLElement;
    if (list) {
      list.scrollTop = 0;
      for (let i = 0; i < 10; i++) {
        const items2 = iti.querySelectorAll(".iti__country, .country-list li");
        for (const item of items2) {
          const text = item.textContent ?? "";
          if (text.includes(dial) || fuzzyMatch(dial, text)) {
            (item as HTMLElement).scrollIntoView?.({ block: "center" });
            await sleep(100);
            clickElementWithMouseEvents(item as HTMLElement);
            await sleep(200);
            const nowSelected = iti.querySelector(".iti__selected-country .iti__dial-code");
            if (nowSelected?.textContent?.includes(dial)) return true;
          }
        }
        list.scrollTop += 200;
        await sleep(150);
      }
    }
  }

  // 2. Sibling select for country code
  const phone = document.querySelector(
    'input[type=tel], input[name*="phone" i], input[id*="phone" i]'
  );
  if (phone) {
    const container =
      phone.closest("div, fieldset, .form-group, .row, [class*='phone']") ?? phone.parentElement;
    const select = container?.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      const ok = await NativeSelectStrategy.selectOption(select, dial);
      if (ok) return true;
      // Try country name
      const ok2 = await NativeSelectStrategy.selectOption(select, "India");
      if (ok2) return true;
    }

    // 3. Custom country code button/dropdown
    const codeBtn = container?.querySelector(
      "[class*='country'], [class*='dial'], [class*='code']," +
      "button[aria-label*='country' i], [class*='flag'], [class*='phone-prefix']"
    );
    if (codeBtn instanceof HTMLElement) {
      codeBtn.click();
      await sleep(300);
      const opts = [
        ...document.querySelectorAll(
          "[role=option], li, .iti__country, [class*='country-item'], [class*='dial-option']"
        ),
      ];
      const match = opts.find((el) => {
        const t = el.textContent ?? "";
        return t.includes(dial) || fuzzyMatch(dial, t) || fuzzyMatch("India", t);
      });
      if (match instanceof HTMLElement) {
        clickElementWithMouseEvents(match);
        await sleep(200);
        // Verify
        if (codeBtn.textContent?.includes(dial)) return true;
      }
    }
    
    // FIX: Fallback - type country code directly into phone field
    if (attempt === 2 && phone instanceof HTMLInputElement) {
      const currentVal = phone.value.trim();
      if (!currentVal.startsWith("+")) {
        setInputValueRobust(phone, `${dial} ${currentVal}`);
        return true;
      }
    }
  }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Combobox fill (enhanced)                                            */
/* ------------------------------------------------------------------ */

/** Enhanced combobox: type, wait for debounced search, click best match. */
export async function fillCombobox(
  field: DetectedField,
  value: string
): Promise<boolean> {
  const el = queryNode(field.selector);
  if (!el) return false;

  // Check if a strategy handles this element
  const strategy = detectDropdownStrategy(el);
  if (strategy) {
    return strategy.selectOption(el, value);
  }

  // Fallback: generic combobox fill
  const input = el as HTMLInputElement;
  setInputValueRobust(input, value);

  // Wait for debounced results (many ATS debounce 300-500ms)
  await sleep(500);

  const listId =
    input.getAttribute("aria-controls") ?? input.getAttribute("aria-owns");
  const listbox =
    (listId ? document.getElementById(listId) : null) ??
    document.querySelector("[role=listbox]:not([hidden])");

  if (listbox) {
    const options = listbox.querySelectorAll(
      "[role=option], li, .select__option, [class*='option']"
    );
    const v = value.toLowerCase();
    // Find best match by scoring
    let bestEl: HTMLElement | null = null;
    let bestScore = 0;
    for (const opt of options) {
      const text = opt.textContent?.trim().toLowerCase() ?? "";
      if (!text) continue;
      let score = 0;
      if (text === v) score = 100;
      else if (text.startsWith(v)) score = 80;
      else if (text.includes(v)) score = 60;
      else if (v.includes(text)) score = 40;
      else if (fuzzyMatch(v, text)) score = 20;
      if (score > bestScore) {
        bestScore = score;
        bestEl = opt as HTMLElement;
      }
    }
    if (bestEl) {
      bestEl.scrollIntoView?.({ block: "center" });
      await sleep(80);
      clickElementWithMouseEvents(bestEl);
      return true;
    }
    // Click first option as fallback
    if (options[0]) {
      clickElementWithMouseEvents(options[0] as HTMLElement);
      return true;
    }
  }

  // Keyboard fallback — try ArrowDown + Enter
  await sleep(200);
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await sleep(150);
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Universal dropdown fill                                              */
/* ------------------------------------------------------------------ */

/**
 * Fill any dropdown field — routes to strategy system first, then
 * falls back to native select / combobox handling.
 */
export async function fillDropdownField(
  field: DetectedField,
  value: string
): Promise<boolean> {
  // 1. Try strategy system (handles all modern frameworks)
  const el = queryNode(field.selector);
  if (el) {
    const strategy = detectDropdownStrategy(el);
    if (strategy) {
      return strategy.selectOption(el, value);
    }
  }

  // 2. Combobox
  if (field.type === "combobox") return fillCombobox(field, value);

  // 3. Native <select>
  if (el?.tagName === "SELECT") {
    return NativeSelectStrategy.selectOption(el, value);
  }

  // 4. Custom dropdown detection by context
  if (el) {
    // Check if there's a hidden select nearby that React controls
    const parent = el.closest("[class*='select'], [class*='dropdown'], [class*='combo']");
    if (parent) {
      const hiddenSelect = parent.querySelector("select") as HTMLSelectElement;
      if (hiddenSelect) {
        return NativeSelectStrategy.selectOption(hiddenSelect, value);
      }
    }
  }

  return false;
}
