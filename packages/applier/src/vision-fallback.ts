import type { Page } from "playwright";
import type { LLMProvider } from "@superjob/core";

export interface ElementCoordinates {
  x: number;
  y: number;
}

export interface VisionLLMConfig {
  provider: LLMProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export class VisionFallback {
  private llmConfig: VisionLLMConfig;

  constructor(llmConfig: VisionLLMConfig) {
    this.llmConfig = llmConfig;
  }

  private getModel(): string {
    if (this.llmConfig.model) return this.llmConfig.model;
    return this.llmConfig.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";
  }

  /**
   * Identifies an element matching the purpose by analyzing a page screenshot.
   *
   * FIX: Now uses `fullPage: true` so elements below the fold (e.g. Submit
   * buttons at the bottom of long job application forms) are captured.
   * The previous `fullPage: false` made > 90% of real submit buttons invisible.
   *
   * Also attempts a pre-LLM accessibility-tree scan first using Playwright's
   * built-in `getByRole` / `getByLabel` locators — zero-hallucination and free.
   *
   * LLM selectors are validated to match at least one element before returning.
   *
   * Returns a CSS selector or null.
   */
  async findElementSelector(page: Page, purpose: string): Promise<string | null> {
    // Pre-LLM pass: try aria-based locators that are reliable and zero-cost
    const ariaGuess = await this.tryAriaFallback(page, purpose);
    if (ariaGuess) return ariaGuess;

    if (!this.llmConfig.apiKey) {
      console.warn("Vision Fallback: No API Key configured for vision provider.");
      return null;
    }

    try {
      // CRITICAL FIX: fullPage: true so below-fold elements appear in screenshot
      const screenshot = await page.screenshot({ type: "png", fullPage: true });
      const base64Image = screenshot.toString("base64");

      const prompt = `This is a FULL-PAGE screenshot of a job application form.
Identify the HTML element that serves as the: "${purpose}".
IMPORTANT: The element may be below the initially visible area. Analyze the ENTIRE page.
Return ONLY a valid CSS selector string that uniquely identifies the target element.
Prefer attribute-based selectors (aria-label, data-*, type, name) over class-based ones.
If the element is not found, return "NOTFOUND".
Return only the selector string without any markdown formatting or quotes.`;

      let selector = "";
      const model = this.getModel();

      if (this.llmConfig.provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.llmConfig.apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          selector = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        } else {
          console.error("Gemini Vision API error:", response.status, await response.text());
        }
      } else {
        const url = this.llmConfig.baseUrl || "https://api.openai.com/v1";
        const response = await fetch(`${url}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.llmConfig.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${base64Image}` },
                  },
                ],
              },
            ],
            temperature: 0.1,
            max_tokens: 100,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          selector = data?.choices?.[0]?.message?.content?.trim() ?? "";
        } else {
          console.error("OpenAI compatible Vision API error:", response.status, await response.text());
        }
      }

      if (selector === "NOTFOUND" || !selector) return null;

      // Validate the selector actually matches an element before returning
      const cleanSelector = selector.replace(/`/g, "").trim();
      try {
        const count = await page.locator(cleanSelector).count();
        if (count === 0) {
          console.warn(`Vision Fallback: LLM selector "${cleanSelector}" matched 0 elements.`);
          return null;
        }
      } catch {
        console.warn(`Vision Fallback: LLM returned invalid selector syntax: "${cleanSelector}"`);
        return null;
      }

      return cleanSelector;
    } catch (err) {
      console.error("Vision Fallback element resolution failed:", err);
      return null;
    }
  }

  /**
   * Pre-LLM accessibility-tree based element scan.
   * Playwright's getByRole / locators are exact, zero-hallucination, and fast.
   * Tried first based on common purpose keywords before hitting the LLM.
   */
  private async tryAriaFallback(page: Page, purpose: string): Promise<string | null> {
    const candidates: Array<() => import("playwright").Locator> = [];

    if (/submit|apply|next|continue|send/i.test(purpose)) {
      candidates.push(() => page.getByRole("button", { name: /submit|apply|next|continue|send application/i }));
    }
    if (/upload|resume|cv/i.test(purpose)) {
      candidates.push(() => page.locator('input[type="file"]'));
    }
    if (/email/i.test(purpose)) {
      candidates.push(() => page.locator('input[type="email"]'));
    }
    if (/phone|mobile/i.test(purpose)) {
      candidates.push(() => page.locator('input[type="tel"]'));
    }

    for (const fn of candidates) {
      try {
        const loc = fn();
        const count = await loc.count();
        if (count > 0) {
          const sel = await loc.first().evaluate((el: Element) => {
            if ((el as HTMLElement).id) return `#${(el as HTMLElement).id}`;
            if (el.getAttribute("aria-label")) return `[aria-label="${el.getAttribute("aria-label")}"]`;
            if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;
            if (el.getAttribute("type")) return `${el.tagName.toLowerCase()}[type="${el.getAttribute("type")}"]`;
            return el.tagName.toLowerCase();
          });
          return sel as string;
        }
      } catch {
        // continue to next candidate
      }
    }
    return null;
  }



  /**
   * Grounding enhancement: Finds the center (x, y) pixel coordinates of the target element.
   * Grounded vision models operate on pixel coordinates, not DOM class guesswork.
   */
  async findCoordinates(page: Page, purpose: string): Promise<ElementCoordinates | null> {
    if (!this.llmConfig.apiKey) {
      console.warn("Vision Fallback: No API Key configured for vision provider.");
      return null;
    }

    try {
      const viewport = page.viewportSize() || { width: 1440, height: 900 };
      const screenshot = await page.screenshot({ type: "png", fullPage: false });
      const base64Image = screenshot.toString("base64");

      const prompt = `This is a screenshot of a web form page.
The viewport dimensions are width: ${viewport.width}, height: ${viewport.height}.
Identify the element that serves as: "${purpose}".
Return ONLY a valid JSON object specifying the center pixel coordinates of this element in the viewport:
{"x": <integer>, "y": <integer>}
If the element cannot be located, return {"error": "NOTFOUND"}.
Do not include any explanation, markdown fences, or extra text.`;

      let responseText = "";
      const model = this.getModel();

      if (this.llmConfig.provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.llmConfig.apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 50,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        }
      } else {
        const url = this.llmConfig.baseUrl || "https://api.openai.com/v1";
        const response = await fetch(`${url}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.llmConfig.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${base64Image}` },
                  },
                ],
              },
            ],
            temperature: 0.0,
            max_tokens: 50,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          responseText = data?.choices?.[0]?.message?.content?.trim() ?? "";
        }
      }

      const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.x === "number" && typeof parsed.y === "number" && !isNaN(parsed.x) && !isNaN(parsed.y)) {
        const clampedX = Math.max(0, Math.min(viewport.width, Math.round(parsed.x)));
        const clampedY = Math.max(0, Math.min(viewport.height, Math.round(parsed.y)));
        return { x: clampedX, y: clampedY };
      }
      return null;
    } catch (err) {
      console.warn("Vision Fallback coordinate location failed:", err);
      return null;
    }
  }

  /**
   * Clicks an element using coordinate-based vision targeting with humanized mouse movement.
   */
  async clickElementByCoordinates(page: Page, purpose: string): Promise<boolean> {
    const coords = await this.findCoordinates(page, purpose);
    if (!coords) return false;
    try {
      await page.mouse.move(coords.x, coords.y, { steps: 8 });
      await page.mouse.click(coords.x, coords.y);
      return true;
    } catch (err) {
      console.error(`Failed to click coordinates (${coords.x}, ${coords.y}) for "${purpose}":`, err);
      return false;
    }
  }
}
