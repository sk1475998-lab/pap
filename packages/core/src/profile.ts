import { nanoid } from "nanoid";
import type { Profile } from "./types.js";

/** Create a blank profile with a stable id. */
export function createProfile(partial: Partial<Profile> = {}): Profile {
  return {
    id: partial.id ?? nanoid(10),
    // Personal identity
    firstName: partial.firstName ?? "",
    lastName: partial.lastName ?? "",
    headline: partial.headline ?? "",
    middleName: partial.middleName ?? "",
    preferredName: partial.preferredName ?? "",
    pronouns: partial.pronouns ?? "",
    gender: partial.gender ?? "",
    dateOfBirth: partial.dateOfBirth ?? "",
    nationality: partial.nationality ?? "",
    maritalStatus: partial.maritalStatus ?? "",
    // Contact
    email: partial.email ?? "",
    phone: partial.phone ?? "",
    phoneCountryCode: partial.phoneCountryCode ?? "+91",
    alternatePhone: partial.alternatePhone ?? "",
    // Address
    address: partial.address ?? "",
    addressLine2: partial.addressLine2 ?? "",
    city: partial.city ?? "",
    state: partial.state ?? "",
    pincode: partial.pincode ?? "",
    country: partial.country ?? "",
    location: partial.location ?? "",
    // Online presence
    linkedin: partial.linkedin ?? "",
    github: partial.github ?? "",
    website: partial.website ?? "",
    portfolio: partial.portfolio ?? "",
    twitter: partial.twitter ?? "",
    // Resume artifacts
    resumeUrl: partial.resumeUrl ?? "",
    resumeFileName: partial.resumeFileName ?? "",
    resumeMimeType: partial.resumeMimeType ?? "",
    resumeUploadedAt: partial.resumeUploadedAt ?? 0,
    coverLetter: partial.coverLetter ?? "",
    masterResumeText: partial.masterResumeText ?? "",
    // Locale
    locale: partial.locale ?? "IN",
    // Work authorization & citizenship
    workAuthorization: partial.workAuthorization ?? "",
    requiresSponsorship: partial.requiresSponsorship ?? "",
    citizenship: partial.citizenship ?? "",
    visaType: partial.visaType ?? "",
    visaExpiryDate: partial.visaExpiryDate ?? "",
    i94ExpiryDate: partial.i94ExpiryDate ?? "",
    // Work preferences
    willingToRelocate: partial.willingToRelocate ?? "",
    immediateJoiner: partial.immediateJoiner ?? "",
    yearsOfExperience: partial.yearsOfExperience ?? "",
    // Compensation
    currentCTC: partial.currentCTC ?? "",
    expectedCTC: partial.expectedCTC ?? "",
    ctcCurrency: partial.ctcCurrency ?? "INR",
    salaryExpectation: partial.salaryExpectation ?? "",
    salaryCurrency: partial.salaryCurrency ?? "USD",
    noticePeriod: partial.noticePeriod ?? "",
    lastWorkingDay: partial.lastWorkingDay ?? "",
    // India IDs
    pan: partial.pan ?? "",
    aadhaar: partial.aadhaar ?? "",
    // US/Global IDs
    ssn: partial.ssn ?? "",
    passportNumber: partial.passportNumber ?? "",
    drivingLicenseNumber: partial.drivingLicenseNumber ?? "",
    // EEOC / Diversity
    ethnicity: partial.ethnicity ?? "",
    race: partial.race ?? "",
    hispanicLatino: partial.hispanicLatino ?? "",
    veteranStatus: partial.veteranStatus ?? "",
    disabilityStatus: partial.disabilityStatus ?? "",
    // Additional form fields
    hasDrivingLicense: partial.hasDrivingLicense ?? "",
    hasOwnVehicle: partial.hasOwnVehicle ?? "",
    hasMilitaryService: partial.hasMilitaryService ?? "",
    smoker: partial.smoker ?? "",
    referralSource: partial.referralSource ?? "",
    referralName: partial.referralName ?? "",
    // Emergency contact
    emergencyContactName: partial.emergencyContactName ?? "",
    emergencyContactPhone: partial.emergencyContactPhone ?? "",
    emergencyContactRelation: partial.emergencyContactRelation ?? "",
    // Background check
    consentToBackgroundCheck: partial.consentToBackgroundCheck ?? "",
    consentToDrugScreening: partial.consentToDrugScreening ?? "",
    // Content
    summary: partial.summary ?? "",
    skills: partial.skills ?? [],
    experience: partial.experience ?? [],
    education: partial.education ?? [],
    projects: partial.projects ?? [],
    certifications: partial.certifications ?? [],
    languages: partial.languages ?? [],
    awards: partial.awards ?? [],
    publications: partial.publications ?? [],
    hobbies: partial.hobbies ?? [],
    socialLinks: partial.socialLinks ?? [],
    workAuthorizations: partial.workAuthorizations ?? [],
    jobPreferences: partial.jobPreferences ?? { roleTitles: [], locations: [], remotePreference: "", minSalary: "", currency: "", excludedCompanies: [] },
    // Login / email monitoring
    defaultLoginEmail: partial.defaultLoginEmail ?? "",
    defaultLoginPassword: partial.defaultLoginPassword ?? "",
    // Learned answers
    learnedLog: partial.learnedLog ?? [],
    customAnswers: partial.customAnswers ?? {},
    updatedAt: Date.now(),
  };
}

/** Flatten profile into a single text blob for matching / LLM context. */
export function profileToText(p: Profile): string {
  const experienceList = Array.isArray(p.experience) && p.experience.length > 0
    ? p.experience
    : Array.isArray((p as any).workExperience)
      ? (p as any).workExperience
      : [];
  const exp = experienceList
    .map(
      (e: any) =>
        `${e.title} @ ${e.company} (${e.startDate ?? ""}-${e.endDate ?? ""})\n` +
        (e.bullets ?? []).map((b: any) => `  - ${b}`).join("\n")
    )
    .join("\n\n");
  const edu = (p.education ?? [])
    .map((e) => `${e.degree}${e.field ? " in " + e.field : ""} — ${e.school}`)
    .join("\n");
  const projects = (p.projects ?? [])
    .map((x) => `${x.name}${x.technologies?.length ? " — " + x.technologies.join(", ") : ""}\n${x.description ?? ""}\n${(x.bullets ?? []).map((b) => `  - ${b}`).join("\n")}`)
    .join("\n\n");
  const certs = (p.certifications ?? [])
    .map((c) => `${c.name}${c.issuer ? " — " + c.issuer : ""}`)
    .join("\n");
  return [
    `${p.firstName} ${p.lastName}`,
    `${p.email} | ${p.phone} | ${p.location}`,
    p.linkedin,
    p.github,
    p.website,
    "",
    "SUMMARY",
    p.summary,
    "",
    "SKILLS",
    p.skills.join(", "),
    "",
    "EXPERIENCE",
    exp,
    "",
    "EDUCATION",
    edu,
    "",
    "PROJECTS",
    projects,
    "",
    "CERTIFICATIONS",
    certs,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A flat lookup of profile values keyed by canonical field name. */
export interface ProfileLookup {
  [key: string]: string | string[];
}

/** Normalize `skills` from either an array, a legacy CSV string, or nothing. */
function normalizeSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x: unknown) => (x == null ? "" : String(x)));
  if (typeof raw === "string") return raw.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Join non-empty stringified parts with ", " (skips null/blank entries). */
function joinNonEmpty(parts: unknown[]): string {
  return parts
    .map((x) => (x == null ? "" : String(x)))
    .filter((s) => s.trim().length > 0)
    .join(", ");
}

export function profileToLookup(p: Profile): ProfileLookup {
  const safe = p ?? ({} as Profile);
  const safeStr = (v: unknown, d = ""): string => {
    if (v == null) return d;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
    if (Array.isArray(v)) return v.map((x: unknown) => (x == null ? "" : String(x))).join(", ");
    return d;
  };
  const phoneDigits = safeStr(safe.phone).replace(/\s+/g, "");
  const fullPhone = phoneDigits.startsWith("+") ? phoneDigits : `${safeStr(safe.phoneCountryCode)}${phoneDigits}`.replace(/\++/g, "+");
  const city = resolveCity(safe);
  const { years: experienceYears, months: experienceMonths } = splitExperience(safeStr(safe.yearsOfExperience));
  const noticePeriodDays = parseNoticeDays(safeStr(safe.noticePeriod));
  const dob = parseDateOfBirth(safeStr(safe.dateOfBirth));

  const lookup: ProfileLookup = {
    firstName: safeStr(safe.firstName),
    middleName: safeStr(safe.middleName),
    lastName: safeStr(safe.lastName),
    fullName: [safe.firstName, safe.middleName, safe.lastName].filter(Boolean).map((s: unknown) => safeStr(s)).join(" ").trim(),
    name: [safe.firstName, safe.middleName, safe.lastName].filter(Boolean).map((s: unknown) => safeStr(s)).join(" ").trim(),
    email: safeStr(safe.email),
    phone: safeStr(safe.phone),
    phoneCountryCode: safeStr(safe.phoneCountryCode),
    fullPhone,
    location: city || safeStr(safe.location),
    city,
    preferredLocation: city,
    state: safeStr(safe.state),
    pincode: safeStr(safe.pincode),
    country: safeStr(safe.country),
    linkedin: safeStr(safe.linkedin),
    github: safeStr(safe.github),
    website: safeStr(safe.website),
    portfolio: safeStr(safe.portfolio) || safeStr(safe.website),
    resumeUrl: safeStr(safe.resumeUrl),
    workAuthorization: safeStr(safe.workAuthorization),
    requiresSponsorship: safeStr(safe.requiresSponsorship),
    sponsorship: safeStr(safe.requiresSponsorship),
    willingToRelocate: safeStr(safe.willingToRelocate),
    relocate: safeStr(safe.willingToRelocate),
    immediateJoiner: safeStr(safe.immediateJoiner),
    yearsOfExperience: safeStr(safe.yearsOfExperience),
    experienceYears: safeStr(experienceYears),
    experienceMonths: safeStr(experienceMonths),
    currentCTC: safeStr(safe.currentCTC),
    expectedCTC: safeStr(safe.expectedCTC),
    annualCurrentSalary: salaryToAnnual(safeStr(safe.currentCTC)),
    annualExpectedSalary: salaryToAnnual(safeStr(safe.expectedCTC)),
    ctcCurrency: safeStr(safe.ctcCurrency),
    noticePeriod: safeStr(safe.noticePeriod),
    noticePeriodDays: safeStr(noticePeriodDays),
    lastWorkingDay: safeStr(safe.lastWorkingDay),
    pan: safeStr(safe.pan),
    aadhaar: safeStr(safe.aadhaar),
    gender: safeStr(safe.gender),
    birthDay: dob.day,
    birthMonth: dob.month,
    birthYear: dob.year,
    salary: safeStr(safe.expectedCTC) || safeStr(safe.salaryExpectation),
    salaryExpectation: safeStr(safe.expectedCTC) || safeStr(safe.salaryExpectation),
    headline: safeStr((safe as any).headline) || safeStr((safe.experience as any[])?.[0]?.title) || safeStr(safe.summary?.slice(0, 80)),
    pronouns: safeStr(safe.pronouns),
    summary: safeStr(safe.summary),
    skills: normalizeSkills(safe.skills),
    skillsList: normalizeSkills(safe.skills).slice(0, 15).join(", "),
    projects: joinNonEmpty(((safe.projects ?? []) as any[]).map((x: any) => safeStr(x?.name))),
    projectNames: joinNonEmpty(((safe.projects ?? []) as any[]).map((x: any) => safeStr(x?.name))),
    projectDescription: safeStr((safe.projects as any[])?.[0]?.description) || ((safe.projects as any[])?.[0]?.bullets || []).join("\n") || "",
    certifications: joinNonEmpty(((safe.certifications ?? []) as any[]).map((c: any) => safeStr(c?.name))),
    languages: joinNonEmpty(((safe.languages ?? []) as any[]).map((x: unknown) => safeStr(x))),
    awards: joinNonEmpty(((safe.awards ?? []) as any[]).map((x: unknown) => safeStr(x))),
    publications: joinNonEmpty(((safe.publications ?? []) as any[]).map((x: unknown) => safeStr(x))),
    ethnicity: safeStr(safe.ethnicity),
    race: safeStr(safe.race),
    hispanicLatino: safeStr(safe.hispanicLatino),
    veteranStatus: safeStr(safe.veteranStatus),
    disabilityStatus: safeStr(safe.disabilityStatus),
    defaultLoginEmail: safeStr(safe.defaultLoginEmail),
    defaultLoginPassword: safeStr(safe.defaultLoginPassword),
    remotePreference: safeStr(safe.jobPreferences?.remotePreference),
    minSalary: safeStr(safe.jobPreferences?.minSalary),
    gpa: safeStr(((safe.education ?? []) as any[])[0]?.gpa),
    diplomaPercentage: safeStr(((safe.education ?? []) as any[])[0]?.gpa),
    preferredName: safeStr(safe.preferredName),
    nationality: safeStr(safe.nationality),
    maritalStatus: safeStr(safe.maritalStatus),
    alternatePhone: safeStr(safe.alternatePhone),
    address: safeStr(safe.address),
    addressLine2: safeStr(safe.addressLine2),
    zipCode: safeStr(safe.pincode),
    postalCode: safeStr(safe.pincode),
    portfolioUrl: safeStr(safe.portfolio),
    twitter: safeStr(safe.twitter),
    coverLetter: safeStr(safe.coverLetter),
    citizenship: safeStr(safe.citizenship),
    visaType: safeStr(safe.visaType),
    visaExpiryDate: safeStr(safe.visaExpiryDate),
    i94ExpiryDate: safeStr(safe.i94ExpiryDate),
    salaryCurrency: safeStr(safe.salaryCurrency),
    ssn: p.ssn,
    passportNumber: p.passportNumber,
    drivingLicenseNumber: p.drivingLicenseNumber,
    hasDrivingLicense: p.hasDrivingLicense,
    hasOwnVehicle: p.hasOwnVehicle,
    hasMilitaryService: p.hasMilitaryService,
    smoker: p.smoker,
    referralSource: p.referralSource,
    referralName: p.referralName,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    emergencyContactRelation: p.emergencyContactRelation,
    consentToBackgroundCheck: p.consentToBackgroundCheck,
    consentToDrugScreening: p.consentToDrugScreening,
    hobbies: (p.hobbies ?? []).join(", "),
    discipline: safeStr(((p.education ?? []) as any[])[0]?.discipline),
    gradePercentile: safeStr(((p.education ?? []) as any[])[0]?.gradePercentile),
  };

  // Dynamically map all experience entries (null/partial entries are dropped first)
  const experiences = (p.experience ?? []).filter((e): e is NonNullable<typeof e> => e != null);
  const sortedExperience = [...experiences].sort((a, b) => {
    const isCurrentA = !a.endDate || /present|current|now|active/i.test(a.endDate) || a.current === true || (a as any).isCurrent === true;
    const isCurrentB = !b.endDate || /present|current|now|active/i.test(b.endDate) || b.current === true || (b as any).isCurrent === true;
    if (isCurrentA && !isCurrentB) return -1;
    if (!isCurrentA && isCurrentB) return 1;

    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return timeB - timeA;
  });

  sortedExperience.forEach((exp, idx) => {
    const oneIdx = idx + 1;
    const suffixes = idx === 0 ? ["", "1"] : [String(oneIdx)];
    const startObj = parseMonthYear(exp.startDate ?? "");
    const endObj = parseMonthYear(exp.endDate ?? "");
    
    for (const suffix of suffixes) {
      lookup[`jobTitle${suffix}`] = exp.title;
      lookup[`yourTitle${suffix}`] = exp.title;
      lookup[`company${suffix}`] = exp.company;
      lookup[`workExperienceCompany${suffix}`] = exp.company;
      lookup[`employer${suffix}`] = exp.company;
      lookup[`organization${suffix}`] = exp.company;
      lookup[`experienceDescription${suffix}`] = (exp.bullets ?? []).join("\n");
      lookup[`experienceLocation${suffix}`] = exp.location ?? city;
      lookup[`experienceStartDate${suffix}`] = exp.startDate ?? "";
      lookup[`experienceEndDate${suffix}`] = exp.endDate ?? "";
      lookup[`experienceStartMonth${suffix}`] = startObj.month;
      lookup[`experienceStartYear${suffix}`] = startObj.year;
      lookup[`experienceEndMonth${suffix}`] = endObj.month;
      lookup[`experienceEndYear${suffix}`] = endObj.year;
    }
  });

  lookup.allEmployers = sortedExperience.map(e => e.company).filter(Boolean).join(" | ");
  lookup.allCompanies = sortedExperience.map(e => e.company).filter(Boolean).join(" | ");

  // Dynamically map all education entries (null/partial entries are dropped first)
  const educations = (p.education ?? []).filter((e): e is NonNullable<typeof e> => e != null);
  const sortedEducation = [...educations].sort((a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return timeB - timeA;
  });

  sortedEducation.forEach((edu, idx) => {
    const oneIdx = idx + 1;
    const suffixes = idx === 0 ? ["", "1"] : [String(oneIdx)];
    
    for (const suffix of suffixes) {
      lookup[`school${suffix}`] = edu.school;
      lookup[`degree${suffix}`] = edu.degree;
      lookup[`major${suffix}`] = edu.field ?? "";
      lookup[`fieldOfStudy${suffix}`] = edu.field ?? "";
      lookup[`datesAttended${suffix}`] = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
      lookup[`educationStartDate${suffix}`] = edu.startDate ?? "";
      lookup[`educationEndDate${suffix}`] = edu.endDate ?? "";
      lookup[`graduationDate${suffix}`] = edu.endDate ?? "";
      const dateStr = edu.endDate || (edu as any).graduationYear || "";
      if (dateStr) {
        const yrMatch = String(dateStr).match(/\b(19|20)\d{2}\b/);
        lookup[`graduationYear${suffix}`] = yrMatch ? yrMatch[0] : String(dateStr);
      } else {
        lookup[`graduationYear${suffix}`] = "";
      }
    }
  });

  // Dynamically map all projects (null/partial entries are dropped first)
  (p.projects ?? []).filter((pr): pr is NonNullable<typeof pr> => pr != null).forEach((proj, idx) => {
    const oneIdx = idx + 1;
    const suffixes = idx === 0 ? ["", "1"] : [String(oneIdx)];
    
    for (const suffix of suffixes) {
      lookup[`projectName${suffix}`] = proj.name;
      lookup[`projectUrl${suffix}`] = proj.url;
      lookup[`projectLink${suffix}`] = proj.url;
      lookup[`projectDescription${suffix}`] = proj.description || proj.bullets?.join("\n") || "";
      lookup[`projectStartDate${suffix}`] = proj.startDate ?? "";
      lookup[`projectEndDate${suffix}`] = proj.endDate ?? "";
    }
  });

  // include custom cached answers (defensive for partial profiles)
  try {
    for (const [k, v] of Object.entries(safe.customAnswers ?? {})) {
      lookup[`custom:${k}`] = typeof v === "string" ? v : v == null ? "" : String(v);
    }
  } catch {}
  return lookup;
}

/** Pick city only — avoid using full name + city string as location value. */
function resolveCity(p: Profile): string {
  if (p.city?.trim()) return p.city.trim();
  const loc = p.location?.trim() ?? "";
  if (!loc) return "";
  const name = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
  let cleaned = loc;
  if (name && cleaned.toLowerCase().includes(name)) {
    cleaned = cleaned.replace(new RegExp(name, "i"), "").trim();
  }
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? parts[0] ?? "";
  }
  const words = cleaned.split(/\s+/);
  if (words.length > 2) return words[words.length - 1];
  return cleaned;
}

function splitExperience(years: string): { years: string; months: string } {
  const n = parseFloat(years);
  if (!years?.trim() || isNaN(n)) return { years: years ?? "", months: "" };
  const whole = Math.floor(n);
  const months = Math.round((n - whole) * 12);
  return { years: String(whole), months: months > 0 ? String(months) : "0" };
}

function parseNoticeDays(notice: string): string {
  if (!notice?.trim()) return "";
  if (/immediate/i.test(notice)) return "0";
  const m = notice.match(/(\d+)/);
  return m ? m[1] : notice;
}

import { salaryToAnnual } from "./profile-repair.js";

function parseDateOfBirth(dob: string): { day: string; month: string; year: string } {
  if (!dob?.trim()) return { day: "", month: "", year: "" };
  const slash = dob.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slash) return { day: slash[1], month: slash[2], year: slash[3] };
  const iso = dob.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (iso) return { day: iso[3], month: iso[2], year: iso[1] };
  return { day: "", month: "", year: "" };
}

export function parseMonthYear(dateStr: string): { month: string; year: string } {
  if (!dateStr?.trim()) return { month: "", year: "" };
  
  // Try ISO format like "YYYY-MM" or "YYYY-MM-DD"
  const iso = dateStr.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const mNum = parseInt(iso[2], 10);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const mName = months[mNum - 1] ?? iso[2];
    return { month: mName, year: y };
  }
  
  // Try formats like "November 2021" or "Nov 2021"
  const word = dateStr.match(/\b([a-zA-Z]+)\b.*\b(\d{4})\b/);
  if (word) {
    return { month: word[1], year: word[2] };
  }
  
  // Try formats like "2021 November"
  const wordRev = dateStr.match(/\b(\d{4})\b.*\b([a-zA-Z]+)\b/);
  if (wordRev) {
    return { month: wordRev[2], year: wordRev[1] };
  }

  // Fallback: just return the year if found
  const yr = dateStr.match(/\b(\d{4})\b/);
  return { month: "", year: yr ? yr[0] : "" };
}
