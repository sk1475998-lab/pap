import type { Profile } from "@superjob/core";

export interface IntelligenceSignal {
  kind: "risk" | "opportunity" | "info";
  message?: string;
}

export interface OpportunityRank {
  job: { id: string; title?: string; company?: string };
  overallScore: number;
  priority: "p0" | "p1" | "p2" | "skip";
  prediction: {
    duplicateRisk: number;
    bestApplyWindow: string;
    interviewProbability: number;
    atsPassProbability: number;
    recruiterResponseProbability: number;
  };
  signals: IntelligenceSignal[];
  match: {
    missing: string[];
  };
  recommendedActions: string[];
}

export type CareerAgentRole =
  | "career_strategist"
  | "ats_optimizer"
  | "resume_engineer"
  | "cover_letter_writer"
  | "referral_finder"
  | "company_researcher"
  | "application_tracker"
  | "opportunity_ranker"
  | "interview_coach"
  | "follow_up_agent"
  | "security_guardian";

export interface AgentTask {
  id: string;
  role: CareerAgentRole;
  priority: "critical" | "high" | "normal" | "low";
  title: string;
  reason: string;
  dependsOn?: string[];
  estimatedMinutes: number;
}

export interface CollaborativeCareerPlan {
  opportunityId: string;
  overallScore: number;
  decision: "apply_now" | "tailor_then_apply" | "research_first" | "skip";
  tasks: AgentTask[];
  narrative: string;
}

export function planCollaborativeAgents(profile: Profile, rank: OpportunityRank): CollaborativeCareerPlan {
  const tasks: AgentTask[] = [];
  const add = (task: Omit<AgentTask, "id">) => tasks.push({ id: `${task.role}:${tasks.length + 1}`, ...task });

  add({
    role: "security_guardian",
    priority: rank.prediction.duplicateRisk > 70 || rank.signals.some((s: IntelligenceSignal) => s.kind === "risk") ? "critical" : "normal",
    title: "Verify opportunity safety and duplicate status",
    reason: rank.prediction.duplicateRisk > 70 ? "A similar application already exists." : "Always review risk before sending personal data.",
    estimatedMinutes: 1,
  });

  add({
    role: "opportunity_ranker",
    priority: rank.priority === "p0" ? "critical" : rank.priority === "p1" ? "high" : "normal",
    title: "Prioritize application timing",
    reason: `Best window: ${rank.prediction.bestApplyWindow}; predicted interview probability ${rank.prediction.interviewProbability}%.`,
    dependsOn: [tasks[0]!.id],
    estimatedMinutes: 1,
  });

  if (rank.match.missing.length || rank.prediction.atsPassProbability < 75) {
    add({
      role: "ats_optimizer",
      priority: "high",
      title: "Close ATS keyword gaps",
      reason: `Missing: ${rank.match.missing.slice(0, 6).join(", ") || "low ATS pass estimate"}.`,
      dependsOn: [tasks[1]!.id],
      estimatedMinutes: 8,
    });
    add({
      role: "resume_engineer",
      priority: "high",
      title: "Select or tailor best resume version",
      reason: "Improve ATS pass probability before submitting.",
      dependsOn: [tasks[tasks.length - 1]!.id],
      estimatedMinutes: 10,
    });
  }

  if (rank.overallScore >= 65) {
    add({
      role: "company_researcher",
      priority: "normal",
      title: "Generate company context and culture notes",
      reason: "Better answers and follow-ups increase recruiter response probability.",
      estimatedMinutes: 5,
    });
    add({
      role: "cover_letter_writer",
      priority: "normal",
      title: "Draft role-specific outreach snippet",
      reason: "Use for optional cover-letter fields or recruiter messages.",
      dependsOn: [tasks[tasks.length - 1]!.id],
      estimatedMinutes: 4,
    });
  }

  if (rank.prediction.recruiterResponseProbability < 45 && rank.priority !== "skip") {
    add({
      role: "referral_finder",
      priority: "high",
      title: "Find referral or warm-contact path",
      reason: "Predicted recruiter response is low without networking support.",
      estimatedMinutes: 12,
    });
  }

  add({
    role: "application_tracker",
    priority: "normal",
    title: "Track submission and schedule follow-up",
    reason: "Close the loop with reminders and conversion analytics.",
    estimatedMinutes: 1,
  });

  if (rank.prediction.interviewProbability >= 55) {
    add({
      role: "interview_coach",
      priority: "normal",
      title: "Prepare likely interview stories",
      reason: "Opportunity has enough probability to justify proactive prep.",
      estimatedMinutes: 15,
    });
  }

  const decision = rank.priority === "skip" || rank.prediction.bestApplyWindow === "skip"
    ? "skip"
    : rank.prediction.bestApplyWindow === "wait_for_tailored_resume"
      ? "tailor_then_apply"
      : rank.signals.some((s: IntelligenceSignal) => s.kind === "risk")
        ? "research_first"
        : "apply_now";

  return {
    opportunityId: rank.job.id,
    overallScore: rank.overallScore,
    decision,
    tasks,
    narrative: `${profile.firstName || "Candidate"}, ${decision.replace(/_/g, " ")} for ${rank.job.title || "this role"} at ${rank.job.company || "the company"}. ${rank.recommendedActions[0] ?? "Proceed with the recommended workflow."}`,
  };
}
