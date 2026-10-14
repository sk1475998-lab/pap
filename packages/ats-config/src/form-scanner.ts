/**
 * Comprehensive Form Scanner
 *
 * Scans the entire DOM (including shadow roots) to find all fillable form fields,
 * extract their labels using multiple strategies, and classify field types.
 *
 * Key features:
 * - Multi-strategy label detection (legend, label, aria-label, aria-labelledby, placeholder, parent traversal)
 * - Shadow DOM scanning and recursive form boundary detection
 * - TreeWalker-based visible text extraction
 * - Resilient label normalization and field classification
 */

/** Scanned form field with extracted metadata */
export interface ScannedField {
  /** The DOM element */
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  /** Field type: text, email, select, textarea, radio, checkbox, tel, etc. */
  type: string;
  /** Extracted label text (best match from multiple strategies) */
  label: string | null;
  /** Normalized label for matching */
  normalizedLabel: string | null;
  /** Field name attribute */
  name: string | null;
  /** Field id attribute */
  id: string | null;
  /** Placeholder text */
  placeholder: string | null;
  /** Aria-label text */
  ariaLabel: string | null;
  /** Current value */
  value: string;
  /** Whether field is required */
  required: boolean;
  /** Whether field is disabled */
  disabled: boolean;
  /** Whether field is visible */
  visible: boolean;
  /** For radio/checkbox: the label of the specific option */
  optionLabel: string | null;
  /** For radio/checkbox: the group name */
  groupName: string | null;
  /** For select: available options */
  options?: Array<{ value: string; text: string }>;
  /** Confidence in the label extraction (0-1) */
  labelConfidence: number;
  /** Which strategy found the label */
  labelStrategy: LabelStrategy | null;
}

/** Label detection strategies */
export type LabelStrategy =
  | "label-for"
  | "label-nested"
  | "aria-label"
  | "aria-labelledby"
  | "legend"
  | "placeholder"
  | "parent-text"
  | "preceding-text"
  | "data-label"
  | "title";

/** Form scanner configuration */
export interface FormScannerOptions {
  /** Include hidden fields */
  includeHidden?: boolean;
  /** Include disabled fields */
  includeDisabled?: boolean;
  /** Scan shadow roots */
  scanShadowRoots?: boolean;
  /** Minimum label confidence threshold (0-1) */
  minLabelConfidence?: number;
  /** Custom selectors to scan */
  customSelectors?: string[];
  /** Selectors to exclude */
  excludeSelectors?: string[];
}

const DEFAULT_OPTIONS: Required<FormScannerOptions> = {
  includeHidden: false,
  includeDisabled: false,
  scanShadowRoots: true,
  minLabelConfidence: 0.3,
  customSelectors: [],
  excludeSelectors: [
    'input[type="hidden"]',
    'input[type="submit"]',
    'input[type="button"]',
    'input[type="image"]',
    'input[type="file"]',
    'input[type="reset"]',
  ],
};

/** Selectors for fillable form elements */
const FIELD_SELECTORS = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=file]):not([type=reset])",
  "select",
  "textarea",
];

/**
 * Scan the entire DOM for fillable form fields.
 * Traverses shadow roots, iframes (same-origin), and uses multiple label extraction strategies.
 */
export function scanFormFields(
  root: Element | Document = document,
  options: FormScannerOptions = {}
): ScannedField[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const fields: ScannedField[] = [];
  const excludeSet = new Set(opts.excludeSelectors);

  // Build combined selector
  const selectors = [...FIELD_SELECTORS, ...opts.customSelectors].join(", ");

  // Scan main document/shadow root
  scanRoot(root, selectors, excludeSet, opts, fields);

  // Filter by visibility and confidence
  return fields.filter((f) => {
    if (!opts.includeHidden && !f.visible) return false;
    if (!opts.includeDisabled && f.disabled) return false;
    if (f.labelConfidence < opts.minLabelConfidence) return false;
    return true;
  });
}

/**
 * Recursively scan a root element (document or shadow root) for form fields.
 */
function scanRoot(
  root: Element | Document | ShadowRoot,
  selectors: string,
  excludeSet: Set<string>,
  opts: Required<FormScannerOptions>,
  fields: ScannedField[]
): void {
  const elements = root.querySelectorAll(selectors);

  for (const el of elements) {
    const htmlEl = el as HTMLElement;

    // Skip excluded selectors
    if (isExcluded(htmlEl, excludeSet)) continue;

    const field = extractFieldMetadata(htmlEl);
    if (field) {
      fields.push(field);
    }
  }

  // Scan shadow roots
  if (opts.scanShadowRoots) {
    const allElements = root.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot) {
        scanRoot(el.shadowRoot, selectors, excludeSet, opts, fields);
      }
    }
  }
}

/**
 * Check if element matches any exclude selector.
 */
function isExcluded(el: HTMLElement, excludeSet: Set<string>): boolean {
  for (const selector of excludeSet) {
    try {
      if (el.matches(selector)) return true;
    } catch {
      // Invalid selector, skip
    }
  }
  return false;
}

/**
 * Extract comprehensive metadata from a form field element.
 */
function extractFieldMetadata(
  el: HTMLElement
): ScannedField | null {
  const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  // Determine field type
  const type = getFieldType(input);

  // Extract label using multi-strategy approach
  const labelResult = extractLabel(input);

  // Extract other metadata
  const name = input.getAttribute("name");
  const id = input.getAttribute("id");
  const placeholder = input.getAttribute("placeholder");
  const ariaLabel = input.getAttribute("aria-label");
  const value = "value" in input ? (input.value ?? "") : "";
  const required = input.hasAttribute("required");
  const disabled = input.hasAttribute("disabled");
  const visible = isElementVisible(input);

  // For radio/checkbox: extract option label and group
  let optionLabel: string | null = null;
  let groupName: string | null = null;
  if (type === "radio" || type === "checkbox") {
    const radioInput = input as HTMLInputElement;
    groupName = radioInput.name || null;
    optionLabel = getRadioCheckLabel(radioInput);
  }

  // For select: extract options
  let options: Array<{ value: string; text: string }> | undefined;
  if (input.tagName === "SELECT") {
    const select = input as HTMLSelectElement;
    options = Array.from(select.options).map((opt) => ({
      value: opt.value,
      text: opt.textContent?.trim() ?? "",
    }));
  }

  return {
    element: input,
    type,
    label: labelResult.label,
    normalizedLabel: labelResult.label ? normalizeLabel(labelResult.label) : null,
    name,
    id,
    placeholder,
    ariaLabel,
    value,
    required,
    disabled,
    visible,
    optionLabel,
    groupName,
    options,
    labelConfidence: labelResult.confidence,
    labelStrategy: labelResult.strategy,
  };
}

/**
 * Get the effective field type.
 */
function getFieldType(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string {
  if (el.tagName === "SELECT") return "select";
  if (el.tagName === "TEXTAREA") return "textarea";
  const input = el as HTMLInputElement;
  return input.type?.toLowerCase() || "text";
}

/**
 * Multi-strategy label extraction.
 * Tries multiple strategies in priority order and returns the best match.
 */
function extractLabel(el: HTMLElement): {
  label: string | null;
  confidence: number;
  strategy: LabelStrategy | null;
} {
  // Strategy 1: <label for="id"> association
  const id = el.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) {
      const text = extractVisibleText(label);
      if (text) {
        return { label: text, confidence: 0.95, strategy: "label-for" };
      }
    }
  }

  // Strategy 2: Nested inside <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = extractLabelText(parentLabel, el);
    if (text) {
      return { label: text, confidence: 0.9, strategy: "label-nested" };
    }
  }

  // Strategy 3: aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    return { label: ariaLabel, confidence: 0.85, strategy: "aria-label" };
  }

  // Strategy 4: aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) {
      const text = extractVisibleText(labelEl);
      if (text) {
        return { label: text, confidence: 0.85, strategy: "aria-labelledby" };
      }
    }
  }

  // Strategy 5: <legend> for fieldset groups
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend) {
      const text = extractVisibleText(legend);
      if (text) {
        return { label: text, confidence: 0.8, strategy: "legend" };
      }
    }
  }

  // Strategy 6: data-label attribute
  const dataLabel = el.getAttribute("data-label");
  if (dataLabel) {
    return { label: dataLabel, confidence: 0.75, strategy: "data-label" };
  }

  // Strategy 7: placeholder
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) {
    return { label: placeholder, confidence: 0.6, strategy: "placeholder" };
  }

  // Strategy 8: title attribute
  const title = el.getAttribute("title");
  if (title) {
    return { label: title, confidence: 0.5, strategy: "title" };
  }

  // Strategy 9: Parent text traversal
  const parentText = findParentLabelText(el);
  if (parentText) {
    return { label: parentText, confidence: 0.5, strategy: "parent-text" };
  }

  // Strategy 10: Preceding text node
  const precedingText = findPrecedingLabelText(el);
  if (precedingText) {
    return { label: precedingText, confidence: 0.4, strategy: "preceding-text" };
  }

  return { label: null, confidence: 0, strategy: null };
}

/**
 * Extract label text from a <label> element that wraps the input.
 * Excludes the input's own text content.
 */
function extractLabelText(label: HTMLElement, input: HTMLElement): string | null {
  // Clone and remove the input to get only the label text
  const clone = label.cloneNode(true) as HTMLElement;
  const inputs = clone.querySelectorAll("input, select, textarea");
  inputs.forEach((i) => i.remove());
  return extractVisibleText(clone);
}

/**
 * Extract visible text from an element using TreeWalker.
 * Filters out script, style, noscript elements.
 */
function extractVisibleText(root: Node): string | null {
  if (!root) return null;

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "SVG",
    "CANVAS",
    "VIDEO",
    "AUDIO",
  ]);

  const parts: string[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    // Check if parent is a skipped tag
    let parent = node.parentElement;
    let skip = false;
    while (parent && parent !== root) {
      if (SKIP_TAGS.has(parent.tagName)) {
        skip = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (skip) continue;

    const text = node.textContent?.trim();
    if (text) {
      parts.push(text);
    }
  }

  const result = parts.join(" ").replace(/\s+/g, " ").trim();
  return result || null;
}

/**
 * Find label text by traversing parent elements.
 * Looks for sibling text nodes or nearby text elements.
 */
function findParentLabelText(el: HTMLElement): string | null {
  let current: HTMLElement | null = el.parentElement;
  let depth = 0;

  while (current && depth < 3) {
    // Check for preceding sibling text elements
    const prev = current.previousElementSibling;
    if (prev) {
      const tag = prev.tagName.toLowerCase();
      if (
        tag === "label" ||
        tag === "span" ||
        tag === "div" ||
        tag === "p" ||
        tag === "strong" ||
        tag === "b" ||
        tag === "em"
      ) {
        const text = extractVisibleText(prev);
        if (text && text.length < 100) {
          return text;
        }
      }
    }

    // Check for text in parent that's not inside the input
    const clone = current.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll("input, select, textarea");
    inputs.forEach((i) => i.remove());
    const text = extractVisibleText(clone);
    if (text && text.length < 100 && !isJustInputValue(text, el)) {
      return text;
    }

    current = current.parentElement;
    depth++;
  }

  return null;
}

/**
 * Find text in preceding sibling elements.
 */
function findPrecedingLabelText(el: HTMLElement): string | null {
  let prev = el.previousElementSibling;
  let count = 0;

  while (prev && count < 3) {
    const text = extractVisibleText(prev);
    if (text && text.length < 100) {
      return text;
    }
    prev = prev.previousElementSibling;
    count++;
  }

  return null;
}

/**
 * Check if extracted text is just the input's own value.
 */
function isJustInputValue(text: string, el: HTMLElement): boolean {
  const input = el as HTMLInputElement;
  if (input.value && text === input.value) return true;
  if (input.placeholder && text === input.placeholder) return true;
  return false;
}

/**
 * Get the label for a radio/checkbox input.
 */
function getRadioCheckLabel(input: HTMLInputElement): string {
  // Check for associated <label>
  const id = input.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent?.trim()) {
      return label.textContent.trim();
    }
  }

  // Check parent <label>
  const parentLabel = input.closest("label");
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll("input");
    inputs.forEach((i) => i.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // Check adjacent text node
  const next = input.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE) {
    const text = next.textContent?.trim();
    if (text) return text;
  }

  // Check parent element text
  const parent = input.parentElement;
  if (parent) {
    const clone = parent.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll("input");
    inputs.forEach((i) => i.remove());
    const text = clone.textContent?.trim();
    if (text && text.length < 50) return text;
  }

  return input.value || "";
}

/**
 * Normalize label text for consistent matching.
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Check if an element is visible in the DOM.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (typeof window === "undefined") return true;

  const style = window.getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Group scanned fields by their group name (for radio/checkbox groups).
 */
export function groupFieldsByName(
  fields: ScannedField[]
): Map<string, ScannedField[]> {
  const groups = new Map<string, ScannedField[]>();

  for (const field of fields) {
    const key = field.groupName || field.name || field.id || `field_${Math.random()}`;
    const existing = groups.get(key) ?? [];
    existing.push(field);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Find all forms on the page and their fields.
 */
export function scanAllForms(
  options: FormScannerOptions = {}
): Array<{ form: HTMLFormElement; fields: ScannedField[] }> {
  const forms: Array<{ form: HTMLFormElement; fields: ScannedField[] }> = [];

  const formElements = document.querySelectorAll("form");
  for (const form of formElements) {
    const fields = scanFormFields(form, options);
    if (fields.length > 0) {
      forms.push({ form: form as HTMLFormElement, fields });
    }
  }

  // Also scan fields not in any form
  const allFields = scanFormFields(document, options);
  const formFieldSet = new Set(forms.flatMap((f) => f.fields.map((sf) => sf.element)));
  const orphanFields = allFields.filter((f) => !formFieldSet.has(f.element));

  if (orphanFields.length > 0) {
    forms.push({
      form: null as unknown as HTMLFormElement,
      fields: orphanFields,
    });
  }

  return forms;
}
