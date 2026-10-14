// Load extension, capture all console/error output during first 5 seconds
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocket } = require("ws");

const EXT_DIR = path.resolve("/home/user/project/SuperJobAgent_v0.1.0-easyapply-fix.20260715_Full_SourceCode/packages/extension/.output/chrome-mv3");
const CHROME = "/home/user/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>resolve(JSON.parse(d))); }).on("error", reject);
  });
}

(async () => {
  const userDataDir = `/tmp/sja-test2-${Date.now()}`;
  fs.mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(CHROME, [
    `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`,
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    `--user-data-dir=${userDataDir}`, "--enable-logging=stderr", "--v=1",
    "--remote-debugging-port=0", "about:blank"
  ], { stdio: ["ignore","pipe","pipe"] });
  proc.stderr.on("data", d => {
    const s = d.toString();
    if (/extension|SJA|superjob|Unchecked|ERROR|error/i.test(s) || /background/i.test(s)) {
      process.stdout.write("[cr] " + s.slice(0,500));
    }
  });
  let port = null;
  await new Promise((resolve) => {
    proc.stderr.on("data", (d) => {
      const m = d.toString().match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);
      if (m) { port = +m[1]; resolve(); }
    });
    setTimeout(resolve, 10000);
  });
  console.log("port", port);
  for (let i = 0; i < 20; i++) {
    const list = await getJSON(`http://127.0.0.1:${port}/json`);
    console.log(i*500, "ms,", list.length, "targets:", list.map(t=>`${t.type}:${t.url.slice(0,80)}`).join(" | "));
    if (list.some(t=>t.type==="service_worker")) break;
    await sleep(500);
  }
  proc.kill();
  fs.rmSync(userDataDir, { recursive: true, force: true });
})();
