/**
 * LinkedIn floating FAB (floating action button) — a small shadow-DOM pill
 * that sits in the bottom-right corner of LinkedIn job pages, inspired by
 * the "LinkedIn ATS Resume Builder" extension's floating buttons but
 * reimplemented from scratch to avoid copying.
 *
 * Why shadow DOM? LinkedIn's CSS uses aggressive resets and class hashing.
 * Shadow DOM gives us style isolation so our pill doesn't get clobbered and
 * we don't accidentally style LinkedIn's own elements.
 *
 * Selector strategy: prefer stable LinkedIn attributes (`data-job-id`,
 * `componentkey^="JobDetails_"`, `data-test-*`) over class names. Classes
 * are last-resort fallbacks and are clearly marked "fragile".
 */

import { isLinkedInJobsUrl, isLinkedInEasyApplyOpen } from "@/lib/linkedin.js";
import { isExternalApplyJob, getExternalApplyUrl, openExternalApplyTab } from "@/lib/linkedin-external-apply.js";
import { MSG, type MatchResponse } from "@/lib/messaging.js";
import { showToast, mountToastHost } from "@/lib/ui.js";

interface FabState {
  score: number | null;
  loading: boolean;
  filling: boolean;
  visible: boolean;
  jobTitle: string;
}

const HOST_ID = "sja-linkedin-fab-host";

export function mountLinkedInFab(): () => void {
  if (!isLinkedInJobsUrl()) return () => {};
  if (document.getElementById(HOST_ID)) return () => {};

  // Host element lives in the page DOM; shadow root isolates our CSS.
  const host = document.createElement("div");
  host.id = HOST_ID;
  // LinkedIn sometimes removes non-LI elements; mark with a data-attr so we
  // can detect and re-mount if needed.
  host.setAttribute("data-sja-fab", "1");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483646";
  host.style.right = "18px";
  host.style.bottom = "18px";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .fab {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white; padding: 8px 12px; border-radius: 999px;
      box-shadow: 0 10px 30px rgba(79,70,229,.35), 0 2px 6px rgba(0,0,0,.15);
      cursor: pointer; user-select: none; font-size: 12px; font-weight: 600;
      letter-spacing: .01em; border: 1px solid rgba(255,255,255,.15);
      transition: transform .15s ease, box-shadow .15s ease, opacity .2s ease;
      opacity: 0; transform: translateY(8px) scale(.96);
    }
    .fab.mounted { opacity: 1; transform: translateY(0) scale(1); }
    .fab:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(79,70,229,.45); }
    .fab:active { transform: translateY(0); }
    .fab[aria-busy="true"] { cursor: wait; opacity: .85; }
    .logo {
      width: 24px; height: 24px; border-radius: 7px;
      background: rgba(255,255,255,.18); display: grid; place-items: center;
      font-weight: 800; font-size: 12px; flex-shrink: 0;
    }
    .text { display: flex; flex-direction: column; line-height: 1.15; }
    .title { font-size: 12px; }
    .sub { font-size: 9.5px; opacity: .85; font-weight: 500; }
    .score {
      margin-left: 4px; padding: 3px 7px; border-radius: 999px;
      background: rgba(255,255,255,.2); font-size: 11px; font-weight: 700; min-width: 38px; text-align: center;
    }
    .score.high { background: #10b981; }
    .score.mid  { background: #f59e0b; }
    .score.low  { background: #ef4444; }
    .menu {
      position: absolute; bottom: calc(100% + 8px); right: 0;
      background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
      padding: 6px; min-width: 210px; box-shadow: 0 20px 40px rgba(0,0,0,.45);
      display: none; color: #e2e8f0;
    }
    .menu.open { display: block; animation: pop .15s ease-out; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .menuitem {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 8px 10px; border-radius: 8px; background: transparent; color: inherit;
      border: 0; cursor: pointer; font-size: 12px; text-align: left;
      font-family: inherit;
    }
    .menuitem:hover { background: #1e293b; }
    .menuitem .k { margin-left: auto; font-size: 10px; color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .menuitem:disabled { opacity: .5; cursor: wait; }
    .pulse::before {
      content: ''; position: absolute; inset: -2px; border-radius: 999px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      z-index: -1; animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% { opacity: .6; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.2); }
    }
  `;
  shadow.appendChild(style);

  // Build DOM
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  shadow.appendChild(wrap);

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fab";
  fab.setAttribute("aria-label", "Super Job Agent — quick actions");
  fab.innerHTML = `
    <span class="logo">S</span>
    <span class="text">
      <span class="title" id="title">Super Job Agent</span>
      <span class="sub" id="sub">Click for actions</span>
    </span>
    <span class="score" id="score" style="display:none">--</span>
  `;
  wrap.appendChild(fab);

  const menu = document.createElement("div");
  menu.className = "menu";
  menu.innerHTML = `
    <button class="menuitem" data-act="autoapply">🤖 Auto-apply this job</button>
    <button class="menuitem" data-act="autofill">⚡ Autofill form<span class="k">⌥⇧F</span></button>
    <button class="menuitem" data-act="external-apply" style="display:none">🌐 Apply on company website</button>
    <button class="menuitem" data-act="match">🎯 Refresh match score</button>
    <button class="menuitem" data-act="open-popup">🧩 Open popup</button>
    <button class="menuitem" data-act="open-panel">📋 Open side panel</button>
  `;
  wrap.appendChild(menu);
  const externalApplyBtn = menu.querySelector('[data-act="external-apply"]') as HTMLButtonElement | null;

  // Mount a toast host inside the shadow so feedback is visible even when
  // LinkedIn's main frame doesn't have one.
  const toastHost = document.createElement("div");
  toastHost.style.cssText = "position:fixed;bottom:54px;right:0;display:flex;flex-direction:column;gap:8px;pointer-events:none;z-index:2147483647;max-width:280px;";
  shadow.appendChild(toastHost);

  // Simple in-shadow toast (reimplements ui.ts logic against the shadow host
  // so it styles correctly within our scoped DOM).
  function sToast(message: string, kind: "info" | "success" | "error" = "info", ms = 2500) {
    const el = document.createElement("div");
    const colors = {
      info: "background:#0f172a;border:#334155;color:#e2e8f0",
      success: "background:#052e16;border:#166534;color:#bbf7d0",
      error: "background:#450a0a;border:#991b1b;color:#fecaca",
    }[kind];
    el.style.cssText = `pointer-events:auto;padding:8px 12px;border-radius:8px;border:1px solid;font-size:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);opacity:0;transform:translateY(8px);transition:all .18s ease;${colors}`;
    el.textContent = message;
    toastHost.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 200); }, ms);
  }

  const state: FabState = { score: null, loading: false, filling: false, visible: true, jobTitle: "" };

  const $ = (sel: string) => shadow.querySelector(sel) as HTMLElement | null;
  const titleEl = $("#title")!;
  const subEl = $("#sub")!;
  const scoreEl = $("#score") as HTMLElement;

  function render() {
    const inApply = isLinkedInEasyApplyOpen();
    titleEl.textContent = inApply ? "Easy Apply open" : "Super Job Agent";
    if (state.filling) {
      subEl.textContent = "Filling form…";
    } else if (state.loading) {
      subEl.textContent = "Scoring JD…";
    } else if (state.score != null) {
      subEl.textContent = `Match ${state.score}%${state.jobTitle ? " · " + state.jobTitle.slice(0, 28) : ""}`;
    } else if (inApply) {
      subEl.textContent = "Click to auto-fill";
    } else {
      subEl.textContent = "Click for actions";
    }
    if (state.score != null) {
      scoreEl.style.display = "";
      scoreEl.textContent = `${state.score}`;
      scoreEl.className = "score " + (state.score >= 75 ? "high" : state.score >= 50 ? "mid" : "low");
    } else {
      scoreEl.style.display = "none";
    }
    fab.setAttribute("aria-busy", String(state.loading || state.filling));
  }

  async function sendMsg<T>(type: string): Promise<T | { error?: string } | null> {
    try {
      return await chrome.runtime.sendMessage({ type }) as T;
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  async function sendToActiveTab<T>(message: { type: string }): Promise<T | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = Array.isArray(tabs) ? tabs[0] : null;
    if (!tab?.id) return null;
    try {
      return (await chrome.tabs.sendMessage(tab.id, message)) as T;
    } catch {
      return null;
    }
  }

  async function doAutofill() {
    if (state.filling) return;
    state.filling = true; render();
    try {
      // Ask background to ensure orchestrator/agent is injected.
      await chrome.runtime.sendMessage({ type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: "linkedin-fab" } }).catch(() => {});
      await new Promise((r) => setTimeout(r, 350));
      const r = await sendToActiveTab<{ filled?: number; skipped?: number; error?: string }>({ type: MSG.AUTOFILL });
      if (r?.error) { sToast(r.error, "error"); }
      else if (r) { sToast(`Filled ${r.filled ?? 0} field${r.filled === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped}` : ""}`, "success"); setTimeout(() => void doMatch(), 1200); }
      else { sToast("Autofill sent.", "success"); }
    } catch (e) {
      sToast(e instanceof Error ? e.message : String(e), "error", 4000);
    } finally {
      state.filling = false; render();
    }
  }

  async function doMatch() {
    if (state.loading) return;
    state.loading = true; render();
    try {
      await chrome.runtime.sendMessage({ type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: "linkedin-fab" } }).catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : null;
      if (!tab?.id) throw new Error("No active tab");
      const res = await chrome.tabs.sendMessage(tab.id, { type: MSG.GET_MATCH }).catch((err) => {
        throw new Error("Orchestrator not ready yet — open a job detail page and retry. " + err.message);
      }) as MatchResponse | { error?: string } | null;
      if (res && "error" in res && res.error) { sToast(res.error, "error", 4000); }
      else if (res && "score" in res) {
        state.score = (res as MatchResponse).score;
        // Try to pull job title from DOM using stable LinkedIn selectors.
        const t = document.querySelector('[class*="job-details-jobs-unified-top-card__job-title"], [data-job-id] a, h1');
        state.jobTitle = (t?.textContent ?? "").trim().slice(0, 40);
        sToast(`Match: ${state.score}% — ${(res as MatchResponse).missing.length} missing keywords`, "success");
      }
    } catch (e) {
      sToast(e instanceof Error ? e.message : String(e), "error", 4000);
    } finally {
      state.loading = false; render();
    }
  }

  // Toggle menu on FAB click
  let menuOpen = false;
  fab.addEventListener("click", (ev) => {
    ev.stopPropagation();
    // Primary action: if Easy Apply modal is open, just autofill.
    if (isLinkedInEasyApplyOpen() && !menuOpen) {
      void doAutofill();
      return;
    }
    menuOpen = !menuOpen;
    menu.classList.toggle("open", menuOpen);
  });
  document.addEventListener("click", (ev) => {
    if (!menuOpen) return;
    if (!wrap.contains(ev.target as Node)) { menuOpen = false; menu.classList.remove("open"); }
  });

  menu.addEventListener("click", async (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-act]") as HTMLButtonElement | null;
    if (!btn) return;
    menuOpen = false; menu.classList.remove("open");
    const act = btn.dataset.act;
    btn.disabled = true;
    try {
      if (act === "autoapply") {
        // Ensure orchestrator injected, reset done state, trigger autopilot.
        await chrome.runtime.sendMessage({ type: "SJA:INJECT_ORCHESTRATOR", payload: { url: location.href, reason: "linkedin-fab" } }).catch(() => {});
        await new Promise((r) => setTimeout(r, 400));
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = Array.isArray(tabs) ? tabs[0] : null;
        if (tab?.id) {
          await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOPILOT" }).catch(() => {});
          sToast("🤖 Auto-apply started", "success");
        }
      }
      else if (act === "external-apply") {
        const url = (btn.dataset as any).url || lastExternalUrl;
        if (url) {
          sToast(`🌐 Opening ${(() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "external site"; } })()} in new tab…`, "info");
          const tabId = await openExternalApplyTab(url, { active: true });
          if (tabId) sToast("✓ External ATS opened — autopilot will fill it.", "success", 4000);
          else sToast("⚠ Couldn't open external tab — try clicking Apply on LinkedIn.", "error", 4000);
        } else {
          sToast("No external URL detected", "error");
        }
      }
      else if (act === "autofill") await doAutofill();
      else if (act === "match") await doMatch();
      else if (act === "open-popup") {
        try { await (chrome.action as any).openPopup(); sToast("Popup opened", "success"); }
        catch { sToast("Click the S icon in your toolbar to open the popup.", "info", 5000); }
      } else if (act === "open-panel") {
        try {
          const resp = await chrome.runtime.sendMessage({ type: "SJA:OPEN_SIDEPANEL" }).catch(() => null);
          if (resp?.ok) {
            sToast("Side panel opened", "success");
          } else {
            // Fallback: trigger in-page panel toggle if browser sidepanel is unavailable
            window.dispatchEvent(new CustomEvent("sja:toggle-panel"));
            sToast("Side panel opened", "success");
          }
        } catch (e) {
          sToast("Couldn't open side panel.", "error");
        }
      }
    } finally {
      btn.disabled = false;
    }
  });

  // Proactively kick off a match score 600ms after landing on a job page.
  let matchTimer: ReturnType<typeof setTimeout> | null = null;
  const kickMatch = () => {
    if (matchTimer) clearTimeout(matchTimer);
    matchTimer = setTimeout(() => { void doMatch(); }, 900);
  };

  // Show/hide the "Apply on company website" item based on whether this is
  // an external-apply job. This is what the user clicks to start external
  // autofill (we never auto-open anymore).
  let lastExternalUrl: string | null = null;
  const refreshExternalApplyVisibility = () => {
    if (!externalApplyBtn) return;
    try {
      if (!isLinkedInEasyApplyOpen() && isExternalApplyJob()) {
        const url = getExternalApplyUrl();
        if (url) {
          let host = "";
          try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* */ }
          externalApplyBtn.textContent = host ? `🌐 Apply on ${host}` : "🌐 Apply on company website";
          externalApplyBtn.style.display = "";
          (externalApplyBtn.dataset as any).url = url;
          lastExternalUrl = url;
          return;
        }
      }
    } catch { /* */ }
    externalApplyBtn.style.display = "none";
    lastExternalUrl = null;
  };

  // Watch for URL/title changes (LinkedIn SPA) to re-hide on non-job pages
  // and refresh score on new jobs. Use data-job-id as the stable signal.
  let lastJobId: string | null = null;
  const mo = new MutationObserver(() => {
    if (!isLinkedInJobsUrl()) { if (state.visible) { host.style.display = "none"; state.visible = false; } return; }
    if (!state.visible) { host.style.display = ""; state.visible = true; fab.classList.add("mounted"); }
    const jobEl = document.querySelector("[data-job-id]");
    const id = jobEl?.getAttribute("data-job-id");
    if (id && id !== lastJobId) { lastJobId = id; state.score = null; state.jobTitle = ""; render(); kickMatch(); }
    // Refresh external-apply button visibility when the DOM settles.
    refreshExternalApplyVisibility();
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-job-id", "class"] });

  // Animate in
  requestAnimationFrame(() => fab.classList.add("mounted"));
  // Initial score kick
  kickMatch();
  // Initial external-apply button state
  setTimeout(refreshExternalApplyVisibility, 1200);

  // Also hook global message so background-triggered autofill (context
  // menu / keyboard shortcut) can refresh our displayed score after fill.
  const msgListener = (msg: { type?: string }) => {
    if (msg?.type === MSG.AUTOFILL || msg?.type === "SJA:AUTOFILL") {
      // Small delay then refresh match.
      setTimeout(() => { void doMatch(); }, 1200);
    }
  };
  chrome.runtime.onMessage.addListener(msgListener);

  // Unmount
  return () => {
    mo.disconnect();
    if (matchTimer) clearTimeout(matchTimer);
    chrome.runtime.onMessage.removeListener(msgListener);
    host.remove();
  };
}
