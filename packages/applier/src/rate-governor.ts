import { getStore } from "@superjob/core";
import { SOURCE_RATE_POLICIES, type SourceRatePolicy } from "./sources/rate-policies.js";

export interface PlatformLimit extends SourceRatePolicy {
  platform: string;
  appliedToday: number;
  lastAppliedAt: Date | null;
}

export interface RateGovernorOptions {
  policies?: Readonly<Record<string, SourceRatePolicy>>;
  globalDailyLimit?: number;
  /** Backward-compatible IST options */
  startHourIST?: number;
  endHourIST?: number;
  /** Global operating window options */
  startHour?: number;
  endHour?: number;
  timezoneOffsetHours?: number;
  enforceOperatingHours?: boolean;
  now?: () => Date;
}

export class RateGovernor {
  private readonly policies: Readonly<Record<string, SourceRatePolicy>>;
  private readonly globalDailyLimit: number;
  private readonly startHourIST?: number;
  private readonly endHourIST?: number;
  private readonly startHour: number;
  private readonly endHour: number;
  private readonly timezoneOffsetHours?: number;
  private readonly enforceOperatingHours: boolean;
  private readonly now: () => Date;

  constructor(options: RateGovernorOptions = {}) {
    this.policies = options.policies ?? SOURCE_RATE_POLICIES;
    this.globalDailyLimit = options.globalDailyLimit ?? 30;
    this.startHourIST = options.startHourIST;
    this.endHourIST = options.endHourIST;
    this.startHour = options.startHour ?? (options.startHourIST ?? 7);
    this.endHour = options.endHour ?? (options.endHourIST ?? 22);
    this.timezoneOffsetHours = options.timezoneOffsetHours;
    this.enforceOperatingHours = options.enforceOperatingHours ?? (options.startHourIST !== undefined || options.endHourIST !== undefined);
    this.now = options.now ?? (() => new Date());
  }

  private getTodayDateString(now: Date): string {
    if (this.startHourIST !== undefined || this.endHourIST !== undefined) {
      return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    if (this.timezoneOffsetHours !== undefined) {
      return new Date(now.getTime() + this.timezoneOffsetHours * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  private async loadState(): Promise<{
    globalAppliedToday: number;
    platformApplies: Record<string, { appliedToday: number; lastAppliedAt: string | null }>;
    lastResetDate: string | null;
  }> {
    const store = getStore();
    const data = await store.get("rate_governor_state") as any;
    const todayStr = this.getTodayDateString(this.now());

    if (!data || data.lastResetDate !== todayStr) {
      return {
        globalAppliedToday: 0,
        platformApplies: {},
        lastResetDate: todayStr,
      };
    }
    return data;
  }

  private async saveState(state: any): Promise<void> {
    const store = getStore();
    await store.set("rate_governor_state", state);
  }

  /**
   * Determine if an application can be sent.
   */
  async canApply(platform: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = this.now();

    if (this.enforceOperatingHours) {
      let hour: number;
      let tzLabel: string;
      if (this.startHourIST !== undefined || this.endHourIST !== undefined) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        hour = istTime.getUTCHours();
        tzLabel = "IST";
      } else if (this.timezoneOffsetHours !== undefined) {
        const offsetTime = new Date(now.getTime() + this.timezoneOffsetHours * 60 * 60 * 1000);
        hour = offsetTime.getUTCHours();
        tzLabel = `UTC${this.timezoneOffsetHours >= 0 ? "+" : ""}${this.timezoneOffsetHours}`;
      } else {
        hour = now.getHours();
        tzLabel = "local time";
      }

      if (hour < this.startHour || hour >= this.endHour) {
        return { allowed: false, reason: `Outside permitted hours of operations (${this.startHour}:00 - ${this.endHour}:00 ${tzLabel})` };
      }
    }

    const state = await this.loadState();

    if (state.globalAppliedToday >= this.globalDailyLimit) {
      return { allowed: false, reason: `Reached global daily application threshold (${this.globalDailyLimit})` };
    }

    const platformLimit = this.policies[platform];
    if (!platformLimit) return { allowed: true };

    const savedPlatformState = state.platformApplies[platform] || { appliedToday: 0, lastAppliedAt: null };

    if (savedPlatformState.appliedToday >= platformLimit.dailyLimit) {
      return { allowed: false, reason: `Reached daily limits for ${platform} (${platformLimit.dailyLimit})` };
    }

    if (savedPlatformState.lastAppliedAt) {
      const lastAppliedDate = new Date(savedPlatformState.lastAppliedAt);
      const diffMs = now.getTime() - lastAppliedDate.getTime();
      const minIntervalMs = platformLimit.minIntervalMinutes * 60 * 1000;
      if (diffMs < minIntervalMs) {
        const waitMinutes = Math.ceil((minIntervalMs - diffMs) / (60 * 1000));
        return { allowed: false, reason: `Minimum time buffer rule active. Wait ${waitMinutes} minutes before trying again.` };
      }
    }

    return { allowed: true };
  }

  /**
   * Records a successful application submission.
   */
  async recordSuccess(platform: string): Promise<void> {
    const state = await this.loadState();
    state.globalAppliedToday++;
    if (!state.platformApplies[platform]) {
      state.platformApplies[platform] = { appliedToday: 0, lastAppliedAt: null };
    }
    state.platformApplies[platform].appliedToday++;
    state.platformApplies[platform].lastAppliedAt = new Date().toISOString();
    await this.saveState(state);
  }

  /**
   * Reset limits at the end of the day.
   */
  async resetDailyLimits(): Promise<void> {
    const todayStr = this.getTodayDateString(this.now());
    const state = {
      globalAppliedToday: 0,
      platformApplies: {},
      lastResetDate: todayStr,
    };
    await this.saveState(state);
  }
}

export const rateGovernor = new RateGovernor();
