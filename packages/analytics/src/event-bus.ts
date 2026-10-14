/**
 * Privacy-First Event Bus
 * Tracks user actions and system events with built-in privacy controls.
 * All PII is stripped before storage/transmission.
 */

/** Event categories */
export type EventCategory =
  | "user_action"
  | "system"
  | "performance"
  | "error"
  | "feature"
  | "conversion";

/** Base event structure */
export interface AnalyticsEvent {
  /** Event name (e.g., "autofill_started") */
  name: string;
  /** Event category */
  category: EventCategory;
  /** Timestamp (ISO string) */
  timestamp: string;
  /** Event properties (PII-free) */
  properties?: Record<string, unknown>;
  /** Session ID (anonymous) */
  sessionId?: string;
  /** User ID (anonymous hash) */
  userId?: string;
}

/** Event handler function */
export type EventHandler = (event: AnalyticsEvent) => void | Promise<void>;

/** Event bus options */
export interface EventBusOptions {
  /** Enable/disable analytics */
  enabled?: boolean;
  /** Maximum events to buffer */
  maxBufferSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Storage for persisting events */
  storage?: EventStorage;
}

/** Storage interface for events */
export interface EventStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const EVENTS_STORAGE_KEY = "superjob:analytics:events";
const SESSION_KEY = "superjob:analytics:session";

/**
 * Privacy-first event bus for tracking analytics.
 */
export class EventBus {
  private enabled: boolean;
  private handlers: Map<string, EventHandler[]> = new Map();
  private buffer: AnalyticsEvent[] = [];
  private maxBufferSize: number;
  private flushInterval: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private storage: EventStorage | null = null;
  private sessionId: string;

  constructor(options: EventBusOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.maxBufferSize = options.maxBufferSize ?? 1000;
    this.flushInterval = options.flushInterval ?? 30000; // 30 seconds
    this.storage = options.storage ?? null;
    this.sessionId = this.generateSessionId();

    // Start auto-flush
    this.startAutoFlush();
  }

  /**
   * Track an event.
   */
  async track(name: string, properties?: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name,
      category: this.categorizeEvent(name),
      timestamp: new Date().toISOString(),
      properties: this.sanitizeProperties(properties),
      sessionId: this.sessionId,
    };

    // Add to buffer
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift(); // Remove oldest
    }

    // Persist if storage available
    if (this.storage) {
      await this.persistBuffer();
    }

    // Notify handlers
    await this.notifyHandlers(event);
  }

  /**
   * Track with explicit category.
   */
  async trackWithCategory(
    name: string,
    category: EventCategory,
    properties?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name,
      category,
      timestamp: new Date().toISOString(),
      properties: this.sanitizeProperties(properties),
      sessionId: this.sessionId,
    };

    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    if (this.storage) {
      await this.persistBuffer();
    }

    await this.notifyHandlers(event);
  }

  /**
   * Subscribe to events.
   */
  on(eventName: string, handler: EventHandler): () => void {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(eventName) ?? [];
      this.handlers.set(
        eventName,
        current.filter((h) => h !== handler)
      );
    };
  }

  /**
   * Subscribe to all events.
   */
  onAll(handler: EventHandler): () => void {
    return this.on("*", handler);
  }

  /**
   * Get buffered events.
   */
  getBuffer(): AnalyticsEvent[] {
    return [...this.buffer];
  }

  /**
   * Flush events (for external consumption).
   */
  async flush(): Promise<AnalyticsEvent[]> {
    const events = [...this.buffer];
    this.buffer = [];

    if (this.storage) {
      await this.storage.delete(EVENTS_STORAGE_KEY);
    }

    return events;
  }

  /**
   * Enable/disable analytics.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if analytics is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Destroy the event bus.
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.handlers.clear();
    this.buffer = [];
  }

  /**
   * Sanitize properties to remove PII.
   */
  private sanitizeProperties(
    properties?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!properties) return undefined;

    const sanitized: Record<string, unknown> = {};
    const piiPatterns = [
      /email/i,
      /phone/i,
      /name/i,
      /address/i,
      /password/i,
      /ssn/i,
      /credit/i,
    ];

    for (const [key, value] of Object.entries(properties)) {
      // Skip PII fields
      if (piiPatterns.some((p) => p.test(key))) {
        continue;
      }

      // Sanitize string values
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeStringValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a string value to remove potential PII.
   */
  private sanitizeStringValue(value: string): string {
    // Remove email patterns
    let sanitized = value.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[EMAIL]"
    );
    // Remove phone patterns
    sanitized = sanitized.replace(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      "[PHONE]"
    );
    return sanitized;
  }

  /**
   * Categorize event based on name.
   */
  private categorizeEvent(name: string): EventCategory {
    if (name.startsWith("error_")) return "error";
    if (name.startsWith("perf_")) return "performance";
    if (name.startsWith("feature_")) return "feature";
    if (name.startsWith("conversion_")) return "conversion";
    if (name.startsWith("system_")) return "system";
    return "user_action";
  }

  /**
   * Notify handlers of an event.
   */
  private async notifyHandlers(event: AnalyticsEvent): Promise<void> {
    // Specific handlers
    const handlers = this.handlers.get(event.name) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error("[analytics] Handler error:", error);
      }
    }

    // Wildcard handlers
    const allHandlers = this.handlers.get("*") ?? [];
    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error("[analytics] Handler error:", error);
      }
    }
  }

  /**
   * Start auto-flush timer.
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Persist buffer to storage.
   */
  private async persistBuffer(): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.set(EVENTS_STORAGE_KEY, JSON.stringify(this.buffer));
    } catch (error) {
      console.warn("[analytics] Failed to persist buffer:", error);
    }
  }

  /**
   * Generate anonymous session ID.
   */
  private generateSessionId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * In-memory storage for testing.
 */
export class MemoryEventStorage implements EventStorage {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
