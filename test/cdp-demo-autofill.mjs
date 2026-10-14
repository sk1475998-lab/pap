/**
 * Functional test: load the demo-job application page (served via chrome-extension://
 * since that's the canonical demo entrypoint where agent.js is self-bootstrapped via
 * <script> tag — chrome.scripting.executeScript can't target extension:// pages),
 * wait for orchestrator to mount, send DETECT + AUTOFILL via chrome.tabs.sendMessage
 * (the same path popup/side panel use) and verify fields actually get filled.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocket } = require("ws");

const ROOT = "/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode";
const EXT_DIR = path.resolve(ROOT, "packages/extension/.output/chrome-mv3");
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
      if (data.id === id) { ws.removeListener("message", handler); if (data.error) reject(new Error(`${method}: ${data.error.message}`)); else resolve(data.result); }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((r, e) => { ws.once("open", r); ws.once("error", e); });
  return ws;
}

let pass = 0, fail = 0;
function record(n, c, i = "") { if (c) { pass++; console.log("  [PASS]", n); } else { fail++; console.log("  [FAIL]", n, i); } }

(async () => {
  const dir = `/tmp/sja-func-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });

  const chrome = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--user-data-dir=${dir}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore","pipe","pipe"] });
  chrome.stderr.on("data", () => {});

  let debugPort = null;
  await new Promise((res) => {
    chrome.stderr.on("data", (d) => {
      const m = d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
      if (m) { debugPort = +m[1]; res(); }
    });
    setTimeout(res, 10000);
  });
  if (!debugPort) throw new Error("no debug port");

  // Find background
  let extId = null, bgTarget = null;
  for (let i = 0; i < 40; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    bgTarget = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
    if (bgTarget) extId = bgTarget.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
    if (bgTarget) break;
    await sleep(300);
  }
  record("extension background loads", !!extId, `extId:${extId}`);

  const version = await getJSON(`http://127.0.0.1:${debugPort}/json/version`);
  const browserWs = await connectWs(version.webSocketDebuggerUrl);
  const bgWs = await connectWs(bgTarget.webSocketDebuggerUrl);
  await cdpCall(bgWs, "Runtime.enable");

  // Attach console/error listeners
  const bgLogs = [];
  bgWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      const a = msg.params.args?.map(x => x.value || x.description).join(" ");
      bgLogs.push(`[${msg.params.type}] ${a}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      bgLogs.push(`[EXC] ${msg.params.exceptionDetails?.text}: ${msg.params.exceptionDetails?.exception?.description}`);
    }
  });

  // Navigate a tab to the demo page
  const created = await cdpCall(browserWs, "Target.createTarget", { url: `chrome-extension://${extId}/demo-job.html` });
  let demoTarget = null;
  for (let i = 0; i < 50; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    demoTarget = list.find((t) => t.type === "page" && t.url.includes("demo-job.html"));
    if (demoTarget) break;
    await sleep(300);
  }
  record("demo page opens", !!demoTarget, demoTarget?.url);

  const demoWs = await connectWs(demoTarget.webSocketDebuggerUrl);
  await cdpCall(demoWs, "Runtime.enable");
  await cdpCall(demoWs, "Page.enable");
  const pageLogs = [];
  let pageExceptions = 0;
  demoWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      const a = msg.params.args?.map(x => x.value || x.description).join(" ");
      pageLogs.push(`[${msg.params.type}] ${a}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      pageExceptions++;
      pageLogs.push(`[EXC] ${msg.params.exceptionDetails?.text}: ${msg.params.exceptionDetails?.exception?.description}`);
    }
  });

  // Wait for the panel to mount
  let panelFound = false;
  for (let i = 0; i < 30; i++) {
    const r = await cdpCall(demoWs, "Runtime.evaluate", {
      expression: "!!document.querySelector('#sja-persistent-docked-panel-container')",
      returnByValue: true,
    });
    if (r.result.value) { panelFound = true; break; }
    await sleep(400);
  }
  record("orchestrator panel mounts within 12s", panelFound);

  // Helper: send message to demo tab via BG (tabs.sendMessage) — same as popup/sidepanel do
  async function sendToTab(msg) {
    const r = await cdpCall(bgWs, "Runtime.evaluate", {
      expression: `new Promise((resolve) => {
        (async () => {
          try {
            const tabs = await chrome.tabs.query({});
            const tab = tabs.find(t => t.url && t.url.includes('demo-job.html'));
            if (!tab) return resolve({_err:'no demo tab'});
            chrome.tabs.sendMessage(tab.id, ${JSON.stringify(msg)}, (resp) => {
              if (chrome.runtime.lastError) resolve({_err: chrome.runtime.lastError.message});
              else resolve(resp);
            });
          } catch(e) { resolve({_err:e.message}); }
        })();
      })`,
      awaitPromise: true,
      returnByValue: true,
    });
    return r.result?.value;
  }

  // Seed a minimal profile so autofill has something to fill with (orchestrator will
  // fall back to generic values when no profile exists, but let's give it one).
  await cdpCall(bgWs, "Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      chrome.storage.local.set({
        'sja:profile': {
          firstName: 'Aarav', lastName: 'Sharma', email: 'aarav.sharma@example.com',
          phone: '+919876543210', linkedinUrl: 'https://linkedin.com/in/aaravsharma',
          githubUrl: 'https://github.com/aarav', city: 'Hyderabad', country: 'IN',
          yearsOfExperience: 5, currentCompany: 'Acme Inc.', skills: 'react, typescript, nodejs',
          coverLetter: 'I would love to join Acme because of the strong engineering culture and impactful products.',
          workAuthorization: 'yes', requiresSponsorship: 'no', noticePeriodDays: 30,
          source: 'linkedin', pronouns: 'he/him', portfolioUrl: 'https://aarav.dev',
          agreeTerms: true
        }
      }, () => resolve(true));
    })`,
    awaitPromise: true,
  });

  // Wait a bit for profile to sync into orchestrator state, then DETECT
  await sleep(500);
  let detect = null;
  for (let i = 0; i < 10; i++) {
    const r = await sendToTab({ type: "SJA:DETECT" });
    if (r && !r._err && r.fields && r.fields.length > 0) { detect = r; break; }
    await sleep(500);
  }
  record("DETECT returns fields", !!detect && detect.fields.length >= 5,
    detect ? `${detect.fields.length} fields` : `no detect; last: ${JSON.stringify(detect).slice(0,200)}`);

  // AUTOFILL
  let fill = null;
  for (let i = 0; i < 5; i++) {
    const r = await sendToTab({ type: "SJA:AUTOFILL" });
    if (r && !r._err && (r.filled > 0 || i >= 2)) { fill = r; break; }
    await sleep(800);
  }
  record("AUTOFILL returns filled>0", !!fill && (fill.filled ?? 0) > 0,
    fill ? JSON.stringify(fill).slice(0,300) : "no fill response");

  // Give time for DOM updates
  await sleep(1200);

  const filledCheck = await cdpCall(demoWs, "Runtime.evaluate", {
    expression: `(function(){
      const inputs = document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, select');
      let filled = 0, total = 0;
      const samples = [];
      for (const el of inputs) {
        total++;
        const v = (el.value||'').trim();
        if (v) { filled++; if (samples.length < 10) samples.push((el.name||el.id||el.getAttribute('data-testid')||el.getAttribute('data-automation-id'))+'='+v.slice(0,30)); }
      }
      // Radios/checkboxes
      const checks = document.querySelectorAll('input[type=radio],input[type=checkbox]');
      let checked = 0;
      for (const el of checks) { total++; if (el.checked) { checked++; filled++; } }
      return {filled,total,text:samples,checked};
    })()`,
    returnByValue: true,
  });
  const fc = filledCheck.result?.value;
  record("form text/select fields filled >= 5", fc && (fc.filled - (fc.checked||0)) >= 5,
    fc ? `${fc.filled}/${fc.total} filled; samples: ${fc.text?.join(', ')}` : "no result");
  record("at least one checkbox/radio selected", fc && (fc.checked||0) >= 1,
    fc ? `${fc.checked} checked` : "n/a");
  record("zero page runtime exceptions", pageExceptions === 0, `${pageExceptions} exceptions`);

  // Final: check BG console for errors
  const bgErrors = bgLogs.filter(l => l.includes("[error]") || l.startsWith("[EXC]"));
  record("zero BG console errors/exceptions", bgErrors.length === 0,
    bgErrors.slice(0,3).join(" | "));

  if (fail > 0) {
    console.log("\n--- page log tail ---");
    pageLogs.slice(-15).forEach(l => console.log(l));
    console.log("\n--- bg log tail ---");
    bgLogs.slice(-10).forEach(l => console.log(l));
  }

  demoWs.close();
  bgWs.close();
  browserWs.close();
  chrome.kill();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
