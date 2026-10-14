/**
 * Serve demo-job.html over localhost http — the real-world content-script path.
 * Verify orchestrator injects, DETECT finds fields, AUTOFILL fills them.
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
  const dir = `/tmp/sja-http-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });

  // Serve demo files over http
  const server = http.createServer((req, res) => {
    let fp;
    if (req.url === "/" || req.url === "/demo-job.html") {
      fp = path.join(EXT_DIR, "demo-job.html");
      // Strip the chrome-extension-only <script src="content-scripts/agent.js"> line
      let html = fs.readFileSync(fp, "utf8");
      html = html.replace(/<script src="content-scripts\/agent\.js"><\/script>/, "");
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    } else if (req.url === "/demo-job.js") {
      fp = path.join(EXT_DIR, "demo-job.js");
      res.setHeader("Content-Type", "application/javascript");
      fs.createReadStream(fp).pipe(res); return;
    } else {
      res.writeHead(404); res.end(); return;
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const demoUrl = `http://127.0.0.1:${port}/demo-job.html`;
  console.log("Demo http server:", demoUrl);

  const chrome = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--user-data-dir=${dir}`,
    "--remote-debugging-port=0",
    demoUrl,
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
  let extId = null, bgTarget = null, pageTarget = null;
  for (let i = 0; i < 40; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    bgTarget = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
    pageTarget = list.find((t) => t.type === "page" && t.url.includes(demoUrl));
    if (bgTarget) extId = bgTarget.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
    if (bgTarget && pageTarget) break;
    await sleep(300);
  }
  record("extension + http demo page load", !!extId && !!pageTarget);

  const version = await getJSON(`http://127.0.0.1:${debugPort}/json/version`);
  const browserWs = await connectWs(version.webSocketDebuggerUrl);
  const bgWs = await connectWs(bgTarget.webSocketDebuggerUrl);
  await cdpCall(bgWs, "Runtime.enable");
  const bgLogs = [], bgErrs = [];
  bgWs.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.method === "Runtime.consoleAPICalled") {
      const a = m.params.args?.map(x => x.value || x.description).join(" ");
      bgLogs.push(`[${m.params.type}] ${a}`);
      if (m.params.type === "error") bgErrs.push(a);
    }
  });
  const pageWs = await connectWs(pageTarget.webSocketDebuggerUrl);
  await cdpCall(pageWs, "Runtime.enable");
  await cdpCall(pageWs, "Page.enable");
  const pageLogs = [], pageErrs = [];
  pageWs.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.method === "Runtime.consoleAPICalled") {
      const a = m.params.args?.map(x => x.value || x.description).join(" ");
      pageLogs.push(`[${m.params.type}] ${a}`);
      if (m.params.type === "error") pageErrs.push(a);
    }
    if (m.method === "Runtime.exceptionThrown") {
      pageErrs.push(m.params.exceptionDetails?.text + ": " + m.params.exceptionDetails?.exception?.description);
    }
  });

  // Wait for content script to auto-inject (detector sees forms on http pages)
  await sleep(3500);
  const panel = await cdpCall(pageWs, "Runtime.evaluate", {
    expression: "!!document.querySelector('#sja-persistent-docked-panel-container')",
    returnByValue: true,
  });
  record("orchestrator auto-injected on http page", panel.result?.value === true, `panel=${panel.result?.value}`);

  // Seed profile
  await cdpCall(bgWs, "Runtime.evaluate", {
    expression: `new Promise(r=>chrome.storage.local.set({'sja:profile':{firstName:'Aarav',lastName:'Sharma',email:'aarav.sharma@example.com',phone:'+919876543210',linkedinUrl:'https://linkedin.com/in/aaravsharma',githubUrl:'https://github.com/aarav',city:'Hyderabad',country:'IN',yearsOfExperience:5,currentCompany:'Acme Inc.',skills:'react, typescript, nodejs',coverLetter:'I would love to join Acme because of the strong engineering culture and impactful products.',workAuthorization:'yes',requiresSponsorship:'no',noticePeriodDays:30,source:'linkedin',pronouns:'he/him',portfolioUrl:'https://aarav.dev',agreeTerms:true}},()=>r(true)))`,
    awaitPromise: true,
  });
  await sleep(300);

  async function sendToTab(msg) {
    const r = await cdpCall(bgWs, "Runtime.evaluate", {
      expression: `new Promise((resolve) => {
        (async () => {
          const tabs = await chrome.tabs.query({active:true,currentWindow:true});
          const tab = tabs[0];
          if (!tab) return resolve({_err:'no active tab'});
          // Inject orchestrator first (normal http path)
          chrome.runtime.sendMessage({type:'SJA:INJECT_ORCHESTRATOR',payload:{url:tab.url,reason:'test'}}, () => {
            void chrome.runtime.lastError;
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, ${JSON.stringify(msg)}, (resp) => {
                if (chrome.runtime.lastError) resolve({_err: chrome.runtime.lastError.message});
                else resolve(resp);
              });
            }, 500);
          });
        })();
      })`,
      awaitPromise: true, returnByValue: true,
    });
    return r.result?.value;
  }

  let detect = null;
  for (let i = 0; i < 8; i++) {
    const r = await sendToTab({type:"SJA:DETECT"});
    if (r && !r._err && r.fields && r.fields.length >= 5) { detect = r; break; }
    await sleep(600);
  }
  record("DETECT finds >=5 fields on http form", !!detect && detect.fields.length >= 5,
    detect ? `${detect.fields.length} fields (platform=${detect.platform?.id})` : "none");

  if (detect) console.log("    fields:", detect.fields.map(f=>`${f.fieldKey||'?'}<${f.type}>`).join(", "));

  let fill = null;
  for (let i = 0; i < 5; i++) {
    const r = await sendToTab({type:"SJA:AUTOFILL"});
    if (r && !r._err && (r.filled > 0 || i >= 2)) { fill = r; break; }
    await sleep(800);
  }
  record("AUTOFILL returns filled>0", !!fill && (fill.filled ?? 0) > 0, fill ? JSON.stringify({filled:fill.filled,skipped:fill.skipped}) : "no resp");

  await sleep(1500);

  const chk = await cdpCall(pageWs, "Runtime.evaluate", {
    expression: `(function(){
      const inputs=[...document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea,select')];
      let filled=0;const samples=[];
      for(const el of inputs){ if((el.value||'').trim()){filled++; if(samples.length<8) samples.push((el.name||el.id)+'='+String(el.value).slice(0,25));} }
      const checks=[...document.querySelectorAll('input[type=radio],input[type=checkbox]')];
      let checked=0; for(const el of checks){ if(el.checked){checked++; filled++;} }
      return {filled, total: inputs.length+checks.length, samples, checked};
    })()`,
    returnByValue: true,
  });
  const fc = chk.result?.value;
  record(">=5 text/select fields visibly filled", fc && (fc.filled - (fc.checked||0)) >= 5,
    fc ? `filled=${fc.filled}/${fc.total}; samples=${fc.samples.join(', ')}` : "n/a");
  record(">=1 radio/checkbox checked", fc && (fc.checked||0) >= 1, fc ? `${fc.checked} checked` : "n/a");
  record("zero page errors", pageErrs.length === 0, pageErrs.slice(0,2).join(" | "));

  if (fail > 0) {
    console.log("\n--- page log tail ---");
    pageLogs.slice(-20).forEach(l=>console.log(l));
    console.log("\n--- bg log tail ---");
    bgLogs.slice(-15).forEach(l=>console.log(l));
  }

  pageWs.close();
  bgWs.close();
  browserWs.close();
  chrome.kill();
  server.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
