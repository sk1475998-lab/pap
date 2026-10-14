import test from "node:test";
import assert from "node:assert/strict";
import {
  LINKEDIN_NO_RESULTS_SELECTORS,
  LINKEDIN_RESULTS_STRATEGIES,
  pickLinkedInResultsVersion,
  summarizeLinkedInResults,
  linkedInResultsContainerSelectors,
  parseLinkedInRelativeDate,
  parseLinkedInAbsoluteDate,
} from "./linkedin-results.js";

test("no-results selector catalog is non-empty and includes canonical classes", () => {
  assert.ok(LINKEDIN_NO_RESULTS_SELECTORS.length >= 3);
  assert.ok(LINKEDIN_NO_RESULTS_SELECTORS.includes(".jobs-search-no-results-banner"));
  assert.ok(LINKEDIN_NO_RESULTS_SELECTORS.includes(".no-results"));
});

test("results strategy catalog spans versions 1..4 with unique labels", () => {
  assert.equal(LINKEDIN_RESULTS_STRATEGIES.length, 4);
  const versions = LINKEDIN_RESULTS_STRATEGIES.map((s) => s.version);
  assert.deepEqual(versions, [1, 2, 3, 4]);
  assert.equal(new Set(LINKEDIN_RESULTS_STRATEGIES.map((s) => s.label)).size, 4);
  for (const s of LINKEDIN_RESULTS_STRATEGIES) {
    assert.ok(s.container.length > 0 && s.card.length > 0);
  }
});

test("pickLinkedInResultsVersion picks the first present layout (priority order)", () => {
  assert.equal(pickLinkedInResultsVersion({ legacyList: true, loggedInList: true, feedModule: true, aiSearch: true }), 1);
  assert.equal(pickLinkedInResultsVersion({ legacyList: false, loggedInList: true, feedModule: true, aiSearch: true }), 2);
  assert.equal(pickLinkedInResultsVersion({ legacyList: false, loggedInList: false, feedModule: true, aiSearch: false }), 3);
  assert.equal(pickLinkedInResultsVersion({ legacyList: false, loggedInList: false, feedModule: false, aiSearch: true }), 4);
  assert.equal(pickLinkedInResultsVersion({ legacyList: false, loggedInList: false, feedModule: false, aiSearch: false }), 0);
});

test("summarizeLinkedInResults reports no-results page distinctly from empty list", () => {
  const noRes = summarizeLinkedInResults({ legacyList: false, loggedInList: false, feedModule: false, aiSearch: false, noResultsPresent: true, cardCount: 0 });
  assert.deepEqual(noRes, { count: 0, listFound: false, version: 0 });

  const withCards = summarizeLinkedInResults({ legacyList: true, loggedInList: false, feedModule: false, aiSearch: false, noResultsPresent: false, cardCount: 7 });
  assert.deepEqual(withCards, { count: 7, listFound: true, version: 1 });

  const emptyList = summarizeLinkedInResults({ legacyList: true, loggedInList: false, feedModule: false, aiSearch: false, noResultsPresent: false, cardCount: 0 });
  assert.equal(emptyList.listFound, true); // layout found, zero items is valid
  assert.equal(emptyList.count, 0);
});

test("container selector helper unions classic + logged-in lists", () => {
  const sels = linkedInResultsContainerSelectors();
  assert.ok(sels.includes(".jobs-search-results-list"));
  assert.ok(sels.some((s) => s.includes("data-occludable-job-id")));
});

test("relative dates parse to sensible epochs", () => {
  const now = 1_700_000_000_000;
  const day = 86_400_000;
  assert.equal(parseLinkedInRelativeDate("2 days ago", now), now - 2 * day);
  assert.equal(parseLinkedInRelativeDate("1 week ago", now), now - 7 * day);
  assert.equal(parseLinkedInRelativeDate("3 months ago", now), now - 90 * day);
  assert.equal(parseLinkedInRelativeDate("5 hours ago", now), now - 5 * 3_600_000);
  assert.equal(parseLinkedInRelativeDate("Just now", now), now);
  assert.equal(parseLinkedInRelativeDate("Posted 2 days ago", now), now - 2 * day);
  assert.equal(parseLinkedInRelativeDate("unknown", now), 0);
  // case-insensitive
  assert.equal(parseLinkedInRelativeDate("30+ DAYS AGO", now), now - 30 * day);
});

test("absolute dates parse to epoch ms", () => {
  const d = new Date(2026, 7, 12); // 2026-08-12 local
  assert.equal(parseLinkedInAbsoluteDate("Posted on 2026-08-12"), d.getTime());
  assert.equal(parseLinkedInAbsoluteDate("2026/08/12"), d.getTime());
  assert.equal(parseLinkedInAbsoluteDate("n/a"), 0);
});
