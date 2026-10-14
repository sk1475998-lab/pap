import type { ChatMessage, LLMConfig, LLMProvider } from "../types.js";

/**
 * Unified chat-completion interface used everywhere in the agent.
 * Every provider adapter implements this. The default config points at a
 * local Ollama server (http://localhost:11434) so the agent works at zero
 * cost and with minimal latency out of the box.
 */
export interface LLMClient {
  readonly config: LLMConfig;
  isAvailable(): boolean;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
  /** Streaming generator yielding incremental text chunks. */
  stream?(messages: ChatMessage[], opts?: CompleteOptions): AsyncIterable<string>;
}

export interface CompleteOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  responseFormat?: { type: "json_object" };
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "openrouter",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  apiKey: "",
  baseUrl: "https://openrouter.ai/api/v1",
};

/**
 * The model each provider gets when the user has not named one.
 *
 * This map is the single source of those defaults. `createLLM` used to inline
 * them as `config.model || "gpt-4o-mini"` in each switch arm, so a settings UI
 * had no way to show which model would actually be used — it could only leave the
 * field blank and hope. Now both the client factory and the settings surfaces read
 * the same table.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<LLMProvider, string> = {
  ollama: "llama3.1",
  openai: "gpt-4o-mini",
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-latest",
  none: "",
};

/**
 * Where each provider's OpenAI-compatible endpoint lives. Fixed for the hosted
 * providers; `ollama` and `openai` accept an override so a self-hosted or proxied
 * deployment can point somewhere else.
 */
export const DEFAULT_BASE_URL_BY_PROVIDER: Record<LLMProvider, string> = {
  ollama: "http://localhost:11434",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  anthropic: "",
  none: "",
};

/** Providers that cannot do anything without a key. Ollama runs locally; none is a no-op. */
export const PROVIDERS_REQUIRING_KEY: readonly LLMProvider[] = [
  "openai",
  "openrouter",
  "gemini",
  "anthropic",
];
