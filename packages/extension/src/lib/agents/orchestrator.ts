/**
 * Lightweight agent orchestrator — routes work without extra LLM calls.
 */
export interface AgentPlan {
  runForm: boolean;
  runResume: boolean;
  runNavigation: boolean;
  allowLlm: boolean;
  maxLlmCalls: number;
  reason: string;
}

export function planAutofillStep(ctx: {
  fieldCount: number;
  platformId?: string;
  phase?: string;
  maxLlmCallsPerRun?: number;
  autopilot?: boolean;
}): AgentPlan {
  const maxLlm = ctx.maxLlmCallsPerRun ?? 5;
  const blocked = ctx.phase === "AWAITING_OTP" || ctx.phase === "SUBMITTED";

  if (blocked) {
    return {
      runForm: false,
      runResume: false,
      runNavigation: false,
      allowLlm: false,
      maxLlmCalls: 0,
      reason: `blocked:${ctx.phase}`,
    };
  }

  const hugeForm = ctx.fieldCount > 60;
  return {
    runForm: true,
    runResume: ctx.fieldCount > 0,
    runNavigation: ctx.autopilot ?? false,
    allowLlm: !hugeForm,
    maxLlmCalls: hugeForm ? 0 : maxLlm,
    reason: hugeForm ? "huge-form-smart-defaults-only" : "standard",
  };
}

export type AgentRole = "planner" | "form" | "resume" | "qa" | "navigation" | "verification";

export function agentsForPlan(plan: AgentPlan): AgentRole[] {
  const roles: AgentRole[] = ["planner"];
  if (plan.runForm) roles.push("form");
  if (plan.runResume) roles.push("resume");
  roles.push("qa", "verification");
  if (plan.runNavigation) roles.push("navigation");
  return roles;
}
