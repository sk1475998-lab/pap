/**
 * Job gating helpers for the application pipeline.
 *
 * Capability source: *concepts* documented by AutoApplyMax (blacklist keyword
 * skip, required-experience skip, multilingual "years" extraction) and
 * autoApplylinkedin (keyword-based job filtering). All regexes and logic below
 * are an original, clean-room implementation written for Super Job Agent —
 * nothing was copied from those (AGPL / non-commercial-restricted) codebases.
 *
 * These pure functions let the pipeline decide *before* investing an autofill
 * run whether a job matches the user's constraints (company blacklist, minimum
 * experience). They are deliberately side-effect free and unit-testable.
 */

export interface JobGateInput {
  /** Job title, used for both blacklist and experience checks. */
  title: string;
  /** Company name (blacklist only). */
  company: string;
  /** Full or truncated job description (both checks). */
  description: string;
}

export interface JobGateOptions {
  /** Comma-separated (or array) keywords — if any appears, skip. */
  blacklistKeywords?: string | string[];
  /** Maximum years the user is willing to accept; skip if the JD demands more. */
  maxYearsRequired?: number;
}

export type JobGateResult =
  | { skip: true; reason: "blacklist"; keyword: string }
  | { skip: true; reason: "experience"; yearsRequired: number; maxYears: number }
  | { skip: false; yearsRequired: number };

/** Parse a blacklist keyword setting (comma-separated string or array). */
export function parseBlacklist(
  blacklistKeywords: string | string[] | undefined,
): string[] {
  if (!blacklistKeywords) return [];
  const raw = Array.isArray(blacklistKeywords)
    ? blacklistKeywords
    : blacklistKeywords.split(",");
  return raw
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

/**
 * Extract the maximum experience-year requirement from job text across common
 * languages (English, French, Spanish, German, Italian). Supports "5+ years",
 * "5-8 years", "5 ans", "5 años", "5 Jahre", "5 anni", etc. Returns 0 when no
 * explicit numeric requirement is found.
 */
export function extractYearsRequiredMultilingual(text: string): number {
  if (!text) return 0;
  const haystack = text.toLowerCase();
  // (number)(+)? whitespace? unit — units in en/fr/es/de/it. Also matches
  // "X+ years" with or without spaces and "X years of experience".
  const unit = "(?:years?|yrs?|ans?|ann[eé]es?|años?|jahre|anni)";
  const patterns = [
    // Explicit "+N units"
    new RegExp(`(\\d{1,2})\\s*\\+\\s*${unit}`, "g"),
    // "5-8 years" / "5 to 8 years" — take the upper bound.
    new RegExp(`(\\d{1,2})\\s*[-–to]\\s*\\d{1,2}\\s*${unit}`, "g"),
    // "minimum of 5 years", "at least 5 years"
    new RegExp(`(?:minimum of|at least|a minimum of)\\s+(\\d{1,2})\\s*(?:\\+|plus)?\\s*${unit}`, "g"),
    // "5+ years of experience", "5+ ans d'expérience"
    new RegExp(`(\\d{1,2})(?:\\+|plus)\\s*${unit}\\s+(?:of\\s+)?experience`, "g"),
    // "7 years of experience", "5 años de experiencia"
    new RegExp(`(\\d{1,2})\\s*${unit}\\s+(?:of\\s+)?experience`, "g"),
    // Plain "5 years"/"5 ans"/"5 años" (no qualifier) — final fallback.
    new RegExp(`(\\d{1,2})\\s*${unit}\\b`, "g"),
  ];
  let max = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack)) !== null) {
      const num = parseInt(m[1]!, 10);
      if (num > 0 && num <= 50 && num > max) max = num;
    }
  }
  return max;
}

/**
 * Decide whether a job should be skipped by the configured gates.
 * `description` is inspected for both a numeric experience requirement and
 * blacklist keywords; `title` + `company` are also scanned for blacklist.
 */
export function evaluateJobGates(
  input: JobGateInput,
  options: JobGateOptions,
): JobGateResult {
  const blacklist = parseBlacklist(options.blacklistKeywords);
  const titleCompany = `${input.title} ${input.company}`.toLowerCase();

  for (const keyword of blacklist) {
    if (
      titleCompany.includes(keyword) ||
      input.description.toLowerCase().includes(keyword)
    ) {
      return { skip: true, reason: "blacklist", keyword };
    }
  }

  const yearsRequired = extractYearsRequiredMultilingual(
    `${input.title} ${input.description}`,
  );
  const maxYears = options.maxYearsRequired ?? 0;
  if (maxYears > 0 && yearsRequired > maxYears) {
    return { skip: true, reason: "experience", yearsRequired, maxYears };
  }
  return { skip: false, yearsRequired };
}
