/**
 * Cost-Aware LLM Router
 * Routes requests to the most cost-effective LLM provider based on:
 * - Task complexity (SIMPLE, MODERATE, COMPLEX)
 * - User preferences
 * - Budget constraints
 * - Provider availability
 * 
 * Since no offline models are available, defaults to cloud providers.
 */
import type { LLMConfig } from "../types.js";
import type { LLMClient } from "./types.js";
import { createLLM } from "./index.js";
import type { CachedLLMOptions } from "./cached-client.js";
import { NullClient } from "./adapters.js";

/** Task complexity tiers */
export type ComplexityTier = "SIMPLE" | "MODERATE" | "COMPLEX";

/** Provider pricing (per 1M tokens, approximate) */
export interface ProviderPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  avgLatencyMs: number;
  quality: number; // 0-100
}

/** Cost router configuration */
export interface CostRouterConfig {
  /** Monthly budget in USD */
  monthlyBudget?: number;
  /** Preferred providers (in order) */
  preferredProviders?: string[];
  /** Maximum cost per request in USD */
  maxCostPerRequest?: number;
  /** Enable caching */
  enableCaching?: boolean;
  /** Default tier for unknown tasks */
  defaultTier?: ComplexityTier;
}

/** Routing decision */
export interface RoutingDecision {
  provider: string;
  model: string;
  tier: ComplexityTier;
  estimatedCost: number;
  reason: string;
}

/** Cloud provider configs (no Ollama since user doesn't have offline models) */
const CLOUD_PROVIDERS: ProviderPricing[] = [
  {
    provider: "gemini",
    model: "gemini-2.0-flash",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
    avgLatencyMs: 800,
    quality: 75,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
    avgLatencyMs: 600,
    quality: 70,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    avgLatencyMs: 900,
    quality: 80,
  },
  {
    provider: "openrouter",
    model: "anthropic/claude-3.5-haiku",
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    avgLatencyMs: 1000,
    quality: 85,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    inputPer1M: 0.8,
    outputPer1M: 4.0,
    avgLatencyMs: 1200,
    quality: 90,
  },
  {
    provider: "openai",
    model: "gpt-4o",
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    avgLatencyMs: 1500,
    quality: 95,
  },
];

/** Tier-to-provider mapping (best value for each tier) */
const TIER_PROVIDERS: Record<ComplexityTier, ProviderPricing[]> = {
  SIMPLE: CLOUD_PROVIDERS.filter(
    (p) =>
      p.model.includes("flash") ||
      p.model.includes("mini") ||
      p.model.includes("haiku")
  ),
  MODERATE: CLOUD_PROVIDERS.filter(
    (p) =>
      p.model.includes("flash") ||
      p.model.includes("mini") ||
      p.model.includes("haiku") ||
      p.model.includes("4o-mini")
  ),
  COMPLEX: CLOUD_PROVIDERS,
};

/**
 * Cost-aware LLM router.
 */
export class CostRouter {
  private config: CostRouterConfig;
  private baseConfigs: Map<string, LLMConfig> = new Map();
  private cache: Map<string, LLMClient> = new Map();
  private monthlySpent = 0;
  private requestCount = 0;
  private reservedSpend = 0;

  constructor(
    baseConfigs: Record<string, LLMConfig>,
    routerConfig: CostRouterConfig = {}
  ) {
    this.config = {
      monthlyBudget: routerConfig.monthlyBudget ?? 10,
      preferredProviders: routerConfig.preferredProviders ?? ["gemini", "openai", "openrouter", "anthropic"],
      maxCostPerRequest: routerConfig.maxCostPerRequest ?? 0.05,
      enableCaching: routerConfig.enableCaching ?? true,
      defaultTier: routerConfig.defaultTier ?? "MODERATE",
    };

    // Store base configs
    for (const [key, cfg] of Object.entries(baseConfigs)) {
      this.baseConfigs.set(key, cfg);
    }
  }

  /**
   * Route a request to the appropriate LLM based on complexity.
   */
  async route(
    task: string,
    tier?: ComplexityTier,
    cacheOpts?: CachedLLMOptions
  ): Promise<{ client: LLMClient; decision: RoutingDecision }> {
    const resolvedTier = tier ?? this.classifyComplexity(task);
    const decision = this.selectProvider(resolvedTier);
    const budget = this.config.monthlyBudget ?? 10;
    if (this.monthlySpent + this.reservedSpend + decision.estimatedCost > budget) {
      return {
        client: new NullClient(),
        decision: {
          ...decision,
          provider: "none",
          model: "",
          estimatedCost: 0,
          reason: "Monthly LLM budget reached; request not sent",
        },
      };
    }

    // Get or create LLM client
    const cacheKey = `${decision.provider}:${decision.model}`;
    let client = this.cache.get(cacheKey);

    if (!client) {
      const baseConfig = this.baseConfigs.get(decision.provider);
      const config: LLMConfig = {
        provider: baseConfig?.provider ?? (decision.provider as LLMConfig["provider"]),
        apiKey: baseConfig?.apiKey,
        model: decision.model,
        baseUrl: baseConfig?.baseUrl,
      };
      client = createLLM(config, cacheOpts ?? undefined);
      this.cache.set(cacheKey, client);
    }

    return { client: this.meter(client, decision.estimatedCost), decision };
  }

  private meter(client: LLMClient, estimatedCost: number): LLMClient {
    return {
      config: client.config,
      isAvailable: () => client.isAvailable(),
      complete: async (messages, options) => {
        const budget = this.config.monthlyBudget ?? 10;
        if (this.monthlySpent + this.reservedSpend + estimatedCost > budget) {
          throw new Error("Monthly LLM budget reached; request not sent");
        }
        this.reservedSpend += estimatedCost;
        try {
          const result = await client.complete(messages, options);
          this.monthlySpent += estimatedCost;
          this.requestCount++;
          return result;
        } finally {
          this.reservedSpend -= estimatedCost;
        }
      },
    };
  }

  /**
   * Get the best client for a specific tier.
   */
  async getClientForTier(
    tier: ComplexityTier,
    cacheOpts?: CachedLLMOptions
  ): Promise<LLMClient> {
    const { client } = await this.route("", tier, cacheOpts);
    return client;
  }

  /**
   * Classify task complexity based on content.
   */
  classifyComplexity(task: string): ComplexityTier {
    const lower = task.toLowerCase();

    // Simple: short questions, basic field filling
    if (
      task.length < 100 ||
      lower.includes("yes/no") ||
      lower.includes("true/false") ||
      lower.match(/^\d+$/)
    ) {
      return "SIMPLE";
    }

    // Complex: long analysis, multiple steps, reasoning required
    if (
      task.length > 2000 ||
      lower.includes("analyze") ||
      lower.includes("compare") ||
      lower.includes("explain") ||
      lower.includes("write a") ||
      lower.includes("cover letter")
    ) {
      return "COMPLEX";
    }

    // Moderate: everything else
    return "MODERATE";
  }

  /**
   * Select provider based on tier and preferences.
   */
  private selectProvider(tier: ComplexityTier): RoutingDecision {
    const candidates = TIER_PROVIDERS[tier];
    if (candidates.length === 0) {
      // Fallback to cheapest
      return {
        provider: "gemini",
        model: "gemini-2.0-flash",
        tier,
        estimatedCost: 0.0001,
        reason: "fallback",
      };
    }

    // Filter by budget
    const affordable = candidates.filter(
      (p) => (p.inputPer1M + p.outputPer1M) / 2 / 1000 <= this.config.maxCostPerRequest!
    );

    // Filter by preferred providers
    const preferred = (affordable.length > 0 ? affordable : candidates).filter(
      (p) => this.config.preferredProviders!.includes(p.provider)
    );

    const pool = preferred.length > 0 ? preferred : affordable.length > 0 ? affordable : candidates;

    // Select best value (quality/cost ratio)
    const best = pool.reduce((a, b) => {
      const scoreA = a.quality / (a.inputPer1M + a.outputPer1M);
      const scoreB = b.quality / (b.inputPer1M + b.outputPer1M);
      return scoreA > scoreB ? a : b;
    });

    // Estimate cost (assume ~500 input + 200 output tokens average)
    const estimatedCost =
      (best.inputPer1M * 500 + best.outputPer1M * 200) / 1_000_000;

    return {
      provider: best.provider,
      model: best.model,
      tier,
      estimatedCost,
      reason: `Best ${tier.toLowerCase()} value: ${best.provider}/${best.model}`,
    };
  }

  /**
   * Get spending stats.
   */
  getStats(): { monthlySpent: number; requestCount: number; budget: number } {
    return {
      monthlySpent: this.monthlySpent,
      requestCount: this.requestCount,
      budget: this.config.monthlyBudget!,
    };
  }

  /**
   * Reset monthly stats.
   */
  resetMonthly(): void {
    this.monthlySpent = 0;
    this.requestCount = 0;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<CostRouterConfig>): void {
    this.config = { ...this.config, ...config };
    this.cache.clear(); // Clear cache to pick up new providers
  }
}

/**
 * Create a cost router with default configs.
 */
export function createCostRouter(
  apiKeys: Record<string, string>,
  routerConfig?: CostRouterConfig
): CostRouter {
  const configs: Record<string, LLMConfig> = {};

  // Build configs from API keys
  if (apiKeys.gemini) {
    configs.gemini = {
      provider: "gemini",
      apiKey: apiKeys.gemini,
      model: "gemini-2.0-flash",
    };
  }
  if (apiKeys.openai) {
    configs.openai = {
      provider: "openai",
      apiKey: apiKeys.openai,
      model: "gpt-4o-mini",
    };
  }
  if (apiKeys.openrouter) {
    configs.openrouter = {
      provider: "openrouter",
      apiKey: apiKeys.openrouter,
      model: "anthropic/claude-3.5-haiku",
    };
  }
  if (apiKeys.anthropic) {
    configs.anthropic = {
      provider: "anthropic",
      apiKey: apiKeys.anthropic,
      model: "claude-3-5-haiku-latest",
    };
  }

  return new CostRouter(configs, routerConfig);
}
