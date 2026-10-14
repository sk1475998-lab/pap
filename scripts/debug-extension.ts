import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const extensionPath = path.join(rootDir, "packages", "extension", ".output", "chrome-mv3");
  const errorsJsonPath = path.join(rootDir, "extension_errors_report.json");
  // `logStream` and `reportPath` were used 20 times below but never declared, so
  // `npm run debug:ext` died on the first write with "logStream is not defined".
  const reportPath = path.join(rootDir, "extension_debug_report.txt");
  const logStream = fs.createWriteStream(reportPath, { flags: "w" });
  const universalErrorLog: any[] = [];
  let extensionId = "unknown";

  logStream.write("============================================================\n");
  logStream.write("SUPER JOB AGENT EXTENSION DEBUGGING REPORT\n");
  logStream.write("============================================================\n");
  logStream.write(`Generated At: ${new Date().toISOString()}\n\n`);

  console.log("Launching Chromium with Super Job Agent loaded...");
  console.log(`Extension Path: ${extensionPath}`);
  console.log(`Writing debug logs to: ${reportPath}`);
  console.log(`Writing unified errors JSON to: ${errorsJsonPath}\n`);

  if (!fs.existsSync(extensionPath)) {
    console.error("❌ Error: Compiled extension folder not found at packages/extension/.output/chrome-mv3.");
    console.error("Please run 'npm run build:ext' first to build the extension.");
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Track page console logs (popups, content scripts, and job board pages)
  context.on("page", (page) => {
    logStream.write(`\n[NEW PAGE OPENED] URL: ${page.url()}\n`);

    page.on("console", (msg) => {
      const type = msg.type().toUpperCase();
      const text = msg.text();
      logStream.write(`[PAGE CONSOLE][${type}] ${text}\n`);
      if (type === "ERROR" || type === "WARNING" || type === "ASSERT") {
        universalErrorLog.push({
          timestamp: Date.now(),
          source: page.url(),
          type: `Console ${type}`,
          message: text,
        });
      }
    });

    page.on("pageerror", (err) => {
      const errorText = err.stack || err.message;
      logStream.write(`[PAGE UNCAUGHT EXCEPTION] ${errorText}\n`);
      universalErrorLog.push({
        timestamp: Date.now(),
        source: page.url(),
        type: "Page Uncaught Exception",
        message: err.message,
        stack_trace: err.stack ? err.stack.split("\n").map(l => l.trim()) : null,
      });
    });

    page.on("requestfailed", (req) => {
      const failure = req.failure();
      const reason = failure ? failure.errorText : "Unknown";
      logStream.write(`[NETWORK FAILED] ${req.method()} ${req.url()} - Reason: ${reason}\n`);
      universalErrorLog.push({
        timestamp: Date.now(),
        source: page.url(),
        type: "Network Request Failed",
        message: `${req.method()} ${req.url()} - Reason: ${reason}`,
      });
    });

    page.on("response", (res) => {
      if (res.status() >= 400) {
        logStream.write(`[NETWORK HTTP ERROR] ${res.request().method()} ${res.url()} - Status: ${res.status()}\n`);
        universalErrorLog.push({
          timestamp: Date.now(),
          source: page.url(),
          type: "HTTP Error",
          message: `${res.request().method()} ${res.url()} - Status: ${res.status()}`,
        });
      }
    });
  });

  // Track and inspect background Service Worker console & errors via CDP Session
  context.on("serviceworker", async (worker) => {
    logStream.write(`\n[BACKGROUND SERVICE WORKER DETECTED] URL: ${worker.url()}\n`);
    console.log(`Attached to Background Service Worker target: ${worker.url()}`);
    try {
      const url = new URL(worker.url());
      extensionId = url.hostname;
    } catch {}

    try {
      const cdp = await context.newCDPSession(worker);
      await cdp.send("Runtime.enable");
      
      cdp.on("Runtime.consoleAPICalled", (event) => {
        const type = event.type.toUpperCase();
        const argsText = event.args
          .map((arg) => {
            if (arg.value !== undefined) return String(arg.value);
            return arg.description || JSON.stringify(arg);
          })
          .join(" ");
        logStream.write(`[BG SW CONSOLE][${type}] ${argsText}\n`);
        if (type === "ERROR" || type === "WARNING" || type === "ASSERT") {
          universalErrorLog.push({
            timestamp: Date.now(),
            source: worker.url(),
            type: `ServiceWorker Console ${type}`,
            message: argsText,
            devtools_raw: event,
          });
        }
      });

      cdp.on("Runtime.exceptionThrown", (event) => {
        const details = event.exceptionDetails;
        const exceptionText = details.exception 
          ? (details.exception.description || JSON.stringify(details.exception))
          : details.text;
        logStream.write(`[BG SW UNCAUGHT EXCEPTION] ${exceptionText}\n`);
        universalErrorLog.push({
          timestamp: Date.now(),
          source: worker.url(),
          type: "ServiceWorker Exception",
          message: exceptionText,
          url: details.url,
          line_number: details.lineNumber,
          column_number: details.columnNumber,
          stack_trace: details.stackTrace ? details.stackTrace.callFrames : null,
          devtools_raw: event,
        });
      });
    } catch (err: any) {
      logStream.write(`[CDP MONITOR ERROR] Failed to connect SW listener: ${err.message}\n`);
    }
  });

  console.log("=================================================================");
  console.log(">>> EXTENSION IS ACTIVE IN THE LAUNCHED BROWSER <<<");
  console.log("1. Use the extension normally (open LinkedIn, click Autofill, etc.)");
  console.log("2. Trigger the bugs or errors you want to collect.");
  console.log("3. Every log, exception, and network failure is recorded.");
  console.log("4. Close the browser window when you are done.");
  console.log("=================================================================");

  // Wait for browser close
  await new Promise<void>((resolve) => {
    context.on("close", () => {
      logStream.write("\n\n============================================================\n");
      logStream.write("BROWSER CLOSED - END OF REPORT\n");
      logStream.write("============================================================\n");
      logStream.end();
      console.log(`\nDone! Debug report successfully saved to: ${reportPath}`);

      // Export universal error JSON
      const finalJson = {
        extension_id: extensionId,
        export_timestamp: Date.now(),
        total_errors_found: universalErrorLog.length,
        errors: universalErrorLog,
      };
      fs.writeFileSync(errorsJsonPath, JSON.stringify(finalJson, null, 2), "utf-8");
      console.log(`Unified errors JSON successfully saved to: ${errorsJsonPath}`);

      resolve();
    });
  });
}

main().catch(console.error);
