/**
 * Page-level form filler using Playwright.
 *
 * Runs in Node. For each detected field:
 *   1. classify the label via @superjob/core's classifyLabel
 *   2. resolve the value from the profile lookup
 *   3. fill using the right Playwright method per field type
 *
 * Playwright's locator.fill() already dispatches real input events, so it
 * works on React/Vue forms (Greenhouse, Lever, Workday) without any hacks.
 *
 * Unknown questions are answered via the LLM (grounded on the resume) and
 * cached so repeated questions are instant on subsequent applications.
 */
import type { Page, Locator } from "playwright";
import {
  answerQuestion,
  bestOptionMatch,
  classifyLabel,
  normalizeQuestion,
  decideFieldPolicy,
  shouldNeverCacheQuestion,
  hesitationPauseMs,
  inputModeForLength,
  keystrokeDelayMs,
  postKeystrokePauseMs,
  randomIntIn,
  type LLMClient,
  type Profile,
  type ProfileLookup,
} from "@superjob/core";
import type { ScannedField } from "./page-scan.js";
import { humanTiming } from "./human-timing.js";
import { mousePath } from "./mouse-path.js";

/** Smart fill order priority map (same as extension autofill) */
const FILL_PRIORITY: Record<string, number> = {
  resumeFile: 0, country: 10, phoneCountryCode: 11, workAuthorization: 12,
  requiresSponsorship: 13, state: 20, city: 30, location: 31,
  firstName: 40, lastName: 41, fullName: 42, email: 43, phone: 44,
  jobTitle: 50, workExperienceCompany: 51, yearsOfExperience: 52,
  school: 60, degree: 61, major: 62, graduationYear: 63, gpa: 64,
  linkedin: 70, github: 71, website: 72,
  currentCTC: 80, expectedCTC: 81, noticePeriod: 82, salaryExpectation: 83,
};


export interface FillOutcome {
  filled: number;
  skipped: number;
  details: { label: string; ok: boolean; value: string }[];
  aiAnswered: number;
}

export async function fillForm(
  page: Page,
  fields: ScannedField[],
  lookup: ProfileLookup,
  profile: Profile,
  llm: LLMClient,
  delayMs = 0
): Promise<FillOutcome> {
  let filled = 0;
  let skipped = 0;
  let aiAnswered = 0;
  const details: { label: string; ok: boolean; value: string }[] = [];

  // Smart fill ordering: dependencies first
  const ordered = [...fields].sort((a, b) => {
    const pa = FILL_PRIORITY[classifyLabel(a.label)] ?? 90;
    const pb = FILL_PRIORITY[classifyLabel(b.label)] ?? 90;
    return pa - pb;
  });

  for (const field of ordered) {
    // 1) classify + resolve
    const fieldKey = classifyLabel(field.label);
    let value: string | undefined;

    if (fieldKey !== "ai") {
      const direct = lookup[fieldKey];
      if (typeof direct === "string" && direct.trim()) value = direct.trim();
      else if (Array.isArray(direct)) value = direct.join(", ");
    }

    // 2) custom cached answer
    if (value === undefined) {
      const norm = normalizeQuestion(field.label);
      const cached = lookup[`custom:${norm}`];
      if (typeof cached === "string" && cached.trim()) value = cached.trim();
      else if (profile.customAnswers[norm]) value = profile.customAnswers[norm];
    }

    // 3) Policy gate before AI/default fallback. This prevents the headless
    // applier from guessing legal, EEO, credential, salary, or assessment answers.
    const policy = decideFieldPolicy(
      { label: field.label, fieldKey, type: field.type },
      lookup,
      { allowAutonomousFallback: true },
    );
    const canUseAiFallback =
      policy.action === "allow-ai" &&
      (policy.risk === "unknown" || policy.risk === "safe");
    if (
      policy.action === "skip" ||
      policy.action === "needs-user" ||
      (policy.action === "allow-ai" && !canUseAiFallback)
    ) {
      skipped++;
      details.push({ label: field.label, ok: false, value: `${policy.action}: ${policy.reason}` });
      continue;
    }

    // 4) AI fallback for unknown questions (not file uploads)
    if (value === undefined && field.type !== "file") {
      const norm = normalizeQuestion(field.label);
      if (llm.isAvailable()) {
        try {
          const aiAns = await answerQuestion(llm, field.label, profile.masterResumeText, field.options, field.type);
          if (aiAns && aiAns.trim()) {
            value = aiAns.trim();
            if (!shouldNeverCacheQuestion(field.label)) profile.customAnswers[norm] = aiAns.trim();
            aiAnswered++;
          }
        } catch (err) {
          details.push({
            label: field.label,
            ok: false,
            value: `AI answer failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 80),
          });
        }
      }
    }

    if (value === undefined) {
      skipped++;
      details.push({ label: field.label, ok: false, value: "no value" });
      continue;
    }

    // 4) fill based on type
    try {
      const ok = await fillOne(page, field, value, delayMs);
      if (ok) filled++;
      else skipped++;
      details.push({ label: field.label, ok, value: String(value).slice(0, 80) });
    } catch (e) {
      skipped++;
      details.push({
        label: field.label,
        ok: false,
        value: e instanceof Error ? e.message.slice(0, 80) : "error",
      });
    }
  }

  return { filled, skipped, details, aiAnswered };
}

async function fillOne(
  page: Page,
  field: ScannedField,
  value: string,
  delayMs: number
): Promise<boolean> {
  if (delayMs > 0) await sleep(delayMs);

  switch (field.type) {
    case "select":
      return fillSelect(page, field, value);
    case "radio":
      return fillRadio(page, field, value);
    case "checkbox":
      return fillCheckbox(page, field, value);
    case "file":
      return false; // handled separately (resume upload)
    default:
      return fillText(page, field, value);
  }
}

async function fillText(page: Page, field: ScannedField, value: string): Promise<boolean> {
  const loc = safeLocator(page, field.selector);
  if (!loc) return false;
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

  await mousePath.moveTo(page, field.selector).catch(() => {});
  await humanTiming.wait(humanTiming.fieldTransitionDelay(value.length > 50 ? 'complex' : 'simple'));

  await loc.focus({ timeout: 3000 }).catch(() => {});
  await loc.fill("").catch(() => {});

  // Human pacing governor (Adaptation 5 — @superjob/core human-pacing, ported
  // from MIT 10xProductivity and merged with SJA's Gaussian humanTiming).
  // Character-by-character input for short text, clipboard-style for long text
  // (graduated probability by length), with key-class micro-pauses after
  // punctuation/spaces and occasional mid-typing hesitation.
  const mode = inputModeForLength(value);
  if (mode === "paste") {
    await humanTiming.wait(randomIntIn(100, 320));
    await loc.fill(value, { timeout: 5000 });
    await humanTiming.wait(randomIntIn(50, 200));
  } else {
    for (const char of value) {
      if (char === "\r") continue;
      if (char === "\n") {
        await page.keyboard.press("Enter");
        continue;
      }
      await page.keyboard.type(char, {
        delay: keystrokeDelayMs({ minMs: 45, maxMs: 160 }),
      });
      const micro = postKeystrokePauseMs(char);
      if (micro > 0) await humanTiming.wait(micro);
      const hesitation = hesitationPauseMs();
      if (hesitation > 0) await humanTiming.wait(hesitation);
    }
  }

  await loc.blur({ timeout: 2000 }).catch(() => {});
  return (await loc.inputValue({ timeout: 3000 }).catch(() => "")) === value;
}

async function fillSelect(page: Page, field: ScannedField, value: string): Promise<boolean> {
  const loc = safeLocator(page, field.selector);
  if (!loc) return false;
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

  await mousePath.moveTo(page, field.selector).catch(() => {});
  await humanTiming.wait(humanTiming.fieldTransitionDelay('medium'));

  const match = pickOption(
    value,
    field.options,
    (o) => o.label,
    (o) => o.value
  );
  if (!match) {
    try {
      await loc.selectOption({ label: value }, { timeout: 4000 });
      return true;
    } catch {
      return false;
    }
  }
  await loc.selectOption(match.value, { timeout: 4000 });
  return true;
}

async function fillRadio(page: Page, field: ScannedField, value: string): Promise<boolean> {
  const match = pickOption(
    value,
    field.options,
    (o) => o.label,
    (o) => o.value
  );
  if (!match) return false;
  const selector = `${field.selector}[value="${cssAttrEscape(match.value)}"]`;
  const loc = page.locator(selector);
  if ((await loc.count()) === 0) return false;

  await mousePath.moveTo(page, selector).catch(() => {});
  await humanTiming.wait(humanTiming.clickDelay());
  await loc.first().check({ timeout: 4000 });
  return true;
}

async function fillCheckbox(page: Page, field: ScannedField, value: string): Promise<boolean> {
  const loc = safeLocator(page, field.selector);
  if (!loc) return false;
  const want = isYes(value);
  const isChecked = await loc.isChecked({ timeout: 3000 }).catch(() => false);
  if (isChecked !== want) {
    await mousePath.moveTo(page, field.selector).catch(() => {});
    await humanTiming.wait(humanTiming.clickDelay());
    if (want) await loc.check({ timeout: 4000 });
    else await loc.uncheck({ timeout: 4000 });
  }
  return true;
}

/* ----------------------- helpers ---------------------------- */

function safeLocator(page: Page, selector: string): Locator | null {
  try {
    const loc = page.locator(selector).first();
    return loc;
  } catch {
    return null;
  }
}

function pickOption<T>(
  value: string,
  items: T[],
  getLabel: (i: T) => string,
  getValue: (i: T) => string
): T | undefined {
  const v = value.toLowerCase().trim();
  const num = Number(v.replace(/[^0-9.]/g, ""));
  // exact value
  let best = items.find((i) => getValue(i).toLowerCase() === v);
  if (best) return best;
  // exact label
  best = items.find((i) => getLabel(i).toLowerCase() === v);
  if (best) return best;
  // substring
  best = items.find((i) => {
    const l = getLabel(i).toLowerCase();
    return l.includes(v) || v.includes(l);
  });
  if (best) return best;
  // fuzzy match (Levenshtein for typos in option labels)
  best = fuzzyPickOption(v, items, getLabel, getValue);
  if (best) return best;
  // numeric
  if (!Number.isNaN(num)) {
    best = items.find((i) => {
      const n = Number(getLabel(i).replace(/[^0-9.]/g, ""));
      return !Number.isNaN(n) && n === num;
    });
    if (best) return best;
  }
  // yes/no
  if (isYes(v) || isNo(v)) {
    best = items.find((i) => {
      const l = getLabel(i).toLowerCase();
      return isYes(v) ? isYes(l) : isNo(l);
    });
    if (best) return best;
  }

  // language proficiency (AutoApplyMax adaptation)
  const isLangQ = /proficiency|fluency|level\s+of\s+(english|french|spanish|german|hindi|language)|language\s+level/i.test(v) ||
    items.some((i) => /\b(native|fluent|bilingual|mothertongue)\b/i.test(getLabel(i)));
  if (isLangQ && items.length >= 2) {
    const nativeOpt = items.find((i) => /\b(native|bilingual|mothertongue|mother\s+tongue)\b/i.test(getLabel(i)));
    if (nativeOpt) return nativeOpt;
    const fluentOpt = items.find((i) => /\b(fluent|full\s+professional|professional\s+working)\b/i.test(getLabel(i)));
    if (fluentOpt) return fluentOpt;
    const advancedOpt = items.find((i) => /\b(professional|advanced|conversational|intermediate)\b/i.test(getLabel(i)));
    if (advancedOpt) return advancedOpt;
  }

  return best;
}

/** Fuzzy option matching: handles typos in dropdown options */
function fuzzyPickOption<T>(
  value: string,
  items: T[],
  getLabel: (i: T) => string,
  getValue: (i: T) => string
): T | undefined {
  if (value.length < 3 || value.length > 30) return undefined;

  // 1) Length-independent blended scoring (Jaro-Winkler + bigram + token;
  //    @superjob/core field-similarity, clean-room capability adaptation).
  //    Handles short, typo'd, or rephrased option text that raw edit distance
  //    mis-scores.
  let bestBlend: T | undefined;
  {
    const ranked = items
      .map((item) => {
        const label = getLabel(item);
        const val = getValue(item);
        const s = bestOptionMatch(value, [{ label, value: val }], 0);
        return { item, score: s.score };
      })
      .sort((a, b) => b.score - a.score);
    if (ranked[0] && ranked[0].score >= 0.72) bestBlend = ranked[0].item;
  }
  if (bestBlend) return bestBlend;

  // 2) Levenshtein fallback for near-identical strings the blend may still miss.
  let bestMatch: T | undefined;
  let bestDist = Infinity;
  for (const item of items) {
    const label = getLabel(item).toLowerCase().trim();
    const val = getValue(item).toLowerCase().trim();
    const dist = Math.min(levenshtein(value, label), levenshtein(value, val));
    const threshold = Math.max(1, Math.floor(Math.min(value.length, label.length) * 0.25));
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestMatch = item;
    }
  }
  return bestMatch;
}

/** Fast Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.max(m, n);
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

function cssAttrEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

export function isYes(v: string): boolean {
  return /^\s*(y|yes|true|1|authorized|eligible|full)\b/i.test(v);
}
export function isNo(v: string): boolean {
  return /^\s*(n|no|false|0|unauthorized|ineligible)\b/i.test(v);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Upload a resume file to a file input on the page. */
export async function uploadResume(page: Page, filePath: string): Promise<boolean> {
  const fileInputs = page.locator('input[type=file]');
  const count = await fileInputs.count();
  if (count === 0) return false;
  for (let i = 0; i < count; i++) {
    try {
      await fileInputs.nth(i).setInputFiles(filePath);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}
