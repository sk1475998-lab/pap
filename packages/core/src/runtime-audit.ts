/**
 * Runtime audit — analyzes each autofill run and recommends fixes.
 */
import { brainGaps } from "./profile-brain.js";
import type { ProfileRepair } from "./profile-repair.js";
import type { Profile } from "./types.js";

export type FieldAuditStatus = "filled" | "skipped" | "already_filled" | "failed";

export interface FieldAuditLine {
  label: string;
  fieldKey: string;
  status: FieldAuditStatus;
  reason: string;
  value?: string;
  suggestion?: string;
}

export interface RunAuditReport {
  ts: number;
  url: string;
  hostname: string;
  platform?: string;
  stepHash?: string;
  repairs: ProfileRepair[];
  fieldResults: FieldAuditLine[];
  profileGaps: string[];
  summary: {
    total: number;
    filled: number;
    skipped: number;
    failed: number;
    alreadyFilled: number;
  };
  recommendations: string[];
}

const PROFILE_FIELD_HINTS: Record<string, string> = {
  middleName: "Profile → contact → Middle name",
  gender: "Profile → screening → Gender",
  birthDay: "Profile → screening → Date of birth",
  birthMonth: "Profile → screening → Date of birth",
  birthYear: "Profile → screening → Date of birth",
  dateOfBirth: "Profile → screening → Date of birth",
  experienceYears: "Profile → screening → Years of experience",
  experienceMonths: "Profile → screening → Years of experience",
  currentCTC: "Profile → screening → Current CTC (LPA, e.g. 8)",
  expectedCTC: "Profile → screening → Expected CTC (LPA)",
  annualCurrentSalary: "Profile → Current CTC — use LPA (8 not 800000)",
  annualExpectedSalary: "Profile → Expected CTC — use LPA",
  noticePeriod: "Profile → screening → Notice period",
  lastWorkingDay: "Profile → screening → Last working day",
  company: "Profile → work experience → Company",
  jobTitle: "Profile → work experience → Title",
  gpa: "Profile → education GPA / diploma %",
  pan: "Profile → Step 3 → PAN number",
  skills: "Profile → skills from resume (or fill once manually)",
  resumeFile: "Profile → re-upload resume PDF",
};

function classifyDetail(
  label: string,
  fieldKey: string,
  ok: boolean,
  value: string
): FieldAuditLine {
  if (value === "(already filled)") {
    return {
      label,
      fieldKey,
      status: "already_filled",
      reason: "pre-filled on page",
      value,
    };
  }
  if (ok) {
    return { label, fieldKey, status: "filled", reason: "autofilled", value: value.slice(0, 80) };
  }
  if (value === "no resume file stored") {
    return {
      label,
      fieldKey,
      status: "skipped",
      reason: "resume blob missing",
      suggestion: PROFILE_FIELD_HINTS.resumeFile,
    };
  }
  if (value === "sensitive — set in Profile") {
    return {
      label,
      fieldKey,
      status: "skipped",
      reason: "sensitive field",
      suggestion: `Set "${label}" manually in Profile`,
    };
  }
  if (value === "no value" || !value) {
    const hint = PROFILE_FIELD_HINTS[fieldKey];
    return {
      label,
      fieldKey,
      status: "skipped",
      reason: "no profile value mapped",
      suggestion: hint ?? `Fill "${label}" once — brain will remember`,
    };
  }
  return {
    label,
    fieldKey,
    status: "failed",
    reason: value,
    suggestion: "Field detected but fill failed — check Diagnostics",
  };
}

export function buildRunAudit(
  profile: Profile,
  repairs: ProfileRepair[],
  details: { label: string; ok: boolean; value: string }[],
  fields: { label: string; fieldKey?: string }[],
  meta: { url: string; platform?: string; stepHash?: string }
): RunAuditReport {
  const fieldResults = details.map((d, i) =>
    classifyDetail(d.label, fields[i]?.fieldKey ?? "", d.ok, d.value)
  );

  const filled = fieldResults.filter((f) => f.status === "filled").length;
  const skipped = fieldResults.filter((f) => f.status === "skipped").length;
  const failed = fieldResults.filter((f) => f.status === "failed").length;
  const alreadyFilled = fieldResults.filter((f) => f.status === "already_filled").length;

  const profileGaps = brainGaps(profile);
  const recommendations: string[] = [];

  if (repairs.length) {
    recommendations.push(`Auto-repaired ${repairs.length} profile issue(s): ${repairs.map((r) => r.action).join(", ")}`);
  }
  for (const gap of profileGaps) {
    recommendations.push(`Profile gap: add ${gap} in Profile tab`);
  }
  const skippedFields = fieldResults.filter((f) => f.status === "skipped");
  const uniqueSuggestions = [
    ...new Set(skippedFields.map((f) => f.suggestion).filter(Boolean) as string[]),
  ];
  for (const s of uniqueSuggestions.slice(0, 6)) {
    recommendations.push(s);
  }
  if (skippedFields.some((f) => f.reason === "resume blob missing")) {
    recommendations.push("Re-upload resume in Profile tab to enable PDF upload on external sites");
  }
  if (failed > 0) {
    recommendations.push(`${failed} field(s) failed to fill — export Diagnostics JSON for details`);
  }
  if (filled === 0 && skipped > 0) {
    recommendations.push("No fields filled — complete Profile mandatory steps first");
  }

  let hostname = "";
  try {
    hostname = new URL(meta.url).hostname;
  } catch {
    hostname = meta.url.slice(0, 60);
  }

  return {
    ts: Date.now(),
    url: meta.url.slice(0, 300),
    hostname,
    platform: meta.platform,
    stepHash: meta.stepHash,
    repairs,
    fieldResults,
    profileGaps,
    summary: { total: fieldResults.length, filled, skipped, failed, alreadyFilled },
    recommendations,
  };
}

/** Detect if a new wizard step appeared (field count or hash changed). */
export function detectStepChange(
  prevFieldCount: number,
  prevHash: string,
  currentFieldCount: number,
  currentHash: string
): boolean {
  if (currentHash && currentHash !== prevHash) return true;
  return currentFieldCount > prevFieldCount + 1;
}
