/**
 * Resume parser — extracts contact, skills, experience, education, and India fields.
 */
import type { Profile, WorkExperience, Education, Project, Certification } from "./types.js";
import { createProfile } from "./profile.js";
import { nanoid } from "nanoid";
import { tokenize } from "./matcher.js";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE =
  /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\+\d{1,3}[\s-]?\d{7,14}|\b\d{10}\b/g;
const PINCODE_RE = /\b[1-9]\d{5}\b/;
const URL_RE = /(https?:\/\/[^\s)]+)|(?:linkedin\.com\/in\/[^\s)]+)|(?:github\.com\/[^\s)]+)/gi;
const DATE_RANGE_RE =
  /((?:(?:\d{1,2}[/-])?(?:\d{1,2}[/-]|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*))?\d{4})\s*[-–—to]+\s*((?:(?:\d{1,2}[/-])?(?:\d{1,2}[/-]|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*))?\d{4}|present|current|now)/gi;
const YEARS_EXP_RE = /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp)/i;
const CTC_RE = /(?:ctc|package|compensation)[:\s]*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?)?/i;

const SECTION_HEADERS = [
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "employment",
  "education",
  "academic",
  "qualification",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "summary",
  "objective",
  "about",
];

const ALLOWED_HEADER_WORDS = new Set([
  "and", "or", "&", "history", "details", "summary", "list", "lists", "technical", "key", "core",
  "professional", "academic", "personal", "relevant", "other", "work", "employment", "education",
  "experience", "experiences", "skill", "skills", "project", "projects", "certification", "certifications",
  "license", "licenses", "licence", "licences", "publication", "publications", "interest", "interests",
  "language", "languages", "award", "awards", "coursework", "course", "courses", "competency", "competencies",
  "qualification", "qualifications", "training", "credential", "credentials", "about", "objective",
  "contact", "info", "information", "leadership", "volunteer", "profile", "career", "development", "activities",
  "me", "my", "self", "achievement", "achievements", "honors", "honor"
]);

export function isSectionHeader(line: string): boolean {
  const clean = line.toLowerCase().replace(/[:\-_*#•]/g, "").trim();
  if (clean.length < 2 || clean.length > 50) return false;

  const words = clean.split(/\s+/);
  if (words.length > 4) return false;

  const hasPrimaryKeyword = words.some((w) =>
    [
      "experience", "experiences", "education", "academics", "academic", "qualification", "qualifications",
      "skills", "skill", "projects", "project", "certifications", "certification", "licenses", "license",
      "summary", "objective", "about", "publications", "publication", "employment", "career", "profile",
      "awards", "award", "achievements", "achievement", "honors", "honor", "languages", "language"
    ].includes(w)
  );

  if (!hasPrimaryKeyword) return false;

  return words.every((w) => ALLOWED_HEADER_WORDS.has(w));
}

export interface ParseResult {
  profile: Profile;
  text: string;
  warnings: string[];
  extracted: string[];
}

const TITLE_WORDS =
  /engineer|developer|manager|analyst|consultant|intern|student|software|data|machine|learning|full.?stack|backend|frontend/i;

function safeTest(re: RegExp, s: string): boolean {
  const flags = re.flags.includes("g") ? re.flags.replace("g", "") : re.flags;
  return new RegExp(re.source, flags).test(s);
}

export function parseResumeText(text: string): ParseResult {
  const warnings: string[] = [];
  const extracted: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const p = createProfile({ locale: "IN", phoneCountryCode: "+91" });

  parseContact(normalized, p, extracted, warnings);
  parseSkills(normalized, p, extracted, warnings);
  parseSummary(normalized, p, extracted);
  p.experience = parseAllExperience(normalized, p);
  if (p.experience.length) extracted.push(`${p.experience.length} job(s)`);
  p.education = parseAllEducation(normalized);
  if (p.education.length) extracted.push(`${p.education.length} education entry(ies)`);
  p.projects = parseAllProjects(normalized);
  if (p.projects.length) extracted.push(`${p.projects.length} project(s)`);
  p.certifications = parseAllCertifications(normalized);
  if (p.certifications.length) extracted.push(`${p.certifications.length} certification(s)`);
  p.languages = parseLanguages(normalized);
  if (p.languages.length) extracted.push(`${p.languages.length} language(s)`);
  p.awards = parseAwards(normalized);
  if (p.awards.length) extracted.push(`${p.awards.length} award(s)/achievement(s)`);
  inferYearsOfExperience(normalized, p);
  inferCTC(normalized, p);

  p.masterResumeText = text;
  p.updatedAt = Date.now();

  if (!p.email) warnings.push("Email not found — add manually.");
  if (!p.firstName) warnings.push("Name not detected — add manually.");
  if (!p.experience.length) warnings.push("No work experience section found — add manually.");
  if (!p.education.length) warnings.push("No education section found — add manually.");
  if (!p.projects.length && /projects/i.test(normalized)) warnings.push("Projects section detected but no project entries were parsed.");
  if (!p.certifications.length && /certifications?|licenses?/i.test(normalized)) warnings.push("Certification section detected but no certification entries were parsed.");
  if (!p.skills.length) warnings.push("No skills section found.");

  return { profile: p, text, warnings, extracted };
}

function parseContact(text: string, p: Profile, extracted: string[], warnings: string[]) {
  const emails = text.match(EMAIL_RE);
  if (emails?.[0]) {
    p.email = emails[0].toLowerCase();
    extracted.push("email");
  }

  const phones = text.match(PHONE_RE);
  if (phones?.[0]) {
    const digits = phones[0].replace(/\D/g, "");
    p.phone = digits.length > 10 ? digits.slice(-10) : digits;
    if (phones[0].includes("91") || digits.length === 12) p.phoneCountryCode = "+91";
    extracted.push("phone");
  }

  const pin = text.match(PINCODE_RE);
  if (pin) {
    p.pincode = pin[0];
    extracted.push("pincode");
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => isSectionHeader(l));
  const searchLines = headerIdx > 0 ? lines.slice(0, headerIdx) : lines.slice(0, 8);
  let nameCandidate = "";
  for (const l of searchLines) {
    if (isSectionHeader(l)) continue;
    if (TITLE_WORDS.test(l)) continue;
    // Strip URLs, emails, mailto, tel prefixes from the line
    const stripped = l
      .replace(URL_RE, "")
      .replace(EMAIL_RE, "")
      .replace(/mailto:[^\s]+/gi, "")
      .replace(/tel:[^\s]+/gi, "")
      .replace(/[|•,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (stripped.length >= 3 && stripped.length <= 60 && !/\d{5,}/.test(stripped)) {
      if (/^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(stripped)) {
        nameCandidate = stripped;
        break;
      }
    }
  }

  if (nameCandidate) {
    const parts = nameCandidate.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      if (parts.length === 2) {
        p.firstName = titleCase(parts[0]);
        p.lastName = titleCase(parts[1]);
      } else if (parts.length === 3) {
        p.firstName = titleCase(parts[0]);
        p.middleName = titleCase(parts[1]);
        p.lastName = titleCase(parts[2]);
      } else {
        p.firstName = titleCase(parts.slice(0, -1).join(" "));
        p.lastName = titleCase(parts[parts.length - 1]);
      }
      extracted.push("name");
    }
  }

  const links = text.match(URL_RE) ?? [];
  for (const link of links) {
    const l = link.toLowerCase();
    if (l.includes("linkedin")) {
      p.linkedin = normalizeUrl(link);
      extracted.push("linkedin");
    } else if (l.includes("github")) {
      const normalized = normalizeUrl(link);
      const match = normalized.match(/^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9\-]+)/i);
      if (match && match[1]) {
        const profileUrl = `https://github.com/${match[1]}`;
        if (!p.github || profileUrl.length < p.github.length) {
          p.github = profileUrl;
          extracted.push("github");
        }
      }
    } else if (!p.website) {
      p.website = normalizeUrl(link);
    }
  }

  const locLine = lines.find((l) =>
    !/(?:university|institute|college|school|iiit|iit|nit|b\.?\s*tech|m\.?\s*tech|engineer|developer|founder|student|intern)/i.test(l) &&
    /(?:bangalore|bengaluru|hyderabad|mumbai|pune|chennai|delhi|ncr|gurgaon|gurugram|noida|kolkata|india|karnataka|telangana|maharashtra|andhra|kurnool)/i.test(l)
  );
  if (locLine) {
    const parts = locLine.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
    if (parts[0]) p.city = titleCase(parts[0].replace(/\d{6}/, "").trim());
    if (parts[1]) p.state = titleCase(parts[1]);
    p.location = parts.join(", ");
    extracted.push("location");
  }
}

function parseSkills(text: string, p: Profile, extracted: string[], warnings: string[]) {
  const block = extractSkillsSection(text, [
    "skills",
    "technical skills",
    "core competencies",
    "technologies",
    "tools",
    "technical expertise",
    "programming languages",
    "skills & tools",
    "key skills",
    "skills & expertise",
    "areas of expertise",
    "skills and tools",
    "skills and technologies",
    "skills & technologies",
    "technology stack",
    "technical stack",
    "skills portfolio",
    "competencies",
    "technologies & tools",
    "tools & technologies",
    "it skills",
    "skills & frameworks"
  ]);
  if (!block) return;

  const skills: string[] = [];
  const CATEGORY_PREFIX = /^[A-Za-z][\w\s/&+-]{0,40}:\s*/;

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const segments = trimmed.includes(",") || trimmed.includes(";") || trimmed.includes("|")
      ? trimmed.split(/[,;|•●■|]/)
      : [trimmed];

    for (let seg of segments) {
      seg = seg.trim().replace(CATEGORY_PREFIX, "").replace(/^[-•*+●■]\s*/, "");
      const skill = cleanSkillToken(seg);
      if (skill) skills.push(skill);
    }
  }

  const uniqueSkills = [...new Set(skills)];
  p.skills = uniqueSkills.slice(0, 500);
  if (uniqueSkills.length > p.skills.length) {
    warnings.push("Skills section exceeds the parser's 500-item safety limit; review the source resume for additional entries.");
  }
  if (p.skills.length) extracted.push(`${p.skills.length} skills`);
}

function extractSkillsSection(text: string, headers: string[]): string | undefined {
  const lines = text.split("\n");
  const orderedHeaders = [...headers].sort((a, b) => b.length - a.length);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const normalized = line
      .toLowerCase()
      .replace(/^[\s#*•●■-]+/, "")
      .replace(/[\s:|#*]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    const exactHeader = orderedHeaders.some((header) => normalized === header);
    const inlineContent = exactHeader ? "" : inlineSkillContent(line, orderedHeaders);
    if (!exactHeader && !inlineContent) continue;

    const out = inlineContent ? [inlineContent] : [];
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j] ?? "";
      if (isSectionHeader(nextLine)) break;
      out.push(inlineSkillContent(nextLine, orderedHeaders) ?? nextLine);
    }
    const joined = out.join("\n").trim();
    if (joined) return joined;
  }
  return undefined;
}

function inlineSkillContent(line: string, headers: string[]): string | undefined {
  for (const header of headers) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = line.match(new RegExp(`^\\s*[#*•●■-]*\\s*${escaped}(?:\\s*[:|–—-]\\s*|\\s{2,})(.+)$`, "i"));
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function cleanSkillToken(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length < 2 || t.length > 45) return "";
  if (/^(and|or|etc|with|using)\.?$/i.test(t)) return "";
  if (/^[A-Za-z][\w\s/&+-]{0,30}:$/.test(t)) return "";
  return t.toLowerCase();
}

function parseSummary(text: string, p: Profile, extracted: string[]) {
  const block = extractSection(text, ["summary", "professional summary", "about", "objective", "profile"]);
  if (block) {
    p.summary = block.slice(0, 800).trim();
    extracted.push("summary");
  }
}

function parseAllExperience(text: string, p: Profile): WorkExperience[] {
  const block = extractSection(text, [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "employment",
    "internship",
    "internships",
  ]);
  if (!block) return [];

  const entries: WorkExperience[] = [];
  const chunks = block.split(/\n\s*\n/).filter((c) => c.trim().length > 5);
  const parts = chunks.length > 1 ? chunks : splitByJobHeaders(block);

  for (const chunk of parts) {
    const job = parseExperienceChunk(chunk, p.city);
    if (job) entries.push(job);
  }
  return entries.slice(0, 8);
}

function splitByJobHeaders(block: string): string[] {
  const lines = block.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // A valid job header cannot be a sentence continuation or lowercase fragment
    const isSentenceContinuation = /[.,;]$/.test(trimmed) || /^[a-z]/.test(trimmed) || /^(and|or|with|using|in|for|to|at|by|from|into|on|the|a|an)\b/i.test(trimmed);
    const isHeader =
      !isSentenceContinuation &&
      (DATE_RANGE_RE.test(trimmed) ||
       (trimmed.length < 80 && !trimmed.startsWith("-") && !trimmed.startsWith("•") && !trimmed.startsWith("*") &&
        /(?:developer|engineer|founder|lead|intern|manager|architect|consultant|specialist|analyst|co-founder|director|designer|vp|head)\b/i.test(trimmed)));
    if (isHeader && current.length > 2) {
      chunks.push(current.join("\n"));
      current = [trimmed];
    } else {
      current.push(trimmed);
    }
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks.length ? chunks : [block];
}

function parseExperienceChunk(chunk: string, defaultCity: string): WorkExperience | null {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let title = "";
  let company = "";
  let startDate = "";
  let endDate = "";
  let current = false;
  const bullets: string[] = [];

  const dateMatch = chunk.match(DATE_RANGE_RE);
  if (dateMatch) {
    const m = [...chunk.matchAll(DATE_RANGE_RE)][0];
    if (m) {
      startDate = m[1] ?? "";
      endDate = m[2] ?? "";
      current = /present|current|now/i.test(endDate);
    }
  }

  const headerLine = lines.find((l) => !l.startsWith("-") && !l.startsWith("•") && !l.startsWith("*") && !/[.,;]$/.test(l)) ?? lines[0];
  const atParts = headerLine.split(/\s+@\s+|\s+at\s+|\s*[|•]\s+/i);
  if (atParts.length >= 2) {
    title = atParts[0].replace(DATE_RANGE_RE, "").trim();
    company = atParts[1].replace(DATE_RANGE_RE, "").trim();
  } else {
    title = headerLine.replace(DATE_RANGE_RE, "").trim();
    const next = lines.find((l) => l !== headerLine && !l.startsWith("-") && !l.startsWith("•") && !l.startsWith("*") && l.length < 60 && !/[.,;]$/.test(l));
    if (next) {
      company = next.replace(DATE_RANGE_RE, "").trim();
    } else {
      // Look in the chunk for project or product name like "Shipped Super Job Agent"
      const projMatch = chunk.match(/(?:shipped|built|developed|created|founded)\s+([A-Z][A-Za-z0-9\s]{2,30})/i);
      if (projMatch) {
        company = projMatch[1].trim();
      }
    }
  }

  for (const l of lines) {
    if (/^[-•*]/.test(l)) {
      bullets.push(l.replace(/^[-•*]\s*/, ""));
    } else if (bullets.length > 0 && l !== headerLine && l !== company) {
      // Append wrapped line to previous bullet
      bullets[bullets.length - 1] += " " + l;
    }
  }

  if (!title && !company) return null;

  return {
    id: nanoid(8),
    title: cleanTitle(title),
    company: cleanTitle(company),
    location: defaultCity,
    startDate,
    endDate: current ? "Present" : endDate,
    current,
    bullets: bullets.slice(0, 12),
    skills: [],
  };
}

function parseAllEducation(text: string): Education[] {
  const block = extractSection(text, ["education", "academic", "qualification", "academics"]);
  if (!block) return [];

  const entries: Education[] = [];
  const chunks = block.split(/\n\s*\n/).filter((c) => c.trim().length > 5);
  const parts = chunks.length > 1 ? chunks : [block];

  for (const chunk of parts) {
    const edu = parseEducationChunk(chunk);
    if (edu) entries.push(edu);
  }
  return entries.slice(0, 5);
}

function parseEducationChunk(chunk: string): Education | null {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // Gather all lines describing the institution
  const schoolLines = lines.filter((l) => /university|institute|college|school|iiit|iit|nit|bits|vit|srm|design and manufacturing/i.test(l));
  let school = schoolLines.length > 0 ? schoolLines.join(", ").replace(/\s*,\s*,/g, ",").trim() : lines[0];

  const degree =
    lines.find((l) =>
      /b\.?\s*tech|bachelor|m\.?\s*tech|master|b\.?\s*e|m\.?\s*e|ph\.?\s*d|bca|mca|b\.?\s*sc|diploma/i.test(l)
    ) ?? "";
  let field =
    lines.find((l) =>
      !/university|institute|college|school|iiit/i.test(l) &&
      /artificial|computer|data science|engineering|information technology|electronics|mechanical|cse|ece/i.test(l)
    ) ?? "";
  const dates = [...chunk.matchAll(DATE_RANGE_RE)][0];
  const gpa = chunk.match(/gpa[:\s]*(\d\.\d+)|cgpa[:\s]*(\d\.\d+)/i);

  if (!school && !degree) return null;

  return {
    id: nanoid(8),
    school: school.replace(DATE_RANGE_RE, "").trim(),
    degree: degree || field,
    field: field && field !== degree ? field : "",
    startDate: dates?.[1] ?? "",
    endDate: dates?.[2] ?? "",
    gpa: gpa?.[1] ?? gpa?.[2] ?? "",
  };
}

function parseAllProjects(text: string): Project[] {
  const block = extractSection(text, [
    "projects",
    "project experience",
    "academic projects",
    "personal projects",
    "key projects",
    "selected projects",
    "technical projects",
    "major projects",
    "projects portfolio",
    "notable projects",
    "freelance projects",
    "academic & personal projects"
  ]);
  if (!block) return [];
  const chunks = block.split(/\n\s*\n/).filter((c) => c.trim().length > 5);
  const parts = chunks.length > 1 ? chunks : splitByProjectHeaders(block);
  return parts.map(parseProjectChunk).filter((p): p is Project => Boolean(p)).slice(0, 12);
}

function isLikelyProjectHeader(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  if (/^[-•*+]/.test(trimmed)) return false; // starts with bullet
  if (URL_RE.test(trimmed)) return false; // is a URL
  
  // Check if the line is just a date range (or very close to it)
  const withoutDate = trimmed.replace(DATE_RANGE_RE, "").replace(/[:\-_*#|]/g, "").trim();
  if (withoutDate.length < 3) return false;
  
  // If it starts with common action verbs (past tense/gerund), it's probably description/bullets
  const lower = trimmed.toLowerCase();
  if (/^(built|developed|implemented|created|designed|used|trained|integrated|managed|assisted|worked|collaborated|responsible|optimized|enhanced|achieved|configured|deployed|mentored|wrote|coded|tested|debugged|facilitated|spearheaded|led|formulated|analyzed|utilised|utilizing|developing|building|implementing|using)\b/.test(lower)) {
    return false;
  }

  // If it contains a period and looks like a full sentence ending, it is not a title
  if (trimmed.endsWith(".") && trimmed.split(/\s+/).length > 4) {
    return false;
  }

  // Capitalization check: If index 1 or 2 word is lowercase (excluding prepositions/conjunctions), it's a sentence
  const words = trimmed.split(/\s+/);
  if (words.length > 5) {
    const stopWords = new Set(["a", "an", "the", "in", "on", "at", "to", "for", "with", "and", "or", "of", "by", "from", "using", "built", "is", "was", "were", "as", "about"]);
    let lowercaseCount = 0;
    for (let i = 1; i < Math.min(4, words.length); i++) {
      const w = words[i].replace(/[^a-zA-Z]/g, "");
      if (w && w === w.toLowerCase() && !stopWords.has(w)) {
        lowercaseCount++;
      }
    }
    if (lowercaseCount >= 2) {
      return false;
    }
  }
  
  // Project header is usually capitalized or title case or contains numbers/abbreviations
  const firstChar = trimmed.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && !/^[0-9]/.test(firstChar)) return false;
  
  return true;
}

function splitByProjectHeaders(block: string): string[] {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const isHeader = isLikelyProjectHeader(line);
    if (isHeader && current.length > 1) {
      chunks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks.length ? chunks : [block];
}

function parseProjectChunk(chunk: string): Project | null {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const name = lines[0]
    .replace(/^[-•*+]\s*/, "")
    .replace(DATE_RANGE_RE, "")
    .replace(/[:|].*$/, "")
    .trim();
  if (!name || /^(projects?|description)$/i.test(name)) return null;
  const url = (chunk.match(URL_RE) ?? [""])[0] ?? "";
  const dates = [...chunk.matchAll(DATE_RANGE_RE)][0];
  const startDate = dates?.[1] ?? "";
  const endDate = dates?.[2] ?? "";
  const bullets = lines.slice(1).filter((l) => /^[-•*+]/.test(l)).map((l) => l.replace(/^[-•*+]\s*/, ""));
  const descriptionLines = lines.slice(1).filter((l) => {
    const clean = l.replace(URL_RE, "").replace(DATE_RANGE_RE, "").replace(/[:\-_*#|]/g, "").trim();
    if (!clean) return false;
    return true;
  });
  const formattedLines = descriptionLines.map((l) => {
    if (/^[-•*+]\s*/.test(l)) {
      return "• " + l.replace(/^[-•*+]\s*/, "");
    }
    return l;
  });
  const description = formattedLines.join("\n").slice(0, 2000);
  const techLine = lines.find((l) => /technolog|stack|tools|built with/i.test(l)) ?? "";
  const technologies = techLine ? techLine.replace(/^[^:]{0,40}:/, "").split(/[,;|]/).map(cleanSkillToken).filter(Boolean) : [];
  return { id: nanoid(8), name: cleanTitle(name), url: normalizeUrl(url || ""), description, startDate, endDate, technologies, bullets: bullets.slice(0, 12) };
}

function parseAllCertifications(text: string): Certification[] {
  const block = extractSection(text, [
    "certifications",
    "certification",
    "licenses",
    "licences",
    "credentials",
    "certificates",
    "courses & certifications",
    "certifications & licenses",
  ]);
  if (!block) return [];
  return block.split("\n")
    .map((l) => l.trim().replace(/^[-•*+●■]\s*/, ""))
    .filter((l) => l.length > 2 && l.length < 180)
    .map((line) => {
      let namePart = line;
      let issuerPart = "";
      const delimiterMatch = line.split(/\s+[-–—|]\s+/);
      if (delimiterMatch.length >= 2) {
        namePart = delimiterMatch[0];
        issuerPart = delimiterMatch[1];
      } else {
        const byMatch = line.match(/(.*?)\s+(?:by|from)\s+(.*)/i);
        if (byMatch) {
          namePart = byMatch[1];
          issuerPart = byMatch[2];
        } else {
          const parenMatch = line.match(/(.*?)\s*\((.*?)\)/);
          if (parenMatch) {
            namePart = parenMatch[1];
            issuerPart = parenMatch[2];
          }
        }
      }
      return {
        id: nanoid(8),
        name: cleanTitle(namePart),
        issuer: cleanTitle(issuerPart),
        credentialId: "",
        url: normalizeUrl((line.match(URL_RE) ?? [""])[0] ?? ""),
      };
    })
    .slice(0, 12);
}

function inferYearsOfExperience(text: string, p: Profile) {
  const explicit = text.match(YEARS_EXP_RE);
  if (explicit) {
    p.yearsOfExperience = explicit[1];
    return;
  }
  if (p.experience.length) {
    const years = p.experience
      .map((e) => {
        const start = parseInt(e.startDate?.slice(0, 4) ?? "0", 10);
        const end = e.current ? new Date().getFullYear() : parseInt(e.endDate?.slice(0, 4) ?? "0", 10);
        return start && end ? end - start : 0;
      })
      .reduce((a, b) => a + b, 0);
    if (years > 0) p.yearsOfExperience = String(Math.max(1, years));
  }
}

function inferCTC(text: string, p: Profile) {
  const m = text.match(CTC_RE);
  if (m) p.currentCTC = m[1];
}

function parseLanguages(text: string): string[] {
  const block = extractSection(text, ["languages", "languages known", "spoken languages", "linguistic skills"]);
  if (!block) return [];
  const langs: string[] = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim().replace(/^[-•*+●■]\s*/, "");
    if (!trimmed || trimmed.length > 100) continue;
    const parts = trimmed.split(/[,;|•●■/|]/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const lang = part.replace(/\s*\(.*?\)/g, "").replace(/\s+-\s+.*$/g, "").trim();
      if (lang && lang.length >= 2 && lang.length <= 25 && /^[A-Za-z\s]+$/.test(lang)) {
        langs.push(titleCase(lang));
      }
    }
  }
  return [...new Set(langs)].slice(0, 10);
}

function parseAwards(text: string): string[] {
  const block = extractSection(text, [
    "awards",
    "honors",
    "achievements",
    "awards & achievements",
    "honors & awards",
    "key achievements",
    "scholastic achievements",
    "co-curricular activities",
    "accomplishments",
  ]);
  if (!block) return [];
  const awards: string[] = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim().replace(/^[-•*+●■]\s*/, "");
    if (trimmed.length > 5 && trimmed.length < 200) {
      awards.push(trimmed);
    }
  }
  return awards.slice(0, 10);
}

function extractSection(text: string, headers: string[]): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().replace(/[:\-_*#]/g, "").trim();
    if (headers.some((h) => lower === h || (lower.startsWith(h + " ") && lower.length < h.length + 15))) {
      const out: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (isSectionHeader(nextLine)) {
          break;
        }
        out.push(nextLine);
      }
      const joined = out.join("\n").trim();
      if (joined) return joined;
    }
  }
  return undefined;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function cleanTitle(s: string): string {
  return s
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/[|,].*$/, "")
    .trim();
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  let cleaned = url.trim().replace(/[.,;:)]+$/, ""); // Strip trailing punctuation
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

export async function pdfToText(data: Uint8Array): Promise<string> {
  // PDF.js may transfer this buffer to its worker, so don't let it detach
  // the caller's bytes before a later OCR fallback can inspect the same file.
  const bytes = new Uint8Array(data);
  const pdfjs: any = await import("pdfjs-dist");

  if (typeof window !== "undefined") {
    const chromeRuntime = (globalThis as any).chrome?.runtime;
    const browserRuntime = (globalThis as any).browser?.runtime;
    const getURL = chromeRuntime?.getURL || browserRuntime?.getURL;
    if (getURL) {
      pdfjs.GlobalWorkerOptions.workerSrc = getURL("pdf.worker.min.mjs");
    }
  }

  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    
    // Fetch link annotations to resolve hyperlinks (e.g. GitHub/Certificate links)
    let links: { url: string; rect: number[] }[] = [];
    try {
      const annotations = await page.getAnnotations();
      links = annotations
        .filter((ann: any) => ann.subtype === "Link" && (ann.url || ann.unsafeUrl))
        .map((ann: any) => ({
          url: ann.url || ann.unsafeUrl,
          rect: ann.rect, // [x1, y1, x2, y2]
        }));
    } catch {
      // Fallback if annotations fail to load
    }

    const content = await page.getTextContent();
    
    // Extract and normalize items with coordinate metadata
    const items: Array<{ str: string; tx: number; ty: number; hasEOL?: boolean }> = [];
    for (const rawItem of content.items) {
      if (!("str" in rawItem)) continue;
      const tx = rawItem.transform ? rawItem.transform[4] : 0;
      const ty = rawItem.transform ? rawItem.transform[5] : 0;
      items.push({
        str: rawItem.str,
        tx,
        ty,
        hasEOL: rawItem.hasEOL,
      });
    }

    // Sort items by vertical position descending (top to bottom),
    // and horizontal position ascending (left to right) for same line
    items.sort((a, b) => {
      const yDiff = b.ty - a.ty;
      if (Math.abs(yDiff) > 3) {
        return yDiff; // Higher Y comes first
      }
      return a.tx - b.tx; // Left to right
    });

    let line = "";
    let lastY: number | null = null;
    let lastInsertedUrl = "";

    for (const item of items) {
      let itemStr = item.str;

      // Check matching hyperlink annotation
      const matchingLink = links.find(
        (link) =>
          item.tx >= link.rect[0] - 10 &&
          item.tx <= link.rect[2] + 10 &&
          item.ty >= link.rect[1] - 10 &&
          item.ty <= link.rect[3] + 10
      );

      if (matchingLink) {
        if (lastInsertedUrl !== matchingLink.url) {
          itemStr = ` ${matchingLink.url} `;
          lastInsertedUrl = matchingLink.url;
        } else {
          itemStr = "";
        }
      } else {
        lastInsertedUrl = "";
      }

      // If Y coordinate drops significantly, start a new line
      if (lastY !== null && Math.abs(item.ty - lastY) > 3.5) {
        if (line.trim()) {
          text += line.trim() + "\n";
        }
        line = "";
      }

      lastY = item.ty;
      line += itemStr;

      if (item.hasEOL) {
        if (line.trim()) {
          text += line.trim() + "\n";
        }
        line = "";
        lastY = null;
      } else if (itemStr && !itemStr.endsWith(" ")) {
        line += " ";
      }
    }

    if (line.trim()) {
      text += line.trim() + "\n";
    }
  }
  return text;
}

export async function parseResumeTextWithAI(
  text: string,
  llm: import("./llm/types.js").LLMClient
): Promise<any> {
  if (!llm.isAvailable()) return null;

  const prompt = `You are a precise resume parser and ATS extraction system.
Analyze the following resume text and extract all details into a clean JSON object matching the JSON schema below.
Make sure to extract:
1. Contact information (firstName, middleName, lastName, email, phone, city, state, country, pincode, linkedin, github, website)
2. Professional summary and years of experience
3. Detailed skills list: capture ALL technologies, programming languages, tools, frameworks, and libraries mentioned in the resume as a clean array of strings, e.g. ["python", "c++", "pytorch", "react", "git", "machine learning"]
4. Experience list: capture company, title, location, dates, current status, and detailed bullet points describing achievements and responsibilities.
5. Education list: capture school, degree, field of study, dates, and GPA.
6. Projects list: capture project name, description, technologies used (as string array), dates, and bullet points.
7. Certifications: capture name, issuer, and URL.
8. Languages: capture spoken languages as an array of strings.
9. Awards: capture honors/awards/achievements as an array of strings.

Return ONLY valid JSON that complies with the schema. No explanations, no markdown tags. Do not wrap the JSON in anything except a raw JSON string.

JSON Schema:
{
  "firstName": "string",
  "middleName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "pincode": "string",
  "linkedin": "string",
  "github": "string",
  "website": "string",
  "yearsOfExperience": "string (number, e.g. '5' or '3.5')",
  "summary": "string",
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "string (e.g. 'Jan 2020' or '2020-01')",
      "endDate": "string (use 'Present' if current)",
      "current": boolean,
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string",
      "field": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "url": "string",
      "description": "string",
      "startDate": "string",
      "endDate": "string",
      "technologies": ["string"],
      "bullets": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "credentialId": "string",
      "url": "string"
    }
  ],
  "languages": ["string"],
  "awards": ["string"]
}

RESUME TEXT:
${text}
`;

  try {
    const raw = await llm.complete(
      [
        { role: "system", content: "You extract structured profile information from resume text and respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.1, maxTokens: 4000, responseFormat: { type: "json_object" } }
    );

    let clean = raw.trim();
    if (clean.includes("```json")) {
      clean = clean.split("```json")[1].split("```")[0].trim();
    } else if (clean.includes("```")) {
      clean = clean.split("```")[1].split("```")[0].trim();
    }

    const data = JSON.parse(clean);
    return data;
  } catch (err) {
    console.error("LLM resume parsing failed", err);
    return null;
  }
}
