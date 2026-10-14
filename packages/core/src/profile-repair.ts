/**
 * Profile auto-repair — fixes common data issues before autofill.
 */
import type { Profile } from "./types.js";

export interface ProfileRepair {
  field: string;
  action: string;
  before: string;
  after: string;
}

const SENSITIVE_ANSWER_KEY = /password|passwd|secret|ssn|social.security|credit.card|cvv|pin\s*code/i;

/** Normalize CTC: annual INR (800000) → LPA (8), leave small values as LPA. */
export function normalizeCTCToLpa(val: string): string {
  const n = parseFloat(val?.replace(/,/g, "") ?? "");
  if (!val?.trim() || isNaN(n)) return val?.trim() ?? "";
  if (n >= 100000) return String(n / 100000);
  if (n >= 1000 && n < 100000) return String(Math.round((n / 100000) * 10) / 10);
  return val.trim();
}

/** Convert profile CTC (LPA) or raw annual INR to annual salary for forms. */
export function salaryToAnnual(val: string): string {
  const n = parseFloat(val?.replace(/,/g, "") ?? "");
  if (!val?.trim() || isNaN(n)) return "";
  if (n >= 100000) return String(Math.round(n));
  if (n <= 99) return String(Math.round(n * 100000));
  return String(Math.round(n));
}

export function repairProfile(profile: Profile): { profile: Profile; repairs: ProfileRepair[] } {
  const repairs: ProfileRepair[] = [];
  // Defensive: tolerate partial / malformed profile objects from storage.
  const safe = profile ?? ({} as Profile);
  const next: Profile = {
    ...safe,
    customAnswers: { ...(safe.customAnswers ?? {}) },
    experience: Array.isArray(safe.experience) ? safe.experience.map((e) => ({ ...e })) : [],
    education: Array.isArray((safe as any).education) ? (safe as any).education : [],
    projects: Array.isArray((safe as any).projects) ? (safe as any).projects : [],
    certifications: Array.isArray((safe as any).certifications) ? (safe as any).certifications : [],
    skills: Array.isArray(safe.skills) ? safe.skills : (typeof safe.skills === "string" ? String(safe.skills).split(/[,\n;]/).map(s => s.trim()).filter(Boolean) : []),
    firstName: typeof safe.firstName === "string" ? safe.firstName : "",
    lastName: typeof safe.lastName === "string" ? safe.lastName : "",
    email: typeof safe.email === "string" ? safe.email : "",
    phone: typeof safe.phone === "string" ? safe.phone : "",
    updatedAt: Date.now(),
  } as Profile;

  for (const key of ["currentCTC", "expectedCTC"] as const) {
    const raw = (next as any)[key];
    const asStr = typeof raw === "string" ? raw : (raw == null ? "" : String(raw));
    const normalized = normalizeCTCToLpa(asStr);
    if (normalized && normalized !== (next as any)[key]) {
      repairs.push({
        field: key,
        action: "normalize-ctc-lpa",
        before: "[REDACTED]",
        after: "[REDACTED]",
      });
      (next as any)[key] = normalized;
    }
  }

  const noticeRaw = (next as any).noticePeriod;
  const notice = typeof noticeRaw === "string" ? noticeRaw.trim() : (noticeRaw == null ? "" : String(noticeRaw).trim());
  if ((notice === "0" || /^immediate$/i.test(notice)) && next.immediateJoiner !== "Yes") {
    repairs.push({
      field: "immediateJoiner",
      action: "sync-notice-period",
      before: "[REDACTED]",
      after: "[REDACTED]",
    });
    next.immediateJoiner = "Yes";
  }

  if (Array.isArray(next.experience) && next.experience[0]) {
    const exp = next.experience[0];
    const looksCurrent =
      exp.current ||
      /present|current|now/i.test(exp.endDate ?? "");
    if (!exp.current && looksCurrent) {
      next.experience[0] = { ...exp, current: true, endDate: exp.endDate || "Present" };
      repairs.push({
        field: "experience[0].current",
        action: "mark-current-job",
        before: "[REDACTED]",
        after: "[REDACTED]",
      });
    }
  }

  const nameParts = next.firstName.trim().split(/\s+/);
  if (nameParts.length >= 2 && !next.middleName?.trim()) {
    next.firstName = nameParts[0];
    next.middleName = nameParts.slice(1).join(" ");
    repairs.push({
      field: "firstName",
      action: "split-combined-name",
      before: "[REDACTED]",
      after: "[REDACTED]",
    });
  }

  for (const [k, v] of Object.entries(next.customAnswers)) {
    if (SENSITIVE_ANSWER_KEY.test(k)) {
      delete next.customAnswers[k];
      repairs.push({
        field: `customAnswers.${k}`,
        action: "remove-sensitive",
        before: "[REDACTED]",
        after: "(removed)",
      });
    }
  }

  if (!next.lastWorkingDay?.trim() && /^0$|^immediate$/i.test(notice)) {
    const today = new Date().toISOString().slice(0, 10);
    next.lastWorkingDay = today;
    repairs.push({
      field: "lastWorkingDay",
      action: "infer-immediate-joiner",
      before: "[REDACTED]",
      after: "[REDACTED]",
    });
  }

  return { profile: next, repairs };
}
