import assert from "node:assert/strict";
import test from "node:test";
import {
  TaskQueue,
  FillError,
  ValueError,
  CancelledError,
  SkippedError,
  ATSConfigSchema,
  AtsFlowConfigSchema,
} from "./index.js";

test("TaskQueue executes tasks in FIFO sequence", async () => {
  const queue = new TaskQueue();
  const executed: number[] = [];

  queue.add(async () => { executed.push(1); });
  queue.add(async () => { executed.push(2); });
  queue.add(async () => { executed.push(3); });

  await queue.run();
  assert.deepEqual(executed, [1, 2, 3]);
});

test("TaskQueue cancels remaining tasks when cancel() is called", async () => {
  const queue = new TaskQueue();
  const executed: number[] = [];

  queue.add(async () => {
    executed.push(1);
    queue.cancel();
  });
  queue.add(async () => { executed.push(2); });

  await assert.rejects(async () => {
    await queue.run();
  }, (err: any) => err instanceof CancelledError);

  assert.deepEqual(executed, [1]);
});

test("Autofill error types preserve specific names and error messages", () => {
  const fillErr = new FillError("Field not interactable");
  assert.equal(fillErr.name, "FillError");
  assert.equal(fillErr.message, "Field not interactable");

  const valErr = new ValueError("No email found in profile");
  assert.equal(valErr.name, "ValueError");
  assert.equal(valErr.message, "No email found in profile");

  const skipErr = new SkippedError("Salary expectation");
  assert.equal(skipErr.name, "SkippedError");
  assert.match(skipErr.message, /Salary expectation/);

  const cancelErr = new CancelledError();
  assert.equal(cancelErr.name, "CancelledError");
});

test("ATSConfigSchema validates valid configuration data", () => {
  const validConfig = {
    platformId: "greenhouse",
    platformName: "Greenhouse ATS",
    version: 1,
    urlPatterns: [".*boards\\.greenhouse\\.io.*"],
    fieldMappings: [
      {
        canonicalName: "firstName",
        label: "First Name",
        fieldType: "text",
        selectors: [
          {
            type: "css",
            value: "input#first_name",
          },
        ],
        required: true,
      },
    ],
  };

  const parsed = ATSConfigSchema.parse(validConfig);
  assert.equal(parsed.platformId, "greenhouse");
  assert.equal(parsed.fieldMappings.length, 1);
});
