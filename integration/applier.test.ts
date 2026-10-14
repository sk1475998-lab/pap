/**
 * Headless applier integration test.
 *
 * Launches a REAL Chromium browser via Playwright, loads a local test
 * application form (served inline), and runs the actual scanPage +
 * fillForm pipeline. This proves the headless applier works end-to-end
 * against a live browser — not just jsdom.
 *
 * Run: npx tsx integration/applier.test.ts
 */
import { chromium } from "playwright";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createProfile,
  profileToLookup,
  createLLM,
  scoreMatch,
} from "@superjob/core";
import { scanPage } from "../packages/applier/src/page-scan.js";
import { fillForm } from "../packages/applier/src/page-fill.js";

// A realistic job application form as a single HTML file
const TEST_HTML = `<!doctype html><html><head><meta charset="utf-8">
<title>Backend Engineer - Acme Corp - Greenhouse</title></head>
<body>
<h1>Backend Engineer</h1>
<div class="company-name">Acme Corp</div>
<form id="application">
  <div><label>First Name <input type="text" id="first_name" name="first_name" required></label></div>
  <div><label>Last Name <input type="text" id="last_name" name="last_name" required></label></div>
  <div><label>Email <input type="email" id="email" name="email" required></label></div>
  <div><label>Phone <input type="tel" id="phone" name="phone"></label></div>
  <div><label>LinkedIn Profile <input type="url" id="linkedin" name="linkedin"></label></div>
  <div><label>GitHub/Portfolio <input type="url" id="github" name="github"></label></div>
  <div><label>How many years of experience do you have? <input type="number" id="years" name="years"></label></div>

  <div>
    <label for="source">How did you hear about us?</label>
    <select id="source" name="source">
      <option value="">Select...</option>
      <option value="linkedin">LinkedIn</option>
      <option value="referral">Referral</option>
      <option value="other">Other</option>
    </select>
  </div>

  <fieldset>
    <legend>Are you authorized to work in the US?</legend>
    <input type="radio" id="auth_y" name="auth" value="yes"><label for="auth_y">Yes</label>
    <input type="radio" id="auth_n" name="auth" value="no"><label for="auth_n">No</label>
  </fieldset>

  <fieldset>
    <legend>Will you now or in the future require sponsorship?</legend>
    <input type="radio" id="sp_y" name="sponsor" value="yes"><label for="sp_y">Yes</label>
    <input type="radio" id="sp_n" name="sponsor" value="no"><label for="sp_n">No</label>
  </fieldset>

  <label><input type="checkbox" id="consent" name="consent"> I agree to the terms</label>

  <label for="why">Why are you interested in this role?</label>
  <textarea id="why" name="why" rows="3"></textarea>

  <button type="submit">Submit Application</button>
</form>
<script>
  // simulate a React-like change handler that validates on input
  document.querySelectorAll('input,textarea,select').forEach(function(el){
    el.addEventListener('input', function(){ el.setAttribute('data-filled', 'true'); });
  });
</script>
</body></html>`;

const JOB_DESC = `
We are hiring a Backend Engineer at Acme Corp. You will design distributed
services on AWS using Python, PostgreSQL, and Kubernetes. Experience with
Docker, React, and TypeScript is a plus. We value engineers who can build
scalable systems and work with microservices.
`;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function main() {
  // write the test HTML to a temp file
  const htmlPath = join(tmpdir(), `sja-test-${Date.now()}.html`);
  writeFileSync(htmlPath, TEST_HTML);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Executable doesn't exist|libnspr4|Host system is missing dependencies|error while loading shared libraries/i.test(msg)) {
      console.log("Headless applier: skipped because Playwright system dependencies are missing in this environment.");
      unlinkSync(htmlPath);
      return;
    }
    throw e;
  }
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`);
  await page.waitForLoadState("domcontentloaded");

  // build a profile + lookup
  const profile = createProfile({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "(555) 123-4567",
    linkedin: "https://linkedin.com/in/janedoe",
    github: "https://github.com/janedoe",
    yearsOfExperience: "8",
    workAuthorization: "Yes",
    requiresSponsorship: "No",
    customAnswers: {
      "why are you interested in this role": "I want to build scalable distributed systems.",
      "how did you hear about us": "LinkedIn",
      "i agree to the terms": "Yes",
    },
    masterResumeText:
      "Jane Doe. Senior Software Engineer. Python, PostgreSQL, AWS, Kubernetes, Docker, React, TypeScript. 8 years building scalable backend systems.",
    skills: ["python", "postgresql", "aws", "kubernetes", "docker", "react", "typescript"],
  });
  const lookup = profileToLookup(profile);
  const llm = createLLM({ provider: "none" }); // no LLM — test deterministic path

  // 1) test match scoring (the pipeline uses this before applying)
  const match = scoreMatch({
    resumeText: profile.masterResumeText,
    jobDescription: JOB_DESC,
    profileSkills: profile.skills,
  });
  check("match score computed", match.score > 0, `(got ${match.score})`);
  check("match found python", match.matched.includes("python") || match.matched.includes("postgresq"));

  // 2) scan the real page
  const fields = await scanPage(page);
  console.log(`\nScanned ${fields.length} fields on the live page.`);
  check("detected input fields", fields.filter((f) => ["text","email","tel","number","url"].includes(f.type)).length >= 5);
  check("detected select", fields.some((f) => f.type === "select"));
  check("detected radio groups", fields.filter((f) => f.type === "radio").length >= 2);
  check("detected checkbox", fields.some((f) => f.type === "checkbox"));
  check("detected textarea", fields.some((f) => f.type === "textarea"));

  // 3) fill the form via the real pipeline
  const result = await fillForm(page, fields, lookup, profile, llm, 0);
  console.log(`Filled ${result.filled} fields, skipped ${result.skipped}.`);

  // 4) verify the values landed in the real DOM (string-based eval to avoid tsx __name leak)
  const vals = await page.evaluate(`(function() {
    function get(id) {
      var el = document.getElementById(id);
      if (!el) return null;
      if (el.type === 'checkbox') return el.checked;
      if (el.tagName === 'SELECT') return el.value;
      return el.value;
    }
    function radio(name) {
      var c = document.querySelector('input[type=radio][name="' + name + '"]:checked');
      return c ? c.value : null;
    }
    return JSON.stringify({
      first: get('first_name'),
      last: get('last_name'),
      email: get('email'),
      phone: get('phone'),
      linkedin: get('linkedin'),
      github: get('github'),
      years: get('years'),
      source: get('source'),
      auth: radio('auth'),
      sponsor: radio('sponsor'),
      consent: get('consent'),
      why: get('why')
    });
  })()`).then((s) => JSON.parse(s as string));

  console.log("\n=== HEADLESS FILL RESULTS (live browser) ===");
  for (const [k, v] of Object.entries(vals)) {
    console.log(`  ${k.padEnd(12)} → ${v}`);
  }

  check("first name", vals.first === "Jane");
  check("last name", vals.last === "Doe");
  check("email", vals.email === "jane.doe@example.com");
  check("phone", vals.phone === "(555) 123-4567");
  check("linkedin", vals.linkedin === "https://linkedin.com/in/janedoe");
  check("github", vals.github === "https://github.com/janedoe");
  check("years", vals.years === "8");
  check("source select", vals.source === "linkedin");
  check("auth radio = yes", vals.auth === "yes");
  check("sponsor radio = no", vals.sponsor === "no");
  check("consent checkbox checked", vals.consent === true);
  check("why textarea filled", String(vals.why).includes("scalable"));
  check("all fills succeeded", result.filled === result.filled + result.skipped ? true : result.skipped === 0, `(${result.filled}/${result.filled + result.skipped})`);

  // cleanup
  await browser.close();
  unlinkSync(htmlPath);

  console.log(`\nHeadless integration: ${pass} passed, ${fail} failed.`);
  if (fail > 0) {
    process.exitCode = 1;
    throw new Error(`${fail} headless assertions failed`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
