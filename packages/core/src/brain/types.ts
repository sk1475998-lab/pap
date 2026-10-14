/**
 * Autonomous Decision Brain Types
 * 
 * Grounded in:
 * - Mind2Web & SeeAct (Pruned Accessibility Trees)
 * - AgentQ (Guided MCTS, Action Proposals & Confidence Gates)
 * - Reflexion (Verbal Reinforcement & Episodic Error Recovery)
 */

export interface AXNode {
  id: number;
  role: string;
  name: string;
  selector: string;
  tag: string;
  type?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  options?: { label: string; value: string }[];
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface AXTreeSnapshot {
  url: string;
  title: string;
  nodes: AXNode[];
  errorBanners: string[];
  fieldErrors: { selector: string; message: string }[];
  stepProgress?: { currentStep: number; totalSteps: number };
  isTerminal: boolean;
  terminalType?: "submitted" | "already_applied" | "daily_limit" | "blocked";
  timestamp: number;
}

export type BrainActionType =
  | "FILL_INPUT"
  | "SELECT_OPTION"
  | "TOGGLE_CHECKBOX"
  | "UPLOAD_RESUME"
  | "CLICK_ELEMENT"
  | "ADVANCE_NEXT"
  | "SUBMIT"
  | "AWAIT_OTP"
  | "ESCALATE_REVIEW";

export interface BrainDecisionAction {
  actionType: BrainActionType;
  nodeId?: number;
  selector: string;
  label: string;
  fieldKey?: string;
  value?: string;
  confidence: number;
  reasoning: string;
}

export interface BrainPlan {
  stepName: string;
  actionsToPerform: BrainDecisionAction[];
  overallConfidence: number;
  requiresReview: boolean;
  reviewReason?: string;
  reasoning: string;
}

export interface ReflexionEpisode {
  jobId: string;
  stepName: string;
  attemptNumber: number;
  failedAction: BrainDecisionAction;
  observedError: string;
  reflection: string;
  correctivePlan: string;
  timestamp: number;
}
