/**
 * In-Page Brain HUD & Holographic Radar Scanner.
 *
 * Implements enterprise-grade visual feedback for autonomous autofill
 * and job application execution, grounded in AgentQ and Reflexion research:
 *  - Real-time MCTS Thought Stream (Confidence score, reasoning steps)
 *  - Holographic Radar Scan Line during DOM perception
 *  - Emerald Pulse Ripple animation upon high-confidence field completion
 *  - Fully isolated in Shadow DOM (zero interference with host ATS CSS)
 */

const HUD_HOST_ID = "superjob-brain-hud-host";

const safeRaf = (fn: () => void) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(fn);
  } else {
    setTimeout(fn, 16);
  }
};

export interface BrainHUDController {
  updateThought: (thought: string, confidence?: number, action?: string) => void;
  updateProgress: (filled: number, total: number, currentField?: string) => void;
  triggerFieldRipple: (selectorOrEl: string | HTMLElement) => void;
  flashSuccess: (message: string) => void;
  flashError: (message: string) => void;
  destroy: () => void;
}

export function mountBrainHUD(initialTitle = "SuperJob Decision Brain"): BrainHUDController {
  const dummy: BrainHUDController = {
    updateThought: () => {},
    updateProgress: () => {},
    triggerFieldRipple: () => {},
    flashSuccess: () => {},
    flashError: () => {},
    destroy: () => {},
  };

  if (typeof document === "undefined" || !document.createElement) {
    return dummy;
  }

  try {
    // Remove existing HUD if present
    const existing = document.getElementById(HUD_HOST_ID);
    if (existing) {
      try { existing.remove(); } catch { /* ignore */ }
    }

    const host = document.createElement("div");
    host.id = HUD_HOST_ID;
    host.style.cssText = "position:fixed;bottom:24px;left:24px;z-index:2147483646;all:initial;pointer-events:none;";

    let shadow: ShadowRoot | HTMLElement = host;
    if (typeof host.attachShadow === "function") {
      shadow = host.attachShadow({ mode: "open" });
    }

    shadow.innerHTML = `
      <style>
        :host, * { all: revert; box-sizing: border-box; }
        .hud-card {
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
          background: rgba(12, 18, 32, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.15);
          color: #f1f5f9;
          width: 320px;
          padding: 14px 16px;
          opacity: 0;
          transform: translateY(12px) scale(0.96);
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .hud-card.show {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        /* Holographic Radar Scanner Line */
        .radar-scanner {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, #6366f1, transparent);
          box-shadow: 0 0 10px #10b981;
          animation: radarScan 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          opacity: 0.8;
        }
        @keyframes radarScan {
          0% { top: 0; opacity: 0.2; }
          50% { opacity: 0.9; }
          100% { top: 100%; opacity: 0.1; }
        }
        .hud-hd {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .hud-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hud-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: dotPulse 1.6s infinite;
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .hud-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: 0.02em;
        }
        .hud-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .hud-progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .hud-progress-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #6366f1, #10b981);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .hud-thought-box {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11.5px;
          line-height: 1.45;
          color: #cbd5e1;
          min-height: 38px;
          display: flex;
          align-items: center;
        }
        .hud-thought-text {
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .hud-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 10.5px;
          color: #94a3b8;
        }
        .hud-close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
          padding: 2px;
        }
        .hud-close-btn:hover {
          color: #f1f5f9;
        }
        .hud-status-banner {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 6px;
          padding: 4px 8px;
          margin-bottom: 8px;
          font-size: 10px;
          color: #c7d2fe;
        }
        .hud-status-spinner {
          display: inline-block;
          animation: hudSpin 1.6s ease-in-out infinite;
          color: #818cf8;
          font-weight: bold;
        }
        @keyframes hudSpin {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 1; }
        }
      </style>
      <div class="hud-card" id="hud-card">
        <div class="radar-scanner"></div>
        <div class="hud-hd">
          <div class="hud-title-wrap">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" style="flex-shrink:0;">
              <rect width="48" height="48" rx="12" fill="url(#hud-grad)"/>
              <path d="M14 26L20 32L34 18" stroke="#10B981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              <defs>
                <linearGradient id="hud-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#4F46E5"/>
                  <stop offset="1" stop-color="#7C3AED"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="hud-pulse-dot" id="hud-dot"></div>
            <div class="hud-title" id="hud-title">${initialTitle}</div>
          </div>
          <div class="hud-badge" id="hud-conf-badge">AgentQ MCTS</div>
        </div>
        <div class="hud-status-banner">
          <span class="hud-status-spinner">⚡</span>
          <span class="hud-status-text">Autonomous Service Active • Wait ~1 min</span>
        </div>
        <div class="hud-progress-bar">
          <div class="hud-progress-fill" id="hud-fill"></div>
        </div>
        <div class="hud-thought-box">
          <span class="hud-thought-text" id="hud-thought">Scanning form accessibility tree...</span>
        </div>
        <div class="hud-footer">
          <span id="hud-stats">Ready</span>
          <button class="hud-close-btn" id="hud-close" title="Minimize HUD">✕</button>
        </div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(host);

    const card = (shadow as any).getElementById?.("hud-card") || host.querySelector?.("#hud-card");
    const fill = (shadow as any).getElementById?.("hud-fill") || host.querySelector?.("#hud-fill");
    const thought = (shadow as any).getElementById?.("hud-thought") || host.querySelector?.("#hud-thought");
    const confBadge = (shadow as any).getElementById?.("hud-conf-badge") || host.querySelector?.("#hud-conf-badge");
    const stats = (shadow as any).getElementById?.("hud-stats") || host.querySelector?.("#hud-stats");
    const dot = (shadow as any).getElementById?.("hud-dot") || host.querySelector?.("#hud-dot");
    const closeBtn = (shadow as any).getElementById?.("hud-close") || host.querySelector?.("#hud-close");

    safeRaf(() => {
      card?.classList?.add("show");
    });

    closeBtn?.addEventListener?.("click", () => {
      card?.classList?.remove("show");
      setTimeout(() => {
        try { host.remove(); } catch { /* ignore */ }
      }, 300);
    });

    return {
      updateThought(thoughtText: string, confidence?: number, action?: string) {
        if (thought) thought.textContent = thoughtText;
        if (confBadge && typeof confidence === "number") {
          confBadge.textContent = `${Math.round(confidence * 100)}% Conf`;
          if (confidence >= 0.85) {
            confBadge.style.color = "#10b981";
            confBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
            confBadge.style.background = "rgba(16, 185, 129, 0.12)";
          } else {
            confBadge.style.color = "#f59e0b";
            confBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
            confBadge.style.background = "rgba(245, 158, 11, 0.12)";
          }
        }
        if (stats && action) {
          stats.textContent = `Action: ${action}`;
        }
      },

      updateProgress(filledCount: number, totalCount: number, currentField?: string) {
        const pct = totalCount > 0 ? Math.min(100, Math.round((filledCount / totalCount) * 100)) : 0;
        if (fill) fill.style.width = `${pct}%`;
        if (stats) stats.textContent = `${filledCount}/${totalCount} filled (${pct}%)`;
        if (thought && currentField) {
          thought.textContent = `Filling ${currentField}...`;
        }
      },

      triggerFieldRipple(selectorOrEl: string | HTMLElement) {
        try {
          let el: HTMLElement | null = null;
          if (typeof selectorOrEl === "string") {
            el = document.querySelector(selectorOrEl) as HTMLElement | null;
          } else {
            el = selectorOrEl;
          }
          if (!el || typeof el.getBoundingClientRect !== "function") return;

          // Visual Emerald Pulse Ripple
          const rect = el.getBoundingClientRect();
          const ripple = document.createElement("div");
          ripple.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border-radius: 6px;
            border: 2px solid #10b981;
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
            pointer-events: none;
            z-index: 2147483645;
            opacity: 1;
            transform: scale(1);
            transition: all 0.5s ease-out;
          `;
          (document.body || document.documentElement).appendChild(ripple);
          safeRaf(() => {
            ripple.style.opacity = "0";
            ripple.style.transform = "scale(1.05)";
          });
          setTimeout(() => {
            try { ripple.remove(); } catch { /* ignore */ }
          }, 550);
        } catch {
          /* Ripple is non-fatal */
        }
      },

      flashSuccess(msg: string) {
        if (dot) {
          dot.style.background = "#10b981";
          dot.style.boxShadow = "0 0 12px #10b981";
        }
        if (confBadge) {
          confBadge.textContent = "Success";
          confBadge.style.color = "#10b981";
        }
        if (thought) thought.textContent = msg;
        setTimeout(() => {
          card?.classList?.remove("show");
          setTimeout(() => {
            try { host.remove(); } catch { /* ignore */ }
          }, 300);
        }, 3500);
      },

      flashError(msg: string) {
        if (dot) {
          dot.style.background = "#f43f5e";
          dot.style.boxShadow = "0 0 12px #f43f5e";
        }
        if (confBadge) {
          confBadge.textContent = "Intervention";
          confBadge.style.color = "#f43f5e";
        }
        if (thought) thought.textContent = msg;
      },

      destroy() {
        card?.classList?.remove("show");
        setTimeout(() => {
          try { host.remove(); } catch { /* ignore */ }
        }, 300);
      },
    };
  } catch {
    return dummy;
  }
}
