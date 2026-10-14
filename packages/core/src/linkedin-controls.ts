/**
 * LinkedIn apply-control classification.
 *
 * Capability source: autoApplylinkedin (MV3 content engine) documented that
 * LinkedIn's job-list apply surface changed across UIs and that text/class-only
 * matching is unreliable. Its resilient approach — distinguish by
 *   * easy apply (in-app) vs external apply (off-platform),
 *   * legacy jobs page vs the newer SDUI apply flow,
 *   * excluding the "LinkedIn Apply" search *filter pill*,
 * and compare labels case-insensitively (LinkedIn varies casing) — is
 * re-expressed here as a dependency-free, unit-testable classifier. No source
 * code was copied; selectors are authored independently from the observed
 * public DOM signals.
 *
 * These pure helpers let both the Playwright applier (`openEasyApply`) and any
 * content-script path decide what an element *is* before acting on it.
 */

export type LinkedInApplyControlKind =
  /** In-app Easy Apply flow. */
  | "easy-apply"
  /** External "Apply on company website" (off-platform hand-off). */
  | "external-apply"
  /** A search filter pill whose label merely reads "LinkedIn Apply". */
  | "filter-pill"
  /** Not an apply control. */
  | "other";

export interface LinkedInElementSignals {
  tagName?: string;
  ariaLabel?: string;
  href?: string;
  className?: string;
  role?: string;
  text?: string;
}

function lower(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** True if the class list marks an "artdeco pill" (search filter UI). */
function isArtdecoPill(className?: string): boolean {
  return /(^|\s)artdeco-pill(\s|$)/.test(className ?? "");
}

/**
 * Classify a LinkedIn job-list apply element from its observable signals.
 * Conservative by design: an element is only treated as a real apply control
 * when it carries an explicit LinkedIn apply marker; everything else resolves
 * to "other"/"filter-pill" so the pipeline never mis-clicks a non-apply UI.
 */
export function classifyLinkedInApplyControl(
  el: LinkedInElementSignals,
): LinkedInApplyControlKind {
  const a = lower(el.ariaLabel);
  const href = lower(el.href);
  const text = lower(el.text);
  const cls = el.className ?? "";
  const isBtn = el.tagName === "BUTTON" || el.tagName === "A";
  const pillish = el.role === "radio" || isArtdecoPill(el.className);

  // 1. Search-filter pill: role=radio / artdeco-pill whose label is exactly
  //    "LinkedIn Apply" / "LinkedIn Apply filter." — never click this.
  if (pillish && (a === "linkedin apply" || a.startsWith("linkedin apply filter"))) {
    return "filter-pill";
  }

  // 2. External apply — explicit off-platform marker.
  if (a === "apply on company website") return "external-apply";

  // 3. SDUI apply-flow link (in-app). The flow flag is a stable marker.
  if (el.tagName === "A" && href.includes("opensduiapplyflow=true")) {
    return "easy-apply";
  }

  // 4. aria-label prefix "LinkedIn Apply to …" — covers legacy AND SDUI,
  //    while excluding the search pill (which only says "LinkedIn Apply").
  if (isBtn && !pillish && a.startsWith("linkedin apply to")) {
    return "easy-apply";
  }

  // 5. Legacy fallback: jobs-apply-button class that is not a filter pill and
  //    whose own text mentions Easy Apply.
  if (isBtn && !pillish && cls.includes("jobs-apply-button")) {
    if (text.includes("easy apply")) return "easy-apply";
    // A jobs-apply-button with a company-website label (different casing/spacing).
    if (a.includes("apply on company")) return "external-apply";
  }

  return "other";
}

/** Compact CSS selectors for in-app Easy Apply (both UIs), for Playwright. */
export function linkedInEasyApplySelectors(): string[] {
  return [
    // aria-label prefix covers legacy + SDUI; exclude the radio filter pill.
    'button[aria-label^="LinkedIn Apply to"], a[aria-label^="LinkedIn Apply to"]',
    // SDUI apply-flow link.
    'a[href*="openSDUIApplyFlow=true"]',
  ];
}

/** Compact CSS selectors for external (company-website) apply. */
export function linkedInExternalApplySelectors(): string[] {
  return [
    'button[aria-label="Apply on company website"], a[aria-label="Apply on company website"]',
  ];
}
