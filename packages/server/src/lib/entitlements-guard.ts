/**
 * Server-side feature gates aligned with billing tiers (free | pro | ultra).
 */
import type { Response } from "express";
import { TIER_LIMITS, type TierEntitlements } from "../routes/billing.js";
import type { UserRecord, SubscriptionTier } from "./identity.js";
import type { AuthedRequest } from "./tenant.js";

export function entitlementsForUser(user: UserRecord | undefined): TierEntitlements {
  const tier: SubscriptionTier = user?.tier ?? "free";
  return TIER_LIMITS[tier];
}

export function denyFeature(
  res: Response,
  code: string,
  message: string,
  feature?: keyof TierEntitlements,
): void {
  res.status(402).json({
    ok: false,
    error: code,
    message,
    feature,
    upgradeUrl: "/#pricing",
  });
}

/** Requires an authenticated user with resume tailoring entitlement. */
export function requireTailorEntitlement(req: AuthedRequest, res: Response): boolean {
  const user = req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized", message: "Sign in to use resume tailoring." });
    return false;
  }
  const ent = entitlementsForUser(user);
  if (!ent.canTailorResume) {
    denyFeature(
      res,
      "TAILOR_PRO_REQUIRED",
      "Resume tailoring is a Pro feature. Upgrade to unlock grounded tailoring.",
      "canTailorResume",
    );
    return false;
  }
  return true;
}

/** Requires Pro or Ultra for multi-agent crew / fleet features. */
export function requireCrewEntitlement(req: AuthedRequest, res: Response): boolean {
  const user = req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "Unauthorized", message: "Sign in to use multi-job apply." });
    return false;
  }
  const ent = entitlementsForUser(user);
  if (!ent.canUseMultiAgentCrew) {
    denyFeature(
      res,
      "CREW_PRO_REQUIRED",
      "Parallel apply (Fleet) requires Pro. Upgrade for multi-job workflows.",
      "canUseMultiAgentCrew",
    );
    return false;
  }
  return true;
}
