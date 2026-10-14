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
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.end('<html><body><h1>Test</h1><input id="n" name="firstName"></body></html>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  const url=`http://127.0.0.1:${port}/`;
  const dir=`/tmp/sja-inj3-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const chrome=spawn(CHROME,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0","about:blank"],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let dp=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp=+m[1];r()}});setTimeout(r,8000)});
  let bg=null;for(let i=0;i<30;i++){const l=await getJSON(`http://127.0.0.1:${dp}/json`);bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));if(bg)break;await sleep(300)}
  const ext=EXT_DIR;
  // Need to load extension via args. Let's restart with load-extension
  chrome.kill();
  await sleep(500);
  const chrome2=spawn(CHROME,[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0",url],{stdio:["ignore","pipe","pipe"]});
  chrome2.stderr.on("data",()=>{});
  let dp2=null;await new Promise(r=>{chrome2.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp2=+m[1];r()}});setTimeout(r,8000)});
  await sleep(2000);
  const l=await getJSON(`http://127.0.0.1:${dp2}/json`);
  bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));
  const page=l.find(t=>t.type==="page"&&t.url.includes("127.0.0.1"));
  console.log("page:",page?.url);
  const bgw=await cWs(bg.webSocketDebuggerUrl);
  await cdpCall(bgw,"Runtime.enable");
  // try injecting each file
  const files=["content-scripts/content.js","content-scripts/demo.js","content-scripts/interceptor.js","content-scripts/agent.js","content-scripts/orchestrator.js","demo-job.js"];
  for(const f of files){
    const r=await cdpCall(bgw,"Runtime.evaluate",{expression:`
      new Promise(async res=>{
        try{
          const tabs=await chrome.tabs.query({});
          const tab=tabs.find(t=>t.url&&t.url.startsWith('http://127.0.0.1'));
          if(!tab) return res({err:'no tab'});
          console.log('tab',tab.id,tab.url,'file',${JSON.stringify(f)});
          const r=await chrome.scripting.executeScript({target:{tabId:tab.id},files:${JSON.stringify([f])}});
          res({ok:true,n:r.length});
        }catch(e){res({err:e.message});}
      })`,awaitPromise:true,returnByValue:true});
    console.log(f,":",JSON.stringify(r.result?.value));
  }
  bgw.close();chrome2.kill();server.close();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
})();
