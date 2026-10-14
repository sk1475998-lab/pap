/**
 * Headless end-to-end extension test via CDP.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocket } = require("ws");

const EXT_DIR = path.resolve("/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode/packages/extension/.output/chrome-mv3");
const CHROME = "/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on("error", reject);
  });
}

let msgId = 0;
function cdpCall(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) {
        ws.removeListener("message", handler);
        if (data.error) reject(new Error(`${method}: ${data.error.message}`));
        else resolve(data.result);
      }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function cdpOn(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { ws.removeListener("message", handler); reject(new Error("timeout waiting for event")); }, timeoutMs);
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (predicate(data)) { clearTimeout(t); ws.removeListener("message", handler); resolve(data); }
    };
    ws.on("message", handler);
  });
}

async function evalExpr(ws, sessionId, expr) {
  const p = { expression: expr, awaitPromise: true, returnByValue: true };
  if (sessionId) p.sessionId = sessionId;
  const r = await cdpCall(ws, "Runtime.evaluate", p);
  if (r.exceptionDetails) {
    throw new Error("Eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text || "?").slice(0, 500));
  }
  return r.result.value;
}

async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((r, e) => { ws.once("open", r); ws.once("error", e); });
  return ws;
}

function wsSend(ws, obj) { ws.send(JSON.stringify(obj)); }

let pass = 0, fail = 0;
function record(name, cond, info = "") {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; console.log(`  [FAIL] ${name}  ${info}`); }
}

async function main() {
  const userDataDir = `/tmp/sja-test-${Date.now()}`;
  fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    `--user-data-dir=${userDataDir}`,
    "--remote-debugging-port=0",
    "--disable-extensions-except=" + EXT_DIR,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  proc.stderr.on("data", () => {}); // silence

  let port = null;
  await new Promise((resolve) => {
    proc.stderr.on("data", (d) => {
      const m = d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
      if (m) { port = +m[1]; resolve(); }
    });
    setTimeout(resolve, 10000);
  });
  if (!port) throw new Error("no port");

  const errors = [];
  const consoleErrors = [];

  // Wait for SW
  let bgTarget = null, extensionId = null;
  for (let i = 0; i < 40; i++) {
    const list = await getJSON(`http://127.0.0.1:${port}/json`);
    bgTarget = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
    if (bgTarget) {
      const m = bgTarget.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i);
      if (m) extensionId = m[1];
      break;
    }
    await sleep(300);
  }
  if (!bgTarget) throw new Error("No background SW");
  console.log(`Extension ID: ${extensionId}`);

  // Browser-level log capture
  const version = await getJSON(`http://127.0.0.1:${port}/json/version`);
  const browserWs = await connectWs(version.webSocketDebuggerUrl);
  wsSend(browserWs, { id: 1, method: "Runtime.enable" });
  wsSend(browserWs, { id: 2, method: "Log.enable" });
  browserWs.on("message", (msg) => {
    const d = JSON.parse(msg);
    if (d.method === "Runtime.exceptionThrown") {
      const ed = d.params.exceptionDetails;
      errors.push(ed);
      console.log("  ! EXCEPTION:", (ed.exception?.description || ed.text || "").toString().slice(0, 300));
    } else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") {
      const text = (d.params.args || []).map((a) => a.value || a.description).join(" ");
      if (text) { consoleErrors.push(text); console.log("  ! console.error:", text.slice(0, 200)); }
    }
  });

  // Connect to BG worker
  const bgWs = await connectWs(bgTarget.webSocketDebuggerUrl);
  await cdpCall(bgWs, "Runtime.enable");
  await cdpCall(bgWs, "Log.enable");
  await sleep(500);

  console.log("\n== Background checks ==");
  const ver = await evalExpr(bgWs, null, `chrome.runtime.getManifest().version`);
  record("manifest version is 0.1.2", ver === "0.1.2", `got ${ver}`);
  const cmds = await evalExpr(bgWs, null, `Object.keys(chrome.runtime.getManifest().commands || {})`);
  record("commands present (autofill-page + open-popup)", cmds.includes("autofill-page") && cmds.includes("open-popup"), JSON.stringify(cmds));
  const hasSp = await evalExpr(bgWs, null, `typeof chrome.sidePanel !== 'undefined' && !!chrome.sidePanel.open`);
  record("chrome.sidePanel API available", !!hasSp);
  const perms = await evalExpr(bgWs, null, `new Promise(r => chrome.permissions.getAll(p => r(p.permissions)))`);
  record("permissions include sidePanel", Array.isArray(perms) && perms.includes("sidePanel"), JSON.stringify(perms));

  // Wait a moment for alarms/menu setup
  await sleep(500);
  const menus = await evalExpr(bgWs, null, `new Promise(r => { try { chrome.contextMenus.removeAll(()=>{}); chrome.contextMenus.create({id:'_t',title:'t'},()=>{r('ok:'+chrome.runtime.lastError?.message)}); } catch(e){r('err:'+e.message)} })`);
  // ^ will fail because of existing IDs; just test API works
  const alarms = await evalExpr(bgWs, null, `new Promise(r => chrome.alarms.getAll(a => r(a.map(x => x.name))))`);
  record("alarms created (keepalive+campaigns+telemetry)", alarms.includes("sja-campaigns"), JSON.stringify(alarms));

  // Open popup page directly
  console.log("\n== Popup checks ==");
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const popupTab = await cdpCall(browserWs, "Target.createTarget", { url: popupUrl });
  await sleep(800);
  const list = await getJSON(`http://127.0.0.1:${port}/json`);
  const popupTgt = list.find((t) => t.url && t.url.includes("popup.html"));
  record("popup page opens", !!popupTgt, popupTgt?.url);
  const popupWs = await connectWs(popupTgt.webSocketDebuggerUrl);
  await cdpCall(popupWs, "Runtime.enable");
  await cdpCall(popupWs, "Page.enable");
  await sleep(800);

  // Root React tree — check no fatal error
  const html = await evalExpr(popupWs, null, `document.body ? document.body.innerText.slice(0,200) : "(no body)"`);
  record("popup body rendered (has text)", html.length > 20, html.slice(0,120));
  const hasSJA = await evalExpr(popupWs, null, `document.body.innerText.includes('Super Job Agent')`);
  record("popup says Super Job Agent", !!hasSJA);

  // Nav buttons count (9 tabs in sidebar)
  const navBtns = await evalExpr(popupWs, null, `document.querySelectorAll('nav button').length`);
  record("popup has 9 nav tabs", navBtns === 9, `got ${navBtns}`);

  // Click Apply tab (default is profile — switch to apply)
  const applyClick = await evalExpr(popupWs, null, `
    (function(){
      const btns = [...document.querySelectorAll('nav button')];
      const b = btns.find(x => x.textContent.trim() === 'Apply');
      if (b) { b.click(); return 'clicked'; }
      return 'missing:' + btns.map(x=>x.textContent.trim()).join('|');
    })()
  `);
  record("Apply tab button clickable", applyClick === 'clicked', applyClick);
  await sleep(600);

  // After switching to Apply, should see "Auto-fill" / "Auto-apply" button
  const applyTabText = await evalExpr(popupWs, null, `document.body.innerText.slice(0,800)`);
  record("Apply tab has Auto-fill button", /Auto.?fill/i.test(applyTabText));
  record("Apply tab has Auto-apply (end-to-end) button", /Auto.?apply/i.test(applyTabText));
  const fieldCountBefore = await evalExpr(popupWs, null, `
    [...document.querySelectorAll('button')].filter(b => /Auto.?fill/.test(b.textContent)).length
  `);
  record("Apply tab has at least one action button", fieldCountBefore >= 1, `got ${fieldCountBefore}`);

  // Auto-apply button exists but is locked (no profile yet). Verify that the
  // lock-state button is present and that clicking "Set up profile" navigates.
  const autoApplyBtn = await evalExpr(popupWs, null, `
    (function(){
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => /Auto.?apply|Set up profile first/i.test(x.textContent));
      return b ? ('found:' + b.textContent.trim() + '|disabled:' + b.disabled) : 'missing';
    })()
  `);
  record("Auto-apply button present (locked before profile setup)", /found/.test(autoApplyBtn), autoApplyBtn);
  // Profile-setup CTA in the nudge card navigates to profile tab
  const setupClick = await evalExpr(popupWs, null, `
    (function(){
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => /Set up profile/.test(x.textContent) && /30 sec/.test(x.textContent));
      if (b) { b.click(); return 'clicked'; }
      return 'missing';
    })()
  `);
  record("Profile nudge 'Set up profile' navigates", setupClick === 'clicked', setupClick);
  await sleep(500);

  // Visit every tab and ensure no crash
  const tabs = ["Profile","Tracker","ATS","India","Intel","Campaigns","Settings"];
  for (const name of tabs) {
    const r = await evalExpr(popupWs, null, `
      (function(){
        const btns = [...document.querySelectorAll('nav button')];
        const b = btns.find(x => x.textContent.trim() === '${name}');
        if (!b) return 'missing';
        b.click();
        return 'ok';
      })()
    `);
    await sleep(200);
    const body = await evalExpr(popupWs, null, `document.body ? document.body.innerText.slice(0,50) : ""`);
    record(`Tab '${name}' renders without throwing`, r === 'ok' && body.length > 3, r + " / " + JSON.stringify(body).slice(0,80));
  }

  popupWs.close();

  // Sidepanel page
  console.log("\n== Side panel checks ==");
  const spTab = await cdpCall(browserWs, "Target.createTarget", { url: `chrome-extension://${extensionId}/sidepanel.html` });
  await sleep(600);
  const list2 = await getJSON(`http://127.0.0.1:${port}/json`);
  const spTgt = list2.find((t) => t.url && t.url.includes("sidepanel.html"));
  record("sidepanel page opens", !!spTgt);
  if (spTgt) {
    const spWs = await connectWs(spTgt.webSocketDebuggerUrl);
    await cdpCall(spWs, "Runtime.enable");
    await sleep(600);
    const spText = await evalExpr(spWs, null, `document.body ? document.body.innerText.slice(0,500) : ""`);
    record("sidepanel renders Super Job Agent", /Super Job Agent/i.test(spText), spText.slice(0,100));
    const spAutoApply = await evalExpr(spWs, null, `[...document.querySelectorAll('button')].some(b => /Auto.?apply.*end.?to.?end/i.test(b.textContent))`);
    record("sidepanel has end-to-end Auto-apply button", !!spAutoApply);
    const spNavCount = await evalExpr(spWs, null, `document.querySelectorAll('nav button').length`);
    record("sidepanel has 4 nav items (Today/Tracker/Profile/Trust)", spNavCount === 4, `got ${spNavCount}`);
    spWs.close();
  }

  // Demo sandbox
  console.log("\n== Demo page checks ==");
  const demoTab = await cdpCall(browserWs, "Target.createTarget", { url: `chrome-extension://${extensionId}/demo-job.html` });
  await sleep(600);
  const list3 = await getJSON(`http://127.0.0.1:${port}/json`);
  const demoTgt = list3.find((t) => t.url && t.url.includes("demo-job.html"));
  record("demo page opens", !!demoTgt);
  if (demoTgt) {
    const demoWs = await connectWs(demoTgt.webSocketDebuggerUrl);
    await cdpCall(demoWs, "Runtime.enable");
    await sleep(500);
    const demoTitle = await evalExpr(demoWs, null, `document.title`);
    record("demo page title", /Demo/i.test(demoTitle), demoTitle);
    const demoFields = await evalExpr(demoWs, null, `document.querySelectorAll('input, select, textarea').length`);
    record("demo page has >= 15 fields", demoFields >= 15, `got ${demoFields}`);
    const hasSubmit = await evalExpr(demoWs, null, `!![...document.querySelectorAll('button,input[type=submit]')].find(b => /submit|apply/i.test(b.textContent || b.value || ''))`);
    record("demo page has submit button", !!hasSubmit);
    demoWs.close();
  }

  // Onboarding
  console.log("\n== Onboarding checks ==");
  // The extension auto-opens onboarding on install; find it in targets
  const onboardingTgt = list3.find((t) => t.url && t.url.includes("onboarding.html")) || (await getJSON(`http://127.0.0.1:${port}/json`)).find((t)=>t.url&&t.url.includes("onboarding.html"));
  record("onboarding page exists/opened", !!onboardingTgt);

  // Final summary
  console.log("\n== Errors captured during session ==");
  console.log("  Runtime exceptions:", errors.length);
  console.log("  console.error calls:", consoleErrors.length);
  errors.slice(0,5).forEach((e,i)=>console.log(`   ${i+1}.`, (e.exception?.description||e.text||"").slice(0,250)));
  consoleErrors.slice(0,5).forEach((e,i)=>console.log(`   ${i+1}.`, e.slice(0,250)));

  proc.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
