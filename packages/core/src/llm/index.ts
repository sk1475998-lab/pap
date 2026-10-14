import type { LLMConfig } from "../types.js";
import {
  AnthropicClient,
  GeminiClient,
  NullClient,
  OllamaClient,
  OpenAICompatibleClient,
} from "./adapters.js";
import { wrapCachedLLM, type CachedLLMOptions } from "./cached-client.js";
import {
  DEFAULT_BASE_URL_BY_PROVIDER,
  DEFAULT_MODEL_BY_PROVIDER,
} from "./types.js";
import { isSensitiveQuestion, smartDefaultForQuestion } from "../resolver.js";
import { snapAnswerToOptions } from "./robust.js";

export type { LLMClient, CompleteOptions } from "./types.js";
export {
  DEFAULT_LLM_CONFIG,
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_BASE_URL_BY_PROVIDER,
  PROVIDERS_REQUIRING_KEY,
} from "./types.js";
export { MemoryLLMCache, chromeStorageLLMCache, hashMessages } from "./cache.js";
export { LLMRateLimiter } from "./rate-limiter.js";
export { wrapCachedLLM, CachedLLMClient } from "./cached-client.js";

// Cost-aware routing (cloud-first, no offline models)
export {
  CostRouter,
  createCostRouter,
  type ComplexityTier,
  type CostRouterConfig,
  type RoutingDecision,
  type ProviderPricing,
} from "./cost-router.js";

// LLM robustness toolkit (Adaptation 10 — deterministic option snapping,
// model-JSON parsing, structured skill extraction, call-cost estimation).
export {
  parseModelJson,
  snapAnswerToOptions,
  type OptionLikeValue,
  SKILL_EXTRACTION_SYSTEM,
  buildSkillExtractionUserMessage,
  normalizeSkillBuckets,
  type SkillBuckets,
  type SkillExtractionResult,
  extractSkillsStructured,
  estimateCallCostUsd,
} from "./robust.js";

// Gap 3.2 Fix — LLM failover cascade + zero-cost deterministic gate
export {
  FailoverLLMClient,
  createFailoverLLM,
  shouldUseLLMForQuestion,
} from "./failover.js";


/**
 * Build the right client for a config. Unknown/missing API keys gracefully
 * fall back to NullClient so features degrade instead of crashing.
 */
export function createLLM(
  config: LLMConfig,
  cacheOpts?: CachedLLMOptions
): import("./types.js").LLMClient {
  const inner = createRawLLM(config);
  if (cacheOpts === null) return inner;
  return wrapCachedLLM(inner, cacheOpts);
}

function createRawLLM(config: LLMConfig): import("./types.js").LLMClient {
  // One table for every provider's default model (see `llm/types.ts`). These used
  // to be inline string literals here, invisible to the settings UI.
  const model = config.model || DEFAULT_MODEL_BY_PROVIDER[config.provider] || "";
  switch (config.provider) {
    case "ollama":
      return new OllamaClient({
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URL_BY_PROVIDER.ollama,
        model,
      });
    case "openai":
      return new OpenAICompatibleClient({
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URL_BY_PROVIDER.openai,
        apiKey: config.apiKey ?? "",
        model,
        provider: "openai",
      });
    case "openrouter":
      return new OpenAICompatibleClient({
        baseUrl: DEFAULT_BASE_URL_BY_PROVIDER.openrouter,
        apiKey: config.apiKey ?? "",
        model,
        provider: "openrouter",
      });
    case "gemini":
      return new GeminiClient({
        apiKey: config.apiKey ?? "",
        model,
      });
    case "anthropic":
      return new AnthropicClient({
        apiKey: config.apiKey ?? "",
        model,
      });
    case "none":
    default:
      return new NullClient();
  }
}

/**
 * Answer an arbitrary application screening question using the candidate's
 * resume as grounded context. Falls back to a sensible default if no LLM.
 */
export async function answerQuestion(
  llm: import("./types.js").LLMClient,
  question: string,
  resumeText: string,
  optionsOrDefAnswer?: (string | { value?: string; label?: string })[] | string,
  fieldType?: string,
  defaultAnswer?: string
): Promise<string> {
  if (isSensitiveQuestion(question)) return "";

  let options: Array<{ value: string; label: string }> | undefined;
  let fallback = defaultAnswer ?? smartDefaultForQuestion(question) ?? "";

  if (typeof optionsOrDefAnswer === "string") {
    fallback = optionsOrDefAnswer;
  } else if (Array.isArray(optionsOrDefAnswer)) {
    options = optionsOrDefAnswer.map((o) => {
      if (typeof o === "string") return { value: o, label: o };
      const val = String(o?.value ?? o?.label ?? "");
      const lbl = String(o?.label ?? o?.value ?? "");
      return { value: val, label: lbl };
    });
  }

  if (!llm.isAvailable()) return fallback;

  let user = `QUESTION (from a job application form):
"${question}"\n`;

  if (fieldType) {
    user += `FIELD TYPE: ${fieldType}\n`;
  }
  if (options && options.length > 0) {
    user += `AVAILABLE OPTIONS (Choose ONLY one of the exact values below, preferably the option text or value itself):\n`;
    options.forEach(o => {
      user += `- Option Text: "${o.label}" (Option Value: "${o.value}")\n`;
    });
  }

  user += `\nCANDIDATE RESUME:
${resumeText.slice(0, 4000)}

Answer the question truthfully and concisely based ONLY on the resume.
- If it asks for years of experience, answer with a number.
- If it's yes/no, answer "Yes" or "No".
- If it asks for CTC/salary in India, answer in LPA if the resume mentions it.
- If it asks for notice period, answer in days/weeks if known.
- If it asks for a short explanation, write 1-2 sentences.
`;

  if (options && options.length > 0) {
    user += `- Choose the option from the AVAILABLE OPTIONS that best matches the candidate's profile. Return the exact "Option Value" or "Option Text" (exactly as written in the options list). If no option matches, select the most reasonable default option.\n`;
  }

  user += `- If the resume doesn't contain the answer${fallback ? `, answer "${fallback}"` : ", leave blank"}.
Answer with ONLY the answer (the selected option or text), no preamble.`;

  try {
    const out = await llm.complete(
      [
        { role: "system", content: "You fill out job application fields accurately for India and global roles." },
        { role: "user", content: user },
      ],
      { temperature: 0.2, maxTokens: 200 }
    );
    const trimmed = out.trim();
    if (!trimmed) return fallback;
    // Deterministic post-snap onto the allowed options (Adaptation 10): the
    // model is asked to return an option value/text, but a deterministic snap
    // (exact → case-insensitive → substring → fuzzy) guarantees the value is a
    // real option whenever one is close, mirroring the MIT reference pipeline.
    if (options && options.length > 0) {
      return snapAnswerToOptions(trimmed, options);
    }
    return trimmed;
  } catch {
    return fallback;
  }
}
