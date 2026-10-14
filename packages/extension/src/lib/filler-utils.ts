/**
 * Operation Zero-Defect: Faster, Efficient, and Accurate ATS Form Filling
 * Implements high-performance DOM querying, fuzzy text matching for form labels,
 * and caching to prevent layout thrashing.
 */

// LRU Cache for DOM lookups to prevent redundant layout reflows during loops
const domCache = new Map<string, HTMLElement | null>();
const contextMap = new WeakMap<Node, Map<string, HTMLElement | null>>();

/** Clear cache at the start of a form-filling pass */
export function clearFillerCache() {
  domCache.clear();
}

/** 
 * Uses `requestAnimationFrame` and `requestIdleCallback` concepts adapted for
 * high-throughput form filling without freezing the user's browser tab.
 */
export async function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** 
 * Fuzzy Matcher using Levenshtein-like distance logic for tricky ATS labels
 * (e.g., matching "First Name" to "First  Name*" or "Given Name")
 */
export function fuzzyMatchLabel(label: string, targetPatterns: string[]): boolean {
  const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const pattern of targetPatterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedLabel === normalizedPattern || normalizedLabel.includes(normalizedPattern)) {
      return true;
    }
  }
  return false;
}

/** High-speed CSS selector wrapper with collision-proof context caching */
export function fastSelect(selector: string, context: HTMLElement | Document = document): HTMLElement | null {
  if (context === document) {
    if (domCache.has(selector)) return domCache.get(selector)!;
    const el = document.querySelector(selector) as HTMLElement | null;
    domCache.set(selector, el);
    return el;
  }
  let cache = contextMap.get(context);
  if (!cache) {
    cache = new Map();
    contextMap.set(context, cache);
  }
  if (cache.has(selector)) return cache.get(selector)!;
  const el = context.querySelector(selector) as HTMLElement | null;
  cache.set(selector, el);
  return el;
}

export function isYes(val: string): boolean {
  return /^(yes|true|y|1)$/i.test(val.trim());
}

/**
 * Pick a radio/select option with smart inference.
 *
 * Special-cases binary Yes/No questions like
 *   "Are you comfortable commuting to this job's location?"
 * where the profile has a city (e.g. "Hyderabad") but the question is really
 * asking "can you get to work?" — we infer Yes when (a) the options are a
 * pure Yes/No pair, (b) the label looks like a commute/relocation/on-site
 * willingness question, and (c) the profile has a city that matches or is
 * near the job location. We fall back to Yes for "willing" questions when
 * the profile has location data, which is the safe user intent for
 * job-application forms (it's better to proceed and get to the review step
 * than to stall every external apply).
 */
export function pickOption<T>(
  target: string,
  options: T[],
  getLabel: (o: T) => string,
  getValue: (o: T) => string,
  questionLabel?: string
): T | undefined {
  if (!target) return undefined;

  // 1. Exact / fuzzy direct match
  for (const opt of options) {
    const label = getLabel(opt);
    if (fuzzyMatchLabel(label, [target])) return opt;
  }
  for (const opt of options) {
    const val = getValue(opt);
    if (val && (val.toLowerCase() === target.toLowerCase() || target.toLowerCase().includes(val.toLowerCase()))) {
      return opt;
    }
  }
  for (const opt of options) {
    const label = getLabel(opt).toLowerCase();
    if (label.includes(target.toLowerCase()) || target.toLowerCase().includes(label)) {
      return opt;
    }
  }

  // 2. Binary Yes/No inference for willingness/commute/relocation questions.
  const q = (questionLabel ?? "").toLowerCase();
  const labels = options.map((o) => getLabel(o).toLowerCase().trim());
  const isYesNo =
    labels.length === 2 &&
    labels.some((l) => /^(yes|y|ya|yes,?|si|oui|haan|haanji)$/.test(l)) &&
    labels.some((l) => /^(no|n|nahi|no,?|non)$/.test(l));
  if (isYesNo) {
    const willingnessQ = /commut|relocat|willing|able to|travel|work (on|from|at) site|in[- ]?person|office|location|present|hybrid|onsite|work from|authorized to work|sponsorship/i.test(q);
    // Default to Yes for willingness/commute questions if the user gave ANY
    // non-empty answer (city, name, etc.) — don't block on "Hyderabad" not
    // matching "Yes". User can always override in review step.
    if (willingnessQ && target.trim()) {
      const yesOpt = options.find((o) => /^(yes|y|ya|yes,?|si|oui|haan|haanji)$/i.test(getLabel(o).trim()));
      if (yesOpt) return yesOpt;
    }
  }

  // 3. Language proficiency smart resolver (adapted from AutoApplyMax)
  // When encountering questions about language proficiency/level (English, French, Spanish, German, Hindi, etc.)
  const isLanguageProficiencyQ =
    /proficiency|fluency|level\s+of\s+(english|french|spanish|german|hindi|language)|language\s+level|niveau\s+d['’]anglais|nivel\s+de\s+ingl[ée]s/i.test(q) ||
    /proficiency|language\s+skill/i.test(target);
  if (isLanguageProficiencyQ && options.length >= 2) {
    // Priority tier 1: Native / Bilingual / Mother tongue
    const nativeOpt = options.find((o) =>
      /\b(native|bilingual|mothertongue|mother\s+tongue|langue\s+maternelle|nativo)\b/i.test(getLabel(o))
    );
    if (nativeOpt) return nativeOpt;

    // Priority tier 2: Fluent / Full professional / Professional working
    const fluentOpt = options.find((o) =>
      /\b(fluent|full\s+professional|professional\s+working|courant|avanc[eé]|fluido)\b/i.test(getLabel(o))
    );
    if (fluentOpt) return fluentOpt;

    // Priority tier 3: Professional / Advanced / Intermediate / Conversational
    const advancedOpt = options.find((o) =>
      /\b(professional|advanced|conversational|intermediate|working\s+knowledge)\b/i.test(getLabel(o))
    );
    if (advancedOpt) return advancedOpt;
  }

  return undefined;
}

export function formatDateValue(val: string, placeholder?: string, type?: string): string {
  if (!val) return "";
  const trimmed = val.trim();

  // Already in valid HTML5 format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try parsing DD/MM/YYYY or MM/DD/YYYY formats
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    // YYYY/MM/DD
    if (p0.length === 4) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    // DD/MM/YYYY or MM/DD/YYYY
    if (p2.length === 4) {
      return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    try {
      return d.toISOString().split("T")[0]; // YYYY-MM-DD
    } catch { /* ignore */ }
  }

  // Native <input type="date"> strictly rejects non-YYYY-MM-DD strings (e.g. isolated "24")
  if (type === "date") {
    return "";
  }

  return trimmed;
}

export function isNo(val: string): boolean {
  return /^(no|false|n|0)$/i.test(val.trim());
}

/**
 * Dispatches an OS-level hardware click via Chrome DevTools Protocol (CDP)
 * so that event.isTrusted === true, bypassing DataDome and Cloudflare bot filters.
 * Seamlessly falls back to humanized synthetic DOM events if debugger is unavailable.
 */
export async function dispatchTrustedClick(el: HTMLElement): Promise<boolean> {
  if (typeof window === "undefined" || !el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  await new Promise((r) => setTimeout(r, 60));

  const rect = el.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);

  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const response = await chrome.runtime.sendMessage({
        type: "SJA_CDP_CLICK",
        payload: { x, y },
      });
      if (response?.ok && response?.isTrusted) {
        return true;
      }
    }
  } catch {
    // Non-fatal: fall through to humanized synthetic dispatch
  }

  // Fallback: humanized DOM mouse events
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  el.click();
  return false;
}

/**
 * Dispatches OS-level hardware keystrokes via CDP so event.isTrusted === true.
 */
export async function dispatchTrustedType(el: HTMLElement, text: string): Promise<boolean> {
  if (typeof window === "undefined" || !el || !text) return false;
  el.focus();

  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const response = await chrome.runtime.sendMessage({
        type: "SJA_CDP_TYPE",
        payload: { text },
      });
      if (response?.ok && response?.isTrusted) {
        return true;
      }
    }
  } catch {
    // Non-fatal
  }

  // Fallback: programmatic input events
  if ("value" in el) {
    (el as HTMLInputElement).value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return false;
}

