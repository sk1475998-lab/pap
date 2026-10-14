/** LinkedIn-specific DOM helpers for Easy Apply and job detail pages. */

export function isLinkedInJobsUrl(url: string = location.href): boolean {
  return /linkedin\.com\/jobs/i.test(url);
}

/**
 * Detect an open Easy Apply modal.
 *
 * Updated 2026 selectors — LinkedIn has moved away from the legacy
 * `.jobs-easy-apply-modal` class in many regions; we now match any
 * visible artdeco modal whose role=dialog AND whose content contains
 * easy-apply markers.
 */
export function isLinkedInEasyApplyOpen(doc: Document = document): boolean {
  // 1. Explicit legacy + current easy-apply classes
  const explicit = doc.querySelector(
    '.jobs-easy-apply-modal, ' +
    '[data-test-modal-id="easy-apply-modal"], ' +
    '.jobs-easy-apply-content, ' +
    '.jobs-easy-apply-form-container, ' +
    '[data-test-easy-apply-modal], ' +
    '.jobs-apply-modal, ' +
    '.jobs-easy-apply-modal__content, ' +
    '.jobs-easy-apply-footer, ' +
    'div[data-view-name*="easy-apply"], ' +
    'div[class*="jobs-easy-apply"], ' +
    'div[class*="jobs-apply-modal"]'
  );
  if (explicit && isElementActuallyVisible(explicit as HTMLElement)) return true;

  // 1.5 Shadow DOM Piercing (SDUI 2026 UI)
  const shadowHost = doc.querySelector('[data-testid="interop-shadowdom"]');
  if (shadowHost && shadowHost.shadowRoot) {
    const shadowExplicit = shadowHost.shadowRoot.querySelector(
      '.jobs-easy-apply-modal, ' +
      '[data-test-modal-id="easy-apply-modal"], ' +
      '.jobs-easy-apply-content, ' +
      '.jobs-easy-apply-form-container, ' +
      '[data-test-easy-apply-modal], ' +
      '.jobs-apply-modal, ' +
      '.jobs-easy-apply-modal__content, ' +
      '.jobs-easy-apply-footer, ' +
      'div[data-view-name*="easy-apply"], ' +
      'div[class*="jobs-easy-apply"], ' +
      'div[class*="jobs-apply-modal"]'
    );
    if (shadowExplicit && isElementActuallyVisible(shadowExplicit as HTMLElement)) return true;
  }

  // 2. Any open artdeco modal or dialog that contains easy-apply content or Apply header.
  //    This catches LinkedIn's 2025/2026 dynamic/hashed class names and step headers.
  const openModals = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '.artdeco-modal--is-open, [role="dialog"], dialog[open], .artdeco-modal, [data-test-modal-id]'
    )
  );
  for (const modal of openModals) {
    if (!isElementActuallyVisible(modal)) continue;
    // Disambiguate: dismiss modals for Sign-in / Premium upsell should NOT count
    const modalText = (modal.textContent ?? "").toLowerCase();
    if (/sign in to continue|get linkedin premium|try premium for free|you're signed out/i.test(modalText)) {
      continue;
    }

    const hasApplyHeader = !!modal.querySelector('h1, h2, h3, [role="heading"], [class*="header"]');
    const headerContent = modal.querySelector('h1, h2, h3, [role="heading"]')?.textContent ?? "";
    const isApplyHeader = /apply to\s+/i.test(headerContent) || /apply to\s+/i.test(modalText.slice(0, 150));

    const hasStepNavBtn = !!modal.querySelector(
      'button[aria-label*="Submit application"], button[aria-label*="Next"], button[aria-label*="Review"], ' +
      'button[data-easy-apply-next-button], .jobs-apply-button, [class*="easy-apply-footer"] button'
    ) || Array.from(modal.querySelectorAll("button, [role='button']")).some(b => {
      const txt = (b.textContent ?? "").trim().toLowerCase();
      return /^(next|review|submit application|continue|submit)$/i.test(txt);
    });

    if (
      isApplyHeader ||
      hasStepNavBtn ||
      modal.querySelector('[class*="easy-apply"], [class*="jobs-apply-form"], ' +
        'form[id*="apply"], [data-test-easy-apply], [class*="jobs-easy-apply"], .jobs-easy-apply-footer, ' +
        '.jobs-document-upload, .jobs-resume-picker, .jobs-document-card, input[type="radio"][name*="resume"]') ||
      /easy apply|contact info|work authorization|resume|submit application|additional questions|screening questions|home address/i.test(modalText)
    ) {
      return true;
    }
  }

  // 2.5 Shadow DOM piercing for open modals
  if (shadowHost && shadowHost.shadowRoot) {
    const shadowModals = Array.from(
      shadowHost.shadowRoot.querySelectorAll<HTMLElement>(
        '.artdeco-modal--is-open, [role="dialog"][aria-modal="true"], .artdeco-modal, [data-test-modal-id]'
      )
    );
    for (const modal of shadowModals) {
      if (!isElementActuallyVisible(modal)) continue;
      const modalText = (modal.textContent ?? "").toLowerCase();
      if (/sign in to continue|get linkedin premium|try premium for free|you're signed out/i.test(modalText)) {
        continue;
      }
      if (
        /apply to\s+/i.test(modalText.slice(0, 150)) ||
        modal.querySelector('[class*="easy-apply"], [class*="jobs-apply-form"], ' +
          'form[id*="apply"], [data-test-easy-apply], [class*="jobs-easy-apply"], .jobs-document-upload, .jobs-resume-picker') ||
        /easy apply|contact info|work authorization|resume|submit application/i.test(modalText)
      ) {
        return true;
      }
    }
  }

  // 3. Overlay/backdrop presence with easy-apply form inside body
  const form = doc.querySelector('form[method="post"][id*="apply"], form.jobs-easy-apply-form, form[class*="easy-apply"]');
  if (form && isElementActuallyVisible(form as HTMLElement)) return true;

  return false;
}

export function isLinkedInJobsFeed(url: string = location.href, doc: Document = document): boolean {
  if (!isLinkedInJobsUrl(url)) return false;
  if (isLinkedInEasyApplyOpen(doc)) return false;
  return /linkedin\.com\/jobs\/(search|collections)/i.test(url) || url.includes("/jobs/search");
}

/**
 * Prefer Easy Apply modal → job detail pane → full document.
 */
export function getLinkedInScanRoot(doc: Document = document): ParentNode {
  // 1. Easy apply modal containers (explicit)
  const explicit = doc.querySelector(
    '.jobs-easy-apply-modal, ' +
    '[data-test-modal-id="easy-apply-modal"], ' +
    '.jobs-easy-apply-content, ' +
    '.jobs-easy-apply-form-container, ' +
    'div[class*="jobs-easy-apply"], ' +
    'div[class*="jobs-apply-modal"], ' +
    '[data-test-easy-apply-modal]'
  );
  if (explicit) return explicit;

  // 1.5 Shadow DOM Piercing
  const shadowHost = doc.querySelector('[data-testid="interop-shadowdom"]');
  if (shadowHost && shadowHost.shadowRoot) {
    const shadowExplicit = shadowHost.shadowRoot.querySelector(
      '.jobs-easy-apply-modal, ' +
      '[data-test-modal-id="easy-apply-modal"], ' +
      '.jobs-easy-apply-content, ' +
      '.jobs-easy-apply-form-container, ' +
      'div[class*="jobs-easy-apply"], ' +
      'div[class*="jobs-apply-modal"], ' +
      '[data-test-easy-apply-modal]'
    );
    if (shadowExplicit) return shadowExplicit;
  }

  // 2. Any visible dialog that looks like Easy Apply
  const openModals = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '.artdeco-modal--is-open, [role="dialog"][aria-modal="true"], [role="dialog"], .artdeco-modal, [data-test-modal-id]'
    )
  );
  for (const modal of openModals) {
    if (!isElementActuallyVisible(modal)) continue;
    const modalText = (modal.textContent ?? "").toLowerCase();
    if (/sign in to continue|get linkedin premium|try premium for free|you're signed out/i.test(modalText)) {
      continue;
    }
    const headerContent = modal.querySelector('h1, h2, h3, [role="heading"]')?.textContent ?? "";
    const isApplyHeader = /apply to\s+/i.test(headerContent) || /apply to\s+/i.test(modalText.slice(0, 150));
    const hasStepNavBtn = !!modal.querySelector(
      'button[aria-label*="Submit application"], button[aria-label*="Next"], button[aria-label*="Review"], ' +
      'button[data-easy-apply-next-button], .jobs-apply-button, [class*="easy-apply-footer"] button'
    ) || Array.from(modal.querySelectorAll("button, [role='button']")).some(b => {
      const txt = (b.textContent ?? "").trim().toLowerCase();
      return /^(next|review|submit application|continue|submit)$/i.test(txt);
    });

    if (
      isApplyHeader ||
      hasStepNavBtn ||
      modal.querySelector('[class*="easy-apply"], [class*="jobs-apply-form"], ' +
        'form[id*="apply"], [data-test-easy-apply], [class*="jobs-easy-apply"], .jobs-document-upload, .jobs-resume-picker') ||
      /easy apply|contact info|work authorization|resume/i.test(modalText)
    ) {
      return modal;
    }
  }

  // 2.5 Shadow DOM piercing for modals
  if (shadowHost && shadowHost.shadowRoot) {
    const shadowModals = Array.from(
      shadowHost.shadowRoot.querySelectorAll<HTMLElement>(
        '.artdeco-modal--is-open, [role="dialog"][aria-modal="true"], .artdeco-modal'
      )
    );
    for (const modal of shadowModals) {
      if (!isElementActuallyVisible(modal)) continue;
      if (
        modal.querySelector('[class*="easy-apply"], [class*="jobs-apply-form"], ' +
          'form[id*="apply"], [data-test-easy-apply]') ||
        /easy apply|contact info|work authorization|resume/i.test(modal.textContent ?? "")
      ) {
        return modal;
      }
    }
  }

  // 3. Job detail pane
  const detail = doc.querySelector(
    '.jobs-search__job-details, .jobs-details, .jobs-details__main-content, ' +
    '[class*="job-details-jobs-unified"], .scaffold-layout__detail, ' +
    '.job-view-layout, [class*="jobs-details"]'
  );
  if (detail) return detail;

  return doc;
}

export function linkedInPageHint(url: string = location.href, doc: Document = document): string | null {
  if (!isLinkedInJobsUrl(url)) return null;
  if (isLinkedInEasyApplyOpen(doc)) return null;
  if (isLinkedInJobsFeed(url, doc)) {
    return "Autonomous mode: select a job — Easy Apply will open automatically.";
  }
  if (/linkedin\.com\/jobs\/view/i.test(url) || doc.querySelector("[class*='job-details-jobs-unified']")) {
    return "Autonomous mode: Easy Apply will be clicked automatically.";
  }
  return null;
}

/**
 * Helper: is element actually visible (non-zero rect, display/visibility/opacity).
 */
function isElementActuallyVisible(el: HTMLElement): boolean {
  if (!el || typeof el.getBoundingClientRect !== "function") return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const s = getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Recon-Act: DOM Field Inspector for Easy Apply Forms                   */
/* ------------------------------------------------------------------ */

export interface EasyApplyFieldInfo {
  label: string;
  type: string;
  selector: string;
  required: boolean;
  /** Current value if already filled */
  currentValue?: string;
  /** Placeholder text for additional context */
  placeholder?: string;
}

/**
 * Scan the currently open LinkedIn Easy Apply modal and return structured
 * field metadata. This feeds the Recon Agent's `inspectFormFields` hook.
 *
 * Returns an array of field descriptors ordered top-to-bottom as they
 * appear in the modal — preserving the natural fill order.
 */
export function scanLinkedInEasyApplyFields(
  doc: Document = document
): EasyApplyFieldInfo[] {
  const root = getLinkedInScanRoot(doc);
  if (!root) return [];

  const fields: EasyApplyFieldInfo[] = [];
  const seen = new Set<Element>();

  // --- Inputs (text, tel, email, number, date) ---
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(
    "input[type='text'], input[type='tel'], input[type='email'], " +
    "input[type='number'], input[type='date'], input:not([type='hidden']):not([type='checkbox']):not([type='radio'])"
  ));

  for (const input of inputs) {
    if (seen.has(input) || !isElementActuallyVisible(input)) continue;
    seen.add(input);

    const label = resolveLabel(input, root);
    const selector = buildSelector(input);
    fields.push({
      label,
      type: input.type || "text",
      selector,
      required: input.required || input.getAttribute("aria-required") === "true",
      currentValue: input.value || undefined,
      placeholder: input.placeholder || undefined,
    });
  }

  // --- Textareas (cover letter, additional info) ---
  const textareas = Array.from(root.querySelectorAll<HTMLTextAreaElement>("textarea"));
  for (const ta of textareas) {
    if (seen.has(ta) || !isElementActuallyVisible(ta)) continue;
    seen.add(ta);

    const label = resolveLabel(ta, root);
    const selector = buildSelector(ta);
    fields.push({
      label,
      type: "textarea",
      selector,
      required: ta.required || ta.getAttribute("aria-required") === "true",
      currentValue: ta.value || undefined,
      placeholder: ta.placeholder || undefined,
    });
  }

  // --- Selects ---
  const selects = Array.from(root.querySelectorAll<HTMLSelectElement>("select"));
  for (const sel of selects) {
    if (seen.has(sel) || !isElementActuallyVisible(sel)) continue;
    seen.add(sel);

    const label = resolveLabel(sel, root);
    const selector = buildSelector(sel);
    fields.push({
      label,
      type: "select",
      selector,
      required: sel.required || sel.getAttribute("aria-required") === "true",
      currentValue: sel.value || undefined,
    });
  }

  // --- Radio / Checkbox groups ---
  const radios = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='radio'], input[type='checkbox']"));
  const radioGroups = new Map<string, HTMLInputElement[]>();
  for (const r of radios) {
    const name = r.name || r.id || buildSelector(r);
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    radioGroups.get(name)!.push(r);
  }
  for (const [, group] of radioGroups) {
    const first = group[0];
    if (!first || !isElementActuallyVisible(first)) continue;
    const label = resolveLabel(first, root) || resolveGroupLabel(first, root);
    const selector = `input[name='${CSS.escape(first.name || "")}']`;
    fields.push({
      label,
      type: first.type,
      selector,
      required: first.required || first.getAttribute("aria-required") === "true",
    });
  }

  // --- LinkedIn-specific "artdeco-typeahead" (custom search inputs) ---
  const typeaheads = Array.from(root.querySelectorAll<HTMLElement>(
    ".artdeco-typeahead__input, [data-test-text-entity-list-form-input], " +
    "[class*='typeahead'] input"
  ));
  for (const ta of typeaheads) {
    if (seen.has(ta) || !isElementActuallyVisible(ta)) continue;
    seen.add(ta);
    const input = ta instanceof HTMLInputElement ? ta : ta.querySelector<HTMLInputElement>("input");
    if (!input) continue;
    seen.add(input);
    const label = resolveLabel(input, root) || resolveLabel(ta, root) || "Typeahead field";
    fields.push({
      label,
      type: "text",
      selector: buildSelector(input),
      required: false,
      placeholder: input.placeholder || undefined,
    });
  }

  return fields;
}

/**
 * Resolve the human-readable label for an input element.
 * Tries: aria-label → aria-labelledby → <label for> → parent label → fieldset legend → placeholder
 */
function resolveLabel(el: HTMLElement, root: ParentNode): string {
  // aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/)
      .map((id) => (root as Document).getElementById?.(id)?.textContent?.trim() ?? "")
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  // <label for="id">
  const id = el.id;
  if (id) {
    const explicit = (root as Element).querySelector?.(`label[for='${CSS.escape(id)}']`);
    if (explicit?.textContent?.trim()) return explicit.textContent.trim();
  }

  // parent <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = parentLabel.textContent?.trim().replace(/\s+/g, " ");
    if (text) return text.slice(0, 80);
  }

  // nearby <label> or <span> sibling
  const container = el.closest(".artdeco-form-item, .fb-form-element, [class*='form-item'], .jobs-easy-apply-form-element");
  if (container) {
    const label = container.querySelector("label, .fb-form-element-label, [class*='form-label'], legend");
    if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 80);
  }

  return el.getAttribute("placeholder")?.trim() || el.getAttribute("name") || "Unknown field";
}

/**
 * Resolve group label for radio/checkbox inputs (from fieldset legend or wrapping div).
 */
function resolveGroupLabel(el: HTMLElement, _root: ParentNode): string {
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend?.textContent?.trim()) return legend.textContent.trim();
  }
  const container = el.closest("[role='group']");
  if (container) {
    const label = container.getAttribute("aria-label") ||
      container.querySelector("[class*='label'], legend, span[id]")?.textContent?.trim();
    if (label) return label;
  }
  return "Radio/Checkbox group";
}

/**
 * Build a unique CSS selector for a form element.
 * Prefers id > name > aria attributes > class-based selector.
 */
function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute("name");
  if (name) return `${tag}[name='${CSS.escape(name)}']`;

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return `${tag}[aria-label='${CSS.escape(ariaLabel)}']`;

  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return `${tag}[placeholder='${CSS.escape(placeholder)}']`;

  // Fallback: class-based (less stable but better than nothing)
  const classes = Array.from(el.classList).slice(0, 2).join(".");
  return classes ? `${tag}.${classes}` : tag;
}

/**
 * Extract current Easy Apply step number (LinkedIn shows "Step X of Y").
 * Returns { step, total } or null if not found.
 */
export function getEasyApplyStepInfo(doc: Document = document): { step: number; total: number } | null {
  const root = getLinkedInScanRoot(doc);
  if (!root) return null;

  const progressEl = (root as Element).querySelector?.(
    "[class*='jobs-easy-apply-form-progress'], " +
    ".jobs-easy-apply-header__progress, " +
    "[class*='progress-bar'], " +
    ".artdeco-completeness-meter-linear"
  );

  const headerEl = (root as Element).querySelector?.(
    "h3[class*='easy-apply'], .jobs-easy-apply-header, [class*='easy-apply-header']"
  );

  const text = progressEl?.textContent ?? headerEl?.textContent ?? "";
  const match = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (match) {
    return { step: parseInt(match[1]!, 10), total: parseInt(match[2]!, 10) };
  }
  return null;
}
