/**
 * PII Scrubber â€” GAP-SEC-01 Fix
 *
 * Strips sensitive candidate information from text before it is transmitted to
 * external LLM providers (OpenAI, Anthropic, Gemini, OpenRouter). All redacted
 * values are replaced with typed sentinel tokens that are safe to log and transmit.
 *
 * IMPORTANT: restore() must NEVER be called on text that leaves the user's local machine.
 * Only restore at the DOM fill step inside the Chrome extension.
 */

export interface ScrubResult {
  /** The text with all PII replaced by sentinel tokens. Safe to log and transmit. */
  scrubbed: string;
  /**
   * Restores sentinel tokens to their original values.
   * Only call this inside the Chrome extension at the DOM fill step â€” never server-side.
   */
  restore: (text: string) => string;
  /** Number of PII tokens that were redacted. */
  redactionCount: number;
}

// Ordered from most to least specific. False negatives are more dangerous than false positives.
const PII_PATTERNS: Array<{ pattern: RegExp; sentinel: (i: number) => string }> = [
  // Aadhaar (India national ID)
  { pattern: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,          sentinel: (i) => `[GOV_ID_${i}]` },
  // PAN card (India)
  { pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,                      sentinel: (i) => `[GOV_ID_${i}]` },
  // Passport
  { pattern: /\b[A-Z]{1,2}[0-9]{6,7}\b/g,                       sentinel: (i) => `[PASSPORT_${i}]` },
  // Phone â€” India mobile + US patterns
  {
    pattern: /(?:\+?91[\s-]?)?[6-9]\d{9}|\(\d{3}\)\s?\d{3}[\s-]\d{4}|\+1\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/g,
    sentinel: (i) => `[PHONE_${i}]`,
  },
  // Email
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, sentinel: (i) => `[EMAIL_${i}]` },
  // Physical address (house number + street keyword)
  {
    pattern: /\b\d{1,5}[\s,]+(?:[A-Za-z]+[\s,]*){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Nagar|Colony|Layout|Block|Sector|Phase)\b[^\n]*/gi,
    sentinel: (i) => `[ADDRESS_${i}]`,
  },
];

/**
 * Scrub PII from text. Returns scrubbed text + a restore function.
 * The restore function must only be called locally (browser extension DOM fill layer).
 */
export function scrubPii(text: string): ScrubResult {
  if (!text || typeof text !== "string") {
    return { scrubbed: "", restore: (t) => t, redactionCount: 0 };
  }
  const tokenMap = new Map<string, string>();
  let counter = 0;
  let result = text;
  for (const { pattern, sentinel } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match) => {
      const token = sentinel(counter++);
      tokenMap.set(token, match);
      return token;
    });
  }
  const restore = (s: string): string => {
    let r = s;
    for (const [k, v] of tokenMap.entries()) r = r.split(k).join(v);
    return r;
  };
  return { scrubbed: result, restore, redactionCount: tokenMap.size };
}

/**
 * Safely truncate and scrub a resume before including in an LLM prompt.
 */
export function safeTruncateResume(
  resumeText: string,
  maxChars = 2000,
): { safeText: string; restore: (t: string) => string } {
  const truncated = resumeText?.slice(0, maxChars) ?? "";
  const { scrubbed, restore } = scrubPii(truncated);
  return { safeText: scrubbed, restore };
}

/** Fields that must NEVER be included in any LLM prompt under any circumstances. */
export const NEVER_IN_PROMPTS = new Set([
  "bankAccount",
  "passportNumber",
  "nationalId",
  "aadhaarNumber",
  "panNumber",
  "ssn",
  "taxId",
  "drivingLicense",
]);

/**
 * Return a sanitized copy of a profile object safe to pass into LLM prompts.
 * Strips all government IDs and replaces phone/address with sentinel strings.
 */
export function sanitizeProfileForLlm(
  profile: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (NEVER_IN_PROMPTS.has(key)) continue;
    if (["phone", "mobile", "contactNumber"].includes(key)) {
      safe[key] = value ? "[PHONE_REDACTED]" : undefined;
      continue;
    }
    if (["address", "homeAddress", "street"].includes(key)) {
      safe[key] = "[ADDRESS_REDACTED]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      safe[key] = sanitizeProfileForLlm(value as Record<string, unknown>);
      continue;
    }
    safe[key] = value;
  }
  return safe;
}