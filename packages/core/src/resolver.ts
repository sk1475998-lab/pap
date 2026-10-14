/**
 * Field resolver: given a detected form field (label + type), decide which
 * profile value to fill it with.
 *
 * The matcher is a normalized-keyword classifier — deliberately fast and
 * dependency-free so it runs inside the content script with no overhead.
 */
import type { DetectedField, Profile } from "./types.js";
import type { ProfileLookup } from "./profile.js";

interface Rule {
  fieldKey: string;
  patterns: RegExp[];
}

// Ordered by specificity. First match wins.
const RULES: Rule[] = [
  { fieldKey: "resumeFile", patterns: [/resume/, /\bcv\b/, /curriculum\s*vitae/, /upload.*document/, /attach.*resume/, /upload.*cv/] },
  { fieldKey: "firstName", patterns: [/first\s*name/, /given\s*name/, /\bfname\b/, /prénom/i, /vorname/i, /primer\s*nombre/i] },
  { fieldKey: "middleName", patterns: [/middle\s*name/, /\bmname\b/] },
  { fieldKey: "lastName", patterns: [/last\s*name/, /family\s*name/, /surname/, /\blname\b/, /nom\s*de\s*famille/i, /nachname/i, /apellido/i] },
  // NOTE on ^day$ / ^month$ / ^year$:
  // These bare patterns match ANY dropdown labeled exactly "Day", "Month", or "Year"
  // — including experience start/end dates, graduation year dropdowns, and start month pickers.
  // They are intentionally NOT included here to avoid ambiguous fills.
  // Birth date is matched via explicit birth/dob context patterns only.
  { fieldKey: "birthDay", patterns: [/birth\s*day/, /date\s*of\s*birth.*day/, /\bdob\b.*day/, /\bdd\b.*birth/, /born.*day/] },
  { fieldKey: "birthMonth", patterns: [/birth\s*month/, /date\s*of\s*birth.*month/, /\bdob\b.*month/, /born.*month/] },
  { fieldKey: "birthYear", patterns: [/birth\s*year/, /date\s*of\s*birth.*year/, /\bdob\b.*year/, /\bdd\b.*birth.*year/, /born.*year/] },
  { fieldKey: "gender", patterns: [/\bgender\b/, /\bsex\b/] },
  { fieldKey: "experienceLocation", patterns: [/job\s*city/i, /work\s*city/i, /office location/i, /experience location/i] },
  { fieldKey: "fullName", patterns: [/full\s*name/, /^your name/, /पूरा\s*नाम/i, /nom\s*complet/i, /vollständiger\s*name/i, /nombre\s*completo/i] },
  { fieldKey: "email", patterns: [/e[-\s]*mail/, /\bemail\b/, /ईमेल/i, /courriel/i, /correo/i] },
  { fieldKey: "phoneCountryCode", patterns: [/country\s*code/, /dial\s*code/, /phone\s*code/] },
  { fieldKey: "phone", patterns: [/phone/, /mobile/, /telephone/, /contact\s*number/, /whatsapp/, /फ़ोन/i, /मोबाइल/i, /संपर्क/i, /téléphone/i, /telefon/i, /teléfono/i] },
  { fieldKey: "pan", patterns: [/\bpan\b/, /pan\s*number/, /permanent\s*account\s*number/] },
  { fieldKey: "aadhaar", patterns: [/aadhaar/, /aadhar/, /\buidai\b/] },
  { fieldKey: "currentCTC", patterns: [/current\s*ctc/, /present\s*ctc/, /current\s*salary/, /present\s*salary/, /ctc.*current/, /current\s*compensation/, /last\s*drawn\s*salary/, /drawn\s*salary/] },
  { fieldKey: "annualCurrentSalary", patterns: [/current.*annual/, /annual.*current/] },
  { fieldKey: "expectedCTC", patterns: [/expected\s*ctc/, /desired\s*ctc/, /expected\s*salary/, /ctc.*expect/, /expected\s*compensation/, /desired\s*salary/] },
  { fieldKey: "annualExpectedSalary", patterns: [/expected\s*annual/, /annual\s*salary/, /expected\s*package/] },
  { fieldKey: "noticePeriod", patterns: [/notice\s*period/, /how\s*long.*notice/] },
  { fieldKey: "noticePeriodDays", patterns: [/notice.*days/, /days.*notice/] },
  { fieldKey: "lastWorkingDay", patterns: [/last\s*working\s*day/, /\blwd\b/, /relieving\s*date/, /expected\s*last\s*working/] },
  { fieldKey: "immediateJoiner", patterns: [/immediate\s*join/, /join\s*immediately/, /available\s*to\s*join/] },
  { fieldKey: "workExperienceCompany", patterns: [/current\s*company/i, /present\s*company/i, /last\s*company/i, /current\s*organization/i, /present\s*employer/i, /^company\b/i, /\bcompany\b/i, /company\s*name/i, /\bemployer\b/i, /\borganization\b/i] },
  { fieldKey: "experienceStartDate", patterns: [/experience.*start/, /work.*start/, /job.*start/, /start.*date/, /from.*date/, /joined.*date/] },
  { fieldKey: "experienceEndDate", patterns: [/experience.*end/, /work.*end/, /job.*end/, /end.*date/, /to.*date/, /left.*date/] },
  { fieldKey: "experienceStartMonth", patterns: [/experience.*start.*month/, /work.*start.*month/, /job.*start.*month/, /start.*month/, /from.*month/, /joined.*month/] },
  { fieldKey: "experienceStartYear", patterns: [/experience.*start.*year/, /work.*start.*year/, /job.*start.*year/, /start.*year/, /from.*year/, /joined.*year/] },
  { fieldKey: "experienceEndMonth", patterns: [/experience.*end.*month/, /work.*end.*month/, /job.*end.*month/, /end.*month/, /to.*month/, /left.*month/, /current.*month/] },
  { fieldKey: "experienceEndYear", patterns: [/experience.*end.*year/, /work.*end.*year/, /job.*end.*year/, /end.*year/, /to.*year/, /left.*year/, /current.*year/] },
  { fieldKey: "jobTitle", patterns: [/your title/i, /job title/i, /position title/i, /role title/i, /current title/i, /\bjob\s*role\b/i, /\bdesignation\b/i] },
  { fieldKey: "experienceDescription", patterns: [/description/, /responsibilities/, /what did you do/] },
  { fieldKey: "experienceYears", patterns: [/exp\s*years?/, /experience\s*years?/, /years\s*exp/, /total\s*exp.*year/] },
  { fieldKey: "experienceMonths", patterns: [/exp\s*months?/, /experience\s*months?/, /months\s*exp/] },
  { fieldKey: "school", patterns: [/school/, /university/, /college/, /institute/, /institution/] },
  { fieldKey: "degree", patterns: [/degree/, /qualification/, /education level/] },
  { fieldKey: "major", patterns: [/major/, /field of study/, /specialization/, /discipline/] },
  { fieldKey: "educationStartDate", patterns: [/school.*start/, /education.*start/, /degree.*start/, /attended.*from/, /education.*from/, /study.*start/] },
  { fieldKey: "educationEndDate", patterns: [/school.*end/, /education.*end/, /degree.*end/, /attended.*to/, /education.*to/, /study.*end/] },
  { fieldKey: "graduationDate", patterns: [/grad(?:uation)?\s*date/, /degree\s*date/, /date\s*degree\s*conferred/, /completion\s*date/] },
  { fieldKey: "graduationYear", patterns: [/grad(?:uation)?\s*year/, /year.*graduat/, /graduat.*year/, /which\s*year.*graduat/, /when.*graduat/, /completion\s*year/, /grad\s*yr/] },
  { fieldKey: "headline", patterns: [/^headline$/, /professional\s*headline/, /profile\s*title/, /tagline/] },
  { fieldKey: "coverLetter", patterns: [/cover\s*letter/, /letter\s*to\s*(?:the\s*)?hiring/, /application\s*letter/, /personal\s*note/] },
  { fieldKey: "allEmployers", patterns: [/pipe\s*separated.*(?:company|employer)/, /employers?\s*till\s*date/, /all\s*employers/, /all\s*companies/, /list.*(?:companies|employers)/] },
  { fieldKey: "datesAttended", patterns: [/dates attended/, /attendance/, /graduation/] },
  { fieldKey: "state", patterns: [/\bstate\b/, /province/, /region/] },
  { fieldKey: "city", patterns: [/\bcity\b/, /preferred\s*location/, /current\s*location/] },
  { fieldKey: "preferredLocation", patterns: [/preferred\s*location\s*[23]?/, /location\s*preference/] },
  { fieldKey: "country", patterns: [/\bcountry\b/, /nationality/] },
  { fieldKey: "location", patterns: [/location/, /address/, /where do you live/] },
  { fieldKey: "linkedin", patterns: [/linkedin/] },
  { fieldKey: "github", patterns: [/github/, /gitlab/, /portfolio/, /personal\s*site/, /website/] },
  { fieldKey: "website", patterns: [/website/, /portfolio/, /personal\s*(url|site)/] },
  { fieldKey: "workAuthorization", patterns: [/authorized to work/, /work authorization/, /eligib/i, /legally.*work/, /work\s*in\s*india/, /indian\s*citizen/, /eligible.*india/, /नागरिक/i] },
  { fieldKey: "requiresSponsorship", patterns: [/sponsorship/, /sponsor/, /require.*visa/, /h-?1b/i, /opt\b/, /visa status/, /work\s*permit/] },
  { fieldKey: "willingToRelocate", patterns: [/relocate/, /relocation/] },
  { fieldKey: "yearsOfExperience", patterns: [/years.*experience/, /experience.*year/, /how many years/, /total\s*experience/] },
  { fieldKey: "salaryExpectation", patterns: [/salary\s*expect/, /compensation\s*expect/, /pay.*expect/, /desired.*rate/] },
  { fieldKey: "gpa", patterns: [/diploma\s*percentage/, /\bcgpa\b/, /\bgpa\b/, /percentage.*applicable/, /marks?\s*percentage/] },
  { fieldKey: "skills", patterns: [/^skills?$/, /technical\s*skills?/, /key\s*skills?/, /core\s*skills?/] },
  { fieldKey: "projects", patterns: [/projects?/, /portfolio projects?/, /side projects?/] },
  { fieldKey: "projectDescription", patterns: [/project.*description/, /describe.*project/, /relevant project/] },
  { fieldKey: "certifications", patterns: [/certifications?/, /licenses?/, /credentials?/] },
  { fieldKey: "languages", patterns: [/languages?/, /spoken languages?/] },
  { fieldKey: "awards", patterns: [/awards?/, /honou?rs/, /achievements?/] },
  { fieldKey: "publications", patterns: [/publications?/, /papers?/, /patents?/] },
  { fieldKey: "ethnicity", patterns: [/ethnicity/, /race/] },
  { fieldKey: "veteranStatus", patterns: [/veteran/] },
  { fieldKey: "disabilityStatus", patterns: [/disability/] },
  { fieldKey: "remotePreference", patterns: [/remote.*preference/, /workplace.*preference/, /work arrangement/] },
  { fieldKey: "minSalary", patterns: [/minimum.*salary/, /minimum.*compensation/, /lowest.*salary/] },
  { fieldKey: "pronouns", patterns: [/pronoun/] },
];

function extractIndex(norm: string): number | null {
  const matchDigit = norm.match(/\b([1-9])\b/);
  if (matchDigit) return parseInt(matchDigit[1]!, 10);
  
  if (/\b(first|one)\b/i.test(norm)) return 1;
  if (/\b(second|two)\b/i.test(norm)) return 2;
  if (/\b(third|three)\b/i.test(norm)) return 3;
  if (/\b(fourth|four)\b/i.test(norm)) return 4;
  if (/\b(fifth|five)\b/i.test(norm)) return 5;
  
  return null;
}

export function classifyLabel(label: string): string {
  const norm = label.toLowerCase().trim();
  const collapsed = norm.replace(/[\s_-]+/g, ""); // "linked in url" -> "linkedinurl"
  const clean = norm
    .replace(/[\*:\(\)\[\]\{\}]/g, " ")
    .replace(/\b(required|mandatory|optional)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  let matchedKey = "";
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(norm) || re.test(collapsed) || (clean && re.test(clean)))) {
      matchedKey = rule.fieldKey;
      break;
    }
  }

  if (matchedKey) {
    const idx = extractIndex(norm) ?? (clean ? extractIndex(clean) : null);
    if (idx !== null) {
      const indexableKeys = [
        "school", "degree", "major", "fieldOfStudy", "educationStartDate", "educationEndDate", "graduationYear",
        "jobTitle", "yourTitle", "company", "workExperienceCompany", "experienceDescription", "experienceStartDate", "experienceEndDate",
        "projectName", "projectUrl", "projectLink", "projectDescription", "projectStartDate", "projectEndDate"
      ];
      if (indexableKeys.includes(matchedKey)) {
        return `${matchedKey}${idx}`;
      }
    }
    return matchedKey;
  }

  // Fuzzy fallback: check if any rule keyword is a close match
  const fuzzyResult = fuzzyClassifyLabel(clean || norm);
  if (fuzzyResult) return fuzzyResult;
  return "ai"; // unknown → defer to LLM / custom cache
}

/** Confidence level for a classification result */
export type ClassificationConfidence = "high" | "medium" | "low" | "none";

/** Result of label classification with confidence */
export interface ClassifiedField {
  fieldKey: string;
  confidence: ClassificationConfidence;
  matchType: "exact" | "fuzzy" | "ai";
  matchedRule?: string;
}

/**
 * Classify a label with confidence scoring.
 * Returns the fieldKey + confidence level so callers can decide
 * whether to trust the result or defer to LLM.
 */
export function classifyLabelWithConfidence(label: string): ClassifiedField {
  const norm = label.toLowerCase().trim();
  const collapsed = norm.replace(/[\s_-]+/g, "");
  const clean = norm
    .replace(/[\*:\(\)\[\]\{\}]/g, " ")
    .replace(/\b(required|mandatory|optional)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1) Exact regex match → high confidence
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(norm) || re.test(collapsed) || (clean && re.test(clean)))) {
      return { fieldKey: rule.fieldKey, confidence: "high", matchType: "exact", matchedRule: rule.fieldKey };
    }
  }

  // 2) Fuzzy match → medium confidence
  const fuzzyResult = fuzzyClassifyLabel(clean || norm);
  if (fuzzyResult) {
    return { fieldKey: fuzzyResult, confidence: "medium", matchType: "fuzzy", matchedRule: fuzzyResult };
  }

  // 3) Keyword overlap → low confidence
  const keywordOverlap = findKeywordOverlap(clean || norm);
  if (keywordOverlap) {
    return { fieldKey: keywordOverlap, confidence: "low", matchType: "fuzzy", matchedRule: keywordOverlap };
  }

  return { fieldKey: "ai", confidence: "none", matchType: "ai" };
}

/**
 * Fuzzy label classification using Levenshtein distance on rule keywords.
 * Returns a fieldKey if a close match is found, undefined otherwise.
 */
function fuzzyClassifyLabel(normLabel: string): string | undefined {
  const labelWords = normLabel.split(/\s+/).filter(w => w.length > 2);
  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const rule of RULES) {
    const ruleKey = rule.fieldKey.replace(/([A-Z])/g, " $1").toLowerCase().trim();
    const ruleWords = ruleKey.split(/\s+/).filter(w => w.length > 2);

    // Check word-level overlap
    let overlap = 0;
    for (const lw of labelWords) {
      for (const rw of ruleWords) {
        if (lw === rw || levenshteinFuzzy(lw, rw) <= Math.max(1, Math.floor(Math.min(lw.length, rw.length) * 0.3))) {
          overlap++;
          break;
        }
      }
    }

    const score = overlap / Math.max(1, Math.max(labelWords.length, ruleWords.length));
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = rule.fieldKey;
    }
  }

  return bestMatch;
}

/**
 * Find keyword overlap between label and any rule.
 * Lower threshold than fuzzyClassifyLabel for "low confidence" matches.
 */
function findKeywordOverlap(normLabel: string): string | undefined {
  const labelWords = new Set(normLabel.split(/\s+/).filter(w => w.length > 3));
  let bestMatch: string | undefined;
  let bestOverlap = 0;

  for (const rule of RULES) {
    const ruleKey = rule.fieldKey.replace(/([A-Z])/g, " $1").toLowerCase();
    const ruleWords = ruleKey.split(/\s+/).filter(w => w.length > 3);
    let overlap = 0;
    for (const rw of ruleWords) {
      if (labelWords.has(rw)) overlap++;
    }
    if (overlap > bestOverlap && overlap >= 1) {
      bestOverlap = overlap;
      bestMatch = rule.fieldKey;
    }
  }

  return bestMatch;
}

/** Fast fuzzy string comparison (Levenshtein ≤ 2 for short strings) */
function levenshteinFuzzy(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.max(m, n); // early exit
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Resolve a multi-select field to an array of values.
 * Handles comma-separated, array, and single-value inputs.
 */
export function resolveMultiSelect(
  field: DetectedField,
  lookup: ProfileLookup
): string[] {
  const value = lookup[field.fieldKey];
  if (Array.isArray(value)) return value.filter(v => typeof v === "string" && v.trim());
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  }
  // For skills, return the full skills list
  if (field.fieldKey === "skills" || field.fieldKey === "skillsList") {
    const raw = lookup.skillsList ?? lookup.skills;
    if (typeof raw === "string") return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  }
  return [];
}

/**
 * Resolve a single detected field to a concrete value.
 * Returns undefined when no value is known (leave the field alone).
 */
function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (Array.isArray(v)) return v.map(x => (x == null ? "" : String(x))).join(", ");
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return undefined; }
  }
  return undefined;
}

export function resolveValue(
  field: DetectedField,
  lookup: ProfileLookup
): string | undefined {
  if (field.fieldKey === "skills" || field.fieldKey === "skillsList") {
    const raw = lookup.skillsList ?? lookup.skills;
    const s = asString(raw);
    if (s && s.trim()) return s;
    if (Array.isArray(raw) && raw.length) return raw.slice(0, 12).map(x => String(x)).join(", ");
  }
  if (field.fieldKey === "allEmployers" || (field.fieldKey === "workExperienceCompany" && /pipe\s*separated|employers?\s*till\s*date/i.test(field.label))) {
    const employers = lookup.allEmployers || lookup.allCompanies;
    if (employers) return String(employers);
  }
  const value = lookup[field.fieldKey];
  const s = asString(value);
  if (s && s.trim()) return s;
  return undefined;
}

/**
 * Batch-classify and resolve all fields. Mutates each field's `fieldKey`
 * if it was "ai"/uncategorized and a custom cached answer exists.
 */
export function resolveAll(
  fields: DetectedField[],
  lookup: ProfileLookup
): DetectedField[] {
  let genericMonthIndex = 0;
  let genericYearIndex = 0;

  return fields.map((f) => {
    const norm = f.label.toLowerCase().trim();

    // Intercept generic or layout-corrupted months/years
    if (f.fieldKey === "ai" || f.fieldKey === "birthMonth" || f.fieldKey === "birthYear") {
      // Heuristic for labels containing the actual month name from the profile
      if (norm.includes("month")) {
        const expStartMonth = String(lookup.experienceStartMonth ?? "").toLowerCase();
        const expEndMonth = String(lookup.experienceEndMonth ?? "").toLowerCase();
        if (expStartMonth && norm.includes(expStartMonth)) {
          return { ...f, fieldKey: "experienceStartMonth" };
        }
        if (expEndMonth && norm.includes(expEndMonth)) {
          return { ...f, fieldKey: "experienceEndMonth" };
        }
      }

      if (norm.includes("year")) {
        const expStartYear = String(lookup.experienceStartYear ?? "").toLowerCase();
        const expEndYear = String(lookup.experienceEndYear ?? "").toLowerCase();
        if (expStartYear && norm.includes(expStartYear)) {
          return { ...f, fieldKey: "experienceStartYear" };
        }
        if (expEndYear && norm.includes(expEndYear)) {
          return { ...f, fieldKey: "experienceEndYear" };
        }
      }

      // Generic "Month" / "Year" order-based assignment
      if (norm === "month") {
        if (genericMonthIndex === 0) {
          genericMonthIndex++;
          return { ...f, fieldKey: "experienceStartMonth" };
        } else if (genericMonthIndex === 1) {
          genericMonthIndex++;
          return { ...f, fieldKey: "experienceEndMonth" };
        }
      }

      if (norm === "year") {
        if (genericYearIndex === 0) {
          genericYearIndex++;
          return { ...f, fieldKey: "experienceStartYear" };
        } else if (genericYearIndex === 1) {
          genericYearIndex++;
          return { ...f, fieldKey: "experienceEndYear" };
        }
      }
    }

    if (f.fieldKey === "ai") {
      // try the custom-answer cache keyed by normalized label, checking both lookup table and profile customAnswers
      const qKey = normalizeQuestion(f.label);
      const cached = lookup[`custom:${qKey}`] ?? (lookup as any)?.customAnswers?.[qKey];
      if (cached) return { ...f, fieldKey: `custom:${qKey}` };
    }
    return f;
  });
}

/** Normalize a free-form question into a stable cache key. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Questions that must never be guessed — require explicit profile data. */
export function isSensitiveQuestion(question: string): boolean {
  if (typeof question !== "string") return false;
  const q = question.toLowerCase();
  return /\b(pan|aadhaar|aadhar|ssn|social security|passport|bank account|password|passwd|secret|credit card|cvv|national id|national identity|tax id|tax identifier|taxpayer id|driver.*license|work authorization|authorized to work|eligible to work|eligibility to work|work permit|visa sponsorship|visa support|sponsorship|relocat(?:e|ion)|immediate joiner|available immediately|start immediately|earliest start|gender|race|ethnicity|ethnic|hispanic|latino|veteran|disability)\b/.test(q);
}

/**
 * Safe fallback when LLM is unavailable. Candidate-specific answers are never
 * inferred from the locale or supplied as defaults.
 *
 * @param question  The field label / question text
 * @param locale    Retained for API compatibility; it does not imply candidate facts.
 */
export function smartDefaultForQuestion(
  question: string,
  _locale: Profile["locale"] = "IN"
): string | undefined {
  if (typeof question !== "string") return undefined;
  if (isSensitiveQuestion(question)) return undefined;
  const q = question.toLowerCase();

  // --- Money / notice / CTC: always require explicit user data ---
  if (/current\s*ctc|present\s*salary|expected\s*ctc|desired\s*salary|notice\s*period|\blpa\b|lakhs?|annual\s*salary|compensation/.test(q)) {
    return undefined;
  }

  // --- Immediate joiner ---
  if (/immediate\s*join|join\s*immediately|available\s*immediately/i.test(q)) {
    return undefined; // Depends on notice period
  }

  // --- Start date ---
  if (/start\s*date|earliest\s*(start|join)|when can you (start|join)/i.test(q)) {
    return undefined; // Depends on notice period
  }

  // --- Cover letter (provide a placeholder message) ---
  if (/cover\s*letter|letter of motivation|motivation\s*letter/i.test(q)) {
    return undefined; // Should be generated by LLM with context
  }

  return undefined;
}
