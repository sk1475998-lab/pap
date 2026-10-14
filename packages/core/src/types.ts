/**
 * Shared domain types for Super Job Agent.
 * These are intentionally framework-agnostic so the same engine powers:
 *   - the browser extension (content script + popup)
 *   - the CLI / headless pipeline
 *   - the web dashboard
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const WorkExperienceSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(), // ISO-ish "2022-01" or "Jan 2022"
  endDate: z.string().optional(), // "Present" allowed
  current: z.boolean().default(false),
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  discipline: z.string().optional(), // Academic discipline dropdown
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  graduationYear: z.string().optional(),
  gpa: z.string().optional(),
  gradePercentile: z.string().optional(), // India: percentage/CGPA
  classRank: z.string().optional(),
  activities: z.string().optional(), // Extracurricular activities
  description: z.string().optional(),
});


export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().default(""),
  description: z.string().default(""),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
});

export const CertificationSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().default(""),
  credentialId: z.string().default(""),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  url: z.string().default(""),
});

export const ProfileLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  type: z.enum(["portfolio", "linkedin", "github", "kaggle", "stackoverflow", "medium", "scholar", "twitter", "other"]).default("other"),
});

export const WorkAuthorizationSchema = z.object({
  country: z.string(),
  status: z.string(),
  requiresSponsorship: z.string().default(""),
  expiryDate: z.string().optional(),
});

export const JobPreferenceSchema = z.object({
  roleTitles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remotePreference: z.string().default(""),
  minSalary: z.string().default(""),
  currency: z.string().default(""),
  excludedCompanies: z.array(z.string()).default([]),
});

export const ProfileSchema = z.object({
  id: z.string(),
  // ── Personal identity ──
  firstName: z.string(),
  lastName: z.string(),
  headline: z.string().default(""),
  middleName: z.string().default(""),
  preferredName: z.string().default(""), // what to display on forms
  pronouns: z.string().default(""),
  gender: z.string().default(""),
  dateOfBirth: z.string().default(""),
  nationality: z.string().default(""), // country of nationality (may differ from residence)
  maritalStatus: z.string().default(""), // Single, Married, Divorced, Widowed, Prefer not to say
  // ── Contact ──
  email: z.string().email().or(z.literal("")),
  phone: z.string().default(""),
  phoneCountryCode: z.string().default("+91"),
  alternatePhone: z.string().default(""), // secondary phone number
  // ── Address ──
  address: z.string().default(""), // street address line 1
  addressLine2: z.string().default(""), // apartment, suite, etc.
  city: z.string().default(""),
  state: z.string().default(""),
  pincode: z.string().default(""), // also used as zip/postal code
  country: z.string().default(""),
  location: z.string().default(""), // computed display string
  // ── Online presence ──
  linkedin: z.string().default(""),
  github: z.string().default(""),
  website: z.string().default(""),
  portfolio: z.string().default(""), // dedicated portfolio URL
  twitter: z.string().default(""), // X/Twitter handle
  // ── Resume artifacts ──
  resumeUrl: z.string().default(""),
  resumeFileName: z.string().default(""),
  resumeMimeType: z.string().default(""),
  resumeUploadedAt: z.number().default(0),
  coverLetter: z.string().default(""), // generic cover letter text
  masterResumeText: z.string().default(""),
  // ── Locale / region ──
  locale: z.enum(["IN", "US", "UK", "EU", "GLOBAL"]).default("IN"),
  // ── Work authorization & citizenship ──
  workAuthorization: z.string().default(""),
  requiresSponsorship: z.string().default(""),
  citizenship: z.string().default(""), // country of citizenship
  visaType: z.string().default(""), // H-1B, F1-OPT, TN, L2, O1, etc.
  visaExpiryDate: z.string().default(""),
  i94ExpiryDate: z.string().default(""), // I-94 expiry for US visa holders
  // ── Work preferences ──
  willingToRelocate: z.string().default(""),
  immediateJoiner: z.string().default(""),
  yearsOfExperience: z.string().default(""),
  // ── Compensation (India-specific) ──
  currentCTC: z.string().default(""),
  expectedCTC: z.string().default(""),
  ctcCurrency: z.string().default("INR"),
  salaryExpectation: z.string().default(""),
  salaryCurrency: z.string().default("USD"), // for US/global forms
  noticePeriod: z.string().default(""),
  lastWorkingDay: z.string().default(""),
  // ── India-specific IDs ──
  pan: z.string().default(""),
  aadhaar: z.string().default(""),
  // ── US/Global IDs ──
  ssn: z.string().default(""), // Social Security Number (US)
  passportNumber: z.string().default(""),
  drivingLicenseNumber: z.string().default(""),
  // ── EEOC / Diversity (Standard compliance pattern) ──
  ethnicity: z.string().default(""), // broad ethnicity
  race: z.string().default(""), // race category (US EEOC)
  hispanicLatino: z.string().default(""), // Hispanic/Latino identity
  veteranStatus: z.string().default(""),
  disabilityStatus: z.string().default(""),
  // ── Additional form fields (common across ATS platforms) ──
  hasDrivingLicense: z.string().default(""), // Yes/No
  hasOwnVehicle: z.string().default(""), // Yes/No
  hasMilitaryService: z.string().default(""), // Yes/No
  smoker: z.string().default(""), // Yes/No/Prefer not to say
  referralSource: z.string().default(""), // How did you hear about us?
  referralName: z.string().default(""), // Employee referral name
  // ── Emergency contact ──
  emergencyContactName: z.string().default(""),
  emergencyContactPhone: z.string().default(""),
  emergencyContactRelation: z.string().default(""), // Spouse, Parent, Sibling, Friend, Other
  // ── Background check consent ──
  consentToBackgroundCheck: z.string().default(""), // Yes/No
  consentToDrugScreening: z.string().default(""), // Yes/No
  // ── Content ──
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(WorkExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  languages: z.array(z.string()).default([]),
  awards: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  hobbies: z.array(z.string()).default([]),
  socialLinks: z.array(ProfileLinkSchema).default([]),
  workAuthorizations: z.array(WorkAuthorizationSchema).default([]),
  jobPreferences: JobPreferenceSchema.default({}),
  // ── Login / email monitoring ──
  defaultLoginEmail: z.string().default(""),
  defaultLoginPassword: z.string().default(""),
  imapConfig: z.any().optional(),
  smtpConfig: z.any().optional(),
  // ── Learned answers (smart cache) ──
  learnedLog: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        fieldKey: z.string(),
        hostname: z.string(),
        learnedAt: z.number(),
        source: z.enum(["manual", "autofill", "ai"]),
      })
    )
    .default([]),
  // free-form answers keyed by normalized question → answer (the smart cache)
  customAnswers: z.record(z.string(), z.string()).default({}),
  updatedAt: z.number().default(0),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type WorkExperience = z.infer<typeof WorkExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type ProfileLink = z.infer<typeof ProfileLinkSchema>;
export type WorkAuthorization = z.infer<typeof WorkAuthorizationSchema>;
export type JobPreference = z.infer<typeof JobPreferenceSchema>;

/* ------------------------------------------------------------------ */
/* Job                                                                 */
/* ------------------------------------------------------------------ */

export const JobSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().default(""),
  description: z.string().default(""),
  salary: z.string().default(""),
  remote: z.boolean().default(false),
  source: z.string().default(""),
  postedAt: z.string().optional(),
  savedAt: z.number().default(0),
});
export type Job = z.infer<typeof JobSchema>;

/* ------------------------------------------------------------------ */
/* Match scoring                                                       */
/* ------------------------------------------------------------------ */

export const MatchResultSchema = z.object({
  score: z.number().min(0).max(100),
  matched: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  reasons: z.array(z.string()).default([]),
  keywords: z
    .array(z.object({ term: z.string(), weight: z.number() }))
    .default([]),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

/* ------------------------------------------------------------------ */
/* Form detection (produced by the content script)                     */
/* ------------------------------------------------------------------ */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "url"
  | "combobox";

/** A single detected question/field on a page, resolved to a profile key. */
export interface DetectedField {
  id: string;
  elementId?: string;
  label: string; // human-readable question text
  fieldKey: string; // resolved profile key, e.g. "email" | "firstName" | "custom:..." | "ai"
  type: FieldType;
  // for select / radio groups, the candidate values
  options?: { value: string; label: string }[];
  // the DOM selectors used to fill it
  selector: string;
  confidence: number;
  filled?: boolean;
}

/* ------------------------------------------------------------------ */
/* LLM                                                                 */
/* ------------------------------------------------------------------ */

export type LLMProvider =
  | "ollama"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "none";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/* ------------------------------------------------------------------ */
/* Application tracking                                                */
/* ------------------------------------------------------------------ */

/**
 * The pipeline an application moves through. ONE list, used three ways: as the
 * TypeScript union, as the runtime validator, and as the set a server or UI
 * checks user input against. It was previously written out twice in this file —
 * once as the union and once inside `z.enum` — which is how a stage can end up
 * accepted by the type system and rejected by the parser.
 */
export const APPLICATION_STAGES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

/** True when `value` is a real stage. Use before writing a client-supplied one. */
export function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (APPLICATION_STAGES as readonly string[]).includes(value);
}

export const ApplicationSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  url: z.string(),
  title: z.string().default(""),
  company: z.string().default(""),
  stage: z.enum(APPLICATION_STAGES).default("saved"),
  notes: z.string().default(""),
  appliedAt: z.number().optional(),
  updatedAt: z.number().default(0),
  matchScore: z.number().default(0),
});
export type Application = z.infer<typeof ApplicationSchema>;
