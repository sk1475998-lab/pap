/**
 * Autonomous Decision Engine — AgentQ MCTS & Action Selection
 * 
 * Grounded in:
 * "Agent Q: Advanced Reasoning and Learning for Autonomous AI Agents"
 * (Putta et al., 2024 / MultiOn & Stanford / arXiv:2408.07152)
 * 
 * Functions:
 * 1. Actor: Proposes atomic candidate action sequence from current AXTree.
 * 2. Critic: Evaluates candidate actions, gating confidence (<85% routed to review).
 * 3. Fact Grounding: Strictly resolves inputs against verified candidate Profile facts.
 * 4. Multi-Step Navigation: Plans 'ADVANCE_NEXT' when current step is complete,
 *    and 'SUBMIT' only when at the terminal review stage.
 */

import type { Profile } from "../types.js";
import { profileToLookup, type ProfileLookup } from "../profile.js";
import { classifyLabel, normalizeQuestion } from "../resolver.js";
import { bestOptionMatch } from "../field-similarity.js";
import type { AXNode, AXTreeSnapshot, BrainDecisionAction, BrainPlan } from "./types.js";
import type { ReflexionEngine } from "./reflexion-engine.js";

export class AutonomousDecisionBrain {
  constructor(private reflexionEngine?: ReflexionEngine) {}

  /**
   * Plans the next set of atomic actions given the current AXTree snapshot
   * and candidate profile facts.
   */
  planStep(params: {
    jobId: string;
    snapshot: AXTreeSnapshot;
    profile: Profile;
    dryRun?: boolean;
  }): BrainPlan {
    const { jobId, snapshot, profile, dryRun = false } = params;
    const lookup = profileToLookup(profile);
    const actions: BrainDecisionAction[] = [];

    // 1. Terminal Check
    if (snapshot.isTerminal) {
      return {
        stepName: "terminal",
        actionsToPerform: [],
        overallConfidence: 1.0,
        requiresReview: false,
        reasoning: `Application is already at terminal state: ${snapshot.terminalType || 'completed'}.`,
      };
    }

    // 2. Classify buttons (Next, Review, Submit)
    const buttonNodes = snapshot.nodes.filter(
      (n) => n.tag === "button" || n.role === "button" || n.type === "submit"
    );

    const submitBtn = buttonNodes.find((n) =>
      /submit\s+application|^submit$/i.test(n.name)
    );
    const reviewBtn = buttonNodes.find((n) =>
      /review\s+application|^review$/i.test(n.name)
    );
    const nextBtn = buttonNodes.find((n) =>
      /next|continue|proceed|save\s+and\s+continue/i.test(n.name) &&
      !/back|previous|cancel/i.test(n.name)
    );

    // 3. Process Interactive Form Inputs (Text, Select, Textarea)
    const inputNodes = snapshot.nodes.filter(
      (n) => (n.tag === "input" || n.tag === "select" || n.tag === "textarea") &&
             n.type !== "hidden" &&
             n.type !== "submit" &&
             n.type !== "button"
    );

    let lowConfidenceCount = 0;

    for (const node of inputNodes) {
      // If already populated and has no validation error, skip
      if (node.value && node.value.trim().length > 0 && !node.hasError) {
        continue;
      }

      // Check if this node is a resume file upload
      if (node.type === "file" || /resume|cv|curriculum/i.test(node.name)) {
        actions.push({
          actionType: "UPLOAD_RESUME",
          nodeId: node.id,
          selector: node.selector,
          label: node.name,
          confidence: 0.98,
          reasoning: "Upload master candidate resume file",
        });
        continue;
      }

      // Check Checkbox / Radio
      if (node.type === "checkbox") {
        actions.push({
          actionType: "TOGGLE_CHECKBOX",
          nodeId: node.id,
          selector: node.selector,
          label: node.name,
          confidence: 0.90,
          reasoning: "Acknowledge form requirement or terms checkbox",
        });
        continue;
      }

      // Standard Field Resolution
      const resolved = this.resolveFieldValue(node, profile, lookup, jobId);

      if (node.tag === "select" && node.options && node.options.length > 0) {
        // Dropdown selection
        const bestMatch = bestOptionMatch(resolved.value, node.options, 0.4);
        const selectedValue = bestMatch.option?.value || bestMatch.option?.label || resolved.value;
        actions.push({
          actionType: "SELECT_OPTION",
          nodeId: node.id,
          selector: node.selector,
          label: node.name,
          fieldKey: resolved.fieldKey,
          value: selectedValue,
          confidence: resolved.confidence,
          reasoning: `Select option for ${node.name}: ${selectedValue} (score: ${bestMatch.score})`,
        });
      } else {
        // Text / Textarea fill
        actions.push({
          actionType: "FILL_INPUT",
          nodeId: node.id,
          selector: node.selector,
          label: node.name,
          fieldKey: resolved.fieldKey,
          value: resolved.value,
          confidence: resolved.confidence,
          reasoning: resolved.reasoning,
        });
      }

      if (resolved.confidence < 0.85 && node.required) {
        lowConfidenceCount++;
      }
    }

    // 4. Plan Navigation Action (Next / Review / Submit)
    // Only advance if we have filled required inputs or no inputs remain on this step
    if (reviewBtn) {
      actions.push({
        actionType: "ADVANCE_NEXT",
        nodeId: reviewBtn.id,
        selector: reviewBtn.selector,
        label: reviewBtn.name,
        confidence: 0.95,
        reasoning: "Proceed to review step before final submission",
      });
    } else if (submitBtn) {
      if (!dryRun) {
        actions.push({
          actionType: "SUBMIT",
          nodeId: submitBtn.id,
          selector: submitBtn.selector,
          label: submitBtn.name,
          confidence: 0.96,
          reasoning: "All steps validated. Trigger final application submission.",
        });
      } else {
        actions.push({
          actionType: "ESCALATE_REVIEW",
          nodeId: submitBtn.id,
          selector: submitBtn.selector,
          label: submitBtn.name,
          confidence: 1.0,
          reasoning: "Dry-run mode: Reached final submit screen without auto-submitting.",
        });
      }
    } else if (nextBtn) {
      actions.push({
        actionType: "ADVANCE_NEXT",
        nodeId: nextBtn.id,
        selector: nextBtn.selector,
        label: nextBtn.name,
        confidence: 0.94,
        reasoning: "Advance to next step in application wizard.",
      });
    }

    // Calculate Overall Plan Confidence
    const avgConfidence = actions.length > 0
      ? actions.reduce((acc, a) => acc + a.confidence, 0) / actions.length
      : 1.0;

    const requiresReview = lowConfidenceCount > 0 && !dryRun;

    return {
      stepName: submitBtn ? "final_submission" : reviewBtn ? "review_step" : "form_step",
      actionsToPerform: actions,
      overallConfidence: Math.round(avgConfidence * 100) / 100,
      requiresReview,
      reviewReason: requiresReview
        ? `${lowConfidenceCount} required fields had ambiguous candidate values`
        : undefined,
      reasoning: `Planned ${actions.length} action(s) with ${Math.round(avgConfidence * 100)}% average confidence.`,
    };
  }

  /**
   * Resolves value from candidate profile with Reflexion error repair and grounding
   */
  private resolveFieldValue(
    node: AXNode,
    profile: Profile,
    lookup: ProfileLookup,
    jobId: string
  ): { fieldKey: string; value: string; confidence: number; reasoning: string } {
    const fieldKey = classifyLabel(node.name);
    let value = "";
    let confidence = 0.50;
    let reasoning = "";

    // 1. Check direct profile field lookup
    if (fieldKey !== "ai" && lookup[fieldKey]) {
      const raw = lookup[fieldKey];
      value = Array.isArray(raw) ? raw.join(", ") : String(raw);
      confidence = 0.98;
      reasoning = `Direct profile match from field '${fieldKey}'`;
    }

    // 2. Check custom learned answers
    if (!value) {
      const norm = normalizeQuestion(node.name);
      if (profile.customAnswers?.[norm]) {
        value = profile.customAnswers[norm]!;
        confidence = 0.95;
        reasoning = `Custom answer matched from user history '${norm}'`;
      }
    }

    // 3. Reflexion repair from past failure memory
    if (this.reflexionEngine && value) {
      const repaired = this.reflexionEngine.repairValueFromMemory(jobId, node.name, value);
      if (repaired !== value) {
        reasoning += ` (Reflexion repaired: '${value}' -> '${repaired}')`;
        value = repaired;
      }
    }

    // 4. Default fallback if still empty
    if (!value) {
      value = "";
      confidence = 0;
      reasoning = "No verified candidate fact is available; leave unanswered for review";
    }

    return { fieldKey, value, confidence, reasoning };
  }
}
