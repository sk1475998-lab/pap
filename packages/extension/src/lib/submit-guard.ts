/**
 * Submit preview guard — Enterprise In-DOM Review & Safety Modal.
 *
 * Intercepts final submit buttons/forms on job application portals.
 * Renders an isolated, rich preview dialog showing ATS match confidence,
 * autofill breakdown, and requires explicit double-confirmation if match
 * confidence is below 85%.
 */
import { getLastAudit } from "./audit-store.js";
import { diagLog } from "./diagnostics.js";
import { statusMachine } from "./lifecycle/status-machine.js";
import { AutofillStatus } from "./lifecycle/status-events.js";
import { getAgentSettings } from "./store.js";

const APPROVAL_MS = 15_000;
let installed = false;
let approvedUntil = Infinity;
let disabled = true;

export function disableSubmitGuard(): void {
  disabled = true;
  approvedUntil = Infinity;
  const existing = document.getElementById("sja-submit-guard-overlay");
  if (existing) existing.remove();
}

export function enableSubmitGuardManually(): void {
  disabled = false;
  approvedUntil = 0;
}

export function isSubmitGuardEnabled(): boolean {
  return !disabled;
}

const SUBMIT_RE = /\b(submit|submit application|send application|complete application|confirm.*submit|finish)\b/i;
const SAFE_NEXT_RE = /\b(next|continue|review|save and continue)\b/i;

function visible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el as HTMLElement);
  return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0;
}

function textOf(el: Element): string {
  if (el instanceof HTMLInputElement) return el.value || el.getAttribute("aria-label") || "";
  return el.getAttribute("aria-label") || el.textContent || "";
}

function isSubmitLike(el: Element): boolean {
  if (document.querySelector('input[type="password"]')) return false;
  if (!visible(el)) return false;
  if (el instanceof HTMLInputElement && el.type === "submit") return true;
  const text = textOf(el).replace(/\s+/g, " ").trim().toLowerCase();
  if (!text || SAFE_NEXT_RE.test(text)) return false;

  // Explicitly exclude initial modal/form triggers to avoid intercepting form openings
  if (text.includes("easy apply") || text === "apply" || text === "apply now" || text.includes("continue applying")) {
    return false;
  }

  return SUBMIT_RE.test(text);
}

interface SubmitPreviewData {
  score: number;
  filled: number;
  skipped: number;
  samples: { label: string; value: string }[];
  warnings: string[];
}

async function getPreviewData(): Promise<SubmitPreviewData> {
  const audit = await getLastAudit();
  if (!audit) {
    return {
      score: 75,
      filled: 0,
      skipped: 0,
      samples: [],
      warnings: ["No previous autofill audit found on this page. Verify inputs manually."],
    };
  }

  const filled = audit.summary?.filled ?? audit.fieldResults?.filter((f) => f.status === "filled").length ?? 0;
  const skipped = audit.summary?.skipped ?? audit.fieldResults?.filter((f) => f.status === "skipped" || f.status === "failed").length ?? 0;
  const score = Number((audit as any).score ?? (audit.summary as any)?.score ?? 0);

  const samples = (audit.fieldResults ?? [])
    .filter((f) => f.status === "filled" || f.status === "already_filled")
    .slice(0, 6)
    .map((f) => ({ label: f.label, value: String(f.value ?? "").slice(0, 50) }));

  const risky = (audit.fieldResults ?? [])
    .filter((f) => f.status === "skipped" || f.status === "failed" || /sensitive|needs user|policy|no value/i.test(f.value || f.suggestion || f.reason || ""))
    .slice(0, 4)
    .map((f) => `${f.label}: ${f.value || f.suggestion || "requires human review"}`);

  return {
    score,
    filled,
    skipped,
    samples,
    warnings: risky,
  };
}

/**
 * Enterprise in-page modal dialog for final submit confirmation.
 * Enforces double-confirmation when ATS Match Confidence < 85%.
 */
function showEnterpriseSubmitModal(data: SubmitPreviewData): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Remove existing modal if any
    const existing = document.getElementById("sja-submit-guard-overlay");
    if (existing) existing.remove();

    const isLowConfidence = data.score < 85;
    const overlay = document.createElement("div");
    overlay.id = "sja-submit-guard-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sja-guard-title");

    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      color: #f8fafc;
      padding: 24px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transform: scale(0.96);
      transition: transform 0.2s ease-out;
    `;

    const scoreColor = data.score >= 85 ? "#10b981" : data.score >= 70 ? "#f59e0b" : "#ef4444";
    const scoreBadgeText = data.score >= 85 ? "✓ High Match Ready" : "⚠️ Low Match Confidence";

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">🛡️</span>
          <h2 id="sja-guard-title" style="margin:0;font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#fff">Submit Application Safety Guard</h2>
        </div>
        <span style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;background:${scoreColor}22;color:${scoreColor};border:1px solid ${scoreColor}44">${data.score}% Match</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06)">
          <div><strong style="color:#94a3b8">Fields Autofilled:</strong> <span style="color:#10b981;font-weight:600">${data.filled}</span></div>
          <div><strong style="color:#94a3b8">Needs Review:</strong> <span style="color:#f59e0b;font-weight:600">${data.skipped}</span></div>
        </div>

        ${data.samples.length > 0 ? `
          <div>
            <div style="font-weight:600;font-size:12px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Autofill Verification Sample</div>
            <div style="max-height:110px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:8px;padding:8px 10px;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:4px">
              ${data.samples.map(s => `<div style="font-size:12px"><span style="color:#cbd5e1;font-weight:500">${s.label}:</span> <span style="color:#94a3b8">${s.value || "—"}</span></div>`).join("")}
            </div>
          </div>
        ` : ""}

        ${data.warnings.length > 0 ? `
          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:8px 12px;font-size:12px;color:#fde68a">
            <strong>⚠️ Review Flags:</strong>
            <ul style="margin:4px 0 0 16px;padding:0">
              ${data.warnings.map(w => `<li>${w}</li>`).join("")}
            </ul>
          </div>
        ` : ""}

        ${isLowConfidence ? `
          <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px">
            <div style="color:#fca5a5;font-weight:600;font-size:12.5px">⚠️ Low Match Guard (< 85%)</div>
            <div style="color:#cbd5e1;font-size:12px">Your resume ATS match score is ${data.score}%. To maintain high application success rates, verify that all responses match your intended qualifications.</div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px;color:#fff;font-weight:500;font-size:12px">
              <input type="checkbox" id="sja-guard-confirm-chk" style="width:16px;height:16px;accent-color:#6366f1;cursor:pointer" />
              <span>I have reviewed the answers and approve final submission</span>
            </label>
          </div>
        ` : ""}
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px">
        <button id="sja-guard-btn-cancel" type="button" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#e2e8f0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s">
          ✕ Cancel & Review Form
        </button>
        <button id="sja-guard-btn-submit" type="button" style="background:linear-gradient(135deg, #6366f1, #8b5cf6);border:none;color:#fff;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,0.35);transition:all 0.15s">
          ✓ Confirm & Submit Application
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Animation trigger
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      modal.style.transform = "scale(1)";
    });

    const chk = modal.querySelector<HTMLInputElement>("#sja-guard-confirm-chk");
    const submitBtn = modal.querySelector<HTMLButtonElement>("#sja-guard-btn-submit");
    const cancelBtn = modal.querySelector<HTMLButtonElement>("#sja-guard-btn-cancel");

    // Enforce checkbox requirement if low confidence
    if (isLowConfidence && submitBtn && chk) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.45";
      submitBtn.style.cursor = "not-allowed";

      chk.addEventListener("change", () => {
        submitBtn.disabled = !chk.checked;
        submitBtn.style.opacity = chk.checked ? "1" : "0.45";
        submitBtn.style.cursor = chk.checked ? "pointer" : "not-allowed";
      });
    }

    const cleanup = (result: boolean) => {
      overlay.style.opacity = "0";
      modal.style.transform = "scale(0.96)";
      setTimeout(() => overlay.remove(), 200);
      window.removeEventListener("keydown", handleKey);
      resolve(result);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cleanup(false);
    };

    cancelBtn?.addEventListener("click", () => cleanup(false));
    submitBtn?.addEventListener("click", () => {
      if (isLowConfidence && chk && !chk.checked) return;
      cleanup(true);
    });
    window.addEventListener("keydown", handleKey);
  });
}

/**
 * Authorize one known autopilot submit click after review countdown.
 */
export function authorizeAutopilotSubmitWindow(): void {
  approvedUntil = Date.now() + APPROVAL_MS;
  void diagLog("submit-guard", "autopilot-submit-authorized", {
    message: "Final review countdown completed; allowing one submit click while awaiting platform confirmation.",
  });
}

async function confirmSubmit(): Promise<boolean> {
  if (disabled) return true;
  const settings = await getAgentSettings().catch(() => null);
  if (settings && settings.enableSubmitGuard === false) return true;

  if (Date.now() < approvedUntil) return true;
  const data = await getPreviewData();
  const ok = await showEnterpriseSubmitModal(data);
  if (ok) {
    approvedUntil = Date.now() + APPROVAL_MS;
    void diagLog("audit", "submit-approved", { message: "User approved final submit preview modal" });
  } else {
    void diagLog("audit", "submit-blocked", { level: "warn", message: "User cancelled final submit preview modal" });
    try {
      statusMachine.transition(AutofillStatus.PAUSED, { reason: "user" });
    } catch {
      /* ignore if already paused */
    }
  }
  return ok;
}

export function installSubmitGuard(): void {
  if (installed) return;
  installed = true;

  document.addEventListener("click", (ev) => {
    if (disabled) return;
    const target = ev.target as Element | null;
    const btn = target?.closest?.("button, input[type=submit], input[type=button], a[role=button], [role=button]");
    if (!btn || !isSubmitLike(btn)) return;
    if (Date.now() < approvedUntil) return;

    // Asynchronously check settings; if guard is disabled, let native click proceed without cancellation
    void getAgentSettings().then((settings) => {
      if (disabled || (settings && settings.enableSubmitGuard === false)) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      void confirmSubmit().then((ok) => {
        if (!ok) return;
        void diagLog("submit-guard", "submit-click-released", {
          message: "Submit click released; waiting for platform confirmation before recording application.",
        });
        (btn as HTMLElement).click();
      });
    }).catch(() => {});
  }, true);

  document.addEventListener("submit", (ev) => {
    if (disabled) return;
    if (document.querySelector('input[type="password"]')) return;
    if (Date.now() < approvedUntil) return;

    void getAgentSettings().then((settings) => {
      if (disabled || (settings && settings.enableSubmitGuard === false)) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const form = ev.target as HTMLFormElement;
      void confirmSubmit().then((ok) => {
        if (!ok) return;
        void diagLog("submit-guard", "submit-form-released", {
          message: "Submit form released; waiting for platform confirmation before recording application.",
        });
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      });
    }).catch(() => {});
  }, true);
}
