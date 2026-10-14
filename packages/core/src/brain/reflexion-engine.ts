/**
 * Reflexion Engine — Verbal Reinforcement & Episodic Error Recovery
 * 
 * Grounded in:
 * "Reflexion: Language Agents with Verbal Reinforcement Learning"
 * (Shinn et al., NeurIPS 2023 / noahshinn/reflexion)
 * 
 * When a form action fails or triggers a validation error:
 * 1. Formulates a verbal self-reflection identifying the exact mistake.
 * 2. Stores the reflection in episodic memory (up to last 3 reflections per job).
 * 3. Proposes an explicit, transformed action on retry to avoid repeating the mistake.
 */

import type { LLMClient } from "../llm/types.js";
import type { BrainDecisionAction, ReflexionEpisode } from "./types.js";

const REFLEXION_FEW_SHOT_PROMPT = `
You are an expert failure recovery specialist operating on web form validation errors.
You will be given the history of a failed interaction where an application form rejected a field or failed to advance.
Think about why the failure occurred and devise a concise, new plan of action that accounts for the mistake.

Example 1:
Failed Action: Fill field "Phone Number" with "+91 9182805541"
Observed Error: "Please enter a valid 10-digit phone number without country code."
Reflection: The form explicitly forbids the country code (+91) and only accepts 10 digits.
Corrective Plan: Strip the '+91 ' prefix and input only '9182805541'.

Example 2:
Failed Action: Upload resume file "resume.docx"
Observed Error: "Invalid file type. Only PDF files are accepted."
Reflection: The ATS upload input is strictly configured for .pdf format and rejected .docx.
Corrective Plan: Convert resume to PDF or use the cached PDF version before attempting upload.

Example 3:
Failed Action: Fill "Current Notice Period" with "2 months"
Observed Error: "Please select an option from the list: [Immediate, 15 Days, 30 Days, 60 Days, 90 Days]"
Reflection: The field expects a standardized option matching one of the dropdown values, not arbitrary freeform text.
Corrective Plan: Map '2 months' to the closest dropdown option '60 Days'.
`.trim();

export class ReflexionEngine {
  private memory = new Map<string, ReflexionEpisode[]>();
  private readonly maxEpisodesPerJob = 3;

  constructor() {}

  /**
   * Retrieves past reflection episodes for a specific job application
   */
  getPastEpisodes(jobId: string): ReflexionEpisode[] {
    return this.memory.get(jobId) ?? [];
  }

  /**
   * Records a failure, verbalizes self-reflection via LLM or rule-based heuristics,
   * and saves the corrective plan to episodic memory.
   */
  async recordFailureAndReflect(params: {
    jobId: string;
    stepName: string;
    failedAction: BrainDecisionAction;
    observedError: string;
    llm?: LLMClient;
  }): Promise<ReflexionEpisode> {
    const { jobId, stepName, failedAction, observedError, llm } = params;
    const pastEpisodes = this.getPastEpisodes(jobId);
    const attemptNumber = pastEpisodes.length + 1;

    let reflection = "";
    let correctivePlan = "";

    // 1. Check if LLM can generate reflection
    if (llm && llm.isAvailable()) {
      try {
        const query = this.buildPrompt(failedAction, observedError, pastEpisodes);
        const res = await llm.complete(
          [
            { role: "system", content: REFLEXION_FEW_SHOT_PROMPT },
            { role: "user", content: query },
          ],
          { temperature: 0.1, maxTokens: 250 }
        );

        const parsed = parseReflectionResponse(res);
        reflection = parsed.reflection;
        correctivePlan = parsed.correctivePlan;
      } catch {
        /* fallback to rule-based */
      }
    }

    // 2. Rule-based heuristic fallback if LLM offline or parse failed
    if (!reflection || !correctivePlan) {
      const fallback = generateHeuristicReflection(failedAction, observedError);
      reflection = fallback.reflection;
      correctivePlan = fallback.correctivePlan;
    }

    const episode: ReflexionEpisode = {
      jobId,
      stepName,
      attemptNumber,
      failedAction,
      observedError,
      reflection,
      correctivePlan,
      timestamp: Date.now(),
    };

    const updated = [...pastEpisodes, episode].slice(-this.maxEpisodesPerJob);
    this.memory.set(jobId, updated);

    return episode;
  }

  /**
   * Transforms an input value according to past reflections to prevent repeating errors.
   *
   * FIX: This now reads the LLM-generated `correctivePlan` from each stored
   * episode and attempts to extract a concrete repair instruction from it.
   * Previously only 2 hardcoded phone/digit regexes ran here; the LLM output
   * was completely discarded for every other field type, causing an infinite
   * failure loop on date formats, dropdowns, work-authorization fields, etc.
   */
  repairValueFromMemory(jobId: string, label: string, currentValue: string): string {
    const episodes = this.getPastEpisodes(jobId);
    let repaired = currentValue;

    for (const ep of episodes) {
      if (ep.failedAction.label.toLowerCase() !== label.toLowerCase()) continue;

      const err = ep.observedError.toLowerCase();
      const plan = ep.correctivePlan.toLowerCase();

      // ----------------------------------------------------------------
      // 1. Phone format: strip country code / non-digits to 10 digits
      // ----------------------------------------------------------------
      if (/phone|mobile/i.test(label) && (/10.?digit|country.?code/i.test(err) || /strip|country code|digits only/i.test(plan))) {
        repaired = repaired.replace(/\D/g, "").slice(-10);
        continue;
      }

      // ----------------------------------------------------------------
      // 2. Numeric only
      // ----------------------------------------------------------------
      if (/numeric|number|digit/i.test(err) || /numeric|digits only|numbers only/i.test(plan)) {
        repaired = repaired.replace(/[^\d.]/g, "");
        continue;
      }

      // ----------------------------------------------------------------
      // 3. Plan mentions a concrete replacement value (e.g. "enter '60 Days'")
      //    Extract the quoted string if present.
      // ----------------------------------------------------------------
      const quotedValueMatch = ep.correctivePlan.match(/[`"'\u2018\u2019\u201c\u201d]([^`"'\u2018\u2019\u201c\u201d]{1,80})[`"'\u2018\u2019\u201c\u201d]/);
      if (quotedValueMatch?.[1]) {
        const candidate = quotedValueMatch[1].trim();
        // Only use if non-trivially different from the failed value
        if (candidate.toLowerCase() !== currentValue.toLowerCase() && candidate.length > 0) {
          repaired = candidate;
          continue;
        }
      }

      // ----------------------------------------------------------------
      // 4. Date format normalization: plan mentions a specific format
      // ----------------------------------------------------------------
      if (/date|mm.dd|dd.mm|yyyy/i.test(err) || /date format|reformat.*date/i.test(plan)) {
        // Try to parse the date and re-emit in MM/DD/YYYY format
        const parsed = Date.parse(repaired);
        if (!isNaN(parsed)) {
          const d = new Date(parsed);
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const yyyy = d.getFullYear();
          if (/dd.mm/i.test(plan)) {
            repaired = `${dd}/${mm}/${yyyy}`;
          } else {
            repaired = `${mm}/${dd}/${yyyy}`;
          }
          continue;
        }
      }

      // ----------------------------------------------------------------
      // 5. Plan mentions clearing / leaving the field for user
      // ----------------------------------------------------------------
      if (/leave (the field )?(blank|empty)|clear the field|skip/i.test(plan)) {
        repaired = "";
        continue;
      }

      // ----------------------------------------------------------------
      // 6. Plan mentions truncation ("enter only the first N characters")
      // ----------------------------------------------------------------
      const truncMatch = ep.correctivePlan.match(/first\s+(\d+)\s+char/i);
      if (truncMatch?.[1]) {
        const limit = parseInt(truncMatch[1], 10);
        if (!isNaN(limit) && limit > 0 && repaired.length > limit) {
          repaired = repaired.slice(0, limit);
          continue;
        }
      }

      // ----------------------------------------------------------------
      // 7. No actionable repair derived — return the value unchanged.
      //    At minimum we avoid re-entering the same bad value for fields
      //    where the plan only gives context (the caller can read
      //    ep.correctivePlan to decide whether to skip the field).
      // ----------------------------------------------------------------
    }

    return repaired;
  }

  /**
   * Clears memory for a completed or abandoned job
   */
  clearJob(jobId: string): void {
    this.memory.delete(jobId);
  }

  private buildPrompt(
    failedAction: BrainDecisionAction,
    observedError: string,
    pastEpisodes: ReflexionEpisode[]
  ): string {
    const lines: string[] = [];
    lines.push(`Failed Action: ${failedAction.actionType} on "${failedAction.label}" with value "${failedAction.value || ''}"`);
    lines.push(`Observed Error: "${observedError}"`);

    if (pastEpisodes.length > 0) {
      lines.push(`\nPlans from past attempts:`);
      pastEpisodes.forEach((ep, idx) => {
        lines.push(`Trial #${idx + 1}: ${ep.correctivePlan}`);
      });
    }

    lines.push(`\nRespond in this format:`);
    lines.push(`Reflection: <What went wrong>`);
    lines.push(`Corrective Plan: <Actionable fix for next retry>`);

    return lines.join("\n");
  }
}

export const defaultReflexionEngine = new ReflexionEngine();

function parseReflectionResponse(res: string): { reflection: string; correctivePlan: string } {
  let reflection = "";
  let correctivePlan = "";

  const refMatch = res.match(/Reflection:\s*([^\n]+)/i);
  const planMatch = res.match(/Corrective Plan:\s*([^\n]+)/i);

  if (refMatch?.[1]) reflection = refMatch[1].trim();
  if (planMatch?.[1]) correctivePlan = planMatch[1].trim();

  return { reflection, correctivePlan };
}

function generateHeuristicReflection(
  failedAction: BrainDecisionAction,
  observedError: string
): { reflection: string; correctivePlan: string } {
  const err = observedError.toLowerCase();
  const label = failedAction.label.toLowerCase();

  if (/phone|mobile/i.test(label) && /digit|format|country/i.test(err)) {
    return {
      reflection: "The phone input rejected international prefix formatting.",
      correctivePlan: "Strip country code and special characters, leaving 10 clean digits.",
    };
  }

  if (/required|empty|mandatory/i.test(err)) {
    return {
      reflection: "A required form element was left unpopulated.",
      correctivePlan: "Populate with default profile fact or highest-confidence answer.",
    };
  }

  return {
    reflection: `Action on "${failedAction.label}" triggered validation error: ${observedError}`,
    correctivePlan: "Verify field constraints and reformat value to match expected pattern.",
  };
}
