/**
 * Field detector — scans a DOM and returns a normalized list of fields.
 *
 * Pure DOM logic, no framework deps, so it runs fast inside the content
 * script and can be unit-tested with jsdom. Handles:
 *   - <input>, <textarea>, <select>
 *   - grouped radios + checkboxes
 *   - accessible-name resolution (label[for], aria-label, aria-labelledby,
 *     placeholder, surrounding <label> text, name attribute)
 *   - [contenteditable] rich text editors
 *   - [role=combobox/textbox] on non-input elements
 *   - Workday web components (wd-text-input, wd-select, etc.)
 *   - data-automation-id / data-testid label extraction
 */
import type { DetectedField, FieldType } from "@superjob/core";
import { classifyLabel } from "@superjob/core";

/** CSS.escape with a safe fallback (ids with odd characters, non-standard envs). */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

export function getXPathForElement(el: Element): string {
  if (el.id) return `id("${el.id}")`;
  const autoId = el.getAttribute("data-automation-id");
  if (autoId) return `//*[@data-automation-id="${autoId}"]`;
  const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-test");
  if (testId) return `//*[@data-testid="${testId}"]`;

  const paths: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    const tagName = current.nodeName.toLowerCase();
    const pathIndex = index > 0 ? `[${index + 1}]` : "";
    paths.unshift(`${tagName}${pathIndex}`);
    current = current.parentElement;
  }
  return paths.length ? "/" + paths.join("/") : "";
}

/**
 * Build a unique, stable selector for an element so the filler can re-find it.
 * Prefers stable attributes (data-automation-id, data-testid) over fragile nth-of-type.
 */
export function selectorFor(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;

  // data-automation-id (Workday, etc.)
  const autoId = el.getAttribute("data-automation-id");
  if (autoId) return `[data-automation-id="${cssEscape(autoId)}"]`;

  // data-testid (React Testing Library)
  const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-test");
  if (testId) return `[data-testid="${cssEscape(testId)}"]`;

  const name = el.getAttribute("name");
  const type = el.getAttribute("type");
  if (name) return `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]${type ? `[type="${type}"]` : ""}`;

  // aria-label (unique enough for most cases)
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.length < 80) {
    const sel = `${el.tagName.toLowerCase()}[aria-label="${cssEscape(ariaLabel)}"]`;
    // Verify uniqueness
    try {
      if (document.querySelectorAll(sel).length === 1) return sel;
    } catch { /* invalid selector */ }
  }

  // Stable XPath fallback instead of fragile nth-of-type CSS path
  return getXPathForElement(el);
}

export function cleanLabel(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b(work_outline|expand_more|arrow_drop_down|search|close|add|delete|edit|info|warning|error|check|help_outline|help)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\?\s*$/, "?")
    .trim();
}

/** Resolve the best human-readable label/question for a field. */
export function labelFor(el: Element): string {
  return cleanLabel(labelForRaw(el));
}

function labelForRaw(el: Element): string {
  // 1) explicit <label for=id>
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${cssEscape(id)}"]`);
    if (lab?.textContent?.trim()) return lab.textContent.trim();
  }
  // 2) aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = labelledBy
      .split(/\s+/)
      .map((i) => document.getElementById(i)?.textContent)
      .filter(Boolean)
      .join(" ");
    if (ref) return ref;
  }
  // 3) aria-label
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  // 4) data-automation-id (Workday labels)
  const autoId = el.getAttribute("data-automation-id");
  if (autoId) {
    // Extract human-readable label from automation id
    const readable = prettify(autoId.replace(/^(input|select|dropdown|field)-?/i, ""));
    if (readable && readable.length > 2) return readable;
  }
  // 5) wrapping <label> — clone it and strip the controls so the input's own
  //    value (e.g. a checkbox's "on") doesn't corrupt the label text
  const wrap = el.closest("label");
  if (wrap?.textContent?.trim()) {
    const clone = wrap.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(
      "input, select, textarea, button, " +
      "[role='combobox'], [role='listbox'], [role='textbox'], " +
      "[class*='select'], [class*='dropdown']"
    ).forEach((n) => n.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
    return wrap.textContent.trim();
  }
  // 6) Preceding sibling label element (common in Greenhouse/Lever)
  const prev = el.previousElementSibling;
  if (prev?.tagName === "LABEL" && prev.textContent?.trim()) {
    return prev.textContent.trim();
  }
  // 7) Preceding heading/label in parent container (Bootstrap, Ant Design, MUI, Tailwind, Workday)
  const container = el.closest(".form-group, .field, [class*='field'], [class*='question'], fieldset, .form-row, .ant-form-item, [class*='form-item'], .MuiFormControl-root, [data-automation-id*='formField']");
  if (container) {
    const heading = container.querySelector("label, legend, h3, h4, .label, [class*='label'], [class*='question'], [class*='title']");
    if (heading && heading !== el && heading.textContent?.trim()) {
      return heading.textContent.trim();
    }
  }
  // 8) placeholder
  const ph = (el as HTMLInputElement).placeholder;
  if (ph) return ph;
  // 9) name attribute
  const name = el.getAttribute("name");
  if (name) return prettify(name);
  // 10) preceding heading/legend
  const group = el.closest("fieldset");
  if (group) {
    const legend = group.querySelector("legend");
    if (legend?.textContent?.trim()) return legend.textContent.trim();
  }
  return "";
}

function prettify(name: string): string {
  return name
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function typeOf(el: Element): FieldType {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";

  // Workday web components
  if (tag.startsWith("wd-")) {
    if (tag.includes("select") || tag.includes("dropdown")) return "combobox";
    return "text";
  }

  // contenteditable → textarea
  if (el.getAttribute("contenteditable") === "true") return "textarea";

  // role-based type detection
  const role = el.getAttribute("role");
  if (role === "combobox") return "combobox";
  if (role === "textbox") return "textarea";

  if (tag === "input") {
    const t = (el.getAttribute("type") ?? "text").toLowerCase();
    if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete")) return "combobox";
    if (["text", "search"].includes(t)) return "text";
    if (["email"].includes(t)) return "email";
    if (["tel"].includes(t)) return "tel";
    if (["number"].includes(t)) return "number";
    if (["url"].includes(t)) return "url";
    if (["date", "month", "datetime-local"].includes(t)) return "date";
    if (["radio"].includes(t)) return "radio";
    if (["checkbox"].includes(t)) return "checkbox";
    if (["file"].includes(t)) return "file";
    return "text";
  }
  // div/span with role
  if (role === "listbox" || role === "option") return "select";
  return "text";
}

let counter = 0;
function uid(): string {
  return `f${(counter++).toString(36)}${Date.now().toString(36).slice(-3)}`;
}

/**
 * Filter out elements that should never be detected as form fields
 * (e.g. LinkedIn resume upload card toggles, social feed action buttons, etc.)
 */
export function shouldSkipElement(el: Element, rawLabel?: string): boolean {
  if (el.closest?.(".jobs-document-upload-redesign, .jobs-document-upload__container, .jobs-resume-list, [class*='jobs-document-upload']")) {
    return true;
  }
  const id = el.id || el.getAttribute("id") || "";
  if (/jobs-document-card-toggle/i.test(id)) return true;

  const label = rawLabel ?? labelFor(el);
  if (/jobs\s*document\s*card\s*toggle/i.test(label)) return true;

  // Skip social feed / noise buttons
  if (/it’s annoying or not interesting|it's annoying or not interesting|dismiss post|hide post|report post|unfollow\b/i.test(label)) {
    return true;
  }

  // Skip non-form navigation, utility menus, header buttons (e.g. Workday "Utility Menu Button", "Search Menu", "User Menu", etc.)
  const skipButtonLabels = /\b(utility\s*menu|navigation\s*menu|account\s*menu|user\s*menu|global\s*menu|search\s*menu|more\s*actions|close\s*dialog|cancel|dismiss|sign\s*in|sign\s*out|log\s*out)\b/i;
  if (skipButtonLabels.test(label)) {
    return true;
  }

  // Skip buttons with aria-haspopup="menu" unless they represent actual form selection
  if (el.tagName.toLowerCase() === "button" && el.getAttribute("aria-haspopup") === "menu") {
    if (!el.getAttribute("role")?.includes("combobox") && !el.closest(".form-group, .field, [class*='field']")) {
      return true;
    }
  }

  return false;
}

/**
 * Scan the document for fillable fields.
 * Radio groups are collapsed into a single field with options.
 * Also detects custom dropdowns, web components, and contenteditable elements.
 */
export function detectFields(root: ParentNode = document): DetectedField[] {
  const fields: DetectedField[] = [];
  const seen = new Set<Element>();

  // Standard form elements
  const candidates = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), textarea, select"
    )
  ).filter((el) => isVisible(el) && !shouldSkipElement(el));

  for (const el of candidates) {
    if (seen.has(el)) continue;
    const type = typeOf(el);
    if (type === "radio") continue; // handled in group pass
    seen.add(el);

    const label = labelFor(el);
    if (shouldSkipElement(el, label)) continue;
    const field: DetectedField = {
      id: uid(),
      elementId: el.id || undefined,
      label,
      fieldKey: classifyLabel(label) || "ai",
      type,
      selector: selectorFor(el),
      confidence: label ? 0.8 : 0.4,
      options: type === "select" ? readOptions(el as HTMLSelectElement) : undefined,
    };
    fields.push(field);
  }

  // Contenteditable elements (rich text editors for cover letters, descriptions)
  const editables = Array.from(
    root.querySelectorAll<HTMLElement>('[contenteditable="true"], [role="textbox"]')
  ).filter((el) => isVisible(el) && !seen.has(el) && !shouldSkipElement(el));

  for (const el of editables) {
    if (seen.has(el)) continue;
    // Skip if it's inside an already-detected input's parent
    if (el.closest("label") || el.querySelector("input, select, textarea")) continue;
    seen.add(el);
    const label = labelFor(el);
    if (shouldSkipElement(el, label)) continue;
    fields.push({
      id: uid(),
      elementId: el.id || undefined,
      label,
      fieldKey: classifyLabel(label) || "ai",
      type: "textarea",
      selector: selectorFor(el),
      confidence: label ? 0.7 : 0.3,
    });
  }

  // Custom combobox elements (div[role=combobox], React Select, Radix, Headless UI, Ashby, etc.)
  const comboboxes = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[role="combobox"]:not(input):not(select), ' +
      'button[aria-haspopup="listbox"], ' +
      'button[aria-haspopup="menu"], ' +
      '[data-headlessui-state]:not(input), ' +
      '[data-radix-collection-item]:not(input), ' +
      '[data-testid*="select"]:not(input), ' +
      '[data-testid*="dropdown"]:not(input), ' +
      '[class*="ashby-select"]:not(input), ' +
      '[class*="ashby-dropdown"]:not(input), ' +
      '[class*="react-select"]:not(input), ' +
      '[class*="ant-select"]:not(input), ' +
      '[class*="MuiAutocomplete"]:not(input), ' +
      '[class*="MuiSelect"]:not(input)'
    )
  ).filter((el) => isVisible(el) && !seen.has(el) && !shouldSkipElement(el));

  for (const el of comboboxes) {
    if (seen.has(el)) continue;
    // Skip if we already captured the inner input
    const innerInput = el.querySelector("input");
    if (innerInput && seen.has(innerInput)) continue;
    seen.add(el);
    if (innerInput) seen.add(innerInput);
    const label = labelFor(el) || (innerInput ? labelFor(innerInput) : "");
    if (shouldSkipElement(el, label)) continue;
    fields.push({
      id: uid(),
      elementId: el.id || undefined,
      label,
      fieldKey: classifyLabel(label) || "ai",
      type: "combobox",
      selector: selectorFor(el),
      confidence: label ? 0.7 : 0.3,
    });
  }

  // Workday web components
  const wdComponents = Array.from(
    root.querySelectorAll<HTMLElement>(
      "wd-text-input, wd-select, wd-radio-group, wd-checkbox, wd-combobox, wd-textarea"
    )
  ).filter((el) => isVisible(el) && !seen.has(el) && !shouldSkipElement(el));

  for (const el of wdComponents) {
    if (seen.has(el)) continue;
    seen.add(el);
    const tag = el.tagName.toLowerCase();
    const label = labelFor(el);
    if (shouldSkipElement(el, label)) continue;
    let type: FieldType = "text";
    if (tag.includes("select") || tag.includes("combobox")) type = "combobox";
    else if (tag.includes("radio")) type = "radio";
    else if (tag.includes("checkbox")) type = "checkbox";
    else if (tag.includes("textarea")) type = "textarea";
    fields.push({
      id: uid(),
      elementId: el.id || undefined,
      label,
      fieldKey: classifyLabel(label) || "ai",
      type,
      selector: selectorFor(el),
      confidence: label ? 0.7 : 0.3,
    });
  }

  // Radio groups: group by name, collect options from labels
  const radios = Array.from(
    root.querySelectorAll<HTMLInputElement>("input[type=radio]")
  ).filter((el) => isVisible(el) && !shouldSkipElement(el));
  const groups = new Map<string, HTMLInputElement[]>();
  for (const r of radios) {
    const key = r.getAttribute("name") ?? r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  for (const [key, opts] of groups) {
    if (opts.every((o) => seen.has(o))) continue;
    opts.forEach((o) => seen.add(o));
    // prefer the question text (fieldset legend / preceding heading) over the
    // first option's label, so classification hits the right profile field
    let label = "";
    const fieldset = opts[0]!.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      label = legend?.textContent?.trim() ?? "";
    }
    // Check parent container for a question label
    if (!label) {
      const container = opts[0]!.closest(
        "[class*='question'], [class*='field'], .form-group, [class*='radio-group']"
      );
      if (container) {
        const heading = container.querySelector("label, h3, h4, [class*='label'], [class*='question-text']");
        if (heading && !heading.querySelector("input")) {
          label = heading.textContent?.trim() ?? "";
        }
      }
    }
    if (!label) label = labelFor(opts[0]!) || prettify(key);
    fields.push({
      id: uid(),
      label,
      fieldKey: classifyLabel(label) || "ai",
      type: "radio",
      selector: `input[type=radio][name="${cssEscape(key)}"]`,
      confidence: label ? 0.8 : 0.4,
      options: opts.map((o) => ({ value: o.value, label: labelFor(o) || o.value })),
    });
  }

  return fields;
}

function readOptions(sel: HTMLSelectElement) {
  return Array.from(sel.options)
    .filter((o) => o.value !== "") // Skip empty placeholder options
    .map((o) => ({ value: o.value, label: o.textContent?.trim() ?? o.value }));
}

function isVisible(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const style = getComputedStyle(el as HTMLElement);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;

  const rect = (el as HTMLElement).getBoundingClientRect();
  const isInput = tag === "input";
  const type = isInput ? (el as HTMLInputElement).type?.toLowerCase() : "";
  const isCustomHiddenControl = isInput && ["file", "radio", "checkbox"].includes(type);

  if (rect.width === 0 && rect.height === 0) {
    if (isCustomHiddenControl) {
      // Allow zero-size for custom styled inputs
    } else {
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (style.position === "absolute" && (parseInt(style.left) < -9000 || parseInt(style.top) < -9000)) {
        return false;
      }
      const ua = el.ownerDocument.defaultView?.navigator.userAgent ?? "";
      if (/jsdom/i.test(ua)) {
        // jsdom: allow visibility if not explicitly hidden
      } else {
        return false;
      }
    }
  }

  // Opacity check: custom-styled controls are often opacity: 0
  if (Number(style.opacity) === 0) {
    if (!isCustomHiddenControl) return false;
  }

  // Check if element is within the viewport (if it has non-zero size, we can check rect)
  if (rect.width > 0 || rect.height > 0) {
    if (rect.top > window.innerHeight * 3 || rect.bottom < -window.innerHeight) {
      return false;
    }
  }

  return true;
}

export function isApplicationForm(fields: DetectedField[]): boolean {
  // If there's a file input (like resume/cv), it's definitely a form
  if (
    fields.some(
      (f) =>
        f.type === "file" ||
        f.label.toLowerCase().includes("resume") ||
        f.label.toLowerCase().includes("cv") ||
        f.fieldKey === "resume"
    )
  ) {
    return true;
  }

  // If we have any of the core personal info fields, it's a form
  const coreFormKeys = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "country",
    "linkedin",
    "github",
    "website",
    "work_authorization",
    "sponsorship",
  ];
  const hasCoreFields = fields.some((f) => coreFormKeys.includes(f.fieldKey));
  if (hasCoreFields) return true;

  // If there are many fields (say, 5 or more) and at least some of them are not search-related, it's likely a form
  const nonSearchFields = fields.filter((f) => {
    const label = f.label.toLowerCase();
    return !/\b(search|keyword|q|location|city|state|zip|distance|radius|category|job_category|department|function|ref|req|id|folder)\b/.test(
      label
    );
  });

  if (nonSearchFields.length >= 4) {
    return true;
  }

  return false;
}

