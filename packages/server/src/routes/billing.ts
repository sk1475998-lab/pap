/**
 * `/api/billing` — Enterprise Subscription & Quota Gating Engine.
 *
 * Implements the commercial monetization layer:
 *  - Free Tier: 150 applications per 30-day window.
 *  - Pro Tier ($19/mo, $149/yr): Unlimited applications, Multi-Agent Swarm, ATS Resume Tailor.
 *  - Ultra Tier ($49/mo): Cloud overnight batch queue, proxy rotation.
 *  - Stripe Checkout Session creation and authenticated Customer Portal sessions.
 *  - Atomic webhook handling for automated subscription lifecycle.
 *  - Developer test-upgrade gateway for instant alpha testing.
 */
import { Router } from "express";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getBaseStore } from "@superjob/core";
import {
  findUserByEmail,
  findUserById,
  putUser,
  isEventProcessed,
  markEventProcessed,
  indexStripeCustomer,
  findUserByStripeCustomer,
  type SubscriptionTier,
  type UserRecord,
} from "../lib/identity.js";
import { asyncRoute, requireAuth, type AuthedRequest } from "../lib/tenant.js";


export const billingRouter = Router();

const inFlightWebhookEvents = new Set<string>();

function dashboardOrigin(req: { protocol: string; get(name: string): string | undefined }): string | null {
  const configured = process.env.APP_PUBLIC_URL;
  let origin: URL;
  try {
    if (configured) {
      origin = new URL(configured);
    } else {
      if (process.env.NODE_ENV === "production") return null;
      origin = new URL(`${req.protocol}://${req.get("host") || ""}`);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) return null;
    }
  } catch {
    return null;
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((origin.protocol !== "https:" && !(loopback && origin.protocol === "http:")) ||
      origin.username || origin.password || origin.search || origin.hash) {
    return null;
  }
  return origin.origin;
}

/** Persist the idempotency marker only after the handler commits successfully. */
export async function processWebhookEvent(
  eventId: string,
  handle: () => Promise<void>,
): Promise<"processed" | "duplicate" | "busy"> {
  if (!eventId) {
    await handle();
    return "processed";
  }
  if (inFlightWebhookEvents.has(eventId)) return "busy";
  if (await isEventProcessed(eventId)) return "duplicate";
  if (inFlightWebhookEvents.has(eventId)) return "busy";

  inFlightWebhookEvents.add(eventId);
  try {
    await handle();
    await markEventProcessed(eventId);
    return "processed";
  } finally {
    inFlightWebhookEvents.delete(eventId);
  }
}

export interface TierEntitlements {
  monthlyLimit: number | null; // null means unlimited
  canUseMultiAgentCrew: boolean;
  canTailorResume: boolean;
  canUseCloudFleet: boolean;
  canUseEmailRadar: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierEntitlements> = {
  free: {
    monthlyLimit: 150,
    canUseMultiAgentCrew: false,
    canTailorResume: false,
    canUseCloudFleet: false,
    canUseEmailRadar: false,
  },
  pro: {
    monthlyLimit: null, // unlimited
    canUseMultiAgentCrew: true,
    canTailorResume: true,
    canUseCloudFleet: false,
    canUseEmailRadar: true,
  },
  ultra: {
    monthlyLimit: null, // unlimited
    canUseMultiAgentCrew: true,
    canTailorResume: true,
    canUseCloudFleet: true,
    canUseEmailRadar: true,
  },
};

const APPLICATION_QUOTA_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Initialize legacy accounts and advance expired application quota windows. */
export function ensureMonthlyQuotaFresh(user: UserRecord): { user: UserRecord; reset: boolean } {
  const now = Date.now();
  if (user.monthlyApplicationsResetAt === undefined || user.monthlyApplicationsUsed === undefined) {
    const updated: UserRecord = {
      ...user,
      monthlyApplicationsUsed: 0,
      monthlyApplicationsResetAt: now + APPLICATION_QUOTA_WINDOW_MS,
    };
    return { user: updated, reset: true };
  }
  if (now >= user.monthlyApplicationsResetAt) {
    const elapsedWindows = Math.floor((now - user.monthlyApplicationsResetAt) / APPLICATION_QUOTA_WINDOW_MS) + 1;
    const updated: UserRecord = {
      ...user,
      monthlyApplicationsUsed: 0,
      monthlyApplicationsResetAt: user.monthlyApplicationsResetAt + elapsedWindows * APPLICATION_QUOTA_WINDOW_MS,
    };
    return { user: updated, reset: true };
  }
  return { user, reset: false };
}

/** @deprecated Use ensureMonthlyQuotaFresh. */
export const ensureDailyQuotaFresh = ensureMonthlyQuotaFresh;

/**
 * GET /api/billing/status
 * Returns the user's subscription tier, monthly quota usage, and available features.
 */
billingRouter.get(
  "/status",
  requireAuth,
  asyncRoute(async (req, res) => {
    let user = (req as AuthedRequest).user;
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    // Refresh quota window if needed
    const { user: refreshed, reset } = ensureMonthlyQuotaFresh(user);
    if (reset) {
      await putUser(refreshed);
      user = refreshed;
    }

    const tier: SubscriptionTier = user.tier || "ultra";
    const entitlements = TIER_LIMITS[tier];
    const usedThisPeriod = user.monthlyApplicationsUsed ?? 0;
    const monthlyLimit = entitlements.monthlyLimit;
    const remaining = monthlyLimit === null ? 99999 : Math.max(0, monthlyLimit - usedThisPeriod);

    res.json({
      ok: true,
      tier,
      isPro: tier === "pro" || tier === "ultra",
      isUltra: tier === "ultra",
      quota: {
        monthlyLimit,
        usedThisPeriod,
        remaining,
        resetsAt: user.monthlyApplicationsResetAt,
        periodDays: 30,
        // Kept as response aliases for older extension builds. These aliases
        // represent the same 30-day window, not a daily allowance.
        dailyLimit: monthlyLimit,
        usedToday: usedThisPeriod,
      },
      entitlements,
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
      subscriptionStatus: user.stripeSubscriptionStatus ?? null,
      cancelAtPeriodEnd: user.stripeCancelAtPeriodEnd ?? false,
      canManageSubscription: Boolean(user.stripeCustomerId),
      pricing: {
        proMonthlyUsd: 19,
        proAnnualUsd: 149,
        ultraMonthlyUsd: 49,
      },
    });
  }),
);

/**
 * POST /api/billing/create-checkout
 * Creates a Stripe Checkout subscription session.
 */
billingRouter.post(
  "/create-checkout",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { plan = "pro_monthly" } = req.body as { plan?: string };
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (user.stripeSubscriptionId) {
      return res.status(409).json({
        ok: false,
        code: "SUBSCRIPTION_ALREADY_EXISTS",
        error: "Manage or change your existing subscription in the billing portal.",
      });
    }

    if (stripeKey) {
      try {
        const appOrigin = dashboardOrigin(req);
        if (!appOrigin) {
          return res.status(503).json({
            ok: false,
            code: "BILLING_RETURN_URL_INVALID",
            error: "Configure APP_PUBLIC_URL with the HTTPS dashboard origin before enabling checkout.",
          });
        }
        // Real Stripe Checkout Session via Stripe REST API
        const priceMap: Record<string, string> = {
          pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
          pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
          ultra_monthly: process.env.STRIPE_ULTRA_MONTHLY_PRICE_ID || "",
        };

        const priceId = priceMap[plan];
        if (!priceId) {
          return res.status(400).json({ ok: false, error: `Invalid plan or price ID not configured for ${plan}` });
        }

        const params = new URLSearchParams({
          "payment_method_types[0]": "card",
          mode: "subscription",
          customer_email: user.email,
          "client_reference_id": user.userId,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: `${appOrigin}/?billing_status=success`,
          cancel_url: `${appOrigin}/?billing_status=cancelled`,
        });
        const tier = plan.startsWith("ultra") ? "ultra" : "pro";
        params.set("metadata[userId]", user.userId);
        params.set("metadata[tier]", tier);
        params.set("metadata[plan]", plan);
        params.set("subscription_data[metadata][userId]", user.userId);
        params.set("subscription_data[metadata][tier]", tier);
        params.set("subscription_data[metadata][plan]", plan);

        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const session = await stripeRes.json();
        if (!stripeRes.ok || !session?.url) {
          return res.status(502).json({
            ok: false,
            error: session?.error?.message || "Stripe did not return a checkout URL.",
          });
        }

        return res.json({ ok: true, checkoutUrl: session.url });
      } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
      }
    }

    return res.status(503).json({
      ok: false,
      code: "BILLING_NOT_CONFIGURED",
      error: "Stripe checkout is not configured. No payment was created.",
    });
  }),
);

/**
 * POST /api/billing/portal-session
 * Creates a customer-authenticated Stripe Billing Portal session.
 */
billingRouter.post(
  "/portal-session",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(503).json({
        ok: false,
        code: "BILLING_NOT_CONFIGURED",
        error: "Stripe subscription management is not configured.",
      });
    }
    if (!user.stripeCustomerId) {
      return res.status(409).json({
        ok: false,
        code: "NO_STRIPE_CUSTOMER",
        error: "This account has no Stripe subscription to manage.",
      });
    }

    const appOrigin = dashboardOrigin(req);
    if (!appOrigin) {
      return res.status(503).json({
        ok: false,
        code: "BILLING_RETURN_URL_INVALID",
        error: "Configure APP_PUBLIC_URL with the HTTPS dashboard origin before enabling subscription management.",
      });
    }
    const returnUrl = new URL("/#billing", appOrigin).toString();

    try {
      const params = new URLSearchParams({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });
      const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + stripeKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const session = await stripeRes.json().catch(() => ({}));
      if (!stripeRes.ok || typeof session?.url !== "string") {
        return res.status(502).json({
          ok: false,
          code: "STRIPE_PORTAL_FAILED",
          error: session?.error?.message || "Stripe did not return a subscription-management URL.",
        });
      }
      return res.json({ ok: true, portalUrl: session.url });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        code: "STRIPE_PORTAL_UNAVAILABLE",
        error: error instanceof Error ? error.message : "Could not reach Stripe to open subscription management.",
      });
    }
  }),
);

/**
 * POST /api/billing/dev-upgrade
 * For internal founder testing ONLY.
 * Disabled completely in production or unless explicitly enabled via ENABLE_DEV_BILLING_BACKDOOR="true"
 * with a high-entropy DEV_UPGRADE_SECRET (min 16 chars).
 */
const isDevBackdoorEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_BILLING_BACKDOOR === "true" &&
  typeof process.env.DEV_UPGRADE_SECRET === "string" &&
  process.env.DEV_UPGRADE_SECRET.length >= 16;

if (isDevBackdoorEnabled) {
  billingRouter.post(
    "/dev-upgrade",
    requireAuth,
    asyncRoute(async (req, res) => {
      const devKey = req.headers["x-dev-upgrade-key"];
      const secret = process.env.DEV_UPGRADE_SECRET!;
      if (!devKey || typeof devKey !== "string") {
        return res.status(403).json({ ok: false, error: "Forbidden: valid x-dev-upgrade-key header required." });
      }

      // Timing-safe secret verification using HMAC-SHA256 to prevent side-channel leaks
      const devKeyDigest = createHmac("sha256", secret).update(devKey).digest();
      const expectedDigest = createHmac("sha256", secret).update(secret).digest();
      if (!timingSafeEqual(devKeyDigest, expectedDigest)) {
        return res.status(403).json({ ok: false, error: "Forbidden: valid x-dev-upgrade-key header required." });
      }

      const user = (req as AuthedRequest).user;
      if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const { tier = "pro" } = req.body as { tier?: SubscriptionTier };
      if (!["free", "pro", "ultra"].includes(tier)) {
        return res.status(400).json({ ok: false, error: `Invalid tier "${tier}". Must be free, pro, or ultra.` });
      }

      const updatedUser: UserRecord = {
        ...user,
        tier,
        monthlyApplicationsUsed: 0,
        monthlyApplicationsResetAt: Date.now() + APPLICATION_QUOTA_WINDOW_MS,
        subscriptionExpiresAt: tier === "free" ? undefined : Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await putUser(updatedUser);

      res.json({
        ok: true,
        message: `✅ Account successfully upgraded to ${tier.toUpperCase()}`,
        tier: updatedUser.tier,
        entitlements: TIER_LIMITS[tier],
      });
    }),
  );
}

/**
 * POST /api/billing/webhook
 * Stripe webhook handler for subscription lifecycle events.
 *
 * SECURITY: Every inbound event MUST be verified with the Stripe-Signature header
 * and the STRIPE_WEBHOOK_SECRET env var. An unverified webhook is a free-tier
 * escalation vector — any caller can forge a checkout.session.completed event.
 */
billingRouter.post(
  "/webhook",
  // Stripe requires the raw body for signature verification. Express must NOT
  // pre-parse JSON for this route, so we use the raw body Buffer.
  express.raw({ type: "application/json" }),
  asyncRoute(async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Cannot safely process webhooks without a signing secret.
      console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting all webhook calls.");
      return res.status(503).json({ ok: false, error: "Webhook not configured." });
    }

    // Verify Stripe signature using HMAC-SHA256.
    const sigHeader = req.headers["stripe-signature"];
    if (!sigHeader || typeof sigHeader !== "string") {
      return res.status(400).json({ ok: false, error: "Missing stripe-signature header." });
    }

    let event: Record<string, unknown>;
    try {
      event = verifyStripeWebhook(req.body as Buffer, sigHeader, webhookSecret);
    } catch (err) {
      console.error("[billing/webhook] Signature verification failed:", err);
      return res.status(400).json({ ok: false, error: "Webhook signature invalid." });
    }

    const eventId = String(event?.id ?? "");
    const processing = await processWebhookEvent(eventId, async () => {
      const eventType = event?.type as string | undefined;

      if (eventType === "checkout.session.completed") {
        const session = (event.data as any)?.object;
        const customerEmail = session?.customer_email || session?.customer_details?.email;
        const checkoutUserId = session?.client_reference_id || session?.metadata?.userId;
        const storeUser = checkoutUserId
          ? await findUserById(String(checkoutUserId))
          : customerEmail
            ? await findUserByEmail(String(customerEmail))
            : null;
        if (!storeUser) throw new Error("Checkout event refers to an unknown account.");
        const planTier = (session?.metadata?.tier as SubscriptionTier) ?? "pro";
        const allowedTiers: SubscriptionTier[] = ["pro", "ultra"];
        const tier: SubscriptionTier = allowedTiers.includes(planTier) ? planTier : "pro";

        await putUser({
          ...storeUser,
          tier,
          stripeCustomerId: session?.customer,
          stripeSubscriptionId: session?.subscription,
          // The checkout session does not authoritatively provide the renewal
          // timestamp. The subscription lifecycle event below supplies it.
          subscriptionExpiresAt: undefined,
          stripeCancelAtPeriodEnd: false,
        });
        if (session?.customer && storeUser.userId) {
          await indexStripeCustomer(String(session.customer), storeUser.userId);
        }
        console.log(`[billing/webhook] Upgraded ${customerEmail} to ${tier} via Stripe event ${eventId}`);
      } else if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
        const subscription = (event.data as any)?.object;
        const customerId = String(subscription?.customer ?? "");
        const userId = String(subscription?.metadata?.userId ?? "");
        if (!customerId) throw new Error("Subscription lifecycle event is missing customer ID.");
        const user = (userId ? await findUserById(userId) : null) ?? await findUserByStripeCustomer(customerId);
        if (!user) throw new Error("Subscription lifecycle event refers to an unknown account.");

        const requestedTier = String(subscription?.metadata?.tier ?? user.tier ?? "pro");
        const tier: SubscriptionTier = requestedTier === "ultra" ? "ultra" : "pro";
        const status = String(subscription?.status ?? "unknown");
        const periodEnd = Number(
          subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end,
        );
        const expiresAt = Number.isFinite(periodEnd) && periodEnd > 0 ? periodEnd * 1000 : user.subscriptionExpiresAt;
        const isTerminalFailure = status === "unpaid" || status === "incomplete_expired" || status === "canceled";
        await putUser({
          ...user,
          tier: isTerminalFailure ? "free" : tier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: String(subscription?.id ?? user.stripeSubscriptionId ?? ""),
          stripeSubscriptionStatus: status,
          stripeCancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
          subscriptionExpiresAt: expiresAt,
        });
        await indexStripeCustomer(customerId, user.userId);
      } else if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
        const invoice = (event.data as any)?.object;
        const customerId = String(invoice?.customer ?? "");
        if (!customerId) throw new Error("Invoice event is missing customer ID.");
        const user = await findUserByStripeCustomer(customerId);
        if (!user) throw new Error("Invoice event refers to an unknown Stripe customer.");
        await putUser({
          ...user,
          stripeSubscriptionStatus: eventType === "invoice.paid" ? "active" : "past_due",
        });
      } else if (eventType === "customer.subscription.deleted") {
        const subscription = (event.data as any)?.object;
        const customerId = subscription?.customer;
        if (!customerId) throw new Error("Subscription cancellation is missing customer ID.");
        const user = await findUserByStripeCustomer(customerId);
        if (!user) throw new Error("Subscription cancellation refers to an unknown customer.");
        await putUser({
          ...user,
          tier: "free",
          stripeSubscriptionId: undefined,
          stripeSubscriptionStatus: "canceled",
          stripeCancelAtPeriodEnd: false,
          subscriptionExpiresAt: undefined,
        });
        console.log(`[billing/webhook] Downgraded ${user.email} to free on subscription cancellation.`);
      }
    });

    if (processing === "duplicate") {
      console.log(`[billing/webhook] Duplicate event ${eventId} — skipping.`);
      return res.json({ received: true, duplicate: true });
    }
    if (processing === "busy") {
      return res.status(503).json({ received: false, error: "Webhook event is already being processed." });
    }
    res.json({ received: true });
  }),
);

/**
 * Verify a Stripe webhook payload using HMAC-SHA256.
 * Stripe signs with: `t=<timestamp>,v1=<sig>` in the Stripe-Signature header.
 * We recompute the signed payload and compare with timing-safe equality.
 */
function verifyStripeWebhook(
  payload: Buffer,
  sigHeader: string,
  secret: string,
): Record<string, unknown> {
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) throw new Error("Malformed Stripe-Signature header");

  // Reject timestamps more than 5 minutes old (replay attack prevention).
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (timestampAge > 300) throw new Error(`Webhook timestamp too old: ${timestampAge}s`);

  const signedPayload = `${t}.${payload.toString("utf8")}`;
  const expectedSig = createHmac("sha256", secret).update(signedPayload).digest("hex");

  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Signature mismatch");
  }

  return JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
}

/**
 * Reports an application submission to Stripe's metered billing engine (Gap Billing Fix).
 * Triggered automatically when an application transitions to 'submitted' or is completed by the agent.
 */
export async function reportStripeApplicationUsage(
  user: UserRecord,
  quantity = 1,
): Promise<{ ok: boolean; reported: number; error?: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || !user.stripeCustomerId) {
    return { ok: true, reported: 0 }; // Not on live Stripe metered billing or in local dev mode
  }

  try {
    const meterEventName = process.env.STRIPE_METER_EVENT_NAME || "job_applications";
    const body = new URLSearchParams({
      event_name: meterEventName,
      "payload[value]": String(quantity),
      "payload[stripe_customer_id]": user.stripeCustomerId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    });

    const res = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("[billing/meter] Stripe meter event warning:", (err as any).error?.message || res.statusText);
      return { ok: false, reported: 0, error: (err as any).error?.message };
    }

    return { ok: true, reported: quantity };
  } catch (err: any) {
    console.warn("[billing/meter] Failed to report Stripe meter event:", err.message);
    return { ok: false, reported: 0, error: err.message };
  }
}

/**
 * GET /api/billing/usage-history
 * Returns billing periods, usage records, and quota limits for the authenticated user.
 */
billingRouter.get(
  "/usage-history",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const used = user.monthlyApplicationsUsed ?? 0;
    const resetsAt = user.monthlyApplicationsResetAt ?? Date.now() + 30 * 86400000;
    const tier = user.tier ?? "free";
    const limit = TIER_LIMITS[tier].monthlyLimit;

    res.json({
      ok: true,
      data: {
        currentPeriod: {
          used,
          limit,
          resetsAt: new Date(resetsAt).toISOString(),
          percentUsed: limit ? Math.min(100, Math.round((used / limit) * 100)) : 0,
        },
        tier,
        stripeCustomerId: user.stripeCustomerId ? `cus_***${user.stripeCustomerId.slice(-4)}` : null,
      },
    });
  }),
);

