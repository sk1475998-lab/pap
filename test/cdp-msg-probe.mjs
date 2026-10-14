import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocket } = require("ws");
const ROOT="/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode";
const EXT_DIR=path.resolve(ROOT,"packages/extension/.output/chrome-mv3");
const CHROME="/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function getJSON(u){return new Promise((res,rej)=>{http.get(u,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on("error",rej)})}
let mid=0;
function cdpCall(ws,m,p={}){const id=++mid;return new Promise((res,rej)=>{const h=msg=>{const d=JSON.parse(msg);if(d.id===id){ws.removeListener("message",h);if(d.error)rej(new Error(m+": "+d.error.message));else res(d.result)}};ws.on("message",h);ws.send(JSON.stringify({id,method:m,params:p}))})}
async function cWs(u){const ws=new WebSocket(u);await new Promise((r,e)=>{ws.once("open",r);ws.once("error",e)});return ws}

(async()=>{
  const dir=`/tmp/sja-m-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const chrome=spawn(CHROME,[`--disable-extensions-except=${EXT_DIR}`,`--load-extension=${EXT_DIR}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0","about:blank"],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let port=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){port=+m[1];r()}});setTimeout(r,8000)});
  let bg=null;for(let i=0;i<30;i++){const l=await getJSON(`http://127.0.0.1:${port}/json`);bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));if(bg)break;await sleep(300)}
  const extId=bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
  const ver=await getJSON(`http://127.0.0.1:${port}/json/version`);
  const bw=await cWs(ver.webSocketDebuggerUrl);
  const bgw=await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw,"Runtime.enable");
  const bgLogs=[];
  bgw.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.consoleAPICalled")bgLogs.push(`[BG ${m.params.type}] ${m.params.args?.map(a=>a.value||a.description).join(" ")}`);if(m.method==="Runtime.exceptionThrown")bgLogs.push(`[BG EXC] ${m.params.exceptionDetails?.text}`)});
  await cdpCall(bw,"Target.createTarget",{url:`chrome-extension://${extId}/demo-job.html`});
  await sleep(3000);
  const l=await getJSON(`http://127.0.0.1:${port}/json`);
  const pg=l.find(t=>t.type==="page"&&t.url.includes("demo-job.html"));
  const ws=await cWs(pg.webSocketDebuggerUrl);
  await cdpCall(ws,"Runtime.enable");
  const logs=[];
  ws.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.consoleAPICalled")logs.push(`[${m.params.type}] ${m.params.args?.map(a=>a.value||a.description).join(" ")}`);if(m.method==="Runtime.exceptionThrown"){logs.push(`[EXC] ${m.params.exceptionDetails?.text} ${m.params.exceptionDetails?.exception?.description}`);console.log("PG EXC",m.params.exceptionDetails.text,m.params.exceptionDetails?.exception?.description)}});

  // Send DETECT and give a longer wait
  const r=await cdpCall(bgw,"Runtime.evaluate",{expression:`
    new Promise(async res=>{
      const tabs=await chrome.tabs.query({});
      const tab=tabs.find(t=>t.url&&t.url.includes('demo-job.html'));
      let got=false;
      chrome.tabs.sendMessage(tab.id,{type:'SJA:DETECT'},resp=>{
        if(got) return; got=true;
        if(chrome.runtime.lastError) return res({err:chrome.runtime.lastError.message});
        res({resp,n:resp?.fields?.length});
      });
      setTimeout(()=>{if(!got)res({timeout:true})},3000);
    })`,awaitPromise:true,returnByValue:true});
  console.log("DETECT result:",JSON.stringify(r.result?.value).slice(0,500));
  await sleep(200);
  console.log("---page logs---");
  logs.slice(-30).forEach(l=>console.log(l));
  console.log("---bg logs tail---");
  bgLogs.slice(-10).forEach(l=>console.log(l));

  // Check if there's an "orchestrator" object on window
  const keys=await cdpCall(ws,"Runtime.evaluate",{expression:`Object.keys(window).filter(k=>/sja|orchestr|autofill|agent/i.test(k))`,returnByValue:true});
  console.log("matching window keys:",keys.result?.value);
  ws.close();bgw.close();bw.close();chrome.kill();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
})();
