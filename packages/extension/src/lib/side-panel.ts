/**
 * Persistent docked AI assistant panel — always visible on job pages.
 * Replaces the need to reopen the extension popup.
 *
 * Supports two rendering modes controlled by the `reactPanel` feature flag:
 *   - Legacy mode: Raw HTML string injection (existing, ~700 lines below)
 *   - React mode: React 18 components inside Shadow DOM (panel-react/)
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { PanelRoot, type PanelRootActions } from "./panel-react/PanelRoot.js";
import { panelStore, type PageContext } from "./panel-react/panel-store.js";
import { isEnabled } from "./feature-flags.js";
import { diagLog } from "./diagnostics.js";

// Lazy-load CSS only when panel is mounted (saves 413KB on pages where panel never shows)
let panelThemeCSS: string | null = null;
async function loadPanelThemeCSS(): Promise<string> {
  if (panelThemeCSS) return panelThemeCSS;
  const mod = await import("./panel-react/panel-theme.css?inline");
  panelThemeCSS = mod.default;
  return panelThemeCSS;
}

const HOST_ID = "sja-persistent-docked-panel-container";
let activeActions: PanelActions | null = null;
let reactRoot: Root | null = null;
let panelStackObserver: MutationObserver | null = null;
let modalIds = new WeakMap<Element, number>();
let nextModalId = 1;
let lastModalSignature = "";

export interface PanelData {
  score: number;
  matched: number;
  total: number;
}

export interface PanelActions {
  onAutofill: () => void;
  onContinue: () => void;
  onNextStep: () => void;
  onResumeOtp?: () => void;
  onTailorResume?: () => void;
  onGenerateCoverLetter?: () => void;
  onAnswerMissingField?: (field: any, value: string) => void;
  onApproveStep?: () => void;
  onSkipJob?: () => void;
  onOnboardingComplete?: (state: any) => void;
  onSubmitNow?: () => void;
  onCancelSubmitCountdown?: () => void;

  /** Called when user clicks "Apply on company website" in the panel. */
  onOpenExternalApply?: (url: string) => void;
}


export interface SidePanelHandle {
  update: (d: PanelData) => void;
  setStatus: (text: string) => void;
  setStep: (step: string) => void;
  setMissingFields: (fields: any[]) => void;
  setNeedsUser: (needs: boolean) => void;
  setPlatform: (name: string) => void;
  setAwaitingOtp: (waiting: boolean, fieldCount?: number) => void;
  setJdAnalysis: (data: {
    matched: string[];
    missing: string[];
    inferred: { job: string; via: string }[];
  }) => void;
  setCareerInsights: (data: {
    visa?: { rating: "High" | "Medium" | "Low" | "Unknown"; eVerify: boolean; reason: string };
    outreach?: { linkedin: string; email: string };
  }) => void;
  setTailoredResume: (text: string | null) => void;
  setRecruiterLinks: (data: { roleQuery: string; linkedinSearchUrl: string }[]) => void;
  setPageContext: (data: PageContext | null) => void;
  addFillLogEntry: (entry: { label: string; value: string; source: string; ok: boolean; timeMs: number }) => void;
  clearFillLog: () => void;
  setVerifyPrompt: (show: boolean, filledCount?: number, stepLabel?: string) => void;
  setSubmitCountdown: (seconds: number) => void;
  setSubmitCountdownActive: (active: boolean) => void;
  setEarlyAdvantage?: (data: any) => void;
  setHiringTeam?: (data: any) => void;
  /** Show a banner with an "Apply on <host>" button that opens the external ATS when clicked. */
  setExternalApplyPrompt?: (url: string | null, host?: string) => void;
  onExternalApplyClick?: (handler: (url: string) => void) => void;
}

const STORAGE_KEY = "sja-panel-width";

function toRootActions(actions: PanelActions): PanelRootActions {
  return {
    onAutofill: actions.onAutofill,
    onContinue: actions.onContinue,
    onNextStep: actions.onNextStep,
    onResumeOtp: actions.onResumeOtp,
    onTailorResume: actions.onTailorResume,
    onGenerateCoverLetter: actions.onGenerateCoverLetter,
    onAnswerMissingField: actions.onAnswerMissingField,
    onApproveStep: actions.onApproveStep,
    onSkipJob: actions.onSkipJob,
    onOnboardingComplete: actions.onOnboardingComplete,
    onSubmitNow: actions.onSubmitNow,
    onCancelSubmitCountdown: actions.onCancelSubmitCountdown,
  };
}

function loadWidth(): number {
  try {
    const w = parseInt(localStorage.getItem(STORAGE_KEY) ?? "360", 10);
    return Math.min(480, Math.max(320, w));
  } catch {
    return 360;
  }
}

function promotePanel(host: HTMLElement): void {
  if (typeof host.showPopover !== "function") return;
  try {
    if (host.matches(":popover-open")) host.hidePopover();
    host.showPopover();
  } catch (error) {
    void diagLog("orchestrator", "top-layer-promotion-failed", {
      level: "warn",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

function visibleModalSignature(host: HTMLElement): string {
  return Array.from(document.querySelectorAll("dialog[open], [role='dialog'], [role='alertdialog']"))
    .filter((element) => {
      if (host.contains(element) || element.closest(`#${HOST_ID}`)) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    })
    .map((element) => {
      let id = modalIds.get(element);
      if (!id) {
        id = nextModalId++;
        modalIds.set(element, id);
      }
      return String(id);
    })
    .join(",");
}

function watchModalStack(host: HTMLElement): void {
  if (!panelStackObserver) {
    panelStackObserver = new MutationObserver((records) => {
      if (records.every((record) => host.contains(record.target))) return;
      requestAnimationFrame(() => {
        if (!host.isConnected) return;
        const signature = visibleModalSignature(host);
        if (signature !== lastModalSignature) {
          lastModalSignature = signature;
          if (signature) promotePanel(host);
        }
      });
    });
    panelStackObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "class", "hidden", "open", "role", "style"],
    });
  }

  lastModalSignature = visibleModalSignature(host);
  if (lastModalSignature) promotePanel(host);
}

/* ────────────────────────────────────────────────────────────────── */
/* Unified entry point                                                */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Mount the side panel — checks the `reactPanel` feature flag
 * and delegates to the appropriate implementation.
 * Returns immediately; React panel mounts asynchronously in background.
 */
export function mountPanel(actions: PanelActions): SidePanelHandle {
  if (isEnabled("reactPanel")) {
    // Start async mount but return a deferred handle immediately
    // so the orchestrator doesn't block
    const handlePromise = mountReactSidePanel(actions);
    return createDeferredHandle(handlePromise);
  }
  return mountSidePanel(actions);
}

/* ────────────────────────────────────────────────────────────────── */
/* React-powered panel                                                */
/* ────────────────────────────────────────────────────────────────── */

async function mountReactSidePanel(actions: PanelActions): Promise<SidePanelHandle> {
  activeActions = actions;

  // If already mounted, refresh actions and return the existing handle.
  // React 18 error #418 fires if createRoot is called twice on the same
  // container — so we never recreate the root; we just update rootActions
  // by re-rendering.
  const existingHost = document.getElementById(HOST_ID);
  if (existingHost && reactRoot) {
    promotePanel(existingHost);
    watchModalStack(existingHost);
    const shadow = existingHost.shadowRoot;
    const mountPoint = shadow?.getElementById("sja-react-mount") as HTMLElement | null;
    if (mountPoint) {
      reactRoot.render(React.createElement(PanelRoot, { actions: toRootActions(actions) }));
      return createReactHandle();
    }
    // Stale host without our mount — tear it down and remount.
    existingHost.remove();
    reactRoot = null;
  }
  if (existingHost && !reactRoot) existingHost.remove();

  const width = loadWidth();

  // Create host element
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("popover", "manual");
  host.style.cssText =
    `position:fixed !important;top:0 !important;right:0 !important;left:auto !important;width:${width}px !important;height:100vh !important;z-index:2147483647 !important;margin:0 !important;padding:0 !important;all:initial;pointer-events:auto !important;`;

  // Create Shadow DOM
  const shadow = host.attachShadow({ mode: "open" });

  // Lazy-load theme CSS (only when panel is actually mounted)
  const css = await loadPanelThemeCSS();
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  shadow.appendChild(styleEl);

  // Create React mount point (with a stable id so remounts find it)
  const mountPoint = document.createElement("div");
  mountPoint.id = "sja-react-mount";
  mountPoint.style.cssText = "height:100%;pointer-events:auto;";
  shadow.appendChild(mountPoint);

  document.documentElement.appendChild(host);
  promotePanel(host);
  watchModalStack(host);
  document.documentElement.style.setProperty("margin-right", `${width}px`, "important");
  document.body?.style.setProperty("margin-right", `${width}px`, "important");

  const rootActions = toRootActions(actions);

  // Mount React promptly to prevent layout flashes
  const mountReact = () => {
    if (!reactRoot) {
      reactRoot = createRoot(mountPoint);
    }
    reactRoot.render(React.createElement(PanelRoot, { actions: rootActions }));
  };

  mountReact();

  // Subscribe to store changes for margin & host width management
  panelStore.subscribe(() => {
    const s = panelStore.getSnapshot();
    if (s.docked && !s.minimized) {
      host.style.setProperty("width", `${s.width}px`, "important");
      host.style.setProperty("pointer-events", "auto", "important");
      document.documentElement.style.setProperty("margin-right", `${s.width}px`, "important");
      document.body?.style.setProperty("margin-right", `${s.width}px`, "important");
    } else if (s.docked && s.minimized) {
      host.style.setProperty("width", "44px", "important");
      host.style.setProperty("pointer-events", "auto", "important");
      document.documentElement.style.setProperty("margin-right", "44px", "important");
      document.body?.style.setProperty("margin-right", "44px", "important");
    } else {
      host.style.setProperty("width", "auto", "important");
      host.style.setProperty("pointer-events", "auto", "important");
      document.documentElement.style.removeProperty("margin-right");
      document.body?.style.removeProperty("margin-right");
    }
  });

  return createReactHandle();
}

/**
 * Creates a deferred handle that queues operations until the async React panel is ready.
 * This allows the orchestrator to call methods immediately without waiting for React mount.
 */
function createDeferredHandle(promise: Promise<SidePanelHandle>): SidePanelHandle {
  let resolved: SidePanelHandle | null = null;
  const queue: Array<(h: SidePanelHandle) => void> = [];
  
  promise.then((h) => {
    resolved = h;
    for (const fn of queue) fn(h);
    queue.length = 0;
  });
  
  const exec = (method: keyof SidePanelHandle, ...args: any[]) => {
    if (resolved) {
      const fn = resolved[method] as Function;
      fn.apply(resolved, args);
    } else {
      queue.push((h) => {
        const fn = h[method] as Function;
        fn.apply(h, args);
      });
    }
  };
  
  return {
    update: (d) => exec("update", d),
    setStatus: (t) => exec("setStatus", t),
    setStep: (s) => exec("setStep", s),
    setPlatform: (n) => exec("setPlatform", n),
    setMissingFields: (f) => exec("setMissingFields", f),
    setNeedsUser: (n) => exec("setNeedsUser", n),
    setAwaitingOtp: (w, c?) => exec("setAwaitingOtp", w, c),
    setJdAnalysis: (d) => exec("setJdAnalysis", d),
    setCareerInsights: (d) => exec("setCareerInsights", d),
    setTailoredResume: (t) => exec("setTailoredResume", t),
    setRecruiterLinks: (d) => exec("setRecruiterLinks", d),
    setPageContext: (d) => exec("setPageContext", d),
    addFillLogEntry: (e) => exec("addFillLogEntry", e),
    clearFillLog: () => exec("clearFillLog"),
    setVerifyPrompt: (s, c?, l?) => exec("setVerifyPrompt", s, c, l),
    setSubmitCountdown: (s) => exec("setSubmitCountdown", s),
    setSubmitCountdownActive: (a) => exec("setSubmitCountdownActive", a),
    setEarlyAdvantage: (d) => exec("setEarlyAdvantage", d),
    setHiringTeam: (d) => exec("setHiringTeam", d),
    setExternalApplyPrompt: (u, h) => exec("setExternalApplyPrompt", u, h),
  };
}

/**
 * Creates a SidePanelHandle that delegates all updates to the panelStore.
 * This provides full backward compatibility with the orchestrator.
 */
function createReactHandle(): SidePanelHandle {
  return {
    update(d) {
      panelStore.updateScore(d.score, d.matched, d.total);
    },
    setStatus(text) {
      panelStore.setStatus(text);
    },
    setStep(step) {
      panelStore.setStep(step);
    },
    setPlatform(name) {
      panelStore.setPlatform(name);
    },
    setMissingFields(fields) {
      panelStore.setMissingFields(fields);
    },
    setNeedsUser(needs) {
      panelStore.setNeedsUser(needs);
    },
    setAwaitingOtp(waiting, fieldCount) {
      panelStore.setAwaitingOtp(waiting, fieldCount);
    },
    setJdAnalysis(data) {
      panelStore.setJdAnalysis(data);
    },
    setCareerInsights(data) {
      panelStore.setCareerInsights(data);
    },
    setTailoredResume(text) {
      panelStore.setTailoredResume(text);
    },
    setRecruiterLinks(data) {
      panelStore.setRecruiterLinks(data);
    },
    setPageContext(data) {
      panelStore.setPageContext(data);
    },
    addFillLogEntry(entry) {
      panelStore.addFillLogEntry(entry as any);
    },
    clearFillLog() {
      panelStore.clearFillLog();
    },
    setVerifyPrompt(show, filledCount, stepLabel) {
      panelStore.setVerifyPrompt(show, filledCount, stepLabel);
    },
    setSubmitCountdown(seconds) {
      panelStore.setSubmitCountdown(seconds);
    },
    setSubmitCountdownActive(active) {
      panelStore.setSubmitCountdownActive(active);
    },
    setEarlyAdvantage(data) {
      panelStore.setEarlyAdvantage(data);
    },
    setHiringTeam(data) {
      panelStore.setHiringTeam(data);
    },
    setExternalApplyPrompt(_url, _host) {
      // The React panel can expose this as a banner; for now we rely on the
      // FAB menu which dynamically adds an "Apply on company website" item.
    },
  };
}

/* ────────────────────────────────────────────────────────────────── */
/* Legacy HTML panel (existing implementation)                        */
/* ────────────────────────────────────────────────────────────────── */

export function mountSidePanel(actions: PanelActions): SidePanelHandle {
  activeActions = actions;
  if (document.getElementById(HOST_ID)) {
    return createHandle(document.getElementById(HOST_ID)!);
  }

  let width = loadWidth();
  let minimized = false;
  let docked = true;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("popover", "manual");
  host.style.cssText =
    `position:fixed !important;top:0 !important;right:0 !important;left:auto !important;width:${width}px !important;height:100vh !important;z-index:2147483647 !important;margin:0 !important;padding:0 !important;all:initial;pointer-events:auto !important;`;

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      @keyframes sja-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      @keyframes sja-breathe { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
      .panel {
        height: 100% !important; background: #0f172a !important; color: #e2e8f0 !important;
        display: flex !important; flex-direction: column !important;
        border-left: 1px solid #334155 !important;
        box-shadow: -4px 0 24px rgba(0,0,0,.25) !important;
        transition: width .15s, transform .2s !important;
        overflow: hidden !important;
        pointer-events: auto !important;
      }
      .panel.float {
        position: fixed !important; bottom: 16px !important; right: 16px !important; top: auto !important;
        height: auto !important; max-height: 70vh !important; width: 280px !important;
        border-radius: 14px !important; border: 1px solid #334155 !important;
        pointer-events: auto !important;
      }
      .panel.min { width: 44px !important; }
      .resize { position: absolute; left: 0; right: auto; top: 0; width: 5px; height: 100%;
        cursor: ew-resize; z-index: 2; }
      .head { padding: 10px 12px; border-bottom: 1px solid #1e293b;
        display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        background: rgba(15,23,42,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
      .logo { font-size: 11px; font-weight: 700; color: #a5b4fc; flex: 1; }
      .icon-btn { background: transparent; border: 0; color: #94a3b8;
        cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px; }
      .icon-btn:hover { background: #1e293b; color: #fff; }
      .body { flex: 1; overflow-y: auto; padding: 10px 12px; font-size: 11px; }
      .score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .ring { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
      .ring svg { transform: rotate(-90deg); }
      .ring .track { stroke: #1e293b; }
      .ring .bar { stroke: #22c55e; stroke-linecap: round; transition: .4s; }
      .ring.pulse .bar { animation: sja-pulse 0.6s ease; }
      .ring .num { position: absolute; inset: 0; display: flex;
        align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
      .platform { font-size: 10px; color: #64748b; margin-bottom: 4px; }
      .step { font-size: 10px; color: #38bdf8; margin-bottom: 6px; font-weight: 600; }
      .status { font-size: 11px; line-height: 1.4; color: #cbd5e1; margin-bottom: 8px; min-height: 2.8em; }
      .missing { background: #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
      .missing-title { font-size: 10px; color: #fbbf24; font-weight: 600; margin-bottom: 4px; }
      .missing ul { margin: 0; padding-left: 0; list-style: none; color: #94a3b8; font-size: 10px; }
      .missing li { margin: 2px 0; }
      .user-prompt { background: #422006; border: 1px solid #b45309; border-radius: 8px;
        padding: 8px; margin-bottom: 8px; font-size: 10px; color: #fde68a; }
      .otp-prompt { background: #1e1b4b; border: 1px solid #6366f1; border-radius: 8px;
        padding: 8px; margin-bottom: 8px; font-size: 10px; color: #c7d2fe; }
      .jd-box { background: #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
      .insights-box { background: #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
      .outreach-box { background: #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
      .jd-title { font-size: 10px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .chip { font-size: 9px; padding: 2px 6px; border-radius: 999px; }
      .chip.ok { background: #14532d; color: #86efac; }
      .chip.miss { background: #422006; color: #fcd34d; }
      .chip.inf { background: #1e3a5f; color: #7dd3fc; }
      .foot { padding: 10px 12px; border-top: 1px solid #1e293b; display: flex;
        flex-direction: column; gap: 6px; flex-shrink: 0; }
      .btn { border: 0; border-radius: 8px; padding: 8px 10px; font-size: 11px;
        font-weight: 600; cursor: pointer; width: 100%; }
      .btn-primary { background: #6366f1; color: #fff; }
      .btn-primary:hover { background: #4f46e5; }
      .btn-secondary { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
      .btn-secondary:hover { background: #334155; }
      .btn-warn { background: #b45309; color: #fff; }
      .btn:disabled { opacity: .5; cursor: default; }
      .min-bar { writing-mode: vertical-rl; text-orientation: mixed;
        padding: 12px 10px; font-size: 10px; color: #a5b4fc; cursor: pointer; }
      .fill-log { background: #1e293b; border-radius: 8px; padding: 8px; margin-bottom: 8px;
        max-height: 120px; overflow-y: auto; }
      .fill-log-title { font-size: 10px; color: #94a3b8; font-weight: 600; margin-bottom: 4px;
        display: flex; align-items: center; gap: 4px; }
      .fill-log-entry { font-size: 9px; padding: 2px 0; display: flex; gap: 4px;
        align-items: baseline; border-bottom: 1px solid #0f172a; }
      .fill-log-entry:last-child { border-bottom: none; }
      .fill-log-entry .fl-icon { flex-shrink: 0; }
      .fill-log-entry .fl-label { color: #94a3b8; flex-shrink: 0; max-width: 90px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .fill-log-entry .fl-arrow { color: #475569; }
      .fill-log-entry .fl-value { color: #a5b4fc; flex: 1; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
      .fill-log-entry .fl-time { color: #475569; flex-shrink: 0; font-size: 8px; }
      .verify-prompt { background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 8px;
        padding: 10px; margin-bottom: 8px; text-align: center; }
      .verify-prompt .vp-title { font-size: 11px; color: #93c5fd; font-weight: 600; margin-bottom: 6px; }
      .verify-prompt .vp-desc { font-size: 10px; color: #bfdbfe; line-height: 1.4; margin-bottom: 8px; }
      .btn-approve { background: #2563eb; color: #fff; border: 0; border-radius: 8px;
        padding: 8px 16px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%; }
      .btn-approve:hover { background: #1d4ed8; }
      .status-idle { display: inline-flex; align-items: center; gap: 4px; }
      .status-idle .dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1;
        animation: sja-breathe 2s ease-in-out infinite; }
    </style>
    <div class="panel">
      <div class="resize" title="Drag to resize"></div>
      <div class="head">
        <span class="logo">⚡ Super Job Agent</span>
        <button class="icon-btn dock-btn" title="Dock / Float">⇔</button>
        <button class="icon-btn min-btn" title="Minimize">−</button>
      </div>
      <div class="body">
        <div class="platform"></div>
        <div class="step"></div>
        <div class="score-row">
          <div class="ring">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle class="track" cx="24" cy="24" r="19" fill="none" stroke-width="4"/>
              <circle class="bar" cx="24" cy="24" r="19" fill="none" stroke-width="4"
                stroke-dasharray="119.4" stroke-dashoffset="119.4"/>
            </svg>
            <div class="num">--</div>
          </div>
          <div class="kw"><b class="kw-text">0/0</b> keywords</div>
        </div>
        <div class="status">Ready — detecting page…</div>
        <div class="user-prompt" hidden>Fill highlighted fields manually, then tap <b>Continue</b>.</div>
        <div class="otp-prompt" hidden>Enter the OTP on the page, then tap <b>Resume after OTP</b>.</div>
        <div class="missing" hidden>
          <div class="missing-title">Needs attention</div>
          <ul class="miss-list"></ul>
        </div>
        <div class="fill-log" hidden>
          <div class="fill-log-title">📋 Fill Log</div>
          <div class="fill-log-entries"></div>
        </div>
        <div class="verify-prompt" hidden>
          <div class="vp-title">✅ Step filled — verify before continuing</div>
          <div class="vp-desc">Review the form, correct anything wrong, then approve.</div>
          <button class="btn-approve">✓ Approve & Continue</button>
        </div>
        
        <div class="jd-box" hidden>
          <div class="jd-title">JD match</div>
          <div class="jd-matched-title jd-title" style="margin-top:4px">✓ Matched</div>
          <div class="chips matched-chips"></div>
          <div class="jd-missing-title jd-title" style="margin-top:6px">△ Missing</div>
          <div class="chips missing-chips"></div>
          <div class="jd-inferred-title jd-title" style="margin-top:6px" hidden>◎ Inferred</div>
          <div class="chips inferred-chips"></div>
        </div>

        <div class="insights-box" hidden>
          <div class="jd-title">Career & Visa Insights</div>
          <div style="display:flex;align-items:center;gap:6px;margin:4px 0;">
            <span style="color:#94a3b8;">Sponsorship:</span>
            <span class="visa-rating" style="padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;background:#334155;color:#cbd5e1;">Unknown</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin:4px 0;">
            <span style="color:#94a3b8;">E-Verify:</span>
            <span class="everify-status" style="font-weight:bold;color:#ef4444;">No</span>
          </div>
          <div class="visa-reason" style="font-size:9px;color:#94a3b8;margin-top:2px;line-height:1.3;"></div>
        </div>

        <div class="outreach-box" hidden>
          <div class="jd-title">Referral Outreach</div>
          <div style="margin-top:4px;">
            <span style="color:#a5b4fc;font-weight:600;">LinkedIn Invite (<300 chars):</span>
            <div class="li-msg" style="background:#0f172a;padding:4px;border-radius:4px;font-size:9px;margin:2px 0;word-break:break-all;user-select:all;"></div>
            <button class="btn btn-secondary copy-li-btn" style="padding:2px 6px;font-size:9px;margin-top:2px;width:auto;display:inline-block;">Copy Invite</button>
          </div>
          <div style="margin-top:6px;">
            <span style="color:#a5b4fc;font-weight:600;">Cold Email Referral:</span>
            <div class="email-msg" style="background:#0f172a;padding:4px;border-radius:4px;font-size:9px;margin:2px 0;max-height:80px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;user-select:all;"></div>
            <button class="btn btn-secondary copy-email-btn" style="padding:2px 6px;font-size:9px;margin-top:2px;width:auto;display:inline-block;">Copy Email</button>
          </div>
        </div>

        <div class="tailored-resume-box" hidden>
          <div class="jd-title">Tailored Resume (ATS Optimized)</div>
          <div style="margin-top:4px;">
            <div class="tailored-text" style="background:#0f172a;padding:6px;border-radius:4px;font-size:9px;margin:2px 0;max-height:100px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;user-select:all;color:#e2e8f0;line-height:1.4;"></div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button class="btn btn-secondary copy-tailored-btn" style="padding:2px 6px;font-size:9px;width:auto;display:inline-block;">Copy Resume</button>
              <button class="btn btn-secondary download-tailored-btn" style="padding:2px 6px;font-size:9px;width:auto;display:inline-block;">Download .txt</button>
            </div>
          </div>
        </div>

        <div class="recruiter-box" hidden>
          <div class="jd-title">🔍 Find Recruiters</div>
          <div class="recruiter-links" style="margin-top:4px;"></div>
        </div>

      </div>
      <div class="foot">
        <button class="btn btn-primary autofill-btn">⚡ Auto-fill</button>
        <button class="btn btn-warn continue-btn">✓ Continue (I filled manually)</button>
        <button class="btn btn-primary otp-btn" hidden>🔐 Resume after OTP</button>
        <button class="btn btn-secondary next-btn">→ Next / Continue page</button>
        <button class="btn btn-secondary tailor-btn" style="background:#1e3a8a;color:#fff;border:0">⚡ Tailor Resume</button>
        <button class="btn btn-secondary skip-btn" style="background:#475569;color:#fff;border:0">✕ Skip Job</button>
      </div>
    </div>`;

  document.documentElement.appendChild(host);
  promotePanel(host);
  watchModalStack(host);
  document.documentElement.style.setProperty("margin-right", `${width}px`, "important");
  document.body?.style.setProperty("margin-right", `${width}px`, "important");

  const panel = shadow.querySelector(".panel") as HTMLElement;
  const resize = shadow.querySelector(".resize") as HTMLElement;
  const bar = shadow.querySelector(".bar") as SVGCircleElement;
  const num = shadow.querySelector(".num")!;
  const kwText = shadow.querySelector(".kw-text")!;
  const statusEl = shadow.querySelector(".status")!;
  const stepEl = shadow.querySelector(".step")!;
  const platformEl = shadow.querySelector(".platform")!;
  const missingBox = shadow.querySelector(".missing") as HTMLElement;
  const missList = shadow.querySelector(".miss-list")!;
  const userPrompt = shadow.querySelector(".user-prompt") as HTMLElement;
  const otpPrompt = shadow.querySelector(".otp-prompt") as HTMLElement;
  const autofillBtn = shadow.querySelector(".autofill-btn") as HTMLButtonElement;
  const continueBtn = shadow.querySelector(".continue-btn") as HTMLButtonElement;
  const otpBtn = shadow.querySelector(".otp-btn") as HTMLButtonElement;
  const nextBtn = shadow.querySelector(".next-btn") as HTMLButtonElement;
  const tailorBtn = shadow.querySelector(".tailor-btn") as HTMLButtonElement;
  const jdBox = shadow.querySelector(".jd-box") as HTMLElement;
  const matchedChips = shadow.querySelector(".matched-chips")!;
  const missingChips = shadow.querySelector(".missing-chips")!;
  const inferredTitle = shadow.querySelector(".jd-inferred-title") as HTMLElement;
  const inferredChips = shadow.querySelector(".inferred-chips")!;

  const insightsBox = shadow.querySelector(".insights-box") as HTMLElement;
  const visaRating = shadow.querySelector(".visa-rating") as HTMLElement;
  const everifyStatus = shadow.querySelector(".everify-status") as HTMLElement;
  const visaReason = shadow.querySelector(".visa-reason") as HTMLElement;
  
  const outreachBox = shadow.querySelector(".outreach-box") as HTMLElement;
  const liMsg = shadow.querySelector(".li-msg") as HTMLElement;
  const emailMsg = shadow.querySelector(".email-msg") as HTMLElement;
  const copyLiBtn = shadow.querySelector(".copy-li-btn") as HTMLButtonElement;
  const copyEmailBtn = shadow.querySelector(".copy-email-btn") as HTMLButtonElement;

  const tailoredResumeBox = shadow.querySelector(".tailored-resume-box") as HTMLElement;
  const tailoredText = shadow.querySelector(".tailored-text") as HTMLElement;
  const copyTailoredBtn = shadow.querySelector(".copy-tailored-btn") as HTMLButtonElement;
  const downloadTailoredBtn = shadow.querySelector(".download-tailored-btn") as HTMLButtonElement;

  panel.style.setProperty("width", `${width}px`, "important");

  function applyWidth(w: number) {
    width = w;
    panel.style.setProperty("width", `${width}px`, "important");
    if (docked && !minimized) {
      document.documentElement.style.setProperty("margin-right", `${width}px`, "important");
      document.body?.style.setProperty("margin-right", `${width}px`, "important");
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      /* private mode */
    }
  }

  let resizing = false;
  resize.addEventListener("mousedown", (e) => {
    e.preventDefault();
    resizing = true;
  });
  window.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    applyWidth(Math.min(480, Math.max(320, window.innerWidth - e.clientX)));
  });
  window.addEventListener("mouseup", () => {
    resizing = false;
  });

  shadow.querySelector(".dock-btn")!.addEventListener("click", () => {
    docked = !docked;
    panel.classList.toggle("float", !docked);
    if (docked) {
      const val = minimized ? "44px" : `${width}px`;
      document.documentElement.style.setProperty("margin-right", val, "important");
      document.body?.style.setProperty("margin-right", val, "important");
    } else {
      document.documentElement.style.removeProperty("margin-right");
      document.body?.style.removeProperty("margin-right");
    }
  });

  shadow.querySelector(".min-btn")!.addEventListener("click", () => {
    minimized = !minimized;
    panel.classList.toggle("min", minimized);
    const body = shadow.querySelector(".body") as HTMLElement;
    const foot = shadow.querySelector(".foot") as HTMLElement;
    body.style.display = minimized ? "none" : "";
    foot.style.display = minimized ? "none" : "";
    if (docked) {
      const val = minimized ? "44px" : `${width}px`;
      document.documentElement.style.setProperty("margin-right", val, "important");
      document.body?.style.setProperty("margin-right", val, "important");
    }
  });

  autofillBtn.addEventListener("click", () => {
    autofillBtn.disabled = true;
    autofillBtn.textContent = "Filling…";
    activeActions?.onAutofill();
    setTimeout(() => {
      autofillBtn.disabled = false;
      autofillBtn.textContent = "⚡ Auto-fill";
    }, 4000);
  });

  continueBtn.addEventListener("click", () => activeActions?.onContinue());
  otpBtn.addEventListener("click", () => activeActions?.onResumeOtp?.());
  nextBtn.addEventListener("click", () => activeActions?.onNextStep());
  
  tailorBtn.addEventListener("click", () => {
    tailorBtn.disabled = true;
    tailorBtn.textContent = "Tailoring…";
    if (activeActions?.onTailorResume) activeActions.onTailorResume();
    setTimeout(() => {
      tailorBtn.disabled = false;
      tailorBtn.textContent = "⚡ Tailor Resume";
    }, 6000);
  });

  copyLiBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(liMsg.textContent ?? "");
    copyLiBtn.textContent = "Copied!";
    setTimeout(() => { copyLiBtn.textContent = "Copy Invite"; }, 1500);
  });

  copyEmailBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(emailMsg.textContent ?? "");
    copyEmailBtn.textContent = "Copied!";
    setTimeout(() => { copyEmailBtn.textContent = "Copy Email"; }, 1500);
  });

  copyTailoredBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(tailoredText.textContent ?? "");
    copyTailoredBtn.textContent = "Copied!";
    setTimeout(() => { copyTailoredBtn.textContent = "Copy Resume"; }, 1500);
  });

  downloadTailoredBtn.addEventListener("click", () => {
    const txt = tailoredText.textContent ?? "";
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored_resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Skip button for dismissing current job autopilot
  shadow.querySelector(".skip-btn")?.addEventListener("click", () => {
    activeActions?.onSkipJob?.();
  });

  // Approve & Continue button for verification mode
  shadow.querySelector(".btn-approve")?.addEventListener("click", () => {
    activeActions?.onApproveStep?.();
    const vp = shadow.querySelector(".verify-prompt") as HTMLElement;
    if (vp) vp.hidden = true;
  });

  return createHandle(host, {
    bar,
    num,
    kwText,
    statusEl,
    stepEl,
    platformEl,
    missingBox,
    missList,
    userPrompt,
    otpPrompt,
    otpBtn,
    jdBox,
    matchedChips,
    missingChips,
    inferredTitle,
    inferredChips,
    insightsBox,
    visaRating,
    everifyStatus,
    visaReason,
    outreachBox,
    liMsg,
    emailMsg,
    tailoredResumeBox,
    tailoredText,
  });
}

function createHandle(
  host: HTMLElement,
  els?: {
    bar: SVGCircleElement;
    num: Element;
    kwText: Element;
    statusEl: Element;
    stepEl: Element;
    platformEl: Element;
    missingBox: HTMLElement;
    missList: Element;
    userPrompt: HTMLElement;
    otpPrompt: HTMLElement;
    otpBtn: HTMLButtonElement;
    jdBox: HTMLElement;
    matchedChips: Element;
    missingChips: Element;
    inferredTitle: HTMLElement;
    inferredChips: Element;
    insightsBox: HTMLElement;
    visaRating: HTMLElement;
    everifyStatus: HTMLElement;
    visaReason: HTMLElement;
    outreachBox: HTMLElement;
    liMsg: HTMLElement;
    emailMsg: HTMLElement;
    tailoredResumeBox: HTMLElement;
    tailoredText: HTMLElement;
  }
): SidePanelHandle {
  const shadow = host.shadowRoot!;
  const bar = els?.bar ?? (shadow.querySelector(".bar") as SVGCircleElement);
  const num = els?.num ?? shadow.querySelector(".num")!;
  const kwText = els?.kwText ?? shadow.querySelector(".kw-text")!;
  const statusEl = els?.statusEl ?? shadow.querySelector(".status")!;
  const stepEl = els?.stepEl ?? shadow.querySelector(".step")!;
  const platformEl = els?.platformEl ?? shadow.querySelector(".platform")!;
  const missingBox = els?.missingBox ?? (shadow.querySelector(".missing") as HTMLElement);
  const missList = els?.missList ?? shadow.querySelector(".miss-list")!;
  const userPrompt = els?.userPrompt ?? (shadow.querySelector(".user-prompt") as HTMLElement);
  const otpPrompt = els?.otpPrompt ?? (shadow.querySelector(".otp-prompt") as HTMLElement);
  const otpBtn = els?.otpBtn ?? (shadow.querySelector(".otp-btn") as HTMLButtonElement);
  const jdBox = els?.jdBox ?? (shadow.querySelector(".jd-box") as HTMLElement);
  const matchedChips = els?.matchedChips ?? shadow.querySelector(".matched-chips")!;
  const missingChips = els?.missingChips ?? shadow.querySelector(".missing-chips")!;
  const inferredTitle = els?.inferredTitle ?? (shadow.querySelector(".jd-inferred-title") as HTMLElement);
  const inferredChips = els?.inferredChips ?? shadow.querySelector(".inferred-chips")!;

  const insightsBox = els?.insightsBox ?? (shadow.querySelector(".insights-box") as HTMLElement);
  const visaRating = els?.visaRating ?? (shadow.querySelector(".visa-rating") as HTMLElement);
  const everifyStatus = els?.everifyStatus ?? (shadow.querySelector(".everify-status") as HTMLElement);
  const visaReason = els?.visaReason ?? (shadow.querySelector(".visa-reason") as HTMLElement);

  const outreachBox = els?.outreachBox ?? (shadow.querySelector(".outreach-box") as HTMLElement);
  const liMsg = els?.liMsg ?? (shadow.querySelector(".li-msg") as HTMLElement);
  const emailMsg = els?.emailMsg ?? (shadow.querySelector(".email-msg") as HTMLElement);

  const tailoredResumeBox = els?.tailoredResumeBox ?? (shadow.querySelector(".tailored-resume-box") as HTMLElement);
  const tailoredText = els?.tailoredText ?? (shadow.querySelector(".tailored-text") as HTMLElement);

  return {
    update(d: PanelData) {
      num.textContent = String(d.score);
      const circ = 119.4;
      bar.style.strokeDashoffset = String(circ * (1 - d.score / 100));
      bar.style.stroke = d.score >= 80 ? "#22c55e" : d.score >= 60 ? "#eab308" : "#ef4444";
      kwText.textContent = `${d.matched}/${d.total}`;
      // Pulse animation on score update — use rAF to avoid forced reflow
      const ring = bar.closest(".ring") as HTMLElement;
      if (ring) {
        ring.classList.remove("pulse");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ring.classList.add("pulse");
          });
        });
      }
    },
    setStatus(text: string) {
      statusEl.textContent = text;
    },
    setStep(step: string) {
      stepEl.textContent = step ? `Step: ${step}` : "";
    },
    setPlatform(name: string) {
      platformEl.textContent = name ? `📋 ${name}` : "";
    },
    setMissingFields(fields: any[]) {
      if (!fields.length) {
        missingBox.hidden = true;
        return;
      }
      missingBox.hidden = false;
      missList.innerHTML = "";
      
      for (const field of fields) {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        li.style.display = "flex";
        li.style.flexDirection = "column";
        li.style.gap = "4px";

        const labelSpan = document.createElement("span");
        labelSpan.style.color = "#cbd5e1";
        labelSpan.style.fontSize = "10px";
        labelSpan.textContent = field.label || field.fieldKey;
        li.appendChild(labelSpan);

        const inputContainer = document.createElement("div");
        inputContainer.style.display = "flex";
        inputContainer.style.gap = "4px";
        inputContainer.style.alignItems = "center";

        let inputEl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (field.options && field.options.length > 0) {
          const select = document.createElement("select");
          select.className = "select";
          select.style.flex = "1";
          select.style.padding = "2px 4px";
          select.style.fontSize = "10px";
          select.style.background = "#1e293b";
          select.style.border = "1px solid #475569";
          select.style.color = "#fff";
          select.style.borderRadius = "4px";

          const defOpt = document.createElement("option");
          defOpt.value = "";
          defOpt.textContent = "Select...";
          select.appendChild(defOpt);

          for (const opt of field.options) {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label || opt.value;
            select.appendChild(o);
          }
          inputEl = select;
          inputContainer.appendChild(inputEl);
        } else if (field.type === "checkbox") {
          const cbLabel = document.createElement("label");
          cbLabel.style.display = "flex";
          cbLabel.style.alignItems = "center";
          cbLabel.style.fontSize = "10px";
          cbLabel.style.color = "#cbd5e1";
          cbLabel.style.cursor = "pointer";
          cbLabel.style.flex = "1";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.style.marginRight = "6px";
          cb.style.cursor = "pointer";

          cbLabel.appendChild(cb);
          cbLabel.appendChild(document.createTextNode("Check if yes"));

          inputEl = cb;
          inputContainer.appendChild(cbLabel);
        } else if (field.type === "textarea") {
          const ta = document.createElement("textarea");
          ta.placeholder = "Your answer...";
          ta.style.flex = "1";
          ta.style.padding = "4px";
          ta.style.fontSize = "10px";
          ta.style.background = "#1e293b";
          ta.style.border = "1px solid #475569";
          ta.style.color = "#fff";
          ta.style.borderRadius = "4px";
          ta.style.minHeight = "40px";
          ta.style.resize = "vertical";
          ta.style.fontFamily = "inherit";
          inputEl = ta;
          inputContainer.appendChild(inputEl);
        } else {
          const txt = document.createElement("input");
          txt.type = "text";
          txt.placeholder = "Your answer...";
          txt.style.flex = "1";
          txt.style.padding = "2px 4px";
          txt.style.fontSize = "10px";
          txt.style.background = "#1e293b";
          txt.style.border = "1px solid #475569";
          txt.style.color = "#fff";
          txt.style.borderRadius = "4px";
          inputEl = txt;
          inputContainer.appendChild(inputEl);
        }

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-secondary";
        saveBtn.textContent = "Fill";
        saveBtn.style.padding = "2px 6px";
        saveBtn.style.fontSize = "9px";
        saveBtn.style.width = "auto";

        saveBtn.addEventListener("click", () => {
          const val = inputEl.type === "checkbox" ? ((inputEl as HTMLInputElement).checked ? "yes" : "no") : inputEl.value.trim();
          if (inputEl.type !== "checkbox" && !val) return;
          if (activeActions?.onAnswerMissingField) {
            activeActions.onAnswerMissingField(field, val);
            li.style.opacity = "0.4";
            saveBtn.disabled = true;
            saveBtn.textContent = "✓ Filled";
          }
        });

        inputContainer.appendChild(saveBtn);
        li.appendChild(inputContainer);
        missList.appendChild(li);
      }
    },
    setNeedsUser(needs: boolean) {
      userPrompt.hidden = !needs;
    },
    setAwaitingOtp(waiting: boolean, fieldCount = 0) {
      otpPrompt.hidden = !waiting;
      otpBtn.hidden = !waiting;
      if (waiting && fieldCount > 0) {
        otpPrompt.textContent = `Enter the OTP in ${fieldCount} field(s) on the page, then tap Resume after OTP.`;
      }
    },
    setJdAnalysis(data) {
      const has =
        data.matched.length > 0 || data.missing.length > 0 || data.inferred.length > 0;
      jdBox.hidden = !has;
      if (!has) return;

      matchedChips.innerHTML = "";
      for (const t of data.matched.slice(0, 10)) {
        const span = document.createElement("span");
        span.className = "chip ok";
        span.textContent = t;
        matchedChips.appendChild(span);
      }

      missingChips.innerHTML = "";
      for (const t of data.missing.slice(0, 8)) {
        const span = document.createElement("span");
        span.className = "chip miss";
        span.textContent = t;
        missingChips.appendChild(span);
      }

      if (data.inferred.length) {
        inferredTitle.hidden = false;
        inferredChips.innerHTML = "";
        for (const i of data.inferred.slice(0, 6)) {
          const span = document.createElement("span");
          span.className = "chip inf";
          span.textContent = `${i.job} ← ${i.via}`;
          inferredChips.appendChild(span);
        }
      } else {
        inferredTitle.hidden = true;
        inferredChips.innerHTML = "";
      }
    },
    setCareerInsights(data) {
      if (data.visa) {
        insightsBox.hidden = false;
        visaRating.textContent = data.visa.rating;
        if (data.visa.rating === "High") {
          visaRating.style.background = "#14532d";
          visaRating.style.color = "#86efac";
        } else if (data.visa.rating === "Medium") {
          visaRating.style.background = "#422006";
          visaRating.style.color = "#fcd34d";
        } else if (data.visa.rating === "Low") {
          visaRating.style.background = "#7f1d1d";
          visaRating.style.color = "#fca5a5";
        } else {
          visaRating.style.background = "#334155";
          visaRating.style.color = "#cbd5e1";
        }
        everifyStatus.textContent = data.visa.eVerify ? "Yes (Verified)" : "No";
        everifyStatus.style.color = data.visa.eVerify ? "#10b981" : "#ef4444";
        visaReason.textContent = data.visa.reason;
      } else {
        insightsBox.hidden = true;
      }

      if (data.outreach) {
        outreachBox.hidden = false;
        liMsg.textContent = data.outreach.linkedin;
        emailMsg.textContent = data.outreach.email;
      } else {
        outreachBox.hidden = true;
      }
    },
    setTailoredResume(text: string | null) {
      if (text) {
        tailoredResumeBox.hidden = false;
        tailoredText.textContent = text;
      } else {
        tailoredResumeBox.hidden = true;
      }
    },
    setRecruiterLinks(data: { roleQuery: string; linkedinSearchUrl: string }[]) {
      const recruiterBox = shadow.querySelector(".recruiter-box") as HTMLElement;
      const recruiterLinks = shadow.querySelector(".recruiter-links") as HTMLElement;
      if (!recruiterBox || !recruiterLinks) return;
      if (!data.length) {
        recruiterBox.hidden = true;
        return;
      }
      recruiterBox.hidden = false;
      recruiterLinks.innerHTML = data
        .map(
          (r) =>
            `<a href="${escapeHtml(r.linkedinSearchUrl)}" target="_blank" rel="noreferrer" style="display:block;padding:4px 6px;margin:2px 0;background:#0f172a;border-radius:4px;font-size:9px;color:#818cf8;text-decoration:none;transition:background .15s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">${escapeHtml(r.roleQuery)} at company ↗</a>`
        )
        .join("");
    },
    setPageContext(_data) {
      // Legacy panel doesn't support pageContext — no-op
    },
    addFillLogEntry(entry: { label: string; value: string; source: string; ok: boolean; timeMs: number }) {
      const fillLogBox = shadow.querySelector(".fill-log") as HTMLElement;
      const entries = shadow.querySelector(".fill-log-entries") as HTMLElement;
      if (!fillLogBox || !entries) return;
      fillLogBox.hidden = false;

      const icon = entry.ok ? "✓" : "⚠";
      const iconColor = entry.ok ? "#22c55e" : "#fbbf24";
      const sourceIcon = entry.source === "ai" ? " 🤖" : entry.source === "learned" ? " 🧠" : "";
      const truncVal = entry.value?.length > 25 ? entry.value.slice(0, 25) + "…" : (entry.value || "—");
      const timeStr = entry.timeMs < 1000 ? `${entry.timeMs}ms` : `${(entry.timeMs / 1000).toFixed(1)}s`;

      const row = document.createElement("div");
      row.className = "fill-log-entry";
      row.innerHTML = `<span class="fl-icon" style="color:${iconColor}">${icon}</span><span class="fl-label">${escapeHtml(entry.label)}</span><span class="fl-arrow">→</span><span class="fl-value">"${escapeHtml(truncVal)}"${sourceIcon}</span><span class="fl-time">${timeStr}</span>`;
      entries.appendChild(row);

      // Auto-scroll to bottom
      fillLogBox.scrollTop = fillLogBox.scrollHeight;
    },
    clearFillLog() {
      const fillLogBox = shadow.querySelector(".fill-log") as HTMLElement;
      const entries = shadow.querySelector(".fill-log-entries") as HTMLElement;
      if (fillLogBox) fillLogBox.hidden = true;
      if (entries) entries.innerHTML = "";
    },
    setVerifyPrompt(show: boolean, filledCount?: number, stepLabel?: string) {
      const vp = shadow.querySelector(".verify-prompt") as HTMLElement;
      if (!vp) return;
      vp.hidden = !show;
      if (show) {
        const title = vp.querySelector(".vp-title") as HTMLElement;
        const desc = vp.querySelector(".vp-desc") as HTMLElement;
        if (title) title.textContent = `✅ Filled ${filledCount ?? 0} field(s)${stepLabel ? ` on ${stepLabel}` : ""} — verify before continuing`;
        if (desc) desc.textContent = "Review the form above, correct anything wrong, then click Approve & Continue.";
      }
    },
    setSubmitCountdown(_seconds: number) {
      // Legacy panel doesn't support countdown UI — no-op
    },
    setSubmitCountdownActive(_active: boolean) {
      // Legacy panel doesn't support countdown UI — no-op
    }
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
