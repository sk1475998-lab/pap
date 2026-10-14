import assert from "node:assert/strict";
import test from "node:test";
import { classifyEmail } from "./classifiers/classifier.js";
import type { RawEmail } from "./imap-client.js";

function makeRaw(overrides: Partial<RawEmail>): RawEmail {
  return {
    messageId: "msg-" + Math.random().toString(36).slice(2),
    from: "recruiter@google.com",
    fromName: "Google Careers",
    subject: "Update on your application",
    text: "Thank you for applying.",
    html: "",
    date: new Date(),
    ...overrides,
  };
}

test("classifyEmail identifies interview invitations and extracts company", async () => {
  const raw = makeRaw({
    from: "talent@stripe.com",
    fromName: "Stripe Recruiting",
    subject: "Interview with Stripe: Next Steps",
    text: "We would like to invite you to an interview for the Senior Backend Engineer role at Stripe.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "interview-invitation");
  assert.equal(classified.newStage, "interview");
  assert.equal(classified.company, "Stripe");
  assert.equal(classified.role, "Senior Backend Engineer");
});

test("classifyEmail identifies formal job offers", async () => {
  const raw = makeRaw({
    from: "hr@airbnb.com",
    fromName: "Airbnb HR Team",
    subject: "Job Offer: Software Engineer at Airbnb",
    text: "We are pleased to offer you the position of Software Engineer at Airbnb! Congratulations.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "offer");
  assert.equal(classified.newStage, "offer");
  assert.equal(classified.company, "Airbnb");
});

test("classifyEmail identifies rejections accurately", async () => {
  const raw = makeRaw({
    from: "no-reply@uber.com",
    fromName: "Uber Talent Acquisition",
    subject: "Your application to Uber",
    text: "Thank you for taking the time to speak with us. Unfortunately, we have decided not to move forward with your application at this time.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "rejection");
  assert.equal(classified.newStage, "rejected");
});

test("classifyEmail identifies technical coding assessments", async () => {
  const raw = makeRaw({
    from: "notifications@hackerrank.com",
    fromName: "HackerRank Notifications",
    subject: "Complete your coding challenge for Datadog",
    text: "Please complete the following technical assessment on HackerRank within 48 hours.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "assessment");
  assert.equal(classified.newStage, "screening");
});

test("classifyEmail identifies application receipt acknowledgments", async () => {
  const raw = makeRaw({
    from: "jobs@github.com",
    fromName: "GitHub Careers",
    subject: "We received your application!",
    text: "Thank you for applying to GitHub. Your application has been received and our team will review your resume.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "acknowledgment");
  assert.equal(classified.newStage, "applied");
});

test("classifyEmail filters out irrelevant marketing and non-job emails", async () => {
  const raw = makeRaw({
    from: "newsletter@medium.com",
    fromName: "Medium Daily Digest",
    subject: "Top stories for you today: The future of AI",
    text: "Here are 5 articles recommended based on your reading history.",
  });

  const classified = await classifyEmail(raw);
  assert.equal(classified.category, "irrelevant");
  assert.equal(classified.newStage, undefined);
});
