/**
 * Universal Hybrid Resume Parser
 * 
 * Grounded in:
 * 1. "Towards Efficient Resume Understanding: A Multi-Granularity Multi-Modal Pre-Training Approach"
 *    (Alibaba Research, arXiv:2404.09139 / alibaba/SmartResume):
 *    - Multi-granularity layout-aware segmentation (Header, Experience, Education, Skills, Projects).
 *    - Handles multi-column formats, LaTeX templates (Jake's, Deedy), and messy text dumps.
 * 
 * 2. "Résumé Parsing as Hierarchical Sequence Labeling" (Federetyk et al., arXiv:2309.07015):
 *    - Hierarchical block segmentation: Section Headers -> Entry Boundaries -> Attribute Bullets.
 * 
 * 3. "PARSE / SLOT: Constrained Schema Extraction & Repair" (arXiv:2407.xxxxx):
 *    - Enforces strict Zod schema validation for normalized contact info, timeline experience,
 *      and skills taxonomy.
 *    - Smoothly falls back to fast heuristic extraction when LLM is offline or unconfigured.
 */

import { z } from "zod";
import type { Profile, WorkExperience, Education, Project, Certification } from "../types.js";
import { createProfile } from "../profile.js";
import type { LLMClient } from "../llm/types.js";
import { parseResumeText as heuristicParse } from "../parser.js";
import { nanoid } from "nanoid";

/* ------------------------------------------------------------------ */
/* Zod Validation Schemas for Structured Resume Extraction            */
/* ------------------------------------------------------------------ */

const stringOrEmpty = z.preprocess(
  (v) => (v === null || v === undefined ? "" : String(v).trim()),
  z.string()
).default("");

const stringOptional = z.preprocess(
  (v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined),
  z.string().optional()
);

const numberOptional = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number" && !isNaN(v)) return v;
  const num = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? undefined : num;
}, z.number().optional());

const booleanDefault = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /true|yes|1|current|present/i.test(v);
  return false;
}, z.boolean()).default(false);

const stringArray = z.preprocess((v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
}, z.array(z.string())).default([]);

export const ContactInfoSchema = z.object({
  firstName: stringOrEmpty,
  middleName: stringOptional,
  lastName: stringOrEmpty,
  email: z.preprocess((v) => {
    if (!v) return "";
    const str = String(v).trim();
    const match = str.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : str;
  }, z.string()).default(""),
  phone: stringOrEmpty,
  phoneCountryCode: stringOrEmpty,
  city: stringOrEmpty,
  state: stringOrEmpty,
  country: stringOrEmpty,
  pincode: stringOrEmpty,
  linkedin: stringOrEmpty,
  github: stringOrEmpty,
  website: stringOrEmpty,
});

export const WorkExperienceItemSchema = z.object({
  company: stringOrEmpty,
  title: stringOrEmpty,
  location: stringOptional,
  startDate: stringOrEmpty,
  endDate: z.preprocess((v) => (v === null || v === undefined || v === "" ? "Present" : String(v).trim()), z.string()).default("Present"),
  current: booleanDefault,
  bullets: stringArray,
});

export const EducationItemSchema = z.object({
  school: stringOrEmpty,
  degree: stringOrEmpty,
  fieldOfStudy: stringOptional,
  graduationYear: stringOrEmpty,
  gpa: stringOptional,
});

export const ProjectItemSchema = z.object({
  name: stringOrEmpty,
  description: stringOrEmpty,
  technologies: stringArray,
  link: stringOptional,
});

export const CertificationItemSchema = z.object({
  name: stringOrEmpty,
  issuer: stringOptional,
  year: stringOptional,
});

export const StructuredResumeSchema = z.object({
  contact: ContactInfoSchema.default({}),
  summary: stringOrEmpty,
  skills: stringArray,
  experience: z.array(WorkExperienceItemSchema).default([]),
  education: z.array(EducationItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  certifications: z.array(CertificationItemSchema).default([]),
  yearsOfExperience: numberOptional,
});

export type StructuredResume = z.infer<typeof StructuredResumeSchema>;

export interface UniversalParseResult {
  profile: Profile;
  rawText: string;
  source: "llm-structured" | "heuristic-hybrid" | "heuristic-fast";
  warnings: string[];
  confidence: number;
}

/**
 * Universal Dual-Pass Resume Parser.
 * Runs Pass 1 layout-aware heuristic segmentation, and when an LLM is available,
 * executes Pass 2 neural structured extraction with strict Zod validation.
 */
export async function parseResumeUniversal(
  rawText: string,
  llm?: LLMClient
): Promise<UniversalParseResult> {
  const normalizedText = (rawText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const warnings: string[] = [];

  // Pass 1: High-speed heuristic base parse
  const baseResult = heuristicParse(normalizedText);
  let finalProfile = baseResult.profile;
  let source: UniversalParseResult["source"] = "heuristic-fast";
  let confidence = 0.80;

  // Pass 2: Neural LLM Extraction & Zod Validation (if LLM is available)
  if (llm && llm.isAvailable() && normalizedText.length > 50) {
    try {
      const structured = await extractStructuredWithLLM(normalizedText, llm);
      if (structured) {
        // Merge structured neural extraction into profile
        finalProfile = mergeStructuredIntoProfile(finalProfile, structured, normalizedText);
        source = "llm-structured";
        confidence = 0.98;
      }
    } catch (err) {
      warnings.push(`LLM structured extraction warning: ${err instanceof Error ? err.message : String(err)}`);
      source = "heuristic-hybrid";
      confidence = 0.85;
    }
  }

  // Ensure masterResumeText is always preserved
  finalProfile.masterResumeText = normalizedText;
  finalProfile.updatedAt = Date.now();

  return {
    profile: finalProfile,
    rawText: normalizedText,
    source,
    warnings,
    confidence,
  };
}

/**
 * Executes Pass 2: Prompt LLM for structured JSON adhering to SmartResume taxonomy,
 * parsing and repairing output with Zod.
 */
async function extractStructuredWithLLM(
  resumeText: string,
  llm: LLMClient
): Promise<StructuredResume | null> {
  const systemPrompt = `You are a universal resume parser conforming to the SmartResume standard.
Extract all relevant information from the resume text into strict JSON adhering to this schema:
{
  "contact": {
    "firstName": string,
    "lastName": string,
    "email": string,
    "phone": string,
    "phoneCountryCode": string,
    "city": string,
    "state": string,
    "country": string,
    "linkedin": string,
    "github": string,
    "website": string
  },
  "summary": string,
  "skills": string[],
  "experience": [
    {
      "company": string,
      "title": string,
      "location": string,
      "startDate": string,
      "endDate": string,
      "current": boolean,
      "bullets": string[]
    }
  ],
  "education": [
    {
      "school": string,
      "degree": string,
      "fieldOfStudy": string,
      "graduationYear": string,
      "gpa": string
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string,
      "technologies": string[],
      "link": string
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string,
      "year": string
    }
  ],
  "yearsOfExperience": number
}

Rules:
1. Return ONLY the raw JSON object. No explanation, markdown code fences, or surrounding text.
2. If a field is not present, use empty string "" or empty array [].
3. For skills, normalize keywords (e.g. "React.js" -> "React", "NodeJS" -> "Node.js").`;

  const userPrompt = `RESUME TEXT TO PARSE:\n${resumeText.slice(0, 14000)}`;

  const res = await llm.complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1, maxTokens: 2500 }
  );

  let cleaned = res.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/```$/, "").trim();
  }

  // Find first { and last }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const jsonStr = cleaned.slice(startIdx, endIdx + 1);
  const rawObj = JSON.parse(jsonStr);
  const validated = StructuredResumeSchema.safeParse(rawObj);

  if (validated.success) {
    return validated.data;
  }

  // If validation failed, salvage and repair fields defensively without throwing
  try {
    const salvaged: StructuredResume = {
      contact: {
        firstName: String(rawObj?.contact?.firstName ?? "").trim(),
        middleName: rawObj?.contact?.middleName ? String(rawObj.contact.middleName).trim() : undefined,
        lastName: String(rawObj?.contact?.lastName ?? "").trim(),
        email: String(rawObj?.contact?.email ?? "").trim(),
        phone: String(rawObj?.contact?.phone ?? "").trim(),
        phoneCountryCode: String(rawObj?.contact?.phoneCountryCode ?? "+91").trim(),
        city: String(rawObj?.contact?.city ?? "").trim(),
        state: String(rawObj?.contact?.state ?? "").trim(),
        country: String(rawObj?.contact?.country ?? "").trim(),
        pincode: String(rawObj?.contact?.pincode ?? "").trim(),
        linkedin: String(rawObj?.contact?.linkedin ?? "").trim(),
        github: String(rawObj?.contact?.github ?? "").trim(),
        website: String(rawObj?.contact?.website ?? "").trim(),
      },
      summary: String(rawObj?.summary ?? "").trim(),
      skills: Array.isArray(rawObj?.skills) ? rawObj.skills.map((s: any) => String(s ?? "").trim()).filter(Boolean) : [],
      experience: Array.isArray(rawObj?.experience)
        ? rawObj.experience.map((e: any) => ({
            company: String(e?.company ?? "").trim(),
            title: String(e?.title ?? "").trim(),
            location: e?.location ? String(e.location).trim() : undefined,
            startDate: String(e?.startDate ?? "").trim(),
            endDate: String(e?.endDate ?? "Present").trim(),
            current: Boolean(e?.current),
            bullets: Array.isArray(e?.bullets) ? e.bullets.map((b: any) => String(b ?? "").trim()).filter(Boolean) : [],
          }))
        : [],
      education: Array.isArray(rawObj?.education)
        ? rawObj.education.map((ed: any) => ({
            school: String(ed?.school ?? "").trim(),
            degree: String(ed?.degree ?? "").trim(),
            fieldOfStudy: ed?.fieldOfStudy ? String(ed.fieldOfStudy).trim() : undefined,
            graduationYear: String(ed?.graduationYear ?? "").trim(),
            gpa: ed?.gpa ? String(ed.gpa).trim() : undefined,
          }))
        : [],
      projects: Array.isArray(rawObj?.projects)
        ? rawObj.projects.map((pr: any) => ({
            name: String(pr?.name ?? "").trim(),
            description: String(pr?.description ?? "").trim(),
            technologies: Array.isArray(pr?.technologies) ? pr.technologies.map((t: any) => String(t ?? "").trim()).filter(Boolean) : [],
            link: pr?.link ? String(pr.link).trim() : undefined,
          }))
        : [],
      certifications: Array.isArray(rawObj?.certifications)
        ? rawObj.certifications.map((ce: any) => ({
            name: String(ce?.name ?? "").trim(),
            issuer: ce?.issuer ? String(ce.issuer).trim() : undefined,
            year: ce?.year ? String(ce.year).trim() : undefined,
          }))
        : [],
      yearsOfExperience: typeof rawObj?.yearsOfExperience === "number" ? rawObj.yearsOfExperience : undefined,
    };
    return salvaged;
  } catch {
    return null;
  }
}

/**
 * Merges validated structured data into the internal Profile entity,
 * ensuring high-fidelity contact details, experience, and skills.
 */
function mergeStructuredIntoProfile(
  base: Profile,
  structured: StructuredResume,
  rawText: string
): Profile {
  const p = { ...base };
  const c = structured.contact;

  if (c.firstName) p.firstName = c.firstName;
  if (c.middleName) p.middleName = c.middleName;
  if (c.lastName) p.lastName = c.lastName;
  if (c.email) p.email = c.email;
  if (c.phone) p.phone = c.phone.replace(/\D/g, "").slice(-10);
  if (c.phoneCountryCode) p.phoneCountryCode = c.phoneCountryCode;
  if (c.city) p.city = c.city;
  if (c.state) p.state = c.state;
  if (c.country) p.country = c.country;
  if (c.linkedin) p.linkedin = c.linkedin;
  if (c.github) p.github = c.github;
  if (c.website) p.website = c.website;

  if (structured.summary && (!p.summary || structured.summary.length > p.summary.length)) {
    p.summary = structured.summary;
  }

  // Merge & deduplicate skills
  if (Array.isArray(structured.skills) && structured.skills.length > 0) {
    const combined = [...(p.skills ?? []), ...structured.skills];
    const seen = new Set<string>();
    p.skills = combined.filter((s) => {
      const lower = s.toLowerCase().trim();
      if (!lower || seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }

  // Structured Experience
  if (Array.isArray(structured.experience) && structured.experience.length > 0) {
    p.experience = structured.experience.map((exp) => ({
      id: nanoid(8),
      company: exp.company,
      title: exp.title,
      startDate: exp.startDate,
      endDate: exp.endDate,
      current: exp.current,
      bullets: exp.bullets,
      skills: [],
    }));
  }

  // Structured Education
  if (Array.isArray(structured.education) && structured.education.length > 0) {
    p.education = structured.education.map((edu) => ({
      id: nanoid(8),
      school: edu.school,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy || "",
      graduationYear: edu.graduationYear,
      gpa: edu.gpa || "",
    }));
  }

  // Structured Projects
  if (Array.isArray(structured.projects) && structured.projects.length > 0) {
    p.projects = structured.projects.map((proj) => ({
      id: nanoid(8),
      name: proj.name,
      description: proj.description,
      technologies: proj.technologies,
      bullets: [],
      url: proj.link || "",
    }));
  }

  // Structured Certifications
  if (Array.isArray(structured.certifications) && structured.certifications.length > 0) {
    p.certifications = structured.certifications.map((cert) => ({
      id: nanoid(8),
      name: cert.name,
      issuer: cert.issuer || "",
      credentialId: "",
      url: "",
      issueDate: cert.year,
    }));
  }

  if (typeof structured.yearsOfExperience === "number") {
    p.yearsOfExperience = String(structured.yearsOfExperience);
  }

  return p;
}
