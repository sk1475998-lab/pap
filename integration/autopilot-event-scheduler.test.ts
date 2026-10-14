import assert from "node:assert/strict";
import test from "node:test";
import { createIdleDebouncedScheduler } from "../packages/extension/src/lib/autopilot/event-scheduler.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("event scheduler coalesces bursts instead of polling repeatedly", async () => {
  let runs = 0;
  const scheduler = createIdleDebouncedScheduler(() => { runs++; }, { debounceMs: 15 });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  await sleep(45);
  assert.equal(runs, 1);

  scheduler.schedule();
  scheduler.stop();
  await sleep(35);
  assert.equal(runs, 1);
});
