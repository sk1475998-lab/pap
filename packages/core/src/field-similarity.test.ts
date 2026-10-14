import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFieldText,
  tokenizeFieldText,
  jaroWinklerSimilarity,
  bigramDiceSimilarity,
  tokenJaccardSimilarity,
  blendedSimilarity,
  findBestMatch,
  bestOptionMatch,
} from "./field-similarity.js";

test("normalizeFieldText trims, collapses whitespace/underscores, lowercases", () => {
  assert.equal(normalizeFieldText("  What_is_your_name ?  "), "what is your name ?");
  assert.equal(normalizeFieldText("Full-Name"), "full name");
  assert.equal(normalizeFieldText("Ada", true), "Ada");
});

test("tokenizeFieldText drops stopwords and short tokens", () => {
  const toks = tokenizeFieldText("Do you have a valid work authorization?");
  assert.ok(toks.includes("valid"));
  assert.ok(toks.includes("authorization"));
  assert.ok(!toks.includes("do")); // stopword
  assert.ok(!toks.includes("a")); // stopword + length 1
  assert.ok(!toks.some((t) => t.length < 2));
});

test("jaroWinklerSimilarity handles equality, transposition, dissimilarity", () => {
  assert.equal(jaroWinklerSimilarity("martha", "martha"), 1);
  assert.ok(jaroWinklerSimilarity("martha", "marhta") > 0.9); // classic transposition
  assert.ok(jaroWinklerSimilarity("martha", "marhta") > jaroWinklerSimilarity("martha", "marhxx"));
  assert.equal(jaroWinklerSimilarity("", "x"), 0);
  assert.ok(jaroWinklerSimilarity("dwayne", "duane") > 0.7); // classic Jaro pair
});

test("jaroWinkler prefix boost rewards common prefixes", () => {
  const boost = jaroWinklerSimilarity("developer", "development");
  const noBoost = jaroWinklerSimilarity("developer", "redevelope");
  assert.ok(boost > noBoost);
});

test("bigramDiceSimilarity counts shared character bigrams", () => {
  assert.equal(bigramDiceSimilarity("night", "nacht"), 0.25);
  assert.equal(bigramDiceSimilarity("night", "night"), 1);
  // identical short string with no bigrams still equals 1 (handled)
  assert.equal(bigramDiceSimilarity("a", "a"), 1);
  assert.equal(bigramDiceSimilarity("a", "b"), 0);
});

test("tokenJaccardSimilarity measures word-set overlap", () => {
  assert.equal(tokenJaccardSimilarity("full stack engineer", "full stack engineer"), 1);
  const half = tokenJaccardSimilarity("frontend developer", "backend developer");
  assert.equal(half, 1 / 3); // shared token: developer
  assert.equal(tokenJaccardSimilarity("software engineer", "data scientist"), 0);
});

test("blendedSimilarity stays in [0,1] and orders obvious cases", () => {
  assert.equal(blendedSimilarity("desired salary", "desired salary"), 1);
  assert.ok(blendedSimilarity("salary expectation", "desired salary") > blendedSimilarity("salary expectation", "github profile"));
  assert.ok(blendedSimilarity("are you authorized to work in the us", "do you now or in the future require visa sponsorship") > 0);
});

test("findBestMatch returns exact short-circuit then best above threshold", () => {
  const cands = ["Desired salary", "Current salary", "GitHub profile", "LinkedIn profile"];
  const exact = findBestMatch("GitHub profile", cands, (c) => c, { threshold: 0.6 });
  assert.equal(exact.match, "GitHub profile");
  assert.equal(exact.score, 1);

  const fuzzy = findBestMatch("Github profle", cands, (c) => c, { threshold: 0.6 }); // typo
  assert.equal(fuzzy.match, "GitHub profile");

  const none = findBestMatch("favorite color", cands, (c) => c, { threshold: 0.6 });
  assert.equal(none.match, undefined);
  assert.ok(none.score < 0.6);
});

test("findBestMatch ranks all candidates best-first", () => {
  const cands = ["Current CTC", "Current salary", "Expected salary"];
  const res = findBestMatch("current compensation", cands, (c) => c, { threshold: 0 });
  assert.ok(res.ranked.length === 3);
  assert.ok(res.ranked[0].score >= res.ranked[1].score);
  assert.ok(res.ranked[1].score >= res.ranked[2].score);
});

test("bestOptionMatch maps canonical value onto ATS phrasing", () => {
  const options = [
    { label: "United States of America", value: "US" },
    { label: "India", value: "IN" },
    { label: "United Kingdom", value: "UK" },
  ];
  const res = bestOptionMatch("United States", options, 0.72);
  assert.equal(res.option?.value, "US");
  const no = bestOptionMatch("Australia", options, 0.72);
  assert.equal(no.option, undefined);
});

test("bestOptionMatch considers the option value too", () => {
  const options = [{ label: "The Netherlands", value: "NL" }, { label: "Nepal", value: "NP" }];
  // "NL" is not close to "Netherlands" as text; but label should still win via token overlap
  const res = bestOptionMatch("Netherlands", options, 0.6);
  assert.equal(res.option?.value, "NL");
});
