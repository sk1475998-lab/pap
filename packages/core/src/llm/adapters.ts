import type { ChatMessage, LLMConfig } from "../types.js";
import type { CompleteOptions, LLMClient } from "./types.js";
import { fetchWithRetry } from "../network-retry.js";
import { providerRateLimiters } from "./rate-limiter.js";

/* ------------------------------------------------------------------ */
/* Ollama (local, default — zero cost, lowest latency)                 */
/* ------------------------------------------------------------------ */

export class OllamaClient implements LLMClient {
  readonly baseUrl: string;
  readonly model: string;
  readonly config: LLMConfig;

  constructor(cfg: { baseUrl: string; model: string }) {
    this.baseUrl = cfg.baseUrl;
    this.model = cfg.model;
    this.config = { provider: "ollama", model: cfg.model, baseUrl: cfg.baseUrl };
  }

  isAvailable() {
    return Boolean(this.baseUrl && this.model);
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        format: opts.responseFormat?.type === "json_object" ? "json" : undefined,
        options: {
          temperature: opts.temperature ?? 0.4,
          num_predict: opts.maxTokens ?? 1024,
        },
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.message?.content ?? "";
  }

  async *stream(messages: ChatMessage[], opts: CompleteOptions = {}): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: { temperature: opts.temperature ?? 0.4 },
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Ollama stream error ${res.status}`);
    for await (const line of readLines(res.body)) {
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        const piece = json?.message?.content;
        if (piece) yield piece;
      } catch {
        /* skip */
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (OpenAI, OpenRouter, vLLM, LM Studio, Groq...)   */
/* ------------------------------------------------------------------ */

export class OpenAICompatibleClient implements LLMClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly config: LLMConfig;

  constructor(cfg: { baseUrl: string; apiKey: string; model: string; provider?: import("../types.js").LLMProvider }) {
    this.baseUrl = cfg.baseUrl;
    this.apiKey = cfg.apiKey;
    this.model = cfg.model;
    this.config = {
      provider: cfg.provider ?? "openai",
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
    };
  }

  isAvailable() {
    return Boolean(this.apiKey && this.model);
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const limiter = providerRateLimiters[this.config.provider] ?? providerRateLimiters.openai;
    if (limiter) await limiter.acquireWait();

    const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(this.config.provider === "openrouter" || this.baseUrl.includes("openrouter.ai")
          ? {
              "HTTP-Referer": "https://superjobagent.com",
              "X-Title": "SuperJobAgent",
            }
          : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
        response_format: opts.responseFormat,
        stream: false,
      }),
      signal: opts.signal,
    }, { maxRetries: 5, baseDelayMs: 2500, jitter: true });
    if (!res.ok) throw new Error(`OpenAI-compatible error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  async *stream(messages: ChatMessage[], opts: CompleteOptions = {}): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        stream: true,
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream error ${res.status}`);
    for await (const line of readLines(res.body)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const piece = json?.choices?.[0]?.delta?.content;
        if (piece) yield piece;
      } catch {
        /* skip */
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Anthropic (messages API)                                            */
/* ------------------------------------------------------------------ */

export class AnthropicClient implements LLMClient {
  readonly apiKey: string;
  readonly model: string;
  readonly config: LLMConfig;

  constructor(cfg: { apiKey: string; model: string }) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model;
    this.config = { provider: "anthropic", model: cfg.model, apiKey: cfg.apiKey };
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const limiter = providerRateLimiters.anthropic;
    if (limiter) await limiter.acquireWait();

    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const convo = messages.filter((m) => m.role !== "system");
    const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model || "claude-3-5-haiku-latest",
        system,
        messages: convo,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
      }),
      signal: opts.signal,
    }, { maxRetries: 3, baseDelayMs: 1500, jitter: true });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.content?.map((c: any) => c.text).join("") ?? "";
  }
}

/* ------------------------------------------------------------------ */
/* Google Gemini (ported from Auto_job_applier_linkedIn google_genai)   */
/* ------------------------------------------------------------------ */

export class GeminiClient implements LLMClient {
  readonly apiKey: string;
  readonly model: string;
  readonly config: LLMConfig;

  constructor(cfg: { apiKey: string; model: string }) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model || "gemini-2.0-flash";
    this.config = { provider: "gemini", model: this.model, apiKey: cfg.apiKey };
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    // Convert ChatMessage[] to Gemini's format
    const systemInstruction = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: any = {
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 1024,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (opts.responseFormat?.type === "json_object") {
      body.generationConfig.responseMimeType = "application/json";
    }

    const limiter = providerRateLimiters.gemini;
    if (limiter) await limiter.acquireWait();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    }, { maxRetries: 3, baseDelayMs: 1500, jitter: true });
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  }
}

/* ------------------------------------------------------------------ */
/* DeepSeek (dedicated client — uses OpenAI-compatible but with their  */
/* specific base URL and model naming)                                  */
/* ------------------------------------------------------------------ */

export class DeepSeekClient extends OpenAICompatibleClient {
  constructor(cfg: { apiKey: string; model?: string }) {
    super({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: cfg.apiKey,
      model: cfg.model || "deepseek-chat",
    });
  }
}

/* ------------------------------------------------------------------ */
/* No-LLM fallback (always available, never throws)                    */
/* ------------------------------------------------------------------ */

export class NullClient implements LLMClient {
  readonly config: LLMConfig = { provider: "none", model: "none" };
  isAvailable() {
    return false;
  }
  async complete() {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function* readLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) yield line;
  }
  if (buffer) yield buffer;
}
