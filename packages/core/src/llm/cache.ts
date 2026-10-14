/**
 * LLM response cache — avoids repeat API calls for identical prompts.
 */
import type { ChatMessage } from "../types.js";
import type { CompleteOptions } from "./types.js";

export interface LLMCacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
}

export class MemoryLLMCache implements LLMCacheStore {
  private map = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | undefined> {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    if (this.map.size > 500) {
      const first = this.map.keys().next().value;
      if (first) this.map.delete(first);
    }
  }
}

export function hashMessages(messages: ChatMessage[], opts?: CompleteOptions): string {
  const payload = JSON.stringify({
    m: messages.map((x) => [x.role, x.content]),
    t: opts?.temperature ?? 0.2,
    max: opts?.maxTokens ?? 200,
  });
  // Encode the complete request rather than relying on a short, collision-prone
  // 32-bit hash. encodeURIComponent is deterministic and injective for strings.
  return `llm:v2:${encodeURIComponent(payload)}`;
}

/** Minimal chrome.storage.local shape used by the extension cache. */
type ChromeStorageLocal = {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

function getChromeStorageLocal(): ChromeStorageLocal | undefined {
  return (globalThis as { chrome?: { storage?: { local?: ChromeStorageLocal } } }).chrome?.storage?.local;
}

/** Chrome.storage-backed cache for extension (optional). */
export function chromeStorageLLMCache(key = "llmResponseCache"): LLMCacheStore {
  return {
    async get(cacheKey: string) {
      try {
        const storage = getChromeStorageLocal();
        if (!storage) return undefined;
        const raw = await storage.get(key);
        const store = (raw[key] as Record<string, { v: string; e: number }>) ?? {};
        const hit = store[cacheKey];
        if (!hit || hit.e < Date.now()) return undefined;
        return hit.v;
      } catch {
        return undefined;
      }
    },
    async set(cacheKey: string, value: string, ttlMs = 7 * 24 * 60 * 60 * 1000) {
      try {
        const storage = getChromeStorageLocal();
        if (!storage) return;
        const raw = await storage.get(key);
        const store = { ...((raw[key] as Record<string, { v: string; e: number }>) ?? {}) };
        store[cacheKey] = { v: value, e: Date.now() + ttlMs };
        const keys = Object.keys(store);
        if (keys.length > 400) {
          for (const k of keys.slice(0, keys.length - 400)) delete store[k];
        }
        await storage.set({ [key]: store });
      } catch {
        /* quota */
      }
    },
  };
}
