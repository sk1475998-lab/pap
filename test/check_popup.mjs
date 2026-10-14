import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve("packages/extension/.output/chrome-mv3");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".json":"application/json", ".mjs":"text/javascript", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".map":"application/json" };
// Simple static server with extension MIME overrides
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p==="/") p="/popup.html";
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e,d)=>{
    if (e) { res.writeHead(404); return res.end(String(e.message)); }
    const ext = path.extname(fp);
    res.writeHead(200, { "content-type": MIME[ext]||"application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r=>server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errs=[];
page.on("pageerror", e => errs.push(e.message));
page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/popup.html`);
await page.waitForTimeout(2500);
const txt = await page.locator("#root").innerHTML();
console.log("ROOT LEN:", txt.length);
console.log("ROOT SAMPLE:", txt.slice(0,600));
console.log("ERRORS:", errs.slice(0,10));
await browser.close();
server.close();
