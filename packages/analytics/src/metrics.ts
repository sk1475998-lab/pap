/**
 * Metrics Collection and Aggregation
 * Tracks performance metrics, feature usage, and conversion events.
 */

/** Metric types */
export type MetricType = "counter" | "gauge" | "histogram" | "timer";

/** Metric definition */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description?: string;
  labels?: string[];
}

/** Metric value */
export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

/** Timer handle */
export interface TimerHandle {
  stop(): number; // Returns duration in ms
}

/** Metrics registry */
export class MetricsRegistry {
  private definitions: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();

  /**
   * Register a metric definition.
   */
  register(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);
    if (!this.values.has(definition.name)) {
      this.values.set(definition.name, []);
    }
  }

  /**
   * Increment a counter.
   */
  increment(name: string, labels?: Record<string, string>, value = 1): void {
    const def = this.definitions.get(name);
    if (!def || def.type !== "counter") {
      console.warn(`[metrics] Counter not registered: ${name}`);
      return;
    }

    const key = this.makeKey(name, labels);
    const values = this.values.get(name) ?? [];
    const existing = values.find((v) => this.makeKey(v.name, v.labels) === key);

    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      values.push({
        name,
        type: "counter",
        value,
        labels,
        timestamp: Date.now(),
      });
    }

    this.values.set(name, values);
  }

  /**
   * Set a gauge value.
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const def = this.definitions.get(name);
    if (!def || def.type !== "gauge") {
      console.warn(`[metrics] Gauge not registered: ${name}`);
      return;
    }

    const values = this.values.get(name) ?? [];
    const key = this.makeKey(name, labels);
    const existing = values.find((v) => this.makeKey(v.name, v.labels) === key);

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
    } else {
      values.push({
        name,
        type: "gauge",
        value,
        labels,
        timestamp: Date.now(),
      });
    }

    this.values.set(name, values);
  }

  /**
   * Record a histogram value.
   */
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const def = this.definitions.get(name);
    if (!def || def.type !== "histogram") {
      console.warn(`[metrics] Histogram not registered: ${name}`);
      return;
    }

    const values = this.values.get(name) ?? [];
    values.push({
      name,
      type: "histogram",
      value,
      labels,
      timestamp: Date.now(),
    });

    this.values.set(name, values);
  }

  /**
   * Start a timer.
   */
  startTimer(name: string, labels?: Record<string, string>): TimerHandle {
    const start = performance.now();
    return {
      stop: () => {
        const duration = performance.now() - start;
        this.observe(name, duration, labels);
        return duration;
      },
    };
  }

  /**
   * Get all metric values.
   */
  getValues(): MetricValue[] {
    const all: MetricValue[] = [];
    for (const values of this.values.values()) {
      all.push(...values);
    }
    return all;
  }

  /**
   * Get values for a specific metric.
   */
  getMetricValues(name: string): MetricValue[] {
    return this.values.get(name) ?? [];
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    for (const [name] of this.values) {
      this.values.set(name, []);
    }
  }

  /**
   * Reset a specific metric.
   */
  resetMetric(name: string): void {
    this.values.set(name, []);
  }

  /**
   * Export metrics in a simple format.
   */
  export(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, values] of this.values) {
      const def = this.definitions.get(name);
      if (!def) continue;

      switch (def.type) {
        case "counter":
        case "gauge":
          // Sum all values
          result[name] = values.reduce((sum, v) => sum + v.value, 0);
          break;
        case "histogram":
        case "timer":
          // Calculate stats
          const nums = values.map((v) => v.value);
          result[name] = {
            count: nums.length,
            sum: nums.reduce((a, b) => a + b, 0),
            avg: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
            min: nums.length > 0 ? Math.min(...nums) : 0,
            max: nums.length > 0 ? Math.max(...nums) : 0,
            p50: this.percentile(nums, 50),
            p95: this.percentile(nums, 95),
            p99: this.percentile(nums, 99),
          };
          break;
      }
    }

    return result;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  private makeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${labelStr}}`;
  }
}

/**
 * Pre-defined metrics for Super Job Agent.
 */
export function registerDefaultMetrics(registry: MetricsRegistry): void {
  // Counters
  registry.register({
    name: "autofill_attempts_total",
    type: "counter",
    description: "Total autofill attempts",
  });
  registry.register({
    name: "autofill_success_total",
    type: "counter",
    description: "Total successful autofills",
  });
  registry.register({
    name: "applications_submitted_total",
    type: "counter",
    description: "Total applications submitted",
  });
  registry.register({
    name: "llm_requests_total",
    type: "counter",
    description: "Total LLM API requests",
    labels: ["provider", "tier"],
  });

  // Gauges
  registry.register({
    name: "active_campaigns",
    type: "gauge",
    description: "Number of active application campaigns",
  });
  registry.register({
    name: "profile_completeness",
    type: "gauge",
    description: "Profile completeness percentage",
  });

  // Histograms
  registry.register({
    name: "autofill_duration_ms",
    type: "histogram",
    description: "Autofill duration in milliseconds",
  });
  registry.register({
    name: "llm_request_duration_ms",
    type: "histogram",
    description: "LLM request duration in milliseconds",
    labels: ["provider"],
  });
  registry.register({
    name: "page_load_duration_ms",
    type: "histogram",
    description: "Page load duration in milliseconds",
  });

  // Timers
  registry.register({
    name: "application_flow_duration_ms",
    type: "timer",
    description: "Full application flow duration",
  });
}
