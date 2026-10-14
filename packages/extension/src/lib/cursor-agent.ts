/**
 * Cursor Agent — animated fake cursor that moves to each field during autofill.
 *
 * Creates a visual cursor pointer element that smoothly animates to each form
 * field's position before it's filled, making the autofill look like a human
 * is clicking each field. Shows a tooltip badge with the field label and value.
 */

const CURSOR_ID = "sja-cursor-agent";
const TOOLTIP_ID = "sja-cursor-tooltip";

let cursorEl: HTMLElement | null = null;
let tooltipEl: HTMLElement | null = null;
let hostEl: HTMLElement | null = null;

/**
 * Initialize the cursor agent — creates the fake cursor and tooltip elements.
 * Uses a Shadow DOM host to isolate styles.
 */
export function initCursorAgent(): void {
  if (hostEl && document.contains(hostEl)) return;

  hostEl = document.createElement("div");
  hostEl.id = CURSOR_ID;
  hostEl.style.cssText =
    "position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;z-index:2147483646 !important;pointer-events:none !important;margin:0 !important;padding:0 !important;all:initial;";

  const shadow = hostEl.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      .sja-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        z-index: 2147483646;
        pointer-events: none;
        opacity: 0;
        transition: left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                    top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                    opacity 0.2s ease;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      .sja-cursor.visible {
        opacity: 1;
      }
      .sja-cursor svg {
        width: 20px;
        height: 20px;
      }
      .sja-tooltip {
        position: fixed;
        z-index: 2147483646;
        pointer-events: none;
        opacity: 0;
        transition: left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                    top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                    opacity 0.15s ease;
        font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
        font-size: 10px;
        font-weight: 600;
        background: #0f172a;
        color: #e2e8f0;
        padding: 4px 8px;
        border-radius: 6px;
        white-space: nowrap;
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        border: 1px solid #334155;
      }
      .sja-tooltip.visible {
        opacity: 1;
      }
      .sja-tooltip .label {
        color: #94a3b8;
        margin-right: 4px;
      }
      .sja-tooltip .value {
        color: #a5b4fc;
      }
      .sja-tooltip .check {
        color: #22c55e;
        margin-right: 2px;
      }
      @keyframes sja-cursor-click {
        0% { transform: scale(1); }
        50% { transform: scale(0.75); }
        100% { transform: scale(1); }
      }
      .sja-cursor.clicking {
        animation: sja-cursor-click 0.2s ease;
      }
    </style>
    <div class="sja-cursor">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#6366f1" stroke="#312e81" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="sja-tooltip"></div>
  `;

  document.documentElement.appendChild(hostEl);
  cursorEl = shadow.querySelector(".sja-cursor") as HTMLElement;
  tooltipEl = shadow.querySelector(".sja-tooltip") as HTMLElement;
}

/**
 * Smoothly move the cursor to a target element's position.
 * Resolves after the animation completes.
 */
export async function moveCursorTo(target: Element): Promise<void> {
  if (!cursorEl || !tooltipEl) initCursorAgent();
  if (!cursorEl || !tooltipEl) return;

  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  // Position cursor at center of the target field
  const x = rect.left + rect.width / 2 - 5;
  const y = rect.top + rect.height / 2 - 5;

  cursorEl.style.left = `${x}px`;
  cursorEl.style.top = `${y}px`;
  cursorEl.classList.add("visible");

  // Position tooltip just below and to the right of cursor
  tooltipEl.style.left = `${x + 24}px`;
  tooltipEl.style.top = `${y + 4}px`;

  // Wait for the CSS transition to complete
  await sleep(380);
}

/**
 * Show a "click" animation on the cursor.
 */
export async function animateClick(): Promise<void> {
  if (!cursorEl) return;
  cursorEl.classList.add("clicking");
  await sleep(200);
  cursorEl.classList.remove("clicking");
}

/**
 * Show a tooltip badge next to the cursor with the field label and filled value.
 */
export function showFillBadge(label: string, value: string, source: "profile" | "ai" | "learned" | "default"): void {
  if (!tooltipEl) return;

  const sourceIcon = source === "ai" ? "🤖" : source === "learned" ? "🧠" : source === "profile" ? "👤" : "📋";
  const truncatedValue = value.length > 30 ? value.slice(0, 30) + "…" : value;

  tooltipEl.innerHTML = `<span class="check">✓</span><span class="label">${escapeHtml(label)}:</span><span class="value">${escapeHtml(truncatedValue)}</span> ${sourceIcon}`;
  tooltipEl.classList.add("visible");
}

/**
 * Hide the fill badge tooltip.
 */
export function hideFillBadge(): void {
  if (!tooltipEl) return;
  tooltipEl.classList.remove("visible");
}

/**
 * Hide the cursor completely.
 */
export function hideCursor(): void {
  if (cursorEl) cursorEl.classList.remove("visible");
  if (tooltipEl) tooltipEl.classList.remove("visible");
}

/**
 * Full sequence: move cursor to element → click animation → show badge → brief pause.
 * This is the main API for autofill integration.
 */
export async function cursorFillSequence(
  target: Element,
  label: string,
  value: string,
  source: "profile" | "ai" | "learned" | "default" = "profile"
): Promise<void> {
  await moveCursorTo(target);
  await animateClick();
  showFillBadge(label, value, source);
  await sleep(400); // Let user see the badge
  hideFillBadge();
}

/**
 * Clean up cursor agent — removes all DOM elements.
 */
export function destroyCursorAgent(): void {
  if (hostEl && document.contains(hostEl)) {
    hostEl.remove();
  }
  cursorEl = null;
  tooltipEl = null;
  hostEl = null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
