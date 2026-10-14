import { chromium } from "playwright";
import * as fs from "node:fs";

async function main() {
  const url = "https://mycareer.accenture.com?source=careers&JRID=ATCI-4822040-S1848439";
  console.log(`Inspecting Accenture Apply portal: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log(`Apply URL Status: ${res?.status()}`);
    console.log(`Current Destination URL: ${page.url()}`);

    await page.waitForTimeout(4000);

    const info = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox']")).map(el => ({
        tag: el.tagName,
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        id: el.id,
        role: el.getAttribute("role"),
        text: el.textContent?.trim().slice(0, 30),
      }));

      return {
        title: document.title,
        inputsCount: inputs.length,
        inputs: inputs.slice(0, 15),
      };
    });

    console.log(`Page Title: ${info.title}`);
    console.log(`Detected Form/Interactive Elements: ${info.inputsCount}`);
    console.log("Sample Elements:", JSON.stringify(info.inputs, null, 2));
  } catch (err: any) {
    console.error("Navigation error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
