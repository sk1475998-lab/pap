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
    let fp;
    if(req.url==="/"||req.url==="/demo-job.html"){
      let html = fs.readFileSync(path.join(EXT_DIR,"demo-job.html"),"utf8");
      html = html.replace(/<script src="content-scripts\/agent\.js"><\/script>/, "");
      res.setHeader('Content-Type','text/html');res.end(html);
    } else if(req.url==="/demo-job.js"){
      res.setHeader('Content-Type','application/javascript');
      fs.createReadStream(path.join(EXT_DIR,"demo-job.js")).pipe(res);
    } else { res.writeHead(404);res.end(); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  const url=`http://127.0.0.1:${port}/demo-job.html`;
  const dir=`/tmp/sja-de-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const chrome=spawn(CHROME,[`--disable-extensions-except=${EXT_DIR}`,`--load-extension=${EXT_DIR}`,"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${dir}`,"--remote-debugging-port=0",url],{stdio:["ignore","pipe","pipe"]});
  chrome.stderr.on("data",()=>{});
  let dp=null;await new Promise(r=>{chrome.stderr.on("data",d=>{const m=d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m){dp=+m[1];r()}});setTimeout(r,10000)});
  await sleep(4000);
  const l=await getJSON(`http://127.0.0.1:${dp}/json`);
  const bg=l.find(t=>t.type==="service_worker"&&/background\.js$/.test(t.url));
  const page=l.find(t=>t.type==="page"&&t.url.includes("127.0.0.1"));
  const bgw=await cWs(bg.webSocketDebuggerUrl);await cdpCall(bgw,"Runtime.enable");
  const pgw=await cWs(page.webSocketDebuggerUrl);await cdpCall(pgw,"Runtime.enable");await cdpCall(pgw,"Page.enable");
  const logs=[];
  pgw.on("message",raw=>{const m=JSON.parse(raw);if(m.method==="Runtime.consoleAPICalled")logs.push(`[PG ${m.params.type}] ${m.params.args?.map(a=>a.value||a.description).join(" ")}`);if(m.method==="Runtime.exceptionThrown")logs.push(`[PG EXC] ${m.params.exceptionDetails.text}`)});
  // Seed profile
  await cdpCall(bgw,"Runtime.evaluate",{expression:`new Promise(r=>chrome.storage.local.set({'sja:profile':{firstName:'Aarav',lastName:'Sharma',email:'aarav@example.com',phone:'+919876543210',linkedinUrl:'https://linkedin.com/in/aarav',city:'Hyderabad',country:'IN',yearsOfExperience:5,agreeTerms:true,workAuthorization:'yes',requiresSponsorship:'no'}},()=>r(true)))`,awaitPromise:true});
  await sleep(300);
  // Call DETECT via tabs.sendMessage and show results
  const r=await cdpCall(bgw,"Runtime.evaluate",{expression:`
    new Promise(async res=>{
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      chrome.tabs.sendMessage(tab.id,{type:'SJA:DETECT'},r=>{
        if(chrome.runtime.lastError) return res({err:chrome.runtime.lastError.message});
        res(r);
      });
    })`,awaitPromise:true,returnByValue:true});
  const d=r.result?.value;
  console.log("DETECT err?",d?.err);
  console.log("DETECT keys:",d && Object.keys(d));
  console.log("platform:",d?.platform?.id);
  console.log("hint:",d?.hint);
  console.log("fields.length:",d?.fields?.length);
  console.log("easyApply?",d?.linkedInEasyApplyOpen);
  console.log("job keys:",d?.job && Object.keys(d.job));
  console.log("job.title:",d?.job?.title);
  await sleep(500);
  console.log("---page logs---");logs.slice(-20).forEach(l=>console.log(l));
  pgw.close();bgw.close();chrome.kill();server.close();try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
})();
