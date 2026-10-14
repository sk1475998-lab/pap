/**
 * Recon Agent — Reconnaissance Before Action
 *
 * Adopted from: "Recon-Act: A Self-Evolving Multi-Agent Browser-Use System
 * via Web Reconnaissance, Tool Generation, and Task Execution"
 * (He et al., arXiv:2509.21072, 2025)
 * SOTA on VisualWebArena: 36.48% success rate.
 *
 * Core idea from AWorld (inclusionAI/AWorld):
 *   Reconnaissance Team: analyze page → build "generalized tool" (strategy)
 *   Action Team: execute strategy, no blind trial-and-error
 *
 * Our adoption:
 *   Before ANY form-fill, ReconAgent:
 *     1. Checks the Tool Archive for a cached strategy for this ATS form
 *     2. If cached: use it instantly (zero LLM cost)
 *     3. If new: analyze DOM → LLM → build FormFillingStrategy → cache it
 *     4. On failure: decrement successCount, increment failureCount → eventually
 *        the strategy is rebuilt on next recon (self-healing archive)
 *
 * The Tool Archive persists across sessions via the extension storage so we
 * never re-learn the same LinkedIn Easy Apply form twice.
 */

import type { Agent, AgentContext } from "../framework.js";
import type {
  FormFillingStrategy,
  FormField,
  ReActTrace,
  SOPBlackboard,
} from "../sop.js";
import { runReActLoop, createExtractTool, createReconTool } from "../react-loop.js";

/* ------------------------------------------------------------------ */
/* Form Signature — stable fingerprint of an ATS form                   */
/* ------------------------------------------------------------------ */

/**
 * Compute a stable fingerprint for a form based on its field labels.
 * Matches the Recon-Act "tool archive" key concept.
 * Same fingerprint → reuse cached strategy.
 */
export function computeFormSignature(
  fields: Array<{ label: string; type: string }>
): string {
  const normalized = fields
    .map((f) => `${f.type}:${f.label.toLowerCase().replace(/\s+/g, "_")}`)
    .sort()
    .join("|");
  // Short hash for readability
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return `form_${Math.abs(hash).toString(36)}`;
}

/** Detect which ATS system the form belongs to. */
export function detectAtsName(url: string, html?: string): string {
  if (/linkedin\.com/i.test(url)) return "linkedin-easy-apply";
  if (/workday\.com|myworkdayjobs/i.test(url)) return "workday";
  if (/greenhouse\.io/i.test(url)) return "greenhouse";
  if (/lever\.co/i.test(url)) return "lever";
  if (/ashby\.io/i.test(url)) return "ashby";
  if (/taleo\.net/i.test(url)) return "taleo";
  if (/smartrecruiters\.com/i.test(url)) return "smartrecruiters";
  if (/icims\.com/i.test(url)) return "icims";
  if (/brassring\.com/i.test(url)) return "brassring";
  if (/naukri\.com/i.test(url)) return "naukri";
  if (/instahyre\.com/i.test(url)) return "instahyre";
  if (/internshala\.com/i.test(url)) return "internshala";
  // Fallback: try to detect from form HTML hints
  if (html) {
    if (/data-automation-id|wd-label/i.test(html)) return "workday";
    if (/greenhouse/i.test(html)) return "greenhouse";
    if (/lever\.co/i.test(html)) return "lever";
  }
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Recon Agent                                                           */
/* ------------------------------------------------------------------ */

export interface ReconAgentOptions {
  /** Inject the current page URL (extension context). */
  getCurrentUrl?: () => string;
  /** Inject DOM inspection capability (extension context). */
  inspectFormFields?: () => Array<{ label: string; type: string; selector: string; required: boolean }>;
  /** How many failures before a cached strategy is invalidated. */
  maxFailuresBeforeRebuild?: number;
}

export function createReconAgent(opts: ReconAgentOptions = {}): Agent {
  return {
    name: "Recon Agent",
    role: "Web Page Analyst",
    goal: "Analyze ATS form structure before any filling — build and maintain a Tool Archive of optimal strategies",
    backstory:
      "A meticulous web analyst who studies every form before touching it. " +
      "Never flies blind into a form — always has a map before the action agent executes. " +
      "Trained on Recon-Act's reconnaissance-before-action paradigm.",

    async execute(ctx: AgentContext): Promise<string> {
      const sopBoard = ctx.blackboard as unknown as SOPBlackboard;

      // Ensure tool archive exists on blackboard
      if (!sopBoard.toolArchive) {
        sopBoard.toolArchive = new Map();
      }

      const url = opts.getCurrentUrl?.() ?? (typeof location !== "undefined" ? location.href : "");
      const atsName = detectAtsName(url);

      // Detect fields from DOM if we can
      const detectedFields = opts.inspectFormFields?.() ?? [];

      if (detectedFields.length === 0) {
        ctx.log(`[Recon] No form fields detected — skipping recon for ${atsName}`, "warn");
        return "No form fields detected — skipping recon";
      }

      const formSig = computeFormSignature(detectedFields);
      ctx.log(`[Recon] Form signature: ${formSig} (${atsName}, ${detectedFields.length} fields)`);

      // --- Check Tool Archive ---
      const cached = sopBoard.toolArchive.get(formSig);
      const maxFailures = opts.maxFailuresBeforeRebuild ?? 3;

      if (cached && cached.failureCount < maxFailures) {
        ctx.log(
          `[Recon] Cache HIT: Using cached strategy (✓${cached.successCount} ✗${cached.failureCount}) — zero LLM cost`
        );
        cached.lastUsed = Date.now();
        return `Recon cache hit: ${formSig} (${atsName}) — ${cached.fields.length} fields mapped`;
      }

      if (cached && cached.failureCount >= maxFailures) {
        ctx.log(`[Recon] Cache INVALIDATED: ${cached.failureCount} failures — rebuilding strategy`);
        sopBoard.toolArchive.delete(formSig);
      }

      // --- Run ReAct loop for reconnaissance ---
      ctx.log(`[Recon] Cache MISS — running ReAct reconnaissance loop for ${atsName}`);

      const tools = [
        createExtractTool(ctx.think),
        createReconTool(),
      ];

      const { result, trace } = await runReActLoop(
        `Analyze this ATS form (${atsName}) and build a filling strategy.
Fields found: ${JSON.stringify(detectedFields.map((f) => ({ label: f.label, type: f.type, required: f.required })))}.
Profile available: ${ctx.blackboard.profile ? "YES" : "NO"}.
Task: Map each field to the correct profile value and assign a confidence score (0-100).`,
        tools,
        ctx.think,
        {
          maxSteps: 5,
          systemRole: `You are a Recon Agent analyzing a job application form.
Your job is to map form fields to user profile data and generate a filling strategy.
PROFILE DATA AVAILABLE:
- Name: ${[ctx.blackboard.profile?.firstName, ctx.blackboard.profile?.lastName].filter(Boolean).join(" ") ?? ""}
- Email: ${ctx.blackboard.profile?.email ?? ""}
- Phone: ${ctx.blackboard.profile?.phone ?? ""}
- Location: ${ctx.blackboard.profile?.location ?? ""}
- Skills: ${ctx.blackboard.profile?.skills?.slice(0, 10).join(", ") ?? ""}`,
        }
      );

      // Build the strategy from recon result
      const strategy = buildFillingStrategy(
        formSig,
        atsName,
        detectedFields,
        ctx.blackboard.profile,
        result,
        trace
      );

      // Register in tool archive
      sopBoard.toolArchive.set(formSig, strategy);
      ctx.log(
        `[Recon] Strategy built and cached: ${strategy.fields.length} fields mapped for ${atsName}`
      );

      return `Recon complete: ${detectedFields.length} fields mapped for ${atsName}, strategy cached as ${formSig}`;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Strategy Builder                                                      */
/* ------------------------------------------------------------------ */

function buildFillingStrategy(
  formSig: string,
  atsName: string,
  detectedFields: Array<{ label: string; type: string; selector: string; required: boolean }>,
  profile: any,
  reconResult: string,
  trace: ReActTrace[]
): FormFillingStrategy {
  const p = profile ?? {};

  // Map common field labels to profile values
  const fieldMap: Record<string, { value: string; confidence: number }> = {
    // Name fields
    name: { value: p.name ?? "", confidence: 95 },
    "full name": { value: p.name ?? "", confidence: 95 },
    "first name": { value: p.name?.split(" ")[0] ?? "", confidence: 90 },
    "last name": { value: p.name?.split(" ").slice(1).join(" ") ?? "", confidence: 90 },
    "given name": { value: p.name?.split(" ")[0] ?? "", confidence: 90 },
    "surname": { value: p.name?.split(" ").slice(1).join(" ") ?? "", confidence: 90 },

    // Contact
    email: { value: p.email ?? "", confidence: 98 },
    phone: { value: p.phone ?? "", confidence: 95 },
    "mobile number": { value: p.phone ?? "", confidence: 95 },
    "phone number": { value: p.phone ?? "", confidence: 95 },
    "contact number": { value: p.phone ?? "", confidence: 95 },
    mobile: { value: p.phone ?? "", confidence: 95 },

    // Location
    city: { value: p.location?.split(",")[0]?.trim() ?? "", confidence: 85 },
    location: { value: p.location ?? "", confidence: 90 },
    address: { value: p.location ?? "", confidence: 75 },
    "current location": { value: p.location ?? "", confidence: 90 },

    // Professional
    linkedin: { value: p.linkedinUrl ?? "", confidence: 90 },
    "linkedin url": { value: p.linkedinUrl ?? "", confidence: 90 },
    github: { value: p.githubUrl ?? "", confidence: 90 },
    portfolio: { value: p.portfolioUrl ?? "", confidence: 85 },
    website: { value: p.portfolioUrl ?? p.githubUrl ?? "", confidence: 80 },

    // Work
    "years of experience": { value: p.yearsOfExperience?.toString() ?? "", confidence: 80 },
    "current salary": { value: p.currentSalary ?? "", confidence: 70 },
    "expected salary": { value: p.expectedSalary ?? "", confidence: 70 },
    "notice period": { value: p.noticePeriod ?? "Immediate", confidence: 75 },

    // Questions
    "cover letter": { value: "", confidence: 60 }, // filled by tailor
    "why do you want": { value: "", confidence: 50 },
    "tell us about yourself": { value: p.summary ?? "", confidence: 70 },
  };

  const fields: FormField[] = detectedFields.map((f) => {
    const label = f.label.toLowerCase().trim();
    const mapped = fieldMap[label] ??
      // Fuzzy match
      Object.entries(fieldMap).find(([k]) => label.includes(k) || k.includes(label))?.[1] ??
      { value: "", confidence: 30 };

    return {
      label: f.label,
      type: f.type as FormField["type"],
      required: f.required,
      selector: f.selector,
      value: mapped.value,
      confidence: mapped.value ? mapped.confidence : 0,
    };
  });

  return {
    formSignature: formSig,
    atsName,
    fields,
    successCount: 0,
    failureCount: 0,
    lastUsed: Date.now(),
    version: 1,
  };
}

/* ------------------------------------------------------------------ */
/* Tool Archive Management                                               */
/* ------------------------------------------------------------------ */

/** Record a successful submission for a strategy — increases confidence */
export function recordStrategySuccess(archive: Map<string, FormFillingStrategy>, formSig: string): void {
  const s = archive.get(formSig);
  if (s) {
    s.successCount++;
    s.lastUsed = Date.now();
  }
}

/** Record a failure — too many failures trigger strategy rebuild */
export function recordStrategyFailure(archive: Map<string, FormFillingStrategy>, formSig: string): void {
  const s = archive.get(formSig);
  if (s) {
    s.failureCount++;
    s.lastUsed = Date.now();
  }
}

/** Serialize tool archive for extension storage persistence */
export function serializeToolArchive(archive: Map<string, FormFillingStrategy>): string {
  return JSON.stringify(Array.from(archive.entries()));
}

/** Restore tool archive from extension storage */
export function deserializeToolArchive(json: string): Map<string, FormFillingStrategy> {
  try {
    const entries: [string, FormFillingStrategy][] = JSON.parse(json);
    return new Map(entries);
  } catch {
    return new Map();
  }
}
