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
  // Write a small UTF-8 clean test file to extension
  fs.writeFileSync(path.join(EXT_DIR,"smoke.js"),"window.__smoke=42;",'utf8');
  // Write a larger file with same content but with em-dash characters like the one in agent.js
  const big = "var x = '" + "a".repeat(200000) + "\\u2014" + "b".repeat(200000) + "';";
  fs.writeFileSync(path.join(EXT_DIR,"big.js"),big,'utf8');
  // Copy agent.js but re-encode
  const ag = fs.readFileSync(path.join(EXT_DIR,"content-scripts/agent.js"));
  fs.writeFileSync(path.join(EXT_DIR,"agent-clean.js"),ag,'utf8'); // node will write as utf8 buffer unchanged if it's already utf8
  const dir=`/tmp/sja-utf-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const server=http.createServer((req,res)=>res.end('<html><body>hi</body></html>'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  const chrome=spawn(CHROME,[`--disable-extensions-except=${EXT_DIR}`,`--load-extension=${EXT_DIR}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0",`http://127.0.0.1:${port}/`],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let dp=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp=+m[1];r()}});setTimeout(r,8000)});
  await sleep(2000);
  const l=await getJSON(`http://127.0.0.1:${dp}/json`);
  const bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));
  const page=l.find(t=>t.type==="page"&&t.url.includes("127.0.0.1"));
  const bgw=await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw,"Runtime.enable");
  const files=["smoke.js","big.js","agent-clean.js","content-scripts/agent.js"];
  for(const f of files){
    const r=await cdpCall(bgw,"Runtime.evaluate",{expression:`new Promise(async res=>{try{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url&&t.url.includes('127.0.0.1'));const r=await chrome.scripting.executeScript({target:{tabId:tab.id},files:${JSON.stringify([f])}});res({ok:true,n:r.length});}catch(e){res({err:e.message});}})`,awaitPromise:true,returnByValue:true});
    console.log(f,":",JSON.stringify(r.result?.value));
  }
  bgw.close();chrome.kill();server.close();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
})();
