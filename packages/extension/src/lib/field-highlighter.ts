/**
 * Visual Confidence Highlighting & Sensitivity Guard (adapted from FormFilla).
 *
 * Provides real-time visual feedback on form fields during and after autofill:
 *  - Green / Emerald: High-confidence profile matches (Name, Email, Phone, LinkedIn, etc.)
 *  - Indigo / Blue: AI-generated or inferred answers (Cover letter, screening questions)
 *  - Rose / Red: Missing required fields that need manual attention
 *  - Amber / Gold: Sensitive fields (SSN, National ID, Tax ID) requiring explicit candidate confirmation
 */

import { queryNode } from "./ats-adapter.js";

export type HighlightType = "success" | "ai" | "missing" | "sensitive";

const SJA_HIGHLIGHT_CLASS = "sja-field-highlight";
const SJA_STYLE_ID = "sja-field-highlighter-styles";

function ensureStylesInjected(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SJA_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SJA_STYLE_ID;
  style.textContent = `
    .sja-field-highlight {
      transition: box-shadow 0.25s ease-in-out !important;
    }
    .sja-highlight-success {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.65) !important;
    }
    .sja-highlight-ai {
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.65) !important;
    }
    .sja-highlight-missing {
      box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.75) !important;
      background-color: rgba(254, 242, 242, 0.25) !important;
    }
    .sja-highlight-sensitive {
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.75) !important;
      background-color: rgba(254, 252, 232, 0.3) !important;
    }
    .sja-shield-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      padding: 2px 8px;
      border-radius: 9999px;
      margin-top: 4px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }
    .sja-shield-badge:hover {
      background: #fde68a;
      transform: translateY(-1px);
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/** Highlight an element in the DOM by selector with a designated confidence color. */
export function highlightField(
  selector: string,
  type: HighlightType,
  tooltip?: string
): void {
  try {
    ensureStylesInjected();
    const el = queryNode(selector) as HTMLElement | null;
    if (!el) return;

    el.classList.add(SJA_HIGHLIGHT_CLASS);
    el.classList.remove(
      "sja-highlight-success",
      "sja-highlight-ai",
      "sja-highlight-missing",
      "sja-highlight-sensitive"
    );
    el.classList.add(`sja-highlight-${type}`);
    el.setAttribute("data-sja-status", type);
    if (tooltip) {
      el.setAttribute("title", tooltip);
    }
  } catch {
    /* Visual highlights are strictly non-fatal */
  }
}

/** Clear all highlights from the current page/modal. */
export function clearFieldHighlights(): void {
  try {
    const highlighted = document.querySelectorAll(`.${SJA_HIGHLIGHT_CLASS}`);
    highlighted.forEach((el) => {
      const h = el as HTMLElement;
      h.classList.remove(
        SJA_HIGHLIGHT_CLASS,
        "sja-highlight-success",
        "sja-highlight-ai",
        "sja-highlight-missing",
        "sja-highlight-sensitive"
      );
      h.removeAttribute("data-sja-status");
    });
    // Remove any sensitive shield badges
    const badges = document.querySelectorAll(".sja-shield-badge");
    badges.forEach((b) => b.remove());
  } catch {
    /* ignore */
  }
}

/** Attach a 1-click confirmation badge to sensitive fields (e.g. SSN / Government ID). */
export function attachSensitiveShieldBadge(
  selector: string,
  label: string,
  onConfirm: () => void
): void {
  try {
    ensureStylesInjected();
    const el = queryNode(selector) as HTMLElement | null;
    if (!el || el.parentElement?.querySelector(".sja-shield-badge")) return;

    highlightField(selector, "sensitive", "Sensitive field — click badge to confirm injection");

    const badge = document.createElement("div");
    badge.className = "sja-shield-badge";
    badge.innerHTML = `🔒 <span>Sensitive Field (${label.slice(0, 30)}) — Click to Fill</span>`;
    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      badge.remove();
      onConfirm();
      highlightField(selector, "success", "✓ Confirmed & Filled");
    });

    el.parentElement?.insertBefore(badge, el.nextSibling);
  } catch {
    /* ignore */
  }
}
