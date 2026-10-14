/**
 * Lightweight multi-agent framework.
 *
 * Inspired by CrewAI's role/goal/backstory model, but implemented natively in
 * TypeScript so it integrates with @superjob/core without a Python runtime.
 *
 * Design:
 *   - An Agent has a role, a goal, and an execute() method.
 *   - Agents communicate through a shared Blackboard (read context, write results).
 *   - A Crew runs agents sequentially (or in stages), passing the blackboard along.
 *   - Each agent can use tools (functions it's allowed to call) and the LLM.
 *
 * This is deliberately framework-free so the same agents run in the CLI,
 * in Docker, or embedded in the dashboard.
 */
import type { ChatMessage, Job, LLMConfig, Profile } from "@superjob/core";

/* ------------------------------------------------------------------ */
/* Blackboard — shared mutable context                                 */
/* ------------------------------------------------------------------ */

/** The shared workspace that all agents read from and write to. */
export interface Blackboard {
  profile: Profile;
  llmConfig: LLMConfig;
  searchParams: SearchRequest;
  // pipeline artifacts
  discovered: Job[];
  scored: ScoredJob[];
  tailored: TailoredArtifact[];
  applied: ApplyLogEntry[];
  // run metadata
  runId: string;
  startedAt: number;
  log: LogEntry[];
}

export interface SearchRequest {
  keywords: string;
  location: string;
  limit: number;
  minScore: number;
  dryRun: boolean;
  maxApplications: number;
  /** optional curated URLs (bypasses discovery) */
  urls?: string[];
}

export interface ScoredJob {
  job: Job;
  score: number;
  matched: string[];
  missing: string[];
  reasoning: string;
  recommendation: "apply" | "skip" | "review";
}

export interface TailoredArtifact {
  job: Job;
  score: number;
  coverLetter: string;
  resumeAdjustments: string[];
  source: "llm" | "template";
}

export interface ApplyLogEntry {
  job: Job;
  score: number;
  outcome: string;
  filledFields: number;
  error?: string;
  timestamp: number;
}

export interface LogEntry {
  agent: string;
  message: string;
  level: "info" | "warn" | "error";
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Agent interface                                                     */
/* ------------------------------------------------------------------ */

export interface AgentContext {
  blackboard: Blackboard;
  log: (message: string, level?: LogEntry["level"]) => void;
  /** call the LLM (resolves from blackboard.llmConfig) */
  think: (prompt: string, systemPrompt?: string) => Promise<string>;
}

export interface Agent {
  name: string;
  role: string;
  goal: string;
  backstory: string;
  /** Execute this agent's task. Returns a summary string. */
  execute(ctx: AgentContext): Promise<string>;
}

/* ------------------------------------------------------------------ */
/* Crew — orchestrator                                                 */
/* ------------------------------------------------------------------ */

export interface CrewResult {
  runId: string;
  summary: string;
  discovered: number;
  scored: number;
  tailored: number;
  applied: number;
  durationMs: number;
  log: LogEntry[];
  blackboard: Blackboard;
}

export interface CrewHooks {
  onAgentStart?: (agent: string) => void;
  onAgentDone?: (agent: string, summary: string) => void;
  onLog?: (entry: LogEntry) => void;
}

export class Crew {
  constructor(
    public readonly name: string,
    public readonly agents: Agent[],
    public readonly hooks: CrewHooks = {}
  ) {}

  async kickoff(
    initial: Omit<Blackboard, "runId" | "startedAt" | "log" | "discovered" | "scored" | "tailored" | "applied">,
    hooksOverride?: CrewHooks
  ): Promise<CrewResult> {
    const { createLLM } = await import("@superjob/core");

    const hooks = hooksOverride ?? this.hooks;

    const blackboard: Blackboard = {
      ...initial,
      discovered: [],
      scored: [],
      tailored: [],
      applied: [],
      runId: `run_${Date.now().toString(36)}`,
      startedAt: Date.now(),
      log: [],
    };

    const log = (message: string, level: LogEntry["level"] = "info") => {
      const entry: LogEntry = { agent: "", message, level, timestamp: Date.now() };
      blackboard.log.push(entry);
      hooks.onLog?.(entry);
    };

    const llm = createLLM(initial.llmConfig);
    const think = async (prompt: string, systemPrompt?: string): Promise<string> => {
      if (!llm.isAvailable()) return "";
      const messages: ChatMessage[] = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });
      try {
        return await llm.complete(messages, { temperature: 0.3, maxTokens: 1000 });
      } catch {
        return "";
      }
    };

    for (const agent of this.agents) {
      hooks.onAgentStart?.(agent.name);
      log(`▶ ${agent.name} starting: ${agent.goal}`);

      const ctx: AgentContext = {
        blackboard,
        log: (msg, level) => log(`[${agent.name}] ${msg}`, level),
        think,
      };

      try {
        const summary = await agent.execute(ctx);
        hooks.onAgentDone?.(agent.name, summary);
        log(`✔ ${agent.name} done: ${summary}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`✗ ${agent.name} failed: ${msg}`, "error");
      }
    }

    const durationMs = Date.now() - blackboard.startedAt;
    const summary =
      `Crew "${this.name}" completed in ${(durationMs / 1000).toFixed(1)}s — ` +
      `${blackboard.discovered.length} discovered, ${blackboard.scored.length} scored, ` +
      `${blackboard.tailored.length} tailored, ${blackboard.applied.length} applied.`;

    return {
      runId: blackboard.runId,
      summary,
      discovered: blackboard.discovered.length,
      scored: blackboard.scored.length,
      tailored: blackboard.tailored.length,
      applied: blackboard.applied.length,
      durationMs,
      log: blackboard.log,
      blackboard,
    };
  }
}
