/**
 * Sensitive profile redaction utilities.
 *
 * General profile data and high-risk PII must not share every execution path.
 * These helpers create safe views for LLM prompts, logs, and normal autofill.
 */
import type { Profile, ProfileLookup } from "@superjob/core";

export const SENSITIVE_PROFILE_KEYS = [
  "pan",
  "aadhaar",
  "ssn",
  "passportNumber",
  "drivingLicenseNumber",
  "defaultLoginPassword",
  "i94ExpiryDate",
  "visaExpiryDate",
] as const;

export type SensitiveProfileKey = (typeof SENSITIVE_PROFILE_KEYS)[number];

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_PROFILE_KEYS);

export function redactSensitiveProfile<T extends Partial<Profile>>(profile: T): T {
  const clone: Record<string, unknown> = { ...profile };
  for (const key of SENSITIVE_PROFILE_KEYS) {
    if (clone[key]) clone[key] = "";
  }
  return clone as T;
}

export function redactSensitiveLookup(lookup: ProfileLookup): ProfileLookup {
  const clone: ProfileLookup = { ...lookup };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEY_SET.has(key) || /password|aadhaar|pan|ssn|passport|license|secret|otp/i.test(key)) {
      delete clone[key];
    }
  }
  return clone;
}

export function profileForLLM(profile: Profile): Profile {
  const safe = redactSensitiveProfile(profile);
  return {
    ...safe,
    // Trim large context to reduce cost and avoid accidental over-sharing.
    masterResumeText: safe.masterResumeText ? safe.masterResumeText.slice(0, 12_000) : "",
    learnedLog: [],
  };
}

export function summarizeRedaction(profile: Partial<Profile>): { redactedKeys: SensitiveProfileKey[] } {
  return {
    redactedKeys: SENSITIVE_PROFILE_KEYS.filter((key) => Boolean((profile as Record<string, unknown>)[key])),
  };
}
