/**
 * Shared UI helpers used across popup/sidepanel/in-page panel:
 *  - toast (transient, ARIA-live, auto-dismiss)
 *  - small spinner
 *  - error boundary helper (render message instead of silent catch)
 *
 * Keep this zero-dep so it can be imported from any entrypoint.
 */

export type ToastKind = "info" | "success" | "warn" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  timeoutMs?: number;
}

type ToastListener = (t: Toast) => void;
let _toastId = 0;
const _listeners = new Set<ToastListener>();

export function showToast(message: string, kind: ToastKind = "info", timeoutMs = 2800): Toast {
  const t: Toast = { id: ++_toastId, kind, message, timeoutMs };
  _listeners.forEach((l) => l(t));
  return t;
}

export function listenToasts(listener: ToastListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Mount a minimal toast host element into the current document if one doesn't
 * already exist. Works in popup, sidepanel, and in-page panel contexts.
 * Styles are scoped via a unique class prefix so host-page CSS can't break it.
 */
export function mountToastHost(target: HTMLElement = document.body): HTMLElement {
  const HOST_ID = "sja-toast-host";
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (host) return host;
  host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("aria-live", "polite");
  host.setAttribute("role", "region");
  host.style.cssText = `
    position: fixed; z-index: 2147483647; bottom: 16px; right: 16px;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px; line-height: 1.4; max-width: 320px;
  `;
  target.appendChild(host);

  listenToasts((t) => {
    if (!host) return;
    const el = document.createElement("div");
    const colors: Record<ToastKind, string> = {
      info: "background:#0f172a; color:#e2e8f0; border-color:#334155",
      success: "background:#052e16; color:#bbf7d0; border-color:#166534",
      warn: "background:#422006; color:#fde68a; border-color:#a16207",
      error: "background:#450a0a; color:#fecaca; border-color:#991b1b",
    };
    el.style.cssText = `
      pointer-events: auto; padding: 8px 12px; border-radius: 8px;
      border: 1px solid; box-shadow: 0 6px 20px rgba(0,0,0,.25);
      transform: translateY(8px); opacity: 0; transition: transform .18s ease, opacity .18s ease;
      ${colors[t.kind]}
    `;
    el.textContent = t.message;
    host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translateY(0)";
      el.style.opacity = "1";
    });
    const remove = () => {
      el.style.transform = "translateY(8px)";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 200);
    };
    setTimeout(remove, t.timeoutMs ?? 2800);
  });

  return host;
}

/**
 * Send a message to the active tab's content script and produce a human
 * readable error if there's no receiver instead of throwing a confusing
 * "Could not establish connection" error.
 */
export async function sendToActiveTab<T = unknown>(
  message: { type: string; [k: string]: unknown },
  opts: { notInstalledMsg?: string } = {},
): Promise<T> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = Array.isArray(tabs) ? tabs[0] : null;
  if (!tab?.id) throw new Error("No active tab.");
  if (!/^https?:/.test(tab.url ?? "")) {
    throw new Error("Super Job Agent only works on http(s) pages.");
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, message);
    if (res && typeof res === "object" && "error" in res) {
      throw new Error(String((res as { error: unknown }).error));
    }
    return res as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Receiving end does not exist|Could not establish|no listener/i.test(msg)) {
      throw new Error(
        opts.notInstalledMsg ??
          "Agent isn't active on this page yet. Open a job application page (LinkedIn, Greenhouse, Lever, Workday, etc.) and try again, or right-click → 'Super Job Agent: Auto-fill this page'.",
      );
    }
    throw err;
  }
}

const DEFAULT_NOT_READY_MSG =
  "Agent isn't active on this page yet. Open a job application page (LinkedIn, Greenhouse, Lever, Workday, etc.) and try again, or right-click → 'Super Job Agent: Auto-fill this page'.";

/** Errors that mean "no content-script listener answered the message yet". */
function isNoAgentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Receiving end does not exist|Could not establish|no listener|message port closed|not initialized/i.test(
      msg,
    )
  );
}

const _bootstrapSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Like `sendToActiveTab`, but self-heals when the content agent (orchestrator)
 * has not been injected into the active tab yet.
 *
 * The background only accepts `SJA:INJECT_ORCHESTRATOR` requests from content
 * scripts (a security boundary — pages/extension UIs must not be able to force
 * injection). The <all_urls> gatekeeper (content.js) is already present in
 * every http(s) tab, and it forwards `SJA:INJECT_ORCHESTRATOR` messages it
 * receives in the page to the background. So the bootstrap is:
 *
 *   1. Try the action directly (fast path when the agent is already there).
 *   2. If nothing answered, poke the gatekeeper to request injection (from the
 *      page context, which the background accepts) and fall back to executing
 *      content.js when the poke itself can't be delivered.
 *   3. Poll the action until the freshly booted agent answers (bounded).
 *
 * A resolved `undefined` also counts as "agent not present": an unanswered
 * tabs.sendMessage can resolve without a value when a non-responding content
 * listener (the gatekeeper) consumed the message.
 */
export async function sendToActiveTabWithBootstrap<T = unknown>(
  message: { type: string; [k: string]: unknown },
  opts: { notInstalledMsg?: string } = {},
): Promise<T> {
  const notInstalledMsg = opts.notInstalledMsg ?? DEFAULT_NOT_READY_MSG;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = Array.isArray(tabs) ? tabs[0] : null;
  if (!tab?.id) throw new Error("No active tab.");
  const url = tab.url ?? "";
  if (!/^https?:/.test(url)) {
    throw new Error("Super Job Agent only works on http(s) pages.");
  }

  const attempt = async (): Promise<T | undefined> => {
    try {
      const res = await chrome.tabs.sendMessage(tab.id!, message);
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(String((res as { error: unknown }).error));
      }
      // `undefined` = no orchestrator listener answered (e.g. the gatekeeper
      // consumed the message while triggering injection). Treat as not-ready.
      return res === undefined ? undefined : (res as T);
    } catch (err) {
      if (isNoAgentError(err)) return undefined;
      throw err;
    }
  };

  // Fast path: agent already injected.
  const first = await attempt();
  if (first !== undefined) return first;

  // Bootstrap path (see docblock). The poke is a no-op when the orchestrator is
  // already present (its default case responds undefined).
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "SJA:INJECT_ORCHESTRATOR",
      payload: { url, reason: "ui-bootstrap" },
    });
  } catch {
    try {
      // Gatekeeper not reachable either — (re)inject the <all_urls> detector,
      // which requests injection from the page context on boot.
      await chrome.scripting?.executeScript({
        target: { tabId: tab.id },
        files: ["content-scripts/content.js"],
      });
    } catch {
      // Execution may be blocked (policy/permission). Polling below still gives
      // the agent time to boot if the original message already triggered it.
    }
  }

  for (let i = 0; i < 8; i++) {
    await _bootstrapSleep(300);
    const res = await attempt();
    if (res !== undefined) return res;
  }
  throw new Error(notInstalledMsg);
}
