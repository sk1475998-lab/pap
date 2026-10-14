/**
 * SOP — Standard Operating Procedure Artifacts
 *
 * Adopted from: MetaGPT (Hong et al., 2023) — "Meta Programming for Multi-Agent
 * Collaboration". 85.9% Pass@1 HumanEval. Core insight: typed intermediate
 * artifacts between agents prevent hallucination compounding — each agent
 * receives a structured contract, not a free-form string.
 *
 * Every agent in the pipeline WRITES a typed SOP artifact to the blackboard and
 * READ from its upstream artifact. No raw string passing.
 *
 * Paper-to-code mapping:
 *   Resume Extractor      → ScoutAgent  writes JobDiscoveryArtifact
 *   Resume Evaluator(RAG) → MatchAgent  writes MatchArtifact
 *   Summarizer            → TailorAgent writes TailoringArtifact
 *   Score Formatter       → ReviewAgent writes ReviewArtifact
 */

/* ------------------------------------------------------------------ */
/* ReAct trace — adopted from ReAct (Yao et al., ICLR 2023)           */
/* Thought → Action → Observation loop attached to every artifact.     */
/* ------------------------------------------------------------------ */
export interface ReActTrace {
  step: number;
  thought: string;
  action: string;
  observation: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Scout: Job Discovery                                                  */
/* ------------------------------------------------------------------ */
export interface JobDiscoveryArtifact {
  jobs: DiscoveredJob[];
  sources: DiscoverySource[];
  searchParams: DiscoverySearchParams;
  discoveredAt: number;
  durationMs: number;
  scoutTrace: ReActTrace[];
}

export interface DiscoveredJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  remote: boolean;
  source: string;
  easyApply: boolean;
  postedAt?: number;
  savedAt: number;
}

export interface DiscoverySource {
  name: "linkedin" | "indeed" | "naukri" | "internshala" | "remoteok" | "arbeitnow" | "company-page";
  url?: string;
  jobsFound: number;
}

export interface DiscoverySearchParams {
  keywords: string;
  location: string;
  limit: number;
  minScore: number;
  experienceLevel?: string;
}

/* ------------------------------------------------------------------ */
/* Match: RAG-powered Scoring (arXiv:2504.02870)                        */
/* ------------------------------------------------------------------ */
export interface MatchArtifact {
  scoredJobs: ScoredJobArtifact[];
  topK: ScoredJobArtifact[];
  skipped: number;
  matchTrace: ReActTrace[];
  ragContextUsed: boolean;
}

export interface ScoredJobArtifact {
  job: DiscoveredJob;
  score: number;                          // 0–100
  matchedSkills: string[];
  missingSkills: string[];
  inferredSkills: string[];               // implied by experience
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendation: "APPLY" | "REVIEW" | "SKIP";
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/* Tailor: Resume + Cover Letter per Job                                */
/* ------------------------------------------------------------------ */
export interface TailoringArtifact {
  jobId: string;
  job: DiscoveredJob;
  tailoredResumeText: string;
  coverLetter: string;
  keywordsAdded: string[];
  keywordsRemoved: string[];              // never remove true facts
  atsScoreBefore: number;
  atsScoreAfter: number;
  confidence: number;                     // 0–100; <70 → review queue
  source: "llm" | "template";
  tailorTrace: ReActTrace[];
}

/* ------------------------------------------------------------------ */
/* Apply: Form-fill + submit result                                      */
/* ------------------------------------------------------------------ */
export interface ApplicationArtifact {
  jobId: string;
  job: DiscoveredJob;
  tailoring: TailoringArtifact;
  fieldsAttempted: number;
  fieldsFilled: number;
  fieldsSkipped: string[];                // field labels with low confidence
  confidencePerField: Record<string, number>;
  screenshotPath?: string;               // base64 PNG evidence
  formSignature: string;                 // for Recon-Act tool archive
  outcome: "applied" | "review" | "failed" | "preview";
  failureReason?: string;
  retries: number;                        // Reflexion retry counter
  applyTrace: ReActTrace[];
}

/* ------------------------------------------------------------------ */
/* Review: HITL Evidence Pack (Tiered Approval, 2025)                   */
/* ------------------------------------------------------------------ */
export type RiskTier = "AUTO_SUBMIT" | "HUMAN_REVIEW" | "REJECT";

export interface EvidencePack {
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  confidence: number;
  tier: RiskTier;
  filledFields: number;
  totalFields: number;
  lowConfidenceFields: string[];
  tailoredResume: string;
  coverLetter: string;
  screenshotBase64?: string;
  reasoning: ReActTrace[];
  createdAt: number;
  ttl: number;                            // auto-expire after 24h
  idempotencyKey: string;                 // prevent duplicate submissions
  decision?: "approved" | "rejected" | "pending";
  decidedAt?: number;
  reviewType?: "application" | "otp" | "captcha" | "question";
  otpLength?: number;
  captchaType?: string;
  tabId?: number;
  jobUrl?: string;
  promptQuestion?: string;
}

/* ------------------------------------------------------------------ */
/* Fleet: multi-job run report                                           */
/* ------------------------------------------------------------------ */
export interface FleetRunSummary {
  runId: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  totalJobs: number;
  autoSubmitted: number;
  humanQueued: number;
  rejected: number;
  healed: number;                         // Reflexion recovered failures
  failed: number;
  peakConcurrency: number;
  evidencePacks: EvidencePack[];
  scoutArtifact: JobDiscoveryArtifact;
  matchArtifact: MatchArtifact;
}

/* ------------------------------------------------------------------ */
/* Blackboard v2 — SOP-enhanced shared context                          */
/* ------------------------------------------------------------------ */
export interface SOPBlackboard {
  // legacy compat
  discovered: DiscoveredJob[];
  scored: ScoredJobArtifact[];
  tailored: TailoringArtifact[];
  applied: ApplicationArtifact[];
  reviewQueue: EvidencePack[];

  // SOP artifacts (structured)
  discoveryArtifact?: JobDiscoveryArtifact;
  matchArtifact?: MatchArtifact;

  // Recon-Act tool archive: formSig → filling strategy
  toolArchive: Map<string, FormFillingStrategy>;

  // Reflexion memory: jobId → past failure reflections
  reflexionMemory: Map<string, string[]>;

  // Fleet run summary (filled after completion)
  fleetSummary?: FleetRunSummary;
}

/* ------------------------------------------------------------------ */
/* Recon-Act: Form filling strategy                                      */
/* ------------------------------------------------------------------ */
export interface FormField {
  label: string;
  type: "text" | "select" | "radio" | "checkbox" | "textarea" | "file" | "tel" | "email" | "number" | "date";
  required: boolean;
  selector: string;
  options?: string[];                     // for select/radio
  value?: string;                         // resolved value to fill
  confidence: number;                     // 0–100
}

export interface FormFillingStrategy {
  formSignature: string;
  atsName: string;                        // "linkedin-easy-apply" | "workday" | "greenhouse" | ...
  fields: FormField[];
  successCount: number;
  failureCount: number;
  lastUsed: number;
  version: number;
}

/* ------------------------------------------------------------------ */
/* Actor-Critic from AgentQ (Putta et al., 2024)                        */
/* 3 candidate trajectories → critic selects the best                   */
/* ------------------------------------------------------------------ */
export interface CandidateAction {
  id: number;
  description: string;
  actionsToPerform: BrowserAction[];
  reasoning: string;
}

export interface BrowserAction {
  type: "CLICK" | "TYPE" | "GOTO_URL" | "SCROLL" | "SELECT" | "ENTER_AND_CLICK" | "WAIT";
  selector?: string;
  value?: string;
  url?: string;
}

export interface ActorOutput {
  thought: string;
  proposedActions: CandidateAction[];   // 3 candidates
  isComplete: boolean;
  finalResponse?: string;
}

export interface CriticOutput {
  thought: string;
  selectedActionId: number;
  selectedAction: CandidateAction;
  confidence: number;
}
