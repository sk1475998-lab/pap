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
  const dir=`/tmp/sja-pr-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const chrome=spawn(CHROME,[`--disable-extensions-except=${EXT_DIR}`,`--load-extension=${EXT_DIR}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0","about:blank"],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let port=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){port=+m[1];r()}});setTimeout(r,8000)});
  let bg=null;for(let i=0;i<30;i++){const l=await getJSON(`http://127.0.0.1:${port}/json`);bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));if(bg)break;await sleep(300)}
  const extId=bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
  const ver=await getJSON(`http://127.0.0.1:${port}/json/version`);
  const bw=await cWs(ver.webSocketDebuggerUrl);
  await cdpCall(bw,"Target.createTarget",{url:`chrome-extension://${extId}/demo-job.html`});
  await sleep(2500);
  const l=await getJSON(`http://127.0.0.1:${port}/json`);
  const pg=l.find(t=>t.type==="page"&&t.url.includes("demo-job.html"));
  const ws=await cWs(pg.webSocketDebuggerUrl);
  await cdpCall(ws,"Runtime.enable");
  const errs=[];
  ws.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.exceptionThrown"){errs.push(m.params.exceptionDetails);console.log("EXC",m.params.exceptionDetails.text,m.params.exceptionDetails.exception?.description)}});

  // Quick visibility probe
  const v=await cdpCall(ws,"Runtime.evaluate",{expression:`
    (function(){
      const inputs=[...document.querySelectorAll('input,textarea,select')];
      return inputs.slice(0,5).map(el=>{
        const r=el.getBoundingClientRect();
        const cs=getComputedStyle(el);
        return {tag:el.tagName,name:el.name,id:el.id,w:r.width,h:r.height,display:cs.display,vis:cs.visibility,opacity:cs.opacity};
      });
    })()
  `,returnByValue:true});
  console.log("input rect samples:",JSON.stringify(v.result?.value,null,2));

  // Check if scanPage returns fields — orchestrator exports are inside IIFE so inaccessible.
  // Call DETECT handler via chrome.tabs.sendMessage (same path popup uses):
  const bgw=await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw,"Runtime.enable");
  const det=await cdpCall(bgw,"Runtime.evaluate",{expression:`
    new Promise(async res=>{
      const tabs=await chrome.tabs.query({});
      const tab=tabs.find(t=>t.url&&t.url.includes('demo-job.html'));
      // Force INJECT first
      chrome.tabs.sendMessage(tab.id,{type:'SJA:NAV'});
      await new Promise(r=>setTimeout(r,500));
      chrome.tabs.sendMessage(tab.id,{type:'SJA:DETECT'},r=>{
        if(chrome.runtime.lastError) return res({err:chrome.runtime.lastError.message});
        res(r);
      });
    })`,awaitPromise:true,returnByValue:true});
  console.log("DETECT:",JSON.stringify(det.result?.value,null,2).slice(0,1500));

  console.log("errs:",errs.length);
  ws.close();bgw.close();bw.close();chrome.kill();
  try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
})();
