import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { PLATFORM_OVERRIDES } from "../packages/ats-config/src/platform-overrides.ts";
import { detectPlatform } from "../packages/extension/src/lib/platforms.ts";

const dom = new JSDOM(`<!doctype html><form></form>`);
(globalThis as any).document = dom.window.document;

test("platform overrides are config data and detect known non-chunked sites", () => {
  assert.ok(PLATFORM_OVERRIDES.some((item) => item.id === "infosys"));
  assert.ok(PLATFORM_OVERRIDES.some((item) => item.id === "naukri"));
  assert.equal(detectPlatform("https://career.infosys.com/jobs/123")?.id, "infosys");
  assert.equal(detectPlatform("https://www.naukri.com/job-listings-123")?.id, "naukri");
});
