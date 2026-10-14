import test from "node:test";
import assert from "node:assert/strict";
import { textToPdf } from "./pdf-generator.js";
import { pdfToText } from "./parser.js";

test("textToPdf produces a valid PDF-1.4 binary buffer", () => {
  const text = "Shashi Kumar Banoth\nSenior AI Platform Engineer\nSkills: Python, PyTorch, React, TypeScript";
  const pdfBytes = textToPdf(text);

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 200, "PDF should have substantial length");

  const str = new TextDecoder("ascii").decode(pdfBytes);
  assert.ok(str.startsWith("%PDF-1.4"), "Must begin with %PDF-1.4 header");
  assert.ok(str.includes("trailer"), "Must contain trailer dictionary");
  assert.ok(str.includes("startxref"), "Must contain startxref pointer");
  assert.ok(str.trim().endsWith("%%EOF"), "Must terminate with %%EOF");
});

test("pdfToText can extract text roundtrip from generated PDF", async () => {
  const sample = "Tailored Resume for Google DeepMind\nExperience with Agentic LLM Orchestration and PyTorch.";
  const pdfBytes = textToPdf(sample);

  const extracted = await pdfToText(pdfBytes);
  assert.ok(extracted.includes("Tailored Resume for Google DeepMind"));
  assert.ok(extracted.includes("Experience with Agentic LLM Orchestration"));
});

test("pdfToText leaves its input bytes available for OCR fallback", async () => {
  const pdfBytes = textToPdf("A short text-poor PDF for the OCR fallback.");
  const originalLength = pdfBytes.byteLength;

  const firstExtraction = await pdfToText(pdfBytes);
  assert.ok(firstExtraction.includes("short text-poor PDF"));
  assert.equal(pdfBytes.byteLength, originalLength);

  const secondExtraction = await pdfToText(pdfBytes);
  assert.ok(secondExtraction.includes("short text-poor PDF"));
});

test("textToPdf handles multi-page long resume content", () => {
  // Generate 200 lines to force pagination
  const lines = Array.from({ length: 200 }, (_, i) => `Project item #${i + 1}: Built high-scale microservices with Python and Kubernetes.`);
  const fullText = lines.join("\n");
  const pdfBytes = textToPdf(fullText);

  const str = new TextDecoder("ascii").decode(pdfBytes);
  assert.ok(str.includes("/Count 4") || str.includes("/Count 5") || str.includes("/Count 6"), "Must create multiple pages");
});

test("textToPdf safely escapes parentheses and backslashes", async () => {
  const tricky = "Experience with C++ (advanced) and Regex (e.g. \\d+).";
  const pdfBytes = textToPdf(tricky);

  const extracted = await pdfToText(pdfBytes);
  assert.ok(extracted.includes("Experience with C++ (advanced)"));
});
