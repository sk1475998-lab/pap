import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutonomousDecisionBrain } from "./decision-engine.js";
import { ReflexionEngine } from "./reflexion-engine.js";
import { serializeAXTreeForPrompt } from "./perception.js";
import type { AXTreeSnapshot } from "./types.js";
import { createProfile } from "../profile.js";

describe("Autonomous Decision Brain & Reflexion Engine", () => {
  const sampleSnapshot: AXTreeSnapshot = {
    url: "https://boards.greenhouse.io/acme/jobs/123",
    title: "Apply for Senior Backend Engineer",
    nodes: [
      {
        id: 1,
        role: "textbox",
        name: "First Name",
        selector: "#first_name",
        tag: "input",
        type: "text",
        required: true,
      },
      {
        id: 2,
        role: "textbox",
        name: "Last Name",
        selector: "#last_name",
        tag: "input",
        type: "text",
        required: true,
      },
      {
        id: 3,
        role: "textbox",
        name: "Email",
        selector: "#email",
        tag: "input",
        type: "email",
        required: true,
      },
      {
        id: 4,
        role: "textbox",
        name: "Phone",
        selector: "#phone",
        tag: "input",
        type: "tel",
        required: true,
      },
      {
        id: 5,
        role: "button",
        name: "Submit application",
        selector: "#submit_app",
        tag: "button",
        type: "submit",
      },
    ],
    errorBanners: [],
    fieldErrors: [],
    isTerminal: false,
    timestamp: Date.now(),
  };

  const sampleProfile = createProfile({
    firstName: "Shashi",
    lastName: "Indukuri",
    email: "shashi@example.com",
    phone: "9876543210",
    phoneCountryCode: "+91",
  });

  it("serializes AXTree snapshot compactly for token efficiency (<1,500 tokens)", () => {
    const promptText = serializeAXTreeForPrompt(sampleSnapshot);
    assert.ok(promptText.includes("[1] <input type=\"text\"> \"First Name\" (REQUIRED)"));
    assert.ok(promptText.includes("[5] <button type=\"submit\"> \"Submit application\""));
    assert.ok(promptText.length < 1000);
  });

  it("plans atomic fill actions and terminal submission using AutonomousDecisionBrain", () => {
    const brain = new AutonomousDecisionBrain();
    const plan = brain.planStep({
      jobId: "job_greenhouse_123",
      snapshot: sampleSnapshot,
      profile: sampleProfile,
      dryRun: false,
    });

    assert.equal(plan.stepName, "final_submission");
    assert.ok(plan.actionsToPerform.length >= 4);

    const firstNameAction = plan.actionsToPerform.find((a) => a.label === "First Name");
    assert.equal(firstNameAction?.value, "Shashi");
    assert.equal(firstNameAction?.actionType, "FILL_INPUT");
    assert.ok(firstNameAction?.confidence! >= 0.95);

    const submitAction = plan.actionsToPerform.find((a) => a.actionType === "SUBMIT");
    assert.ok(submitAction);
    assert.equal(submitAction?.label, "Submit application");
  });

  it("ReflexionEngine records validation errors and verbalizes self-reflections", async () => {
    const reflexion = new ReflexionEngine();
    const episode = await reflexion.recordFailureAndReflect({
      jobId: "job_greenhouse_123",
      stepName: "form_step",
      failedAction: {
        actionType: "FILL_INPUT",
        selector: "#phone",
        label: "Phone",
        value: "+91 9876543210",
        confidence: 0.95,
        reasoning: "Profile phone lookup",
      },
      observedError: "Please enter a valid 10-digit phone number without country code.",
    });

    assert.equal(episode.attemptNumber, 1);
    assert.ok(episode.reflection.length > 10);
    assert.ok(episode.correctivePlan.length > 10);

    // Test automatic memory repair on retry
    const repaired = reflexion.repairValueFromMemory("job_greenhouse_123", "Phone", "+91 9876543210");
    assert.equal(repaired, "9876543210");
  });

  it("handles multi-step Next navigation when not at terminal submit", () => {
    const multiStepSnapshot: AXTreeSnapshot = {
      ...sampleSnapshot,
      nodes: [
        sampleSnapshot.nodes[0]!,
        {
          id: 10,
          role: "button",
          name: "Next",
          selector: "button.next",
          tag: "button",
        },
      ],
    };

    const brain = new AutonomousDecisionBrain();
    const plan = brain.planStep({
      jobId: "job_step1",
      snapshot: multiStepSnapshot,
      profile: sampleProfile,
    });

    assert.equal(plan.stepName, "form_step");
    const nextAction = plan.actionsToPerform.find((a) => a.actionType === "ADVANCE_NEXT");
    assert.ok(nextAction);
    assert.equal(nextAction?.label, "Next");
  });
});
