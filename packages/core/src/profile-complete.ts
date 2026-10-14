/**
 * Profile completeness — mandatory fields gate before autofill / autonomous apply.
 */
import type { Profile } from "./types.js";

export interface ProfileFieldDef {
  key: string;
  label: string;
  required: boolean;
  group: "resume" | "contact" | "work" | "education" | "india" | "links" | "address" | "eeoc" | "global";
  hint?: string;
  getValue: (p: Profile) => string;
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  {
    key: "masterResumeText",
    label: "Resume file",
    required: true,
    group: "resume",
    hint: "Upload your .pdf or .txt resume",
    getValue: (p) => (p.masterResumeText?.trim() ? "loaded" : ""),
  },
  {
    key: "firstName",
    label: "First name",
    required: true,
    group: "contact",
    getValue: (p) => p.firstName?.trim() ?? "",
  },
  {
    key: "lastName",
    label: "Last name",
    required: true,
    group: "contact",
    getValue: (p) => p.lastName?.trim() ?? "",
  },
  {
    key: "email",
    label: "Email",
    required: true,
    group: "contact",
    getValue: (p) => p.email?.trim() ?? "",
  },
  {
    key: "phone",
    label: "Phone",
    required: true,
    group: "contact",
    getValue: (p) => p.phone?.replace(/\D/g, "").slice(-10) ?? "",
  },
  {
    key: "city",
    label: "City",
    required: true,
    group: "contact",
    hint: "e.g. Bengaluru, Hyderabad",
    getValue: (p) => p.city?.trim() || p.location?.split(",")[0]?.trim() || "",
  },
  {
    key: "jobTitle",
    label: "Latest job title",
    required: true,
    group: "work",
    getValue: (p) => (p.experience?.[0])?.title?.trim() ?? "",
  },
  {
    key: "company",
    label: "Latest company",
    required: true,
    group: "work",
    getValue: (p) => (p.experience?.[0])?.company?.trim() ?? "",
  },
  {
    key: "school",
    label: "School / University",
    required: true,
    group: "education",
    getValue: (p) => (p.education?.[0])?.school?.trim() ?? "",
  },
  {
    key: "degree",
    label: "Degree",
    required: true,
    group: "education",
    getValue: (p) => (p.education?.[0])?.degree?.trim() ?? "",
  },
  {
    key: "yearsOfExperience",
    label: "Years of experience",
    required: true,
    group: "india",
    getValue: (p) => p.yearsOfExperience?.trim() ?? "",
  },
  {
    key: "expectedCTC",
    label: "Expected CTC (LPA)",
    required: true,
    group: "india",
    hint: "Required for most India job forms",
    getValue: (p) => p.expectedCTC?.trim() || p.salaryExpectation?.trim() || "",
  },
  {
    key: "noticePeriod",
    label: "Notice period",
    required: true,
    group: "india",
    hint: 'e.g. "30 days", "Immediate", "Serving notice"',
    getValue: (p) => p.noticePeriod?.trim() ?? "",
  },
  {
    key: "currentCTC",
    label: "Current CTC (LPA)",
    required: false,
    group: "india",
    getValue: (p) => p.currentCTC?.trim() ?? "",
  },
  {
    key: "linkedin",
    label: "LinkedIn URL",
    required: false,
    group: "links",
    getValue: (p) => p.linkedin?.trim() ?? "",
  },
  {
    key: "github",
    label: "GitHub URL",
    required: false,
    group: "links",
    getValue: (p) => p.github?.trim() ?? "",
  },
  {
    key: "website",
    label: "Portfolio / Website",
    required: false,
    group: "links",
    getValue: (p) => p.portfolio?.trim() || p.website?.trim() || "",
  },
  {
    key: "address",
    label: "Street address",
    required: false,
    group: "address",
    getValue: (p) => p.address?.trim() ?? "",
  },
  {
    key: "citizenship",
    label: "Country of citizenship",
    required: false,
    group: "global",
    getValue: (p) => p.citizenship?.trim() || p.country?.trim() || "",
  },
  {
    key: "visaType",
    label: "Visa type",
    required: false,
    group: "global",
    getValue: (p) => p.visaType?.trim() ?? "",
  },
  {
    key: "nationality",
    label: "Nationality",
    required: false,
    group: "global",
    getValue: (p) => p.nationality?.trim() || p.country?.trim() || "",
  },
  {
    key: "race",
    label: "Race / Ethnicity (EEOC)",
    required: false,
    group: "eeoc",
    getValue: (p) => p.race?.trim() || p.ethnicity?.trim() || "",
  },
  {
    key: "hispanicLatino",
    label: "Hispanic/Latino",
    required: false,
    group: "eeoc",
    getValue: (p) => p.hispanicLatino?.trim() ?? "",
  },
  {
    key: "veteranStatus",
    label: "Veteran status",
    required: false,
    group: "eeoc",
    getValue: (p) => p.veteranStatus?.trim() ?? "",
  },
  {
    key: "disabilityStatus",
    label: "Disability status",
    required: false,
    group: "eeoc",
    getValue: (p) => p.disabilityStatus?.trim() ?? "",
  },
  {
    key: "coverLetter",
    label: "Cover letter",
    required: false,
    group: "resume",
    getValue: (p) => p.coverLetter?.trim() ?? "",
  },
  {
    key: "hobbies",
    label: "Hobbies / Interests",
    required: false,
    group: "resume",
    getValue: (p) => (p.hobbies?.length ? "ok" : ""),
  },
  {
    key: "skills",
    label: "Skills (3+)",
    required: false,
    group: "resume",
    getValue: (p) => (p.skills.length >= 3 ? "ok" : ""),
  },
  {
    key: "projects",
    label: "Projects portfolio",
    required: false,
    group: "resume",
    getValue: (p) => (p.projects && p.projects.length > 0 ? "ok" : ""),
  },
  {
    key: "summary",
    label: "Professional summary",
    required: false,
    group: "resume",
    getValue: (p) => p.summary?.trim() ?? "",
  },
];

export interface ProfileValidation {
  complete: boolean;
  score: number;
  missingRequired: ProfileFieldDef[];
  missingOptional: ProfileFieldDef[];
  filled: ProfileFieldDef[];
}

export function validateProfile(p: Profile): ProfileValidation {
  const missingRequired: ProfileFieldDef[] = [];
  const missingOptional: ProfileFieldDef[] = [];
  const filled: ProfileFieldDef[] = [];

  for (const field of PROFILE_FIELDS) {
    const val = field.getValue(p);
    if (val) {
      filled.push(field);
    } else if (field.required) {
      missingRequired.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  const total = PROFILE_FIELDS.filter((f) => f.required).length;
  const done = total - missingRequired.length;
  const score = Math.round((done / total) * 100);

  return {
    complete: missingRequired.length === 0,
    score,
    missingRequired,
    missingOptional,
    filled,
  };
}

/** Merge parsed resume data into existing profile — parsed wins on non-empty extracted fields, arrays merge cleanly. */
export function mergeProfileFromParse(existing: Profile, parsed: Profile): Profile {
  const preferParsed = <T>(parsedVal: T, existingVal: T): T => {
    if (typeof parsedVal === "string" && parsedVal.trim()) return parsedVal;
    if (parsedVal !== null && parsedVal !== undefined && typeof parsedVal !== "string") return parsedVal;
    return existingVal;
  };

  const pick = <T>(oldVal: T, newVal: T, empty: (v: T) => boolean = (v) => !v): T =>
    empty(oldVal) ? newVal : oldVal;

  const mergedSkills = (() => {
    const pSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
    const eSkills = Array.isArray(existing.skills) ? existing.skills : [];
    const combined = [...pSkills, ...eSkills];
    const seen = new Set<string>();
    return combined.filter((s) => {
      const norm = String(s).toLowerCase().trim();
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  })();

  const merged: Profile = {
    ...existing,
    firstName: preferParsed(parsed.firstName, existing.firstName),
    lastName: preferParsed(parsed.lastName, existing.lastName),
    middleName: preferParsed(parsed.middleName, existing.middleName),
    preferredName: preferParsed(parsed.preferredName, existing.preferredName),
    email: preferParsed(parsed.email, existing.email),
    phone: preferParsed(parsed.phone, existing.phone),
    phoneCountryCode: preferParsed(parsed.phoneCountryCode, existing.phoneCountryCode || "+91"),
    alternatePhone: preferParsed(parsed.alternatePhone, existing.alternatePhone),
    address: preferParsed(parsed.address, existing.address),
    addressLine2: preferParsed(parsed.addressLine2, existing.addressLine2),
    city: preferParsed(parsed.city, existing.city),
    state: preferParsed(parsed.state, existing.state),
    pincode: preferParsed(parsed.pincode, existing.pincode),
    location: preferParsed(parsed.location, existing.location || [parsed.city, parsed.state].filter(Boolean).join(", ")),
    country: preferParsed(parsed.country, existing.country),
    linkedin: preferParsed(parsed.linkedin, existing.linkedin),
    github: preferParsed(parsed.github, existing.github),
    website: preferParsed(parsed.website, existing.website),
    portfolio: preferParsed(parsed.portfolio, existing.portfolio),
    twitter: preferParsed(parsed.twitter, existing.twitter),
    summary: preferParsed(parsed.summary, existing.summary),
    gender: preferParsed(parsed.gender, existing.gender),
    pronouns: preferParsed(parsed.pronouns, existing.pronouns),
    dateOfBirth: preferParsed(parsed.dateOfBirth, existing.dateOfBirth),
    nationality: preferParsed(parsed.nationality, existing.nationality),
    maritalStatus: preferParsed(parsed.maritalStatus, existing.maritalStatus),
    citizenship: preferParsed(parsed.citizenship, existing.citizenship),
    visaType: preferParsed(parsed.visaType, existing.visaType),
    visaExpiryDate: preferParsed(parsed.visaExpiryDate, existing.visaExpiryDate),
    currentCTC: preferParsed(parsed.currentCTC, existing.currentCTC),
    expectedCTC: preferParsed(parsed.expectedCTC, existing.expectedCTC),
    salaryCurrency: preferParsed(parsed.salaryCurrency, existing.salaryCurrency || "INR"),
    noticePeriod: preferParsed(parsed.noticePeriod, existing.noticePeriod),
    yearsOfExperience: preferParsed(parsed.yearsOfExperience, existing.yearsOfExperience),
    ethnicity: preferParsed(parsed.ethnicity, existing.ethnicity),
    race: preferParsed(parsed.race, existing.race),
    hispanicLatino: preferParsed(parsed.hispanicLatino, existing.hispanicLatino),
    veteranStatus: preferParsed(parsed.veteranStatus, existing.veteranStatus),
    disabilityStatus: preferParsed(parsed.disabilityStatus, existing.disabilityStatus),
    coverLetter: preferParsed(parsed.coverLetter, existing.coverLetter),
    ssn: pick(existing.ssn, parsed.ssn),
    passportNumber: pick(existing.passportNumber, parsed.passportNumber),
    drivingLicenseNumber: pick(existing.drivingLicenseNumber, parsed.drivingLicenseNumber),
    emergencyContactName: pick(existing.emergencyContactName, parsed.emergencyContactName),
    emergencyContactPhone: pick(existing.emergencyContactPhone, parsed.emergencyContactPhone),
    emergencyContactRelation: pick(existing.emergencyContactRelation, parsed.emergencyContactRelation),
    skills: mergedSkills,
    experience: Array.isArray(parsed.experience) && parsed.experience.length ? parsed.experience : (existing.experience ?? []),
    education: Array.isArray(parsed.education) && parsed.education.length ? parsed.education : (existing.education ?? []),
    projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : (existing.projects ?? []),
    certifications: Array.isArray(parsed.certifications) && parsed.certifications.length ? parsed.certifications : (existing.certifications ?? []),
    languages: Array.isArray(parsed.languages) && parsed.languages.length ? parsed.languages : (existing.languages ?? []),
    awards: Array.isArray(parsed.awards) && parsed.awards.length ? parsed.awards : (existing.awards ?? []),
    publications: Array.isArray(parsed.publications) && parsed.publications.length ? parsed.publications : (existing.publications ?? []),
    hobbies: Array.isArray(parsed.hobbies) && parsed.hobbies.length ? parsed.hobbies : (existing.hobbies ?? []),
    masterResumeText: parsed.masterResumeText || existing.masterResumeText,
    resumeFileName: preferParsed(parsed.resumeFileName, existing.resumeFileName),
    resumeMimeType: preferParsed(parsed.resumeMimeType, existing.resumeMimeType),
    resumeUploadedAt: parsed.resumeUploadedAt || existing.resumeUploadedAt,
    updatedAt: Date.now(),
  };

  if (!merged.location && merged.city) {
    merged.location = [merged.city, merged.state].filter(Boolean).join(", ");
  }

  return merged;
}

export type ProfileSetupStep = "upload" | "mandatory" | "details" | "screening" | "ready";

export function suggestSetupStep(p: Profile): ProfileSetupStep {
  const v = validateProfile(p);
  if (!p.masterResumeText?.trim()) return "upload";
  if (v.missingRequired.some((f) => f.group === "contact" || f.group === "work" || f.group === "education")) {
    return "mandatory";
  }
  if (v.missingRequired.some((f) => f.group === "india")) return "screening";
  if (!v.complete) return "mandatory";
  return "ready";
}
