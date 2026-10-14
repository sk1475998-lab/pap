/**
 * The server's one way to get an LLM client.
 *
 * Five routes each built their own, from settings fields that do not exist:
 *
 *   createLLM({ provider: settings.aiProvider ?? "ollama",
 *               model:    settings.aiModel    ?? "llama3.2",
 *               apiKey:   settings.aiApiKey   ?? "" })
 *
 * `AgentSettings` has no `aiProvider`, `aiModel` or `aiApiKey` — `normalizeAgentSettings`
 * strips them — so all five expressions evaluated to Ollama on localhost with no
 * key. On any hosted deployment that is a `NullClient`, and every AI feature in the
 * product silently returned its non-AI fallback while the UI kept offering "✨ AI"
 * buttons. `getLLM()` reads the real `llmConfig` record instead.
 */
import { createLLM, readLLMConfig, type LLMClient, type StoredLLMConfig } from "@superjob/core";

export interface ServerLLM {
  client: LLMClient;
  config: StoredLLMConfig;
  /** False when the provider is "none" or a required key is missing. */
  available: boolean;
  /** The user's stored temperature, to pass as `CompleteOptions.temperature`. */
  temperature: number;
}

/**
 * Build a client for the current tenant.
 *
 * Per-request, deliberately: the config is per-tenant (AsyncLocalStorage decides
 * whose store is read) and the user can change it between two requests. Caching it
 * process-wide is how one account ends up spending another's API quota.
 */
export async function getLLM(): Promise<ServerLLM> {
  const config = await readLLMConfig();
  const client = createLLM(config);
  return {
    client,
    config,
    // `isAvailable()` is the adapter's own answer (NullClient says no, and the
    // keyed adapters say no without a key), so this needs no second rule.
    available: client.isAvailable(),
    temperature: config.temperature,
  };
}
