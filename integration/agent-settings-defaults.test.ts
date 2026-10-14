import assert from "node:assert/strict";
import test from "node:test";
import { mergeAgentSettings } from "../packages/core/src/settings.ts";

test("new agent settings are review-first and automation remains explicit opt-in", () => {
  const defaults = mergeAgentSettings();

  assert.equal(defaults.autonomousMode, false);
  assert.equal(defaults.autoClickEasyApply, false);
  assert.equal(defaults.autoFillSteps, false);
  assert.equal(defaults.autoAdvanceSteps, false);
  assert.equal(defaults.autoSubmit, false);
  assert.equal(defaults.localApiStreamingEnabled, false);
  assert.equal(defaults.llmTailoringOnly, true);
  assert.equal(defaults.verifyBeforeAdvance, true);

  const optedIn = mergeAgentSettings({ autonomousMode: true, autoSubmit: true });
  assert.equal(optedIn.autonomousMode, true);
  assert.equal(optedIn.autoSubmit, true);
  assert.equal(optedIn.verifyBeforeAdvance, true);
});
