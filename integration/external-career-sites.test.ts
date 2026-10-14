import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  createProfile,
  profileToLookup,
  createLLM,
  answerQuestion,
  resolveValue,
  type Profile,
} from "@superjob/core";
import {
  getAtsAdapter,
  findAtsActionButton,
  clickAtsAction,
  getValidationErrors,
  isAtsConfirmationPage,
} from "../packages/extension/src/lib/ats-adapters.js";
import { detectPlatform, GENERIC } from "../packages/extension/src/lib/platforms.js";
import { isProbablyJobUrl } from "../packages/extension/src/lib/permission-policy.js";
import { detectGenericJob } from "../packages/ats-config/src/generic-detector.js";

function setupDom(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    location: window.location,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLSelectElement: window.HTMLSelectElement,
    Event: window.Event,
    FocusEvent: window.FocusEvent,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    InputEvent: (window as any).InputEvent || window.Event,
    getComputedStyle: window.getComputedStyle.bind(window),
  });
  return window.document;
}

const profile: Profile = createProfile({
  firstName: "Shashi",
  lastName: "Kumar Banoth",
  email: "shashikumarbanoth91@gmail.com",
  phone: "+91 9876543210",
  city: "Bengaluru",
  country: "India",
  linkedin: "https://linkedin.com/in/shashi-banoth",
  github: "https://github.com/shashi-banoth",
  yearsOfExperience: "5",
  workAuthorization: "Yes",
  requiresSponsorship: "No",
  masterResumeText: "Lead Full-Stack Engineer with 5+ years experience in React, TypeScript, Python, and AWS.",
  skills: ["React", "TypeScript", "Python", "Node.js", "AWS", "Docker"],
  customAnswers: {
    "why are you interested in this role": "I am passionate about building enterprise-grade distributed systems.",
  },
});

test("1. URL Policy: recognizes external career URLs for any company", () => {
  // Enterprise ATS platforms
  assert.ok(isProbablyJobUrl("https://boards.greenhouse.io/stripe/jobs/500123"));
  assert.ok(isProbablyJobUrl("https://jobs.lever.co/spotify/12345-67890"));
  assert.ok(isProbablyJobUrl("https://wd3.myworkdayjobs.com/uber/job/101"));
  assert.ok(isProbablyJobUrl("https://jobs.ashbyhq.com/linear/202"));
  assert.ok(isProbablyJobUrl("https://careers.smartrecruiters.com/visa/303"));

  // Direct custom company career subdomains
  assert.ok(isProbablyJobUrl("https://careers.airbnb.com/positions/senior-engineer"));
  assert.ok(isProbablyJobUrl("https://stripe.com/jobs/listing/software-engineer/404"));
  assert.ok(isProbablyJobUrl("https://netflix.jobs/search?q=engineer"));
  assert.ok(isProbablyJobUrl("https://amazon.jobs/en/jobs/2000001"));
  assert.ok(isProbablyJobUrl("https://meta.com/careers/v2/jobs/99999"));

  // Non-job pages should be excluded
  assert.ok(!isProbablyJobUrl("https://google.com/search?q=cats"));
  assert.ok(!isProbablyJobUrl("https://youtube.com/watch?v=12345"));
});

test("2. Generic Career Site: extracts Schema.org JSON-LD job metadata from custom company domain", () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Principal Distributed Systems Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Acme Innovations Ltd"
          },
          "description": "Architect high-throughput microservices using Go, Python, and AWS.",
          "jobLocation": {
            "@type": "Place",
            "address": {
              "addressLocality": "Bengaluru",
              "addressCountry": "India"
            }
          }
        }
        </script>
      </head>
      <body>
        <h1>Principal Distributed Systems Engineer</h1>
      </body>
    </html>
  `;
  const doc = setupDom(html, "https://careers.acme-innovations.com/positions/8891");
  const job = detectGenericJob(doc);

  assert.equal(job.source, "jsonld");
  assert.equal(job.title, "Principal Distributed Systems Engineer");
  assert.equal(job.company, "Acme Innovations Ltd");
  assert.ok(job.description?.includes("microservices"));
  assert.ok(job.location?.includes("Bengaluru"));
  assert.ok(job.confidence >= 0.8);
});

test("3. Multi-Step ATS: Workday navigation from Step 1 (Next) to final Review & Submit", () => {
  // Step 1: Form with Next button
  const step1Html = `
    <!doctype html>
    <html>
      <body>
        <div data-automation-id="applyFlowPage">
          <label>First Name <input data-automation-id="legalNameSection_firstName" value="Shashi"></label>
          <label>Last Name <input data-automation-id="legalNameSection_lastName" value="Kumar Banoth"></label>
          <button data-automation-id="bottom-navigation-next-button">Save & Continue</button>
        </div>
      </body>
    </html>
  `;
  const doc1 = setupDom(step1Html, "https://wd3.myworkdayjobs.com/enterprise/job/JR-49201");
  const adapter1 = getAtsAdapter(location.href, doc1);

  assert.equal(adapter1.id, "workday");
  const nextBtn = findAtsActionButton(false, doc1, adapter1);
  assert.ok(nextBtn);
  assert.equal(nextBtn.action, "next");

  // Step 2: Final Review with Submit button
  const step2Html = `
    <!doctype html>
    <html>
      <body>
        <div data-automation-id="applyFlowPage">
          <h2>Review Your Information</h2>
          <button data-automation-id="bottom-navigation-submit-button">Submit Application</button>
        </div>
      </body>
    </html>
  `;
  const doc2 = setupDom(step2Html, "https://wd3.myworkdayjobs.com/enterprise/job/JR-49201");
  const submitBtn = findAtsActionButton(true, doc2, adapter1);
  assert.ok(submitBtn);
  assert.equal(submitBtn.action, "submit");
});

test("4. Generic Company Career Page: detects form, custom questions, and submits without pre-existing adapter", () => {
  const customCompanyHtml = `
    <!doctype html>
    <html>
      <body>
        <form id="custom-career-form">
          <label for="applicant_name">Full Name</label>
          <input type="text" id="applicant_name" name="applicant_name" />

          <label for="applicant_email">Work Email</label>
          <input type="email" id="applicant_email" name="applicant_email" />

          <label for="why_us">Why are you interested in joining Acme Innovations?</label>
          <textarea id="why_us" name="why_us"></textarea>

          <button type="submit" class="btn btn-primary submit-btn">Submit Application</button>
        </form>
      </body>
    </html>
  `;
  const doc = setupDom(customCompanyHtml, "https://careers.acme-innovations.com/apply");
  const adapter = getAtsAdapter(location.href, doc);

  // Verifies fallback to Generic ATS adapter
  assert.equal(adapter.id, "generic");

  let submitted = false;
  const submitButton = doc.querySelector("button[type='submit']") as HTMLButtonElement;
  submitButton.onclick = (e) => {
    e.preventDefault();
    submitted = true;
  };

  const action = clickAtsAction(true, doc, adapter);
  assert.equal(action, "submit");
  assert.equal(submitted, true);
});

test("5. AI Question Answering: resolves custom company screening questions", async () => {
  const lookup = profileToLookup(profile);

  // A. Profile-backed deterministic resolver
  const f1 = { id: "q1", name: "work_auth", label: "Are you legally authorized to work in India?", type: "radio", fieldKey: "workAuthorization" } as any;
  const v1 = resolveValue(f1, lookup);
  assert.equal(v1?.toLowerCase(), "yes");

  const f2 = { id: "q2", name: "sponsorship", label: "Will you now or in the future require visa sponsorship?", type: "radio", fieldKey: "requiresSponsorship" } as any;
  const v2 = resolveValue(f2, lookup);
  assert.equal(v2?.toLowerCase(), "no");

  const f3 = { id: "q3", name: "experience", label: "How many years of relevant experience do you have?", type: "number", fieldKey: "yearsOfExperience" } as any;
  const v3 = resolveValue(f3, lookup);
  assert.equal(v3, "5");

  // B. LLM Answer Question fallback for custom screening questions
  const llm = createLLM({ provider: "none" });
  const a5 = await answerQuestion(
    llm,
    "What is your primary programming language?",
    profile.masterResumeText,
    [
      { label: "Python", value: "python" },
      { label: "Rust", value: "rust" },
    ],
    "select",
    "python"
  );
  assert.equal(a5.toLowerCase(), "python");
});

test("6. Confirmation Detector: recognizes success on any custom confirmation page", () => {
  const thanksHtml = `
    <!doctype html>
    <html>
      <body>
        <main class="thank-you-page">
          <h2>Thank you! Your application has been successfully submitted.</h2>
          <p>Our talent acquisition team will review your qualifications and contact you.</p>
        </main>
      </body>
    </html>
  `;
  const doc = setupDom(thanksHtml, "https://careers.acme-innovations.com/success");
  assert.equal(isAtsConfirmationPage(doc), true);
});
