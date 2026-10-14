import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { decideFieldPolicy } from "../packages/core/src/field-policy.ts";
import { docxToText, textToDocx } from "../packages/core/src/docx.ts";
import { isLinkedInResumeUploadable } from "../packages/extension/src/lib/autopilot/linkedin-resume-policy.ts";
import { markProgrammaticAutofill, isProgrammaticAutofillEvent } from "../packages/extension/src/lib/programmatic-interaction.ts";

test("Easy Apply safety skips company-follow marketing checkbox", () => {
  const decision = decideFieldPolicy(
    { label: "Follow Reliance Intelligence to stay up to date with their page.", fieldKey: "custom:follow-company", type: "checkbox" },
    { "custom:follow-company": "false" },
    { allowAutonomousFallback: true }
  );
  assert.equal(decision.action, "skip");
  assert.equal(decision.risk, "optional-marketing");
});

test("unresolved additional questions require a saved/profile answer", () => {
  const decision = decideFieldPolicy(
    { label: "Do you have experience building APIs using FastAPI?", fieldKey: "ai", type: "text" },
    {},
    { allowAutonomousFallback: false }
  );
  assert.equal(decision.action, "needs-user");
});

test("Easy Apply accepts only PDF/DOCX resume upload artifacts", () => {
  assert.equal(isLinkedInResumeUploadable({ fileName: "resume.pdf", mimeType: "application/pdf" }), true);
  assert.equal(isLinkedInResumeUploadable({ fileName: "resume.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), true);
  assert.equal(isLinkedInResumeUploadable({ fileName: "resume_tailored.txt", mimeType: "text/plain" }), false);
});

test("tailored resume text becomes a valid DOCX upload artifact", () => {
  const tailored = "Jane Doe\nBackend Engineer\nBuilt reliable APIs";
  const docx = textToDocx(tailored);
  assert.ok(docx.byteLength > 100);
  assert.equal(docxToText(docx).includes("Built reliable APIs"), true);
  assert.equal(isLinkedInResumeUploadable({ fileName: "Jane_Doe_Resume_Tailored.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), true);
});

test("learning agent can distinguish programmatic autofill events", () => {
  const dom = new JSDOM(`<!doctype html><input id="follow" type="checkbox">`);
  const input = dom.window.document.getElementById("follow")!;
  assert.equal(isProgrammaticAutofillEvent(input), false);
  markProgrammaticAutofill(input);
  assert.equal(isProgrammaticAutofillEvent(input), true);
});
