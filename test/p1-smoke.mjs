/**
 * P1 smoke tests — asserts P1 additions are present in the built bundle and UI.
 */
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve("packages/extension/.output/chrome-mv3");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json", ".mjs": "text/javascript",
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/popup.html";
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (e, d) => {
        if (e) { res.writeHead(404); return res.end(e.message); }
        res.writeHead(200, { "content-type": MIME[path.extname(fp)] || "application/octet-stream" });
        res.end(d);
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
}

async function run() {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });

  // 1. Files
  for (const f of ["demo-job.html", "content-scripts/demo.js"]) {
    record(`bundle present: ${f}`, fs.existsSync(path.join(ROOT, f)));
  }

  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  record("manifest: version is 0.1.2 (autopilot fixes)", mf.version === "0.1.2");
  record("manifest: commands present (autofill-page + open-popup)",
    !!mf.commands?.["autofill-page"] && !!mf.commands?.["open-popup"]);

  // 2. Sidepanel SVG icons (no emoji in nav labels)
  const ctx = await browser.newContext();
  const sp = await ctx.newPage();
  // stub chrome.* for sidepanel
  await sp.addInitScript(() => {
    window.chrome = {
      runtime: {
        sendMessage: () => Promise.reject(new Error("stub")),
        getURL: (p) => "/" + p.replace(/^\//, ""),
        id: "test",
        onMessage: { addListener() {} },
      },
      tabs: {
        query: () => Promise.resolve([{ url: "https://www.linkedin.com/jobs/view/1", id: 1 }]),
      },
      storage: {
        local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
        session: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
      },
      sidePanel: {},
      action: {},
    };
  });
  const spErrors = [];
  sp.on("pageerror", (e) => spErrors.push(e.message));
  await sp.goto(base + "/sidepanel.html", { waitUntil: "load" });
  await sp.waitForTimeout(500);
  const navLabels = await sp.$$eval("nav button", (bs) => bs.map((b) => b.textContent.trim()));
  record("sidepanel: 4 nav tabs present", navLabels.length === 4, `got ${navLabels.length}`);
  // none should start with an emoji char
  const hasEmojiNav = navLabels.some((t) => /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(t));
  record("sidepanel: nav uses SVG icons (no emoji)", !hasEmojiNav, navLabels.join(","));

  const autofillBtn = await sp.$("button");
  const autofillText = await autofillBtn?.textContent() ?? "";
  record("sidepanel: Autofill button has no ⚡ emoji", !autofillText.includes("⚡"), autofillText.trim().slice(0, 40));

  record("sidepanel: no uncaught page errors during nav", spErrors.length === 0, spErrors.slice(0, 2).join("; "));

  // 3. Popup Settings tab has "Clear autofill cache" section
  const pp = await ctx.newPage();
  await pp.addInitScript(() => {
    window.chrome = {
      runtime: {
        sendMessage: () => Promise.resolve({}),
        getURL: (p) => "/" + p.replace(/^\//, ""),
        id: "test",
        onMessage: { addListener() {} },
      },
      tabs: {
        query: () => Promise.resolve([{ url: "https://www.linkedin.com/jobs/view/1", id: 1 }]),
        create: () => Promise.resolve({}),
      },
      storage: {
        local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
        session: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
        onChanged: { addListener() {} },
      },
      sidePanel: { open: () => Promise.resolve() },
      action: { openPopup: () => {} },
    };
  });
  const ppErrors = [];
  pp.on("pageerror", (e) => ppErrors.push(e.message));
  await pp.goto(base + "/popup.html", { waitUntil: "load" });
  await pp.waitForTimeout(500);
  // Click Settings (last sidebar button)
  const tabs = await pp.$$("aside nav button");
  await tabs[tabs.length - 1].click();
  await pp.waitForTimeout(300);
  const settingsText = await pp.$eval("main", (m) => m.textContent);
  record("popup settings: 'Autofill memory' section present", /Autofill memory/.test(settingsText));
  record("popup settings: 'Clear for this site' button present", /Clear for this site/.test(settingsText));
  record("popup settings: 'Clear all sites' button present", /Clear all sites/.test(settingsText));
  record("popup settings: 'Sandbox demo' section present", /Sandbox demo|demo application/i.test(settingsText));
  record("popup settings: 'Open demo application page' button present", /Open demo application page/.test(settingsText));
  record("popup settings: 'Keyboard shortcuts' section present", /Keyboard shortcuts/.test(settingsText));
  record("popup: no uncaught errors during tab switch", ppErrors.length === 0, ppErrors.slice(0, 2).join("; "));

  // 4. Demo page contains expected form fields
  const demo = await ctx.newPage();
  await demo.goto(base + "/demo-job.html", { waitUntil: "load" });
  const demoTitle = await demo.title();
  record("demo page: title set", /Demo Job Application|Super Job Agent/.test(demoTitle), demoTitle);
  const fieldCount = await demo.$$eval("input, select, textarea", (els) => els.length);
  record("demo page: has form fields", fieldCount >= 12, `${fieldCount} fields`);
  const hasSubmit = await demo.$("button[type='submit']");
  record("demo page: has submit button", !!hasSubmit);

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
