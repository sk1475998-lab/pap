/**
 * LLM Failover Cascade — Gap 3.2 Fix
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM: When `gemini-2.0-flash` exhausts its 15 RPM free-tier quota during
 * a bulk application session, every LLM call fails for the rest of the session.
 * The user gets zero tailoring and zero screening-question answers.
 *
 * SOLUTION: `FailoverLLMClient` wraps an ordered list of LLMClients. On any
 * error (rate-limit 429, quota 503, timeout), it automatically advances to the
 * next provider in the cascade. If all providers fail, it falls back to a
 * deterministic answer (empty string / caller-supplied default) so the job
 * application still proceeds.
 *
 * DEFAULT CASCADE ORDER (most economical → most capable):
 *   1. Gemini 2.0 Flash     (15 RPM free, lowest cost)
 *   2. Groq  / Llama-3.3-70B (free tier, very fast)
 *   3. OpenAI GPT-4o-mini   (paid, high quality, low cost)
 *   4. NullClient           (deterministic fallback, zero cost)
 *
 * Usage — drop-in replacement for createLLM():
 *   const llm = createFailoverLLM(config);
 *   // behaves identically to LLMClient
 *
 * Extension usage: the cascade is built inside the server and passed to
 * crew agents via the existing LLMClient interface — no agent code changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ChatMessage } from "../types.js";
import type { CompleteOptions, LLMClient } from "./types.js";
import { createLLM } from "./index.js";
import { NullClient } from "./adapters.js";
import type { LLMConfig } from "../types.js";

/** Errors that indicate a rate-limit or quota exhaustion — trigger failover. */
const FAILOVER_TRIGGERS = [
  429,   // Too Many Requests
  503,   // Service Unavailable (quota)
  529,   // Overloaded (Anthropic)
  "RATE_LIMIT",
  "QUOTA_EXCEEDED",
  "too many requests",
  "rate limit",
  "quota exceeded",
  "overloaded",
  "insufficient_quota",
];

function isFailoverError(e: unknown): boolean {
  if (!e) return false;
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return FAILOVER_TRIGGERS.some((t) =>
    typeof t === "number"
      ? msg.includes(String(t))
      : msg.includes(String(t).toLowerCase()),
  );
}

export class FailoverLLMClient implements LLMClient {
  readonly config: LLMConfig;
  private currentIndex = 0;
  private failoverLog: Array<{ provider: string; error: string; ts: number }> = [];

  constructor(private readonly clients: LLMClient[]) {
    if (!clients.length) clients.push(new NullClient());
    // Config reflects the primary (first) provider.
    this.config = clients[0].config;
  }

  isAvailable(): boolean {
    return this.clients.some((c) => c.isAvailable());
  }

  private get active(): LLMClient {
    return this.clients[this.currentIndex] ?? this.clients[this.clients.length - 1];
  }

  private advance(error: string): boolean {
    const fromProvider = this.active.config.provider;
    this.failoverLog.push({ provider: fromProvider, error, ts: Date.now() });
    if (this.currentIndex < this.clients.length - 1) {
      this.currentIndex++;
      console.warn(
        `[llm-failover] ${fromProvider} failed ("${error.slice(0, 80)}"). ` +
        `Advancing to ${this.active.config.provider}/${this.active.config.model}.`,
      );
      return true;
    }
    return false;
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    // Try each provider in order; fall back on rate-limit/quota errors.
    // On fatal errors (bad API key, malformed request) we do NOT failover
    // — those are programmer errors, not capacity issues.
    while (true) {
      if (!this.active.isAvailable()) {
        if (!this.advance("client not available")) break;
        continue;
      }
      try {
        return await this.active.complete(messages, opts);
      } catch (e: any) {
        if (isFailoverError(e)) {
          if (!this.advance(e?.message ?? String(e))) break;
          // brief delay before hitting the next provider
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        // Non-retriable error — propagate to caller.
        throw e;
      }
    }
    // All providers exhausted — return empty string as deterministic fallback.
    console.warn("[llm-failover] All providers exhausted. Using empty fallback.");
    return "";
  }

  async *stream(messages: ChatMessage[], opts: CompleteOptions = {}): AsyncIterable<string> {
    // Streaming: attempt the active provider; on failover, yield a single chunk
    // from complete() since stream position cannot be rewound.
    while (true) {
      if (!this.active.isAvailable()) {
        if (!this.advance("stream client not available")) break;
        continue;
      }
      if (this.active.stream) {
        try {
          yield* this.active.stream(messages, opts);
          return;
        } catch (e: any) {
          if (isFailoverError(e)) {
            if (!this.advance(e?.message ?? String(e))) break;
            continue;
          }
          throw e;
        }
      } else {
        // Provider doesn't support streaming — use complete() and yield the full result.
        const result = await this.complete(messages, opts);
        if (result) yield result;
        return;
      }
    }
  }

  /** Returns the failover audit log for observability. */
  getFailoverLog() {
    return [...this.failoverLog];
  }

  /** Reset the cascade back to the primary provider. Call after a quota window resets. */
  reset(): void {
    this.currentIndex = 0;
    this.failoverLog = [];
  }
}

/**
 * Build the default LLM failover cascade from environment variables.
 *
 * Cascade order (skips any provider whose API key is absent):
 *   1. Primary provider from config (gemini-2.0-flash by default)
 *   2. Groq / Llama-3.3-70B  (SUPERJOB_GROQ_API_KEY)
 *   3. OpenAI GPT-4o-mini     (SUPERJOB_OPENAI_API_KEY or OPENAI_API_KEY)
 *   4. NullClient             (always last — deterministic fallback)
 *
 * The result is a single `LLMClient` — callers need no cascade awareness.
 */
export function createFailoverLLM(
  primaryConfig: LLMConfig,
  cacheOpts?: Parameters<typeof createLLM>[1],
): LLMClient {
  const clients: LLMClient[] = [];

  // 1. Primary provider (from user settings)
  const primary = createLLM(primaryConfig, cacheOpts);
  if (primary.isAvailable()) clients.push(primary);

  // 2. Groq / Llama-3.3-70B (fast, free tier, good for form-fill classification)
  const groqKey = process.env.SUPERJOB_GROQ_API_KEY ?? process.env.GROQ_API_KEY;
  if (groqKey && primaryConfig.baseUrl !== "https://api.groq.com/openai/v1") {
    const groqClient = createLLM({
      provider: "openai", // Groq is OpenAI-compatible
      apiKey: groqKey,
      model: "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
    });
    if (groqClient.isAvailable()) clients.push(groqClient);
  }

  // 3. OpenAI GPT-4o-mini (reliable paid fallback)
  const openaiKey = process.env.SUPERJOB_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (openaiKey && primaryConfig.provider !== "openai") {
    const openaiClient = createLLM({
      provider: "openai",
      apiKey: openaiKey,
      model: "gpt-4o-mini",
    });
    if (openaiClient.isAvailable()) clients.push(openaiClient);
  }

  // 4. NullClient — deterministic resolver fallback (always included)
  clients.push(new NullClient());

  return new FailoverLLMClient(clients);
}

/**
 * Determine whether a question should be answered with the deterministic
 * resolver instead of consuming an LLM token. Routes classification and
 * factual profile lookups (salary, YOE, location) to the rule engine.
 * Only truly open-ended questions (cover letters, story banks, summaries)
 * need LLM credits.
 *
 * Gap 3.2 Fix: This is the Zero-LLM-Cost gate. Calling this before answerQuestion()
 * prevents burning quota on questions the resolver already handles perfectly.
 */
export function shouldUseLLMForQuestion(question: string, fieldType?: string): boolean {
  const q = question.toLowerCase();

  // The deterministic resolver handles all of these — no LLM credits needed.
  const deterministicPatterns = [
    /years.*(experience|exp)/,
    /notice.?period/,
    /current.*ctc|current.*salary|current.*compensation/,
    /expected.*ctc|expected.*salary|expected.*compensation/,
    /willing.*relocat/,
    /work.*authoriz|visa.*status|sponsorship/,
    /gender|pronouns/,
    /race|ethnicity|veteran|disability/,
    /highest.*qualif|education|degree/,
    /date.*birth|birthday/,
    /phone|email|address|city|state|zip|postal/,
    /linkedin|github|portfolio|website/,
  ];

  if (deterministicPatterns.some((p) => p.test(q))) return false;

  // Open-ended questions DO need LLM.
  const llmNeeded = [
    /describe|explain|tell.*about|why.*interested|motivat/,
    /cover.?letter|personal.?statement/,
    /strengths|weakness|challenge|achievement/,
    /project.*detail|contribution/,
  ];

  if (llmNeeded.some((p) => p.test(q))) return true;

  // Default: use LLM only for non-trivial field types.
  return fieldType === "textarea" || fieldType === "richtext";
}
