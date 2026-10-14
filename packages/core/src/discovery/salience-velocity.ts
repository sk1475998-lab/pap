/**
 * Job Salience & Freshness Velocity — Inspired by LiJAR & Job2Skills (ACM SIGKDD / LinkedIn Engineering)
 *
 * Models posting time-decay and applicant congestion dynamics.
 * Identifies the "Early Bird Sweet Spot" (<48h, <30 applicants) where
 * candidate callback probability is statistically highest.
 */

export interface JobMarketDynamics {
  postedTimestamp?: number; // epoch ms
  postedAgoText?: string;   // e.g. "2 hours ago", "3 days ago"
  applicantCount?: number;
}

export interface SalienceScorecard {
  freshnessScore: number | null;     // Heuristic only; null when posting age is unknown
  congestionLevel: "low" | "moderate" | "heavy" | "saturated" | "unknown";
  isEarlyBird: boolean;
  salienceMultiplier: number; // e.g. 0.35 to 1.35
  callbackAdvantageLabel: string;
  isStaleOrGhostJob: boolean;
}

/**
 * Parses approximate hours from string like "2 hours ago", "Just posted", "3 weeks ago".
 */
export function parseHoursElapsed(text: string = ""): number | undefined {
  const norm = text.toLowerCase().trim();
  if (!norm || norm.includes("just") || norm.includes("today") || norm.includes("moment")) {
    return 1;
  }

  const hourMatch = norm.match(/(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) return parseInt(hourMatch[1], 10);

  const dayMatch = norm.match(/(\d+)\s*(?:days?|d)\b/);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24;

  const weekMatch = norm.match(/(\d+)\s*(?:weeks?|wks?|w)\b/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 24 * 7;

  const monthMatch = norm.match(/(\d+)\s*(?:months?|mos?|m)\b/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 24 * 30;

  return undefined;
}

/**
 * Computes LiJAR-style freshness decay and applicant congestion metrics.
 */
export function computeJobSalience(dynamics: JobMarketDynamics): SalienceScorecard {
  let hoursElapsed: number | undefined;

  if (dynamics.postedTimestamp) {
    const diffMs = Math.max(0, Date.now() - dynamics.postedTimestamp);
    hoursElapsed = diffMs / (1000 * 60 * 60);
  } else if (dynamics.postedAgoText) {
    hoursElapsed = parseHoursElapsed(dynamics.postedAgoText);
  }

  const applicants = dynamics.applicantCount;
  if (hoursElapsed === undefined && applicants === undefined) {
    return {
      freshnessScore: null,
      congestionLevel: "unknown",
      isEarlyBird: false,
      salienceMultiplier: 1,
      callbackAdvantageLabel: "Posting age and applicant count unavailable; no response-probability estimate",
      isStaleOrGhostJob: false,
    };
  }

  // 1. Freshness Decay: Exponential half-life model (half-life = 5 days / 120 hours)
  const decayLambda = Math.log(2) / 120;
  const rawDecay = hoursElapsed === undefined ? undefined : Math.exp(-decayLambda * hoursElapsed);
  const freshnessScore = rawDecay === undefined ? null : Math.max(5, Math.min(100, Math.round(rawDecay * 100)));

  // 2. Congestion categorization
  let congestionLevel: SalienceScorecard["congestionLevel"] = applicants === undefined ? "unknown" : "moderate";
  let congestionWeight = 1.0;

  if (applicants !== undefined && applicants < 25) {
    congestionLevel = "low";
    congestionWeight = 1.30;
  } else if (applicants !== undefined && applicants <= 100) {
    congestionLevel = "moderate";
    congestionWeight = 1.0;
  } else if (applicants !== undefined && applicants <= 300) {
    congestionLevel = "heavy";
    congestionWeight = 0.70;
  } else if (applicants !== undefined) {
    congestionLevel = "saturated";
    congestionWeight = 0.40;
  }

  // 3. Early Bird Advantage: Under 48 hours AND under 35 applicants
  const isEarlyBird = hoursElapsed !== undefined && applicants !== undefined && hoursElapsed <= 48 && applicants < 35;
  const isStaleOrGhostJob = hoursElapsed !== undefined && (hoursElapsed > 24 * 21 || (hoursElapsed > 24 * 14 && applicants !== undefined && applicants > 300));

  let salienceMultiplier = (freshnessScore === null ? 1 : freshnessScore / 100) * congestionWeight;
  if (isEarlyBird) salienceMultiplier = Math.max(salienceMultiplier, 1.25);
  salienceMultiplier = Math.max(0.2, Math.min(1.4, Math.round(salienceMultiplier * 100) / 100));

  let callbackAdvantageLabel = "Posting-age/applicant-count heuristic; not a response-probability estimate";
  if (isEarlyBird) {
    callbackAdvantageLabel = "Recently posted with lower listed applicant volume (heuristic)";
  } else if (congestionLevel === "saturated") {
    callbackAdvantageLabel = "High listed applicant volume (heuristic)";
  } else if (isStaleOrGhostJob) {
    callbackAdvantageLabel = "Older listing; verify it is still open";
  }

  return {
    freshnessScore,
    congestionLevel,
    isEarlyBird,
    salienceMultiplier,
    callbackAdvantageLabel,
    isStaleOrGhostJob,
  };
}
