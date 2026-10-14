import test from "node:test";
import assert from "node:assert/strict";
import {
  LINKEDIN_DAILY_LIMIT_PHRASES,
  normalizeUiText,
  detectLimitWall,
  detectLinkedInDailyLimit,
  detectLimitWallInElements,
  createStallWatchdog,
} from "./session-guardrails.js";

test("phrase table is non-empty and every phrase is pre-normalized", () => {
  assert.ok(LINKEDIN_DAILY_LIMIT_PHRASES.length >= 8);
  for (const p of LINKEDIN_DAILY_LIMIT_PHRASES) {
    assert.equal(p, normalizeUiText(p), `phrase should be pre-normalized: "${p}"`);
    assert.ok(p.length >= 3);
  }
});

test("normalizeUiText folds case, curly apostrophes, punctuation and whitespace", () => {
  assert.equal(normalizeUiText("You've reached today's Easy Apply limit!"),
    "you ve reached today s easy apply limit");
  assert.equal(normalizeUiText("Great effort applying today."), "great effort applying today");
  assert.equal(normalizeUiText("  Daily\n\t Easy\tApply — limit  "), "daily easy apply limit");
  // Typographic curly apostrophe (U+2019)
  assert.equal(normalizeUiText("today\u2019s"), "today s");
  // Benign input that must not throw
  assert.equal(normalizeUiText(""), "");
  assert.equal(normalizeUiText("  --  "), "");
});

test("detectLinkedInDailyLimit hits the canonical wall headline", () => {
  const body =
    "Great effort applying today! You've reached today's Easy Apply limit. " +
    "LinkedIn limits the number of applications you can submit per day. " +
    "Save this job and continue applying tomorrow.";
  const d = detectLinkedInDailyLimit(body);
  assert.equal(d.hit, true);
  assert.ok(d.matchedPhrase && d.matchedPhrase.length > 0);
});

test("detectLimitWall is case- and punctuation-robust on modal text", () => {
  // Modal excerpt with curly apostrophe and mixed case.
  const modal = "You\u2019ve reached today\u2019s Easy Apply limit (~50-100 per day).";
  const d = detectLimitWall(modal);
  assert.equal(d.hit, true);
  assert.equal(d.matchedPhrase, "you ve reached today s easy apply limit");
});

test("detectLimitWall does not false-positive on normal job/apply copy", () => {
  const benign = [
    "Apply now and submit your application today — we review daily.",
    "Easy Apply lets you send your resume quickly. No limit on applications.",
    "This job requires 5 years of experience. Submit before Friday.",
    "We limit reviews to two per day" /* 'limit' + 'daily' alone must not match */,
    "application",
    "Apply",
  ];
  for (const t of benign) {
    assert.equal(detectLimitWall(t).hit, false, `false positive on: "${t}"`);
  }
});

test("detectLimitWall reports hit with a custom phrase table", () => {
  const custom = ["portal is down for maintenance"];
  assert.equal(detectLimitWall("Portal is DOWN for maintenance.", custom).hit, true);
  assert.equal(detectLimitWall("portal maintenance window", custom).hit, false);
});

test("detectLimitWallInElements scans a list and returns first hit", () => {
  const d = detectLimitWallInElements([
    "Some unrelated panel text",
    "Great effort applying today!",
    "and also: exceeded the daily application limit",
  ]);
  assert.equal(d.hit, true);
  assert.equal(d.matchedPhrase, "great effort applying today");
});

test("stall watchdog reports stall only after silence budget and fires once per episode", () => {
  let clock = 0;
  let fired = 0;
  const w = createStallWatchdog({ stallMs: 50, now: () => clock, onStall: () => fired++ });

  assert.equal(w.isStalled(), false); // not yet past budget
  clock = 40;
  assert.equal(w.isStalled(), false);
  clock = 60; // 60ms idle > 50ms budget
  assert.equal(w.isStalled(), true);
  assert.equal(fired, 1);
  // Repeated polls do not re-fire the same episode.
  clock = 120;
  assert.equal(w.isStalled(), true);
  assert.equal(fired, 1);

  // A tick re-arms: next silence is a new episode.
  w.tick();
  clock = 150; // 30ms after tick
  assert.equal(w.isStalled(), false);
  clock = 250; // 100ms after tick
  assert.equal(w.isStalled(), true);
  assert.equal(fired, 2);
});

test("stall watchdog tick resets idle and stop() disables permanently", () => {
  let clock = 0;
  const w = createStallWatchdog({ stallMs: 100, now: () => clock });
  clock = 50;
  w.tick();
  assert.equal(w.idleMs(), 0);
  clock = 55;
  assert.equal(w.idleMs(), 5);
  w.stop();
  clock = 10_000;
  assert.equal(w.isStalled(), false);
  assert.equal(w.idleMs(), 9_950); // stop() disables verdicts but clock keeps counting
});

test("stall watchdog onStall exception cannot break polling", () => {
  let clock = 0;
  const w = createStallWatchdog({
    stallMs: 10,
    now: () => clock,
    onStall: () => {
      throw new Error("observer bug");
    },
  });
  clock = 100;
  assert.equal(w.isStalled(), true); // still reports stall despite observer throw
  clock = 200;
  assert.equal(w.isStalled(), true);
});
