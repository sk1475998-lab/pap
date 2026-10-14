/**
 * Telemetry event bus.
 *
 * Batches structured events and sends them via the background worker
 * every BATCH_INTERVAL_MS or on page unload.  All events are anonymous
 * and contain no PII.
 */

export interface TelemetryEvent {
  /** Event category. */
  category: "install" | "application" | "fill" | "error" | "navigation" | "performance";
  /** Event name within category. */
  name: string;
  /** Numeric value (e.g. field count, time ms). */
  value?: number;
  /** Additional dimensions. */
  dimensions?: Record<string, string | number | boolean>;
  /** Timestamp. */
  ts: number;
}

const BATCH_INTERVAL_MS = 30_000;
const MAX_QUEUE_SIZE = 100;

class TelemetryEventBus {
  private queue: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = true;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), BATCH_INTERVAL_MS);
    // Flush on page unload
    window.addEventListener("beforeunload", () => this.flush());
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.queue = [];
  }

  track(event: Omit<TelemetryEvent, "ts">): void {
    if (!this.enabled) return;
    if (this.queue.length >= MAX_QUEUE_SIZE) this.queue.shift();
    this.queue.push({ ...event, ts: Date.now() });
  }

  trackInstall(): void {
    this.track({ category: "install", name: "extension_installed" });
  }

  trackFirstApply(): void {
    this.track({ category: "application", name: "first_application" });
  }

  trackApplicationComplete(atsPlatform: string): void {
    this.track({ category: "application", name: "application_complete", dimensions: { ats: atsPlatform } });
  }

  trackFillMetrics(filled: number, skipped: number, aiAnswered: number, timeMs: number): void {
    this.track({ category: "fill", name: "fill_complete", value: filled, dimensions: { skipped, aiAnswered, timeMs } });
  }

  trackError(component: string, message: string): void {
    // Hash the error message to avoid PII
    const hash = message.slice(0, 50).replace(/[a-zA-Z0-9.@_+-]+@[a-zA-Z0-9.]+/g, "[email]");
    this.track({ category: "error", name: "runtime_error", dimensions: { component, message: hash } });
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    try {
      // Send to background worker which can proxy to analytics endpoint
      await chrome.runtime.sendMessage({ type: "SJA:TRACK_EVENTS", payload: batch });
    } catch {
      // Background worker may be unavailable — drop the batch silently
    }
  }
}

/** Singleton telemetry bus. Auto-starts when imported. */
export const telemetry = new TelemetryEventBus();