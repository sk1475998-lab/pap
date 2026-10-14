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
  const dir=`/tmp/sja-p-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const chrome=spawn(CHROME,[`--disable-extensions-except=${EXT_DIR}`,`--load-extension=${EXT_DIR}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0","about:blank"],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let port=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){port=+m[1];r()}});setTimeout(r,8000)});
  let bg=null;
  for(let i=0;i<30;i++){
    const list=await getJSON(`http://127.0.0.1:${port}/json`);
    bg=list.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));
    if(bg) break;
    await sleep(300);
  }
  const extId=bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];
  console.log("extId:",extId);
  const ver=await getJSON(`http://127.0.0.1:${port}/json/version`);
  const bw=await cWs(ver.webSocketDebuggerUrl);
  const bgw=await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw,"Runtime.enable");
  bgw.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.consoleAPICalled")console.log("[BG]",m.params.type,m.params.args?.map(a=>a.value||a.description).join(" "))});
  await cdpCall(bw,"Target.createTarget",{url:`chrome-extension://${extId}/demo-job.html`});
  await sleep(3000);
  // Seed profile
  await cdpCall(bgw,"Runtime.evaluate",{expression:`new Promise(r=>chrome.storage.local.set({'sja:profile':{firstName:'Aarav',lastName:'Sharma',email:'aarav@example.com',phone:'+919876543210',linkedinUrl:'https://linkedin.com/in/aarav',city:'Hyderabad',country:'IN',yearsOfExperience:5},()=>r(true)))`,awaitPromise:true});
  await sleep(300);
  // tabs.sendMessage DETECT
  const det=await cdpCall(bgw,"Runtime.evaluate",{expression:`
    new Promise(async(resolve)=>{
      const tabs=await chrome.tabs.query({});
      const tab=tabs.find(t=>t.url&&t.url.includes('demo-job.html'));
      chrome.tabs.sendMessage(tab.id,{type:'SJA:DETECT'},r=>{
        if(chrome.runtime.lastError) return resolve({err:chrome.runtime.lastError.message});
        resolve(r);
      });
    })`,awaitPromise:true,returnByValue:true});
  console.log("DETECT via tabs:",JSON.stringify(det.result?.value,null,2).slice(0,2000));
  
  // tabs.sendMessage AUTOFILL
  const fill=await cdpCall(bgw,"Runtime.evaluate",{expression:`
    new Promise(async(resolve)=>{
      const tabs=await chrome.tabs.query({});
      const tab=tabs.find(t=>t.url&&t.url.includes('demo-job.html'));
      chrome.tabs.sendMessage(tab.id,{type:'SJA:AUTOFILL'},r=>{
        if(chrome.runtime.lastError) return resolve({err:chrome.runtime.lastError.message});
        resolve(r);
      });
    })`,awaitPromise:true,returnByValue:true});
  await sleep(1500);
  console.log("AUTOFILL via tabs:",JSON.stringify(fill.result?.value,null,2).slice(0,2000));

  // Find page
  const list2=await getJSON(`http://127.0.0.1:${port}/json`);
  const pg=list2.find(t=>t.type==="page"&&t.url.includes("demo-job.html"));
  const pws=await cWs(pg.webSocketDebuggerUrl);
  await cdpCall(pws,"Runtime.enable");
  pws.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.consoleAPICalled")console.log("[PG]",m.params.type,m.params.args?.map(a=>a.value||a.description).join(" "));if(m.method==="Runtime.exceptionThrown")console.log("[PG EXC]",m.params.exceptionDetails?.text)});
  const chk=await cdpCall(pws,"Runtime.evaluate",{expression:`
    (function(){
      const map={};
      document.querySelectorAll('input,textarea,select').forEach(el=>{
        const k=el.name||el.id||el.getAttribute('data-testid')||el.getAttribute('data-automation-id')||el.type;
        map[k]=el.type==='checkbox'||el.type==='radio'?el.checked:el.value;
      });
      return map;
    })()`,returnByValue:true});
  console.log("FIELD VALUES:",JSON.stringify(chk.result?.value,null,2));

  await sleep(500);
  pws.close();bgw.close();bw.close();chrome.kill();
  try{fs.rmSync(dir,{recursive:true,force:true})}catch(e){console.log("cleanup err (ok):",e.code)}
})();
