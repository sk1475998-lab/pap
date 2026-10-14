/**
 * Chrome Extension Quota & Subscription Client.
 *
 * Implements client-side quota governor:
 *  - Free tier: 150 applications per 30-day window.
 *  - Pro / Ultra: Unlimited auto-applies + priority multi-agent features.
 *  - Synchronizes quota with Cloud API (/api/billing/status).
 */
import { getCloudApiUrl, getCloudToken } from "@/lib/sync/sync-client.js";
import { diagLog } from "@/lib/diagnostics.js";
import { isChromeRuntimeValid } from "@/lib/runtime-guard.js";

export interface QuotaStatus {
  tier: "free" | "pro" | "ultra";
  isPro: boolean;
  monthlyLimit: number | null;
  usedThisPeriod: number;
  remaining: number;
  resetsAt?: number;
  periodDays: 30;
  canManageSubscription: boolean;
}

const DEFAULT_QUOTA: QuotaStatus = {
  tier: "free",
  isPro: false,
  monthlyLimit: 150,
  usedThisPeriod: 0,
  remaining: 150,
  periodDays: 30,
  canManageSubscription: false,
};

/** Fetch live quota status from the cloud server */
export async function getQuotaStatus(forceRefresh = false): Promise<QuotaStatus> {
  if (!isChromeRuntimeValid()) return DEFAULT_QUOTA;

  if (!forceRefresh) {
    const cached = await chrome.storage.local.get("sja_quota_status");
    if (cached.sja_quota_status) {
      const q = cached.sja_quota_status as QuotaStatus;
      if (q.periodDays !== 30 || typeof q.monthlyLimit === "undefined" || typeof q.usedThisPeriod === "undefined") {
        return getQuotaStatus(true);
      }
      if (q.resetsAt && Date.now() >= q.resetsAt) return getQuotaStatus(true);
      return q;
    }
  }

  const apiUrl = await getCloudApiUrl();
  const token = await getCloudToken();

  try {
    const res = await fetch(`${apiUrl}/billing/status`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.ok) {
        const q: QuotaStatus = {
          tier: data.tier || "free",
          isPro: Boolean(data.isPro),
          monthlyLimit: data.quota?.monthlyLimit === null
            ? null
            : typeof data.quota?.monthlyLimit === "number"
              ? data.quota.monthlyLimit
              : data.quota?.dailyLimit ?? 150,
          usedThisPeriod: data.quota?.usedThisPeriod ?? data.quota?.usedToday ?? 0,
          remaining: data.quota?.remaining ?? 150,
          resetsAt: data.quota?.resetsAt,
          periodDays: data.quota?.periodDays ?? 30,
          canManageSubscription: Boolean(data.canManageSubscription),
        };
        await chrome.storage.local.set({ sja_quota_status: q });
        return q;
      }
    }
  } catch (err) {
    void diagLog("billing", "quota-fetch-error", { data: { error: String(err) } });
  }

  return DEFAULT_QUOTA;
}

/** Check if the user is allowed to apply to a new job right now */
export async function canApply(): Promise<{ allowed: boolean; reason?: string; quota: QuotaStatus }> {
  const quota = await getQuotaStatus();
  if (quota.isPro) {
    return { allowed: true, quota };
  }

  if (quota.monthlyLimit !== null && quota.usedThisPeriod >= quota.monthlyLimit) {
    return {
      allowed: false,
      reason: `30-day free application limit reached (${quota.monthlyLimit}/${quota.monthlyLimit}). Upgrade to Pro for unlimited applications.`,
      quota,
    };
  }

  return { allowed: true, quota };
}

/** Increment the local application count after a successful submission */
export async function recordApplicationQuota(): Promise<QuotaStatus> {
  const quota = await getQuotaStatus();
  quota.usedThisPeriod = (quota.usedThisPeriod || 0) + 1;
  if (quota.monthlyLimit !== null) {
    quota.remaining = Math.max(0, quota.monthlyLimit - quota.usedThisPeriod);
  }
  if (isChromeRuntimeValid()) {
    await chrome.storage.local.set({ sja_quota_status: quota });
  }
  return quota;
}
