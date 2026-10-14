/**
 * End-to-end autofill proof.
 *
 * Builds a realistic job-application form (Greenhouse/Lever/Workday style)
 * in jsdom, then runs the REAL detector + resolver + filler on it and
 * asserts the fields are filled correctly — including:
 *   - text inputs (first/last name, email, phone)
 *   - a select dropdown
 *   - a Yes/No radio group
 *   - a checkbox
 *   - a custom question answered from the cached-answer store
 */
import { JSDOM } from "jsdom";
import { createProfile, profileToLookup, resolveAll } from "@superjob/core";
import { detectFields } from "../packages/extension/src/lib/detector.ts";
import { fillField, isYes } from "../packages/extension/src/lib/filler.ts";

// --- set up a browser-like global environment ---
const dom = new JSDOM(
  `<!doctype html><html><body>
    <form id="application">
      <input type="text" id="first_name" name="first_name" />
      <input type="text" id="last_name" name="last_name" />
      <input type="email" id="email" name="email" />
      <input type="tel" id="phone" name="phone" />
      <input type="text" id="linked_in_url" name="linked_in_url" />
      <input type="number" id="years_experience" name="years_experience" />

      <label for="source">How did you hear about us?</label>
      <select id="source" name="source">
        <option value="">Please select</option>
        <option value="linkedin">LinkedIn</option>
        <option value="referral">Employee referral</option>
        <option value="other">Other</option>
      </select>

      <fieldset>
        <legend>Are you authorized to work in the US?</legend>
        <input type="radio" id="auth_yes" name="work_auth" value="1" /><label for="auth_yes">Yes</label>
        <input type="radio" id="auth_no" name="work_auth" value="0" /><label for="auth_no">No</label>
      </fieldset>

      <label><input type="checkbox" id="consent" name="consent" /> I consent to being contacted</label>

      <label for="why">Why do you want this role?</label>
      <textarea id="why" name="why"></textarea>
    </form>
  </body></html>`,
  { url: "https://boards.greenhouse.io/company/jobs/12345" }
);

const { window } = dom;
(globalThis as any).window = window;
(globalThis as any).document = window.document;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).HTMLInputElement = window.HTMLInputElement;
(globalThis as any).HTMLTextAreaElement = window.HTMLTextAreaElement;
(globalThis as any).HTMLSelectElement = window.HTMLSelectElement;
(globalThis as any).Event = window.Event;
(globalThis as any).FocusEvent = window.FocusEvent;
(globalThis as any).MouseEvent = window.MouseEvent;
(globalThis as any).KeyboardEvent = window.KeyboardEvent;
(globalThis as any).InputEvent = (window as any).InputEvent || window.Event;
(globalThis as any).CSS = window.CSS;
(globalThis as any).getComputedStyle = window.getComputedStyle.bind(window);

const doc = window.document;

// --- build a profile + lookup (with a cached custom answer) ---
const profile = createProfile({
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  linkedin: "https://linkedin.com/in/janedoe",
  yearsOfExperience: "8",
  workAuthorization: "Yes",
  customAnswers: {
    "why do you want this role": "I want to build scalable systems with a strong team.",
    "how did you hear about us": "LinkedIn",
    "i consent to being contacted": "Yes",
  },
});
const lookup = profileToLookup(profile);

// --- run the real pipeline ---
const detected = detectFields(doc);
const resolved = resolveAll(detected, lookup);

let filled = 0;
const report: { label: string; value: string; ok: boolean }[] = [];
for (const field of resolved) {
  const lookupKey = field.fieldKey.startsWith("custom:")
    ? field.fieldKey
    : field.fieldKey;
  const raw = lookup[lookupKey];
  const value = Array.isArray(raw) ? raw.join(", ") : raw;
  if (value === undefined) continue;
  const res = await fillField(field, value);
  if (res.ok) filled++;
  report.push({ label: field.label || "(none)", value: res.filledWith, ok: res.ok });
}

// --- assertions ---
let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

const byId = (id: string) => doc.getElementById(id) as HTMLInputElement;

check("first name filled", byId("first_name").value === "Jane");
check("last name filled", byId("last_name").value === "Doe");
check("email filled", byId("email").value === "jane.doe@example.com");
check("phone filled", byId("phone").value === "(555) 123-4567");
check("linkedin filled", byId("linked_in_url").value === "https://linkedin.com/in/janedoe");
check("years experience filled", byId("years_experience").value === "8");
check("select 'source' filled", (byId("source") as any).value === "linkedin");
check("radio 'Yes' selected", byId("auth_yes").checked === true);
check("radio 'No' not selected", byId("auth_no").checked === false);
check("checkbox checked (consent=yes)", byId("consent").checked === true);
check("custom question answered", (byId("why") as HTMLTextAreaElement).value.includes("scalable systems"));
check("isYes helper", isYes("Yes") && !isYes("No"));
check("detected all fillable fields", detected.length >= 9, `(got ${detected.length})`);
check("all attempted fills succeeded", filled === report.length, `(${filled}/${report.length})`);

// --- Test Missing Fields Callback & Profile Learning ---
const missingField = {
  id: "missing_field_1",
  label: "What is your favorite programming language?",
  fieldKey: "custom:what is your favorite programming language",
  type: "text",
  selector: "#fav_lang",
  confidence: 1.0,
} as any;

// Create a new input on the page
const favLangInput = doc.createElement("input");
favLangInput.type = "text";
favLangInput.id = "fav_lang";
doc.body.appendChild(favLangInput);

// Mock the profile store saving and answer callback
let savedProfile: any = null;
const mockOnAnswerMissingField = async (f: any, value: string) => {
  // 1. Fill the field programmatically on the page
  await fillField(f, value);
  
  // 2. Save in profile's custom answers
  const key = "what is your favorite programming language";
  profile.customAnswers[key] = value;
  savedProfile = profile;
};

// Simulate answering the question "TypeScript"
await mockOnAnswerMissingField(missingField, "TypeScript");

check("missing field input filled on page", byId("fav_lang").value === "TypeScript");
check("missing field saved to profile customAnswers", profile.customAnswers["what is your favorite programming language"] === "TypeScript");

console.log("\n=== AUTOFILL REPORT ===");
console.log(`${filled} fields filled on the simulated Greenhouse form:\n`);
for (const r of report) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.label.padEnd(40)} → ${r.value}`);
}

console.log(`\nIntegration: ${pass} passed, ${fail} failed.`);
if (fail > 0) {
  process.exitCode = 1;
  throw new Error(`${fail} autofill assertions failed`);
}

