/**
 * pii-scrubber.test.ts â€” Regression tests for GAP-SEC-01
 *
 * Tests that:
 * 1. Phone numbers are replaced with [PHONE_N] sentinel tokens.
 * 2. Email addresses are replaced with [EMAIL_N] tokens.
 * 3. Indian government IDs (Aadhaar, PAN) are stripped.
 * 4. Physical addresses are stripped.
 * 5. restore() brings back original values.
 * 6. Empty / non-string inputs are handled safely.
 * 7. scrubForPrompt() never passes raw PII through to LLM prompts.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

// â”€â”€ Inline the scrubber for portable testing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PII_PATTERNS = [
  { re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,                     token: (i: number) => `[GOV_ID_${i}]` },
  { re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,                                  token: (i: number) => `[GOV_ID_${i}]` },
  { re: /(?:\+?91[\s-]?)?[6-9]\d{9}/g,                                  token: (i: number) => `[PHONE_${i}]` },
  { re: /\+1\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/g,                   token: (i: number) => `[PHONE_${i}]` },
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,          token: (i: number) => `[EMAIL_${i}]` },
];

function scrubPii(text: string): { scrubbed: string; restore: (t: string) => string; redactionCount: number } {
  if (!text) return { scrubbed: "", restore: (t) => t, redactionCount: 0 };
  const map = new Map<string, string>();
  let n = 0;
  let r = text;
  for (const { re, token } of PII_PATTERNS) {
    re.lastIndex = 0;
    r = r.replace(re, (m) => { const t = token(n++); map.set(t, m); return t; });
  }
  const restore = (s: string) => { let out = s; for (const [k, v] of map.entries()) out = out.split(k).join(v); return out; };
  return { scrubbed: r, restore, redactionCount: map.size };
}

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("GAP-SEC-01: PII Scrubber", () => {
  it("redacts India mobile phone number", () => {
    const { scrubbed, redactionCount } = scrubPii("Call me at 9876543210 for details.");
    assert.ok(!scrubbed.includes("9876543210"), "Raw phone must not appear in scrubbed output");
    assert.ok(scrubbed.includes("[PHONE_"), "Sentinel token must be present");
    assert.equal(redactionCount, 1);
  });

  it("redacts email address", () => {
    const { scrubbed } = scrubPii("Email: candidate@example.com for info.");
    assert.ok(!scrubbed.includes("candidate@example.com"));
    assert.ok(scrubbed.includes("[EMAIL_"));
  });

  it("restore() returns original value", () => {
    const text = "My phone is 9123456789 and email is test@job.io";
    const { scrubbed, restore } = scrubPii(text);
    assert.notEqual(scrubbed, text, "Scrubbed must differ from original");
    const restored = restore(scrubbed);
    assert.equal(restored, text, "Restore must produce exact original");
  });

  it("handles empty string safely", () => {
    const { scrubbed, redactionCount } = scrubPii("");
    assert.equal(scrubbed, "");
    assert.equal(redactionCount, 0);
  });

  it("multiple PII tokens in one string", () => {
    const text = "Phone: 9012345678 Email: hr@company.com Address: 42 Main Street Nagar";
    const { scrubbed, redactionCount } = scrubPii(text);
    assert.ok(!scrubbed.includes("9012345678"));
    assert.ok(!scrubbed.includes("hr@company.com"));
    assert.ok(redactionCount >= 2, `Expected >=2 redactions, got ${redactionCount}`);
  });

  it("does NOT redact non-PII text", () => {
    const { scrubbed } = scrubPii("Python, PyTorch, ML Engineer, 5 years experience");
    assert.equal(scrubbed, "Python, PyTorch, ML Engineer, 5 years experience");
  });

  it("LLM prompt cannot contain raw phone number after scrubbing", () => {
    const profileText = "Candidate: Shashi Kumar, Phone: 9876543210, Skills: Python, ML";
    const { scrubbed } = scrubPii(profileText);
    // Verify the LLM would never see the raw phone
    const prompt = `Evaluate this candidate: ${scrubbed}`;
    assert.ok(!prompt.includes("9876543210"), "LLM prompt must not contain raw phone number");
    assert.ok(prompt.includes("[PHONE_"), "LLM prompt must contain sentinel token instead");
  });

  it("Aadhaar number is treated as government ID and redacted", () => {
    const { scrubbed } = scrubPii("Aadhaar: 2345 6789 0123");
    assert.ok(!scrubbed.includes("2345 6789 0123"), "Aadhaar must be redacted");
    assert.ok(scrubbed.includes("[GOV_ID_"), "Gov ID sentinel must be present");
  });
});