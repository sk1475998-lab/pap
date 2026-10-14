import { extractKeywords, tokenize, stem, type Keyword } from "./matcher.js";

export type AtsSeverity = "info" | "warning" | "critical";
export type AtsCheckStatus = "pass" | "warn" | "fail";

export interface AtsCheck {
  code: string;
  label: string;
  status: AtsCheckStatus;
  impact: number;
  message: string;
  fix?: string;
}

export interface AtsSectionScore {
  section: "contact" | "summary" | "skills" | "experience" | "education" | "projects" | "certifications";
  found: boolean;
  score: number;
  evidence: string[];
  recommendations: string[];
}

export interface AtsKeywordCoverage {
  term: string;
  weight: number;
  required: boolean;
  covered: boolean;
  occurrencesResume: number;
  occurrencesJob: number;
  recommendation: string;
}

export interface AtsWorkdayReadiness {
  score: number;
  status: "excellent" | "good" | "needs_work" | "risky";
  blockers: string[];
  recommendations: string[];
}

export interface AtsAnalysis {
  /** keywords present in the JD that are NOT in the resume (the leaks) */
  gaps: Keyword[];
  /** keywords that ARE well-covered */
  covered: Keyword[];
  /** readability / structure flags */
  warnings: string[];
  /** an ATS-readability score 0..100 */
  score: number;

  /** richer, enterprise ATS-style diagnostics */
  provider: "enterprise-standard" | "workday-like";
  passProbability: number;
  parseScore: number;
  keywordScore: number;
  sectionScore: number;
  titleScore: number;
  seniorityScore: number;
  requiredScore: number;
  preferredScore: number;
  formatScore: number;
  contactScore: number;
  readabilityScore: number;
  densityScore: number;
  checks: AtsCheck[];
  sectionScores: AtsSectionScore[];
  keywordCoverage: AtsKeywordCoverage[];
  requiredKeywords: string[];
  preferredKeywords: string[];
  missingRequired: string[];
  missingPreferred: string[];
  workday: AtsWorkdayReadiness;
}

const SECTION_ALIASES: AtsSectionScore["section"][] = [
  "contact",
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "certifications",
];

const SECTION_RE: Record<AtsSectionScore["section"], RegExp> = {
  contact: /(^|\n)\s*(contact|email|phone|mobile|linkedin|github)\b/i,
  summary: /(^|\n)\s*(summary|profile|objective|professional summary)\b/i,
  skills: /(^|\n)\s*(skills|technical skills|technologies|tools)\b/i,
  experience: /(^|\n)\s*(experience|work experience|professional experience|employment|career history)\b/i,
  education: /(^|\n)\s*(education|academic|qualification|qualifications)\b/i,
  projects: /(^|\n)\s*(projects|project experience|portfolio)\b/i,
  certifications: /(^|\n)\s*(certifications|certificates|licenses|credentials)\b/i,
};

const SENIORITY_WORDS = ["intern", "fresher", "junior", "associate", "mid", "senior", "lead", "staff", "principal", "manager", "architect"];
const REQUIRED_MARKERS = /\b(required|must have|must-have|minimum qualifications|required qualifications|requirements|you have|what you need|basic qualifications)\b/i;
const PREFERRED_MARKERS = /\b(preferred|nice to have|good to have|bonus|desired|plus|preferred qualifications)\b/i;
const BAD_FORMAT_RE = /\b(text box|table of contents|header\/footer|scan copy|image only)\b/i;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizedTerms(text: string): string[] {
  return tokenize(text).map((t) => stem(t.toLowerCase()));
}

function countTerm(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  return (text.match(re) ?? []).length;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function extractSectionText(text: string, section: AtsSectionScore["section"]): string {
  const all = lines(text);
  const start = all.findIndex((l) => SECTION_RE[section].test(l));
  if (start < 0) return "";
  const out: string[] = [];
  for (let i = start + 1; i < all.length; i++) {
    const l = all[i]!;
    if (SECTION_ALIASES.some((s) => s !== section && SECTION_RE[s].test(l))) break;
    out.push(l);
  }
  return out.join("\n");
}

function detectSections(resumeText: string): AtsSectionScore[] {
  const lower = resumeText.toLowerCase();
  return SECTION_ALIASES.map((section) => {
    let found = SECTION_RE[section].test(resumeText);
    const evidence: string[] = [];
    const recommendations: string[] = [];

    if (section === "contact") {
      const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(resumeText);
      const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(resumeText);
      const link = /(?:linkedin\.com|github\.com|https?:\/\/)/i.test(resumeText);
      found = email || phone;
      if (email) evidence.push("email"); else recommendations.push("Add a parseable email address near the top.");
      if (phone) evidence.push("phone"); else recommendations.push("Add a parseable phone number near the top.");
      if (link) evidence.push("links"); else recommendations.push("Add LinkedIn/GitHub/portfolio links.");
      const score = clamp((email ? 45 : 0) + (phone ? 35 : 0) + (link ? 20 : 0));
      return { section, found, score, evidence, recommendations };
    }

    const body = extractSectionText(resumeText, section);
    if (found) evidence.push(`${Math.min(3, lines(body).length)} content line(s)`);
    const minLines = section === "summary" ? 1 : section === "skills" ? 1 : section === "education" ? 1 : 2;
    const hasEnough = lines(body).length >= minLines || (section === "summary" && body.length > 60);
    if (!found) recommendations.push(`Add a clearly labeled ${section.toUpperCase()} section.`);
    else if (!hasEnough) recommendations.push(`Add more ATS-readable detail under ${section.toUpperCase()}.`);
    const score = found ? (hasEnough ? 100 : 70) : (section === "certifications" || section === "projects" ? 55 : 20);
    return { section, found, score, evidence, recommendations };
  });
}

function splitRequiredPreferred(jobDescription: string): { requiredText: string; preferredText: string } {
  const chunks = jobDescription.split(/\n{1,}|\r/g).map((x) => x.trim()).filter(Boolean);
  let mode: "required" | "preferred" = "required";
  const required: string[] = [];
  const preferred: string[] = [];
  for (const chunk of chunks) {
    if (PREFERRED_MARKERS.test(chunk)) mode = "preferred";
    else if (REQUIRED_MARKERS.test(chunk)) mode = "required";
    (mode === "preferred" ? preferred : required).push(chunk);
  }
  return {
    requiredText: required.join("\n") || jobDescription,
    preferredText: preferred.join("\n"),
  };
}

function titleWords(text: string): string[] {
  const firstLine = lines(text).slice(0, 8).join(" ");
  return unique(normalizedTerms(firstLine).filter((t) => !SENIORITY_WORDS.includes(t))).slice(0, 12);
}

function seniorityTerms(text: string): string[] {
  const t = text.toLowerCase();
  return SENIORITY_WORDS.filter((w) => t.includes(w));
}

function scoreOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 70;
  const bs = new Set(b);
  return clamp((a.filter((x) => bs.has(x)).length / Math.max(1, a.length)) * 100);
}

function readability(resumeText: string): { score: number; warnings: string[] } {
  const words = tokenize(resumeText).length;
  const lineCount = (resumeText.match(/\n/g) ?? []).length + 1;
  const bulletCount = (resumeText.match(/(^|\n)\s*[-•*]/g) ?? []).length;
  const longLines = lines(resumeText).filter((l) => l.length > 180).length;
  const warnings: string[] = [];
  let score = 100;
  if (words < 120) { score -= 30; warnings.push("Resume text is very short — ATS may read it as incomplete."); }
  if (lineCount < 8) { score -= 15; warnings.push("Few line breaks — structure may be hard to parse."); }
  if (bulletCount < 3) { score -= 10; warnings.push("Few bullets detected; ATS and recruiters prefer concise achievement bullets."); }
  if (longLines > 3) { score -= 10; warnings.push("Several lines are very long; split them into parseable bullets."); }
  if (BAD_FORMAT_RE.test(resumeText)) { score -= 15; warnings.push("Resume may contain formatting artifacts that ATS can misread."); }
  return { score: clamp(score), warnings };
}

function addCheck(checks: AtsCheck[], check: AtsCheck) {
  checks.push(check);
}

/**
 * Enterprise-standard ATS analysis.
 *
 * The scoring is intentionally deterministic and local-first. It models what
 * Workday-like systems reward: parseable structure, contact data, relevant
 * required keywords, title/seniority alignment, section completeness, and
 * clean formatting. It does not promise actual vendor internals.
 */
export function analyzeATS(
  resumeText: string,
  jobDescription: string
): AtsAnalysis {
  const jdKeywords = extractKeywords(jobDescription, 45);
  const { requiredText, preferredText } = splitRequiredPreferred(jobDescription);
  const requiredKeywords = extractKeywords(requiredText, 28).map((k) => k.term);
  const preferredKeywords = extractKeywords(preferredText, 18).map((k) => k.term);
  const resumeStemCounts = new Map<string, number>();
  for (const t of normalizedTerms(resumeText)) resumeStemCounts.set(t, (resumeStemCounts.get(t) ?? 0) + 1);

  const gaps: Keyword[] = [];
  const covered: Keyword[] = [];
  const keywordCoverage: AtsKeywordCoverage[] = [];

  for (const kw of jdKeywords) {
    const key = stem(kw.term.toLowerCase());
    const occurrencesResume = resumeStemCounts.get(key) ?? countTerm(resumeText, kw.term);
    const occurrencesJob = countTerm(jobDescription, kw.term) || kw.weight;
    const isRequired = requiredKeywords.some((r) => stem(r.toLowerCase()) === key) || !preferredKeywords.some((p) => stem(p.toLowerCase()) === key);
    const item: AtsKeywordCoverage = {
      term: kw.term,
      weight: kw.weight,
      required: isRequired,
      covered: occurrencesResume > 0,
      occurrencesResume,
      occurrencesJob,
      recommendation: occurrencesResume > 0
        ? `Covered ${kw.term}. Keep it truthful and close to relevant experience.`
        : `Add truthful evidence for ${kw.term} in Skills or Experience if you have it.`,
    };
    keywordCoverage.push(item);
    if (item.covered) covered.push(kw);
    else gaps.push(kw);
  }

  const missingRequired = unique(keywordCoverage.filter((k) => k.required && !k.covered).map((k) => k.term)).slice(0, 14);
  const missingPreferred = unique(keywordCoverage.filter((k) => !k.required && !k.covered).map((k) => k.term)).slice(0, 10);

  const requiredTotal = keywordCoverage.filter((k) => k.required).reduce((s, k) => s + k.weight, 0);
  const requiredCovered = keywordCoverage.filter((k) => k.required && k.covered).reduce((s, k) => s + k.weight, 0);
  const preferredTotal = keywordCoverage.filter((k) => !k.required).reduce((s, k) => s + k.weight, 0);
  const preferredCovered = keywordCoverage.filter((k) => !k.required && k.covered).reduce((s, k) => s + k.weight, 0);
  const allTotal = keywordCoverage.reduce((s, k) => s + k.weight, 0);
  const allCovered = keywordCoverage.filter((k) => k.covered).reduce((s, k) => s + k.weight, 0);

  const keywordScore = allTotal ? clamp((allCovered / allTotal) * 100) : 0;
  const requiredScore = requiredTotal ? clamp((requiredCovered / requiredTotal) * 100) : keywordScore;
  const preferredScore = preferredTotal ? clamp((preferredCovered / preferredTotal) * 100) : 70;

  const sectionScores = detectSections(resumeText);
  const sectionScore = clamp(sectionScores.reduce((s, x) => s + x.score, 0) / sectionScores.length);
  const contactScore = sectionScores.find((s) => s.section === "contact")?.score ?? 0;
  const read = readability(resumeText);
  const resumeTitleTerms = titleWords(resumeText);
  const jdTitleTerms = titleWords(jobDescription);
  const titleScore = scoreOverlap(jdTitleTerms, resumeTitleTerms.concat(normalizedTerms(resumeText).slice(0, 80)));
  const seniorityScore = scoreOverlap(seniorityTerms(jobDescription), seniorityTerms(resumeText).concat(seniorityTerms(jobDescription).length ? [] : ["mid"]));

  const resumeWords = Math.max(1, tokenize(resumeText).length);
  const coveredRequiredCount = keywordCoverage.filter((k) => k.required && k.covered).length;
  const density = coveredRequiredCount / resumeWords;
  const densityScore = density < 0.005 ? 45 : density > 0.12 ? 70 : 100;
  const formatScore = clamp(read.score - (/\t|\|\s*\|/.test(resumeText) ? 8 : 0) - (/[□■◆◇]/.test(resumeText) ? 5 : 0));
  const parseScore = clamp(contactScore * 0.35 + sectionScore * 0.35 + formatScore * 0.3);

  const score = clamp(
    keywordScore * 0.28 +
      requiredScore * 0.24 +
      parseScore * 0.16 +
      sectionScore * 0.1 +
      titleScore * 0.08 +
      seniorityScore * 0.05 +
      read.score * 0.05 +
      densityScore * 0.04
  );
  const passProbability = clamp(score * 0.82 + requiredScore * 0.12 + parseScore * 0.06);

  const warnings: string[] = [...read.warnings];
  if (!/@/i.test(resumeText)) warnings.push("No email detected.");
  if (/https?:\/\//i.test(resumeText) === false && !/linkedin\.com|github\.com/i.test(resumeText)) warnings.push("No URLs — consider adding LinkedIn/portfolio links.");
  if (missingRequired.length > 8) warnings.push(`Many required keywords appear missing (${missingRequired.length}).`);
  if (requiredScore < 55) warnings.push("Required qualification coverage is low for enterprise ATS ranking.");

  const checks: AtsCheck[] = [];
  addCheck(checks, {
    code: "contact-parse",
    label: "Contact parsing",
    status: contactScore >= 80 ? "pass" : contactScore >= 45 ? "warn" : "fail",
    impact: 12,
    message: `Contact parse score ${contactScore}/100.`,
    fix: "Put name, email, phone, city, LinkedIn/GitHub in the top 5 lines.",
  });
  addCheck(checks, {
    code: "required-keywords",
    label: "Required keyword coverage",
    status: requiredScore >= 75 ? "pass" : requiredScore >= 50 ? "warn" : "fail",
    impact: 25,
    message: `Required coverage ${requiredScore}/100. Missing: ${missingRequired.slice(0, 6).join(", ") || "none"}.`,
    fix: "Truthfully add missing required skills to Skills and matching project/experience bullets.",
  });
  addCheck(checks, {
    code: "section-structure",
    label: "ATS section structure",
    status: sectionScore >= 80 ? "pass" : sectionScore >= 60 ? "warn" : "fail",
    impact: 15,
    message: `Section structure ${sectionScore}/100.`,
    fix: "Use clear headings: Summary, Skills, Experience, Projects, Education, Certifications.",
  });
  addCheck(checks, {
    code: "title-alignment",
    label: "Role/title alignment",
    status: titleScore >= 70 ? "pass" : titleScore >= 45 ? "warn" : "fail",
    impact: 10,
    message: `Title alignment ${titleScore}/100.`,
    fix: "Mirror the target role title in the headline/summary when truthful.",
  });
  addCheck(checks, {
    code: "workday-format",
    label: "Workday-style parseability",
    status: parseScore >= 82 ? "pass" : parseScore >= 62 ? "warn" : "fail",
    impact: 18,
    message: `Parseability ${parseScore}/100.`,
    fix: "Avoid tables, text boxes, images, complex columns, icons, and headers/footers for ATS upload.",
  });

  const blockers = checks.filter((c) => c.status === "fail" && c.impact >= 15).map((c) => c.message);
  const workdayStatus: AtsWorkdayReadiness["status"] = passProbability >= 85 ? "excellent" : passProbability >= 72 ? "good" : passProbability >= 55 ? "needs_work" : "risky";
  const workdayRecommendations = [
    ...checks.filter((c) => c.status !== "pass").map((c) => c.fix).filter((x): x is string => Boolean(x)),
    ...missingRequired.slice(0, 5).map((k) => `Add a truthful Workday-searchable keyword/bullet for: ${k}.`),
  ].slice(0, 10);

  return {
    gaps,
    covered,
    warnings: unique(warnings),
    score,
    provider: "workday-like",
    passProbability,
    parseScore,
    keywordScore,
    sectionScore,
    titleScore,
    seniorityScore,
    requiredScore,
    preferredScore,
    formatScore,
    contactScore,
    readabilityScore: read.score,
    densityScore,
    checks,
    sectionScores,
    keywordCoverage,
    requiredKeywords: unique(requiredKeywords).slice(0, 18),
    preferredKeywords: unique(preferredKeywords).slice(0, 18),
    missingRequired,
    missingPreferred,
    workday: {
      score: passProbability,
      status: workdayStatus,
      blockers,
      recommendations: unique(workdayRecommendations),
    },
  };
}

/**
 * Produce a list of suggested bullet insertions to close ATS gaps.
 * Pure string suggestions — no LLM. The LLM rewriter in cover-letter/llm
 * layers on top of this when available.
 */
export function suggestInsertions(analysis: AtsAnalysis): string[] {
  const priority = [...analysis.missingRequired, ...analysis.missingPreferred, ...analysis.gaps.map((g) => g.term)];
  return unique(priority)
    .slice(0, 10)
    .map((term) => `Add a truthful achievement bullet demonstrating "${term}" with impact, tool, and outcome.`);
}
