/**
 * Profile Brain — maps learned form values into profile + customAnswers.
 * Deduplicates, never overwrites filled structured fields with conflicting data.
 */
import type { Profile } from "./types.js";
import { classifyLabel, isSensitiveQuestion, normalizeQuestion } from "./resolver.js";

export interface LearnedEntry {
  key: string;
  label: string;
  value: string;
  fieldKey: string;
  hostname: string;
  learnedAt: number;
  source: "manual" | "autofill" | "ai";
}

/** Profile keys the brain can auto-fill when empty. */
const STRUCTURED_KEYS: Record<string, keyof Profile> = {
  firstName: "firstName",
  middleName: "middleName",
  lastName: "lastName",
  email: "email",
  phone: "phone",
  city: "city",
  state: "state",
  pincode: "pincode",
  country: "country",
  linkedin: "linkedin",
  github: "github",
  website: "website",
  gender: "gender",
  dateOfBirth: "dateOfBirth",
  yearsOfExperience: "yearsOfExperience",
  currentCTC: "currentCTC",
  expectedCTC: "expectedCTC",
  noticePeriod: "noticePeriod",
  lastWorkingDay: "lastWorkingDay",
  workAuthorization: "workAuthorization",
  requiresSponsorship: "requiresSponsorship",
  pan: "pan",
  aadhaar: "aadhaar",
};

export interface ApplyLearnedResult {
  profile: Profile;
  changed: boolean;
  action: "structured" | "custom" | "experience" | "education" | "skipped" | "duplicate";
  fieldKey: string;
}

export function applyLearnedValue(
  profile: Profile,
  label: string,
  value: string,
  hostname: string,
  source: LearnedEntry["source"] = "manual"
): ApplyLearnedResult {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 500) {
    return { profile, changed: false, action: "skipped", fieldKey: "" };
  }

  const fieldKey = classifyLabel(label);
  const normKey = normalizeQuestion(label);

  if (/\b(password|passwd|secret|pin\s*code)\b/i.test(label)) {
    return { profile, changed: false, action: "skipped", fieldKey };
  }

  // Duplicate check for custom answers
  if (profile.customAnswers[normKey] === trimmed) {
    return { profile, changed: false, action: "duplicate", fieldKey };
  }

  const next = { ...profile, customAnswers: { ...(profile.customAnswers ?? {}) }, updatedAt: Date.now() };
  // Defensive: ensure arrays exist before indexing into them
  if (!Array.isArray(next.experience)) next.experience = [];
  if (!Array.isArray(next.education)) next.education = [];
  if (!Array.isArray(next.skills)) next.skills = [];
  if (!Array.isArray((next as any).projects)) (next as any).projects = [];

  // Work experience company
  if (fieldKey === "workExperienceCompany" || fieldKey === "company") {
    const exp = next.experience[0];
    if (exp && !exp.company?.trim()) {
      next.experience = [{ ...exp, company: trimmed }, ...next.experience.slice(1)];
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "experience");
    }
    if (exp?.company === trimmed) {
      return { profile, changed: false, action: "duplicate", fieldKey };
    }
  }

  // Job title
  if (fieldKey === "jobTitle") {
    const exp = next.experience[0];
    if (exp && !exp.title?.trim()) {
      next.experience = [{ ...exp, title: trimmed }, ...next.experience.slice(1)];
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "experience");
    }
  }

  // Education school/degree
  if (fieldKey === "school" || fieldKey === "degree") {
    const edu = next.education[0] ?? { id: "edu1", school: "", degree: "" };
    if (fieldKey === "school" && !edu.school?.trim()) {
      next.education = [{ ...edu, school: trimmed }, ...next.education.slice(1)];
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "education");
    }
    if (fieldKey === "degree" && !edu.degree?.trim()) {
      next.education = [{ ...edu, degree: trimmed }, ...next.education.slice(1)];
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "education");
    }
  }

  // Location fields → city
  if (fieldKey === "city" || fieldKey === "experienceLocation" || fieldKey === "preferredLocation") {
    if (!next.city?.trim()) {
      next.city = trimmed;
      if (!next.location?.trim()) next.location = trimmed;
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "structured");
    }
    if (next.city === trimmed) {
      return { profile, changed: false, action: "duplicate", fieldKey };
    }
  }

  // Structured profile field
  const profileKey = STRUCTURED_KEYS[fieldKey];
  if (profileKey) {
    const current = String(next[profileKey] ?? "").trim();
    if (!current) {
      (next as Record<string, unknown>)[profileKey] = trimmed;
      return logLearn(next, label, trimmed, fieldKey, hostname, source, "structured");
    }
    if (current === trimmed) {
      return { profile, changed: false, action: "duplicate", fieldKey };
    }
    // Conflict — store as custom answer instead of overwriting
  }

  // Sensitive: only learn via customAnswers (user explicitly typed it)
  if (isSensitiveQuestion(label) && source !== "manual") {
    return { profile, changed: false, action: "skipped", fieldKey };
  }

  // Custom answer cache (dedup)
  if (next.customAnswers[normKey] === trimmed) {
    return { profile, changed: false, action: "duplicate", fieldKey };
  }
  next.customAnswers[normKey] = trimmed;
  return logLearn(next, label, trimmed, fieldKey || "ai", hostname, source, "custom");
}

function logLearn(
  profile: Profile,
  label: string,
  value: string,
  fieldKey: string,
  hostname: string,
  source: LearnedEntry["source"],
  action: ApplyLearnedResult["action"]
): ApplyLearnedResult {
  const log = [...(profile.learnedLog ?? [])];
  const entry: LearnedEntry = {
    key: normalizeQuestion(label),
    label: label.slice(0, 120),
    // Learned entries are diagnostic metadata; the actual answer remains in
    // its profile field/cache and must not be duplicated into a general log.
    value: "[REDACTED]",
    fieldKey,
    hostname,
    learnedAt: Date.now(),
    source,
  };
  // Keep last 100 entries, dedupe by key+value
  if (!log.some((e) => e.key === entry.key && e.value === entry.value)) {
    log.push(entry);
    if (log.length > 100) log.splice(0, log.length - 100);
  }
  profile.learnedLog = log;
  return { profile, changed: true, action, fieldKey };
}

/** Summarize what the brain still needs for common India forms. */
export function brainGaps(profile: Profile): string[] {
  const gaps: string[] = [];
  if (!profile.expectedCTC) gaps.push("Expected CTC");
  if (!profile.currentCTC) gaps.push("Current CTC");
  if (!profile.noticePeriod) gaps.push("Notice period");
  if (!profile.yearsOfExperience) gaps.push("Years of experience");
  if (!profile.gender) gaps.push("Gender");
  if (!profile.dateOfBirth) gaps.push("Date of birth");
  if (!(Array.isArray(profile.experience) && profile.experience[0]?.company)) gaps.push("Current company");
  if (!profile.city) gaps.push("City");
  return gaps;
}
