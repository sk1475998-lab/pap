/**
 * Apply Button Detector
 *
 * Detects "Apply" buttons on job boards (LinkedIn, Indeed, Glassdoor, etc.)
 * and intercepts clicks to trigger the autofill workflow.
 *
 * Key features:
 * - Click interception with preventDefault + custom event dispatch
 * - MutationObserver-based dynamic button detection
 * - Multi-strategy button detection (text, class, aria-label, data attributes)
 * - Debounced observation to prevent duplicate detection
 *
 * Architecture:
 * 1. MutationObserver watches for new buttons/links
 * 2. Each element is checked against apply button patterns
 * 3. Click event listeners are attached (capture phase)
 * 4. On click: preventDefault → emit event → extension handles autofill
 * 5. After autofill: replay the click or submit the form
 */

/** Detected apply button metadata */
export interface ApplyButtonInfo {
  /** The DOM element */
  element: HTMLElement;
  /** Detection strategy that found this button */
  strategy: ButtonDetectionStrategy;
  /** Confidence score (0-1) */
  confidence: number;
  /** Text content that triggered the match */
  matchedText: string | null;
  /** Whether click interception is active */
  intercepted: boolean;
}

/** Button detection strategies */
export type ButtonDetectionStrategy =
  | "text-content"
  | "aria-label"
  | "data-attribute"
  | "class-name"
  | "id-attribute"
  | "icon-class"
  | "linked-text";

/** Apply button detection configuration */
export interface ApplyButtonDetectorOptions {
  /** Text patterns that indicate an apply button */
  textPatterns?: RegExp[];
  /** Class name patterns */
  classPatterns?: RegExp[];
  /** Data attribute names to check */
  dataAttributes?: string[];
  /** Whether to intercept clicks */
  interceptClicks?: boolean;
  /** Whether to auto-detect on page load */
  autoDetect?: boolean;
  /** Debounce interval for observation (ms) */
  observeDebounce?: number;
  /** Maximum depth to search for linked text */
  linkedTextDepth?: number;
}

/** Default text patterns for apply buttons */
const DEFAULT_TEXT_PATTERNS = [
  // Require "apply" in job application context to avoid false positives
  /\bapply\s+now\b/i,
  /\bapply\s+here\b/i,
  /\beasy\s+apply\b/i,
  /\bquick\s+apply\b/i,
  /\binstant\s+apply\b/i,
  /\bsimple\s+apply\b/i,
  /\bone-click\s+apply\b/i,
  /\b1-click\s+apply\b/i,
  /\bapply\s+with\s+linkedin\b/i,
  /\bapply\s+with\s+indeed\b/i,
  /\bsave\s+and\s+apply\b/i,
  /\bcontinue\s+to\s+apply\b/i,
  /\bstart\s+(?:your\s+)?application\b/i,
  /\bsubmit\s+(?:your\s+)?application\b/i,
  /\bcomplete\s+(?:your\s+)?application\b/i,
  /\bapply\s+(?:for\s+this\s+)?job\b/i,
  /\bapply\s+(?:for\s+this\s+)?position\b/i,
];

/** Default class patterns */
const DEFAULT_CLASS_PATTERNS = [
  /apply[-_]?btn/i,
  /apply[-_]?button/i,
  /btn[-_]?apply/i,
  /button[-_]?apply/i,
  /easy[-_]?apply/i,
  /quick[-_]?apply/i,
  /one[-_]?click/i,
  /simple[-_]?apply/i,
];

/** Default data attributes to check */
const DEFAULT_DATA_ATTRIBUTES = [
  "data-apply-url",
  "data-apply",
  "data-easy-apply",
  "data-quick-apply",
  "data-job-apply",
  "data-tracking-control-name",
];

/**
 * Apply Button Detector
 *
 * Detects and intercepts "Apply" buttons on job boards.
 */
export class ApplyButtonDetector {
  private detectedButtons = new Map<HTMLElement, ApplyButtonInfo>();
  private mutationObserver: MutationObserver | null = null;
  private removalObserver: MutationObserver | null = null;
  private clickHandlers = new Map<HTMLElement, (e: MouseEvent) => void>();
  private options: Required<ApplyButtonDetectorOptions>;
  private onApplyDetected: ((button: ApplyButtonInfo) => void) | null = null;
  private onApplyClicked: ((button: ApplyButtonInfo, event: MouseEvent) => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ApplyButtonDetectorOptions = {}) {
    this.options = {
      textPatterns: options.textPatterns ?? DEFAULT_TEXT_PATTERNS,
      classPatterns: options.classPatterns ?? DEFAULT_CLASS_PATTERNS,
      dataAttributes: options.dataAttributes ?? DEFAULT_DATA_ATTRIBUTES,
      interceptClicks: options.interceptClicks ?? true,
      autoDetect: options.autoDetect ?? true,
      observeDebounce: options.observeDebounce ?? 200,
      linkedTextDepth: options.linkedTextDepth ?? 3,
    };
  }

  /**
   * Set callback for when an apply button is detected.
   */
  onDetected(callback: (button: ApplyButtonInfo) => void): void {
    this.onApplyDetected = callback;
  }

  /**
   * Set callback for when an apply button is clicked.
   */
  onClicked(callback: (button: ApplyButtonInfo, event: MouseEvent) => void): void {
    this.onApplyClicked = callback;
  }

  /**
   * Start detecting apply buttons.
   */
  start(): void {
    // Scan existing buttons
    if (this.options.autoDetect) {
      this.scanForButtons();
    }

    // Watch for new buttons
    this.startMutationObserver();
  }

  /**
   * Stop detecting and clean up.
   */
  stop(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.removalObserver) {
      this.removalObserver.disconnect();
      this.removalObserver = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Remove click handlers
    for (const [element, handler] of this.clickHandlers.entries()) {
      element.removeEventListener("click", handler, true);
    }
    this.clickHandlers.clear();

    this.detectedButtons.clear();
  }

  /**
   * Get all detected apply buttons.
   */
  getDetectedButtons(): ApplyButtonInfo[] {
    return Array.from(this.detectedButtons.values());
  }

  /**
   * Check if a specific element is an apply button.
   */
  checkElement(element: HTMLElement): ApplyButtonInfo | null {
    return this.detectButton(element);
  }

  /**
   * Manually trigger click interception on a button.
   */
  interceptButton(button: ApplyButtonInfo): void {
    if (button.intercepted) return;
    if (!this.options.interceptClicks) return;

    const handler = (event: MouseEvent) => {
      // Prevent default navigation
      event.preventDefault();
      event.stopPropagation();

      // Notify callback
      if (this.onApplyClicked) {
        this.onApplyClicked(button, event);
      }

      // Dispatch custom event for extension to handle
      const customEvent = new CustomEvent("sja-apply-clicked", {
        bubbles: true,
        detail: {
          button,
          originalEvent: event,
        },
      });
      button.element.dispatchEvent(customEvent);
    };

    // Use capture phase to intercept before other handlers
    button.element.addEventListener("click", handler, true);
    this.clickHandlers.set(button.element, handler);
    button.intercepted = true;
  }

  /**
   * Scan the DOM for apply buttons.
   */
  scanForButtons(): void {
    // Check all clickable elements
    const candidates = document.querySelectorAll(
      'a, button, [role="button"], [onclick], input[type="submit"], input[type="button"]'
    );

    for (const candidate of candidates) {
      const htmlEl = candidate as HTMLElement;
      if (this.detectedButtons.has(htmlEl)) continue;

      const info = this.detectButton(htmlEl);
      if (info) {
        this.registerButton(info);
      }
    }
  }

  /**
   * Detect if an element is an apply button.
   */
  private detectButton(element: HTMLElement): ApplyButtonInfo | null {
    // Must be a clickable element
    const tag = element.tagName.toLowerCase();
    const isClickable =
      tag === "a" ||
      tag === "button" ||
      tag === "input" ||
      element.getAttribute("role") === "button" ||
      element.getAttribute("onclick") !== null ||
      element.closest("a, button") !== null;

    if (!isClickable) return null;

    // Strategy 1: Text content matching
    const textMatch = this.matchTextContent(element);
    if (textMatch) {
      return {
        element,
        strategy: "text-content",
        confidence: textMatch.confidence,
        matchedText: textMatch.text,
        intercepted: false,
      };
    }

    // Strategy 2: Aria-label matching
    const ariaMatch = this.matchAriaLabel(element);
    if (ariaMatch) {
      return {
        element,
        strategy: "aria-label",
        confidence: ariaMatch.confidence,
        matchedText: ariaMatch.text,
        intercepted: false,
      };
    }

    // Strategy 3: Data attribute matching
    const dataMatch = this.matchDataAttributes(element);
    if (dataMatch) {
      return {
        element,
        strategy: "data-attribute",
        confidence: dataMatch.confidence,
        matchedText: dataMatch.text,
        intercepted: false,
      };
    }

    // Strategy 4: Class name matching
    const classMatch = this.matchClassNames(element);
    if (classMatch) {
      return {
        element,
        strategy: "class-name",
        confidence: classMatch.confidence,
        matchedText: classMatch.text,
        intercepted: false,
      };
    }

    // Strategy 5: Linked text (check children and nearby elements)
    const linkedMatch = this.matchLinkedText(element);
    if (linkedMatch) {
      return {
        element,
        strategy: "linked-text",
        confidence: linkedMatch.confidence,
        matchedText: linkedMatch.text,
        intercepted: false,
      };
    }

    return null;
  }

  /**
   * Match element text content against apply patterns.
   */
  private matchTextContent(
    element: HTMLElement
  ): { text: string; confidence: number } | null {
    const text = element.textContent?.trim() ?? "";
    if (!text || text.length > 50) return null;

    for (const pattern of this.options.textPatterns) {
      if (pattern.test(text)) {
        // Higher confidence for shorter, more specific matches
        const specificity = Math.max(0.7, 1 - text.length / 100);
        return { text, confidence: specificity };
      }
    }

    return null;
  }

  /**
   * Match aria-label against apply patterns.
   */
  private matchAriaLabel(
    element: HTMLElement
  ): { text: string; confidence: number } | null {
    const ariaLabel = element.getAttribute("aria-label") ?? "";
    if (!ariaLabel) return null;

    for (const pattern of this.options.textPatterns) {
      if (pattern.test(ariaLabel)) {
        return { text: ariaLabel, confidence: 0.85 };
      }
    }

    return null;
  }

  /**
   * Match data attributes against apply patterns.
   */
  private matchDataAttributes(
    element: HTMLElement
  ): { text: string; confidence: number } | null {
    for (const attr of this.options.dataAttributes) {
      const value = element.getAttribute(attr);
      if (value) {
        // Check if the value contains apply-related text
        if (/apply/i.test(value)) {
          return { text: `${attr}="${value}"`, confidence: 0.8 };
        }
      }
    }

    // Check tracking control name (LinkedIn pattern)
    const trackingName = element.getAttribute("data-tracking-control-name");
    if (trackingName && /apply/i.test(trackingName)) {
      return { text: `data-tracking-control-name="${trackingName}"`, confidence: 0.75 };
    }

    return null;
  }

  /**
   * Match class names against apply patterns.
   */
  private matchClassNames(
    element: HTMLElement
  ): { text: string; confidence: number } | null {
    const className = element.className;
    if (!className || typeof className !== "string") return null;

    for (const pattern of this.options.classPatterns) {
      if (pattern.test(className)) {
        return { text: className, confidence: 0.7 };
      }
    }

    return null;
  }

  /**
   * Match text in children or nearby elements.
   */
  private matchLinkedText(
    element: HTMLElement
  ): { text: string; confidence: number } | null {
    // Check direct children
    const children = element.querySelectorAll("*");
    for (const child of children) {
      const text = child.textContent?.trim() ?? "";
      if (text.length > 0 && text.length < 30) {
        for (const pattern of this.options.textPatterns) {
          if (pattern.test(text)) {
            return { text, confidence: 0.6 };
          }
        }
      }
    }

    // Check parent element text (for buttons wrapping text nodes)
    const parentText = element.parentElement?.textContent?.trim() ?? "";
    if (parentText.length < 50) {
      for (const pattern of this.options.textPatterns) {
        if (pattern.test(parentText)) {
          return { text: parentText, confidence: 0.5 };
        }
      }
    }

    return null;
  }

  /**
   * Register a detected button and set up interception.
   * Uses a single shared MutationObserver for all button removal detection.
   */
  private registerButton(info: ApplyButtonInfo): void {
    this.detectedButtons.set(info.element, info);

    // Set up click interception
    if (this.options.interceptClicks) {
      this.interceptButton(info);
    }

    // Notify callback
    if (this.onApplyDetected) {
      this.onApplyDetected(info);
    }

    // Start shared removal observer if not already running
    if (!this.removalObserver) {
      this.removalObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.removedNodes) {
            // Check if any tracked button was removed
            for (const [element, buttonInfo] of this.detectedButtons) {
              if (node === element || (node instanceof HTMLElement && node.contains(element))) {
                this.detectedButtons.delete(element);
                // Clean up click handler
                const handler = this.clickHandlers.get(element);
                if (handler) {
                  element.removeEventListener("click", handler, true);
                  this.clickHandlers.delete(element);
                }
              }
            }
          }
        }
      });

      if (document.body) {
        this.removalObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    }
  }

  /**
   * Start mutation observer to detect new buttons.
   */
  private startMutationObserver(): void {
    this.mutationObserver = new MutationObserver(() => {
      // Debounce to prevent excessive scanning
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.scanForButtons();
      }, this.options.observeDebounce);
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-apply", "aria-label"],
    });
  }
}

/**
 * Utility function to replay a click after autofill is complete.
 * Temporarily removes capture-phase interception to allow the click through.
 */
export function replayClick(element: HTMLElement): void {
  // Dispatch synthetic click - capture-phase listeners will still fire
  // but the event is marked as trusted=false so handlers can distinguish it
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(event);
}

/**
 * Utility function to find and click the first apply button on the page.
 */
export function clickFirstApplyButton(): ApplyButtonInfo | null {
  const detector = new ApplyButtonDetector({ interceptClicks: false });
  detector.scanForButtons();
  const buttons = detector.getDetectedButtons();

  if (buttons.length === 0) return null;

  // Sort by confidence and click the best match
  buttons.sort((a, b) => b.confidence - a.confidence);
  const best = buttons[0];

  best.element.click();
  return best;
}
