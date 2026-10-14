import type { ChatMessage, LLMConfig } from "../types.js";
import type { CompleteOptions, LLMClient } from "./types.js";
import { hashMessages, type LLMCacheStore, MemoryLLMCache } from "./cache.js";
import { LLMRateLimiter } from "./rate-limiter.js";

export interface CachedLLMOptions {
  cache?: LLMCacheStore;
  rateLimiter?: LLMRateLimiter;
  cacheEnabled?: boolean;
}

export class CachedLLMClient implements LLMClient {
  readonly config: LLMConfig;
  private cache: LLMCacheStore;
  private limiter: LLMRateLimiter;
  private cacheEnabled: boolean;
  hits = 0;
  misses = 0;

  constructor(
    private inner: LLMClient,
    opts: CachedLLMOptions = {}
  ) {
    this.config = inner.config;
    this.cache = opts.cache ?? new MemoryLLMCache();
    this.limiter = opts.rateLimiter ?? new LLMRateLimiter(8, 12);
    this.cacheEnabled = opts.cacheEnabled !== false;
  }

  isAvailable(): boolean {
    return this.inner.isAvailable();
  }

  async complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string> {
    const key = hashMessages(messages, opts);

    if (this.cacheEnabled) {
      const hit = await this.cache.get(key);
      if (hit !== undefined) {
        this.hits++;
        return hit;
      }
    }

    if (!(await this.limiter.acquire())) {
      throw new Error("LLM rate limit exceeded — try again in a minute or use cached answers");
    }

    this.misses++;
    const out = await this.inner.complete(messages, opts);

    if (this.cacheEnabled && out.trim()) {
      await this.cache.set(key, out);
    }
    return out;
  }
}

export function wrapCachedLLM(inner: LLMClient, opts?: CachedLLMOptions): LLMClient {
  if (!inner.isAvailable()) return inner;
  return new CachedLLMClient(inner, opts);
}
