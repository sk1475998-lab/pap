/**
 * Honest freshness / competition labels for job cards.
 * Does not claim measured callback multipliers — only describes posting signals.
 */

export type SalienceTier = "early" | "recent" | "moderate" | "competitive" | "standard";

export interface EarlyAdvantageLabels {
  isEarlyBird: boolean;
  /** Legacy field name kept for storage/UI compatibility; holds salience tier, not a multiplier. */
  callbackMultiplier: SalienceTier;
  badgeText: string;
  salienceTier: SalienceTier;
}

export function earlyAdvantageFromPostingAge(daysSincePosted: number | null): EarlyAdvantageLabels | null {
  if (daysSincePosted === null) return null;
  if (daysSincePosted <= 1) {
    return pack(true, "early", "Fresh posting (≤1 day on board)");
  }
  if (daysSincePosted <= 3) {
    return pack(true, "recent", "Recent posting (≤3 days on board)");
  }
  return null;
}

export function earlyAdvantageFromApplicantSignals(input: {
  applicantCount?: number;
  isRecentPost?: boolean;
  applicantText?: string;
  postedText?: string;
}): EarlyAdvantageLabels | null {
  const { applicantCount, isRecentPost, applicantText, postedText } = input;
  if (!applicantText && !postedText && applicantCount === undefined && !isRecentPost) {
    return null;
  }

  const earlyByApplicants = applicantCount !== undefined && applicantCount <= 25;
  const earlyByRecency = Boolean(isRecentPost);

  if (earlyByApplicants || earlyByRecency) {
    const detail =
      applicantCount !== undefined
        ? `Low applicant volume (${applicantCount} listed)`
        : "Recently posted";
    return pack(true, "early", `Early window — ${detail}`);
  }

  if (applicantCount !== undefined && applicantCount <= 50) {
    return pack(false, "moderate", `Moderate volume (${applicantCount} applicants)`);
  }

  if (applicantCount !== undefined && applicantCount > 100) {
    return pack(
      false,
      "competitive",
      `High competition (${applicantCount}+ applicants) — consider tailoring keywords`,
    );
  }

  return pack(false, "standard", applicantText || postedText || "Standard posting signals");
}

function pack(isEarlyBird: boolean, tier: SalienceTier, badgeText: string): EarlyAdvantageLabels {
  return {
    isEarlyBird,
    callbackMultiplier: tier,
    salienceTier: tier,
    badgeText,
  };
}
