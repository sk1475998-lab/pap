import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  attemptExternalSubmission,
  waitForExternalSubmissionConfirmation,
} from "../packages/extension/src/lib/autopilot/external-submission-confirmation.ts";

test("a successful submit click without an ATS confirmation is not recorded as applied", async () => {
  const dom = new JSDOM("<!doctype html><body><h1>Application form</h1></body>");
  let recorded = false;
  let markedUnconfirmed = false;

  const outcome = await attemptExternalSubmission(
    () => true,
    () => waitForExternalSubmissionConfirmation(20, dom.window.document),
    async () => { recorded = true; },
    () => { markedUnconfirmed = true; }
  );

  assert.equal(outcome, "unconfirmed");
  assert.equal(recorded, false);
  assert.equal(markedUnconfirmed, true);
});

test("an explicit ATS confirmation allows recording the application", async () => {
  const dom = new JSDOM("<!doctype html><body><main><h1>Application form</h1></main></body>");
  let recorded = false;
  setTimeout(() => {
    dom.window.document.querySelector("main")!.textContent = "Thank you for applying. Your application has been received.";
  }, 10);

  const outcome = await attemptExternalSubmission(
    () => true,
    () => waitForExternalSubmissionConfirmation(200, dom.window.document),
    async () => { recorded = true; },
    () => assert.fail("An explicit confirmation must not be marked unconfirmed")
  );

  assert.equal(outcome, "confirmed");
  assert.equal(recorded, true);
});

test("confirmation timeout leaves the application unconfirmed", async () => {
  const timeoutDom = new JSDOM("<!doctype html><body><p>Submission in progress</p></body>");
  let recorded = false;
  const outcome = await attemptExternalSubmission(
    () => true,
    () => waitForExternalSubmissionConfirmation(20, timeoutDom.window.document),
    async () => { recorded = true; },
    () => {}
  );

  assert.equal(outcome, "unconfirmed");
  assert.equal(recorded, false);
});
