import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, "interview_mastery_guide.html");

const OUTPUT_PATHS = [
  "c:/Users/shash/Downloads/SuperJobAgent_v0.1.5-full-source/SuperJobAgent_Complete_Architecture_and_Interview_Mastery_Guide.pdf",
  "c:/Users/shash/Downloads/SuperJobAgent_v0.1.5-full-source/SuperJobAgent_v0.1.2/SuperJobAgent_Complete_Architecture_and_Interview_Mastery_Guide.pdf"
];

async function main() {
  console.log("Reading HTML from:", HTML_FILE);
  const htmlContent = fs.readFileSync(HTML_FILE, "utf-8");

  console.log("Launching headless browser via Playwright...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("Loading HTML content into page...");
  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  for (const outPath of OUTPUT_PATHS) {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log(`Generating PDF to: ${outPath}...`);
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        bottom: "20mm",
        left: "16mm",
        right: "16mm",
      },
    });
    console.log(`Successfully generated: ${outPath} (${fs.statSync(outPath).size} bytes)`);
  }

  await browser.close();
  console.log("DONE! Both PDFs successfully generated.");
}

main().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
