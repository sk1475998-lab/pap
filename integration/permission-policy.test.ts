import assert from "node:assert/strict";
import test from "node:test";
import {
  decideInjectionForUrl,
  originPatternForUrl,
} from "../packages/extension/src/lib/permission-policy.ts";

test("permission policy grants known job hosts without broad optional access", () => {
  const known = decideInjectionForUrl("https://boards.greenhouse.io/acme/jobs/123");
  assert.equal(known.allowed, true);
  assert.equal(known.requiresOptionalHostPermission, false);
});

test("permission policy requires a user-granted origin for generic job URLs", () => {
  const generic = decideInjectionForUrl("https://careers.example.com/apply/software-engineer");
  assert.equal(generic.allowed, true);
  assert.equal(generic.requiresOptionalHostPermission, true);
  assert.equal(originPatternForUrl("https://careers.example.com/apply/software-engineer"), "https://careers.example.com/*");
});

test("permission policy rejects unrelated and explicitly excluded hosts", () => {
  assert.equal(decideInjectionForUrl("https://example.com/about").allowed, false);
  assert.equal(decideInjectionForUrl("https://www.googletagmanager.com/anything/job").allowed, false);
});
