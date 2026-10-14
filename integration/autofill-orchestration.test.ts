import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createProfile, profileToLookup } from "@superjob/core";

function installDom(url = "https://boards.greenhouse.io/acme/jobs/123") {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <form><label for="first_name">First Name</label><input id="first_name" name="first_name" /></form>
    </body></html>`,
    { url }
  );
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    location: window.location,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event,
    FocusEvent: window.FocusEvent,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    InputEvent: (window as any).InputEvent || window.Event,
    CSS: window.CSS,
    getComputedStyle: window.getComputedStyle.bind(window),
  });
  return window.document;
}

function installChromeStorageMock() {
  const local: Record<string, unknown> = {};
  const session: Record<string, unknown> = {};
  const area = (backing: Record<string, unknown>) => ({
    async get(keys: string | string[] | null) {
      if (keys === null) return { ...backing };
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(requested.map((key) => [key, backing[key]]));
    },
    async set(items: Record<string, unknown>) {
      Object.assign(backing, items);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete backing[key];
    },
  });
  (globalThis as any).chrome = {
    runtime: {
      id: "sja-regression-test",
      async sendMessage() {
        return { ok: true };
      },
    },
    storage: { local: area(local), session: area(session) },
  };
}

test("browser autofill action initializes settings and fills a detected field", async () => {
  const document = installDom();
  installChromeStorageMock();

  // Dynamic import occurs after the browser/extension globals have been installed.
  const { autofill } = await import("../packages/extension/src/lib/autofill.ts");
  const profile = createProfile({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" });
  const result = await autofill(profileToLookup(profile), profile, { isAvailable: () => false, complete: async () => "" }, { showCursor: false });

  assert.equal((document.getElementById("first_name") as HTMLInputElement).value, "Jane");
  assert.ok(result.filled >= 1);
});
