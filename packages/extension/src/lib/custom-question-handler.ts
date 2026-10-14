/**
 * CustomQuestionHandler — Batch LLM handler for ATS custom questions.
 *
 * After the EntityProcessor fills all known fields from the ATS config,
 * many ATS forms have additional "custom questions" (screening questions,
 * EEO fields, etc.) that require LLM intelligence to answer.
 *
 * This module:
 * 1. Detects unfilled custom question elements on the page
 * 2. Extracts their labels, types, and options
 * 3. Batches them into a single LLM call for efficiency
 * 4. Fills the answers back into the DOM
 */

import type { LLMClient, Profile, DetectedField } from "@superjob/core";
import { answerQuestion, normalizeQuestion, classifyLabel } from "@superjob/core";
import {
  mimicInput,
  mimicClick,
  mimicCheckbox,
  mimicSelect,
  mimicSetValue,
} from "./mimic-user.js";
import { isElementVisible } from "./ats-adapter.js";
import { collectDeepRoots } from "./dom-deep-scan.js";
import { findSemanticAnswer, saveAnswer } from "./answer-memory.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CustomQuestionField {
  /** Unique identifier for the field. */
  mapId: string;
  /** The question/label text. */
  label: string;
  /** Field type: text, select, radio, checkbox, textarea. */
  type: string;
  /** Available options for select/radio fields. */
  options: { value: string; text: string }[];
  /** Whether the field is required. */
  required: boolean;
  /** The DOM element. */
  element: HTMLElement;
}

export interface CustomQuestionResult {
  filled: number;
  skipped: number;
  aiAnswered: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getLabel(el: HTMLElement): string {
  // 1. Explicit label[for]
  const id = el.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // 2. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((i) => document.getElementById(i)?.textContent)
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }

  // 3. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // 4. Parent label
  const parentLabel = el.closest("label");
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  // 5. Preceding legend (for fieldsets)
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend?.textContent?.trim()) return legend.textContent.trim();
  }

  // 6. Preceding sibling or parent with label-like class
  const parent = el.closest("[class*='question'], [class*='field'], [class*='form-group']");
  if (parent) {
    const labelEl = parent.querySelector("label, .label, h2, h3, h4, [class*='label'], [class*='title']");
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
  }

  // 7. Placeholder
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.placeholder) return el.placeholder;
  }

  // 8. Name attribute as last resort
  const name = el.getAttribute("name");
  if (name) {
    return name
      .replace(/[_\[\]]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();
  }

  return "";
}

function getFieldType(el: HTMLElement): string {
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "radio") return "radio";
    if (type === "checkbox") return "checkbox";
    if (type === "file") return "file";
    if (type === "date") return "date";
    return "text";
  }
  if (el.getAttribute("role") === "combobox") return "combobox";
  if (el.getAttribute("role") === "listbox") return "select";
  if (el.getAttribute("contenteditable") === "true") return "textarea";
  return "text";
}

function getFieldOptions(el: HTMLElement): { value: string; text: string }[] {
  // Native select
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options)
      .filter((o) => o.value && o.value !== "" && !o.disabled)
      .map((o) => ({ value: o.value, text: o.textContent?.trim() ?? o.value }));
  }

  // Radio group
  if (el instanceof HTMLInputElement && el.type === "radio") {
    const name = el.name;
    if (!name) return [];
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(name)}"]`));
    return radios.map((r) => {
      const label = getLabel(r);
      return { value: r.value, text: label || r.value };
    });
  }

  // ARIA listbox/combobox
  const parent = el.closest("[role='listbox'], [class*='dropdown'], [class*='select']");
  if (parent) {
    const options = Array.from(parent.querySelectorAll("[role='option'], li, option"));
    return options
      .filter((o) => o.textContent?.trim())
      .map((o) => ({
        value: (o as HTMLElement).getAttribute("data-value") ?? o.textContent!.trim(),
        text: o.textContent!.trim(),
      }))
      .slice(0, 50); // Cap to prevent huge payloads
  }

  return [];
}

function isFieldEmpty(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") return !el.checked;
    return !el.value?.trim();
  }
  if (el instanceof HTMLTextAreaElement) return !el.value?.trim();
  if (el instanceof HTMLSelectElement) {
    const val = el.value;
    return !val || val === "" || el.selectedIndex <= 0;
  }
  if (el.getAttribute("contenteditable") === "true") return !el.textContent?.trim();
  return true;
}

function isRequired(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.required) return true;
  }
  if (el.getAttribute("aria-required") === "true") return true;

  // Check for required indicator in label
  const label = getLabel(el);
  if (label.includes("*")) return true;

  // Check for required class/indicator on parent
  const parent = el.closest("[class*='question'], [class*='field'], [class*='form-group']");
  if (parent) {
    const reqIndicator = parent.querySelector("[class*='required'], .asterisk, abbr[title*='required']");
    if (reqIndicator) return true;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Main API                                                            */
/* ------------------------------------------------------------------ */

/**
 * Retrieve all unfilled custom question elements from the page.
 */
export function retrieveCustomQuestionElements(
  filledIds: Set<string>,
  customSelectors?: { question?: string }
): HTMLElement[] {
  // Use ATS-specific selectors if available, otherwise use generic
  const selectorStr =
    customSelectors?.question ??
    "input:not([type='hidden']):not([type='file']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), " +
    "textarea, select, " +
    "[contenteditable='true'], " +
    "[role='combobox'], [role='textbox'], [role='listbox']";

  const roots = collectDeepRoots();
  const elements: HTMLElement[] = [];
  for (const root of roots) {
    try {
      const elList = Array.from((root as any).querySelectorAll(selectorStr)) as HTMLElement[];
      elements.push(...elList);
    } catch {
      // Ignore querySelector exceptions for custom rules
    }
  }

  return elements.filter((el) => {
    // Skip hidden elements
    if (!isElementVisible(el)) return false;
    // Skip disabled
    if ((el as HTMLInputElement).disabled) return false;
    // Skip readonly
    if ((el as HTMLInputElement).readOnly) return false;
    // Skip already filled
    if (el.id && filledIds.has(el.id)) return false;
    // Skip if not empty
    if (!isFieldEmpty(el)) return false;
    // Skip our own UI
    if (el.closest("#sja-persistent-docked-panel-container")) return false;

    return true;
  });
}

/**
 * Extract structured field information from DOM elements.
 */
export function extractCustomQuestionFields(elements: HTMLElement[]): CustomQuestionField[] {
  const fields: CustomQuestionField[] = [];
  const seenLabels = new Set<string>();

  for (const el of elements) {
    const label = getLabel(el);
    if (!label || label.length < 2) continue;

    // Deduplicate by label (radio groups have multiple elements)
    const normalizedLabel = normalizeQuestion(label);
    if (seenLabels.has(normalizedLabel)) continue;
    seenLabels.add(normalizedLabel);

    const mapId = el.id || `cq_${Math.random().toString(36).slice(2, 8)}`;
    if (!el.id) el.id = mapId; // Set an ID for later retrieval

    fields.push({
      mapId,
      label,
      type: getFieldType(el),
      options: getFieldOptions(el),
      required: isRequired(el),
      element: el,
    });
  }

  return fields;
}

/**
 * Answer custom questions using the LLM and fill them.
 * 
 * Enhanced with:
 * - Batch LLM calls for efficiency (fewer API calls, lower cost)
 * - Learning from past answers (reuses previous answers for same questions)
 * - Per-field fallback if batch fails
 */
export async function fillCustomQuestions(
  fields: CustomQuestionField[],
  profile: Profile,
  llm: LLMClient,
  filledIds: Set<string>
): Promise<CustomQuestionResult> {
  let filled = 0;
  let skipped = 0;
  let aiAnswered = 0;

  // Load past answers for learning
  const pastAnswers = await loadPastAnswers();

  // Separate fields into: can-use-past-answer vs needs-LLM
  const needsLLM: CustomQuestionField[] = [];
  const pastAnswerMap = new Map<string, string>();

  for (const field of fields) {
    const normalizedLabel = normalizeQuestion(field.label);
    let pastAnswer = pastAnswers.get(normalizedLabel);

    if (!pastAnswer) {
      // Mind2Web / AgentGym Hybrid Semantic Matching fallback
      try {
        const semantic = await findSemanticAnswer(field.label, 0.65);
        if (semantic?.answer.answer) {
          pastAnswer = semantic.answer.answer;
        }
      } catch {}
    }
    
    if (pastAnswer && canReuseAnswer(field, pastAnswer)) {
      pastAnswerMap.set(field.mapId, pastAnswer);
    } else {
      needsLLM.push(field);
    }
  }

  // Fill fields with past answers first (instant, no LLM cost)
  for (const field of fields) {
    const pastAnswer = pastAnswerMap.get(field.mapId);
    if (pastAnswer) {
      try {
        const fillResult = await fillCustomField(field, pastAnswer);
        if (fillResult) {
          filled++;
          filledIds.add(field.mapId);
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
  }

  // Batch LLM call for remaining fields
  if (needsLLM.length > 0) {
    try {
      const batchAnswers = await batchAnswerQuestions(needsLLM, profile, llm);
      
      for (let i = 0; i < needsLLM.length; i++) {
        const field = needsLLM[i];
        const answer = batchAnswers[i];
        
        if (!answer || answer.trim().length === 0) {
          skipped++;
          continue;
        }

        const fillResult = await fillCustomField(field, answer);
        if (fillResult) {
          filled++;
          aiAnswered++;
          filledIds.add(field.mapId);
          // Save answer for future reuse (both local cache and unified semantic answer memory)
          await savePastAnswer(normalizeQuestion(field.label), answer);
          try {
            await saveAnswer({
              question: field.label,
              answer,
              jobTitle: document.title || undefined,
            });
          } catch {}
        } else {
          skipped++;
        }
        
        await sleep(50);
      }
    } catch (err) {
      console.error("[CustomQuestionHandler] Batch LLM failed, falling back to per-field:", err);
      // Fallback to per-field
      for (const field of needsLLM) {
        try {
          const detectedField: DetectedField = {
            id: field.mapId,
            confidence: 1.0,
            selector: `#${CSS.escape(field.mapId)}`,
            label: field.label,
            type: field.type as any,
            fieldKey: classifyLabel(field.label),
            options: field.options.map((o) => ({ value: o.value, label: o.text })),
          };

          const mappedOptions = field.options.map((o) => ({ value: o.value, label: o.text }));
          const answer = await answerQuestion(
            llm,
            field.label,
            profile.masterResumeText || "",
            mappedOptions,
            field.type
          );

          if (!answer || answer.trim().length === 0) {
            skipped++;
            continue;
          }

          const fillResult = await fillCustomField(field, answer);
          if (fillResult) {
            filled++;
            aiAnswered++;
            filledIds.add(field.mapId);
            await savePastAnswer(normalizeQuestion(field.label), answer);
            try {
              await saveAnswer({
                question: field.label,
                answer,
                jobTitle: document.title || undefined,
              });
            } catch {}
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
        await sleep(50);
      }
    }
  }

  return { filled, skipped, aiAnswered };
}

export interface BatchQuestionInput {
  label: string;
  type: string;
  options?: { text?: string; label?: string; value?: string }[];
}

export async function batchAnswerQuestions(
  fields: BatchQuestionInput[],
  profile: Profile,
  llm: LLMClient
): Promise<string[]> {
  const questions = fields.map((f) => ({
    label: f.label,
    type: f.type,
    options: (f.options ?? []).map((o) => o.text || o.label || o.value || "").filter(Boolean),
  }));

  const prompt = `Answer the following job application screening questions based on the Candidate Profile. Return a JSON array of answers in the exact same order.

Candidate Profile:
${profile.masterResumeText?.slice(0, 2500) || "No resume provided"}
${profile.skills?.length ? `Skills: ${profile.skills.join(", ")}` : ""}

Questions:
${questions.map((q, i) => `${i + 1}. [Type: ${q.type}] Label: "${q.label}"${q.options.length ? ` Options: ${q.options.join(", ")}` : ""}`).join("\n")}

Formatting Rules:
- Return ONLY a raw JSON array of strings: e.g., ["Answer 1", "Answer 2"]
- Do not write any explanatory text before or after the JSON array.
- For [Type: select] or [Type: radio] fields, choose the option that fits the profile best. You MUST output the option exactly as written.
- For [Type: checkbox] fields, use one of "Yes", "No", "true", "false".
- For [Type: text] or [Type: textarea], provide a short, professional, direct answer.`;

  try {
    const response = await llm.complete([{ role: "user", content: prompt }]);
    const trimmed = response.trim();
    
    // 1. Try direct parse
    try {
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    } catch {}

    // 2. Strip markdown fences and parse
    try {
      const clean = trimmed.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      if (clean.startsWith("[") && clean.endsWith("]")) {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    } catch {}

    // 3. Regex lookup for JSON array block
    try {
      const match = trimmed.match(/\[\s*[\s\S]*?\s*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    } catch {}

  } catch (err) {
    console.error("[CustomQuestionHandler] Failed to parse batch answers:", err);
  }
  return new Array(fields.length).fill("");
}

/**
 * Check if a past answer can be reused for this field.
 */
function canReuseAnswer(field: CustomQuestionField, answer: string): boolean {
  if (!answer || answer.trim().length === 0) return false;
  // For select/radio fields, verify the answer is still a valid option
  if ((field.type === "select" || field.type === "radio") && field.options.length > 0) {
    const lowerAnswer = answer.toLowerCase().trim();
    return field.options.some(
      (o) => o.text.toLowerCase().trim() === lowerAnswer ||
             o.value.toLowerCase().trim() === lowerAnswer ||
             o.text.toLowerCase().includes(lowerAnswer) ||
             lowerAnswer.includes(o.text.toLowerCase())
    );
  }
  return true;
}

/**
 * Load past answers from chrome storage for learning.
 */
async function loadPastAnswers(): Promise<Map<string, string>> {
  try {
    const stored = await chrome.storage.local.get("sja-custom-question-answers") as Record<string, unknown>;
    const answers = (stored["sja-custom-question-answers"] as Record<string, string> | undefined) ?? {};
    return new Map(Object.entries(answers));
  } catch {
    return new Map();
  }
}

/**
 * Save an answer for future reuse.
 */
async function savePastAnswer(normalizedQuestion: string, answer: string): Promise<void> {
  try {
    const stored = await chrome.storage.local.get("sja-custom-question-answers") as Record<string, unknown>;
    const answers: Record<string, string> = (stored["sja-custom-question-answers"] as Record<string, string> | undefined) ?? {};
    answers[normalizedQuestion] = answer;
    // Keep only last 200 answers to prevent unbounded growth
    const keys = Object.keys(answers);
    if (keys.length > 200) {
      for (const key of keys.slice(0, keys.length - 200)) {
        delete answers[key];
      }
    }
    await chrome.storage.local.set({ "sja-custom-question-answers": answers });
  } catch {}
}

/**
 * Fill a single custom question field with an answer.
 */
async function fillCustomField(field: CustomQuestionField, answer: string): Promise<boolean> {
  const el = field.element;
  if (!el || !isElementVisible(el)) return false;

  switch (field.type) {
    case "text":
    case "textarea":
    case "date": {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        await mimicInput(el, answer);
        return true;
      }
      if (el.getAttribute("contenteditable") === "true") {
        el.textContent = answer;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }

    case "select": {
      if (el instanceof HTMLSelectElement) {
        return mimicSelect(el, answer);
      }
      return false;
    }

    case "radio": {
      const name = (el as HTMLInputElement).name;
      if (!name) return false;
      const radios = Array.from(
        document.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(name)}"]`)
      );
      const lowerAnswer = answer.toLowerCase().trim();

      // Find matching radio
      for (const radio of radios) {
        const radioLabel = getLabel(radio).toLowerCase().trim();
        const radioValue = radio.value.toLowerCase().trim();
        if (
          radioLabel === lowerAnswer ||
          radioValue === lowerAnswer ||
          radioLabel.includes(lowerAnswer) ||
          lowerAnswer.includes(radioLabel)
        ) {
          await mimicClick(radio);
          return true;
        }
      }

      // Yes/No shorthand
      if (/^(yes|true|1|agree|accept)$/i.test(answer)) {
        const yesRadio = radios.find((r) => /yes|true|agree|accept/i.test(r.value) || /yes|true|agree|accept/i.test(getLabel(r)));
        if (yesRadio) {
          await mimicClick(yesRadio);
          return true;
        }
      }
      if (/^(no|false|0|decline|disagree)$/i.test(answer)) {
        const noRadio = radios.find((r) => /no|false|decline|disagree/i.test(r.value) || /no|false|decline|disagree/i.test(getLabel(r)));
        if (noRadio) {
          await mimicClick(noRadio);
          return true;
        }
      }

      return false;
    }

    case "checkbox": {
      const shouldCheck = /^(yes|true|1|checked|agree|accept)$/i.test(answer);
      const checkbox = el as HTMLInputElement;
      if (shouldCheck && !checkbox.checked) {
        await mimicCheckbox(checkbox);
        return true;
      }
      if (!shouldCheck && checkbox.checked) {
        await mimicCheckbox(checkbox);
        return true;
      }
      return true; // Already in correct state
    }

    case "combobox": {
      // Type the answer and wait for autocomplete
      if (el instanceof HTMLInputElement) {
        await mimicInput(el, answer);
        await sleep(500);
        // Try to click first matching option
        const container = el.closest("[class*='dropdown'], [class*='select'], [role='listbox']")
          ?? el.parentElement;
        if (container) {
          const option = container.querySelector("[role='option'], li");
          if (option && isElementVisible(option as HTMLElement)) {
            await mimicClick(option as HTMLElement);
          }
        }
        return true;
      }
      return false;
    }

    default:
      return false;
  }
}
