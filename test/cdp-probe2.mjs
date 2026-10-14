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

(async () => {
  const dir = `/tmp/sja-dbg2-${Date.now()}`;
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
  let extId, bgTarget;
  for (let i = 0; i < 40; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    bgTarget = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
    if (bgTarget) { extId = bgTarget.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1]; break; }
    await sleep(300);
  }
  console.log("extId:", extId);
  const version = await getJSON(`http://127.0.0.1:${debugPort}/json/version`);
  const browserWs = await connectWs(version.webSocketDebuggerUrl);
  const created = await cdpCall(browserWs, "Target.createTarget", { url: `chrome-extension://${extId}/demo-job.html` });
  await sleep(3000);
  const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
  const demoTarget = list.find((t) => t.type === "page" && t.url.includes("demo-job.html"));
  const demoWs = await connectWs(demoTarget.webSocketDebuggerUrl);
  await cdpCall(demoWs, "Runtime.enable");
  await cdpCall(demoWs, "Page.enable");
  demoWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[DEMO]", msg.params.type, msg.params.args?.map(a => a.value || a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[DEMO EXC]", msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
    }
  });

  // The test sends message via chrome.runtime.sendMessage in page context.
  // That triggers onMessage in background (not in content scripts).
  // Try tabs.sendMessage via background:
  console.log("--- tabs.sendMessage DETECT via BG ---");
  const bgWs = await connectWs(bgTarget.webSocketDebuggerUrl);
  await cdpCall(bgWs, "Runtime.enable");
  bgWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[BG]", msg.params.type, msg.params.args?.map(a => (a.preview?.properties||[]).map(p=>p.name+":"+p.value).join(",") || a.value || a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[BG EXC]", msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
    }
  });

  const detectFromBg = await cdpCall(bgWs, "Runtime.evaluate", {
    expression: `new Promise(async (resolve) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(t => t.url && t.url.includes('demo-job.html'));
      if (!tab) return resolve({err:'no tab'});
      try {
        chrome.tabs.sendMessage(tab.id, {type:'SJA:DETECT'}, (r) => {
          if (chrome.runtime.lastError) resolve({err: chrome.runtime.lastError.message});
          else resolve(r);
        });
      } catch(e) { resolve({err: e.message}); }
    })`,
    awaitPromise: true, returnByValue: true,
  });
  console.log("DETECT from BG:", JSON.stringify(detectFromBg.result?.value).slice(0,500));

  // Try runtime.sendMessage from page (current test code)
  const detectFromPage = await cdpCall(demoWs, "Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      chrome.runtime.sendMessage({type:'SJA:DETECT'}, (r) => {
        if (chrome.runtime.lastError) resolve({err: chrome.runtime.lastError.message});
        else resolve(r);
      });
    })`,
    awaitPromise: true, returnByValue: true,
  });
  console.log("DETECT from page runtime:", JSON.stringify(detectFromPage.result?.value).slice(0,500));

  // Check if the main-world listener is set up (onMessage in page world)
  const probe = await cdpCall(demoWs, "Runtime.evaluate", {
    expression: `(function(){
      // Check if chrome.runtime.onMessage has listeners (main world)
      // WXT scripts monkey around with events; try calling listener directly.
      const listeners = chrome.runtime.onMessage.hasListener ? 'hasListener API' : 'no';
      // Panel mounted?
      const panel = !!document.querySelector('#sja-persistent-docked-panel-container');
      // FAB present?
      const fab = !!document.querySelector('#sja-linkedin-fab-host, .sja-fab, [class*=sja-fab]');
      // Any sja DOM
      const sja = [...document.querySelectorAll('[id*=sja],[class*=sja]')].map(e=>e.id||e.className).slice(0,20);
      return {listeners, panel, fab, sja};
    })()`,
    returnByValue: true,
  });
  console.log("probe:", JSON.stringify(probe.result?.value, null, 2));

  await sleep(500);
  demoWs.close();
  bgWs.close();
  browserWs.close();
  chrome.kill();
  fs.rmSync(dir, {recursive:true,force:true});
})();
