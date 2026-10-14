/**
 * Screening-question answer policy — resolve common Easy Apply / ATS screening
 * questions (visa, citizenship, salary/CTC, notice period, years of experience,
 * links, name variants) from a small, user-supplied answer configuration.
 *
 * LICENSE / ATTRIBUTION:
 * This module is a TypeScript adaptation of the question/answer decision table
 * in `config/questions.py` + `runAiBot.py` (`answer_questions`,
 * `answer_common_questions`) of the MIT-licensed repository
 * "Auto_job_applier_linkedIn" (GodsScion/Auto_job_applier_linkedIn),
 * Copyright (c) 2024-2026 Sai Vignesh Golla (MIT License), used under that
 * license (notice preserved in THIRD_PARTY_NOTICES.md).
 * Changes for SJA: TypeScript, pure + declarative intent classification
 * (discriminated-union "intents" instead of one big if/elif on raw labels),
 * no Selenium/browser side effects, and an explicit `matched:false` result so
 * callers can fall through to an LLM — nothing is ever "randomly" answered.
 */

export interface ScreeningAnswersConfig {
  /** Years of experience to state (e.g. "5"). */
  yearsOfExperience?: string;
  /** Do you require (or will you require) visa sponsorship? */
  requireVisa?: boolean;
  /** Citizenship / work-authorization status free text. */
  citizenship?: string;
  /** Annual desired salary/CTC (numeric; any currency unit of the config). */
  desiredAnnualCompensation?: number;
  /** Annual current salary/CTC (numeric). */
  currentAnnualCompensation?: number;
  /** Notice period in DAYS (numeric). Converted per the question's unit. */
  noticePeriodDays?: number;
  gender?: string;
  disabilityStatus?: string;
  veteranStatus?: string;
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
  headline?: string;
  summary?: string;
  coverLetter?: string;
  /** For "on a scale of 1–10 …" questions. */
  confidenceLevel?: string;
  recentEmployer?: string;
  /** Optional free-form overrides: normalized question → exact answer. */
  overrides?: Record<string, string>;
}

/** Normalize free text for intent matching (lowercase, no punctuation). */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ScreeningIntent =
  | "sponsorship"
  | "citizenship"
  | "yearsExperience"
  | "desiredSalary"
  | "currentSalary"
  | "noticePeriod"
  | "name"
  | "phone"
  | "linkedinProfile"
  | "githubProfile"
  | "portfolio"
  | "website"
  | "headline"
  | "summary"
  | "coverLetter"
  | "confidenceScale"
  | "howHeard"
  | "gender"
  | "veteran"
  | "disability"
  | "city"
  | "state"
  | "country"
  | "zipcode"
  | "street"
  | "recentEmployer"
  | "other";

export type SalaryUnit = "annual" | "lakhs" | "monthly";
export type NoticeUnit = "days" | "weeks" | "months";

export interface ScreeningResolution {
  intent: ScreeningIntent;
  /** Which salary/notice unit the question asked for, when applicable. */
  unit?: SalaryUnit | NoticeUnit;
  /** The exact string to type/select, when a config answer was available. */
  answer?: string;
  /** True when an answer was produced from the config (else caller falls back). */
  matched: boolean;
}

/** Annual amount → "lakhs" string (amount/100000 rounded to 2dp, e.g. 24.00). */
export function salaryInLakhs(annual: number): string {
  return (annual / 100_000).toFixed(2);
}

/** Annual amount → monthly string (amount/12 rounded to whole number). */
export function salaryMonthly(annual: number): string {
  return String(Math.round(annual / 12));
}

/** Convert a day-count answer to the unit the question asked for. */
export function noticePeriodForUnit(days: number, unit: NoticeUnit): string {
  if (!Number.isFinite(days) || days < 0) return "";
  if (unit === "months") return String(Math.ceil(days / 30));
  if (unit === "weeks") return String(Math.ceil(days / 7));
  return String(days);
}

const SALARY_TOKENS = ["salary", "compensation", "ctc", "pay", "remuneration", "package", "stipend"];
const CURRENT_TOKENS = ["current", "present"];
/** Years questions ask for a NUMBER — never match bare "experience" essays. */
const YEARS_PATTERN =
  /(how many years|number of years|years of experience|years'? of|of experience.*years?|\byears?\b.*\bexperience\b)/;

/** Detect-level intents are coarser than resolution intents (salary/notice are
 *  disambiguated into desiredSalary/currentSalary/noticePeriod at resolve time). */
export type ScreeningDetectIntent = ScreeningIntent | "salary" | "notice";

export type ScreeningIntentDetect = {
  intent: ScreeningDetectIntent;
  /** Salary-specific: desired vs current salary. */
  salaryKind?: "desired" | "current";
  /** Unit modifier the question asked for (salary or notice period). */
  unit?: SalaryUnit | NoticeUnit;
  /** Name-specific: which part of the name is requested. */
  part?: "full" | "first" | "middle" | "last";
};

/**
 * Classify a screening question's text into a structured intent with unit
 * modifiers. Deterministic; no RNG, no side effects.
 */
export function detectScreeningIntent(raw: string): ScreeningIntentDetect {
  const q = normalizeQuestionText(raw);

  // Overrides happen at resolve time, not classification time.

  if (/(^| )(visa|sponsorship|work authorization|work authorisation)( |$)/.test(q) || q.includes("sponsorship")) {
    // "Do you now or in the future require visa sponsorship?" etc.
    return { intent: "sponsorship" };
  }
  if (q.includes("citizenship") || q.includes("employment eligibility") || q.includes("eligible to work")) {
    return { intent: "citizenship" };
  }
  if (q.includes("veteran") || q.includes("protected veteran")) {
    return { intent: "veteran" };
  }
  if (q.includes("disability") || q.includes("handicapped")) {
    return { intent: "disability" };
  }
  if (q.includes("gender") || q.includes("sex")) {
    return { intent: "gender" };
  }
  if (q.includes("notice period") || (q.includes("notice") && q.includes("employer"))) {
    const unit: NoticeUnit = q.includes("month") ? "months" : q.includes("week") ? "weeks" : "days";
    return { intent: "notice", unit };
  }

  // Salary / CTC — decide desired vs current, then unit.
  const hasSalary = SALARY_TOKENS.some((t) => q.includes(t));
  if (hasSalary) {
    const isCurrent = CURRENT_TOKENS.some((t) => q.includes(t));
    const salaryKind = isCurrent ? "current" : "desired";
    const unit: SalaryUnit = q.includes("lakh") ? "lakhs" : q.includes("month") ? "monthly" : "annual";
    return { intent: "salary", salaryKind, unit };
  }

  if (q.includes("how did you hear") || (q.includes("hear") && q.includes("job")) || q.includes("come across this")) {
    return { intent: "howHeard" };
  }
  if (q.includes("scale of 1") || q.includes("on a scale of")) {
    return { intent: "confidenceScale" };
  }
  if (YEARS_PATTERN.test(q)) {
    return { intent: "yearsExperience" };
  }
  if (q.includes("linkedin")) {
    return { intent: "linkedinProfile" };
  }
  if (q.includes("github")) {
    return { intent: "githubProfile" };
  }
  if (q.includes("portfolio")) {
    return { intent: "portfolio" };
  }
  if (q.includes("website") || q.includes("blog")) {
    return { intent: "website" };
  }
  if (q.includes("headline")) {
    return { intent: "headline" };
  }
  if (q.includes("summary")) {
    return { intent: "summary" };
  }
  if (q.includes("cover letter") || q.includes("coverletter")) {
    return { intent: "coverLetter" };
  }
  if (q.includes("recent employer") || q.includes("current employer")) {
    return { intent: "recentEmployer" };
  }
  // Name variants (specific → general)
  if (q.includes("first name") && !q.includes("last")) return { intent: "name", part: "first" };
  if (q.includes("last name")) return { intent: "name", part: "last" };
  if (q.includes("middle")) return { intent: "name", part: "middle" };
  if (q.includes("name") || q.includes("signature") || q.includes("legal name")) return { intent: "name", part: "full" };

  if (q.includes("phone") || q.includes("mobile")) return { intent: "phone" };
  if (q.includes("zip") || q.includes("postal")) return { intent: "zipcode" };
  if (q.includes("street")) return { intent: "street" };
  if (q.includes("state") || q.includes("province")) return { intent: "state" };
  if (q.includes("country")) return { intent: "country" };
  if (q.includes("city") || q.includes("location") || q.includes("address")) return { intent: "city" };

  return { intent: "other" };
}

/**
 * Resolve a screening question against the config. Returns matched:false with
 * no answer when the config has nothing authoritative for that question, so
 * callers can (and should) fall back to the LLM rather than guess.
 */
export function resolveScreeningAnswer(
  raw: string,
  cfg: ScreeningAnswersConfig
): ScreeningResolution {
  const norm = normalizeQuestionText(raw);
  if (cfg.overrides) {
    const direct = cfg.overrides[norm] ?? cfg.overrides[raw];
    if (typeof direct === "string" && direct.trim()) {
      return { intent: detectScreeningIntent(raw).intent as ScreeningIntent, answer: direct.trim(), matched: true };
    }
  }

  const det = detectScreeningIntent(raw);

  switch (det.intent) {
    case "sponsorship":
      if (typeof cfg.requireVisa !== "boolean") return { intent: "sponsorship", matched: false };
      return { intent: "sponsorship", answer: cfg.requireVisa ? "Yes" : "No", matched: true };
    case "citizenship":
      if (!cfg.citizenship) return { intent: "citizenship", matched: false };
      return { intent: "citizenship", answer: cfg.citizenship, matched: true };
    case "veteran":
      if (!cfg.veteranStatus) return { intent: "veteran", matched: false };
      return { intent: "veteran", answer: cfg.veteranStatus, matched: true };
    case "disability":
      if (!cfg.disabilityStatus) return { intent: "disability", matched: false };
      return { intent: "disability", answer: cfg.disabilityStatus, matched: true };
    case "gender":
      if (!cfg.gender) return { intent: "gender", matched: false };
      return { intent: "gender", answer: cfg.gender, matched: true };
    case "yearsExperience":
      if (cfg.yearsOfExperience === undefined) return { intent: "yearsExperience", matched: false };
      return { intent: "yearsExperience", answer: String(cfg.yearsOfExperience), matched: true };
    case "confidenceScale":
      if (!cfg.confidenceLevel) return { intent: "confidenceScale", matched: false };
      return { intent: "confidenceScale", answer: cfg.confidenceLevel, matched: true };
    case "howHeard":
      return { intent: "howHeard", matched: false }; // never guess; leave to LLM
    case "notice": {
      const unit: NoticeUnit = det.unit === "months" || det.unit === "weeks" ? det.unit : "days";
      if (cfg.noticePeriodDays === undefined) return { intent: "noticePeriod", unit, matched: false };
      return {
        intent: "noticePeriod",
        unit,
        answer: noticePeriodForUnit(cfg.noticePeriodDays, unit),
        matched: true,
      };
    }
    case "salary": {
      const isCurrent = det.salaryKind === "current";
      const intent: ScreeningIntent = isCurrent ? "currentSalary" : "desiredSalary";
      const annual = isCurrent ? cfg.currentAnnualCompensation : cfg.desiredAnnualCompensation;
      if (annual === undefined || Number.isNaN(annual)) {
        return { intent, unit: det.unit, matched: false };
      }
      const answer =
        det.unit === "lakhs"
          ? salaryInLakhs(annual)
          : det.unit === "monthly"
            ? salaryMonthly(annual)
            : String(annual);
      return { intent, unit: det.unit, answer, matched: true };
    }
    case "name": {
      const part = det.part ?? "full";
      const byPart: Record<string, string | undefined> = {
        full: cfg.fullName,
        first: cfg.firstName,
        middle: cfg.middleName,
        last: cfg.lastName,
      };
      // A full-name string cannot safely be split into legal given/family
      // names; require the requested component instead of guessing.
      const v = byPart[part];
      if (!v) return { intent: "name", matched: false };
      return { intent: "name", answer: v, matched: true };
    }
    case "phone":
      if (!cfg.phoneNumber) return { intent: "phone", matched: false };
      return { intent: "phone", answer: cfg.phoneNumber, matched: true };
    case "linkedinProfile":
      if (!cfg.linkedInUrl) return { intent: "linkedinProfile", matched: false };
      return { intent: "linkedinProfile", answer: cfg.linkedInUrl, matched: true };
    case "githubProfile":
      if (!cfg.githubUrl) return { intent: "githubProfile", matched: false };
      return { intent: "githubProfile", answer: cfg.githubUrl, matched: true };
    case "portfolio":
      if (!cfg.portfolioUrl) return { intent: "portfolio", matched: false };
      return { intent: "portfolio", answer: cfg.portfolioUrl, matched: true };
    case "website":
      if (!cfg.websiteUrl) return { intent: "website", matched: false };
      return { intent: "website", answer: cfg.websiteUrl, matched: true };
    case "headline":
      if (!cfg.headline) return { intent: "headline", matched: false };
      return { intent: "headline", answer: cfg.headline, matched: true };
    case "summary":
      if (!cfg.summary) return { intent: "summary", matched: false };
      return { intent: "summary", answer: cfg.summary, matched: true };
    case "coverLetter":
      if (!cfg.coverLetter) return { intent: "coverLetter", matched: false };
      return { intent: "coverLetter", answer: cfg.coverLetter, matched: true };
    case "recentEmployer":
      if (!cfg.recentEmployer) return { intent: "recentEmployer", matched: false };
      return { intent: "recentEmployer", answer: cfg.recentEmployer, matched: true };
    case "city":
      if (!cfg.city) return { intent: "city", matched: false };
      return { intent: "city", answer: cfg.city, matched: true };
    case "state":
      if (!cfg.state) return { intent: "state", matched: false };
      return { intent: "state", answer: cfg.state, matched: true };
    case "country":
      if (!cfg.country) return { intent: "country", matched: false };
      return { intent: "country", answer: cfg.country, matched: true };
    case "zipcode":
      if (!cfg.zipcode) return { intent: "zipcode", matched: false };
      return { intent: "zipcode", answer: cfg.zipcode, matched: true };
    case "street":
      if (!cfg.street) return { intent: "street", matched: false };
      return { intent: "street", answer: cfg.street, matched: true };
    default:
      return { intent: "other", matched: false };
  }
}

/** Candidate option phrases for selecting a boolean answer in a <select>/radio. */
export function booleanOptionCandidates(answer: boolean): string[] {
  return answer
    ? ["Yes", "Agree", "I do", "I have", "I am", "Yes I am"]
    : ["No", "Disagree", "I don't", "I do not", "I am not", "No I am not"];
}

/** Map a boolean config value to its plain Yes/No text. */
export function booleanAnswerText(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * Semantic Answer Memory Engine.
 * Derived from job-apply-plugin QA oracle.
 * Ensures strict data hygiene, value-free assertions, and deterministic retrieval.
 */

export type AnswerState = 'confirmed' | 'inferred' | 'missing' | 'sensitive';

export interface AnswerEntry {
    questionText: string;
    answerKey: string;
    state: AnswerState;
    sensitive: boolean;
}

export class SemanticAnswerMemory {
    private memory: Map<string, AnswerEntry> = new Map();

    /**
     * Determines the semantic key for a given question string.
     * In a full implementation, this uses a local vector embedding or canonical mapping.
     */
    public getAnswerKey(question: string): string {
        // Simplified deterministic normalization
        return question.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Stores a learned answer.
     * Prevents forbidden value keys (PII hygiene) by storing only the key mapping,
     * while the actual PII stays in the encrypted vault.
     */
    public learnAnswer(question: string, answerKey: string, sensitive: boolean = false): void {
        const key = this.getAnswerKey(question);
        this.memory.set(key, {
            questionText: question,
            answerKey,
            state: 'confirmed',
            sensitive
        });
    }

    /**
     * Retrieves the known answer key for a given question.
     */
    public getAnswer(question: string): AnswerEntry | null {
        const key = this.getAnswerKey(question);
        return this.memory.get(key) || null;
    }

    /**
     * Exports the memory mapping ensuring no forbidden raw values leak.
     */
    public exportValueFreeMemory(): Record<string, Omit<AnswerEntry, 'questionText'>> {
        const safeExport: Record<string, Omit<AnswerEntry, 'questionText'>> = {};
        this.memory.forEach((entry, key) => {
            safeExport[key] = {
                answerKey: entry.answerKey,
                state: entry.state,
                sensitive: entry.sensitive
            };
        });
        return safeExport;
    }
}
