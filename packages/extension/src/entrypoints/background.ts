import { defineBackground } from "wxt/utils/define-background";
import { diagLog, installExceptionLogging, isLocalApiStreamingEnabled } from "@/lib/diagnostics.js";
import type { TelemetryEvent } from "@/lib/telemetry/event-bus.js";
import { canInjectOrchestrator, decideInjectionForUrl, originPatternForUrl } from "@/lib/permission-policy.js";
import { createSecureRuntimeRouter, hasStringProp, objectPayload } from "@/lib/secure-message-router.js";

/**
 * Background service worker.
 *
 * Responsibilities (expanded from 77-line original):
 *  - Context menu autofill
 *  - Keepalive alarm
 *  - Autonomous campaign scheduling
 *  - Navigation notification to content scripts
 *  - Telemetry event batching proxy
 *  - Tab state management
 *  - API proxy for LLM calls (rate limiting / retry)
 */
export default defineBackground(() => {
  installExceptionLogging("background");

  // Allow content scripts to access session storage
  if (typeof chrome !== "undefined" && chrome.storage?.session?.setAccessLevel) {
    chrome.storage.session
      .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
      .catch((err) => {
        void diagLog("background", "session-access-level-error", { data: { error: String(err) } });
      });
  }

  /** Track which tab is handling which job key. */
  const tabJobMap = new Map<number, string>();
  let applicationLockQueue: Promise<void> = Promise.resolve();

  /** Pending telemetry events — batched for efficiency. */
  let telemetryQueue: TelemetryEvent[] = [];

  chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
      id: "superjob-autofill",
      title: "Super Job Agent: Auto-fill this page",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "superjob-open-panel",
      title: "Super Job Agent: Open side panel",
      contexts: ["page", "action"],
    });
    chrome.alarms.create("sja-keepalive", { periodInMinutes: 0.4 });
    chrome.alarms.create("sja-campaigns", { periodInMinutes: 15, delayInMinutes: 1 });
    chrome.alarms.create("sja-telemetry-flush", { periodInMinutes: 1 });
    chrome.alarms.create("sja-cloud-sync", { periodInMinutes: 5, delayInMinutes: 0.5 });

    // NOTE: We do NOT call setPanelBehavior({ openPanelOnActionClick: true })
    // because the toolbar icon opens the quick-action popup (Settings, match
    // score, Jobs, Tracker, and the read-only synced-profile status). Profile
    // edits stay on the web dashboard; the side panel is the on-page copilot.

    // Allow the side panel to be opened on any tab (not just ones we've set
    // options for), so users can open it from LinkedIn/Greenhouse/Lever/Workday
    // and the demo page without special setup.
    if (chrome.sidePanel?.setOptions) {
      chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true }).catch(() => {});
    }

    // Feature 1: True First-Run Onboarding
    if (details.reason === "install") {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }

    // Purge expired pattern-cache entries lazily on startup/update (non-blocking)
    import("@/lib/pattern-cache.js")
      .then(({ purgeExpired }) => purgeExpired())
      .catch(() => {});

    // Initial Cloud Sync (pull profile/settings/applications from server)
    import("@/lib/sync/sync-client.js")
      .then(({ syncWithCloud }) => syncWithCloud())
      .catch(() => {});
    
    void diagLog("background", "installed", { message: `Extension ${details.reason}` });
  });

  // Also purge on service worker startup (covers browser restarts without install event)
  import("@/lib/pattern-cache.js")
    .then(({ purgeExpired }) => purgeExpired())
    .catch(() => {});

  // Cloud sync on service worker wake
  import("@/lib/sync/sync-client.js")
    .then(({ syncWithCloud }) => syncWithCloud())
    .catch(() => {});

  // Ensure keepalive alarm exists on service worker wake
  chrome.alarms.get("sja-keepalive", (alarm) => {
    if (!alarm) {
      chrome.alarms.create("sja-keepalive", { periodInMinutes: 0.4 });
    }
  });


  // ── Phase 3: Recon Tool Archive + Reflexion Memory persistence ────────────
  // Restore the tool archive and reflexion memory from chrome.storage.local on
  // every service-worker wake-up (covers both browser restarts and SW evictions).
  // These are module-level Maps inside the crew agents; we broadcast them to any
  // active content script tabs via message so each tab's Recon agent starts warm.
  const SJA_TOOL_ARCHIVE_KEY    = "sja:recon:toolArchive";
  const SJA_REFLEXION_MEM_KEY   = "sja:healer:reflexionMemory";

  (async () => {
    try {
      const stored = await chrome.storage.local.get([SJA_TOOL_ARCHIVE_KEY, SJA_REFLEXION_MEM_KEY]);
      const archiveJson  = stored[SJA_TOOL_ARCHIVE_KEY]  as string | undefined;
      const reflexionJson = stored[SJA_REFLEXION_MEM_KEY] as string | undefined;
      // Broadcast to all tabs so in-page crew agents restore their state
      const tabs = await chrome.tabs.query({}).catch(() => [] as chrome.tabs.Tab[]);
      for (const tab of tabs) {
        if (!tab.id || tab.id < 0) continue;
        chrome.tabs.sendMessage(tab.id, {
          type: "SJA:RESTORE_AGENT_MEMORY",
          payload: { archiveJson, reflexionJson },
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }
  })();

  // Helper: open the side panel for the given tab's window.
  async function openSidePanelForTab(tab?: chrome.tabs.Tab | null): Promise<void> {
    if (!tab?.windowId) {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = active;
    }
    if (!tab?.windowId) return;
    try {
      if (chrome.sidePanel?.setOptions && tab.id != null) {
        await chrome.sidePanel
          .setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true })
          .catch(() => {});
      }
      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (err) {
      void diagLog("background", "open-sidepanel-failed", { level: "warn", data: { error: String(err) } });
    }
  }

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "superjob-open-panel") {
      await openSidePanelForTab(tab);
      return;
    }
    if (info.menuItemId !== "superjob-autofill" || tab?.id == null) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOFILL" });
      return;
    } catch {
      // The lightweight detector is not present on an arbitrary company site.
      // A context-menu click is an explicit user gesture, so it may request only
      // that origin rather than retaining `<all_urls>` at install time.
    }

    const decision = decideInjectionForUrl(tab.url);
    const origin = tab.url ? originPatternForUrl(tab.url) : null;
    if (!decision.allowed || !decision.requiresOptionalHostPermission || !origin || !chrome.permissions?.request) {
      void diagLog("background", "autofill-injection-denied", {
        level: "warn",
        message: "Autofill is available only on eligible job/application pages.",
        data: { tabId: tab.id, url: tab.url, reason: decision.reason },
      });
      return;
    }

    try {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        void diagLog("background", "optional-permission-denied", { data: { tabId: tab.id, origin } });
        return;
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-scripts/content.js"] });
      void diagLog("background", "optional-origin-detector-injected", { data: { tabId: tab.id, origin } });
      // The gatekeeper injects the orchestrator (agent.js) on boot; give it one
      // frame before sending AUTOFILL, then retry once. Sending immediately
      // raced the message ahead of the orchestrator that actually fills, so the
      // first context-menu autofill on a new origin was a silent no-op.
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "SJA:AUTOFILL" }).catch(() => {
          setTimeout(() => { chrome.tabs.sendMessage(tab.id!, { type: "SJA:AUTOFILL" }).catch(() => {}); }, 400);
        });
      }, 150);
    } catch (error) {
      void diagLog("background", "autofill-failed", {
        level: "warn",
        message: "Could not activate autofill on this page.",
        data: { tabId: tab.id, error: String(error) },
      });
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "sja-keepalive") {
      try {
        if (chrome.storage?.session) {
          void chrome.storage.session.set({ lastKeepalive: Date.now() });
        }
      } catch { /* session storage access non-fatal */ }
      void chrome.storage.local.get("diagnostics");
    }
    if (alarm.name === "sja-campaigns") {
      void import("@/lib/campaign-agent.js").then(({ runAutonomousCampaigns }) => runAutonomousCampaigns()).catch((error) => {
        void diagLog("background", "campaign-runner-load-error", { level: "error", message: String(error) });
      });
    }
    if (alarm.name === "sja-telemetry-flush") {
      void flushTelemetry();
    }
    if (alarm.name === "sja-cloud-sync") {
      void import("@/lib/sync/sync-client.js").then(({ syncWithCloud }) => syncWithCloud()).catch(() => {});
    }
  });

  
  // GAP-SYNC-03 FIX: FORCE_SYNC message listener
  // Dashboard can trigger immediate sync after resume upload â€” no 5-min wait.
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if ((message as any)?.type === "SJA:APPLICATION_LOCK") {
      const payload = (message as any)?.payload ?? {};
      const op = payload.op;
      const key = typeof payload.key === "string" ? payload.key : "";
      const owner = typeof payload.owner === "string" ? payload.owner : "";
      const ttlMs = typeof payload.ttlMs === "number" ? payload.ttlMs : 0;
      if (!key || !owner || !["acquire", "refresh", "release"].includes(op) || ttlMs <= 0) {
        sendResponse({ ok: false, error: "Invalid application lock request." });
        return;
      }
      const operation = applicationLockQueue.then(async () => {
        const raw = await chrome.storage.local.get("applicationLocks");
        const locks = (raw.applicationLocks ?? {}) as Record<string, { owner: string; expiresAt: number }>;
        const now = Date.now();
        for (const [lockKey, lock] of Object.entries(locks)) {
          if (!lock || lock.expiresAt <= now) delete locks[lockKey];
        }
        const current = locks[key];
        if (op === "acquire") {
          if (current && current.owner !== owner && current.expiresAt > now) {
            sendResponse({ ok: true, acquired: false });
            return;
          }
          locks[key] = { owner, expiresAt: now + ttlMs };
          await chrome.storage.local.set({ applicationLocks: locks });
          sendResponse({ ok: true, acquired: true });
          return;
        }
        if (current?.owner === owner) {
          if (op === "refresh") current.expiresAt = now + ttlMs;
          else delete locks[key];
          await chrome.storage.local.set({ applicationLocks: locks });
        }
        sendResponse({ ok: true, acquired: false });
      });
      applicationLockQueue = operation.then(() => undefined, () => undefined);
      void operation.catch((error: unknown) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Application lock storage failed." });
      });
      return true;
    }
    if ((message as any)?.type === "SJA_FORCE_SYNC") {
      void import("@/lib/sync/sync-client.js")
        .then(({ syncWithCloud }) => syncWithCloud())
        .then((r) => sendResponse({ ok: r.ok, ...(r.error ? { error: r.error } : {}) }))
        .catch((error: unknown) => sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Cloud sync could not start.",
        }));
      return true; // async response
    }
    // GAP-MV3-01 FIX: Autopilot state query/clear from content scripts
    if ((message as any)?.type === "SJA_AUTOPILOT_STATE_GET") {
      void import("@/lib/sync/autopilot-state.js")
        .then(({ readAutopilotCheckpoint }) => readAutopilotCheckpoint())
        .then((cp) => sendResponse({ checkpoint: cp }))
        .catch(() => sendResponse({ checkpoint: null }));
      return true;
    }
    if ((message as any)?.type === "SJA_AUTOPILOT_STATE_CLEAR") {
      void import("@/lib/sync/autopilot-state.js")
        .then(({ clearAutopilotCheckpoint }) => clearAutopilotCheckpoint())
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
    // GAP-ANTI-01 FIX: Hardware-level trusted input dispatch via Chrome DevTools Protocol (CDP)
    // Produces genuine `event.isTrusted === true` to bypass DataDome/Cloudflare/LinkedIn bot walls
    if ((message as any)?.type === "SJA_CDP_CLICK") {
      const { x, y } = (message as any)?.payload ?? {};
      const targetTabId = _sender.tab?.id ?? (message as any)?.payload?.tabId;
      if (!targetTabId || typeof x !== "number" || typeof y !== "number") {
        sendResponse({ ok: false, error: "Invalid tab or coordinates" });
        return;
      }
      (async () => {
        try {
          if (!chrome.debugger) {
            sendResponse({ ok: false, error: "chrome.debugger unavailable", fallback: true });
            return;
          }
          await chrome.debugger.attach({ tabId: targetTabId }, "1.3");
          await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchMouseEvent", {
            type: "mousePressed",
            x,
            y,
            button: "left",
            clickCount: 1,
          });
          await new Promise((r) => setTimeout(r, 40));
          await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x,
            y,
            button: "left",
            clickCount: 1,
          });
          await chrome.debugger.detach({ tabId: targetTabId }).catch(() => {});
          sendResponse({ ok: true, isTrusted: true });
        } catch (err) {
          await chrome.debugger?.detach({ tabId: targetTabId }).catch(() => {});
          sendResponse({ ok: false, error: String(err), fallback: true });
        }
      })();
      return true;
    }
    if ((message as any)?.type === "SJA_CDP_TYPE") {
      const { text } = (message as any)?.payload ?? {};
      const targetTabId = _sender.tab?.id ?? (message as any)?.payload?.tabId;
      if (!targetTabId || typeof text !== "string") {
        sendResponse({ ok: false, error: "Invalid tab or text" });
        return;
      }
      (async () => {
        try {
          if (!chrome.debugger) {
            sendResponse({ ok: false, error: "chrome.debugger unavailable", fallback: true });
            return;
          }
          await chrome.debugger.attach({ tabId: targetTabId }, "1.3");
          for (const char of text) {
            await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchKeyEvent", {
              type: "keyDown",
              text: char,
            });
            await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchKeyEvent", {
              type: "keyUp",
            });
            await new Promise((r) => setTimeout(r, 25));
          }
          await chrome.debugger.detach({ tabId: targetTabId }).catch(() => {});
          sendResponse({ ok: true, isTrusted: true });
        } catch (err) {
          await chrome.debugger?.detach({ tabId: targetTabId }).catch(() => {});
          sendResponse({ ok: false, error: String(err), fallback: true });
        }
      })();
      return true;
    }
  });
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete" && tabId) {
      // Clear the job badge on navigation; content script will re-set it if a
      // job form is detected on the new page.
      try {
        chrome.action.setBadgeText({ text: "", tabId }).catch(() => {});
        chrome.action.setTitle({ title: "Super Job Agent", tabId }).catch(() => {});
      } catch {}
      tabJobMap.delete(tabId);
      try {
        const p = chrome.tabs.sendMessage(tabId, { type: "SJA:NAV" });
        if (p && typeof (p as any).catch === "function") {
          (p as any).catch(() => {});
        }
      } catch {}
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabJobMap.delete(tabId);
  });

  // Keyboard command handling: Alt+Shift+F autofill, Alt+Shift+A opens the side panel.
  chrome.commands?.onCommand.addListener?.(async (command) => {
    if (command === "open-popup" || command === "open-sidepanel") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await openSidePanelForTab(tab);
      return;
    }
    if (command === "autofill-page") {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : null;
      if (!tab?.id) return;
      // Try to send directly first (content script already injected).
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOFILL" });
        return;
      } catch {
        // fall through to injection path (same as context menu)
      }
      const decision = tab.url ? decideInjectionForUrl(tab.url) : { allowed: false, reason: "no-url", requiresOptionalHostPermission: false };
      const origin = tab.url ? originPatternForUrl(tab.url) : null;
      if (!decision.allowed || !origin) {
        void diagLog("background", "shortcut-autofill-denied", { level: "warn", data: { tabId: tab.id, url: tab.url, reason: decision.reason } });
        return;
      }
      if (decision.requiresOptionalHostPermission && chrome.permissions?.contains) {
        const granted = await chrome.permissions.contains({ origins: [origin] }).catch(() => false);
        if (!granted) {
          try { await chrome.permissions.request({ origins: [origin] }); }
          catch {
            void diagLog("background", "shortcut-optional-permission-denied", { data: { origin } });
            return;
          }
        }
      }
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-scripts/content.js"] });
        // Give the detector one frame to run and inject agent.js before sending the autofill message.
        setTimeout(async () => {
          try { await chrome.tabs.sendMessage(tab.id!, { type: "SJA:AUTOFILL" }); } catch { /* retry once */
            setTimeout(() => { chrome.tabs.sendMessage(tab.id!, { type: "SJA:AUTOFILL" }).catch(() => {}); }, 400);
          }
        }, 150);
      } catch (err) {
        void diagLog("background", "shortcut-autofill-failed", { level: "warn", data: { tabId: tab.id, error: String(err) } });
      }
    }
  });

  const router = createSecureRuntimeRouter();

  router.register({
    type: "SJA:OPEN_SIDEPANEL",
    allowFrom: "any",
    handler: async (ctx) => {
      let tab = ctx.sender.tab;
      if (!tab?.windowId) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = active;
      }
      await openSidePanelForTab(tab);
      return { ok: true };
    },
  });

  router.register({
    type: "SJA:SYNC_NOW",
    allowFrom: "extension",
    handler: async () => {
      const { syncWithCloud } = await import("@/lib/sync/sync-client.js");
      return await syncWithCloud();
    },
  });

  router.register({
    type: "SJA:GET_SYNC_STATUS",
    allowFrom: "extension",
    handler: async () => {
      const { getSyncState } = await import("@/lib/sync/sync-client.js");
      return await getSyncState();
    },
  });

  router.register({
    type: "SJA:LOG",
    allowFrom: "any",
    guard: objectPayload,
    handler: async ({ payload }) => {
      const area = typeof payload.area === "string" ? payload.area : "background";
      await diagLog((area === "background" || area === "content" || area === "autofill" || area === "autopilot" || area === "profile" || area === "brain" || area === "audit" || area === "submit-guard" || area === "auth" || area === "external-autopilot" || area === "onboarding" || area === "orchestrator" || area === "recruiter-assistant" || area === "entitlement" || area === "telemetry" ? area : "background"), String(payload.event ?? "log"), {
        level: typeof payload.level === "string" ? (payload.level as any) : undefined,
        message: typeof payload.message === "string" ? payload.message : undefined,
        data: payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : undefined,
      });
      return { logged: true };
    },
  });

  router.register({
    type: "SJA:STREAM_AUDIT",
    allowFrom: "any",
    guard: objectPayload,
    handler: async ({ payload }) => {
      if (!await isLocalApiStreamingEnabled()) {
        return { streamed: false, reason: "local-api-streaming-disabled" };
      }
      try {
        await fetch("http://localhost:3000/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "audit", report: payload }),
        });
      } catch {
        // ignore server connection failures
      }
      return { streamed: true };
    },
  });

  router.register({
    type: "SJA:TRACK_EVENTS",
    allowFrom: "any",
    guard: objectPayload,
    handler: ({ payload }) => {
      const events = Array.isArray(payload.events) ? payload.events : Array.isArray(payload.payload) ? payload.payload : [];
      telemetryQueue.push(...(events as TelemetryEvent[]));
      return { queued: events.length };
    },
  });

  router.register({
    type: "SJA:SET_TAB_JOB",
    allowFrom: "content",
    requireJobContext: true,
    guard: hasStringProp("jobKey"),
    handler: ({ payload, tabId }) => {
      const body = payload as { jobKey: string };
      if (tabId != null) {
        tabJobMap.set(tabId, body.jobKey);
        // Show an indigo "✓" toolbar badge so the user sees SJA detected a job page.
        try {
          chrome.action.setBadgeBackgroundColor({ color: "#6366f1", tabId }).catch(() => {});
          chrome.action.setBadgeText({ text: "✓", tabId }).catch(() => {});
          chrome.action.setTitle({ title: "Super Job Agent — job page detected (Alt+Shift+F to autofill, Alt+Shift+A for side panel)", tabId }).catch(() => {});
        } catch {}
      }
      return { tabId, jobKey: body.jobKey };
    },
  });

  router.register({
    type: "SJA:GET_TAB_STATE",
    allowFrom: "any",
    handler: ({ tabId }) => ({ jobKey: tabId != null ? tabJobMap.get(tabId) ?? null : null }),
  });

  router.register({
    type: "SJA:GET_ALL_TAB_JOBS",
    allowFrom: "extension",
    handler: () => ({ tabs: Object.fromEntries(tabJobMap.entries()) }),
  });

  router.register({
    type: "SJA:OPEN_EXTERNAL_TAB",
    allowFrom: "content",
    requireJobContext: false, // External-tab opens happen from the LinkedIn tab which *is* a job context, but the URL being opened is external — don't reject it.
    guard: hasStringProp("url"),
    handler: async ({ payload }) => {
      const body = payload as { url: string; active?: boolean };
      const target = new URL(body.url);
      if (!/^https?:$/.test(target.protocol)) throw new Error("Only http(s) external apply URLs are allowed.");
      // Never open external-ATS URLs in the current tab — that destroys the
      // LinkedIn jobs list view, which was the "LinkedIn jobs section is broken"
      // complaint. Always a new tab.
      const tab = await chrome.tabs.create({ url: target.href, active: body.active !== false });
      void diagLog("background", "open-external-tab", { data: { url: target.href, tabId: tab.id, active: body.active !== false } });

      if (tab.id != null) {
        const tabId = tab.id;
        const makeActive = body.active !== false;

        // When the new tab finishes loading, install the orchestrator and
        // kick off autopilot. We used to race this with a second listener in
        // the LinkedIn content script, which produced a stuck state where the
        // AUTOPILOT message sometimes arrived before the orchestrator's
        // chrome.runtime.onMessage listener was attached. We now own the full
        // lifecycle here in the background, send AUTOPILOT with a delay +
        // retry, and point the side panel at the new tab so user-visible
        // verify prompts don't get lost.
        const onUpdated = async (updatedId: number, info: chrome.tabs.OnUpdatedInfo) => {
          if (updatedId !== tabId || info.status !== "complete") return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          clearTimeout(timeoutHandle);

          try {
            // Switch side panel to the new tab (only when user asked for the
            // tab to be active; if we opened in background, don't steal the
            // side panel away from the LinkedIn job the user is browsing).
            if (makeActive && chrome.sidePanel?.setOptions) {
              await chrome.sidePanel
                .setOptions({ tabId, path: "sidepanel.html", enabled: true })
                .catch(() => {});
            }

            // Inject the orchestrator (agent.js). The <all_urls> detector
            // (content.js) is already auto-injected on document_idle and will
            // fire its own INJECT_ORCHESTRATOR request, but that races us; the
            // __SJA_ORCHESTRATOR_CREATED__ idempotency guard inside the
            // orchestrator makes double-injection a no-op.
            try {
              await chrome.scripting.executeScript({ target: { tabId }, files: ["content-scripts/agent.js"] });
            } catch (injectErr) {
              void diagLog("background", "external-agent-inject-failed", {
                level: "warn",
                data: { tabId, error: String(injectErr) },
              });
            }

            // Send SJA:AUTOPILOT with an initial delay (createOrchestrator is
            // async and the onMessage listener is attached during it) plus a
            // few retries so the message lands even if the orchestrator is
            // still booting.
            const sendAutopilot = (attempt: number) => {
              chrome.tabs
                .sendMessage(tabId, { type: "SJA:AUTOPILOT" })
                .then(() => {
                  void diagLog("background", "external-autopilot-started", { data: { tabId, attempt } });
                })
                .catch(() => {
                  if (attempt < 4) {
                    setTimeout(() => sendAutopilot(attempt + 1), 250 * (attempt + 1));
                  } else {
                    void diagLog("background", "external-autopilot-message-failed", {
                      level: "warn",
                      data: { tabId, url: target.href },
                    });
                  }
                });
            };
            setTimeout(() => sendAutopilot(1), 600);
          } catch (err) {
            void diagLog("background", "external-tab-postload-error", {
              level: "error",
              data: { tabId, error: String(err) },
            });
          }
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        const timeoutHandle = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          // Even if the load event never fires "complete" (some SPAs stay in
          // loading state forever), still try to inject after 15s so the user
          // isn't stuck on a dead tab.
          chrome.scripting
            .executeScript({ target: { tabId }, files: ["content-scripts/agent.js"] })
            .then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: "SJA:AUTOPILOT" }).catch(() => {});
              }, 600);
            })
            .catch(() => {});
        }, 15_000);
      }

      return { tabId: tab.id };
    },
  });

  router.register({
    type: "SJA:INJECT_ORCHESTRATOR",
    allowFrom: "content",
    guard: objectPayload,
    handler: async ({ payload, sender, tabId }) => {
      const frameUrl = sender.url ?? (typeof payload.url === "string" ? payload.url : undefined);
      const tabUrl = sender.tab?.url ?? frameUrl;
      const frameDecision = decideInjectionForUrl(frameUrl);
      const forceReason = typeof (payload as any).reason === "string" ? (payload as any).reason : "";
      const isDemoPage = forceReason === "demo-page" && /demo-job\.html/i.test(frameUrl ?? "");
      const canInjectByContext = canInjectOrchestrator(frameUrl, tabUrl, forceReason);
      if (tabId == null || (!canInjectByContext && !isDemoPage)) {
        void diagLog("background", "orchestrator-injection-denied", {
          level: "warn",
          data: { tabId, url: frameUrl, reason: frameDecision.reason },
        });
        throw new Error(`Injection denied: ${frameDecision.reason}`);
      }
      if (frameDecision.requiresOptionalHostPermission && frameUrl && chrome.permissions?.contains) {
        const origin = originPatternForUrl(frameUrl);
        if (origin) {
          try {
            const hasPermission = await chrome.permissions.contains({ origins: [origin] });
            if (!hasPermission) {
              void diagLog("background", "optional-permission-missing", {
                level: "warn",
                message: `Optional permission not declared for ${origin}. Proceeding with executeScript fallback.`
              });
            }
          } catch {}
        }
      }
      try {
        // chrome-extension:// pages cannot be targeted by chrome.scripting.executeScript
        // (MV3 restriction). The demo page self-bootstraps via <script src=agent.js>.
        const isExtensionPage = /^(chrome|moz|browser|safari)-extension:|^extension:/.test(frameUrl ?? "");
        if (!isExtensionPage) {
          await chrome.scripting.executeScript({
            target: { tabId, frameIds: [sender.frameId ?? 0] },
            files: ["content-scripts/agent.js"],
          });
        }
        void diagLog("background", "orchestrator-injected", {
          data: { tabId, frameId: sender.frameId ?? 0, reason: frameDecision.reason, isExtensionPage },
        });
      } catch (err: any) {
        void diagLog("background", "orchestrator-injection-failed", {
          level: "error",
          message: `Script injection failed: ${err.message}`,
          data: { tabId, error: String(err), stack: err.stack }
        });
        throw err;
      }
      return { injected: true, tabId, frameId: sender.frameId ?? 0, reason: frameDecision.reason };
    },
  });

  // Setup offscreen document for long-running tasks (Operation Zero-Defect)
  let creatingOffscreen: Promise<void> | null = null;
  async function ensureOffscreenDocument() {
    if (await hasOffscreenDocument()) return;
    if (creatingOffscreen) {
      await creatingOffscreen;
      return;
    }
    creatingOffscreen = chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.WORKERS] as any,
      justification: "Parse heavy PDFs and run complex ATS background logic without hitting V3 limits",
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
  async function hasOffscreenDocument() {
    if (!chrome.offscreen) return false;
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });
    return contexts.length > 0;
  }

  router.register({
    type: "SJA:EXECUTE_OFFSCREEN",
    allowFrom: "any",
    handler: async ({ payload }) => {
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage({
        type: (payload as any).taskType,
        payload: (payload as any).data
      });
      return response;
    }
  });

  
  // Feature 8: AI Answer Memory & Review Center
  router.register({
    type: "SJA:SAVE_ANSWER",
    allowFrom: "any",
    handler: async ({ payload }) => {
      const { saveAnswer } = await import("@/lib/answer-memory.js");
      return await saveAnswer(payload as any);
    }
  });

  router.register({
    type: "SJA:GET_ANSWERS",
    allowFrom: "any",
    handler: async () => {
      const { getAnswers } = await import("@/lib/answer-memory.js");
      return { answers: await getAnswers() };
    }
  });

  // Feature 9: Resume & Cover-Letter Co-pilot
  router.register({
    type: "SJA:GENERATE_COVER_LETTER",
    allowFrom: "any",
    handler: async ({ payload }) => {
      const { generateCoverLetter } = await import("@/lib/agents/copilot-agent.js");
      return await generateCoverLetter(payload as any);
    }
  });

  
  // Feature 10: Recruiter Assistant
  router.register({
    type: "SJA:GENERATE_OUTREACH",
    allowFrom: "any",
    handler: async ({ payload }) => {
      // Feature 11: Check Entitlement before AI generation
      const { consumeAIToken } = await import("@/lib/auth/entitlement.js");
      const check = await consumeAIToken();
      if (!check.allowed) return { error: check.reason };
      
      const { generateTargetedOutreach } = await import("@/lib/agents/recruiter-assistant.js");
      
      // Feature 13: Enterprise Compliance Log
      const { logEnterpriseAction } = await import("@/lib/enterprise/compliance.js");
      await logEnterpriseAction("AI_OUTREACH_GENERATION", "recruiter-message", payload);

      return await generateTargetedOutreach(payload as any);
    }
  });

  // Feature 11: Entitlement Status
  router.register({
    type: "SJA:GET_ENTITLEMENTS",
    allowFrom: "any",
    handler: async () => {
      const { getEntitlements } = await import("@/lib/auth/entitlement.js");
      return await getEntitlements();
    }
  });

  
  // Feature 12: Team Workspace
  router.register({
    type: "SJA:GET_TEAM_CONTEXT",
    allowFrom: "any",
    handler: async () => {
      const { getTeamContext } = await import("@/lib/team-workspace.js");
      return await getTeamContext();
    }
  });

  router.register({
    type: "SJA:ADD_SHARED_NOTE",
    allowFrom: "any",
    handler: async ({ payload }) => {
      const { addSharedNote } = await import("@/lib/team-workspace.js");
      return await addSharedNote((payload as any).jobKey, (payload as any).note);
    }
  });

  /**
   * Autonomous advanced job search — runs from the service worker so
   * scrapers can hit public JSON APIs without popup CORS. All scoring is
   * local; no profile data leaves the browser.
   */
  router.register({
    type: "SJA:SEARCH_JOBS",
    allowFrom: "extension",
    handler: async ({ payload }) => {
      const { runAdvancedSearch } = await import("@/lib/job-search-service.js");
      const { getStore, createProfile } = await import("@superjob/core");
      let profile = null;
      try {
        const raw = await getStore().get("profile");
        if (raw) profile = createProfile(raw as any);
      } catch {}
      const query = (payload ?? {}) as any;
      return await runAdvancedSearch(profile, query);
    },
  });

  router.register({
    type: "SJA:LIST_BOARDS",
    allowFrom: "extension",
    handler: async ({ payload }) => {
      const { listJobBoards } = await import("@/lib/job-search-service.js");
      const region = (payload as any)?.region;
      return listJobBoards(region).map((b) => ({
        id: b.id, name: b.name, region: b.region, scraper: !!b.scraper,
      }));
    },
  });

  /**
   * Parallel apply/enhance fleet — the "apply to 10 jobs at once" engine.
   * Runs in the service worker so LLM fetches are CORS-free and the run
   * survives the side panel closing. Streams live state to storage.
   */
  router.register({
    type: "SJA:FLEET_START",
    allowFrom: "extension",
    guard: objectPayload,
    handler: async ({ payload }) => {
      const { createEnterpriseJobCrew } = await import("@/lib/fleet-runner.js");
      const { getStore, createProfile } = await import("@superjob/core");
      const { getLLMConfig } = await import("@/lib/store.js");

      let profile = null;
      try {
        const raw = await getStore().get("profile");
        if (raw) profile = createProfile(raw as any);
      } catch {}
      if (!profile) throw new Error("Add your profile (Profile tab) before running a fleet.");

      const body = payload as {
        jobs?: unknown;
        concurrency?: number;
        minScore?: number;
        dryRun?: boolean;
        maxKeywordsPerResume?: number;
      };
      const jobs = Array.isArray(body.jobs) ? (body.jobs as any[]) : [];
      if (!jobs.length) throw new Error("No jobs supplied to the fleet.");

      const llmConfig = await getLLMConfig();
      return await createEnterpriseJobCrew(profile, llmConfig, jobs as any, {
        concurrency: body.concurrency,
        minScore: body.minScore,
        dryRun: body.dryRun,
        maxKeywordsPerResume: body.maxKeywordsPerResume,
      });
    },
  });

  router.register({
    type: "SJA:FLEET_ABORT",
    allowFrom: "extension",
    handler: async () => {
      const { abortFleetRun } = await import("@/lib/fleet-runner.js");
      return abortFleetRun();
    },
  });

  router.register({
    type: "SJA:FLEET_STATE",
    allowFrom: "extension",
    handler: async () => {
      const { readFleetState } = await import("@/lib/fleet-runner.js");
      return (await readFleetState()) ?? null;
    },
  });

  /**
   * SJA:REVIEW_DECISION — HITL approval from ReviewQueuePanel.
   * On "approved": load the evidence pack, open the job URL in a new tab
   * with autonomous+autoSubmit settings so the in-browser autopilot drives
   * the final submit. On "rejected": mark the queue item and move on.
   */
  router.register({
    type: "SJA:REVIEW_DECISION",
    allowFrom: "extension",
    handler: async ({ payload }) => {
      const p = (typeof payload === "object" && payload !== null) ? (payload as Record<string, unknown>) : {};
      const jobId = typeof p.jobId === "string" ? p.jobId : null;
      const decision = typeof p.decision === "string" ? p.decision : null;

      if (!jobId || !decision) return { ok: false, error: "Missing jobId or decision" };

      if (decision === "rejected") {
        void diagLog("background", "review-rejected", { message: `Review item rejected: ${jobId}` });
        return { ok: true };
      }

      if (decision === "submit_otp") {
        const otpCode = typeof p.otpCode === "string" ? p.otpCode.trim() : "";
        if (!otpCode) return { ok: false, error: "Missing OTP code" };

        try {
          const { getStore } = await import("@superjob/core");
          const store = getStore();
          const queue: any[] = (await store.get("sja_review_queue")) ?? [];
          const pack = queue.find((item: any) => item.jobId === jobId);
          let targetTabId = pack?.tabId;

          if (!targetTabId && pack?.jobUrl) {
            try {
              const host = new URL(pack.jobUrl).hostname;
              const tabs = await chrome.tabs.query({});
              const matched = tabs.find((t) => t.url && t.url.includes(host));
              if (matched?.id) targetTabId = matched.id;
            } catch {
              /* ignore malformed url */
            }
          }

          if (typeof targetTabId !== "number") {
            return { ok: false, error: "No application tab is available for OTP delivery." };
          }
          await chrome.tabs.sendMessage(targetTabId, { type: "SJA:INJECT_OTP", code: otpCode });
          await chrome.tabs.update(targetTabId, { active: true });

          void diagLog("background", "otp-injected", { message: `OTP forwarded for jobId: ${jobId}` });
          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, error: msg };
        }
      }

      if (decision === "resume") {
        try {
          const { getStore } = await import("@superjob/core");
          const store = getStore();
          const queue: any[] = (await store.get("sja_review_queue")) ?? [];
          const pack = queue.find((item: any) => item.jobId === jobId);
          let targetTabId = pack?.tabId;

          if (!targetTabId && pack?.jobUrl) {
            try {
              const host = new URL(pack.jobUrl).hostname;
              const tabs = await chrome.tabs.query({});
              const matched = tabs.find((t) => t.url && t.url.includes(host));
              if (matched?.id) targetTabId = matched.id;
            } catch {
              /* ignore malformed url */
            }
          }

          if (typeof targetTabId !== "number") {
            return { ok: false, error: "No application tab is available to resume." };
          }
          await chrome.tabs.sendMessage(targetTabId, { type: "SJA:RESUME_AUTOPILOT" });
          await chrome.tabs.update(targetTabId, { active: true });

          void diagLog("background", "review-resumed", { message: `Autopilot resume signaled for jobId: ${jobId}` });
          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, error: msg };
        }
      }

      if (decision === "approved") {
        // Load the evidence pack to get the job URL
        try {
          const { getStore } = await import("@superjob/core");
          const store = getStore();
          const queue: any[] = (await store.get("sja_review_queue")) ?? [];
          const pack = queue.find((item: any) => item.jobId === jobId);

          if (!pack) {
            return { ok: false, error: `No review item found for jobId: ${jobId}` };
          }

          // Open the job URL or focus the existing application tab.
          const jobUrl = pack.jobUrl || pack.job?.url;
          const validJobUrl = typeof jobUrl === "string" && /^https?:\/\//i.test(jobUrl);
          if (typeof pack.tabId === "number") {
            try {
              await chrome.tabs.update(pack.tabId, { active: true });
            } catch {
              if (validJobUrl) {
                await chrome.tabs.create({ url: jobUrl, active: true });
              } else {
                throw new Error("The application tab is unavailable and the review item has no valid job URL.");
              }
            }
          } else if (validJobUrl) {
            await chrome.tabs.create({ url: jobUrl, active: true });
            void diagLog("background", "review-approved-tab-opened", {
              message: `Review approved for ${pack.jobTitle} — tab opened for auto-submit`,
            });
          } else {
            return { ok: false, error: "The review item has no application tab or valid job URL." };
          }

          // Enable autonomous + autoSubmit only after a target tab can be focused or opened.
          const { mergeAgentSettings } = await import("@superjob/core");
          const cur = mergeAgentSettings(await store.get("settings"));
          await store.set("settings", {
            ...cur,
            autonomousMode: true,
            autoClickEasyApply: true,
            autoFillSteps: true,
            autoAdvanceSteps: true,
            autoSubmit: true,
          });

          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          void diagLog("background", "review-approved-error", { level: "error", message: msg });
          return { ok: false, error: msg };
        }
      }

      return { ok: false, error: `Unknown decision: ${decision}` };
    },
  });

  /**
   * SJA:PUSH_REVIEW_ITEM — content script or background agent pushes a HITL
   * intervention item (OTP, CAPTCHA, low-confidence application) into the review queue.
   */
  router.register({
    type: "SJA:PUSH_REVIEW_ITEM",
    allowFrom: "any",
    handler: async ({ payload, sender }) => {
      const pack = (typeof payload === "object" && payload !== null) ? (payload as any) : null;
      if (!pack?.jobId) return { ok: false, error: "Missing pack or jobId" };

      try {
        if (!pack.tabId && sender?.tab?.id) {
          pack.tabId = sender.tab.id;
        }

        const { getStore } = await import("@superjob/core");
        const store = getStore();
        const queue: any[] = (await store.get("sja_review_queue")) ?? [];
        const filtered = queue.filter((p) => p.jobId !== pack.jobId && p.idempotencyKey !== pack.idempotencyKey);
        filtered.unshift(pack);
        await store.set("sja_review_queue", filtered);

        // Notify user via extension badge
        try {
          if (chrome.action?.setBadgeText) {
            await chrome.action.setBadgeText({ text: "!" });
            await chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
          }
        } catch {}

        // Desktop notification if available
        try {
          if (chrome.notifications?.create) {
            const subtitle =
              pack.reviewType === "otp" ? "OTP / Verification Code Required" :
              pack.reviewType === "captcha" ? "CAPTCHA Challenge Detected" :
              "Application Review Required";
            chrome.notifications.create(`sja-review-${pack.jobId}`, {
              type: "basic",
              iconUrl: chrome.runtime.getURL("icons/icon128.png"),
              title: `SuperJobAgent: ${subtitle}`,
              message: `${pack.company || "Job Portal"} — Click to open Review Queue in Sidepanel`,
              priority: 2,
            });
          }
        } catch {}

        void diagLog("background", "review-item-enqueued", {
          message: `Enqueued review item [${pack.reviewType ?? "application"}] for ${pack.company}`,
          data: { jobId: pack.jobId, type: pack.reviewType },
        });

        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  });

  /**
   * SJA:INJECT_OTP — injects OTP directly to a tab by ID.
   */
  router.register({
    type: "SJA:INJECT_OTP",
    allowFrom: "extension",
    handler: async ({ payload }) => {
      const p = (typeof payload === "object" && payload !== null) ? (payload as Record<string, unknown>) : {};
      const tabId = typeof p.tabId === "number" ? p.tabId : null;
      const code = typeof p.code === "string" ? p.code.trim() : null;

      if (!code) return { ok: false, error: "Missing OTP code" };

      if (tabId) {
        await chrome.tabs.sendMessage(tabId, { type: "SJA:INJECT_OTP", code }).catch(() => null);
        return { ok: true };
      }

      // If no tabId, broadcast to all tabs
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        if (t.id) {
          chrome.tabs.sendMessage(t.id, { type: "SJA:INJECT_OTP", code }).catch(() => null);
        }
      }
      return { ok: true };
    },
  });

  /**
   * SJA:TOOL_ARCHIVE_UPDATE — content script sends serialized Recon Tool Archive
   * and/or Reflexion Memory blobs whenever a strategy is learned or a reflexion
   * is recorded. Background persists to chrome.storage.local so they survive SW eviction.
   */
  router.register({
    type: "SJA:TOOL_ARCHIVE_UPDATE",
    allowFrom: "content",
    handler: async ({ payload }) => {
      const p = (typeof payload === "object" && payload !== null) ? (payload as Record<string, unknown>) : {};
      const archiveJson = typeof p.archiveJson === "string" ? p.archiveJson : null;
      const reflexionJson = typeof p.reflexionJson === "string" ? p.reflexionJson : null;
      try {
        const toSave: Record<string, string> = {};
        if (archiveJson) toSave["sja:recon:toolArchive"] = archiveJson;
        if (reflexionJson) toSave["sja:healer:reflexionMemory"] = reflexionJson;
        if (Object.keys(toSave).length > 0) {
          await chrome.storage.local.set(toSave);
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  });

  router.install();

  async function flushTelemetry(): Promise<void> {
    if (telemetryQueue.length === 0) return;
    const batch = telemetryQueue.splice(0);
    
    // Privacy-preserving layer (Feature #4): Ensure no PII leaks into analytics
    const { stripPII } = await import("@/lib/telemetry/anonymizer.js").catch(() => ({ stripPII: (x: any) => x }));
    const safeBatch = batch.map(event => stripPII(event));

    void diagLog("background", "telemetry-flush", { data: { count: safeBatch.length } });
    
    // Instead of raw raw batch, we write the safeBatch
    try {
      const stored = await chrome.storage.local.get("sja-telemetry-log") as Record<string, unknown>;
      const log: TelemetryEvent[] = Array.isArray(stored["sja-telemetry-log"])
        ? stored["sja-telemetry-log"] as TelemetryEvent[]
        : [];
      const updated = [...log, ...safeBatch].slice(-500); // keep last 500
      await chrome.storage.local.set({ "sja-telemetry-log": updated });
    } catch {}
  }
});