/**
 * SuperJobAgent — Offscreen Document Script (MV3 Service Worker Keepalive)
 *
 * GAP 4.2 FIX: Runs inside the chrome.offscreen document to prevent the
 * MV3 service worker from being terminated during long-running autopilot
 * flows (multi-step ATS forms, OTP waits, CAPTCHA waits).
 *
 * Mechanisms:
 *  1. Periodic heartbeat via setInterval pinging chrome.runtime (keeps SW event
 *     loop warm between apply steps).
 *  2. Web Worker that holds an open timer (browsers keep the offscreen page
 *     alive while there's an active worker).
 *  3. Responds to SJA:KEEPALIVE messages from background.ts with an ACK so
 *     the service worker can verify the offscreen doc is healthy.
 */

// ── 1. Heartbeat interval ─────────────────────────────────────────────────────
// Every 20 seconds, write to chrome.storage.session to trigger a service worker
// wake event. This is more reliable than relying on alarms alone because
// storage writes are guaranteed to wake the SW if it has been terminated.
const HEARTBEAT_INTERVAL_MS = 20_000;

function sendHeartbeat() {
  try {
    // storage.session writes wake the service worker if it was evicted.
    chrome.storage.session
      .set({ "sja:offscreen:heartbeat": Date.now() })
      .catch(() => {});
  } catch {
    // storage.session may not be available in all contexts — non-fatal.
  }
}

const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

// Send an immediate heartbeat on document load.
sendHeartbeat();

// ── 2. Web Worker keepalive ────────────────────────────────────────────────────
// A Worker with a live timer prevents Chrome from garbage-collecting this
// offscreen document between autopilot form steps.
const workerBlob = new Blob(
  [`
    // Offscreen worker — keeps the offscreen document page alive.
    let tick = 0;
    const timer = setInterval(() => {
      postMessage({ type: 'tick', tick: ++tick, ts: Date.now() });
    }, 25_000);
    self.onmessage = (e) => {
      if (e.data?.type === 'stop') { clearInterval(timer); self.close(); }
    };
  `],
  { type: "application/javascript" },
);

let keepaliveWorker: Worker | null = null;
try {
  keepaliveWorker = new Worker(URL.createObjectURL(workerBlob));
  keepaliveWorker.onmessage = () => {
    // Worker tick received — document is alive. No-op; the tick itself is the keepalive.
  };
} catch {
  // Workers not available in this context — heartbeat interval is the fallback.
}

// ── 3. Message listener ───────────────────────────────────────────────────────
// Respond to background.ts health-checks and stop commands.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const msg = message as Record<string, unknown> | null;
  if (!msg) return;

  if (msg.type === "SJA:KEEPALIVE_PING") {
    sendResponse({ ok: true, ts: Date.now(), source: "offscreen" });
    return true;
  }

  if (msg.type === "SJA:OFFSCREEN_STOP") {
    // Autopilot session ended — clean up resources.
    clearInterval(heartbeatTimer);
    if (keepaliveWorker) {
      keepaliveWorker.postMessage({ type: "stop" });
      keepaliveWorker = null;
    }
    sendResponse({ ok: true, stopped: true });
    return true;
  }
});

export {};
