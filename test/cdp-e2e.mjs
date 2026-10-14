/**
 * Single comprehensive end-to-end test: serve demo over http, launch fresh Chrome
 * with --load-extension, wait for content script to auto-inject orchestrator,
 * seed a profile, call DETECT then AUTOFILL via chrome.tabs.sendMessage, verify
 * fields actually filled in DOM.
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

function getJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const tryOnce = (attempt) => {
      const req = http.get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { attempt < retries ? setTimeout(() => tryOnce(attempt+1), 200) : reject(e); }
        });
      });
      req.on("error", (e) => attempt < retries ? setTimeout(() => tryOnce(attempt+1), 300) : reject(e));
    };
    tryOnce(0);
  });
}
let mid = 0;
function cdpCall(ws, method, params = {}) {
  const id = ++mid;
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) { ws.removeListener("message", handler); if (data.error) reject(new Error(`${method}: ${data.error.message}`)); else resolve(data.result); }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function cWs(url) {
  const ws = new WebSocket(url);
  await new Promise((r, e) => { ws.once("open", r); ws.once("error", e); });
  return ws;
}

let pass = 0, fail = 0;
function rec(n, c, i = "") { if (c) { pass++; console.log("  [PASS]", n); } else { fail++; console.log("  [FAIL]", n, i); } }

(async () => {
  // --- static server over demo files (no extension agent.js tag; the extension injects it) ---
  const server = http.createServer((req, res) => {
    let fp;
    if (req.url === "/" || req.url === "/demo-job.html" || req.url.startsWith("/demo-job.html?")) {
      let html = fs.readFileSync(path.join(EXT_DIR, "demo-job.html"), "utf8");
      html = html.replace(/<script src="content-scripts\/agent\.js"><\/script>/, "");
      res.setHeader("Content-Type", "text/html"); res.end(html); return;
    } else if (req.url === "/demo-job.js") {
      res.setHeader("Content-Type", "application/javascript");
      fs.createReadStream(path.join(EXT_DIR, "demo-job.js")).pipe(res); return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const demoUrl = `http://127.0.0.1:${port}/demo-job.html`;
  console.log("demo:", demoUrl);

  const dir = `/tmp/sja-final-${Date.now()}`;
  fs.mkdirSync(dir, { recursive: true });

  const chrome = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--window-size=1280,900",
    `--user-data-dir=${dir}`, "--remote-debugging-port=0", demoUrl,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let debugPort = null;
  let stderr = "";
  chrome.stderr.on("data", (d) => {
    stderr += d.toString();
    const m = d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
    if (m && !debugPort) debugPort = +m[1];
  });
  chrome.stdout.on("data", () => {});
  const start = Date.now();
  while (!debugPort && Date.now() - start < 15000) await sleep(200);
  if (!debugPort) { console.log("chrome stderr tail:", stderr.slice(-500)); throw new Error("no debug port"); }

  // wait for BG + page
  let bg = null, pg = null, extId = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
      bg = list.find((t) => t.type === "service_worker" && /background\.js$/.test(t.url));
      pg = list.find((t) => t.type === "page" && t.url.includes(`127.0.0.1:${port}`));
      if (bg) extId = bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
      if (bg && pg) break;
    } catch {}
    await sleep(300);
  }
  rec("chrome launched with extension loaded", !!extId, `extId=${extId}`);
  rec("demo page tab exists", !!pg, pg?.url);

  const ver = await getJSON(`http://127.0.0.1:${debugPort}/json/version`);
  const bw = await cWs(ver.webSocketDebuggerUrl);
  const bgw = await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw, "Runtime.enable");
  const bgLogs = [];
  bgw.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.method === "Runtime.consoleAPICalled") bgLogs.push(`[${m.params.type}] ${m.params.args?.map(a => a.value || a.description).join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") bgLogs.push(`[EXC] ${m.params.exceptionDetails.text}`);
  });

  // Force injection (idempotent). Also wait for panel.
  const pgw = await cWs(pg.webSocketDebuggerUrl);
  await cdpCall(pgw, "Runtime.enable");
  await cdpCall(pgw, "Page.enable");
  const pgLogs = []; let pgExc = 0;
  pgw.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.method === "Runtime.consoleAPICalled") pgLogs.push(`[${m.params.type}] ${m.params.args?.map(a => a.value || a.description).join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") { pgExc++; pgLogs.push(`[EXC] ${m.params.exceptionDetails.text}`); }
  });

  // Explicitly activate the demo page tab, then inject agent.js via scripting API.
  const activate = await cdpCall(bgw, "Runtime.evaluate", {
    expression: `new Promise(async res=>{
      const tabs=await chrome.tabs.query({});
      const demo=tabs.find(t=>t.url&&t.url.includes(${JSON.stringify(`127.0.0.1:${port}`)}));
      if(!demo) return res({err:'no demo tab', urls:tabs.map(t=>t.url)});
      await chrome.tabs.update(demo.id,{active:true});
      await new Promise(r=>setTimeout(r,300));
      res({ok:true,tabId:demo.id,url:demo.url});
    })`,
    awaitPromise:true, returnByValue:true,
  });
  rec("demo tab activated", activate.result?.value?.ok, JSON.stringify(activate.result?.value).slice(0,300));
  const demoTabId = activate.result?.value?.tabId;

  const inject = await cdpCall(bgw, "Runtime.evaluate", {
    expression: `new Promise(async res=>{
      try {
        const r=await chrome.scripting.executeScript({target:{tabId:${demoTabId}},files:["content-scripts/agent.js"]});
        res({ok:true,n:r.length});
      } catch(e){ res({err:e.message}); }
    })`,
    awaitPromise: true, returnByValue: true,
  });
  rec("chrome.scripting.executeScript(agent.js) succeeds", inject.result?.value?.ok, JSON.stringify(inject.result?.value));

  // Re-resolve page target (may have navigated or changed)
  for (let i = 0; i < 20; i++) {
    const list = await getJSON(`http://127.0.0.1:${debugPort}/json`);
    const np = list.find(t => t.type === "page" && t.url.includes(`127.0.0.1:${port}`));
    if (np && np.id !== pg.id) { pg = np; try { pgw.close(); } catch {} break; }
    await sleep(300);
  }
  const pgw2 = await cWs(pg.webSocketDebuggerUrl);
  await cdpCall(pgw2, "Runtime.enable");
  await cdpCall(pgw2, "Page.enable");
  pgw2.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.method === "Runtime.consoleAPICalled") pgLogs.push(`[${m.params.type}] ${m.params.args?.map(a => a.value || a.description).join(" ")}`);
    if (m.method === "Runtime.exceptionThrown") {
      pgExc++;
      const details = m.params.exceptionDetails;
      pgLogs.push(`[EXC] ${details.text} ${details.exception?.description || ""} at ${JSON.stringify(details.stackTrace?.callFrames?.[0]||{})}`);
    }
  });

  const panelOk = await cdpCall(pgw2, "Runtime.evaluate", {
    expression: "!!document.querySelector('#sja-persistent-docked-panel-container')", returnByValue: true,
  });
  rec("orchestrator panel mounted after injection", panelOk.result?.value === true);

  // seed a profile in chrome.storage so autofill has data
  await cdpCall(bgw, "Runtime.evaluate", {
    expression: `new Promise(r=>chrome.storage.local.set({profile:{firstName:'Aarav',lastName:'Sharma',email:'aarav.sharma@example.com',phone:'+919876543210',linkedinUrl:'https://linkedin.com/in/aarav',githubUrl:'https://github.com/aarav',city:'Hyderabad',country:'IN',yearsOfExperience:5,currentCompany:'Acme Inc.',currentCTC:'18',skills:['react','typescript','nodejs'],coverLetter:'I want to join Acme because of the strong engineering culture.',workAuthorization:'yes',requiresSponsorship:'no',noticePeriodDays:30,noticePeriod:'30',source:'linkedin',pronouns:'he/him',portfolioUrl:'https://aarav.dev',agreeTerms:true,experiences:[],education:[],projects:[],certifications:[]}},()=>r(true)))`,
    awaitPromise: true,
  });
  await sleep(300);

  async function tabMsg(msg, when = 1500) {
    return await cdpCall(bgw, "Runtime.evaluate", {
      expression: `new Promise(async res=>{
        chrome.tabs.sendMessage(${demoTabId}, ${JSON.stringify(msg)}, (r)=>{
          if (chrome.runtime.lastError) return res({_err:chrome.runtime.lastError.message});
          res(r);
        });
        setTimeout(()=>res({_err:'timeout'}), ${Math.max(5000, when+1000)});
      })`,
      awaitPromise: true, returnByValue: true,
    });
  }

  // DETECT — may need retries
  let detect = null;
  for (let i = 0; i < 10; i++) {
    const r = await tabMsg({ type: "SJA:DETECT" });
    const v = r.result?.value;
    if (v && !v._err && v.fields && v.fields.length > 0) { detect = v; break; }
    await sleep(500);
  }
  rec("DETECT finds >=5 fields", !!detect && detect.fields.length >= 5,
    detect ? `${detect.fields.length} fields, platform=${detect.platform?.id ?? "generic"}`
           : `no detect; last=${JSON.stringify((await tabMsg({type:"SJA:DETECT"})).result?.value).slice(0,200)}`);
  if (detect) console.log("    fields:", detect.fields.map(f => `${f.fieldKey||f.label}<${f.type}>`).slice(0, 25).join(", "));

  // AUTOFILL
  let fill = null;
  for (let i = 0; i < 5; i++) {
    const r = await tabMsg({ type: "SJA:AUTOFILL" }, 4000);
    const v = r.result?.value;
    console.log("    AUTOFILL attempt", i, JSON.stringify(v).slice(0,400));
    if (v && !v._err && (v.filled > 0 || i >= 2)) { fill = v; break; }
    await sleep(800);
  }
  rec("AUTOFILL returns filled>0", !!fill && (fill?.filled ?? 0) > 0, JSON.stringify(fill ? { filled: fill.filled, skipped: fill.skipped, ai: fill.aiAnswered } : fill));

  await sleep(1500);

  // Check actual DOM values
  const chk = await cdpCall(pgw2, "Runtime.evaluate", {
    expression: `(function(){
      const inputs=[...document.querySelectorAll('input:not([type=submit]):not([type=button]):not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea,select')];
      let filled=0;const samples=[];
      for(const el of inputs){ const v=(el.value||'').trim(); if(v){filled++; if(samples.length<10) samples.push((el.name||el.id)+'='+v.slice(0,25));} }
      const checks=[...document.querySelectorAll('input[type=radio],input[type=checkbox]')];
      let checked=0;for(const el of checks){ if(el.checked){checked++;filled++;} }
      return {filled, total: inputs.length+checks.length, samples, checked};
    })()`,
    returnByValue: true,
  });
  const fc = chk.result?.value;
  const textFilled = fc ? fc.filled - (fc.checked||0) : 0;
  rec(">=5 text/select fields filled in DOM", textFilled >= 5, fc ? `${textFilled} text filled; samples: ${fc.samples.join(', ')}` : "n/a");
  rec(">=1 checkbox/radio checked", fc && (fc.checked||0) >= 1, fc ? `${fc.checked} checked` : "n/a");
  rec("zero page runtime exceptions", pgExc === 0, `${pgExc} exns`);

  if (fail > 0) {
    console.log("\n--- page logs ---"); pgLogs.slice(-25).forEach(l => console.log(l));
    console.log("\n--- bg logs ---"); bgLogs.slice(-20).forEach(l => console.log(l));
  }

  pgw.close(); pgw2.close(); bgw.close(); bw.close();
  chrome.kill(); server.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
