/**
 * LLM robustness toolkit — option snapping, model-text JSON parsing, structured
 * skill extraction, and per-call cost estimation.
 *
 * LICENSE / ATTRIBUTION:
 * Two MIT-licensed sources are adapted here; notices preserved in
 * THIRD_PARTY_NOTICES.md and file headers of the origin modules.
 *
 * 1. Auto_job_applier_linkedIn (Copyright 2024-2026 Sai Vignesh Golla, MIT) —
 *    `modules/ai/connections.py` (the LangGraph answer pipeline's
 *    `select_option` snapping: exact → case-insensitive → substring both
 *    directions) and `modules/ai/prompts.py` (`extract_skills_prompt` five
 *    skill buckets; JSON fallback when structured output is unsupported).
 *
 * 2. first2apply (beastx-ro, MIT) — `_shared/openAI.ts` cost accounting
 *    (prefer the provider-reported cost; fall back to list-price estimate).
 *
 * Changes for SJA: TypeScript; deterministic functions with no SDK/network
 * dependency; snapping adds a fuzzy (blended-similarity) tier after substring
 * via our clean-room `field-similarity` module; JSON parsing is resilient to
 * fenced code blocks and surrounding prose; extraction is a plain
 * `complete()` + `parseModelJson` fallback (no structured-output requirement).
 */

import { blendedSimilarity } from "../field-similarity.js";

export type OptionLikeValue = string | {
  value?: string;
  label?: string;
};

/**
 * Strip markdown fences / code-block wrappers and find the first top-level
 * JSON object or array in a model reply. Returns the parsed value, or
 * `undefined` when no valid JSON can be recovered.
 *
 * Handles: ```json … ```, ``` … ```, leading/trailing prose, whitespace.
 */
export function parseModelJson(text: string): unknown {
  if (!text) return undefined;
  let t = text.trim();
  // Remove a single outer code fence block if present
  const fence = /^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?```\s*$/.exec(t);
  if (fence) t = fence[1].trim();

  const firstBrace = t.indexOf("{");
  const firstBracket = t.indexOf("[");
  const open = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (open === -1) {
    // No container found — try a bare scalar parse (number/true/false/"str")
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  }
  const closeChar = t[open] === "{" ? "}" : "]";
  // Scan forward with a naive depth counter (enough for model output; strings
  // with braces are escaped by valid JSON so depth counting is safe).
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        const candidate = t.slice(open, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/**
 * Deterministic snapping of a model-generated answer onto the allowed options
 * for a select/radio-style question. Precedence mirrors the MIT reference:
 *   1) exact match against value or label
 *   2) case-insensitive match
 *   3) substring (either direction)
 *   4) fuzzy blended-similarity match above `fuzzyThreshold`
 * When nothing matches, the original (trimmed) answer is returned — never an
 * invented option — so callers can still fall back.
 */
export function snapAnswerToOptions(
  raw: string,
  options: readonly OptionLikeValue[],
  fuzzyThreshold = 0.82
): string {
  const answer = (raw ?? "").trim();
  if (!answer || !options || options.length === 0) return answer;
  const low = answer.toLowerCase();

  const normOptions: Array<{ value: string; label: string }> = options.map((o) => {
    if (typeof o === "string") return { value: o, label: o };
    const val = String(o?.value ?? o?.label ?? "");
    const lbl = String(o?.label ?? o?.value ?? "");
    return { value: val, label: lbl };
  });

  // 1-2) exact / case-insensitive (value or label)
  for (const o of normOptions) {
    if (answer === o.value || answer === o.label) return answer;
    if (low === o.value.toLowerCase() || low === o.label.toLowerCase()) {
      return answer === o.value || low === o.value.toLowerCase() ? o.value : o.label;
    }
  }
  // 3) substring either direction
  for (const o of normOptions) {
    const lv = o.value.toLowerCase();
    const ll = o.label.toLowerCase();
    if ((lv && (lv.includes(low) || low.includes(lv))) || (ll && (ll.includes(low) || low.includes(ll)))) {
      return lv && (lv.includes(low) || low.includes(lv)) ? o.value : o.label;
    }
  }
  // 4) fuzzy tier (blended char/bigram/token similarity from field-similarity)
  const lowAnswer = answer.toLowerCase();
  let bestLabelScore = -1;
  let bestValueScore = -1;
  let bestLabel: string | undefined;
  let bestValue: string | undefined;
  for (const o of normOptions) {
    const s = blendedSimilarity(lowAnswer, o.label.toLowerCase());
    if (s > bestLabelScore) {
      bestLabelScore = s;
      bestLabel = o.label;
    }
    const sv = blendedSimilarity(lowAnswer, o.value.toLowerCase());
    if (sv > bestValueScore) {
      bestValueScore = sv;
      bestValue = o.value;
    }
  }
  if (bestLabelScore >= fuzzyThreshold) return bestLabel as string;
  if (bestValueScore >= fuzzyThreshold) return bestValue as string;
  return answer;
}

/** Five skill buckets — taxonomy from the MIT reference's extract prompt. */
export interface SkillBuckets {
  techStack: string[];
  technicalSkills: string[];
  otherSkills: string[];
  requiredSkills: string[];
  niceToHave: string[];
}

/** System message that steers extraction of a job description into buckets. */
export const SKILL_EXTRACTION_SYSTEM =
  "You extract skills from a job description and classify them into exactly five JSON arrays: " +
  "techStack (programming languages, frameworks, libraries, databases, tools), " +
  "technicalSkills (expertise beyond tools: system design, architecture, data engineering, etc.), " +
  "otherSkills (non-technical: communication, leadership, collaboration), " +
  "requiredSkills (explicitly required), niceToHave (preferred/beneficial). " +
  "Reply with ONLY a JSON object, no prose.";

/** Build the user message for skill extraction from a job description. */
export function buildSkillExtractionUserMessage(jobDescription: string): string {
  return `Classify the skills in this job description into the five buckets.\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}`;
}

/** Defensive normalization of an arbitrary parsed JSON value → SkillBuckets. */
export function normalizeSkillBuckets(value: unknown): SkillBuckets | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const arr = (...keys: string[]): string[] => {
    for (const key of keys) {
      const x = v[key];
      if (Array.isArray(x)) return x.map((s) => String(s).trim()).filter(Boolean);
      if (typeof x === "string") return x.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };
  const buckets: SkillBuckets = {
    techStack: arr("techStack", "tech_stack"),
    technicalSkills: arr("technicalSkills", "technical_skills"),
    otherSkills: arr("otherSkills", "other_skills"),
    requiredSkills: arr("requiredSkills", "required_skills"),
    niceToHave: arr("niceToHave", "nice_to_have"),
  };
  const any = Object.values(buckets).some((a) => a.length > 0);
  return any ? buckets : undefined;
}

export type SkillExtractionResult = { ok: true; buckets: SkillBuckets } | { ok: false; error: string };

/**
 * Run structured skill extraction through any LLMClient. Uses plain JSON-mode
 * generation when available and a resilient JSON parse otherwise — no
 * structured-output requirement (some local/OpenAI-compatible models lack it).
 */
export async function extractSkillsStructured(
  llm: { isAvailable(): boolean; complete(messages: Array<{ role: string; content: string }>, opts?: { responseFormat?: { type: "json_object" }; maxTokens?: number; temperature?: number }): Promise<string> },
  jobDescription: string
): Promise<SkillExtractionResult> {
  if (!llm || !llm.isAvailable()) return { ok: false, error: "LLM unavailable" };
  if (!jobDescription || !jobDescription.trim()) return { ok: false, error: "Empty job description" };
  try {
    const out = await llm.complete(
      [
        { role: "system", content: SKILL_EXTRACTION_SYSTEM },
        { role: "user", content: buildSkillExtractionUserMessage(jobDescription) },
      ],
      { responseFormat: { type: "json_object" }, maxTokens: 1200, temperature: 0 }
    );
    const parsed = parseModelJson(out);
    const buckets = normalizeSkillBuckets(parsed);
    if (buckets) return { ok: true, buckets };
    return { ok: false, error: "Could not parse structured skill extraction response" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Estimate a call's USD cost, preferring a provider-reported cost. */
export function estimateCallCostUsd(args: {
  reportedCostUsd?: number;
  inputTokens: number;
  outputTokens: number;
  inputPerMillionUsd?: number;
  outputPerMillionUsd?: number;
}): { costUsd: number; source: "reported" | "estimated" | "zero" } {
  if (typeof args.reportedCostUsd === "number" && Number.isFinite(args.reportedCostUsd) && args.reportedCostUsd > 0) {
    return { costUsd: args.reportedCostUsd, source: "reported" };
  }
  const i = args.inputPerMillionUsd ?? 0;
  const o = args.outputPerMillionUsd ?? 0;
  const cost = (i / 1_000_000) * args.inputTokens + (o / 1_000_000) * args.outputTokens;
  if (cost <= 0) return { costUsd: 0, source: "zero" };
  return { costUsd: cost, source: "estimated" };
}
