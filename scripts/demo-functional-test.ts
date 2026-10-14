import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Realistic HTML form containing every type of input to demo all SJA functionalities
const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Acme Corp Job Application</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 40px auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; }
    div { margin-bottom: 12px; }
    label { display: block; font-weight: bold; margin-bottom: 4px; }
    input[type="text"], input[type="date"], select { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
    button { background: #0066cc; color: white; padding: 8px 16px; border: 0; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h2>Apply for Acme Corp Position (Greenhouse Mock)</h2>
  <form id="application">
    <!-- A. Standard Text Fields -->
    <div>
      <label for="first_name">First Name</label>
      <input type="text" id="first_name" name="first_name" required />
    </div>
    <div>
      <label for="last_name">Last Name</label>
      <input type="text" id="last_name" name="last_name" required />
    </div>

    <!-- B. Date Picker -->
    <div>
      <label for="dob">Date of Birth</label>
      <input type="date" id="dob" name="dob" />
    </div>

    <!-- C. Native Dropdown Select -->
    <div>
      <label for="gender">Gender</label>
      <select id="gender" name="gender">
        <option value="">Select...</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
    </div>

    <!-- D. Radio Buttons (Matches Options mapping) -->
    <fieldset>
      <legend>Are you authorized to work in the US?</legend>
      <label><input type="radio" name="work_auth" value="yes"> Yes</label>
      <label><input type="radio" name="work_auth" value="no"> No</label>
    </fieldset>

    <!-- E. Checkbox (Consent terms) -->
    <div>
      <label>
        <input type="checkbox" id="consent" name="consent" /> I consent to a background check
      </label>
    </div>

    <!-- F. Comma-separated Skills (Chip/Tag inputs) -->
    <div>
      <label for="skills">Skills</label>
      <input type="text" id="skills" name="skills" placeholder="e.g. Python, PyTorch, React" />
    </div>

    <!-- G. Non-Autonomous Policy Trigger (Salary expectations) -->
    <div>
      <label for="salary">What is your expected salary?</label>
      <input type="text" id="salary" name="salary" />
    </div>

    <!-- H. Unsupported Input Type (e.g. Color Picker) to demonstrate failure logger -->
    <div>
      <label for="fav_color">Favorite Color (Unsupported Input Type)</label>
      <input type="color" id="fav_color" name="fav_color" />
    </div>

    <button type="submit" id="submit_button">Submit Application</button>
  </form>
</body>
</html>
`;

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const extensionPath = path.join(rootDir, "packages", "extension", ".output", "chrome-mv3");
  const reportPath = path.join(rootDir, "functional_demo_log.txt");
  const logStream = fs.createWriteStream(reportPath, { flags: "w" });

  logStream.write("============================================================\n");
  logStream.write("SUPER JOB AGENT - FUNCTIONAL TESTING & DEMO LOG REPORT\n");
  logStream.write("============================================================\n");
  logStream.write(`Generated At: ${new Date().toISOString()}\n\n`);

  console.log("Launching browser with extension...");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();

  // Route Playwright to fulfill boards.greenhouse.io requests locally so extension matches matches/permissions
  const targetUrl = "https://boards.greenhouse.io/apply-acme-job";
  await page.route(targetUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: MOCK_HTML,
    });
  });

  // Array to collect real-time filling logs
  const realTimeLogs: string[] = [];

  const addLog = (text: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${text}`;
    realTimeLogs.push(formatted);
    logStream.write(formatted + "\n");
    console.log(formatted);
  };

  // Capture page console outputs
  page.on("console", (msg) => {
    const text = msg.text();
    addLog(`[PAGE CONSOLE] [${msg.type().toUpperCase()}] ${text}`);
  });

  page.on("pageerror", (err) => {
    addLog(`[PAGE EXCEPTION] ${err.stack || err.message}`);
  });

  // Track service worker console logs
  context.on("serviceworker", async (worker) => {
    addLog(`[BACKGROUND SW TARGET] Attached to background context: ${worker.url()}`);
    try {
      const cdp = await context.newCDPSession(worker);
      await cdp.send("Runtime.enable");
      cdp.on("Runtime.consoleAPICalled", (event) => {
        const text = event.args
          .map((arg) => (arg.value !== undefined ? String(arg.value) : arg.description || JSON.stringify(arg)))
          .join(" ");
        addLog(`[BG SW CONSOLE] [${event.type.toUpperCase()}] ${text}`);
      });
    } catch (e: any) {
      addLog(`[CDP ATTACH FAILED] ${e.message}`);
    }
  });

  addLog("Waiting for extension to initialize background states...");
  await page.waitForTimeout(2500);

  // Navigate to mock application form page
  addLog(`Opening mock application form page at ${targetUrl}`);
  await page.goto(targetUrl);
  await page.waitForTimeout(4000);

  // Inject mock profile and strict settings to storage to demonstrate skip-policies
  addLog("Injecting mock user profile and settings (with non-autonomous policies)...");
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  if (sw) {
    await sw.evaluate(async () => {
      // Setup profile
      await chrome.storage.local.set({
        profile: {
          firstName: "Shashi",
          lastName: "Kumar Banoth",
          email: "shashikumarbanoth91@gmail.com",
          phone: "+919182805541",
          dateOfBirth: "2005-06-24",
          gender: "Male",
          // Mismatched work auth (value is wordy, mock options are Yes/No)
          workAuthorization: "Authorized to work in India",
          skills: ["python", "pytorch", "react"],
          experience: [],
          education: [],
          projects: [],
          customAnswers: {},
          currentCTC: "",
          expectedCTC: "",
          noticePeriod: ""
        },
        settings: {
          autonomousMode: false, // Turn off to trigger "needs-user" policies for non-autonomous demo!
          autoClickEasyApply: true,
          autoFillSteps: true,
          autoAdvanceSteps: true,
          autoSubmit: false
        }
      });
    });
  } else {
    addLog("⚠ Warning: Service worker not active in context, skipping settings injection.");
  }

  // Trigger SJA autofill execution with robust retry loop using specific URL query
  addLog("Triggering autofill action with connection retry loop targeting boards.greenhouse.io...");
  if (sw) {
    const result = await sw.evaluate(async (urlPattern) => {
      const tabs = await chrome.tabs.query({ url: urlPattern });
      if (!tabs.length) return `No tabs found matching URL: ${urlPattern}`;
      const tab = tabs[0];
      if (!tab?.id) return "Tab found but has no ID";
      
      const errors: string[] = [];
      for (let i = 0; i < 10; i++) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOFILL" });
          return "Autofill message sent successfully";
        } catch (e: any) {
          errors.push(e.message || String(e));
          await new Promise((r) => setTimeout(r, 800)); // Wait and retry
        }
      }
      return `Failed to send autofill after 10 retries. Errors: ${JSON.stringify(errors)}`;
    }, "*://boards.greenhouse.io/*");

    addLog(`Autofill Trigger Result: ${result}`);
  }

  addLog("Watching autofill filling sequences executing on the page...");
  // Allow time for autofill steps to fire, process options, retry, verify, and complete
  await page.waitForTimeout(10000);

  addLog("Form-filling verification completed. Reading diagnostics logs from storage...");
  if (sw) {
    const rawDiagnostics = await sw.evaluate(async () => {
      const data = await chrome.storage.local.get("diagnostics");
      return data.diagnostics || [];
    });

    logStream.write("\n\n" + "=".repeat(60) + "\n");
    logStream.write("CONSOLIDATED DIAGNOSTIC LOG DATABASE ENTRIES:\n");
    logStream.write("=".repeat(60) + "\n");
    
    for (const entry of rawDiagnostics) {
      const line = `[DIAG][${entry.level.toUpperCase()}][SJA:${entry.area}] ${entry.message} - ${entry.data ? JSON.stringify(entry.data) : ""}`;
      logStream.write(line + "\n");
      console.log(line);
    }
  }

  addLog("Closing browser context...");
  await context.close();

  logStream.write("\n\n============================================================\n");
  logStream.write("END OF FUNCTIONAL TEST REPORT\n");
  logStream.write("============================================================\n");
  logStream.end();
  console.log(`\nDemo completed successfully. Full consolidated report saved to: ${reportPath}`);
}

main().catch(console.error);
