import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeQuestionSimilarity } from "../packages/extension/src/lib/answer-memory.js";
import { generateFormatMutations } from "../packages/extension/src/lib/form-error-recovery.js";
import { RadixHeadlessStrategy } from "../packages/extension/src/lib/dropdown-strategies.js";

describe("Research-Based Auto-Job Filling Upgrades", () => {
  describe("Hybrid Semantic Matcher (Mind2Web / AgentGym)", () => {
    test("matches identical questions with 1.0 similarity", () => {
      const q = "How many years of Python experience do you have?";
      const sim = computeQuestionSimilarity(q, q);
      assert.equal(sim, 1.0);
    });

    test("matches paraphrased questions with token overlap", () => {
      const q1 = "How many years of Python experience do you have?";
      const q2 = "Years of experience in Python?";
      const sim = computeQuestionSimilarity(q1, q2);
      assert.ok(sim >= 0.70, `Expected similarity >= 0.70, got ${sim}`);
    });

    test("matches short stem variants (developer vs develop)", () => {
      const q1 = "Are you a software developer?";
      const q2 = "Do you develop software?";
      const sim = computeQuestionSimilarity(q1, q2);
      assert.ok(sim >= 0.65, `Expected similarity >= 0.65, got ${sim}`);
    });

    test("differentiates semantically unrelated questions", () => {
      const q1 = "What is your desired salary?";
      const q2 = "Are you legally authorized to work in the United States?";
      const sim = computeQuestionSimilarity(q1, q2);
      assert.ok(sim < 0.25, `Expected low similarity, got ${sim}`);
    });
  });

  describe("LATS Reflective Format Repair Engine", () => {
    test("generates valid phone format variations on format error", () => {
      const mutations = generateFormatMutations("phone", "+1 555-0199", "invalid phone number format");
      assert.ok(mutations.length > 0, "Expected phone mutations to be generated");
      assert.ok(mutations.some(m => /^\d+$/.test(m)), "Expected digits-only mutation");
    });

    test("cycles date formats between ISO and US", () => {
      const mutationsIso = generateFormatMutations("date", "2024-05-15", "Invalid date format");
      assert.ok(mutationsIso.includes("05/15/2024"), "Expected US date format conversion");

      const mutationsUs = generateFormatMutations("date", "05/15/2024", "Invalid date format");
      assert.ok(mutationsUs.includes("2024-05-15"), "Expected ISO date format conversion");
    });

    test("truncates input exceeding character limit", () => {
      const longInput = "A".repeat(80);
      const mutations = generateFormatMutations("custom", longInput, "Field cannot exceed 50 characters");
      assert.ok(mutations.some(m => m.length <= 50), "Expected truncation to 50 characters");
    });
  });

  describe("Radix & Headless UI Portal Combobox Strategy (SeeAct / WebArena)", () => {
    test("detects button with aria-haspopup listbox", () => {
      const mockEl = {
        tagName: "BUTTON",
        hasAttribute: (attr: string) => false,
        getAttribute: (attr: string) => (attr === "aria-haspopup" ? "listbox" : null),
        matches: (sel: string) => false,
        querySelector: (sel: string) => null,
      } as unknown as Element;

      assert.equal(RadixHeadlessStrategy.detect(mockEl), true);
    });

    test("detects Radix UI collection item container", () => {
      const mockEl = {
        tagName: "DIV",
        hasAttribute: (attr: string) => attr === "data-radix-collection-item",
        getAttribute: (attr: string) => null,
        matches: (sel: string) => false,
        querySelector: (sel: string) => null,
      } as unknown as Element;

      assert.equal(RadixHeadlessStrategy.detect(mockEl), true);
    });

    test("detects Ashby custom select trigger", () => {
      const mockEl = {
        tagName: "DIV",
        hasAttribute: (attr: string) => false,
        getAttribute: (attr: string) => null,
        matches: (sel: string) => sel.includes("ashby-select") || sel.includes("data-testid"),
        querySelector: (sel: string) => null,
      } as unknown as Element;

      assert.equal(RadixHeadlessStrategy.detect(mockEl), true);
    });
  });
});
