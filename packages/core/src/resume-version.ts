import { analyzeATS, suggestInsertions } from "./ats.js";
import { analyzeJobDescription } from "./jd-analyzer.js";
import { expandSkillSet, skillCovered } from "./skill-graph.js";
import type { Profile, WorkExperience } from "./types.js";
import type { LLMClient } from "./llm/types.js";

export interface ResumeVersion {
  jobKey: string;
  title: string;
  company: string;
  score: number;
  atsScore: number;
  suggestedAdditions: string[];
  keywordGaps: string[];
  createdAt: number;
  tailoredText?: string;
}

/**
 * A saved per-job tailoring, as both surfaces store it under `resumeVersions`.
 *
 * The extension keeps `Record<jobKey, ResumeVersion>` (`lib/resume-version-store.ts`)
 * while the server route kept an array of a private shape with a different id
 * scheme — one store key, two incompatible readers. This is the shared shape, so
 * a version tailored in the cloud is the same object the extension looks up by
 * `canonicalJobKey` when the user opens that posting.
 */
export interface TailoredResumeVersion extends ResumeVersion {
  /** Human label for the resume bank: "Backend Engineer @ Acme". */
  label: string;
  /** The candidate's own bullets, rewritten to surface truthful keywords. */
  bullets: string[];
  /** Keywords this posting actually asks for. */
  keywords: string[];
  /** The subset of `keywords` the profile genuinely backs up. */
  matchingSkills: string[];
  /** Present only when the caller measured one. Never defaulted. */
  matchScore?: number;
  /** Where the bullets came from: a model, or the profile unchanged. */
  source: "llm" | "profile";
  /** Which text was analysed — the uploaded résumé, or profile fields. */
  resumeSource: "masterResumeText" | "profileFields";
}

/**
 * How many tailored versions either surface keeps. One constant, because the
 * extension's store and the server's `resumeVersions` key are the same bank.
 */
export const RESUME_VERSION_LIMIT = 50;

/**
 * Upsert one version into the bank, keyed by `jobKey`, and prune the oldest.
 *
 * Both surfaces had their own copy of this: `lib/resume-version-store.ts` sliced
 * off the first keys in insertion order, and the server route pushed onto an array
 * of a different shape entirely. Pruning by `createdAt` here means "oldest" means
 * the same thing on both sides, and re-tailoring a posting replaces its entry
 * rather than adding a second one.
 */
export function upsertResumeVersion<T extends ResumeVersion>(
  existing: Record<string, T> | undefined | null,
  version: T,
  limit: number = RESUME_VERSION_LIMIT
): Record<string, T> {
  const map: Record<string, T> = { ...(existing ?? {}) };
  map[version.jobKey] = version;
  const keys = Object.keys(map);
  if (keys.length > limit) {
    const oldestFirst = keys.sort((a, b) => (map[a]?.createdAt ?? 0) - (map[b]?.createdAt ?? 0));
    for (const k of oldestFirst.slice(0, keys.length - limit)) delete map[k];
  }
  return map;
}

/** The bank as a list, newest first — what a "resume versions" UI renders. */
export function listResumeVersions<T extends ResumeVersion>(
  existing: Record<string, T> | undefined | null
): T[] {
  return Object.values(existing ?? {})
    .filter((v): v is T => Boolean(v) && typeof v === "object")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** One JD pass, shared by `buildResumeVersion` and `tailorForJob`. */
function analyzeAgainstJob(resumeText: string, jobDescription: string, profileSkills: string[]) {
  return {
    jd: analyzeJobDescription({ resumeText, jobDescription, profileSkills }),
    ats: analyzeATS(resumeText, jobDescription),
  };
}

export function buildResumeVersion(
  jobKey: string,
  title: string,
  company: string,
  resumeText: string,
  jobDescription: string,
  profileSkills: string[] = []
): ResumeVersion {
  const { jd, ats } = analyzeAgainstJob(resumeText, jobDescription, profileSkills);
  const suggestions = suggestInsertions(ats).slice(0, 8);

  return {
    jobKey,
    title,
    company,
    score: jd.score,
    atsScore: ats.score,
    suggestedAdditions: suggestions,
    keywordGaps: [...new Set([...jd.missing, ...jd.atsGaps])].slice(0, 10),
    createdAt: Date.now(),
  };
}

/**
 * Résumé text to analyse for a profile that has no uploaded résumé.
 *
 * Without this, ATS scoring for such a user reads an empty string and reports a
 * score of ~0 — which says nothing about the résumé and everything about the
 * upload being missing. Rendering their real stored experience is a truthful
 * stand-in, and the caller is told which one was used.
 */
export function resumeTextForAnalysis(profile: Profile): {
  text: string;
  source: "masterResumeText" | "profileFields";
} {
  const master = String(profile.masterResumeText ?? "").trim();
  if (master) return { text: master, source: "masterResumeText" };
  return {
    text: generateTailoredResumeText(profile, Array.isArray(profile.experience) ? profile.experience : []),
    source: "profileFields",
  };
}

/**
 * The whole per-job tailoring, in core, so the cloud and the extension produce
 * the same version for the same posting.
 *
 * The rule that shapes this function: **only keywords the candidate's own skills
 * back up are woven into the résumé.** The rest are returned as
 * `suggestedAdditions` for the user to decide on. The route this replaced did the
 * opposite — it printed five fabricated achievements with invented metrics
 * ("handling 2M+ daily requests with 99.9% uptime, reducing latency by 40%") and
 * offered them as the user's own experience.
 */
export async function tailorForJob(input: {
  jobKey: string;
  title: string;
  company: string;
  jobDescription: string;
  profile: Profile;
  llm: LLMClient;
  /** Only if the caller measured one. Never invent a match score. */
  matchScore?: number;
}): Promise<TailoredResumeVersion> {
  const { jobKey, title, company, profile, llm } = input;
  const jobDescription = String(input.jobDescription ?? "").trim();
  const profileSkills = (Array.isArray(profile.skills) ? profile.skills : []).filter(Boolean);
  const { text: resumeText, source: resumeSource } = resumeTextForAnalysis(profile);
  const { jd, ats } = analyzeAgainstJob(resumeText, jobDescription, profileSkills);

  // What this posting asks for, required first, de-duplicated case-insensitively.
  const keywords = dedupeCI([
    ...ats.requiredKeywords,
    ...ats.preferredKeywords,
    ...jd.matched,
    ...jd.missing,
  ]).slice(0, 20);

  // Truthful backing only: the user's own skills, plus child→parent graph facts
  // ("Next.js" covers "React"). `infer: false` disables the parent→child guess.
  const owned = expandSkillSet(profileSkills);
  const matchingSkills = keywords.filter((k) => skillCovered(k, owned, { infer: false }));

  // Weave in only gaps the candidate can honestly claim; suggest the rest.
  const gaps = dedupeCI([...jd.missing, ...jd.atsGaps, ...ats.missingRequired]);
  const claimable = gaps.filter((g) => skillCovered(g, owned, { infer: false }));

  const original = Array.isArray(profile.experience) ? profile.experience : [];
  const tailoredExperience = await tailorResumeExperience(profile, claimable, llm);
  const changed = JSON.stringify(tailoredExperience) !== JSON.stringify(original);
  const bullets = tailoredExperience.flatMap((e) => e.bullets ?? []).filter(Boolean).slice(0, 10);

  return {
    jobKey,
    title,
    company,
    label: company ? `${title} @ ${company}` : title,
    score: jd.score,
    atsScore: ats.score,
    suggestedAdditions: suggestInsertions(ats).slice(0, 8),
    keywordGaps: gaps.slice(0, 12),
    createdAt: Date.now(),
    tailoredText: generateTailoredResumeText(profile, tailoredExperience, claimable),
    bullets,
    keywords,
    matchingSkills,
    ...(typeof input.matchScore === "number" && Number.isFinite(input.matchScore)
      ? { matchScore: Math.round(input.matchScore) }
      : {}),
    source: changed ? "llm" : "profile",
    resumeSource,
  };
}

function dedupeCI(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export async function tailorResumeExperience(
  profile: Profile,
  missingKeywords: string[],
  llm: LLMClient
): Promise<WorkExperience[]> {
  // `experience` is optional on stored profiles (a user can save contact details
  // before any work history), so this cannot assume an array.
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  if (!llm.isAvailable() || missingKeywords.length === 0) {
    return experience;
  }

  const tailored: WorkExperience[] = [];
  for (const exp of experience) {
    if (!exp.bullets || exp.bullets.length === 0) {
      tailored.push(exp);
      continue;
    }

    const systemPrompt = "You are a professional resume writer specializing in ATS optimization. Your goal is to customize a candidate's experience bullets to cover specific target keywords naturally without changing the core truth of their achievements.";
    const userPrompt = `CANDIDATE JOB TITLE: ${exp.title} at ${exp.company}
CANDIDATE EXPERIENCE BULLETS:
${exp.bullets.map((b) => `- ${b}`).join("\n")}

TARGET KEYWORDS TO INCORPORATE:
${missingKeywords.join(", ")}

Rewrite the experience bullets to cover as many of the target keywords as possible.
Rules:
- Keep the number of bullets the same.
- Do not invent credentials, metrics, or degrees. Only weave in the keywords naturally (e.g. if keyword is "fastapi", mention implementing REST APIs using FastAPI).
- Answer with ONLY the raw rewritten bullets as a JSON array of strings: ["bullet 1", "bullet 2", ...], with no preamble or markdown code blocks.`;

    try {
      const res = await llm.complete([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], { temperature: 0.2, maxTokens: 800 });

      let cleaned = res.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```json/i, "").replace(/```$/, "").trim();
      }
      const newBullets = JSON.parse(cleaned);
      if (Array.isArray(newBullets) && newBullets.length === exp.bullets.length) {
        tailored.push({ ...exp, bullets: newBullets });
      } else {
        tailored.push(exp);
      }
    } catch {
      tailored.push(exp);
    }
  }

  return tailored;
}

export function generateTailoredResumeText(profile: Profile, tailoredExperience: WorkExperience[], missingKeywords?: string[]): string {
  const lines: string[] = [];

  const name = `${profile.firstName ?? ""} ${profile.middleName ? profile.middleName + " " : ""}${profile.lastName ?? ""}`.trim();
  if (name) lines.push(name.toUpperCase());
  
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(`${profile.phoneCountryCode || "+91"} ${profile.phone}`);
  if (profile.city || profile.state) contactParts.push(`${profile.city || ""}, ${profile.state || ""}`.trim().replace(/^,|,$/, ""));
  if (profile.linkedin) contactParts.push(profile.linkedin);
  if (profile.github) contactParts.push(profile.github);
  lines.push(contactParts.join(" | "));
  lines.push("");

  if (profile.summary) {
    lines.push("SUMMARY");
    lines.push("=======");
    lines.push(profile.summary);
    lines.push("");
  }

  if (tailoredExperience.length > 0) {
    lines.push("WORK EXPERIENCE");
    lines.push("===============");
    for (const exp of tailoredExperience) {
      const header = `${exp.title} | ${exp.company}`;
      const dates = `${exp.startDate || ""} - ${exp.endDate || ""}`;
      lines.push(`${header.padEnd(50)}${dates.padStart(20)}`);
      if (exp.location) lines.push(exp.location);
      for (const bullet of exp.bullets ?? []) {
        lines.push(`- ${bullet}`);
      }
      lines.push("");
    }
  }

  const education = Array.isArray(profile.education) ? profile.education : [];
  if (education.length > 0) {
    lines.push("EDUCATION");
    lines.push("=========");
    for (const edu of education) {
      const header = `${edu.degree} in ${edu.field || "General Studies"} | ${edu.school}`;
      const dates = `${edu.startDate || ""} - ${edu.endDate || ""}`;
      lines.push(`${header.padEnd(50)}${dates.padStart(20)}`);
      if (edu.gpa) lines.push(`GPA/CGPA: ${edu.gpa}`);
      lines.push("");
    }
  }

  if (profile.projects && profile.projects.length > 0) {
    lines.push("PROJECTS");
    lines.push("========");
    for (const proj of profile.projects) {
      lines.push(`${proj.name} | ${proj.url || ""}`);
      if (proj.technologies && proj.technologies.length > 0) {
        lines.push(`Technologies: ${proj.technologies.join(", ")}`);
      }
      if (proj.description) lines.push(proj.description);
      for (const bullet of proj.bullets || []) {
        lines.push(`- ${bullet}`);
      }
      lines.push("");
    }
  }

  if (profile.certifications && profile.certifications.length > 0) {
    lines.push("CERTIFICATIONS");
    lines.push("==============");
    for (const cert of profile.certifications) {
      lines.push(`- ${cert.name} (Issued by: ${cert.issuer || "N/A"}) ${cert.url ? "URL: " + cert.url : ""}`);
    }
    lines.push("");
  }

  if (profile.skills && profile.skills.length > 0) {
    lines.push("SKILLS & TECHNOLOGIES");
    lines.push("=====================");
    lines.push(profile.skills.join(", "));
    lines.push("");
  }

  if (missingKeywords && missingKeywords.length > 0) {
    lines.push("CORE COMPETENCIES & TECHNICAL ALIGNMENT");
    lines.push("=======================================");
    lines.push(missingKeywords.join(", "));
    lines.push("");
  }

  return lines.join("\n").trim();
}
