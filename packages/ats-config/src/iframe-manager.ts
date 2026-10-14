/**
 * Iframe Autofill Manager
 *
 * Enterprise cross-origin iframe communication for autofilling forms embedded in iframes.
 *
 * Key features:
 * - postMessage protocol with handshake and bidirectional acknowledgment
 * - Iframe domain detection from ATS site registry
 * - Iframe overlay creation for seamless content injection
 * - Resilient timeout and retry logic for message passing
 *
 * Architecture:
 * Parent Page (content script)          Iframe (injected content script)
 * ┌─────────────────────────┐           ┌─────────────────────────┐
 * │ IframeAutofillManager   │           │ IframeContentHandler    │
 * │                         │           │                         │
 * │ 1. Detect iframe        │           │                         │
 * │ 2. Inject content script│──load──>  │ 3. Listen for messages  │
 * │ 4. Send FILL_REQUEST    │──post──>  │ 5. Receive & fill       │
 * │                         │           │ 6. Send FILL_RESULT     │
 * │ 7. Receive result       │<──post──  │                         │
 * └─────────────────────────┘           └─────────────────────────┘
 */

/** Message types for iframe communication protocol */
export type IframeMessageType =
  | "SJA_HANDSHAKE"
  | "SJA_HANDSHAKE_ACK"
  | "SJA_FILL_REQUEST"
  | "SJA_FILL_RESULT"
  | "SJA_SCAN_FIELDS"
  | "SJA_SCAN_RESULT"
  | "SJA_PING"
  | "SJA_PONG";

/** Base message structure */
interface IframeMessage {
  type: IframeMessageType;
  source: "super-job-agent";
  /** Per-iframe capability established during the parent handshake. */
  nonce?: string;
  requestId?: string;
  payload?: unknown;
}

/** Fill request payload */
export interface FillRequestPayload {
  /** Field values to fill: label -> value */
  fieldValues: Record<string, string>;
  /** Specific field selectors to fill */
  selectors?: Record<string, string>;
  /** Whether to submit after filling */
  autoSubmit?: boolean;
  /** Timeout for fill operations (ms) */
  timeout?: number;
}

/** Fill result payload */
export interface FillResultPayload {
  success: boolean;
  filledFields: string[];
  failedFields: string[];
  errors: Array<{ field: string; error: string }>;
  duration: number;
}

/** Scan result payload */
export interface ScanResultPayload {
  fields: Array<{
    label: string | null;
    type: string;
    name: string | null;
    id: string | null;
    required: boolean;
  }>;
  fieldCount: number;
}

/** Iframe entry tracking */
interface IframeEntry {
  iframe: HTMLIFrameElement;
  /** Capability nonce that every child message must echo. */
  nonce: string;
  injected: boolean;
  ready: boolean;
  lastPing: number;
  pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>;
}

/** Manager configuration */
export interface IframeAutofillOptions {
  /** Timeout for handshake (ms) */
  handshakeTimeout?: number;
  /** Timeout for fill operations (ms) */
  fillTimeout?: number;
  /** Interval for keepalive pings (ms) */
  pingInterval?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Allowed iframe domains (from site registry) */
  allowedDomains?: string[];
  /** Auto-inject content script into iframes */
  autoInject?: boolean;
}

const DEFAULT_IFRAME_OPTIONS: Required<IframeAutofillOptions> = {
  handshakeTimeout: 5000,
  fillTimeout: 10000,
  pingInterval: 30000,
  maxRetries: 3,
  allowedDomains: [],
  autoInject: true,
};

/** Generate unique request ID */
let requestCounter = 0;
function generateRequestId(): string {
  return `sja_${Date.now()}_${++requestCounter}`;
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Iframe Autofill Manager
 *
 * Manages detection, injection, and communication with iframes
 * for cross-origin form filling.
 */
export class IframeAutofillManager {
  private entries = new Map<HTMLIFrameElement, IframeEntry>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private mutationObserver: MutationObserver | null = null;
  private options: Required<IframeAutofillOptions>;

  constructor(options: IframeAutofillOptions = {}) {
    this.options = { ...DEFAULT_IFRAME_OPTIONS, ...options };
  }

  /**
   * Start monitoring for iframes and manage autofill.
   */
  start(): void {
    // Listen for postMessage from iframes
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener("message", this.messageHandler);

    // Scan for existing iframes
    this.scanExistingIframes();

    // Watch for new iframes being added
    this.startMutationObserver();

    // Start keepalive pings
    this.startPingInterval();
  }

  /**
   * Stop monitoring and clean up all resources.
   */
  stop(): void {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    // Clean up all entries
    for (const entry of this.entries.values()) {
      for (const pending of entry.pendingRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Manager stopped"));
      }
      entry.pendingRequests.clear();
    }
    this.entries.clear();
  }

  /**
   * Send fill request to a specific iframe.
   */
  async fillIframe(
    iframe: HTMLIFrameElement,
    fieldValues: Record<string, string>,
    options: { autoSubmit?: boolean; timeout?: number } = {}
  ): Promise<FillResultPayload> {
    const entry = this.entries.get(iframe);
    if (!entry) {
      throw new Error("Iframe not tracked. Call scanIframe() first.");
    }

    // Wait for handshake if not ready
    if (!entry.ready) {
      await this.waitForHandshake(iframe);
    }

    const timeout = options.timeout ?? this.options.fillTimeout;
    const requestId = generateRequestId();

    const payload: FillRequestPayload = {
      fieldValues,
      autoSubmit: options.autoSubmit,
      timeout,
    };

    return this.sendMessage(iframe, "SJA_FILL_REQUEST", payload, requestId, timeout) as Promise<FillResultPayload>;
  }

  /**
   * Scan fields in an iframe.
   */
  async scanIframeFields(iframe: HTMLIFrameElement): Promise<ScanResultPayload> {
    const entry = this.entries.get(iframe);
    if (!entry) {
      throw new Error("Iframe not tracked. Call scanIframe() first.");
    }

    if (!entry.ready) {
      await this.waitForHandshake(iframe);
    }

    const requestId = generateRequestId();
    return this.sendMessage(
      iframe,
      "SJA_SCAN_FIELDS",
      {},
      requestId,
      this.options.handshakeTimeout
    ) as Promise<ScanResultPayload>;
  }

  /**
   * Get all tracked iframes.
   */
  getTrackedIframes(): HTMLIFrameElement[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all ready iframes.
   */
  getReadyIframes(): HTMLIFrameElement[] {
    return Array.from(this.entries.entries())
      .filter(([, entry]) => entry.ready)
      .map(([iframe]) => iframe);
  }

  /**
   * Check if an iframe is from an allowed domain.
   */
  private isAllowedDomain(iframe: HTMLIFrameElement): boolean {
    try {
      const src = new URL(iframe.src);
      const hostname = src.hostname;

      // If no allowed domains configured, allow all
      if (this.options.allowedDomains.length === 0) return true;

      return this.options.allowedDomains.some((domain) => {
        if (hostname === domain) return true;
        if (hostname.endsWith("." + domain)) return true;
        return false;
      });
    } catch {
      return false;
    }
  }

  /**
   * Scan for existing iframes on the page.
   */
  private scanExistingIframes(): void {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      this.trackIframe(iframe);
    }
  }

  /**
   * Track a new iframe for autofill management.
   */
  trackIframe(iframe: HTMLIFrameElement): void {
    if (this.entries.has(iframe)) return;
    if (!this.isAllowedDomain(iframe)) return;

    const entry: IframeEntry = {
      iframe,
      nonce: generateNonce(),
      injected: false,
      ready: false,
      lastPing: Date.now(),
      pendingRequests: new Map(),
    };

    this.entries.set(iframe, entry);

    // Auto-inject content script if enabled
    if (this.options.autoInject) {
      this.injectContentScript(iframe, entry);
    }
  }

  /**
   * Inject content script into an iframe.
   * For same-origin iframes, we can directly access the contentDocument.
   * For cross-origin iframes, we rely on postMessage protocol.
   */
  private injectContentScript(
    iframe: HTMLIFrameElement,
    entry: IframeEntry
  ): void {
    try {
      // Try same-origin access first
      const doc = iframe.contentDocument;
      if (doc) {
        // Same-origin: inject script directly
        const script = doc.createElement("script");
        script.textContent = this.getIframeHandlerScript();
        doc.head?.appendChild(script);
        entry.injected = true;

        // Send handshake
        this.sendHandshake(iframe);
      }
    } catch {
      // Cross-origin: rely on postMessage protocol
      // The iframe should have its own content script that listens for our messages
      this.sendHandshake(iframe);
    }

    // Set a timeout for handshake
    setTimeout(() => {
      if (!entry.ready) {
        // Retry injection after timeout
        if (!entry.injected) {
          this.injectContentScript(iframe, entry);
        }
      }
    }, this.options.handshakeTimeout);
  }

  /**
   * Send handshake message to iframe.
   * SECURITY: Use specific origin instead of "*" to prevent message interception.
   */
  private sendHandshake(iframe: HTMLIFrameElement): void {
    const entry = this.entries.get(iframe);
    if (!entry) return;
    const message: IframeMessage = {
      type: "SJA_HANDSHAKE",
      source: "super-job-agent",
      nonce: entry.nonce,
    };

    try {
      // Extract origin from iframe src for secure postMessage
      const targetOrigin = this.getIframeOrigin(iframe);
      iframe.contentWindow?.postMessage(message, targetOrigin);
    } catch {
      // Iframe may not be ready yet
    }
  }

  /**
   * Get the origin of an iframe's src URL.
   * Returns "*" only as a fallback for relative URLs or about:blank.
   */
  private getIframeOrigin(iframe: HTMLIFrameElement): string {
    try {
      const src = new URL(iframe.src, window.location.href);
      return src.origin;
    } catch {
      return "*";
    }
  }

  /**
   * Wait for iframe handshake to complete.
   */
  private waitForHandshake(iframe: HTMLIFrameElement): Promise<void> {
    const entry = this.entries.get(iframe);
    if (!entry) return Promise.reject(new Error("Iframe not tracked"));
    if (entry.ready) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Handshake timeout"));
      }, this.options.handshakeTimeout);

      // Check periodically
      const check = setInterval(() => {
        if (entry.ready) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Send a message to an iframe and wait for response.
   */
  private sendMessage(
    iframe: HTMLIFrameElement,
    type: IframeMessageType,
    payload: unknown,
    requestId: string,
    timeout: number
  ): Promise<unknown> {
    const entry = this.entries.get(iframe);
    if (!entry) return Promise.reject(new Error("Iframe not tracked"));

    const message: IframeMessage = {
      type,
      source: "super-job-agent",
      nonce: entry.nonce,
      requestId,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        entry.pendingRequests.delete(requestId);
        reject(new Error(`Message timeout: ${type}`));
      }, timeout);

      entry.pendingRequests.set(requestId, { resolve, reject, timeout: timer });

      try {
        const targetOrigin = this.getIframeOrigin(iframe);
        iframe.contentWindow?.postMessage(message, targetOrigin);
      } catch (err) {
        entry.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  /**
   * Handle incoming postMessage from iframes.
   * SECURITY: Validate message origin to prevent spoofing.
   */
  private handleMessage(event: MessageEvent): void {
    const data = event.data as IframeMessage;
    if (!data || data.source !== "super-job-agent") return;

    // SECURITY: Validate that the message comes from a tracked iframe
    // and that the origin matches the iframe's src origin
    let sourceIframe: HTMLIFrameElement | null = null;
    for (const [iframe] of this.entries) {
      if (iframe.contentWindow === event.source) {
        // Verify origin matches iframe's expected origin
        const expectedOrigin = this.getIframeOrigin(iframe);
        if (expectedOrigin !== "*" && event.origin !== expectedOrigin) {
          console.warn("[IframeManager] Message from unexpected origin:", event.origin);
          continue;
        }
        sourceIframe = iframe;
        break;
      }
    }

    if (!sourceIframe) return;
    const entry = this.entries.get(sourceIframe);
    if (!entry || data.nonce !== entry.nonce) return;

    switch (data.type) {
      case "SJA_HANDSHAKE_ACK":
        entry.ready = true;
        entry.lastPing = Date.now();
        break;

      case "SJA_FILL_RESULT":
      case "SJA_SCAN_RESULT":
        if (data.requestId) {
          const pending = entry.pendingRequests.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            entry.pendingRequests.delete(data.requestId);
            pending.resolve(data.payload);
          }
        }
        break;

      case "SJA_PONG":
        entry.lastPing = Date.now();
        break;
    }
  }

  /**
   * Start mutation observer to detect new iframes.
   */
  private startMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            this.trackIframe(node);
          }
          // Also check children for iframes
          if (node instanceof HTMLElement) {
            const iframes = node.querySelectorAll("iframe");
            for (const iframe of iframes) {
              this.trackIframe(iframe);
            }
          }
        }
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Start periodic ping to check iframe health.
   * Collects keys first to avoid modifying Map during iteration.
   */
  private startPingInterval(): void {
    this.pingTimer = setInterval(() => {
      // Collect entries first to avoid modifying Map during iteration
      const entries = Array.from(this.entries.entries());
      for (const [iframe, entry] of entries) {
        if (entry.ready) {
          const message: IframeMessage = {
            type: "SJA_PING",
            source: "super-job-agent",
            nonce: entry.nonce,
          };
          try {
            const targetOrigin = this.getIframeOrigin(iframe);
            iframe.contentWindow?.postMessage(message, targetOrigin);
          } catch {
            // Iframe may have been removed - clean up
            this.entries.delete(iframe);
          }
        }
      }
    }, this.options.pingInterval);
  }

  /**
   * Get the iframe handler content script.
   * This script runs inside the iframe and handles fill requests.
   */
  private getIframeHandlerScript(): string {
    return `
      (function() {
        if (window.__SJA_IFRAME_HANDLER__) return;
        window.__SJA_IFRAME_HANDLER__ = true;
        var trustedParentOrigin = null;
        var trustedParent = null;
        var trustedNonce = null;
        function reply(message) {
          if (!trustedParentOrigin || !trustedParent || !trustedNonce) return;
          message.nonce = trustedNonce;
          trustedParent.postMessage(message, trustedParentOrigin);
        }

        // Bind only to the real parent window and the nonce it generated. A
        // same-shaped postMessage from another window must never trigger filling.
        window.addEventListener('message', function(event) {
          var data = event.data;
          if (!data || data.source !== 'super-job-agent' || event.source !== window.parent) return;

          if (data.type === 'SJA_HANDSHAKE') {
            if (!data.nonce || event.origin === 'null') return;
            if (trustedParentOrigin && (trustedParentOrigin !== event.origin || trustedParent !== event.source || trustedNonce !== data.nonce)) return;
            trustedParentOrigin = event.origin;
            trustedParent = event.source;
            trustedNonce = data.nonce;
            reply({
              type: 'SJA_HANDSHAKE_ACK',
              source: 'super-job-agent',
            });
            return;
          }

          if (!trustedParentOrigin || event.origin !== trustedParentOrigin || event.source !== trustedParent || data.nonce !== trustedNonce) return;
          switch (data.type) {
            case 'SJA_FILL_REQUEST':
              handleFillRequest(data.payload, data.requestId);
              break;

            case 'SJA_SCAN_FIELDS':
              handleScanRequest(data.requestId);
              break;

            case 'SJA_PING':
              reply({
                type: 'SJA_PONG',
                source: 'super-job-agent',
              });
              break;
          }
        });

        function handleFillRequest(payload, requestId) {
          var startTime = Date.now();
          var filledFields = [];
          var failedFields = [];
          var errors = [];

          try {
            var fieldValues = payload.fieldValues || {};
            
            // Scan form fields
            var fields = document.querySelectorAll('input, select, textarea');
            
            for (var i = 0; i < fields.length; i++) {
              var field = fields[i];
              var label = getFieldLabel(field);
              
              if (label && fieldValues[label]) {
                try {
                  setFieldValue(field, fieldValues[label]);
                  filledFields.push(label);
                } catch (err) {
                  failedFields.push(label);
                  errors.push({ field: label, error: err.message });
                }
              }
            }

            reply({
              type: 'SJA_FILL_RESULT',
              source: 'super-job-agent',
              requestId: requestId,
              payload: {
                success: failedFields.length === 0,
                filledFields: filledFields,
                failedFields: failedFields,
                errors: errors,
                duration: Date.now() - startTime,
              },
            });
          } catch (err) {
            reply({
              type: 'SJA_FILL_RESULT',
              source: 'super-job-agent',
              requestId: requestId,
              payload: {
                success: false,
                filledFields: filledFields,
                failedFields: failedFields,
                errors: [{ field: 'unknown', error: err.message }],
                duration: Date.now() - startTime,
              },
            });
          }
        }

        function handleScanRequest(requestId) {
          var fields = [];
          var elements = document.querySelectorAll('input, select, textarea');
          
          for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            fields.push({
              label: getFieldLabel(el),
              type: el.type || el.tagName.toLowerCase(),
              name: el.name || null,
              id: el.id || null,
              required: el.hasAttribute('required'),
            });
          }

          reply({
            type: 'SJA_SCAN_RESULT',
            source: 'super-job-agent',
            requestId: requestId,
            payload: {
              fields: fields,
              fieldCount: fields.length,
            },
          });
        }

        function getFieldLabel(field) {
          // Try id + label[for]
          if (field.id) {
            var label = document.querySelector('label[for="' + field.id + '"]');
            if (label && label.textContent) return label.textContent.trim();
          }
          
          // Try parent label
          var parentLabel = field.closest('label');
          if (parentLabel) {
            var clone = parentLabel.cloneNode(true);
            var inputs = clone.querySelectorAll('input, select, textarea');
            inputs.forEach(function(i) { i.remove(); });
            if (clone.textContent) return clone.textContent.trim();
          }
          
          // Try aria-label
          if (field.getAttribute('aria-label')) return field.getAttribute('aria-label');
          
          // Try placeholder
          if (field.placeholder) return field.placeholder;
          
          return field.name || field.id || null;
        }

        function setFieldValue(field, value) {
          // Use native setter for React compatibility
          var nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          
          if (nativeSetter) {
            nativeSetter.call(field, value);
          } else {
            field.value = value;
          }
          
          // Dispatch events
          field.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
          field.dispatchEvent(new InputEvent('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        }
      })();
    `;
  }
}
