/**
 * Email classifier integration test.
 *
 * Proves the keyword-based classifier correctly categorizes realistic
 * job-application emails (interview invitations, rejections, offers, etc.)
 * and extracts company names. No IMAP connection needed — tests the
 * classification engine directly.
 *
 * Uses the "none" LLM (no API calls) so it runs 100% free and offline.
 */
import { classifyEmail } from "../packages/email-monitor/src/classifiers/classifier.js";
import type { RawEmail } from "../packages/email-monitor/src/types.js";
import { syncEmailToTracker } from "../packages/email-monitor/src/tracker-sync.js";
import { setStore, type Application } from "@superjob/core";

// in-memory store
const memStore: Record<string, unknown> = {};
setStore({
  async get<T>(key: string) { return memStore[key] as T | undefined; },
  async set<T>(key: string, value: T) { memStore[key] = value; },
  async delete(key: string) { delete memStore[key]; },
  async keys() { return Object.keys(memStore); },
});

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

function makeRaw(subject: string, text: string, from = "noreply@acme.com", fromName = "Acme Recruiting"): RawEmail {
  return {
    messageId: `msg_${Math.random().toString(36).slice(2, 8)}`,
    from,
    fromName,
    subject,
    text,
    html: "",
    date: new Date(),
  };
}

const TEST_EMAILS: { name: string; raw: RawEmail; expectedCategory: string; expectedStage?: string }[] = [
  {
    name: "interview invitation",
    raw: makeRaw(
      "Interview Invitation - Backend Engineer at Acme",
      "Hi Jane, we'd like to invite you for a technical interview. Please let us know your availability for next week.",
      "talent@acme.com", "Acme Talent Team"
    ),
    expectedCategory: "interview-invitation",
    expectedStage: "interview",
  },
  {
    name: "rejection",
    raw: makeRaw(
      "Update on your application",
      "Dear Jane, we regret to inform you that we have decided not to move forward with your application at this time.",
      "noreply@designhub.com", "DesignHub Careers"
    ),
    expectedCategory: "rejection",
    expectedStage: "rejected",
  },
  {
    name: "job offer",
    raw: makeRaw(
      "Congratulations! Job Offer from CloudOps",
      "Dear Jane, we are pleased to offer you the position of Senior Engineer at CloudOps. Please find the offer details attached.",
      "hr@cloudops.io", "CloudOps HR"
    ),
    expectedCategory: "offer",
    expectedStage: "offer",
  },
  {
    name: "coding assessment",
    raw: makeRaw(
      "Coding Challenge - HackerRank",
      "You have been invited to complete a coding assessment on HackerRank for the Software Engineer role.",
      "noreply@hackerrank.com", "HackerRank"
    ),
    expectedCategory: "assessment",
    expectedStage: "screening",
  },
  {
    name: "application acknowledgment",
    raw: makeRaw(
      "Application Received",
      "Thank you for applying to Stripe. We have received your application and our team will review your qualifications.",
      "noreply@stripe.com", "Stripe Careers"
    ),
    expectedCategory: "acknowledgment",
    expectedStage: "applied",
  },
  {
    name: "recruiter outreach",
    raw: makeRaw(
      "Opportunity at a fast-growing startup",
      "Hi Jane, I'm a technical recruiter and I came across your profile. I have an opportunity that might interest you.",
      "sarah@techrecruit.co", "Sarah at TechRecruit"
    ),
    expectedCategory: "recruiter-outreach",
    expectedStage: "saved",
  },
  {
    name: "irrelevant email",
    raw: makeRaw(
      "Your newsletter subscription",
      "Here's this week's digest of the latest tech news and product updates.",
      "newsletter@techblog.com", "TechBlog Weekly"
    ),
    expectedCategory: "irrelevant",
  },
];

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  Email Classifier Tests              ║");
  console.log("╚══════════════════════════════════════╝\n");

  console.log("── Classification (keyword layer, no LLM) ──");

  const classified = [];
  for (const test of TEST_EMAILS) {
    const email = await classifyEmail(test.raw); // no LLM = free + offline
    check(
      `${test.name} → ${test.expectedCategory}`,
      email.category === test.expectedCategory,
      `(got ${email.category}, conf=${email.confidence.toFixed(2)})`
    );
    if (test.expectedStage) {
      check(
        `${test.name} stage → ${test.expectedStage}`,
        email.newStage === test.expectedStage,
        `(got ${email.newStage})`
      );
    }
    if (email.category !== "irrelevant") {
      classified.push(email);
      console.log(`     "${email.subject.slice(0, 50)}…" → ${email.summary}`);
    }
  }

  // entity extraction
  console.log("\n── Entity extraction ──");
  const offerEmail = await classifyEmail(TEST_EMAILS[2].raw);
  check("company extracted from offer", offerEmail.company !== undefined && offerEmail.company.length > 0, `(${offerEmail.company})`);

  const interviewEmail = await classifyEmail(TEST_EMAILS[0].raw);
  check("company extracted from interview", interviewEmail.company !== undefined, `(${interviewEmail.company})`);

  // tracker sync
  console.log("\n── Tracker sync ──");

  // seed an existing application for matching
  const seedApps: Application[] = [
    {
      id: "app_existing",
      jobId: "job_1",
      url: "https://acme.com/jobs/1",
      title: "Backend Engineer",
      company: "Acme",
      stage: "applied",
      notes: "",
      appliedAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
      matchScore: 85,
    } as Application,
  ];
  memStore["applications"] = seedApps;

  // sync the interview email → should update the existing Acme application
  const interviewUpdate = await syncEmailToTracker(interviewEmail);
  check("interview matched existing app", interviewUpdate.matchedApplication !== undefined);
  check("interview updated stage to interview",
    interviewUpdate.matchedApplication?.newStage === "interview",
    `(${interviewUpdate.matchedApplication?.newStage})`
  );
  check("interview not created (matched)", interviewUpdate.created === false);

  // sync the offer email from a NEW company → should create a new application
  const offerUpdate = await syncEmailToTracker(offerEmail);
  check("offer from new company created app", offerUpdate.created === true);
  check("offer created with offer stage",
    offerUpdate.matchedApplication?.newStage === "offer",
    `(${offerUpdate.matchedApplication?.newStage})`
  );

  // sync rejection for existing Acme app (should update, not create)
  const rejectionEmail = await classifyEmail(TEST_EMAILS[1].raw); // DesignHub rejection
  const rejectionUpdate = await syncEmailToTracker(rejectionEmail);
  // DesignHub is not in our tracker → should create if it's a positive signal
  // rejection is NOT a positive signal → no creation
  check("rejection from unknown company not created", rejectionUpdate.created === false || rejectionUpdate.matchedApplication === undefined);

  // verify the tracker now has the updated Acme app
  const finalApps = memStore["applications"] as Application[];
  const acmeApp = finalApps.find((a) => a.id === "app_existing");
  check("Acme app stage updated in store", acmeApp?.stage === "interview", `(${acmeApp?.stage})`);
  check("Acme app has notes", acmeApp?.notes.includes("interview") || acmeApp?.notes.includes("Interview"));

  console.log(`\n${"═".repeat(40)}`);
  console.log(`  Email Monitor: ${pass} passed, ${fail} failed`);
  console.log(`${"═".repeat(40)}\n`);

  if (fail > 0) { process.exitCode = 1; throw new Error(`${fail} email assertions failed`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
