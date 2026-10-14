/**
 * The user's model choice — read and written in exactly one place.
 *
 * WHY THIS FILE EXISTS
 *
 * `llmConfig` has been a canonical store key since sync was written (it is in
 * `STORE_KEYS`, and `buildSyncEnvelope` redacts its `apiKey` before transport).
 * But core shipped no accessor for it, so every surface invented its own:
 *
 *   packages/server/src/routes/chat.ts:36      provider: settings.aiProvider ?? "ollama"
 *   packages/server/src/routes/resume.ts:231     …same literal, cover letters
 *   packages/server/src/routes/resume.ts:286     …same literal, tailoring
 *   packages/server/src/routes/outreach.ts:37    …same literal
 *   packages/server/src/routes/interview.ts:69   …same literal
 *   packages/extension/src/lib/store.ts:34       its own copy again
 *   packages/extension/src/popup/api.ts:88       and again
 *
 * Every one of those read `aiProvider` / `aiModel` / `aiApiKey` off the AGENT
 * SETTINGS record — three fields `normalizeAgentSettings` deletes, because they
 * have never been part of `AgentSettings`. They were therefore always `undefined`,
 * so all five server routes silently ran on `ollama` + `llama3.2` with an empty
 * key: on a cloud host with no Ollama daemon that is a `NullClient`, which means
 * "AI cover letter", "AI tailoring", "Orion chat", "AI outreach" and "AI interview
 * questions" quietly degraded to templates no matter what the user configured.
 * The dashboard's own Settings page posted those same three dead keys.
 *
 * So: one record, one shape, one merge. `readLLMConfig` fills defaults,
 * `writeLLMConfig` merges (a partial save can never wipe a stored key), and
 * `describeLLMConfig` produces the only form that may cross the network — the key
 * replaced by a boolean.
 */
import type { LLMConfig, LLMProvider } from "./types.js";
import {
  DEFAULT_BASE_URL_BY_PROVIDER,
  DEFAULT_LLM_CONFIG,
  DEFAULT_MODEL_BY_PROVIDER,
  PROVIDERS_REQUIRING_KEY,
} from "./llm/types.js";
import { getStore } from "./storage.js";

/** Store key. Must stay in step with `STORE_KEYS` in storage.ts. */
const LLM_CONFIG_KEY = "llmConfig";

/** Sampling temperature used when a caller does not pass one per request. */
export const DEFAULT_LLM_TEMPERATURE = 0.4;

export const LLM_PROVIDERS: readonly LLMProvider[] = [
  "gemini",
  "openai",
  "anthropic",
  "openrouter",
  "ollama",
  "none",
];

/**
 * What is persisted: a `LLMConfig` plus the user's temperature preference.
 *
 * Temperature is stored rather than passed per call because it is a user setting,
 * not a property of any one prompt. Individual features still override it — résumé
 * tailoring wants low temperature regardless of preference.
 */
export interface StoredLLMConfig extends LLMConfig {
  temperature: number;
}

/** Safe to serialise anywhere. `apiKey` is deliberately absent, not blanked. */
export interface LLMConfigSummary {
  provider: LLMProvider;
  model: string;
  temperature: number;
  /** True when a key is stored. The key itself never leaves the server. */
  hasApiKey: boolean;
  /** True when this config can actually complete a request. */
  ready: boolean;
  /** One sentence for the UI: what will happen with this configuration. */
  message: string;
}

function isProvider(v: unknown): v is LLMProvider {
  return typeof v === "string" && (LLM_PROVIDERS as readonly string[]).includes(v);
}

/**
 * Accept every shape this setting has ever been stored or posted in.
 *
 * Canonical (`provider`/`model`/`apiKey`/`temperature`) plus the legacy flat
 * `ai*` names the old cloud dashboard sent, so a record written by that build
 * upgrades on first read instead of resetting the user's provider.
 */
export function normalizeLLMConfig(raw: unknown, base?: StoredLLMConfig): StoredLLMConfig {
  const envProvider = typeof process !== "undefined" && process.env?.SUPERJOB_LLM_PROVIDER;
  const envHasOpenRouter = typeof process !== "undefined" && Boolean(process.env?.OPENROUTER_API_KEY);
  const defaultProvider: LLMProvider = isProvider(envProvider)
    ? envProvider
    : envHasOpenRouter
      ? "openrouter"
      : DEFAULT_LLM_CONFIG.provider;

  const fallback: StoredLLMConfig =
    base ?? {
      provider: defaultProvider,
      model: DEFAULT_MODEL_BY_PROVIDER[defaultProvider],
      baseUrl: DEFAULT_BASE_URL_BY_PROVIDER[defaultProvider],
      apiKey: "",
      temperature: DEFAULT_LLM_TEMPERATURE,
    };
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) if (input[k] !== undefined && input[k] !== null) return input[k];
    return undefined;
  };

  const rawProvider = pick("provider", "aiProvider");
  const provider: LLMProvider = isProvider(rawProvider) ? rawProvider : fallback.provider;
  // Switching provider must not carry the previous provider's model across:
  // "gpt-4o-mini" is not a Gemini model and the request would 404.
  const providerChanged = provider !== fallback.provider;

  const rawModel = pick("model", "aiModel");
  const model =
    typeof rawModel === "string" && rawModel.trim()
      ? rawModel.trim()
      : providerChanged
        ? DEFAULT_MODEL_BY_PROVIDER[provider]
        : fallback.model || DEFAULT_MODEL_BY_PROVIDER[provider];

  // An absent key means "unchanged" only for the same provider. Changing provider
  // must never carry the old provider's credential into a new configuration.
  const rawKey = pick("apiKey", "aiApiKey");
  const envKey =
    typeof process !== "undefined" && process.env
      ? (provider === "gemini" ? process.env.GEMINI_API_KEY || process.env.SUPERJOB_LLM_API_KEY : undefined) ||
        (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
        (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ||
        (provider === "openrouter" ? process.env.OPENROUTER_API_KEY || process.env.SUPERJOB_LLM_API_KEY : undefined) ||
        process.env.SUPERJOB_LLM_API_KEY ||
        ""
      : "";
  const apiKey = typeof rawKey === "string"
    ? rawKey.trim()
    : (providerChanged ? envKey : fallback.apiKey || envKey || "");

  const rawTemp = Number(pick("temperature", "aiTemperature"));
  const temperature = Number.isFinite(rawTemp)
    ? Math.max(0, Math.min(2, rawTemp))
    : fallback.temperature;

  const rawBase = pick("baseUrl");
  const baseUrl =
    typeof rawBase === "string" && rawBase.trim()
      ? rawBase.trim()
      : providerChanged
        ? DEFAULT_BASE_URL_BY_PROVIDER[provider]
        : fallback.baseUrl || DEFAULT_BASE_URL_BY_PROVIDER[provider];

  const out: StoredLLMConfig = { provider, model, apiKey, temperature };
  if (baseUrl) out.baseUrl = baseUrl;
  return out;
}

/** True when this configuration can complete a request. */
export function isLLMConfigured(cfg: StoredLLMConfig): boolean {
  if (cfg.provider === "none") return false;
  if (PROVIDERS_REQUIRING_KEY.includes(cfg.provider)) return Boolean(cfg.apiKey?.trim());
  // Ollama needs no key, only a reachable daemon — which cannot be checked here.
  return true;
}

/**
 * The wire form. Everything a settings UI needs to paint itself and nothing that
 * would leak the key.
 */
export function describeLLMConfig(cfg: StoredLLMConfig): LLMConfigSummary {
  const hasApiKey = Boolean(cfg.apiKey?.trim());
  const ready = isLLMConfigured(cfg);
  let message: string;
  if (cfg.provider === "none") {
    message =
      "No AI model is selected. Cover letters, résumé tailoring and screening answers come from your profile instead.";
  } else if (!ready) {
    message = `Add an API key for ${cfg.provider} — until then, AI features fall back to your profile and saved answers.`;
  } else if (cfg.provider === "ollama") {
    message = `Using local Ollama model ${cfg.model}. Nothing is sent to a third-party API; the daemon must be running.`;
  } else {
    message = `Using ${cfg.provider} · ${cfg.model}.`;
  }
  return { provider: cfg.provider, model: cfg.model, temperature: cfg.temperature, hasApiKey, ready, message };
}

/** The user's stored model config, with defaults filled in. */
export async function readLLMConfig(): Promise<StoredLLMConfig> {
  return normalizeLLMConfig(await getStore().get(LLM_CONFIG_KEY));
}

/**
 * Merge a partial change into the stored config and return the result.
 *
 * Merging is the point: the settings form posts `{ provider, model, temperature }`
 * with no key, because it has never been given the key to send back. A plain
 * overwrite would erase it on every save.
 */
export async function writeLLMConfig(patch: unknown): Promise<StoredLLMConfig> {
  const current = await readLLMConfig();
  const next = normalizeLLMConfig(patch, current);
  await getStore().set(LLM_CONFIG_KEY, next);
  return next;
}
