import assert from "node:assert/strict";
import test from "node:test";

function installBackgroundChromeMock() {
  const local: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    runtime: { id: "sja-diagnostics-test" },
    storage: {
      local: {
        async get(key: string) { return { [key]: local[key] }; },
        async set(values: Record<string, unknown>) { Object.assign(local, values); },
        async remove(key: string) { delete local[key]; },
      },
    },
  };
  return local;
}

test("diagnostics accepts and persists telemetry and orchestrator areas", async () => {
  const local = installBackgroundChromeMock();
  const { clearDiagnostics, diagLog, getDiagnostics } = await import("../packages/extension/src/lib/diagnostics.ts");
  await clearDiagnostics();

  await diagLog("telemetry", "flush-test", { message: "Telemetry test" });
  await diagLog("orchestrator", "startup-test", { message: "Orchestrator test" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const entries = await getDiagnostics(2);
  assert.deepEqual(entries.map((entry) => entry.area), ["orchestrator", "telemetry"]);
  assert.equal((local.diagnostics as Array<{ area: string }>).length, 2);
});
