/**
 * Autofill Engine
 * Handles form field detection, value mapping, and DOM manipulation.
 * Works in conjunction with ATS configs to fill application forms.
 *
 * Architecture features:
 * - Robust TaskQueue and ProgressTracker event dispatch sequence
 * - Shadow DOM scanning and multi-strategy label detection
 * - Native address autocomplete integration pattern
 */
import type { ATSConfig, FieldMapping, FieldType } from "./schemas.js";
import { findElement } from "./detector.js";

// ─── Errors ────────────────────────────────────────────────────────

/** Thrown when autofill pipeline fails */
export class FillError extends Error {
  constructor(message = "Fill failed") {
    super(message);
    this.name = "FillError";
  }
}

/** Thrown when a field value cannot be resolved */
export class ValueError extends Error {
  constructor(message = "Value error") {
    super(message);
    this.name = "ValueError";
  }
}

/** Thrown to cancel an in-progress autofill run */
export class CancelledError extends Error {
  constructor() {
    super("Autofill cancelled");
    this.name = "CancelledError";
  }
}

/** Thrown to skip a field (e.g. missing profile data) */
export class SkippedError extends Error {
  constructor(label: string) {
    super(`Skipped: ${label}`);
    this.name = "SkippedError";
  }
}

// ─── Task Queue ───────────────────────────────────────────────────

export type TaskQueueStatus = "idle" | "running" | "paused";

/**
 * Async task queue with pause/resume/cancel support.
 */
export class TaskQueue {
  private queue: Array<() => Promise<void>> = [];
  private status: TaskQueueStatus = "idle";
  private cancelled = false;
  private pausedError: Error | null = null;

  add(task: () => Promise<void>): void {
    this.queue.push(task);
  }

  async run(): Promise<void> {
    if (this.status !== "idle") throw new Error(`Queue already started (status: ${this.status})`);
    await this.drain();
  }

  pause(): void {
    this.status = "paused";
  }

  async resume(): Promise<void> {
    if (this.status !== "paused") throw new Error("Cannot resume: not paused");
    this.pausedError = null;
    await this.drain();
  }

  cancel(): void {
    this.cancelled = true;
    this.queue = [];
  }

  private async drain(): Promise<void> {
    this.status = "running";
    try {
      // Use iterative loop instead of recursion to prevent stack overflow
      while (this.queue.length > 0) {
        // Status can change externally via pause() during await
        if ((this.status as TaskQueueStatus) === "paused") {
          this.pausedError = new Error("Queue paused");
          throw this.pausedError;
        }
        if (this.cancelled) throw new CancelledError();

        const task = this.queue.shift()!;
        try {
          await task();
        } catch (e) {
          if (e instanceof CancelledError) throw e;
          console.error("[TaskQueue] task failed:", e);
        }
        if (this.cancelled) throw new CancelledError();
      }
      if (this.cancelled) throw new CancelledError();
    } finally {
      if (this.status === "running") this.status = "idle";
    }
  }

  get length(): number {
    return this.queue.length;
  }

  get isRunning(): boolean {
    return this.status === "running";
  }
}

// ─── Progress Tracker ─────────────────────────────────────────────

export interface FieldRequiredStatus {
  label: string;
  required: boolean | null;
}

export interface FillProgress {
  filledFields: string[];
  missingFields: string[];
  currentField: string | null;
  fieldRequiredStatus: FieldRequiredStatus[];
}

/**
 * Real-time progress tracker for autofill operations with deduplication.
 */
export class ProgressTracker {
  private state: FillProgress = {
    filledFields: [],
    missingFields: [],
    currentField: null,
    fieldRequiredStatus: [],
  };
  private onUpdate?: (progress: FillProgress) => void;

  constructor(onUpdate?: (progress: FillProgress) => void) {
    this.onUpdate = onUpdate;
  }

  setCurrentField(label: string | null): void {
    this.state.currentField = label ? formatLabel(label) : null;
    this.emit();
  }

  updateFilled(label: string): void {
    const formatted = formatLabel(label);
    this.state.missingFields = this.state.missingFields.filter(
      (f) => normalizeLabel(f) !== normalizeLabel(formatted)
    );
    if (!this.state.filledFields.includes(formatted)) {
      this.state.filledFields.push(formatted);
    }
    this.emit();
  }

  updateMissed(label: string): void {
    const formatted = formatLabel(label);
    this.state.filledFields = this.state.filledFields.filter(
      (f) => normalizeLabel(f) !== normalizeLabel(formatted)
    );
    if (!this.state.missingFields.includes(formatted)) {
      this.state.missingFields.push(formatted);
    }
    this.emit();
  }

  setRequiredStatus(statuses: FieldRequiredStatus[]): void {
    this.state.fieldRequiredStatus = this.dedupeRequired(statuses);
    this.emit();
  }

  clear(): void {
    this.state = {
      filledFields: [],
      missingFields: [],
      currentField: null,
      fieldRequiredStatus: [],
    };
  }

  generateFinal(): FillProgress {
    return {
      filledFields: [...this.state.filledFields],
      missingFields: [...this.state.missingFields],
      currentField: null,
      fieldRequiredStatus: this.state.fieldRequiredStatus.map((s) => ({
        label: s.label,
        required: s.required,
      })),
    };
  }

  private dedupeRequired(statuses: FieldRequiredStatus[]): FieldRequiredStatus[] {
    const seen = new Map<string, FieldRequiredStatus>();
    const result: FieldRequiredStatus[] = [];
    for (const s of statuses) {
      const key = normalizeLabel(s.label);
      if (!key) {
        result.push(s);
        continue;
      }
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, s);
        result.push(s);
      } else {
        const merged: FieldRequiredStatus = {
          label: existing.label || s.label,
          required:
            existing.required === true || s.required === true
              ? true
              : existing.required === false && s.required === false
                ? false
                : null,
        };
        const idx = result.indexOf(existing);
        if (idx >= 0) result[idx] = merged;
        seen.set(key, merged);
      }
    }
    return result;
  }

  private emit(): void {
    this.onUpdate?.({ ...this.state });
  }
}

// ─── Label Utilities ──────────────────────────────────────────────

/** Remove special characters for comparison */
function removeSpecialChars(s: string): string {
  return s.replace(/[^a-zA-Z0-9\s]/g, "");
}

/** Normalize a field label for display */
function formatLabel(label: string): string {
  return label
    .replace(/[\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[✱*]/g, "")
    .trim();
}

/** Normalize a field label for comparison */
function normalizeLabel(label: string): string {
  return removeSpecialChars(label)
    .replace(/\s*\*\s*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Check if two labels match (normalized comparison).
 */
export function isMatched(a: string, b: string): boolean {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return false;
  return normalizeLabel(a) === normalizeLabel(b);
}

// ─── DOM Utilities ────────────────────────────────────────────────

/**
 * Trigger a full sequence of DOM events to notify all frameworks (React, Vue, Angular, jQuery).
 */
export function triggerFullEventSequence(
  el: HTMLElement,
  events?: string[]
): void {
  const defaultEvents = [
    "focus",
    "mousedown",
    "mouseup",
    "input",
    "change",
    "blur",
  ];
  const eventList = events ?? defaultEvents;

  for (const eventName of eventList) {
    let event: Event;
    if (["mousedown", "mouseup", "click"].includes(eventName)) {
      event = new MouseEvent(eventName, { bubbles: true, cancelable: true });
    } else if (["focus", "blur"].includes(eventName)) {
      event = new FocusEvent(eventName, { bubbles: true, cancelable: true });
    } else if (eventName === "input") {
      event = new InputEvent(eventName, {
        bubbles: true,
        cancelable: true,
        data:
          el instanceof HTMLInputElement && typeof el.value === "string"
            ? el.value
            : null,
        inputType: "insertText",
      });
    } else {
      event = new Event(eventName, { bubbles: true, cancelable: true });
    }
    el.dispatchEvent(event);
  }
}

/**
 * Set input value using native setter (bypasses React/Vue wrappers).
 * Critical for React 16+ which uses Object.defineProperty on value.
 */
export function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

// ─── Types ─────────────────────────────────────────────────────────

/** Autofill result for a single field */
export interface FillResult {
  canonicalName: string;
  label: string;
  success: boolean;
  value?: string;
  error?: string;
  skipped?: boolean;
}

/** Autofill options */
export interface AutofillOptions {
  /** User profile data for filling */
  profile: Record<string, unknown>;
  /** Whether to fill optional fields */
  fillOptional?: boolean;
  /** Whether to use AI for unknown answers */
  enableAI?: boolean;
  /** Dry run mode - detect but don't fill */
  dryRun?: boolean;
  /** Callback for each field filled */
  onFieldFilled?: (result: FillResult) => void;
  /** Callback for progress updates */
  onProgress?: (progress: FillProgress) => void;
}

/** Autofill summary */
export interface AutofillSummary {
  total: number;
  filled: number;
  skipped: number;
  failed: number;
  results: FillResult[];
  progress: FillProgress;
}

/**
 * Autofill Engine - fills form fields based on ATS config and user profile.
 */
export class AutofillEngine {
  private config: ATSConfig;
  private profile: Record<string, unknown>;
  private options: AutofillOptions;
  private progress: ProgressTracker;
  private cancelled = false;

  constructor(config: ATSConfig, options: AutofillOptions) {
    this.config = config;
    this.options = options;
    this.profile = options.profile;
    this.progress = new ProgressTracker(options.onProgress);
  }

  /** Cancel an in-progress autofill run */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Run autofill on the current page using TaskQueue pattern.
   */
  async run(): Promise<AutofillSummary> {
    const results: FillResult[] = [];
    const mappings = this.getSortedMappings();
    const queue = new TaskQueue();

    // Set required status upfront
    this.progress.setRequiredStatus(
      mappings.map((m) => ({ label: m.label, required: m.required }))
    );

    for (const mapping of mappings) {
      queue.add(async () => {
        if (this.cancelled) throw new CancelledError();
        this.progress.setCurrentField(mapping.label);
        const result = await this.fillField(mapping);
        results.push(result);
        this.options.onFieldFilled?.(result);

        if (result.success) {
          this.progress.updateFilled(mapping.label);
        } else if (result.skipped) {
          // Don't count skipped as missed
        } else {
          this.progress.updateMissed(mapping.label);
        }

        // Small delay between fills to appear more human-like
        if (!this.options.dryRun) {
          await this.delay(50 + Math.random() * 100);
        }
      });
    }

    try {
      await queue.run();
    } catch (e) {
      if (e instanceof CancelledError) {
        // Graceful cancellation
      } else {
        throw e;
      }
    }

    this.progress.setCurrentField(null);

    return {
      total: mappings.length,
      filled: results.filter((r) => r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.success && !r.skipped).length,
      results,
      progress: this.progress.generateFinal(),
    };
  }

  /**
   * Detect fields without filling (for preview).
   */
  async detect(): Promise<FillResult[]> {
    const results: FillResult[] = [];
    const mappings = this.getSortedMappings();

    for (const mapping of mappings) {
      const found = findElement(mapping.selectors);
      results.push({
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: !!found,
        value: found ? this.getValueForField(mapping) : undefined,
        skipped: !found,
        error: found ? undefined : "Element not found",
      });
    }

    return results;
  }

  /**
   * Fill a single field.
   */
  private async fillField(mapping: FieldMapping): Promise<FillResult> {
    // Check if should skip
    if (mapping.skip) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: false,
        skipped: true,
        error: "Field marked as skip",
      };
    }

    // Check condition
    if (mapping.condition && !this.evaluateCondition(mapping.condition)) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: false,
        skipped: true,
        error: "Condition not met",
      };
    }

    // Find the element
    const found = findElement(mapping.selectors);
    if (!found) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: false,
        error: "Element not found",
      };
    }

    // Get value to fill
    const value = this.getValueForField(mapping);
    if (!value) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: false,
        skipped: true,
        error: "No value available",
      };
    }

    // Skip if dry run
    if (this.options.dryRun) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: true,
        value,
      };
    }

    // Fill the field
    try {
      await this.setFieldValue(found.element, mapping.fieldType, value);
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: true,
        value,
      };
    } catch (error) {
      return {
        canonicalName: mapping.canonicalName,
        label: mapping.label,
        success: false,
        error: error instanceof Error ? error.message : "Fill failed",
      };
    }
  }

  /**
   * Get the value to fill for a field from the user profile.
   */
  private getValueForField(mapping: FieldMapping): string | undefined {
    // Check profile for matching field
    const profileValue = this.getProfileValue(mapping.canonicalName);
    if (profileValue !== undefined) {
      return this.applyTransform(mapping.transform, String(profileValue));
    }

    // Use default value if available
    if (mapping.defaultValue) {
      return mapping.defaultValue;
    }

    return undefined;
  }

  /**
   * Get value from profile using canonical name.
   * Supports nested paths like "address.city".
   */
  private getProfileValue(canonicalName: string): unknown {
    const parts = canonicalName.split(".");
    let current: unknown = this.profile;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Apply transform function to value.
   */
  private applyTransform(transform: string | undefined, value: string): string {
    if (!transform) return value;

    switch (transform) {
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      case "capitalize":
        return value.replace(/\b\w/g, (c) => c.toUpperCase());
      case "trim":
        return value.trim();
      case "formatPhone":
        return this.formatPhone(value);
      case "formatDate":
        return this.formatDate(value);
      default:
        return value;
    }
  }

  /**
   * Format phone number to E.164 format.
   */
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`; // US default
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return `+${digits}`; // India
    }
    return phone;
  }

  /**
   * Format date to standard format.
   */
  private formatDate(date: string): string {
    // Try to parse and format as YYYY-MM-DD
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    return date;
  }

  /**
   * Evaluate a condition for conditional fields.
   */
  private evaluateCondition(condition: {
    field: string;
    operator: string;
    value?: string;
  }): boolean {
    const fieldValue = this.getProfileValue(condition.field);

    switch (condition.operator) {
      case "equals":
        return String(fieldValue) === condition.value;
      case "notEquals":
        return String(fieldValue) !== condition.value;
      case "contains":
        return String(fieldValue).includes(condition.value ?? "");
      case "exists":
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return true;
    }
  }

  /**
   * Set the value of a form field.
   * Uses multi-phase event dispatch sequence for maximum compatibility.
   */
  private async setFieldValue(
    element: Element,
    fieldType: FieldType,
    value: string
  ): Promise<void> {
    const input = element as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;

    switch (fieldType) {
      case "select":
        if (input instanceof HTMLSelectElement) {
          this.setSelectValue(input, value);
        }
        break;

      case "radio":
        this.setRadioValue(element, value);
        break;

      case "checkbox":
        if (input instanceof HTMLInputElement) {
          const shouldCheck = matchCheckboxValue(value, input);
          input.checked = shouldCheck;
          triggerFullEventSequence(input);
        }
        break;

      case "textarea":
        if (input instanceof HTMLTextAreaElement) {
          // Focus first
          input.dispatchEvent(
            new FocusEvent("focus", { bubbles: true, cancelable: true })
          );
          // Use native setter for React compatibility
          setNativeValue(input, value);
          // Full event sequence
          triggerFullEventSequence(input);
        }
        break;

      default:
        // text, email, tel, url, number, etc.
        if (input instanceof HTMLInputElement) {
          // Focus first
          input.dispatchEvent(
            new FocusEvent("focus", { bubbles: true, cancelable: true })
          );
          // Use native setter for React compatibility
          setNativeValue(input, value);
          // Full event sequence
          triggerFullEventSequence(input);
        }
        break;
    }
  }

  /**
   * Set select dropdown value with proper event dispatch.
   * Throws ValueError if no matching option is found.
   */
  private setSelectValue(select: HTMLSelectElement, value: string): void {
    // Focus the select
    select.dispatchEvent(
      new FocusEvent("focus", { bubbles: true, cancelable: true })
    );
    if (select.focus) select.focus();

    const lowerValue = value.toLowerCase().trim();

    // 1) Try exact match on text or value
    for (const option of select.options) {
      if (
        isMatched(value, option.text) ||
        option.value === value ||
        option.text === value
      ) {
        selectOption(select, option);
        return;
      }
    }

    // 2) Case-insensitive match
    for (const option of select.options) {
      if (
        option.text.toLowerCase().trim() === lowerValue ||
        option.value.toLowerCase().trim() === lowerValue
      ) {
        selectOption(select, option);
        return;
      }
    }

    // 3) Partial / contains match
    for (const option of select.options) {
      const optText = option.text.toLowerCase().trim();
      if (optText.includes(lowerValue) || lowerValue.includes(optText)) {
        selectOption(select, option);
        return;
      }
    }

    // No match found - throw error instead of silent failure
    throw new ValueError(
      `No matching option found for "${value}" in select with ${select.options.length} options`
    );
  }

  /**
   * Set radio button value with label normalization.
   * Throws ValueError if no matching radio is found.
   */
  private setRadioValue(element: Element, value: string): void {
    const name = (element as HTMLInputElement).name;
    if (!name) throw new ValueError("Radio input has no name attribute");

    const radios = document.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(name)}"]`
    );
    if (radios.length === 0) {
      throw new ValueError(`No radio inputs found with name "${name}"`);
    }

    const lowerValue = value.toLowerCase().trim();

    for (const radio of radios) {
      // Match by value
      if (radio.value.toLowerCase().trim() === lowerValue) {
        radio.checked = true;
        triggerFullEventSequence(radio);
        return;
      }
      // Match by label text (normalized)
      const labelText = getRadioCheckLabel(radio);
      if (labelText && isMatched(labelText, value)) {
        radio.checked = true;
        triggerFullEventSequence(radio);
        return;
      }
      // Special yes/no matching
      if (
        (lowerValue === "true" && /^(yes|oui|ja|sí|si)$/i.test(labelText)) ||
        (lowerValue === "false" && /^(no|non|nein)$/i.test(labelText))
      ) {
        radio.checked = true;
        triggerFullEventSequence(radio);
        return;
      }
    }

    // No match found - throw error instead of silent failure
    throw new ValueError(
      `No matching radio option found for "${value}" in group "${name}"`
    );
  }

  /**
   * Get field mappings sorted by fill order.
   */
  private getSortedMappings(): FieldMapping[] {
    return [...this.config.fieldMappings]
      .filter((m) => !m.skip)
      .sort((a, b) => (a.fillOrder ?? 0) - (b.fillOrder ?? 0));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Helper Functions ─────────────────────────────────────────────

/**
 * Get the label text for a radio/checkbox input.
 */
function getRadioCheckLabel(input: HTMLInputElement): string {
  // Try associated label
  if (input.labels && input.labels.length > 0) {
    const text = input.labels[0].textContent?.trim();
    if (text) return normalizeLabelText(text);
  }
  // Try id-based label
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      const text = label.textContent?.trim();
      if (text) return normalizeLabelText(text);
    }
  }
  // Try parent label
  const parent = input.closest("label");
  if (parent) {
    const text = parent.textContent?.trim();
    if (text) return normalizeLabelText(text);
  }
  // Try preceding label sibling
  const prev = input.previousElementSibling;
  if (prev && prev.tagName === "LABEL") {
    const text = prev.textContent?.trim();
    if (text) return normalizeLabelText(text);
  }
  return "";
}

/**
 * Normalize label text by removing special characters and extra whitespace.
 */
function normalizeLabelText(text: string): string {
  return text
    .replace(/[\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[✱*]/g, "")
    .trim();
}

/**
 * Determine if a checkbox should be checked based on value.
 */
function matchCheckboxValue(
  value: string,
  input: HTMLInputElement
): boolean {
  const lowerValue = value.toLowerCase().trim();
  // Direct boolean values
  if (lowerValue === "true" || lowerValue === "yes" || lowerValue === "1") {
    return true;
  }
  if (lowerValue === "false" || lowerValue === "no" || lowerValue === "0") {
    return false;
  }
  // Match against label text
  const labelText = getRadioCheckLabel(input).toLowerCase();
  if (labelText) {
    // Check if label contains the value
    if (labelText.includes(lowerValue)) return true;
    // Standard consent/agreement checkboxes
    if (
      labelText.includes("have read") ||
      labelText.includes("i agree") ||
      labelText.includes("consent") ||
      labelText.includes("authorize") ||
      labelText.includes("terms") ||
      labelText.includes("privacy")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Select an option in a select element with proper event dispatch.
 */
function selectOption(
  select: HTMLSelectElement,
  option: HTMLOptionElement
): void {
  // Click the option (for frameworks that listen to click)
  option.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  option.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true })
  );
  option.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, cancelable: true })
  );
  // Set selected
  option.selected = true;
  // Dispatch change event on select (must bubble for event delegation)
  select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  // Blur
  select.blur();
}
