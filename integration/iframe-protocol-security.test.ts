import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { IframeAutofillManager } from "../packages/ats-config/src/iframe-manager.ts";

test("iframe protocol generates a per-iframe nonce and embeds parent/source checks", () => {
  const dom = new JSDOM(`<!doctype html><iframe src="https://forms.example.test/apply"></iframe>`, {
    url: "https://parent.example.test/job",
  });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLIFrameElement: window.HTMLIFrameElement,
    HTMLElement: window.HTMLElement,
  });

  const iframe = window.document.querySelector("iframe") as HTMLIFrameElement;
  const manager = new IframeAutofillManager({ autoInject: false });
  manager.trackIframe(iframe);

  const entry = (manager as any).entries.get(iframe);
  assert.match(entry.nonce, /^[a-f0-9]{32}$/);

  const script = (manager as any).getIframeHandlerScript();
  assert.match(script, /event\.source !== window\.parent/);
  assert.match(script, /data\.nonce !== trustedNonce/);
  assert.match(script, /trustedParentOrigin !== event\.origin/);
});
