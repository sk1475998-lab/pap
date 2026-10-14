import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve("packages/extension/.output/chrome-mv3");
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".json":"application/json",".mjs":"text/javascript",".svg":"image/svg+xml",".woff2":"font/woff2",".map":"application/json"};
const srv = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split("?")[0]);if(p==="/")p="/popup.html";const fp=path.join(ROOT,p);fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404);return res.end(e.message)};res.writeHead(200,{"content-type":MIME[path.extname(fp)]||"application/octet-stream"});res.end(d)})});
await new Promise(r=>srv.listen(0,"127.0.0.1",r));
const port = srv.address().port;
const browser = await chromium.launch({args:["--no-sandbox"],headless:true});
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", e => console.log("PAGE:", e.stack));
page.on("console", m => { if (m.type()==="error") console.log("CONSOLE.ERR:", m.text()); });
const FAKE_PROFILE = {firstName:"Alex",lastName:"Hireme",email:"a@b.c",phone:"x",location:"India",locale:"IN",summary:"x",skills:["JS"],languages:["English"],masterResumeText:"test",createdAt:Date.now(),updatedAt:Date.now()};
await page.addInitScript(`
(() => {
  const store = { local: { data: { profile: ${JSON.stringify(JSON.stringify(FAKE_PROFILE))}, applications: "[]", llmConfig: "{}", settings: "{}" }, async get(keys){const out={};const arr=Array.isArray(keys)?keys:keys?[keys]:Object.keys(this.data);for(const k of arr)if(k in this.data)out[k]=JSON.parse(this.data[k]);return out}, async set(o){for(const k in o)this.data[k]=JSON.stringify(o[k])} }, session:{async get(){return{}},async set(){},async setAccessLevel(){}}, onChanged:{addListener(){}} };
  window.chrome = {
    runtime: { id:"x", async sendMessage(msg){ if(msg?.type==="SJA:DETECT")return{platform:"linkedin",fields:[],job:{title:"SWE",company:"A",description:"TS React"},score:72}; if(msg?.type==="SJA:GET_MATCH")return{score:72,matched:[],missing:[],reasons:[]}; if(msg?.type==="SJA:AUTOFILL")return{filled:1,skipped:0,details:[],aiAnswered:0}; throw new Error("x"); }, onMessage:{addListener(){},removeListener(){}}, getURL:p=>p },
    tabs: { async query(){return[{id:1,url:"https://linkedin.com/jobs/view/1",windowId:1,active:true}]}, async sendMessage(){return{platform:"linkedin",fields:[{label:"x",selector:"x",id:"x",type:"text"}],job:{title:"SWE",company:"A",description:"TS React"}}}, onUpdated:{addListener(){}}, onRemoved:{addListener(){}}, async create(o){return{id:99}} },
    storage: store,
    action: { setBadgeText(){}, setIcon(){}, async openPopup(){return true} },
    sidePanel: { async open(){return true} },
    offscreen:{}, alarms:{create(){},onAlarm:{addListener(){}}},
    contextMenus:{create(){},onClicked:{addListener(){}},removeAll(){}},
    commands:{onCommand:{addListener(){}}},
    permissions:{request:async()=>true,contains:async()=>false},
    scripting:{executeScript:async()=>{}}
  };
  navigator.clipboard = navigator.clipboard || {}; navigator.clipboard.writeText = async()=>{};
})();
`);
await page.goto(`http://127.0.0.1:${port}/popup.html`);
await page.waitForTimeout(3000);
console.log("BODY LEN:", (await page.locator("body").innerHTML()).length);
console.log("ROOT SAMPLE:", (await page.locator("#root").innerHTML()).slice(0,500));
await browser.close(); srv.close();
