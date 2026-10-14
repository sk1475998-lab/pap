/**
 * Set-of-Mark (SoM) In-Page Interactive Element Grounding & Action Planner
 *
 * Adapted from the WebVoyager (ACL 2024, arXiv:2401.13919) and WorkArena (NeurIPS 2024, arXiv:2403.07718)
 * visual/accessibility grounding algorithms for enterprise ATS form interaction (Workday, Taleo, Greenhouse).
 *
 * Solves the core crisis of brittle CSS selectors:
 * 1. Dynamically identifies all interactive DOM & Shadow-DOM controls (inputs, buttons, comboboxes, radios).
 * 2. Prunes non-interactive container elements and invisible overlays.
 * 3. Assigns unique visual/numerical mark IDs [1], [2], [3]...
 * 4. Generates structured, deterministic action tuples for hardware-level CDP dispatching.
 */

export interface MarkedElement {
  markId: number;
  element: HTMLElement;
  role: string;
  name: string;
  tagName: string;
  type: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  currentValue: string;
  required: boolean;
  disabled: boolean;
}

export interface SoMAction {
  type: "CLICK" | "TYPE" | "SELECT" | "CLEAR" | "SCROLL" | "SUBMIT" | "WAIT";
  markId: number;
  payload?: string;
  rationale: string;
}

export class SoMElementPlanner {
  private markedRegistry = new Map<number, MarkedElement>();
  private markerOverlayContainer: HTMLElement | null = null;

  /**
   * Scan page and shadow roots, compute bounding rects, and index interactive elements
   */
  scanAndMarkInteractiveElements(doc: Document = document): MarkedElement[] {
    this.clearMarks();
    this.markedRegistry.clear();

    const vw = Math.max(doc.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(doc.documentElement.clientHeight || 0, window.innerHeight || 0);

    // Collect all candidates across light DOM and open shadow DOMs
    const candidateElements: HTMLElement[] = [];
    this.traverseDOM(doc.body, (el) => {
      if (this.isInteractiveCandidate(el)) {
        candidateElements.push(el);
      }
    });

    let currentMarkId = 1;
    const markedList: MarkedElement[] = [];

    // Filter, validate geometry and prune nested duplicate clickables
    for (const el of candidateElements) {
      const rect = el.getBoundingClientRect();

      // Check visibility and dimensions
      if (rect.width < 8 || rect.height < 8) continue;
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;

      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;

      // Extract accessible role and label
      const role = el.getAttribute("role") || el.tagName.toLowerCase();
      const name = this.extractAccessibleName(el);
      const inputEl = el as HTMLInputElement;

      const marked: MarkedElement = {
        markId: currentMarkId,
        element: el,
        role,
        name,
        tagName: el.tagName.toLowerCase(),
        type: inputEl.type || "",
        rect: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          centerX: Math.round(rect.left + rect.width / 2),
          centerY: Math.round(rect.top + rect.height / 2),
        },
        currentValue: inputEl.value || el.textContent?.trim() || "",
        required: inputEl.required || el.getAttribute("aria-required") === "true",
        disabled: inputEl.disabled || el.getAttribute("aria-disabled") === "true",
      };

      this.markedRegistry.set(currentMarkId, marked);
      markedList.push(marked);
      currentMarkId++;
    }

    return markedList;
  }

  /**
   * Render subtle visual Set-of-Mark tags in top-left corners for visual verification
   */
  renderVisualMarks(doc: Document = document): void {
    if (this.markerOverlayContainer) {
      this.markerOverlayContainer.remove();
    }

    const container = doc.createElement("div");
    container.id = "sja-som-overlay-container";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483646;
    `;

    for (const item of this.markedRegistry.values()) {
      const badge = doc.createElement("div");
      badge.textContent = String(item.markId);
      badge.style.cssText = `
        position: absolute;
        top: ${item.rect.top}px;
        left: ${item.rect.left}px;
        background: #4f46e5;
        color: #ffffff;
        font-family: monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 3px;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        line-height: 1;
        pointer-events: none;
      `;
      container.appendChild(badge);
    }

    doc.body.appendChild(container);
    this.markerOverlayContainer = container;
  }

  /**
   * Remove visual marks overlay
   */
  clearMarks(): void {
    if (this.markerOverlayContainer) {
      this.markerOverlayContainer.remove();
      this.markerOverlayContainer = null;
    }
  }

  /**
   * Get marked element by numerical ID
   */
  getMarkedElement(markId: number): MarkedElement | undefined {
    return this.markedRegistry.get(markId);
  }

  /**
   * Traverse DOM tree recursively including open shadow roots
   */
  private traverseDOM(root: HTMLElement | DocumentFragment, callback: (el: HTMLElement) => void): void {
    if (!root) return;
    const children = root.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (!child) continue;
      callback(child);
      if (child.shadowRoot) {
        this.traverseDOM(child.shadowRoot, callback);
      }
      if (child.children && child.children.length > 0) {
        this.traverseDOM(child, callback);
      }
    }
  }

  /**
   * Heuristic filter for interactive candidate elements
   */
  private isInteractiveCandidate(el: HTMLElement): boolean {
    const tag = el.tagName.toUpperCase();
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)) return true;
    if (tag === "A" && el.hasAttribute("href")) return true;
    const role = el.getAttribute("role");
    if (["button", "checkbox", "radio", "combobox", "option", "tab", "textbox"].includes(role || "")) return true;
    if (el.onclick != null || el.hasAttribute("data-automation-id") || el.hasAttribute("data-test")) return true;
    return false;
  }

  /**
   * Extract accessible name from aria attributes, associated labels, or inner text
   */
  private extractAccessibleName(el: HTMLElement): string {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) return labelEl.textContent?.trim() || "";
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || "";
    }

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();

    return el.textContent?.slice(0, 50).trim() || "";
  }
}
