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
const FAKE_PROFILE = {firstName:"Alex",lastName:"Hireme",email:"alex@example.com",phone:"+915555550123",city:"Hyderabad",state:"Telangana",pincode:"500081",country:"India",location:"Hyderabad, India",locale:"IN",summary:"x",skills:["JS"],languages:["English"],experience:[{id:"e1",title:"SWE",company:"A",startDate:"2021",endDate:"Present",current:true,bullets:[],skills:[]}],education:[{id:"d1",school:"IIT",degree:"B",field:"CS",startDate:"2015",endDate:"2019"}],projects:[],certifications:[],awards:[],yearsOfExperience:"5",expectedCTC:"25",ctcCurrency:"INR",noticePeriod:"30",masterResumeText:"test",createdAt:Date.now()-86400000,updatedAt:Date.now()};
page.on("pageerror", e => console.log("PAGE:", e.message));
page.on("console", m => { if(m.type()==="error") console.log("CERR:", m.text()); });
await page.addInitScript(`
(() => {
  const FAKE_PROFILE = ${JSON.stringify(FAKE_PROFILE)};
  const store = { local: { data: { profile: JSON.stringify(FAKE_PROFILE), applications: "[]", llmConfig: "{}", settings: "{}", "onboarding:state": JSON.stringify({step:"COMPLETED"}), "sja-panel-state":"{}", "sja-fill-history":"[]" }, async get(keys){const out={};const arr=Array.isArray(keys)?keys:keys==null?Object.keys(this.data):[keys];for(const k of arr)if(k in this.data){try{out[k]=JSON.parse(this.data[k]);}catch{out[k]=this.data[k]}}return out}, async set(o){for(const k in o)this.data[k]=typeof o[k]==="string"?o[k]:JSON.stringify(o[k])} }, session:{async get(){return{}},async set(){},async setAccessLevel(){}}, onChanged:{addListener(){}} };
  window.chrome = { runtime:{id:"x",async sendMessage(msg){ if(msg?.type==="SJA:DETECT")return{platform:"linkedin",fields:[{id:"a",label:"Name",type:"text",selector:"x"}],job:{title:"SWE",company:"A",description:"TS React"},score:72}; if(msg?.type==="SJA:GET_MATCH")return{score:72,matched:[],missing:[],reasons:[]}; if(msg?.type==="SJA:AUTOFILL")return{filled:12,skipped:2,details:[],aiAnswered:3}; return {ok:true}}, onMessage:{addListener(){},removeListener(){}}, getURL:p=>p, onInstalled:{addListener(){}} }, tabs:{async query(){return[{id:1,url:"https://linkedin.com/jobs/view/1",windowId:1,active:true}]},async sendMessage(){return{platform:"linkedin",fields:[{id:"a",label:"Name",type:"text",selector:"x"}],job:{title:"SWE",company:"A",description:"TS React"}}},onUpdated:{addListener(){}},onRemoved:{addListener(){}},async create(){return{id:99}}}, storage:store, action:{setBadgeText(){},setIcon(){},async openPopup(){return true}}, sidePanel:{async open(){return true}}, offscreen:{},alarms:{create(){},onAlarm:{addListener(){}}}, contextMenus:{create(){},onClicked:{addListener(){}},removeAll(){}}, commands:{onCommand:{addListener(){}}}, permissions:{request:async()=>true,contains:async()=>false}, scripting:{executeScript:async()=>{}} };
  navigator.clipboard=navigator.clipboard||{};navigator.clipboard.writeText=async()=>{};
})();
`);
await page.goto(`http://127.0.0.1:${port}/popup.html`);
await page.waitForTimeout(2000);
// Switch to Apply
await page.getByRole("button", { name: /apply/i }).first().click();
await page.waitForTimeout(500);
const buttons = await page.$$eval("button", bs => bs.map(b => ({text: b.textContent.trim().slice(0,60), visible: b.offsetParent!==null})));
console.log("Visible buttons on Apply tab:", buttons.filter(b=>b.visible));
await browser.close(); srv.close();
