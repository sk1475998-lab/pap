import type { Application, Job, Profile } from "./types.js";
import { assessJobRisk } from "./job-risk.js";

export type IndiaCityTier = "metro" | "tier1" | "tier2" | "remote" | "unknown";
export type NoticeFit = "excellent" | "good" | "risky" | "blocked" | "unknown";

export interface IndiaCtcInsight {
  currentLpa?: number;
  expectedLpa?: number;
  advertisedMinLpa?: number;
  advertisedMaxLpa?: number;
  recommendedAskLpa?: number;
  hikePercent?: number;
  fit: "above_expectation" | "negotiable" | "below_expectation" | "unknown";
  explanation: string;
}

export interface IndiaNoticeInsight {
  candidateDays?: number;
  employerMaxDays?: number;
  fit: NoticeFit;
  explanation: string;
}

export interface IndiaOpportunityInsight {
  indiaScore: number;
  cityTier: IndiaCityTier;
  ctc: IndiaCtcInsight;
  notice: IndiaNoticeInsight;
  board: {
    detected: "linkedin" | "naukri" | "foundit" | "instahyre" | "wellfound" | "hirist" | "iimjobs" | "company" | "unknown";
    recommendedStrategy: string;
  };
  trust: {
    score: number;
    warnings: string[];
    privacyChecklist: string[];
  };
  followUp: {
    bestTimeLocal: string;
    message: string;
  };
  customerDelighters: string[];
}

const METRO = ["bengaluru", "bangalore", "mumbai", "delhi", "new delhi", "gurugram", "gurgaon", "noida", "hyderabad", "pune", "chennai", "kolkata", "ahmedabad"];
const TIER2 = ["jaipur", "indore", "kochi", "cochin", "coimbatore", "vadodara", "nagpur", "lucknow", "bhubaneswar", "chandigarh", "mohali", "surat", "mysuru", "mysore", "visakhapatnam", "vizag", "thiruvananthapuram"];
const INDIA_JOB_BOARDS: Array<[IndiaOpportunityInsight["board"]["detected"], RegExp]> = [
  ["linkedin", /linkedin\.com/i],
  ["naukri", /naukri\.com/i],
  ["foundit", /foundit\.(in|com)|monsterindia/i],
  ["instahyre", /instahyre\.com/i],
  ["wellfound", /wellfound\.com|angel\.co/i],
  ["hirist", /hirist\.com/i],
  ["iimjobs", /iimjobs\.com/i],
];

function clean(s = ""): string { return s.toLowerCase(); }
function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }

export function parseIndianLpa(input?: string | number): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return input > 1000 ? input / 100000 : input;
  const text = String(input ?? "").replace(/,/g, "").toLowerCase();
  if (!text.trim()) return undefined;
  const lpa = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:lpa|l\.p\.a|lakhs?|lacs?|lac)/i);
  if (lpa) return Number(lpa[1]);
  const inr = text.match(/(?:₹|rs\.?|inr)\s*([0-9]{5,9})/i);
  if (inr) return Number(inr[1]) / 100000;
  const plain = text.match(/\b([0-9]+(?:\.[0-9]+)?)\b/);
  if (plain) {
    const n = Number(plain[1]);
    if (n > 1000) return n / 100000;
    if (n <= 300) return n;
  }
  return undefined;
}

export function extractIndianSalaryRange(job: Pick<Job, "salary" | "description">): { min?: number; max?: number } {
  const text = `${job.salary ?? ""} ${job.description ?? ""}`.replace(/,/g, "").toLowerCase();
  const range = text.match(/(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lpa|l\.p\.a|lakhs?|lacs?|lac|ctc)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const direct = text.match(/(?:₹|rs\.?|inr)\s*([0-9]{5,9})\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*([0-9]{5,9})/i);
  if (direct) return { min: Number(direct[1]) / 100000, max: Number(direct[2]) / 100000 };
  const single = text.match(/(?:upto|up to|max|maximum)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lpa|lakhs?|lacs?|lac)/i);
  if (single) return { max: Number(single[1]) };
  return {};
}

export function parseNoticeDays(input?: string): number | undefined {
  const text = clean(input ?? "");
  if (!text) return undefined;
  if (/immediate|joining immediately|0\s*days?/.test(text)) return 0;
  if (/serving notice/.test(text)) return 15;
  const m = text.match(/([0-9]{1,3})\s*(?:days?|day|d)/i);
  if (m) return Number(m[1]);
  const month = text.match(/([0-9])\s*months?/i);
  if (month) return Number(month[1]) * 30;
  return undefined;
}

export function detectIndiaCityTier(location?: string): IndiaCityTier {
  const loc = clean(location ?? "");
  if (!loc) return "unknown";
  if (/remote|work from home|wfh|anywhere/.test(loc)) return "remote";
  if (METRO.some((c) => loc.includes(c))) return "metro";
  if (TIER2.some((c) => loc.includes(c))) return "tier2";
  if (/india|bharat/.test(loc)) return "tier1";
  return "unknown";
}

export function detectIndiaBoard(url?: string): IndiaOpportunityInsight["board"]["detected"] {
  const u = url ?? "";
  for (const [name, re] of INDIA_JOB_BOARDS) if (re.test(u)) return name;
  return /^https?:\/\//i.test(u) ? "company" : "unknown";
}

export function analyzeIndiaOpportunity(profile: Profile, job: Job, applications: Application[] = []): IndiaOpportunityInsight {
  const salaryRange = extractIndianSalaryRange(job);
  const currentLpa = parseIndianLpa(profile.currentCTC);
  const expectedLpa = parseIndianLpa(profile.expectedCTC || profile.salaryExpectation || profile.jobPreferences?.minSalary);
  const recommendedAskLpa = recommendAsk(currentLpa, expectedLpa, salaryRange.max);
  const hikePercent = currentLpa && recommendedAskLpa ? Math.round(((recommendedAskLpa - currentLpa) / currentLpa) * 100) : undefined;
  const ctcFit = salaryFit(expectedLpa, salaryRange.max, salaryRange.min);
  const employerMaxDays = employerNoticeMax(job.description);
  const candidateDays = parseNoticeDays(profile.noticePeriod);
  const noticeFit = noticeFitFor(candidateDays, employerMaxDays);
  const risk = assessJobRisk(job, profile);
  const board = detectIndiaBoard(job.url);
  const cityTier = detectIndiaCityTier(job.location);
  const privacyWarnings = indiaPrivacyWarnings(`${job.title} ${job.company} ${job.description}`);
  const duplicate = applications.some((a) => sameJob(a, job));

  let score = 70;
  if (ctcFit === "above_expectation") score += 12;
  if (ctcFit === "below_expectation") score -= 18;
  if (noticeFit === "excellent") score += 8;
  if (noticeFit === "blocked") score -= 20;
  if (cityTier === "metro" || cityTier === "remote") score += 6;
  if (risk.level === "high") score -= 20;
  if (risk.level === "blocked") score -= 50;
  if (privacyWarnings.length) score -= Math.min(25, privacyWarnings.length * 8);
  if (duplicate) score -= 25;

  return {
    indiaScore: clamp(score),
    cityTier,
    ctc: {
      currentLpa,
      expectedLpa,
      advertisedMinLpa: salaryRange.min,
      advertisedMaxLpa: salaryRange.max,
      recommendedAskLpa,
      hikePercent,
      fit: ctcFit,
      explanation: ctcExplanation(ctcFit, expectedLpa, salaryRange),
    },
    notice: {
      candidateDays,
      employerMaxDays,
      fit: noticeFit,
      explanation: noticeExplanation(noticeFit, candidateDays, employerMaxDays),
    },
    board: {
      detected: board,
      recommendedStrategy: boardStrategy(board),
    },
    trust: {
      score: clamp(100 - risk.scorePenalty - privacyWarnings.length * 12 - (duplicate ? 20 : 0)),
      warnings: [...risk.signals.map((s) => s.message), ...privacyWarnings, ...(duplicate ? ["Similar role/company already exists in tracker."] : [])],
      privacyChecklist: [
        "Do not share PAN/Aadhaar/passport before offer or verified background-check stage.",
        "Never pay registration, laptop, training, or security-deposit fees.",
        "Prefer official company domain email and career-page confirmation.",
        "Use masked salary documents until HR verification is legitimate.",
      ],
    },
    followUp: {
      bestTimeLocal: "10:00–11:30 AM IST or 3:00–5:00 PM IST on Tue–Thu",
      message: followUpMessage(profile, job, recommendedAskLpa),
    },
    customerDelighters: customerDelighters(profile, job, board),
  };
}

function recommendAsk(current?: number, expected?: number, advertisedMax?: number): number | undefined {
  const targets = [expected, current ? current * 1.3 : undefined, advertisedMax ? advertisedMax * 0.92 : undefined].filter((n): n is number => Boolean(n && Number.isFinite(n)));
  if (!targets.length) return undefined;
  targets.sort((a, b) => a - b);
  return Math.round(targets[Math.floor(targets.length / 2)]! * 2) / 2;
}
function salaryFit(expected?: number, max?: number, min?: number): IndiaCtcInsight["fit"] {
  if (!expected || (!max && !min)) return "unknown";
  if ((max ?? min ?? 0) >= expected) return "above_expectation";
  if ((max ?? 0) >= expected * 0.82) return "negotiable";
  return "below_expectation";
}
function ctcExplanation(fit: IndiaCtcInsight["fit"], expected: number | undefined, range: { min?: number; max?: number }): string {
  if (fit === "unknown") return "Salary/CTC data is missing; ask recruiter for fixed + variable split.";
  const shown = `${range.min ?? "?"}-${range.max ?? "?"} LPA`;
  if (fit === "above_expectation") return `Advertised range ${shown} can meet expected ${expected} LPA.`;
  if (fit === "negotiable") return `Advertised range ${shown} is near expectation; negotiate fixed pay, variable cap, joining bonus, and appraisal cycle.`;
  return `Advertised range ${shown} appears below expected ${expected} LPA.`;
}
function employerNoticeMax(text = ""): number | undefined {
  const cleanText = clean(text);
  if (/immediate joiner|join immediately|less than 15 days/.test(cleanText)) return 15;
  const m = cleanText.match(/(?:notice period|join within|joining)\D{0,20}([0-9]{1,3})\s*days?/i);
  return m ? Number(m[1]) : undefined;
}
function noticeFitFor(candidate?: number, employerMax?: number): NoticeFit {
  if (candidate === undefined || employerMax === undefined) return "unknown";
  if (candidate <= 15 && employerMax >= 15) return "excellent";
  if (candidate <= employerMax) return "good";
  if (candidate <= employerMax + 30) return "risky";
  return "blocked";
}
function noticeExplanation(fit: NoticeFit, candidate?: number, employerMax?: number): string {
  if (fit === "unknown") return "Notice-period fit unknown; ask recruiter before spending time.";
  if (fit === "excellent") return `Candidate notice ${candidate} days fits urgent Indian hiring timelines.`;
  if (fit === "good") return `Candidate notice ${candidate} days fits employer max ${employerMax} days.`;
  if (fit === "risky") return `Candidate notice ${candidate} days may need buyout/early-release discussion.`;
  return `Candidate notice ${candidate} days likely exceeds employer max ${employerMax} days.`;
}
function indiaPrivacyWarnings(text: string): string[] {
  const t = clean(text);
  const out: string[] = [];
  if (/original documents|retain.*documents|deposit.*documents/.test(t)) out.push("Asks for original-document handling; high-risk in India.");
  if (/security deposit|training fee|registration fee|pay.*laptop|pay.*asset/.test(t)) out.push("Mentions fees/deposits; likely scam or abusive hiring practice.");
  if (/aadhaar|aadhar|pan card|passport|bank statement/.test(t)) out.push("Requests sensitive KYC documents before verified offer stage.");
  if (/bond|service agreement/.test(t)) out.push("Mentions bond/service agreement; review lock-in and penalty terms.");
  return out;
}
function boardStrategy(board: IndiaOpportunityInsight["board"]["detected"]): string {
  switch (board) {
    case "naukri": return "Refresh Naukri profile headline, key skills, notice period, and CTC before applying; recruiters sort by recency.";
    case "linkedin": return "Apply early, then send a concise recruiter/hiring-manager message with India notice period and CTC range.";
    case "instahyre": return "Keep expected CTC and tech stack precise; Instahyre shortlists strongly on skill density and availability.";
    case "hirist": return "Emphasize tech keywords, current CTC, expected CTC, and notice-period clarity.";
    case "iimjobs": return "Emphasize domain, MBA/management keywords, compensation band, and seniority alignment.";
    case "company": return "Prefer company career page, then cross-check recruiter identity on LinkedIn before sharing sensitive details.";
    default: return "Verify posting legitimacy, apply with tailored resume, and track follow-up in 5–7 business days.";
  }
}
function followUpMessage(profile: Profile, job: Job, ask?: number): string {
  const name = profile.firstName || "Candidate";
  const skills = (profile.skills ?? []).slice(0, 3).join(", ");
  const notice = profile.noticePeriod ? ` Notice period: ${profile.noticePeriod}.` : "";
  const ctc = ask ? ` Expected CTC: around ${ask} LPA, negotiable for the right fit.` : "";
  return `Hi, I’m ${name}. I applied for ${job.title || "the role"} at ${job.company || "your company"}. My relevant strengths include ${skills || "the required skills"}.${notice}${ctc} Happy to share details if my profile fits.`;
}
function customerDelighters(profile: Profile, job: Job, board: IndiaOpportunityInsight["board"]["detected"]): string[] {
  return [
    "India CTC intelligence: fixed/variable breakdown, joining bonus, and market percentile insights.",
    "Notice-period autopilot: highlights immediate/15/30/60/90-day fit before applying.",
    "Naukri freshness assistant: reminds users to refresh profile and key skills for recruiter search ranking.",
    "Fraud shield for India: flags bonds, deposits, original-document requests, Aadhaar/PAN before offer.",
    "IST follow-up scheduler: recommends recruiter-friendly follow-up windows.",
    `${profile.firstName || "User"}-specific pitch for ${job.company || "company"} via ${board}.`,
  ];
}
function sameJob(a: Application, job: Job): boolean {
  const au = a.url.split("?")[0]?.toLowerCase();
  const ju = job.url.split("?")[0]?.toLowerCase();
  if (au && ju && au === ju) return true;
  return clean(a.company) === clean(job.company) && clean(a.title) === clean(job.title);
}
