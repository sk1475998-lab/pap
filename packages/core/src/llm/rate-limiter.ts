export class LLMRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(
    private maxTokens = 15,
    private refillPerMinute = 15
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const add = (elapsed / 60_000) * this.refillPerMinute;
    if (add >= 1) {
      this.tokens = Math.min(this.maxTokens, this.tokens + Math.floor(add));
      this.lastRefill = now;
      while (this.tokens > 0 && this.queue.length > 0) {
        this.tokens--;
        const next = this.queue.shift();
        next?.();
      }
    }
  }

  async acquire(): Promise<boolean> {
    this.refill();
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }

  async acquireWait(timeoutMs = 30_000): Promise<boolean> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        const idx = this.queue.indexOf(resume);
        if (idx !== -1) this.queue.splice(idx, 1);
        resolve(false);
      }, timeoutMs);

      const resume = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(true);
      };

      this.queue.push(resume);

      // Periodically trigger refills to wake waiting requests
      const interval = setInterval(() => {
        if (resolved) {
          clearInterval(interval);
          return;
        }
        this.refill();
      }, 250);
    });
  }

  get available(): number {
    this.refill();
    return this.tokens;
  }

  get queuedCount(): number {
    return this.queue.length;
  }
}

/** Global shared limiter per provider to prevent multi-tab quota exhaustion */
export const providerRateLimiters: Record<string, LLMRateLimiter> = {
  gemini: new LLMRateLimiter(15, 15),
  openai: new LLMRateLimiter(20, 20),
  anthropic: new LLMRateLimiter(10, 10),
  openrouter: new LLMRateLimiter(20, 20),
};
