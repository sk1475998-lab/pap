import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSemanticDiff, tokenizeWords, renderDiffHtml } from "./semantic-diff.js";

describe("Semantic Diff Engine (Myers Token Diff)", () => {
  it("tokenizes words and whitespace delimiters correctly", () => {
    const text = "Built scalable REST APIs using Node.js";
    const tokens = tokenizeWords(text);
    assert.deepEqual(tokens, ["Built", " ", "scalable", " ", "REST", " ", "APIs", " ", "using", " ", "Node.js"]);
  });

  it("handles identical texts with 100% similarity and unchanged spans", () => {
    const text = "Developed frontend components using React and TypeScript.";
    const res = computeSemanticDiff(text, text);
    assert.equal(res.stats.addedWords, 0);
    assert.equal(res.stats.removedWords, 0);
    assert.equal(res.stats.similarityRatio, 1);
    assert.ok(res.spans.every((s) => s.type === "unchanged"));
    assert.ok(!res.html.includes("diff-added"));
    assert.ok(!res.html.includes("diff-removed"));
  });

  it("detects added keywords and renders green highlight marks", () => {
    const original = "Built microservices using Python and Docker.";
    const tailored = "Built scalable microservices using Python, FastAPI, and Docker in AWS.";

    const res = computeSemanticDiff(original, tailored);
    assert.ok(res.stats.addedWords > 0);
    assert.ok(res.spans.some((s) => s.type === "added" && s.text.includes("FastAPI")));

    // Verify rich green HTML rendering
    assert.ok(res.html.includes('class="diff-added"'));
    assert.ok(res.html.includes("background-color: rgba(16, 185, 129, 0.18)"));
    assert.ok(res.html.includes("FastAPI"));
  });

  it("detects removed words with red strikethrough", () => {
    const original = "Managed a legacy codebase with PHP.";
    const tailored = "Managed a modern codebase with TypeScript.";

    const res = computeSemanticDiff(original, tailored);
    assert.ok(res.stats.removedWords > 0);
    assert.ok(res.stats.addedWords > 0);

    // Verify removed formatting
    assert.ok(res.html.includes('class="diff-removed"'));
    assert.ok(res.html.includes("line-through"));
  });

  it("handles empty strings gracefully", () => {
    const resEmpty = computeSemanticDiff("", "");
    assert.deepEqual(resEmpty.spans, []);
    assert.equal(resEmpty.stats.similarityRatio, 1);

    const resAdded = computeSemanticDiff("", "New text added");
    assert.equal(resAdded.spans[0]?.type, "added");
    assert.equal(resAdded.stats.addedWords, 3);
    assert.ok(resAdded.html.includes('class="diff-added"'));
  });
});
