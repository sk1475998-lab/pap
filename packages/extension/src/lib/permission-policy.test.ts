import assert from "node:assert/strict";
import test from "node:test";
import { canInjectOrchestrator } from "./permission-policy.js";

test("form heuristic permits a custom career form on an unlisted company domain", () => {
  assert.equal(
    canInjectOrchestrator(
      "https://apply.example-company.com/r/48291",
      "https://apply.example-company.com/r/48291",
      "form-heuristic",
    ),
    true,
  );
});

test("manual activation permits a safe custom application page", () => {
  assert.equal(
    canInjectOrchestrator(
      "https://example-company.com/r/48291",
      "https://example-company.com/r/48291",
      "manual",
    ),
    true,
  );
});

test("unrelated pages remain blocked without manual activation or a form signal", () => {
  assert.equal(
    canInjectOrchestrator(
      "https://news.example.com/article",
      "https://news.example.com/article",
      "not-job-context",
    ),
    false,
  );
});

test("excluded embedded origins remain blocked even inside a job tab", () => {
  assert.equal(
    canInjectOrchestrator(
      "https://www.googletagmanager.com/frame",
      "https://apply.example-company.com/r/48291",
      "form-heuristic",
    ),
    false,
  );
});

test("LinkedIn non-job pages are not injected by form heuristics", () => {
  assert.equal(
    canInjectOrchestrator(
      "https://www.linkedin.com/in/example",
      "https://www.linkedin.com/in/example",
      "form-heuristic",
    ),
    false,
  );
});
