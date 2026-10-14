/**
 * @superjob/analytics
 * Privacy-preserving analytics for Super Job Agent.
 * 
 * Features:
 * - Privacy-first: All PII is stripped before storage
 * - Event bus with handlers and buffering
 * - Metrics collection (counters, gauges, histograms, timers)
 * - Local-first with optional cloud sync
 */

// Event Bus
export {
  EventBus,
  MemoryEventStorage,
  type EventCategory,
  type AnalyticsEvent,
  type EventHandler,
  type EventBusOptions,
  type EventStorage,
} from "./event-bus.js";

// Metrics
export {
  MetricsRegistry,
  registerDefaultMetrics,
  type MetricType,
  type MetricDefinition,
  type MetricValue,
  type TimerHandle,
} from "./metrics.js";

// Tracker
export {
  AnalyticsTracker,
  type ApplicationMetrics,
} from "./tracker.js";

