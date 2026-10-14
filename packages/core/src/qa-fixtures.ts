/**
 * QA fixture & oracle contracts — a versioned schema for recording real
 * application flows (form steps/controls, provenance, final-action oracle) so
 * automation changes can be regression-tested against captured ground truth.
 *
 * LICENSE / ATTRIBUTION:
 * TypeScript adaptation of `qa/contracts.py` (schema constants, per-key
 * validation, semantic field catalog) from the MIT-licensed repository
 * "job-apply-plugin" (neonwatty/job-apply-plugin), Copyright (c) 2025 Jeremy
 * Watt, used under the MIT License (notice preserved in THIRD_PARTY_NOTICES.md).
 * Changes for SJA: TypeScript types + structural validator returning a typed
 * problem list (instead of Python set membership asserts), regexes compiled
 * once, and the catalog extended/normalized as SJA's own fixture corpus grows.
 */

export const FIXTURE_SCHEMA_VERSION = 1;
export const FIXTURE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/;
export const CAPTURE_MONTH_RE = /^20[0-9]{2}-(?:0[1-9]|1[0-2])$/;
export const SHA256_RE = /^[a-f0-9]{64}$/;

export const FIXTURE_KEYS = [
  "schemaVersion",
  "id",
  "platformFamily",
  "captureMonth",
  "compilerVersion",
  "provenance",
  "steps",
  "oracle",
] as const;

export const STEP_KEYS = ["id", "kind", "title", "controls", "next", "finalAction"] as const;
export const STEP_KINDS = ["form", "review"] as const;
export const CONTROL_KEYS = ["id", "kind", "role", "label", "required", "choices"] as const;
export const PROVENANCE_KEYS = ["recorderVersion", "captureMonth", "sourceRecordingSha256"] as const;
export const FINAL_ACTION_KEYS = ["id", "label", "enabled", "tripwire"] as const;
export const ORACLE_KEYS = ["finalActionActivations"] as const;

/** Widget roles used by the field catalog (semantic id -> (role, canonical label)). */
export type WidgetRole =
  | "textbox"
  | "combobox"
  | "radiogroup"
  | "checkbox"
  | "file";

export const FIXTURE_FIELD_CATALOG: Record<string, [WidgetRole, string]> = {
  "contact.full_name": ["textbox", "Full name"],
  "contact.first_name": ["textbox", "First name"],
  "contact.last_name": ["textbox", "Last name"],
  "contact.email": ["textbox", "Email address"],
  "contact.phone_country": ["combobox", "Phone country"],
  "contact.phone": ["textbox", "Phone number"],
  "contact.location": ["combobox", "Current location"],
  "contact.location_city": ["combobox", "City"],
  "resume.file": ["file", "Resume"],
  "cover_letter.file": ["file", "Cover letter"],
  "profile.linkedin": ["textbox", "LinkedIn profile"],
  "profile.github": ["textbox", "GitHub profile"],
  "profile.portfolio": ["textbox", "Portfolio"],
  "profile.website": ["textbox", "Website"],
  "employment.current_company": ["textbox", "Current company"],
  "preference.top_choice": ["checkbox", "Mark as a top choice"],
  "authorization.sponsorship": ["radiogroup", "Will you require employment visa sponsorship?"],
  "authorization.sponsorship_select": ["combobox", "Will you require employment visa sponsorship?"],
  "authorization.work_authorized": ["radiogroup", "Authorized to work in the United States?"],
  "authorization.sponsorship_status": ["radiogroup", "Will you require employment visa sponsorship?"],
  "authorization.us_citizen": ["radiogroup", "United States citizen?"],
  "authorization.green_card": ["radiogroup", "Permanent resident?"],
  "source.discovery": ["combobox", "How did you hear about this opportunity?"],
  "source.discovery_radio": ["radiogroup", "How did you hear about this opportunity?"],
  "referral.contact": ["textbox", "Employee referral contact"],
  "compensation.total_range": ["radiogroup", "Expected total compensation"],
  "compensation.target_salary": ["textbox", "Target salary"],
  "location.us_resident": ["radiogroup", "Live in the United States?"],
  "location.city_state": ["textbox", "City and state"],
  "eeo.gender": ["combobox", "Gender"],
  "eeo.race": ["radiogroup", "Race or ethnicity"],
  "eeo.veteran": ["combobox", "Veteran status"],
  "eeo.disability": ["combobox", "Disability status"],
};

export interface QaControl {
  id: string;
  kind: string;
  role?: string;
  label: string;
  required?: boolean;
  choices?: string[];
}

export interface QaStep {
  id: string;
  kind: string;
  title?: string;
  controls: QaControl[];
  next?: string | null;
  finalAction?: { id: string; label: string; enabled: boolean; tripwire?: boolean } | null;
}

export interface QaProvenance {
  recorderVersion: string;
  captureMonth: string;
  sourceRecordingSha256: string;
}

export interface QaFixture {
  schemaVersion: number;
  id: string;
  platformFamily: string;
  captureMonth: string;
  compilerVersion: string;
  provenance: QaProvenance;
  steps: QaStep[];
  oracle: { finalActionActivations: number };
}

export interface QaValidationIssue {
  path: string;
  message: string;
}

/**
 * Structural validator for a QA fixture. Returns every issue found (empty when
 * the fixture conforms to the contract). Errors on required shape, known keys,
 * value formats (fixture id, capture month, sha256), step kinds, control shape,
 * and oracle shape.
 */
export function validateQaFixture(value: unknown): QaValidationIssue[] {
  const issues: QaValidationIssue[] = [];
  if (typeof value !== "object" || value === null) {
    return [{ path: "$", message: "fixture must be an object" }];
  }
  const fx = value as Record<string, unknown>;

  for (const key of Object.keys(fx)) {
    if (!(FIXTURE_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `$.${key}`, message: `unknown fixture key "${key}"` });
    }
  }

  if (fx.schemaVersion !== FIXTURE_SCHEMA_VERSION) {
    issues.push({ path: "$.schemaVersion", message: `schemaVersion: expected ${FIXTURE_SCHEMA_VERSION}, got ${String(fx.schemaVersion)}` });
  }
  if (typeof fx.id !== "string" || !FIXTURE_ID_RE.test(fx.id)) {
    issues.push({ path: "$.id", message: "fixture id must match ^[a-z0-9]+(?:-[a-z0-9]+)*-v<N>$" });
  }
  if (typeof fx.platformFamily !== "string" || fx.platformFamily.length === 0) {
    issues.push({ path: "$.platformFamily", message: "platformFamily must be a non-empty string" });
  }
  if (typeof fx.captureMonth !== "string" || !CAPTURE_MONTH_RE.test(fx.captureMonth)) {
    issues.push({ path: "$.captureMonth", message: "captureMonth must match ^20YY-MM$" });
  }
  if (typeof fx.compilerVersion !== "string" || fx.compilerVersion.length === 0) {
    issues.push({ path: "$.compilerVersion", message: "compilerVersion must be a non-empty string" });
  }

  if (typeof fx.provenance !== "object" || fx.provenance === null) {
    issues.push({ path: "$.provenance", message: "provenance is required" });
  } else {
    const p = fx.provenance as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      if (!(PROVENANCE_KEYS as readonly string[]).includes(key)) {
        issues.push({ path: `$.provenance.${key}`, message: `unknown provenance key "${key}"` });
      }
    }
    if (typeof p.sourceRecordingSha256 !== "string" || !SHA256_RE.test(p.sourceRecordingSha256)) {
      issues.push({ path: "$.provenance.sourceRecordingSha256", message: "must be a 64-char hex sha256" });
    }
    if (typeof p.captureMonth !== "string" || !CAPTURE_MONTH_RE.test(p.captureMonth)) {
      issues.push({ path: "$.provenance.captureMonth", message: "captureMonth must match ^20YY-MM$" });
    }
  }

  if (typeof fx.oracle !== "object" || fx.oracle === null) {
    issues.push({ path: "$.oracle", message: "oracle is required" });
  } else {
    const o = fx.oracle as Record<string, unknown>;
    for (const key of Object.keys(o)) {
      if (!(ORACLE_KEYS as readonly string[]).includes(key)) {
        issues.push({ path: `$.oracle.${key}`, message: `unknown oracle key "${key}"` });
      }
    }
    if (typeof o.finalActionActivations !== "number" || o.finalActionActivations < 0) {
      issues.push({ path: "$.oracle.finalActionActivations", message: "must be a non-negative number" });
    }
  }

  if (!Array.isArray(fx.steps)) {
    issues.push({ path: "$.steps", message: "steps must be an array" });
    return issues;
  }
  fx.steps.forEach((step, i) => {
    const path = `$.steps[${i}]`;
    if (typeof step !== "object" || step === null) {
      issues.push({ path, message: "step must be an object" });
      return;
    }
    const s = step as Record<string, unknown>;
    for (const key of Object.keys(s)) {
      if (!(STEP_KEYS as readonly string[]).includes(key)) {
        issues.push({ path: `${path}.${key}`, message: `unknown step key "${key}"` });
      }
    }
    if (typeof s.kind !== "string" || !(STEP_KINDS as readonly string[]).includes(s.kind)) {
      issues.push({ path: `${path}.kind`, message: `kind must be one of ${STEP_KINDS.join(", ")}` });
    }
    if (typeof s.id !== "string" || s.id.length === 0) {
      issues.push({ path: `${path}.id`, message: "step id required" });
    }
    if (!Array.isArray(s.controls)) {
      issues.push({ path: `${path}.controls`, message: "controls must be an array" });
    } else {
      s.controls.forEach((ctrl, j) => {
        const cpath = `${path}.controls[${j}]`;
        if (typeof ctrl !== "object" || ctrl === null) {
          issues.push({ path: cpath, message: "control must be an object" });
          return;
        }
        const c = ctrl as Record<string, unknown>;
        for (const key of Object.keys(c)) {
          if (!(CONTROL_KEYS as readonly string[]).includes(key)) {
            issues.push({ path: `${cpath}.${key}`, message: `unknown control key "${key}"` });
          }
        }
        if (typeof c.id !== "string" || c.id.length === 0) issues.push({ path: `${cpath}.id`, message: "control id required" });
        if (typeof c.label !== "string" || c.label.length === 0) issues.push({ path: `${cpath}.label`, message: "control label required" });
        if (typeof c.kind !== "string" || c.kind.length === 0) issues.push({ path: `${cpath}.kind`, message: "control kind required" });
      });
    }
  });

  return issues;
}

/** Convenience boolean + first-issue helpers. */
export function isQaFixtureValid(value: unknown): boolean {
  return validateQaFixture(value).length === 0;
}

export function firstQaFixtureIssue(value: unknown): string | undefined {
  return validateQaFixture(value)[0]?.message;
}
