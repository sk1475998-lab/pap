/**
 * React Fiber Injector — Enterprise deep-DOM state synchronization engine.
 *
 * React-based ATS platforms (Greenhouse, Lever, Ashby, Eightfold, etc.) use
 * React's internal fiber tree to manage form state. Simply setting .value on
 * an input doesn't always trigger React's onChange handler because React
 * overrides the native setter.
 *
 * This module provides:
 * 1. Fiber tree traversal to find React component instances
 * 2. Direct state mutation via fiber's memoizedProps/memoizedState
 * 3. Synthetic event dispatch that React's event system recognizes
 * 4. React Select / custom component integration
 */

/* ------------------------------------------------------------------ */
/* Fiber Tree Types                                                     */
/* ------------------------------------------------------------------ */

interface FiberNode {
  stateNode?: HTMLElement | null;
  memoizedProps?: Record<string, unknown>;
  memoizedState?: unknown;
  pendingProps?: Record<string, unknown>;
  return?: FiberNode | null;
  child?: FiberNode | null;
  sibling?: FiberNode | null;
  type?: unknown;
  tag?: number;
  key?: unknown;
  [key: string]: unknown;
}

interface ReactInstance {
  _reactInternals?: FiberNode;
  _reactInternalFiber?: FiberNode;
  _reactInternalInstance?: FiberNode;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Fiber Access                                                       */
/* ------------------------------------------------------------------ */

/**
 * Get the React fiber node for a DOM element.
 *
 * ⚠️  ISOLATED-WORLD LIMITATION:
 * Chrome Extension content scripts execute in an ISOLATED world by default.
 * React attaches `__reactFiber$*` expandos to DOM nodes from the PAGE's JS
 * context (the MAIN world). `Object.keys(el)` called from an isolated-world
 * content script returns ONLY native DOM attributes — it CANNOT see expando
 * properties set by page-world scripts.
 *
 * This function therefore returns `null` in standard isolated-world content
 * scripts. It only works correctly when:
 *  a) The content script is declared with `"world": "MAIN"` in the manifest, OR
 *  b) Called from an injected `<script>` element that runs in the main world.
 *
 * Use `injectFiberReaderToMainWorld()` to bridge this gap at runtime.
 *
 * React attaches fiber references to DOM nodes with keys like:
 * - __reactFiber$<hash>
 * - __reactInternalInstance$<hash>
 * - __reactContainer$<hash>
 */
export function getFiberNode(el: Element): FiberNode | null {
  const reactKeys = Object.keys(el).filter(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$") || k.startsWith("__reactContainer$")
  );
  for (const key of reactKeys) {
    const fiber = (el as unknown as Record<string, unknown>)[key] as FiberNode | undefined;
    if (fiber) return fiber;
  }
  return null;
}

/**
 * Inject a script into the PAGE's MAIN world to read React fiber properties
 * that are invisible to isolated-world content scripts.
 *
 * The injected script reads `__reactFiber$*` expandos from the targeted
 * element (accessible in the main world) and posts the memoizedProps back to
 * the content-script layer via a CustomEvent on `window`.
 *
 * Usage:
 * ```typescript
 * const el = document.querySelector('input#email');
 * if (el) {
 *   const props = await injectFiberReaderToMainWorld(el, '__sja_fiber_result');
 *   console.log(props?.value);
 * }
 * ```
 *
 * @param targetEl The element whose React fiber props you want to read.
 * @param eventKey A unique event name to avoid collisions with other injections.
 * @param timeoutMs How long to wait for the main-world script to respond.
 */
export function injectFiberReaderToMainWorld(
  targetEl: Element,
  eventKey = "__sja_fiber_result",
  timeoutMs = 500
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    // Listen for the result before injecting the script
    const onResult = (e: Event) => {
      window.removeEventListener(eventKey, onResult);
      clearTimeout(timer);
      const detail = (e as CustomEvent).detail as Record<string, unknown> | null;
      resolve(detail ?? null);
    };
    window.addEventListener(eventKey, onResult);

    const timer = setTimeout(() => {
      window.removeEventListener(eventKey, onResult);
      resolve(null);
    }, timeoutMs);

    // Build a data attribute selector for the target element so the injected
    // script can locate it without needing a direct object reference.
    const uid = `sja_fiber_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    targetEl.setAttribute("data-sja-fiber-uid", uid);

    const script = document.createElement("script");
    script.textContent = `
      (function() {
        const el = document.querySelector('[data-sja-fiber-uid="${uid}"]');
        if (!el) { window.dispatchEvent(new CustomEvent("${eventKey}", { detail: null })); return; }
        el.removeAttribute("data-sja-fiber-uid");
        const fiberKey = Object.keys(el).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
        const fiber = fiberKey ? el[fiberKey] : null;
        const props = fiber ? (fiber.memoizedProps || fiber.pendingProps || null) : null;
        window.dispatchEvent(new CustomEvent("${eventKey}", { detail: props ? JSON.parse(JSON.stringify(props)) : null }));
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  });
}

/**
 * Get the React component instance (props) from a fiber node.
 */
export function getReactProps(el: Element): Record<string, unknown> | null {
  const fiber = getFiberNode(el);
  if (!fiber) return null;
  return fiber.memoizedProps ?? fiber.pendingProps ?? null;
}

/**
 * Walk up the fiber tree to find a specific component type.
 * Useful for finding the parent form component or field wrapper.
 */
export function walkFiberUp(fiber: FiberNode | null, predicate: (f: FiberNode) => boolean): FiberNode | null {
  let current = fiber;
  let depth = 0;
  while (current && depth < 50) {
    if (predicate(current)) return current;
    current = current.return ?? null;
    depth++;
  }
  return null;
}

/**
 * Walk down the fiber tree to find all components matching a predicate.
 */
export function walkFiberDown(fiber: FiberNode | null, predicate: (f: FiberNode) => boolean, maxDepth = 20): FiberNode[] {
  const results: FiberNode[] = [];
  const stack: { node: FiberNode; depth: number }[] = [];
  if (fiber) stack.push({ node: fiber, depth: 0 });

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > maxDepth) continue;
    if (predicate(node)) results.push(node);
    if (node.child) stack.push({ node: node.child, depth: depth + 1 });
    if (node.sibling) stack.push({ node: node.sibling, depth: depth + 1 });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* React-Aware Value Setting                                          */
/* ------------------------------------------------------------------ */

/**
 * Get the native input value setter from the prototype chain.
 * This bypasses React's overridden setter.
 */
const NATIVE_INPUT_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  } catch {
    return undefined;
  }
})();

const NATIVE_TEXTAREA_SETTER = (() => {
  try {
    return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  } catch {
    return undefined;
  }
})();

/**
 * Set a value on a React-controlled input using the native setter,
 * then dispatch events that React's event system recognizes.
 *
 * This is the key trick: React overrides the native setter to track changes.
 * By using the prototype's setter directly, we bypass React's tracking,
 * then trigger a synthetic event that React interprets as a user change.
 */
export function setReactValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const isInput = el instanceof HTMLInputElement;
  const setter = isInput ? NATIVE_INPUT_SETTER : NATIVE_TEXTAREA_SETTER;

  // Use native setter to bypass React's override
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  // Dispatch the event sequence React listens for
  // React 16+ uses the "input" event for controlled components
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  // Also dispatch React's synthetic event tracker key
  // React uses a special property to track the last value
  const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  if (fiberKey) {
    const suffix = fiberKey.slice("__reactFiber$".length);
    const trackerKey = `__reactValueTracker$${suffix}`;
    (el as unknown as Record<string, unknown>)[trackerKey] = value;
  }
  const vt = (el as any)._valueTracker;
  if (vt && typeof vt.setValue === "function") {
    try { vt.setValue(""); } catch {}
  }
}

/**
 * Trigger a React-compatible click on an element.
 * Some React components (like custom checkboxes, radio buttons) need
 * specific event sequences to update their internal state.
 */
export function triggerReactClick(el: HTMLElement): void {
  // Full mouse event sequence that React's event delegation expects
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  // Also try the native click (some React portals need this)
  try { el.click(); } catch { /* some elements don't support .click() */ }
}

/**
 * Focus a React-controlled element and trigger focus events.
 */
export function triggerReactFocus(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  el.focus();
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

/**
 * Blur a React-controlled element and trigger blur events.
 */
export function triggerReactBlur(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  el.blur();
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

/* ------------------------------------------------------------------ */
/* React Select Integration                                           */
/* ------------------------------------------------------------------ */

/**
 * Detect if an element is a React Select component.
 */
export function isReactSelect(el: Element): boolean {
  return Boolean(
    el.closest("[class*='react-select'], [class*='__control'], [class*='Select__control']") ||
    el.getAttribute("class")?.includes("__control") ||
    el.getAttribute("class")?.includes("react-select")
  );
}

/**
 * Fill a React Select dropdown by:
 * 1. Clicking the control to open the menu
 * 2. Finding the option in the menu
 * 3. Clicking the option to select it
 */
export async function fillReactSelect(control: HTMLElement, targetText: string): Promise<boolean> {
  // Click to open the dropdown menu
  triggerReactClick(control);
  await new Promise((r) => setTimeout(r, 150));

  // Find the menu container
  const menu = control.closest("[class*='react-select']")?.querySelector(
    "[class*='__menu'], [class*='__menu-list'], [class*='menu-list']"
  ) ?? document.querySelector("[class*='__menu-list']:not([style*='display: none'])");

  if (!menu) return false;

  // Find the option matching our target text
  const options = menu.querySelectorAll<HTMLElement>(
    "[class*='__option'], [class*='option'], [role='option']"
  );

  for (const option of options) {
    const text = option.textContent?.trim() ?? "";
    if (text.toLowerCase().includes(targetText.toLowerCase()) ||
        targetText.toLowerCase().includes(text.toLowerCase())) {
      triggerReactClick(option);
      await new Promise((r) => setTimeout(r, 100));
      return true;
    }
  }

  // Close the menu if we didn't find a match
  triggerReactBlur(control);
  return false;
}

/* ------------------------------------------------------------------ */
/* Full React-Aware Fill Sequence                                     */
/* ------------------------------------------------------------------ */

/**
 * Perform a complete React-aware fill sequence on an input element.
 * This is the recommended way to fill React-controlled form fields:
 *
 * 1. Focus the element (triggers React's onFocus)
 * 2. Set value via native setter (bypasses React's override)
 * 3. Dispatch input event (triggers React's onChange)
 * 4. Dispatch change event (triggers form validation)
 * 5. Blur the element (triggers React's onBlur)
 */
export async function reactAwareFill(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  opts: { skipFocus?: boolean; skipBlur?: boolean; delay?: number } = {}
): Promise<void> {
  const { skipFocus = false, skipBlur = false, delay = 50 } = opts;

  if (!skipFocus) {
    triggerReactFocus(el);
    await new Promise((r) => setTimeout(r, delay));
  }

  setReactValue(el, value);
  await new Promise((r) => setTimeout(r, delay));

  if (!skipBlur) {
    triggerReactBlur(el);
  }
}

/**
 * Check if an element is controlled by React.
 */
export function isReactControlled(el: Element): boolean {
  return Boolean(
    getFiberNode(el) ||
    Object.keys(el).some((k) => k.startsWith("__react"))
  );
}
