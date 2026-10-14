/**
 * Autopilot Scheduler — recurring automatic application sessions
 */
import { startAutopilot, stopAutopilot, getStatus } from "./pipeline-runner.js";

export interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  dailyTime?: string; // "09:00"
  maxAppsPerRun?: number;
}

class AutopilotScheduler {
  private config: ScheduleConfig = {
    enabled: false,
    intervalHours: 6,
    dailyTime: "09:00",
    maxAppsPerRun: 10,
  };

  private timer: NodeJS.Timeout | null = null;
  private lastRun: number | null = null;

  start(config?: Partial<ScheduleConfig>) {
    if (config) {
      this.config = { ...this.config, ...config, enabled: true };
    } else {
      this.config.enabled = true;
    }

    if (this.timer) clearInterval(this.timer);

    const ms = Math.max(1, this.config.intervalHours) * 3600 * 1000;
    this.timer = setInterval(() => {
      this.triggerScheduledRun();
    }, ms);

    console.log(`[Scheduler] Active: running every ${this.config.intervalHours} hours.`);
  }

  stop() {
    this.config.enabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[Scheduler] Stopped.");
  }

  async triggerScheduledRun() {
    const status = getStatus();
    if (status.running) {
      console.log("[Scheduler] Autopilot is already active, skipping scheduled run.");
      return;
    }
    console.log("[Scheduler] ⏰ Triggering scheduled autopilot session...");
    this.lastRun = Date.now();
    try {
      await startAutopilot({ maxApplications: this.config.maxAppsPerRun ?? 10 });
    } catch (e: any) {
      console.error("[Scheduler] Error running scheduled autopilot:", e.message);
    }
  }

  getStatus() {
    return {
      config: this.config,
      lastRun: this.lastRun,
      nextEstimatedRun: this.lastRun
        ? this.lastRun + this.config.intervalHours * 3600 * 1000
        : (this.config.enabled ? Date.now() + this.config.intervalHours * 3600 * 1000 : null),
    };
  }
}

export const scheduler = new AutopilotScheduler();
