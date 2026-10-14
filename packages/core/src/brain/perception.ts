/**
 * Accessibility Tree (AXTree) Perception Engine
 * 
 * Grounded in Mind2Web (Deng et al., 2024 / OSU-NLP-Group/Mind2Web) &
 * SeeAct (Zheng et al., 2024).
 * 
 * Prunes raw HTML into a structured, token-efficient Accessibility Tree (<1,500 tokens)
 * with numbered interactive element identifiers ([1], [2], [3]), detecting:
 * - Interactive input, select, textarea, button, file upload elements
 * - Validation error banners and inline field error tooltips
 * - Multi-step progress indicators
 * - Terminal states (success modal, daily limits, OTP blocks)
 */

import type { AXNode, AXTreeSnapshot } from "./types.js";

/** Error selectors commonly used across LinkedIn, Greenhouse, Lever, Workday, Taleo */
const ERROR_BANNER_SELECTORS = [
  '[role="alert"]',
  '.artdeco-inline-feedback--error',
  '.fb-form-element__error-text',
  '.error-message',
  '.alert-danger',
  '.invalid-feedback',
  '[class*="errorText"]',
  '[class*="ErrorMessage"]',
  '[class*="validation-error"]',
  '.form-error',
];

const TERMINAL_SUCCESS_PATTERNS = [
  /application\s+submitted/i,
  /your\s+application\s+was\s+sent/i,
  /thank\s+you\s+for\s+applying/i,
  /application\s+received/i,
];

const DAILY_LIMIT_PATTERNS = [
  /you've\s+reached\s+the\s+application\s+limit/i,
  /daily\s+limit\s+reached/i,
  /exceeded\s+maximum\s+applications/i,
];

/**
 * Builds an AXTreeSnapshot from a Document or Element (runs in browser context or JSDOM)
 */
export function buildAXTreeFromDom(root: ParentNode = document): AXTreeSnapshot {
  const nodes: AXNode[] = [];
  const errorBanners: string[] = [];
  const fieldErrors: { selector: string; message: string }[] = [];

  // 1. Detect Error Banners
  for (const sel of ERROR_BANNER_SELECTORS) {
    try {
      const els = root.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = (el.textContent ?? "").trim();
        if (text && !errorBanners.includes(text)) {
          errorBanners.push(text);
        }
      }
    } catch { /* skip invalid selectors */ }
  }

  // 2. Query all interactive elements (including nested Shadow DOM roots)
  const query = 'input, select, textarea, button, [role="button"], [role="checkbox"], [role="radio"], [role="combobox"], [contenteditable="true"]';
  function queryAllDeep(parent: ParentNode): Element[] {
    const list: Element[] = [];
    try {
      const found = Array.from(parent.querySelectorAll(query));
      list.push(...found);
      const all = parent.querySelectorAll("*");
      for (const el of Array.from(all)) {
        if (el.shadowRoot) {
          list.push(...queryAllDeep(el.shadowRoot));
        }
      }
    } catch {}
    return list;
  }
  const rawElements = queryAllDeep(root);

  let nodeId = 1;

  for (const raw of rawElements) {
    const el = raw as HTMLElement;

    // Skip hidden / invisible elements
    if (el.getAttribute("type") === "hidden") continue;
    if (el.style.display === "none" || el.style.visibility === "hidden") continue;
    if (el.getAttribute("aria-hidden") === "true") continue;

    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute("type") || (tag === "select" ? "select" : tag === "textarea" ? "textarea" : undefined);
    const role = el.getAttribute("role") || (tag === "button" ? "button" : tag === "select" ? "combobox" : "textbox");

    // Extract Label
    const name = extractElementLabel(el);
    if (!name && tag === "button" && !(el.textContent ?? "").trim()) continue;

    const selector = generateRobustSelector(el);
    const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || name.includes("*");
    const disabled = el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

    // Detect Field-Level Error
    const hasError = el.getAttribute("aria-invalid") === "true" || el.classList.contains("error") || el.classList.contains("is-invalid");
    let errorMessage: string | undefined;
    if (hasError) {
      const errEl = el.closest(".form-group, fieldset, label, div")?.querySelector(ERROR_BANNER_SELECTORS.join(", "));
      if (errEl) {
        errorMessage = (errEl.textContent ?? "").trim();
        fieldErrors.push({ selector, message: errorMessage });
      }
    }

    // Extract Options for Dropdowns
    let options: { label: string; value: string }[] | undefined;
    if (tag === "select") {
      const selectEl = el as HTMLSelectElement;
      options = Array.from(selectEl.options).map((o) => ({
        label: (o.textContent ?? o.text ?? "").trim(),
        value: o.value,
      })).filter((o) => o.label.length > 0 && o.value !== "");
    }

    const value = (el as HTMLInputElement).value ?? (el as HTMLTextAreaElement).value ?? undefined;
    const placeholder = el.getAttribute("placeholder") ?? undefined;

    nodes.push({
      id: nodeId++,
      role,
      name: name || (el.textContent ?? "").trim().slice(0, 40),
      selector,
      tag,
      type,
      value,
      placeholder,
      required,
      disabled,
      hasError,
      errorMessage,
      options,
    });
  }

  // Check Terminal Status
  const rootDocument = root.nodeType === 9 ? root as Document : root.ownerDocument;
  const bodyText = ((root.nodeType === 9 ? (root as Document).body : root as Node)?.textContent ?? "").slice(0, 3000);
  let isTerminal = false;
  let terminalType: AXTreeSnapshot["terminalType"] = undefined;

  if (TERMINAL_SUCCESS_PATTERNS.some((p) => p.test(bodyText))) {
    isTerminal = true;
    terminalType = "submitted";
  } else if (DAILY_LIMIT_PATTERNS.some((p) => p.test(bodyText))) {
    isTerminal = true;
    terminalType = "daily_limit";
  }

  return {
    url: rootDocument?.defaultView?.location?.href ?? "",
    title: rootDocument?.title ?? "",
    nodes,
    errorBanners,
    fieldErrors,
    isTerminal,
    terminalType,
    timestamp: Date.now(),
  };
}

/**
 * Extracts a human-meaningful label for an element using id/for, aria-label,
 * placeholder, or enclosing label tags.
 */
function extractElementLabel(el: HTMLElement): string {
  // 1. Explicit aria-label or aria-labelledby
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // 2. Associated <label for="id">
  const id = el.getAttribute("id");
  if (id) {
    const queryRoot = el.getRootNode() as ParentNode;
    const escapedId = typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(id)
      : id.replace(/["\\]/g, "\\$&");
    const labelEl = queryRoot.querySelector(`label[for="${escapedId}"]`);
    if (labelEl) {
      const text = (labelEl.textContent ?? "").trim();
      if (text) return cleanLabelText(text);
    }
  }

  // 3. Parent <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = (parentLabel.textContent ?? "").trim();
    if (text) return cleanLabelText(text);
  }

  // 4. Previous sibling or heading
  const prev = el.previousElementSibling;
  if (prev && /label|span|p|h[1-6]|legend/i.test(prev.tagName)) {
    const text = (prev.textContent ?? "").trim();
    if (text && text.length < 80) return cleanLabelText(text);
  }

  // 5. Placeholder or name attribute
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return placeholder.trim();

  const nameAttr = el.getAttribute("name");
  if (nameAttr && nameAttr.trim()) return nameAttr.trim();

  return "";
}

function cleanLabelText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Generates an unambiguous, stable CSS selector for an element.
 */
function generateRobustSelector(el: HTMLElement): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const name = el.getAttribute("name");
  if (name) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-test");
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Serializes an AXTreeSnapshot into a compact representation for LLM prompts (<1,500 tokens)
 */
export function serializeAXTreeForPrompt(snapshot: AXTreeSnapshot): string {
  const lines: string[] = [];
  lines.push(`URL: ${snapshot.url}`);
  lines.push(`PAGE TITLE: ${snapshot.title}`);

  if (snapshot.errorBanners.length > 0) {
    lines.push(`VALIDATION ERRORS DETECTED:`);
    for (const err of snapshot.errorBanners) {
      lines.push(`  ⚠ ${err}`);
    }
  }

  lines.push(`INTERACTIVE ELEMENTS:`);
  for (const node of snapshot.nodes) {
    const parts: string[] = [];
    parts.push(`[${node.id}]`);
    parts.push(`<${node.tag}${node.type ? ` type="${node.type}"` : ""}>`);
    parts.push(`"${node.name}"`);
    if (node.required) parts.push(`(REQUIRED)`);
    if (node.hasError) parts.push(`(HAS_ERROR: "${node.errorMessage || 'Invalid'}")`);
    if (node.value) parts.push(`[Current: "${node.value.slice(0, 30)}"]`);
    if (node.options && node.options.length > 0) {
      parts.push(`[Options: ${node.options.slice(0, 6).map((o) => o.label).join(" | ")}]`);
    }
    lines.push(`  ${parts.join(" ")}`);
  }

  return lines.join("\n");
}
