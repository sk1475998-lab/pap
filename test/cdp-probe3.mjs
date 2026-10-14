// Quick probe: after agent is injected, run detector/scanPage functions in page and see why fields empty
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocket } = require("ws");
const ROOT="/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode";
const EXT=path.resolve(ROOT,"packages/extension/.output/chrome-mv3");
const CHROME="/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function getJSON(u){return new Promise((res,rej)=>{http.get(u,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on("error",rej)})}
let mid=0;
function cdp(ws,m,p={}){const id=++mid;return new Promise((res,rej)=>{const h=msg=>{const d=JSON.parse(msg);if(d.id===id){ws.removeListener("message",h);if(d.error)rej(new Error(m+": "+d.error.message));else res(d.result)}};ws.on("message",h);ws.send(JSON.stringify({id,method:m,params:p}))})}
async function cWs(u){const ws=new WebSocket(u);await new Promise((r,e)=>{ws.once("open",r);ws.once("error",e)});return ws}

(async()=>{
  const srv=http.createServer((req,res)=>{
    if(req.url==='/'||req.url==='/demo-job.html'){
      let h=fs.readFileSync(path.join(EXT,"demo-job.html"),"utf8");
      h=h.replace(/<script src="content-scripts\/agent\.js"><\/script>/,"");
      res.setHeader('Content-Type','text/html');res.end(h);
    } else if(req.url==='/demo-job.js'){
      res.setHeader('Content-Type','application/javascript');
      fs.createReadStream(path.join(EXT,"demo-job.js")).pipe(res);
    } else {res.writeHead(404);res.end()}
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const port=srv.address().port;
  const url=`http://127.0.0.1:${port}/demo-job.html`;
  const dir=`/tmp/sja-p-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const ch=spawn(CHROME,[`--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0",url],{stdio:["ignore","pipe","pipe"]});
  ch.stderr.on("data",()=>{});
  let dp=null;await new Promise(r=>{ch.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp=+m[1];r()}});setTimeout(r,10000)});
  await sleep(3000);
  const l=await getJSON(`http://127.0.0.1:${dp}/json`);
  const bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));
  const pg=l.find(t=>t.type==="page"&&t.url.includes(`127.0.0.1:${port}`));
  const bgw=await cWs(bg.webSocketDebuggerUrl);await cdp(bgw,"Runtime.enable");
  const tabId=(await cdp(bgw,"Runtime.evaluate",{expression:`new Promise(async r=>{const tabs=await chrome.tabs.query({});const t=tabs.find(x=>x.url&&x.url.includes('127.0.0.1:${port}'));await chrome.tabs.update(t.id,{active:true});await new Promise(x=>setTimeout(x,300));const r2=await chrome.scripting.executeScript({target:{tabId:t.id},files:["content-scripts/agent.js"]}).catch(e=>({err:e.message}));r({tabId:t.id,inject:r2})})`,awaitPromise:true,returnByValue:true})).result.value.tabId;
  console.log("tabId:",tabId);
  await sleep(3000);
  const l2=await getJSON(`http://127.0.0.1:${dp}/json`);
  const pg2=l2.find(t=>t.type==="page"&&t.url.includes(`127.0.0.1:${port}`));
  const pw=await cWs(pg2.webSocketDebuggerUrl);
  await cdp(pw,"Runtime.enable");
  // Check basic DOM + inject diagnostic expression
  const probe=await cdp(pw,"Runtime.evaluate",{expression:`
    (function(){
      const inputs=document.querySelectorAll('input,select,textarea');
      const firstInput=inputs[0];
      const cs=firstInput?getComputedStyle(firstInput):null;
      const r=firstInput?firstInput.getBoundingClientRect():null;
      const form=document.querySelector('form');
      return {
        inputCount:inputs.length,
        firstInput: firstInput?{tag:firstInput.tagName,name:firstInput.name,id:firstInput.id,display:cs?.display,vis:cs?.visibility,w:r?.width,h:r?.height,opacity:cs?.opacity}:null,
        hasForm:!!form,
        innerW:window.innerWidth, innerH:window.innerHeight,
        url:location.href,
        panel:!!document.querySelector('#sja-persistent-docked-panel-container'),
        sjaNodes:[...document.querySelectorAll('[id*=sja],[class*=sja]')].length
      };
    })()`,returnByValue:true});
  console.log("DOM probe:",JSON.stringify(probe.result.value,null,2));

  // The orchestrator script stores state in closures. But check window.__SJA*
  const globals=await cdp(pw,"Runtime.evaluate",{expression:"Object.keys(window).filter(k=>/sja|orchestr|detect|autofill/i.test(k))",returnByValue:true});
  console.log("sja-ish globals:",globals.result.value);

  pw.close();bgw.close();ch.kill();srv.close();fs.rmSync(dir,{recursive:true,force:true});
})();
