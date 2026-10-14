import assert from "node:assert/strict";
import test from "node:test";
import { VisionFallback } from "./vision-fallback.js";

test("VisionFallback resolves models dynamically per provider", () => {
  const geminiVision = new VisionFallback({
    provider: "gemini",
    apiKey: "test-key",
  });
  // @ts-expect-error accessing private method for verification
  assert.equal(geminiVision.getModel(), "gemini-2.0-flash");

  const customGemini = new VisionFallback({
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKey: "test-key",
  });
  // @ts-expect-error accessing private method for verification
  assert.equal(customGemini.getModel(), "gemini-2.5-flash");

  const openAiVision = new VisionFallback({
    provider: "openai",
    apiKey: "test-key",
  });
  // @ts-expect-error accessing private method for verification
  assert.equal(openAiVision.getModel(), "gpt-4o-mini");
});

test("VisionFallback extracts coordinates from Markdown codeblocks and text preambles", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Mock fetch returning conversational text with markdown code block
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "I found the submit button here:\n```json\n{\n  \"x\": 720.4,\n  \"y\": 850.8\n}\n```\nIt is clearly visible.",
                  },
                ],
              },
            },
          ],
        }),
      } as any;
    };

    const vision = new VisionFallback({
      provider: "gemini",
      apiKey: "test-key",
    });

    const mockPage = {
      viewportSize: () => ({ width: 1440, height: 900 }),
      screenshot: async () => Buffer.from("fake-png-data"),
    } as any;

    const coords = await vision.findCoordinates(mockPage, "Submit button");
    assert.ok(coords);
    assert.equal(coords?.x, 720);
    assert.equal(coords?.y, 851);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VisionFallback clamps coordinates exceeding viewport bounds", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Mock coordinates outside viewport bounds
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"x": 1600, "y": -50}',
              },
            },
          ],
        }),
      } as any;
    };

    const vision = new VisionFallback({
      provider: "openai",
      apiKey: "test-key",
    });

    const mockPage = {
      viewportSize: () => ({ width: 1440, height: 900 }),
      screenshot: async () => Buffer.from("fake-png-data"),
    } as any;

    const coords = await vision.findCoordinates(mockPage, "Submit button");
    assert.ok(coords);
    assert.equal(coords?.x, 1440); // clamped to max width
    assert.equal(coords?.y, 0);    // clamped to min height
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("VisionFallback returns null when target cannot be located or is malformed", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"error": "NOTFOUND"}' }],
              },
            },
          ],
        }),
      } as any;
    };

    const vision = new VisionFallback({
      provider: "gemini",
      apiKey: "test-key",
    });

    const mockPage = {
      viewportSize: () => ({ width: 1440, height: 900 }),
      screenshot: async () => Buffer.from("fake-png-data"),
    } as any;

    const coords = await vision.findCoordinates(mockPage, "Submit button");
    assert.equal(coords, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
