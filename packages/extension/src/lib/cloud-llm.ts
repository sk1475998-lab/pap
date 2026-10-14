import type { ChatMessage, LLMConfig, LLMProvider } from "@superjob/core";
import type { CompleteOptions, LLMClient } from "@superjob/core/llm";
import { authenticatedCloudFetch } from "./sync/sync-client.js";

export interface CloudLLMConfigSummary {
  provider: LLMProvider;
  model: string;
  temperature: number;
  hasApiKey: boolean;
  ready: boolean;
  message: string;
}

export async function getCloudLLMConfig(): Promise<CloudLLMConfigSummary> {
  const response = await authenticatedCloudFetch("/settings", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.llmConfig) {
    throw new Error(payload?.error || `Could not load AI settings (HTTP ${response.status}).`);
  }
  return payload.llmConfig as CloudLLMConfigSummary;
}

export function createCloudLLMClient(config: LLMConfig): LLMClient {
  return {
    config: { ...config, apiKey: "" },
    isAvailable: () => config.provider !== "none",
    async complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string> {
      const response = await authenticatedCloudFetch("/llm/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          options: {
            ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
            ...(options?.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
            ...(options?.responseFormat ? { responseFormat: options.responseFormat } : {}),
          },
        }),
        signal: options?.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || typeof payload.text !== "string") {
        throw new Error(payload?.error || `Cloud AI request failed (HTTP ${response.status}).`);
      }
      return payload.text;
    },
  };
}
