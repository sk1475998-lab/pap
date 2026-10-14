import assert from "node:assert/strict";
import test from "node:test";
import { loadOnboardingState } from "../packages/extension/src/lib/onboarding/onboarding-store.js";

test("legacy extension onboarding data is removed from storage", async () => {
  const legacyState = {
    step: "COMPLETED",
    name: "Legacy User",
    email: "legacy@example.test",
    phone: "5550100",
    resumeText: "Legacy resume text that must no longer live in the extension.",
    completedAt: 123,
  };
  let savedState: Record<string, unknown> | undefined;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () => ({ "sja-onboarding-state": legacyState }),
          set: async (value: Record<string, unknown>) => {
            savedState = value["sja-onboarding-state"] as Record<string, unknown>;
          },
        },
      },
    },
  });

  const state = await loadOnboardingState();
  assert.deepEqual(state, { step: "COMPLETED", completedAt: 123 });
  assert.deepEqual(savedState, state);
});
