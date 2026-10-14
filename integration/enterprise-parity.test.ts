import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("GAP-DOM-01: Deep and Closed Shadow DOM Penetration", () => {
  it("collects roots across nested open shadow roots and window.__sja_shadow_roots", async () => {
    const fakeShadow: any = {
      children: [],
      querySelectorAll: () => [],
      querySelector: (s: string) => (s === "#inner-input" ? { id: "inner-input" } : null),
    };

    const fakeElement: any = {
      shadowRoot: null,
      children: [],
    };

    (global as any).window = {
      __sja_shadow_roots: new Set([fakeShadow]),
    };

    const { collectDeepRoots, findDeepElement } = await import(
      "../packages/extension/src/lib/dom-deep-scan.js"
    );

    const fakeDoc: any = {
      querySelectorAll: () => [],
      querySelector: () => null,
      body: { children: [fakeElement] },
    };

    const roots = collectDeepRoots(fakeDoc);
    assert.ok(roots.length >= 2, "Should include fakeDoc and the closed fakeShadow root");
    assert.ok(roots.includes(fakeShadow as any), "Should have captured the closed shadow root");

    const found = findDeepElement("#inner-input", fakeDoc);
    assert.equal(found?.id, "inner-input");
  });

  it("finds elements across slotted elements and nested trees", async () => {
    const slottedInput: any = { id: "slotted-email", tagName: "INPUT" };
    const fakeSlot: any = {
      tagName: "SLOT",
      children: [],
      assignedElements: () => [slottedInput],
    };

    const fakeDoc: any = {
      querySelectorAll: () => [],
      querySelector: () => null,
      body: { children: [fakeSlot] },
    };

    const { findDeepElement } = await import(
      "../packages/extension/src/lib/dom-deep-scan.js"
    );

    const found = findDeepElement("#slotted-email", fakeDoc);
    assert.ok(found, "Should find element inside slotted component");
    assert.equal((found as any)?.id, "slotted-email");
  });
});

describe("GAP-SEC-02: Server Sync & Resume Route Verification", () => {
  it("sync router file exports syncRouter and has public status handler", async () => {
    const syncFile = fs.readFileSync("packages/server/src/routes/sync.ts", "utf8");
    assert.ok(syncFile.includes('syncRouter.get('), "syncRouter defines GET endpoints");
    assert.ok(syncFile.includes('/status'), "syncRouter defines /status");
    assert.ok(syncFile.includes('/health'), "syncRouter defines /health");
    assert.ok(syncFile.includes('optionalAuth'), "syncRouter uses optionalAuth for public status");
  });

  it("resume router file touches sync key upon profile ingest", async () => {
    const resumeFile = fs.readFileSync("packages/server/src/routes/resume.ts", "utf8");
    assert.ok(resumeFile.includes('touchSyncKey("profile")'), "resume ingest touches profile sync key");
  });
});
