/**
 * Per-source submission policy data. Add a source policy here (or provide one
 * at construction) without editing the generic rate governor.
 */
export interface SourceRatePolicy {
  dailyLimit: number;
  minIntervalMinutes: number;
}

export const SOURCE_RATE_POLICIES: Readonly<Record<string, SourceRatePolicy>> = {
  linkedin: { dailyLimit: 12, minIntervalMinutes: 20 },
  naukri: { dailyLimit: 15, minIntervalMinutes: 15 },
  shine: { dailyLimit: 15, minIntervalMinutes: 15 },
  foundit: { dailyLimit: 12, minIntervalMinutes: 20 },
  workday: { dailyLimit: 8, minIntervalMinutes: 30 },
  greenhouse: { dailyLimit: 8, minIntervalMinutes: 30 },
  // New platforms (ported from first2apply's SiteProvider enum)
  indeed: { dailyLimit: 15, minIntervalMinutes: 15 },
  glassdoor: { dailyLimit: 12, minIntervalMinutes: 20 },
  dice: { dailyLimit: 15, minIntervalMinutes: 15 },
  ziprecruiter: { dailyLimit: 12, minIntervalMinutes: 20 },
  remoteok: { dailyLimit: 20, minIntervalMinutes: 10 },
  wellfound: { dailyLimit: 10, minIntervalMinutes: 25 },
  lever: { dailyLimit: 8, minIntervalMinutes: 30 },
  ashby: { dailyLimit: 8, minIntervalMinutes: 30 },
};
