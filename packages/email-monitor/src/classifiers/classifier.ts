import type { LLMClient, ApplicationStage } from "@superjob/core";
import type { EmailCategory, JobEmail } from "../types.js";
import type { RawEmail } from "../imap-client.js";

interface CatPattern { category: EmailCategory; stage?: ApplicationStage; patterns: RegExp[]; weight: number }

const PATTERNS: CatPattern[] = [
  { category: "interview-invitation", stage: "interview", weight: 3, patterns: [
    /we'?d like to (invite|schedule|set up).*(interview|call|chat|meet)/i,
    /invite(d)? you (for|to) (an? )?interview/i,
    /congratulations.*selected.*(interview|next (step|round|stage))/i,
    /interview.*(invitation|request|schedule)/i,
    /we would love to (meet|speak|talk|connect) with you/i,
    /(technical|phone|video|on-site|onsite) (screen|interview)/i,
    /schedule.*(call|interview|meeting) with/i,
  ]},
  { category: "offer", stage: "offer", weight: 4, patterns: [
    /pleased? to (offer|extend|present) you (the |a )?(position|role|job|offer)/i,
    /congratulations.*(offer|position|job)/i, /offer of employment/i,
    /we'?d like to (extend|make) (you )?an offer/i, /job offer (letter|details)/i, /formal offer/i,
  ]},
  { category: "assessment", stage: "screening", weight: 3, patterns: [
    /(coding|technical|online|assessment) (challenge|test|assessment|exercise)/i,
    /complete(d)? the (following |next )?(assessment|test|challenge|coding)/i,
    /hackerrank|codility|codesignal|coderpad|coderbyte|testdome/i,
    /take-?home (assignment|test|exercise)/i, /online assessment/i, /skills (assessment|test|evaluation)/i,
  ]},
  { category: "rejection", stage: "rejected", weight: 3, patterns: [
    /regret to inform you.*(not (moving|proceed|selected|able|successful))/i,
    /we (have )?decided not to (move|proceed|continue) (forward )?with/i,
    /unfortunately.*(not (moving|proceed|able|a match|selected))/i,
    /your application (has been )?(unsuccessful|not (successful|selected|progress))/i,
    /we (won'?t be|will not be) (moving|proceed|continuing) (forward )?with/i,
    /decided to (move forward with|proceed with) other candidates/i,
    /position has been filled/i, /we are unable to offer you/i,
  ]},
  { category: "acknowledgment", stage: "applied", weight: 2, patterns: [
    /we (have )?received your application/i,
    /thank you for (your )?(applying|application|interest)/i,
    /your application (has been )?(received|submitted|successfully)/i,
    /we will review your (application|resume|qualifications)/i,
    /our team will (be in touch|review|reach out)/i,
  ]},
  { category: "status-update", weight: 1, patterns: [
    /update on your application/i, /status of your application/i,
    /application (status|update|progress)/i, /next steps? in the (hiring|interview|recruit) process/i,
  ]},
  { category: "recruiter-outreach", stage: "saved", weight: 1, patterns: [
    /i (came across|found|saw) your (profile|resume)/i, /i'?m a (technical )?recruiter/i,
    /opportunity that (might|may) (be of )?interest/i, /reaching out (to|because)/i,
  ]},
];

function extractCompany(subject: string, body: string, fromName: string, from: string): string {
  const m = (subject + " " + body).match(/(?:at|from|with|join)\s+([A-Z][A-Za-z0-9&.\- ]{2,40}?)(?:\.|,|!|\?|\n| -| for| in the| team)/);
  if (m) return m[1].trim();
  if (fromName && !/@/.test(fromName)) {
    const c = fromName.replace(/\s*(Recruiting|Talent|HR|Careers|Hiring|Team|Jobs?)\s*/gi, "").trim();
    if (c.length > 1) return c;
  }
  const d = from.split("@")[1]?.split(".")[0];
  if (d && d.length > 2 && !["noreply","no-reply","mail","email","notifications","donotreply","automated"].includes(d.toLowerCase()))
    return d.charAt(0).toUpperCase() + d.slice(1);
  return "";
}

function extractRole(subject: string, body: string): string {
  const m1 = subject.match(/(?:position|role|job|opportunity)[:\s]+(.+)/i);
  if (m1) return m1[1].trim();
  const m2 = body.match(/(?:applying|application|applied|interview|chat|talk|speaking) (?:for|to|regarding|about)\s+(?:the\s+)?([A-Za-z0-9 ]{3,60}?)(?:\s+position|\s+role|\.|,|\n)/i);
  if (m2) return m2[1].trim();
  const m3 = (subject + "\n" + body).match(/([A-Z][A-Za-z0-9 ]{2,50}?)\s+(?:position|role)\b/);
  if (m3) return m3[1].trim();
  return "";
}

export async function classifyEmail(raw: RawEmail, llm?: LLMClient): Promise<JobEmail> {
  const combined = (raw.subject + "\n" + raw.text).slice(0, 4000);
  const r = classifyByKeywords(combined);
  let category = r.category, confidence = r.confidence, stage = r.stage;
  const company = extractCompany(raw.subject, raw.text, raw.fromName, raw.from);
  const role = extractRole(raw.subject, raw.text);

  if (confidence < 0.7 && llm?.isAvailable()) {
    const lr = await classifyWithLLM(combined, llm);
    if (lr && lr.confidence > confidence) { category = lr.category; confidence = lr.confidence; stage = lr.stage ?? stage; }
  }

  if (category === "irrelevant") return toEmail(raw, "irrelevant", undefined, 0.9, company, role, "Not job-related.");
  return toEmail(raw, category, stage, confidence, company, role, summary(category, company, role));
}

function classifyByKeywords(text: string) {
  let bestCat: EmailCategory = "irrelevant", bestScore = 0, bestStage: ApplicationStage | undefined;
  for (const p of PATTERNS) {
    let s = 0; for (const re of p.patterns) if (re.test(text)) s += p.weight;
    if (s > bestScore) { bestScore = s; bestCat = p.category; bestStage = p.stage; }
  }
  const conf = bestScore === 0 ? 0 : Math.min(1, bestScore / 4);
  if (bestScore === 0) {
    if (!/\b(application|applied|position|role|job|hiring|candidate|resume|cover letter|recruit|interview|offer|career)\b/i.test(text))
      return { category: "irrelevant" as EmailCategory, confidence: 0.9 };
    return { category: "status-update" as EmailCategory, confidence: 0.3 };
  }
  return { category: bestCat, confidence: conf, stage: bestStage };
}

async function classifyWithLLM(text: string, llm: LLMClient) {
  try {
    const resp = await llm.complete(
      [{ role: "system", content: "Classify this job email. Reply with ONLY JSON: {category, stage, confidence}. Categories: interview-invitation,rejection,offer,assessment,acknowledgment,status-update,recruiter-outreach,irrelevant. Stage: saved,applied,screening,interview,offer,rejected,null." },
       { role: "user", content: text.slice(0, 2000) }],
      { temperature: 0.1, maxTokens: 200 }
    );
    const m = resp.match(/\{[\s\S]*\}/); if (!m) return null;
    const p = JSON.parse(m[0]);
    return { category: (p.category ?? "irrelevant") as EmailCategory, stage: p.stage ?? undefined, confidence: typeof p.confidence === "number" ? p.confidence : 0.7 };
  } catch { return null; }
}

function toEmail(raw: RawEmail, category: EmailCategory, stage: ApplicationStage | undefined, confidence: number, company: string, role: string, s: string): JobEmail {
  return { id: raw.messageId, messageId: raw.messageId, from: raw.from, fromName: raw.fromName, subject: raw.subject, body: raw.text.slice(0, 2000), date: raw.date, category, confidence, company: company || undefined, role: role || undefined, newStage: stage, summary: s };
}

function summary(cat: EmailCategory, company: string, role: string): string {
  const w = company ? " at " + company : "", r = role ? " for " + role : "";
  switch (cat) {
    case "interview-invitation": return "Interview invitation" + w + r + ".";
    case "rejection": return "Rejected" + w + r + ".";
    case "offer": return "Job offer" + w + r + "! 🎉";
    case "assessment": return "Assessment/test requested" + w + r + ".";
    case "acknowledgment": return "Application acknowledged" + w + ".";
    case "status-update": return "Status update" + w + ".";
    case "recruiter-outreach": return "Recruiter reached out" + (company ? " from " + company : "") + ".";
    default: return "Not job-related.";
  }
}
