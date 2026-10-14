import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyLinkedInApplyControl,
  linkedInEasyApplySelectors,
  linkedInExternalApplySelectors,
} from "./linkedin-controls.js";

test("classifies legacy easy-apply button by aria-label prefix", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "BUTTON",
      ariaLabel: "LinkedIn Apply to Staff Engineer at Acme",
      className: "jobs-apply-button",
    }),
    "easy-apply",
  );
});

test("classifies SDUI easy-apply link by flow flag", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "A",
      href: "https://www.linkedin.com/jobs/view/123?openSDUIApplyFlow=true",
    }),
    "easy-apply",
  );
});

test("rejects the LinkedIn Apply search filter pill (radio role)", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "BUTTON",
      ariaLabel: "LinkedIn Apply filter.",
      role: "radio",
      className: "artdeco-pill",
    }),
    "filter-pill",
  );
});

test("classifies external apply by aria-label", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "BUTTON",
      ariaLabel: "Apply on company website",
    }),
    "external-apply",
  );
});

test("legacy jobs-apply-button with Easy Apply text works, non-apply returns other", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "BUTTON",
      className: "jobs-apply-button jobs-save-button",
      text: "Easy Apply",
    }),
    "easy-apply",
  );
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "BUTTON",
      className: "artdeco-button",
      text: "Save",
    }),
    "other",
  );
});

test("case-insensitive handling of label casing", () => {
  assert.equal(
    classifyLinkedInApplyControl({
      tagName: "A",
      ariaLabel: "linkedin APPLY to this job",
    }),
    "easy-apply",
  );
});

test("selector helpers expose dual-UI and external selectors", () => {
  assert.ok(linkedInEasyApplySelectors().length >= 2);
  assert.ok(linkedInEasyApplySelectors()[1]!.includes("openSDUIApplyFlow"));
  assert.ok(linkedInExternalApplySelectors()[0]!.includes("Apply on company website"));
});
