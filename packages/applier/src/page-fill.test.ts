import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { ProfileSchema, type LLMClient, type ProfileLookup } from "@superjob/core";
import { fillForm } from "./page-fill.js";
import { scanPage } from "./page-scan.js";

let browser: Browser;
let page: Page;

test.before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

test.after(async () => {
  await browser?.close();
});

test("page scanner identifies checkboxes and skips disabled or read-only controls", async () => {
  await page.setContent(`
    <label><input type="checkbox" name="updates"> Send product updates</label>
    <label for="disabled">Disabled field</label><input id="disabled" disabled>
    <label for="readonly">Read-only field</label><input id="readonly" readonly>
  `);

  const fields = await scanPage(page);

  assert.deepEqual(fields.map(({ label, type }) => ({ label, type })), [
    { label: "Send product updates", type: "checkbox" },
  ]);
});

test("headless fill uses grounded AI for unknown questions but leaves sensitive answers for the user", async () => {
  await page.setContent(`
    <label for="approach">Describe your approach to debugging</label>
    <textarea id="approach"></textarea>
    <label for="authorization">Are you authorized to work here?</label>
    <input id="authorization">
  `);
  const fields = await scanPage(page);
  const profile = ProfileSchema.parse({
    id: "autofill-test",
    firstName: "Test",
    lastName: "Candidate",
    email: "",
    masterResumeText: "Experienced software engineer with production debugging experience.",
  });
  const lookup: ProfileLookup = {};
  let llmCalls = 0;
  const llm: LLMClient = {
    config: { provider: "none", model: "" },
    isAvailable: () => true,
    complete: async () => {
      llmCalls++;
      return "I use logs and focused tests to isolate the root cause.";
    },
  };

  const result = await fillForm(page, fields, lookup, profile, llm);

  assert.equal(await page.locator("#approach").inputValue(), "I use logs and focused tests to isolate the root cause.");
  assert.equal(await page.locator("#authorization").inputValue(), "");
  assert.equal(llmCalls, 1);
  assert.equal(result.filled, 1);
  assert.equal(result.skipped, 1);
});
