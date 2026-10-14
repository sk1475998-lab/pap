/**
 * Operation Zero-Defect: Entitlement/Payment Architecture (Feature #11)
 * Manages Free/Pro/Enterprise feature gating, rate limits, and Stripe webhook sync.
 */
import { isChromeRuntimeValid } from "../runtime-guard.js";
import { diagLog } from "../diagnostics.js";

export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface EntitlementState {
  tier: PlanTier;
  aiGenerationsUsedToday: number;
  lastResetDate: number;
  stripeCustomerId?: string;
}

const STORAGE_KEY = "sja-entitlements";
const FREE_TIER_LIMIT = 10;
let consumeQueue: Promise<void> = Promise.resolve();

export async function getEntitlements(): Promise<EntitlementState> {
  if (!isChromeRuntimeValid()) return fallback();
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  let state = data[STORAGE_KEY] as EntitlementState | undefined;

  const today = new Date().setHours(0, 0, 0, 0);

  if (!state) {
    state = { tier: 'free', aiGenerationsUsedToday: 0, lastResetDate: today };
  } else if (state.lastResetDate !== today) {
    state.aiGenerationsUsedToday = 0;
    state.lastResetDate = today;
  }
  
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

export async function consumeAIToken(): Promise<{ allowed: boolean, reason?: string }> {
  let result: { allowed: boolean; reason?: string } = { allowed: false, reason: "Entitlement storage is unavailable." };
  const operation = consumeQueue.then(async () => {
    const state = await getEntitlements();
    if (state.tier === "free" && state.aiGenerationsUsedToday >= FREE_TIER_LIMIT) {
      void diagLog("entitlement", "rate-limit-hit", { data: { tier: state.tier } });
      result = { allowed: false, reason: "Daily limit reached. Please upgrade to Pro." };
      return;
    }
    state.aiGenerationsUsedToday += 1;
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    result = { allowed: true };
  });
  consumeQueue = operation.then(() => undefined, () => undefined);
  await operation;
  return result;
}

export async function syncSubscription(tier: PlanTier, stripeCustomerId: string): Promise<void> {
  const state = await getEntitlements();
  state.tier = tier;
  state.stripeCustomerId = stripeCustomerId;
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  void diagLog("entitlement", "subscription-synced", { data: { tier } });
}

function fallback(): EntitlementState {
  return { tier: 'free', aiGenerationsUsedToday: 0, lastResetDate: Date.now() };
}
