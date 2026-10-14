import assert from "node:assert/strict";
import test from "node:test";
import {
  sendToBackground,
  sendToBackgroundData,
} from "../packages/extension/src/lib/message-router.ts";

function installRuntime(sendMessage: (message: unknown) => Promise<unknown>) {
  (globalThis as any).chrome = {
    runtime: { sendMessage },
    tabs: { sendMessage },
  };
}

test("message transport prefixes an unprefixed action exactly once", async () => {
  let captured: any;
  installRuntime(async (message) => {
    captured = message;
    return { ok: true, data: { accepted: true } };
  });

  await sendToBackground("GET_TEAM_CONTEXT");
  assert.equal(captured.type, "SJA:GET_TEAM_CONTEXT");
});

test("message transport preserves an already-prefixed action", async () => {
  let captured: any;
  installRuntime(async (message) => {
    captured = message;
    return { ok: true, data: { accepted: true } };
  });

  await sendToBackground("SJA:GENERATE_OUTREACH", { platform: "email" });
  assert.equal(captured.type, "SJA:GENERATE_OUTREACH");
  assert.deepEqual(captured.payload, { platform: "email" });
});

test("secure background helper unwraps data and rejects error envelopes", async () => {
  installRuntime(async () => ({ ok: true, data: { message: "Hello", success: true } }));
  const data = await sendToBackgroundData<{ message: string; success: boolean }>("SJA:GENERATE_OUTREACH");
  assert.deepEqual(data, { message: "Hello", success: true });

  installRuntime(async () => ({ ok: false, error: "Entitlement required" }));
  await assert.rejects(
    () => sendToBackgroundData("SJA:GENERATE_OUTREACH"),
    /Entitlement required/
  );
});
