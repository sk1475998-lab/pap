/** Marks synthetic autofill activity so learning observes user edits only. */
const PROGRAMMATIC_AUTOFILL_UNTIL_ATTR = "data-sja-programmatic-until";

export function markProgrammaticAutofill(el: Element, durationMs = 2_000): void {
  el.setAttribute(PROGRAMMATIC_AUTOFILL_UNTIL_ATTR, String(Date.now() + durationMs));
}

export function isProgrammaticAutofillEvent(el: Element): boolean {
  return Number(el.getAttribute(PROGRAMMATIC_AUTOFILL_UNTIL_ATTR) ?? 0) > Date.now();
}
