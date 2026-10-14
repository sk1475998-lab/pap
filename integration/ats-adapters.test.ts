/** ATS adapter proof tests. */
import { JSDOM } from "jsdom";
import { clickAtsAction, findAtsActionButton, getAtsAdapter, getValidationErrors, isAtsConfirmationPage } from "../packages/extension/src/lib/ats-adapters.ts";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}`); }
}

function setup(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  (globalThis as any).window = window;
  (globalThis as any).document = window.document;
  (globalThis as any).HTMLElement = window.HTMLElement;
  (globalThis as any).HTMLInputElement = window.HTMLInputElement;
  (globalThis as any).HTMLButtonElement = window.HTMLButtonElement;
  (globalThis as any).Event = window.Event;
  (globalThis as any).FocusEvent = window.FocusEvent;
  (globalThis as any).MouseEvent = window.MouseEvent;
  (globalThis as any).KeyboardEvent = window.KeyboardEvent;
  (globalThis as any).InputEvent = (window as any).InputEvent || window.Event;
  (globalThis as any).getComputedStyle = window.getComputedStyle.bind(window);
  (globalThis as any).location = window.location;
  return window.document;
}

{
  const doc = setup(`<!doctype html><button data-automation-id="bottom-navigation-next-button">Next</button>`, "https://wd3.myworkdayjobs.com/acme/job/x/JR-123");
  const a = getAtsAdapter(location.href, doc);
  check("workday adapter detected", a.id === "workday");
  check("workday next found", findAtsActionButton(false, doc, a)?.action === "next");
}

{
  const doc = setup(`<!doctype html><form><div class="field-error-msg">Email is required</div><button id="submit_app" type="submit">Submit Application</button></form>`, "https://boards.greenhouse.io/acme/jobs/123");
  const a = getAtsAdapter(location.href, doc);
  check("greenhouse adapter detected", a.id === "greenhouse");
  check("validation blocks", getValidationErrors(doc, a).length === 1);
  check("submit blocked by validation", findAtsActionButton(true, doc, a) === null);
}

{
  const doc = setup(`<!doctype html><form><button id="s" type="submit">Submit Application</button></form>`, "https://jobs.lever.co/acme/550e8400-e29b-41d4-a716-446655440000");
  const a = getAtsAdapter(location.href, doc);
  let clicked = false;
  (doc.getElementById("s") as HTMLButtonElement).onclick = (e) => { e.preventDefault(); clicked = true; };
  check("lever submit action", clickAtsAction(true, doc, a) === "submit");
  check("lever submit clicked", clicked);
}

{
  const doc = setup(`<!doctype html><main>Thank you, your application was successfully submitted.</main>`, "https://example.com/apply/thanks");
  check("confirmation detected", isAtsConfirmationPage(doc));
}

console.log(`ATS adapters: ${pass} passed, ${fail} failed.`);
if (fail) throw new Error(`${fail} ATS adapter assertions failed`);
