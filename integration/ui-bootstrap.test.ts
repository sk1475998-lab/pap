/**
 * Focused regression test for `sendToActiveTabWithBootstrap` (lib/ui.ts).
 *
 * The user-facing "Autofill / Check match" commands in the popup and browser
 * side panel used to be dead on their first click whenever the content agent
 * (orchestrator) had not yet been injected into the active tab: the <all_urls>
 * gatekeeper consumed the message to trigger injection but never answered it,
 * so the UI surfaced a raw "message port closed" error and nothing filled.
 *
 * This test drives the helper against a mocked chrome API to prove:
 *   1. Fast path — agent already present answers immediately, no bootstrap.
 *   2. Injection path — when nothing answers, an SJA:INJECT_ORCHESTRATOR poke
 *      is sent to the tab (from the page context, where the background accepts
 *      it) and the original action is retried until the agent boots.
 *   3. executeScript fallback when even the poke can't be delivered.
 *   4. Bounded give-up with the humanized notInstalled message.
 */
import assert from "node:assert/strict";
import test from "node:test";

const FIXTURE_URL = "https://boards.greenhouse.io/acme/jobs/123";

interface SendMessageCall {
  type: string;
  payload?: unknown;
}

function installChrome(
  behaviors: {
    sendMessage?: (call: SendMessageCall, seq: number) => unknown;
    executeScriptCount?: () => void;
  } = {},
) {
  const calls: SendMessageCall[] = [];
  let executedScripts = 0;
  (globalThis as any).chrome = {
    runtime: { id: "ui-bootstrap-test" },
    tabs: {
      async query() {
        return [{ id: 7, url: FIXTURE_URL }];
      },
      async sendMessage(_tabId: number, message: SendMessageCall) {
        calls.push(message);
        if (behaviors.sendMessage) return behaviors.sendMessage(message, calls.length);
        return undefined;
      },
    },
    scripting: {
      async executeScript() {
        executedScripts++;
        behaviors.executeScriptCount?.();
      },
    },
  };
  return {
    calls,
    executedScripts: () => executedScripts,
    sendMessageCallsOf: (type: string) => calls.filter((c) => c.type === type).length,
  };
}

test("fast path: an already-present agent answers and no bootstrap occurs", async () => {
  const mock = installChrome({
    sendMessage: (call) => (call.type === "SJA:AUTOFILL" ? { filled: 4, skipped: 0 } : undefined),
  });
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  const res = await sendToActiveTabWithBootstrap<{ filled: number }>({ type: "SJA:AUTOFILL" });
  assert.equal(res.filled, 4);
  assert.equal(mock.sendMessageCallsOf("SJA:AUTOFILL"), 1);
  assert.equal(mock.sendMessageCallsOf("SJA:INJECT_ORCHESTRATOR"), 0, "no poke on fast path");
  assert.equal(mock.executedScripts(), 0, "no executeScript on fast path");
});

test("bootstrap: first click self-heals by poking injection then retrying the action", async () => {
  let autofillAttempts = 0;
  const mock = installChrome({
    sendMessage: (call) => {
      if (call.type === "SJA:AUTOFILL") {
        autofillAttempts++;
        // First attempt is consumed by the gatekeeper (port closes, no agent).
        // After the INJECT poke, the freshly booted agent answers.
        return autofillAttempts === 1 ? undefined : { filled: 4, skipped: 0 };
      }
      if (call.type === "SJA:INJECT_ORCHESTRATOR") return undefined; // poke delivered
      return undefined;
    },
  });
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  const res = await sendToActiveTabWithBootstrap<{ filled: number }>({ type: "SJA:AUTOFILL" });
  assert.equal(res.filled, 4);
  assert.ok(autofillAttempts >= 2, `expected retries, got ${autofillAttempts}`);
  assert.equal(mock.sendMessageCallsOf("SJA:INJECT_ORCHESTRATOR"), 1, "injection poke was sent");
  assert.equal(mock.executedScripts(), 0, "poke succeeded so no executeScript needed");
});

test("bootstrap: when the poke cannot be delivered, executeScript gatekeeper is the fallback", async () => {
  let autofillAttempts = 0;
  const mock = installChrome({
    sendMessage: (call) => {
      if (call.type === "SJA:AUTOFILL") {
        autofillAttempts++;
        return autofillAttempts >= 3 ? { filled: 2, skipped: 1 } : undefined;
      }
      if (call.type === "SJA:INJECT_ORCHESTRATOR") {
        // The gatekeeper consumed the poke without responding.
        throw new Error("The message port closed before a response was received.");
      }
      return undefined;
    },
  });
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  const res = await sendToActiveTabWithBootstrap<{ filled: number }>({ type: "SJA:AUTOFILL" });
  assert.equal(res.filled, 2);
  assert.ok(mock.executedScripts() >= 1, "executeScript(content.js) fallback was used");
  assert.ok(autofillAttempts >= 3, `expected retries after fallback, got ${autofillAttempts}`);
});

test("bootstrap: bounded give-up surfaces the humanized not-installed message", async () => {
  installChrome({
    sendMessage: () => {
      throw new Error("Receiving end does not exist.");
    },
  });
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  await assert.rejects(
    sendToActiveTabWithBootstrap({ type: "SJA:GET_MATCH" }, {
      notInstalledMsg: "Super Job Agent isn't ready on this page.",
    }),
    /Super Job Agent isn't ready on this page\./,
  );
});

test("bootstrap: non-retryable errors surface unchanged instead of looping", async () => {
  installChrome({
    sendMessage: () => {
      throw new Error("Autofill is already running — skipping.");
    },
  });
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  await assert.rejects(
    sendToActiveTabWithBootstrap({ type: "SJA:AUTOFILL" }),
    /Autofill is already running — skipping\./,
  );
});

test("bootstrap: non-http(s) active tab is rejected up front", async () => {
  (globalThis as any).chrome = {
    runtime: { id: "ui-bootstrap-test" },
    tabs: {
      async query() {
        return [{ id: 9, url: "chrome://extensions" }];
      },
    },
    scripting: { async executeScript() {} },
  };
  const { sendToActiveTabWithBootstrap } = await import("../packages/extension/src/lib/ui.ts");
  await assert.rejects(
    sendToActiveTabWithBootstrap({ type: "SJA:AUTOFILL" }),
    /only works on http\(s\) pages/,
  );
});
