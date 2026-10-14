/**
 * Debug the demo page injection end-to-end with full logging.
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

(async () => {
  const dir = `/tmp/sja-dbg-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });
  const chrome = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--user-data-dir=${dir}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore","pipe","pipe"] });
  let chromeStderr = "";
  chrome.stderr.on("data", (d) => { chromeStderr += d.toString(); });
  chrome.stdout.on("data", () => {});

  let debugPort = null;
  await new Promise((res) => {
    chrome.stderr.on("data", (d) => {
      const m = d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
      if (m) { debugPort = +m[1]; res(); }
    });
    setTimeout(res, 10000);
  });
  console.log("debugPort:", debugPort);

  for (let i = 0; i < 40; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    const bg = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
    if (bg) {
      console.log("BG URL:", bg.url);
      var extId = bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
      var bgTarget = bg;
      break;
    }
    await sleep(300);
  }
  console.log("extId:", extId);

  // Attach to BG and listen for console + runtime exceptions
  const version = await getJSON(`http://127.0.0.1:${debugPort}/json/version`);
  const bgWs = await connectWs(bgTarget.webSocketDebuggerUrl);
  await cdpCall(bgWs, "Runtime.enable");
  await cdpCall(bgWs, "Log.enable");
  bgWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      const a = msg.params.args?.map(x => x.value || x.description).join(" ");
      console.log("[BG console]", msg.params.type, a);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[BG EXC]", msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
    }
    if (msg.method === "Log.entryAdded") {
      console.log("[BG log]", msg.params.entry?.level, msg.params.entry?.text);
    }
  });

  // Open demo page via chrome-extension://
  const browserWs = await connectWs(version.webSocketDebuggerUrl);
  const created = await cdpCall(browserWs, "Target.createTarget", { url: `chrome-extension://${extId}/demo-job.html` });
  await sleep(500);

  // Find demo target
  let demoTarget = null;
  for (let i = 0; i < 30; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    demoTarget = list.find((t) => t.type === "page" && t.url.includes("demo-job.html"));
    if (demoTarget) break;
    await sleep(400);
  }
  console.log("demoTarget:", demoTarget?.url);

  // Attach to demo page, capture console
  const demoWs = await connectWs(demoTarget.webSocketDebuggerUrl);
  await cdpCall(demoWs, "Runtime.enable");
  await cdpCall(demoWs, "Page.enable");
  const pageConsole = [];
  demoWs.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === "Runtime.consoleAPICalled") {
      const a = msg.params.args?.map(x => x.value || x.description).join(" ");
      pageConsole.push(`[${msg.params.type}] ${a}`);
      console.log("[DEMO console]", msg.params.type, a);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[DEMO EXC]", msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
    }
  });
  await sleep(2000);

  // Run probes
  const probes = [
    "location.href",
    "typeof chrome",
    "chrome?.runtime?.id",
    "window.__sja_demo_injected",
    "document.querySelector('#sja-persistent-docked-panel-container')?.id",
    "!!document.querySelector('script[src*=demo-job]')",
    "document.querySelectorAll('input,textarea,select').length",
    "Object.keys(window).filter(k=>k.startsWith('__sja'))",
  ];
  for (const p of probes) {
    const r = await cdpCall(demoWs, "Runtime.evaluate", { expression: p, returnByValue: true });
    console.log("PROBE", p, "=>", JSON.stringify(r.result?.value));
  }

  // Try sending INJECT_ORCHESTRATOR manually and see if BG receives it
  console.log("--- manual inject via demo page ---");
  await cdpCall(demoWs, "Runtime.evaluate", {
    expression: `chrome.runtime.sendMessage({type:"SJA:INJECT_ORCHESTRATOR",payload:{url:location.href,reason:"demo-page"}}, function(r){ console.log("inject resp:", JSON.stringify(r)); if(chrome.runtime.lastError) console.log("inject err:", chrome.runtime.lastError.message); })`,
  });
  await sleep(2000);

  // Check agent script present
  const r2 = await cdpCall(demoWs, "Runtime.evaluate", {
    expression: "!!(window.__SJA_ORCHESTRATOR__ || window.sjaOrchestrator || document.querySelector('#sja-persistent-docked-panel-container'))",
    returnByValue: true,
  });
  console.log("after inject: orchestrator on window:", r2.result?.value);

  // List all runtime-loaded scripts in demo page
  const scripts = await cdpCall(demoWs, "Page.getFrameTree");
  console.log("frameTree:", JSON.stringify(scripts.frameTree.frame, null, 2).slice(0,500));

  // Show pageConsole tail
  console.log("--- page console log ---");
  pageConsole.slice(-20).forEach(l => console.log(l));

  await sleep(1000);
  demoWs.close();
  bgWs.close();
  browserWs.close();
  chrome.kill();
  try { fs.rmSync(dir, {recursive:true,force:true}); } catch {}
})();
