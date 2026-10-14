import {createRequire}from"module";const require=createRequire(import.meta.url);
const {spawn}=require("child_process"),http=require("http"),path=require("path"),{WebSocket}=require("ws"),fs=require("fs");
const ROOT="/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode";
const EXT=path.resolve(ROOT,"packages/extension/.output/chrome-mv3");
const CHROME="/home/user/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const getJSON=u=>new Promise((res,rej)=>{http.get(u,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})}).on("error",rej)});
let msgId=0;
function call(ws,m,p={}){const id=++msgId;return new Promise((res,rej)=>{const h=msg=>{const d=JSON.parse(msg);if(d.id===id){ws.removeListener("message",h);d.error?rej(new Error(d.error.message)):res(d.result)}};ws.on("message",h);ws.send(JSON.stringify({id,method:m,params:p}))})}
(async()=>{
  const dir="/tmp/sja-d3-"+Date.now();fs.mkdirSync(dir,{recursive:true});
  const p=spawn(CHROME,[`--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`,"--headless=new","--no-sandbox","--disable-gpu",`--user-data-dir=${dir}`,"--remote-debugging-port=0","about:blank"],{stdio:["ignore","pipe","pipe"]});
  p.stderr.on("data",()=>{});
  let dp=null;await new Promise(r=>{p.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp=+m[1];r()}});setTimeout(r,10000)});
  let bg,eid;
  for(let i=0;i<40;i++){const list=await getJSON(`http://127.0.0.1:${dp}/json`);bg=list.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));if(bg){eid=bg.url.match(/chrome-extension:\/\/([a-z0-9]{32})/i)[1];break;}await sleep(300);}
  // Attach to BG SW and capture logs/exceptions
  const bgWs=new WebSocket(bg.webSocketDebuggerUrl);await new Promise(r=>bgWs.once("open",r));
  await call(bgWs,"Runtime.enable");
  bgWs.on("message",msg=>{
    const d=JSON.parse(msg);
    if(d.method==="Runtime.exceptionThrown")console.log("[BG EXC]",JSON.stringify(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text).slice(0,500));
    if(d.method==="Runtime.consoleAPICalled"){
      const t=d.params.args.map(a=>a.value||a.description).join(" ");
      if(d.params.type==="error"||/inject|fail|error|denied/i.test(t))console.log("[BG console.",d.params.type,"]",t.slice(0,500));
    }
  });
  // Navigate new tab to demo page
  const v=await getJSON(`http://127.0.0.1:${dp}/json/version`);
  const bws=new WebSocket(v.webSocketDebuggerUrl);await new Promise(r=>bws.once("open",r));
  const tab=await call(bws,"Target.createTarget",{url:`chrome-extension://${eid}/demo-job.html`});
  await sleep(8000);
  const list=await getJSON(`http://127.0.0.1:${dp}/json`);
  const pg=list.find(t=>t.type==="page"&&/demo-job\.html/.test(t.url));
  const pws=new WebSocket(pg.webSocketDebuggerUrl);await new Promise(r=>pws.once("open",r));
  await call(pws,"Runtime.enable");
  pws.on("message",msg=>{
    const d=JSON.parse(msg);
    if(d.method==="Runtime.exceptionThrown")console.log("[PAGE EXC]",JSON.stringify(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text).slice(0,500));
    if(d.method==="Runtime.consoleAPICalled"){
      const t=d.params.args.map(a=>a.value||a.description).join(" ");
      if(t)console.log("[PAGE console.",d.params.type,"]",t.slice(0,500));
    }
  });
  // Check injection status
  await sleep(2000);
  const r=await call(pws,"Runtime.evaluate",{expression:"({panel:!!document.querySelector('#sja-persistent-docked-panel-container'), sjaInj:!!window.__sja_demo_injected, scripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('content-scripts')||s.includes('agent'))})",returnByValue:true});
  console.log("PAGE state:",JSON.stringify(r.result.value,null,2));
  // Try sendMessage
  await call(pws,"Runtime.evaluate",{expression:"chrome.runtime.sendMessage({type:'SJA:INJECT_ORCHESTRATOR',payload:{url:location.href,reason:'demo-page'}},r=>console.log('inject resp:',r, 'err:',chrome.runtime.lastError?.message))",awaitPromise:false});
  await sleep(3000);
  const r2=await call(pws,"Runtime.evaluate",{expression:"({panel:!!document.querySelector('#sja-persistent-docked-panel-container'), scripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('agent')||s.includes('content-scripts'))})",returnByValue:true});
  console.log("After inject:",JSON.stringify(r2.result.value,null,2));
  p.kill();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
  process.exit(0);
})();
