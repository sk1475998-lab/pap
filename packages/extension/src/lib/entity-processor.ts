/**
 * EntityProcessor — Config-driven ATS form filler.
 *
 * This is the core engine that processes the `entities[]` array from
 * ATS configurations. Instead of generically detecting fields and guessing
 * values, it walks predefined entity tuples and fills each field using
 * precise XPaths and known user data.
 *
 * Architecture:
 *   ATS Config → entities[] → EntityProcessor → mimicUser → DOM
 *
 * Each entity tuple is: [fieldName, xpathsOrActions]
 *   - XPath array: find element → mimicInput(el, userData[fieldName])
 *   - Actions object: execute a sequence of actions (setValue, click, clickOption, etc.)
 *   - Data array descriptor: iterate sub-entities for education/experience/skills
 */

import type { AtsConfig } from "./ats-configs-data.js";
import type { Profile } from "@superjob/core";
import {
  mimicInput,
  mimicClick,
  mimicCheckbox,
  mimicSelect,
  mimicFileUpload,
  mimicSetValue,
  mimicPressEnter,
  type MimicInputOptions,
} from "./mimic-user.js";
import { getElementByXPath, getElementsByXPath, isElementVisible } from "./ats-adapter.js";
import { waitForNetworkIdle } from "./network-monitor.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EntityAction {
  path?: string[];
  method: string;
  defaultValue?: string;
  options?: Record<string, any>;
  key?: string;
}

export interface EntityProcessorResult {
  filledCount: number;
  skippedCount: number;
  errors: string[];
  filledFields: string[];
}

export type UserData = Record<string, any>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve a dotted path like "recentExperience.title" from userData. */
function resolvePath(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/** Format XPaths by substituting {variable} placeholders with userData values. */
function formatXPath(xpath: string, userData: UserData): string {
  return xpath.replace(/\{(\w+(?:\.\w+)*)}/g, (_, key) => {
    const val = resolvePath(userData, key);
    return val != null ? String(val) : "";
  });
}

/** Try each XPath in array, return first visible matching element. */
function findElementByXPaths(
  xpaths: string[],
  userData: UserData,
  container: Node = document
): HTMLElement | null {
  for (const xpath of xpaths) {
    const formatted = formatXPath(xpath, userData);
    const el = getElementByXPath(formatted, container);
    if (el && isElementVisible(el)) return el;
    if (el) return el; // Even if not visible, return it (some fields are hidden but fillable)
  }
  return null;
}

/** Wait for an element to appear via XPath with timeout. */
async function waitForElement(
  xpaths: string[],
  container: Node = document,
  timeoutMs = 3000
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const xpath of xpaths) {
      const el = getElementByXPath(xpath, container);
      if (el) return el;
    }
    await sleep(200);
  }
  return null;
}

/** Wait for an element to disappear. */
async function waitForElementToDisappear(
  xpaths: string[],
  container: Node = document,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let found = false;
    for (const xpath of xpaths) {
      const el = getElementByXPath(xpath, container);
      if (el && isElementVisible(el)) {
        found = true;
        break;
      }
    }
    if (!found) return;
    await sleep(200);
  }
}

/** Find a matching option in a dropdown/list by text similarity. */
function findMatchingOption(
  value: string,
  container: HTMLElement,
  optionSelector?: string
): HTMLElement | null {
  const selector = optionSelector ?? "[role='option'], li, option";
  const options = Array.from(container.querySelectorAll<HTMLElement>(selector));
  const lowerVal = value.toLowerCase().trim();

  // Exact match first
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() ?? "";
    if (text === lowerVal) return opt;
  }
  // Starts-with match
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() ?? "";
    if (text.startsWith(lowerVal) || lowerVal.startsWith(text)) return opt;
  }
  // Contains match
  for (const opt of options) {
    const text = opt.textContent?.trim().toLowerCase() ?? "";
    if (text.includes(lowerVal) || lowerVal.includes(text)) return opt;
  }
  return null;
}

/** Check if a value is empty or falsy. */
function isEmptyOrFalsy(value: any): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "boolean") return false; // booleans are valid
  return false;
}

/* ------------------------------------------------------------------ */
/* EntityProcessor class                                               */
/* ------------------------------------------------------------------ */

export class EntityProcessor {
  private filledFields = new Set<string>();
  private interactedFields = new Map<string, boolean>();
  private config: AtsConfig;
  private userData: UserData;
  private errors: string[] = [];
  private isStopped = false;

  constructor(config: AtsConfig, userData: UserData) {
    this.config = config;
    this.userData = userData;
  }

  /** Stop all processing. */
  stop(): void {
    this.isStopped = true;
  }

  /**
   * Process all entities defined in the ATS config.
   */
  async processAll(container: Node = document): Promise<EntityProcessorResult> {
    const entities = this.config.entities ?? [];
    let filledCount = 0;
    let skippedCount = 0;
    const filledFieldNames: string[] = [];

    for (const entity of entities) {
      if (this.isStopped) break;

      const [fieldName, definition] = entity as [string, any];

      // Skip if already filled
      if (this.interactedFields.get(fieldName)) {
        skippedCount++;
        continue;
      }

      try {
        const result = await this.processEntity(fieldName, definition, container);
        if (result) {
          filledCount++;
          filledFieldNames.push(fieldName);
          this.interactedFields.set(fieldName, true);
        } else {
          skippedCount++;
        }
      } catch (err) {
        const msg = `Error processing ${fieldName}: ${err instanceof Error ? err.message : String(err)}`;
        this.errors.push(msg);
        console.error(`[EntityProcessor] ${msg}`);
      }
    }

    return {
      filledCount,
      skippedCount,
      errors: this.errors,
      filledFields: filledFieldNames,
    };
  }

  /**
   * Process pre-apply entities (cookie consent, apply buttons, etc.)
   */
  async processPreApply(container: Node = document): Promise<number> {
    const preApply = this.config.preApply;
    if (!preApply?.entities?.length) return 0;

    let count = 0;
    for (const entity of preApply.entities) {
      if (this.isStopped) break;
      const [fieldName, definition] = entity as [string, any];
      try {
        const result = await this.processEntity(fieldName, definition, container);
        if (result) count++;
      } catch {
        /* pre-apply errors are non-critical */
      }
    }
    return count;
  }

  /**
   * Process a single entity tuple.
   */
  private async processEntity(
    fieldName: string,
    definition: any,
    container: Node
  ): Promise<boolean> {
    if (this.isStopped) return false;

    const prefillValue = this.getPrefillValue(fieldName);

    // Case 1: XPath array (simple text input)
    if (Array.isArray(definition) && definition.length > 0 && typeof definition[0] === "string") {
      return this.processTextInput(fieldName, definition, container);
    }

    // Case 2: Actions object
    if (definition?.actions) {
      return this.processActionsArray(fieldName, definition.actions, container);
    }

    // Case 3: Array of action objects
    if (Array.isArray(definition) && definition.length > 0 && definition[0]?.actions) {
      let filled = false;
      for (const part of definition) {
        if (part.actions) {
          const result = await this.processActionsArray(fieldName, part.actions, container);
          if (result) filled = true;
        }
      }
      return filled;
    }

    // Case 4: Data array (education, experience, skills)
    if (definition?.entities && definition?.addButtonPath !== undefined) {
      return this.processDataArray(fieldName, definition, container);
    }

    // Case 5: Empty array or object — field not defined for this ATS
    if (
      (Array.isArray(definition) && definition.length === 0) ||
      (typeof definition === "object" && definition !== null && Object.keys(definition).length === 0)
    ) {
      return false;
    }

    return false;
  }

  /**
   * Process a simple text input field using XPaths.
   */
  private async processTextInput(
    fieldName: string,
    xpaths: string[],
    container: Node
  ): Promise<boolean> {
    const value = this.getPrefillValue(fieldName);
    if (isEmptyOrFalsy(value)) return false;

    const el = findElementByXPaths(xpaths, this.userData, container);
    if (!el) return false;

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      // Skip if already has correct value
      if (el.value && el.value === String(value)) return true;
      // Skip if has a value and we shouldn't overwrite
      if (el.value && el.value.trim().length > 0) return true;

      await mimicInput(el, String(value));
      this.filledFields.add(fieldName);
      return true;
    }

    if (el instanceof HTMLSelectElement) {
      const matched = await mimicSelect(el, String(value));
      if (matched) this.filledFields.add(fieldName);
      return matched;
    }

    if (el.getAttribute("type") === "checkbox") {
      await mimicCheckbox(el as HTMLInputElement);
      this.filledFields.add(fieldName);
      return true;
    }

    return false;
  }

  /**
   * Execute a sequence of actions for a field.
   */
  private async processActionsArray(
    fieldName: string,
    actions: EntityAction[],
    container: Node
  ): Promise<boolean> {
    let filled = false;

    for (const action of actions) {
      if (this.isStopped) break;

      const result = await this.processAction(fieldName, action, container);
      if (result) filled = true;
    }

    if (filled) {
      this.filledFields.add(fieldName);
      this.interactedFields.set(fieldName, true);
    }

    return filled;
  }

  /**
   * Execute a single action.
   */
  private async processAction(
    fieldName: string,
    action: EntityAction,
    container: Node
  ): Promise<boolean> {
    const { method, path, defaultValue, options } = action;
    const value = defaultValue ?? this.getPrefillValue(fieldName);

    if (!path?.length && method !== "click" && !action.key) return false;

    // Resolve element
    let el: HTMLElement | null = null;
    if (path?.length) {
      el = findElementByXPaths(path, this.userData, container);
    } else if (action.key) {
      // Resolve from config path like "canJobBeAppliedXPaths.applyButton"
      const configPath = resolvePath(this.config as any, action.key);
      if (Array.isArray(configPath)) {
        el = findElementByXPaths(configPath, this.userData, container);
      }
    }

    switch (method) {
      case "type":
      case "getCounty":
      case "setValue": {
        if (!el || isEmptyOrFalsy(value)) return false;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (el.value && el.value.trim().length > 0 && !options?.ignoreExistingValue) return true;
          const mimicOpts: MimicInputOptions = {
            triggerBlurEvent: options?.triggerBlurEvent ?? true,
            triggerKeyDownEvent: options?.triggerKeyDownEvent ?? true,
          };
          await mimicInput(el, String(value), mimicOpts);
          if (options?.waitForNetworkAfterInteraction) {
            await waitForNetworkIdle({ timeout: 5000, quietPeriod: 300 });
          }
          return true;
        }
        if (el instanceof HTMLSelectElement) {
          return mimicSelect(el, String(value));
        }
        return false;
      }

      case "click": {
        if (!el) return false;
        await mimicClick(el);
        if (options?.waitForNetworkAfterInteraction) {
          await waitForNetworkIdle({ timeout: 5000, quietPeriod: 300 });
        }
        return true;
      }

      case "clickOptionWithMultiAnswers":
      case "clickOption":
      case "clickOptionAsync": {
        if (!el) return false;
        const optMatch = findMatchingOption(String(value), el);
        if (optMatch) {
          await mimicClick(optMatch);
          if (options?.waitForNetworkBeforeInteraction) {
            await waitForNetworkIdle({ timeout: 3000 });
          }
          return true;
        }
        return false;
      }

      case "clickCheckbox":
      case "clickMultipleCheckboxes": {
        if (!el) return false;
        const checkboxContext = [
          fieldName,
          el.getAttribute("name") ?? "",
          el.getAttribute("id") ?? "",
          el.getAttribute("aria-label") ?? "",
          el.closest("label")?.textContent ?? "",
          el.parentElement?.textContent?.slice(0, 300) ?? "",
        ].join(" ");
        if (/\b(consent|agree|agreement|terms|privacy|authorize|authorization|certif(?:y|ication)|declare|declaration|sms|marketing|opt[ -]?in)\b/i.test(checkboxContext)) {
          return false;
        }
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          const wantsChecked = !/^(false|no|off|0|unchecked)$/i.test(String(value).trim());
          if (el.checked !== wantsChecked) await mimicClick(el);
          return true;
        }
        if (/\b(consent|agree|agreement|terms|privacy|authorize|authorization|certif(?:y|ication)|declare|declaration|sms|marketing|opt[ -]?in)\b/i.test(checkboxContext)) {
          return false;
        }
        await mimicClick(el);
        return true;
      }

      case "uploadResume":
      case "uploadMultipleResumes": {
        if (!el || !(el instanceof HTMLInputElement) || el.type !== "file") return false;
        this.filledFields.add(fieldName);
        return true;
      }

      case "pressEnterKey": {
        if (!el) return false;
        await mimicPressEnter(el);
        return true;
      }

      case "pressEscapeKey": {
        if (!el) return false;
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
        return true;
      }

      case undefined:
      case null:
      case "": {
        if (!el) return false;
        const tagName = el.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") {
          if (isEmptyOrFalsy(value)) return false;
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.value && el.value.trim().length > 0 && !options?.ignoreExistingValue) return true;
            await mimicInput(el, String(value));
            return true;
          }
          if (el instanceof HTMLSelectElement) {
            return mimicSelect(el, String(value));
          }
        } else {
          await mimicClick(el);
          return true;
        }
        return false;
      }

      default:
        console.warn(`[EntityProcessor] Unknown action method: ${method}`);
        // Smart fallback to setValue/click based on element type
        if (!el) return false;
        const tagName = el.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") {
          if (isEmptyOrFalsy(value)) return false;
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            await mimicInput(el, String(value));
            return true;
          }
          if (el instanceof HTMLSelectElement) {
            return mimicSelect(el, String(value));
          }
        } else {
          await mimicClick(el);
          return true;
        }
        return false;
    }
  }

  /**
   * Process a data array entity (education, experience, skills, certifications).
   */
  private async processDataArray(
    fieldName: string,
    definition: any,
    container: Node
  ): Promise<boolean> {
    const data = this.userData[fieldName];
    if (!data || !Array.isArray(data) || data.length === 0) return false;

    const { entities: subEntities, addButtonPath, containerPath } = definition;
    if (!subEntities?.length) return false;

    let filled = false;
    const maxEntries = Math.min(data.length, 10); // Limit to 10 entries to avoid infinite loops

    for (let i = 0; i < maxEntries; i++) {
      const entry = data[i];
      let itemContainer: Node = container;

      // If containerPath is provided, look for the specific container for this index
      if (containerPath && Array.isArray(containerPath)) {
        const containers = getElementsByXPath(formatXPath(containerPath[0], this.userData), container);
        if (containers && containers[i]) {
          itemContainer = containers[i];
        }
      }

      let entryFilled = false;
      for (const [subFieldName, subDefinition] of subEntities) {
        const subValue = entry?.[subFieldName];
        if (isEmptyOrFalsy(subValue)) continue;

        // Temporarily set the sub-value in userData for XPath resolution
        const tempKey = `${fieldName}.${subFieldName}`;
        const originalUserData = { ...this.userData };
        this.userData[subFieldName] = subValue;

        try {
          if (Array.isArray(subDefinition) && subDefinition.length > 0 && typeof subDefinition[0] === "string") {
            const result = await this.processTextInput(subFieldName, subDefinition, itemContainer);
            if (result) entryFilled = true;
          } else if (subDefinition?.actions) {
            const result = await this.processActionsArray(subFieldName, subDefinition.actions, itemContainer);
            if (result) entryFilled = true;
          }
        } finally {
          // Restore original user data values
          if (!(subFieldName in originalUserData)) {
            delete this.userData[subFieldName];
          } else {
            this.userData[subFieldName] = originalUserData[subFieldName];
          }
        }
      }

      if (entryFilled) filled = true;

      // Click the "Add" button if we have more entries left
      if (i < maxEntries - 1 && addButtonPath && Array.isArray(addButtonPath)) {
        const addBtn = findElementByXPaths(addButtonPath, this.userData, container);
        if (addBtn) {
          await mimicClick(addBtn);
          await sleep(1000); // Wait for transition/re-render
        }
      }
    }

    if (filled) this.filledFields.add(fieldName);
    return filled;
  }

  /**
   * Get the prefill value for a field from userData.
   */
  private getPrefillValue(fieldName: string): any {
    if (fieldName.includes(".")) {
      return resolvePath(this.userData, fieldName);
    }
    return this.userData[fieldName] ?? "";
  }

  /**
   * Get the set of all filled field names.
   */
  getFilledFields(): Set<string> {
    return new Set(this.filledFields);
  }

  /**
   * Check if a specific field has been filled.
   */
  isFieldFilled(fieldName: string): boolean {
    return this.filledFields.has(fieldName) || this.interactedFields.has(fieldName);
  }
}

/* ------------------------------------------------------------------ */
/* Factory function                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build UserData from a Profile for entity processing.
 */
export function profileToUserData(profile: Profile): UserData {
  const ed = (profile as any).education?.[0] ?? {};
  const exp = (profile as any).experience?.[0] ?? {};

  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    fullName: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    addressLine1: (profile as any).address ?? "",
    city: (profile as any).city ?? "",
    state: (profile as any).state ?? "",
    stateName: (profile as any).state ?? "",
    postalCode: (profile as any).zipCode ?? "",
    country: (profile as any).country ?? "United States",
    cityState: (profile as any).city && (profile as any).state
      ? `${(profile as any).city}, ${(profile as any).state}`
      : "",
    cityStateName: (profile as any).city && (profile as any).state
      ? `${(profile as any).city}, ${(profile as any).state}`
      : "",
    linkedinUrl: (profile as any).linkedinUrl ?? "",
    websiteUrl: (profile as any).websiteUrl ?? "",
    portfolioUrl: (profile as any).portfolioUrl ?? "",
    githubUrl: (profile as any).githubUrl ?? "",

    // Recent experience
    "recentExperience.title": exp.title ?? "",
    "recentExperience.companyName": exp.company ?? "",
    recentExperience: {
      title: exp.title ?? "",
      companyName: exp.company ?? "",
    },

    // Education & Experience & Projects
    education: (profile as any).education ?? [],
    experience: (profile as any).experience ?? [],
    projects: profile.projects ?? [],
    certifications: (profile as any).certifications ?? [],
    skill: profile.skills ?? [],
    skills: profile.skills ?? [],
    languages: (profile as any).languages ?? [],

    // Answer source — our extension name
    answerSource: "Job Search",

    // Consent / agreements
    privacyAgreement: true,
    consent: true,
  };
}
