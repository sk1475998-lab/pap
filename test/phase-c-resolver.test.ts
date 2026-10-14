import test from "node:test";
import assert from "node:assert/strict";
import { computeFormSig } from "../packages/extension/src/lib/pattern-cache.ts";

test("form signature changes when the application form changes", () => {
  const makeDocument = (action: string): Document => {
    const form = {
      getAttribute(name: string) {
        return name === "action" ? action : name === "id" ? "application" : "job-form";
      },
      querySelectorAll() {
        return { length: 3 };
      },
    };
    return {
      querySelectorAll(selector: string) {
        return selector === "form" ? [form] : [];
      },
    } as unknown as Document;
  };

  const first = computeFormSig(makeDocument("/apply"));
  assert.equal(computeFormSig(makeDocument("/apply")), first);
  assert.notEqual(computeFormSig(makeDocument("/careers/apply")), first);
});
