import {
  ensureMonthlyQuotaFresh,
  reportStripeApplicationUsage,
  TIER_LIMITS,
  type TierEntitlements,
} from "../routes/billing.js";
import {
  findUserById,
  putUser,
  type SubscriptionTier,
  type UserRecord,
} from "./identity.js";

export interface ApplicationQuotaResult<T> {
  allowed: boolean;
  result?: T;
  used: number;
  limit: number | null;
  tier: SubscriptionTier;
}

const userQueues = new Map<string, Promise<void>>();

/**
 * Serialize submission transitions per account in this process, reserve one
 * monthly application slot, then persist the application. Saved/draft rows must
 * not call this helper. A failed application write rolls the reservation back.
 */
export async function withApplicationQuota<T>(
  user: UserRecord,
  persist: () => Promise<T>,
  requested = 1,
): Promise<ApplicationQuotaResult<T>> {
  if (!Number.isSafeInteger(requested) || requested < 1) {
    throw new RangeError("Application quota reservations must be a positive integer.");
  }
  const prior = userQueues.get(user.userId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  userQueues.set(user.userId, current);
  await prior;

  try {
    const latest = (await findUserById(user.userId)) ?? user;
    const { user: refreshed, reset } = ensureMonthlyQuotaFresh(latest);
    const tier = refreshed.tier ?? "free";
    const entitlements: TierEntitlements = TIER_LIMITS[tier];
    const limit = entitlements.monthlyLimit;
    const used = refreshed.monthlyApplicationsUsed ?? 0;
    if (reset) await putUser(refreshed);
    if (limit !== null && used + requested > limit) {
      return { allowed: false, used, limit, tier };
    }

    const reserved = { ...refreshed, monthlyApplicationsUsed: used + requested };
    await putUser(reserved);
    try {
      const result = await persist();
      // Report metered usage to Stripe asynchronously
      reportStripeApplicationUsage(reserved, requested).catch((err) => {
        console.warn("[quota] Background Stripe meter report failed:", err);
      });
      return { allowed: true, result, used: used + requested, limit, tier };
    } catch (error) {
      await putUser(refreshed);
      throw error;
    }
  } finally {
    release();
    if (userQueues.get(user.userId) === current) userQueues.delete(user.userId);
  }
}

export function sendApplicationQuotaExceeded(
  res: { status(code: number): { json(body: unknown): unknown } },
  result: Pick<ApplicationQuotaResult<unknown>, "used" | "limit" | "tier">,
): unknown {
  return res.status(402).json({
    ok: false,
    error: "QUOTA_EXCEEDED",
    code: "MONTHLY_LIMIT_REACHED",
    message: `You have reached your 30-day application limit of ${result.limit}. Upgrade for more applications.`,
    tier: result.tier,
    limit: result.limit,
    used: result.used,
    upgradeUrl: "/billing",
  });
}
