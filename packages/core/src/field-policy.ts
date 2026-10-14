/**
 * Field risk policy — keeps the agent fast while preventing unsafe, hallucinated,
 * or reputation-damaging submissions.
 *
 * Competitor auto-apply tools often fail by blindly filling sensitive fields,
 * guessing screening answers, or submitting generic AI text. This policy layer
 * makes every filler decide: fill, ask the user, skip, or allow AI.
 */
import type { DetectedField } from "./types.js";
import type { ProfileLookup } from "./profile.js";
import { isSensitiveQuestion, normalizeQuestion, classifyLabel } from "./resolver.js";

export type FieldPolicyAction = "fill" | "allow-ai" | "needs-user" | "skip";
export type FieldRisk =
  | "safe"
  | "unknown"
  | "sensitive-id"
  | "credential"
  | "eeo"
  | "legal-auth"
  | "salary"
  | "assessment"
  | "truthfulness"
  | "optional-marketing";

export interface FieldPolicyDecision {
  action: FieldPolicyAction;
  risk: FieldRisk;
  reason: string;
  requiresExplicitValue: boolean;
}

const CREDENTIAL_RE = /\b(password|passcode|security\s*answer|2fa|otp|verification\s*code|secret)\b/i;
const EEO_RE = /\b(race|ethnic(?:ity)?|hispanic|latino|gender(?: identity)?|veteran|disability|sexual orientation|aboriginal|indigenous)\b/i;
const SALARY_RE = /\b(salary|compensation|ctc|pay expectation|desired pay|hourly rate|expected package)\b/i;
const LEGAL_AUTH_RE = /\b(work authorization|authorized to work|legally eligible|visa|sponsorship|h-?1b|opt|cpt|ead|citizen|work permit)\b/i;
const ASSESSMENT_RE = /\b(assessment|test question|coding challenge|homework|quiz|exam|write code|solve|algorithm|aptitude)\b/i;
const TRUTHFULNESS_RE = /\b(years of experience|professional experience|managed|led|expert in|required experience|clearance|degree completed|certified)\b/i;
const MARKETING_RE = /\b(newsletter|marketing|promotional|sms updates|talent community|future opportunities|follow\s+.*(?:company|page)|stay up to date)\b/i;
const HONEYPOT_RE = /\b(robots? only|do not enter|leave blank|for robots|human verify|bot check|leave.*blank|do not fill|if you are human)\b/i;

function hasExplicitValue(field: DetectedField | { label: string; fieldKey?: string }, lookup: ProfileLookup): boolean {
  let key = field.fieldKey ?? "";
  if (!key || key === "ai") {
    key = classifyLabel(field.label);
  }
  if (key && key !== "ai") {
    const direct = lookup[key];
    if (Array.isArray(direct)) return direct.length > 0;
    if (typeof direct === "string") return direct.trim().length > 0;
  }
  // Experience company/employer fallback
  const normLabel = (field.label ?? "").toLowerCase();
  if (/\b(company|employer|organization)\b/i.test(normLabel)) {
    const comp = lookup.workExperienceCompany || lookup.company || lookup.employer;
    if (typeof comp === "string" && comp.trim().length > 0) return true;
  }
  if (/\b(job\s*title|position\s*title|role\s*title|designation)\b/i.test(normLabel)) {
    const title = lookup.jobTitle || lookup.yourTitle;
    if (typeof title === "string" && title.trim().length > 0) return true;
  }
  const cached = lookup[`custom:${normalizeQuestion(field.label)}`];
  if (Array.isArray(cached)) return cached.length > 0;
  return typeof cached === "string" && cached.trim().length > 0;
}

export function decideFieldPolicy(
  field: DetectedField | { label: string; fieldKey?: string; type?: string },
  lookup: ProfileLookup,
  opts: { allowSensitiveDefaults?: boolean; allowEeoAutofill?: boolean; allowSalaryAutofill?: boolean; allowAutonomousFallback?: boolean } = {}
): FieldPolicyDecision {
  const label = field.label ?? "";
  const q = label.toLowerCase();
  const explicit = hasExplicitValue(field, lookup);

  if (HONEYPOT_RE.test(q)) {
    return { action: "skip", risk: "optional-marketing", reason: "Honeypot/robot-detection field is skipped.", requiresExplicitValue: false };
  }

  if (CREDENTIAL_RE.test(q)) {
    return { action: "skip", risk: "credential", reason: "Credential/OTP/security fields are never autofilled by the application filler.", requiresExplicitValue: true };
  }
  if (EEO_RE.test(q)) {
    if (explicit && opts.allowEeoAutofill) {
      return { action: "fill", risk: "eeo", reason: "EEO field filled only because explicit value and EEO autofill are enabled.", requiresExplicitValue: true };
    }
    return { action: "needs-user", risk: "eeo", reason: "EEO/demographic fields require user choice.", requiresExplicitValue: true };
  }
  if (isSensitiveQuestion(label)) {
    return explicit || opts.allowSensitiveDefaults
      ? { action: "fill", risk: "sensitive-id", reason: "Sensitive identity field has an explicit profile value.", requiresExplicitValue: true }
      : { action: "needs-user", risk: "sensitive-id", reason: "Sensitive identity field requires manual confirmation/value.", requiresExplicitValue: true };
  }
  if (ASSESSMENT_RE.test(q)) {
    return { action: "needs-user", risk: "assessment", reason: "Assessment/test questions should not be auto-answered.", requiresExplicitValue: true };
  }
  if (LEGAL_AUTH_RE.test(q)) {
    if (explicit) {
      // Allow any legal work authorization value, not just yes/no
      return { action: "fill", risk: "legal-auth", reason: "Legal/work authorization field has explicit profile value.", requiresExplicitValue: true };
    }
    if (opts.allowAutonomousFallback) {
      return { action: "needs-user", risk: "legal-auth", reason: "Work authorization must come from an explicit candidate-provided value.", requiresExplicitValue: true };
    }
    return { action: "needs-user", risk: "legal-auth", reason: "Legal/work authorization answers must be explicit, not inferred.", requiresExplicitValue: true };
  }
  if (SALARY_RE.test(q)) {
    if (explicit && opts.allowSalaryAutofill !== false) {
      return { action: "fill", risk: "salary", reason: "Salary field has explicit profile value.", requiresExplicitValue: true };
    }
    if (opts.allowAutonomousFallback) {
      return { action: "allow-ai", risk: "salary", reason: "Autonomous fallback allowed: salary will use safe default or AI.", requiresExplicitValue: false };
    }
    return { action: "needs-user", risk: "salary", reason: "Salary expectations should be explicit/user-approved.", requiresExplicitValue: true };
  }
  const isCoverLetter = field.fieldKey === "coverLetter" || /cover\s*letter|personal\s*note|note\s*to\s*(?:the\s*)?hiring/i.test(label);
  if (isCoverLetter) {
    return { action: explicit ? "fill" : "allow-ai", risk: "safe", reason: "Cover letter field can use profile cover letter or AI tailored generation.", requiresExplicitValue: false };
  }

  if (MARKETING_RE.test(q)) {
    return { action: "skip", risk: "optional-marketing", reason: "Optional marketing/talent-community opt-in skipped by default.", requiresExplicitValue: false };
  }
  if (TRUTHFULNESS_RE.test(q) && !explicit) {
    if (opts.allowAutonomousFallback) {
      return { action: "allow-ai", risk: "truthfulness", reason: "Autonomous fallback enabled: grounding answer on candidate profile.", requiresExplicitValue: false };
    }
    return { action: "needs-user", risk: "truthfulness", reason: "Truthfulness-critical field has no explicit profile value. Autonomous AI must not invent experience or qualification claims.", requiresExplicitValue: true };
  }

  if (explicit) return { action: "fill", risk: "safe", reason: "Explicit profile/custom value available.", requiresExplicitValue: false };
  if (opts.allowAutonomousFallback) {
    return { action: "allow-ai", risk: "unknown", reason: "Unknown non-sensitive question may use grounded AI/defaults within budget.", requiresExplicitValue: false };
  }
  return { action: "needs-user", risk: "unknown", reason: "Unknown field has no explicit value and autonomous fallback is disabled.", requiresExplicitValue: true };
}

export function shouldNeverCacheQuestion(question: string): boolean {
  return CREDENTIAL_RE.test(question) || isSensitiveQuestion(question) || EEO_RE.test(question) || ASSESSMENT_RE.test(question) || SALARY_RE.test(question);
}
