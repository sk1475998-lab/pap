import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Tab 1 Mock: Highly complex external Greenhouse-like form
const MOCK_HTML_GREENHOUSE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Acme Greenhouse Application (TAB 1)</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 30px auto; padding: 20px; border: 2px solid #0066cc; border-radius: 12px; background: #fafafa; }
    div { margin-bottom: 12px; }
    label { display: block; font-weight: bold; margin-bottom: 4px; }
    input[type="text"], input[type="email"], select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    button[type="submit"] { background: #0066cc; color: white; padding: 10px 20px; border: 0; border-radius: 6px; font-size: 16px; cursor: pointer; width: 100%; }
    .react-select-mock { border: 1px solid #ccc; padding: 8px; border-radius: 4px; background: white; cursor: pointer; position: relative; }
    .react-select-options { display: none; border: 1px solid #aaa; background: white; position: absolute; width: 100%; left: 0; top: 100%; z-index: 10; }
    .react-select-options div { padding: 8px; }
    .react-select-options div:hover { background: #eee; }
  </style>
</head>
<body>
  <h2>Senior Full-Stack Engineer - Acme Corp (Tab 1)</h2>
  <form id="acme_form">
    <div>
      <label for="first_name">First Name</label>
      <input type="text" id="first_name" name="first_name" required />
    </div>
    <div>
      <label for="last_name">Last Name</label>
      <input type="text" id="last_name" name="last_name" required />
    </div>
    <div>
      <label for="email">Email Address</label>
      <input type="email" id="email" name="email" required />
    </div>

    <!-- Dropdown Strategy -->
    <div>
      <label for="highest_edu">Highest Education Level</label>
      <select id="highest_edu" name="highest_edu">
        <option value="">Choose...</option>
        <option value="bachelors">Bachelor's Degree</option>
        <option value="masters">Master's Degree</option>
      </select>
    </div>

    <!-- Custom React Select Dropdown -->
    <div>
      <label>Preferred Country (Custom Select)</label>
      <div class="react-select-mock" id="react_select_country" role="combobox">
        <span class="value-placeholder">Select Country...</span>
        <div class="react-select-options" id="react_options">
          <div data-value="IN">India</div>
          <div data-value="US">United States</div>
        </div>
      </div>
    </div>
    <script>
      const selectMock = document.getElementById('react_select_country');
      const optionsDiv = document.getElementById('react_options');
      selectMock.addEventListener('click', () => {
        optionsDiv.style.display = optionsDiv.style.display === 'block' ? 'none' : 'block';
      });
      optionsDiv.querySelectorAll('div').forEach(opt => {
        opt.addEventListener('click', (e) => {
          selectMock.querySelector('.value-placeholder').textContent = opt.textContent;
          selectMock.setAttribute('data-selected-value', opt.getAttribute('data-value'));
          optionsDiv.style.display = 'none';
          e.stopPropagation();
          selectMock.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    </script>

    <!-- Comma-separated Skills Tag input -->
    <div>
      <label for="skills_tags">Technical Skills</label>
      <input type="text" id="skills_tags" name="skills_tags" placeholder="e.g. Git, Docker" />
    </div>

    <!-- Policy Restricted Expected Salary Field -->
    <div>
      <label for="salary_exp">Salary Expectation (Annual USD)</label>
      <input type="text" id="salary_exp" name="salary_exp" />
    </div>

    <!-- Unsupported range input -->
    <div>
      <label for="flex_range">Skill Proficiency Range</label>
      <input type="range" id="flex_range" name="flex_range" min="1" max="10" />
    </div>

    <!-- Same-origin Iframe containing Resume input -->
    <label>Resume File Input (Nested in same-origin iframe)</label>
    <iframe id="upload_iframe" style="width:100%; height:80px; border: 1px dashed #ccc;" srcdoc="
      <html>
        <body style='margin: 0; font-family: sans-serif; background: #fff;'>
          <div style='padding: 8px;'>
            <input type='file' id='resume_file' name='resume_file' />
          </div>
        </body>
      </html>
    "></iframe>

    <button type="submit" id="submit_button">Submit Application</button>
  </form>
  <script>
    // Simulate page-context AJAX warning (404 fetch)
    setTimeout(() => {
      fetch("/api/some-broken-endpoint-for-testing").catch(() => {});
    }, 1000);

    // Simulate page-context uncaught JavaScript error
    setTimeout(() => {
      Promise.reject(new Error("Simulated Page Context Unhandled Promise Rejection"));
    }, 2000);
  </script>
</body>
</html>
`;

// 2. Tab 2 Mock: LinkedIn Easy Apply modal containing multiple resume cards
const MOCK_HTML_LINKEDIN = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LinkedIn Easy Apply (TAB 2)</title>
  <style>
    body { font-family: sans-serif; background: #eee; margin: 0; padding: 20px; }
    .jobs-easy-apply-modal { background: white; padding: 20px; border-radius: 8px; max-width: 500px; margin: 40px auto; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .jobs-resume-list__resume-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; }
    .jobs-resume-list__resume-item.selected { border-color: #0073b1; background: #f0f7fa; }
    .jobs-document-upload__title { font-weight: bold; }
    .jobs-document-upload__date { font-size: 12px; color: #666; }
    button { background: #0073b1; color: white; padding: 8px 16px; border: 0; border-radius: 16px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body>
  <div class="jobs-easy-apply-modal">
    <h3>Easy Apply - Full-Stack Engineer at LinkedIn</h3>
    
    <div class="jobs-document-upload-redesign">
      <p>Choose an already saved resume or upload a new one:</p>
      
      <div class="jobs-resume-list">
        <!-- Resume Card 1: Outdated -->
        <div class="jobs-resume-list__resume-item" data-test="resume-card">
          <div>
            <span class="jobs-document-upload__title">Old_Master_Resume.pdf</span><br/>
            <span class="jobs-document-upload__date">Jan 1, 2024</span>
          </div>
          <input type="radio" id="resume_1" name="resume_choice" value="old_card" />
        </div>
        
        <!-- Resume Card 2: Newer, should be chosen by SJA based on Date.parse -->
        <div class="jobs-resume-list__resume-item" data-test="resume-card">
          <div>
            <span class="jobs-document-upload__title">Newest_Tailored_Resume.pdf</span><br/>
            <span class="jobs-document-upload__date">Jun 24, 2026</span>
          </div>
          <input type="radio" id="resume_2" name="resume_choice" value="newest_card" />
        </div>
      </div>
      
      <div style="margin-top: 12px;">
        <label>Or upload new resume file:</label>
        <input type="file" id="new_resume_upload" />
      </div>
    </div>
    
    <div style="margin-top: 20px; display: flex; justify-content: space-between;">
      <button id="cancel_button">Cancel</button>
      <button id="next_button">Next step</button>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const extensionPath = path.join(rootDir, "packages", "extension", ".output", "chrome-mv3");
  const reportPath = path.join(rootDir, "realtime_functional_test_log.txt");
  const logStream = fs.createWriteStream(reportPath, { flags: "w" });

  logStream.write("======================================================================\n");
  logStream.write("SUPER JOB AGENT - MULTI-TAB PARALLEL FUNCTIONAL TEST REPORT\n");
  logStream.write("======================================================================\n");
  logStream.write(`Test Timestamp: ${new Date().toLocaleString()}\n`);
  logStream.write(`Extension Path: ${extensionPath}\n\n`);

  console.log("Launching browser with extension...");
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Route Tab 1 (Acme Greenhouse) & Tab 2 (LinkedIn Easy Apply)
  const acmeUrl = "https://boards.greenhouse.io/apply-acme-job";
  const linkedInUrl = "https://www.linkedin.com/jobs/view/12345/";

  await page1.route(acmeUrl, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: MOCK_HTML_GREENHOUSE });
  });
  await page2.route(linkedInUrl, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: MOCK_HTML_LINKEDIN });
  });

  const addLog = (text: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${text}`;
    logStream.write(formatted + "\n");
    console.log(formatted);
  };

  // Monitor page console logs for Tab 1 (Greenhouse)
  page1.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("SJA:") || text.includes("autofill") || text.includes("filler") || text.includes("diagnostics")) {
      addLog(`[TAB 1] [PAGE CONSOLE] ${text}`);
    }
  });
  page1.on("pageerror", (err) => {
    addLog(`[TAB 1] [PAGE UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
  });

  // Monitor page console logs for Tab 2 (LinkedIn Easy Apply)
  page2.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("SJA:") || text.includes("autofill") || text.includes("filler") || text.includes("diagnostics") || text.includes("autopilot")) {
      addLog(`[TAB 2] [PAGE CONSOLE] ${text}`);
    }
  });
  page2.on("pageerror", (err) => {
    addLog(`[TAB 2] [PAGE UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
  });

  // Attach CDP to background Service Worker to stream background telemetry
  context.on("serviceworker", async (worker) => {
    addLog(`[BACKGROUND WORKER INITIALIZED] ${worker.url()}`);
    try {
      const cdp = await context.newCDPSession(worker);
      await cdp.send("Runtime.enable");
      cdp.on("Runtime.consoleAPICalled", (event) => {
        const text = event.args
          .map((arg) => (arg.value !== undefined ? String(arg.value) : arg.description || JSON.stringify(arg)))
          .join(" ");
        if (text.includes("autofill") || text.includes("diagnostics") || text.includes("SJA:") || text.includes("filler") || text.includes("autopilot")) {
          addLog(`[BG SW CONSOLE] [${event.type.toUpperCase()}] ${text}`);
        }
      });
    } catch (e: any) {
      addLog(`[CDP SW MON FAIL] ${e.message}`);
    }
  });

  addLog("Waiting for extension setup...");
  await page1.waitForTimeout(2500);

  // Navigate both pages to their target Greenhouse and LinkedIn routes
  addLog(`[TAB 1] Navigating to Greenhouse mock form: ${acmeUrl}`);
  await page1.goto(acmeUrl);
  
  addLog(`[TAB 2] Navigating to LinkedIn Easy Apply mock modal: ${linkedInUrl}`);
  await page2.goto(linkedInUrl);

  await page1.waitForTimeout(4000);

  // Inject profile mock & settings into storage
  addLog("Injecting user profile mock & settings...");
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  if (sw) {
    await sw.evaluate(async () => {
      // Mock resume file blob content (simulates uploaded PDF resume)
      const fakeBlobContent = "Fake Master PDF Content for verification checks";
      const blob = new Blob([fakeBlobContent], { type: "application/pdf" });
      const reader = new FileReader();
      
      const blobDataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      await chrome.storage.local.set({
        // Store resume blob
        resumeBlob: blobDataUrl,
        profile: {
          firstName: "Shashi",
          lastName: "Kumar Banoth",
          email: "shashikumarbanoth91@gmail.com",
          phone: "+919182805541",
          dateOfBirth: "2005-06-24",
          gender: "Male",
          workAuthorization: "Authorized to work in India",
          sponsorship: "no",
          skills: ["python", "pytorch", "react", "git", "docker"],
          resumeFileName: "Shashi_Resume_Master.pdf",
          masterResumeText: "Full-Stack Software Engineer. Skills: Python, React, Git, Docker.",
          experience: [],
          education: [],
          projects: [],
          customAnswers: {},
          currentCTC: "12",
          expectedCTC: "18",
          noticePeriod: "Immediate"
        },
        settings: {
          autonomousMode: true, 
          autoClickEasyApply: true,
          autoFillSteps: true,
          autoAdvanceSteps: true,
          autoSubmit: false
        }
      });
    });
  }

  // Trigger SJA autofill on Tab 1 & SJA autopilot on Tab 2 concurrently
  addLog("Triggering SJA Autofill on Tab 1 & SJA Autopilot on Tab 2 concurrently...");
  if (sw) {
    const triggerResult = await sw.evaluate(async (patterns) => {
      const results: string[] = [];
      
      // 1. Autofill Tab 1 (Greenhouse)
      const tabs1 = await chrome.tabs.query({ url: patterns[0] });
      if (tabs1.length && tabs1[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs1[0].id, { type: "SJA:AUTOFILL" });
          results.push(`Autofill triggered on Tab ${tabs1[0].id}`);
        } catch (e: any) {
          results.push(`Autofill failed: ${e.message}`);
        }
      }

      // 2. Autopilot Tab 2 (LinkedIn Easy Apply Resume selection wizard)
      const tabs2 = await chrome.tabs.query({ url: patterns[1] });
      if (tabs2.length && tabs2[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs2[0].id, { type: "SJA:AUTOPILOT" });
          results.push(`Autopilot triggered on Tab ${tabs2[0].id}`);
        } catch (e: any) {
          results.push(`Autopilot failed: ${e.message}`);
        }
      }

      return results.join(" | ");
    }, ["*://boards.greenhouse.io/apply-acme-job", "*://www.linkedin.com/jobs/view/*"]);
    addLog(`Autofill & Autopilot trigger outcomes: ${triggerResult}`);
  }

  addLog("Processing application actions on both tabs. Capturing real-time execution steps...");
  await page1.waitForTimeout(10000);

  addLog("All tasks completed. Reading diagnostic records from local database...");
  if (sw) {
    const rawDiagnostics = await sw.evaluate(async () => {
      const data = await chrome.storage.local.get("diagnostics");
      return data.diagnostics || [];
    });

    logStream.write("\n\n" + "=".repeat(80) + "\n");
    logStream.write("CONSOLIDATED DIAGNOSTIC LOG DATABASE ENTRIES:\n");
    logStream.write("=".repeat(80) + "\n");

    for (const entry of rawDiagnostics) {
      const dateStr = new Date(entry.ts).toLocaleTimeString();
      const line = `[DIAG][${dateStr}][${entry.level.toUpperCase()}][SJA:${entry.area}] ${entry.message} - ${entry.data ? JSON.stringify(entry.data) : ""}`;
      logStream.write(line + "\n");
      console.log(line);
    }
  }

  // 12. Explanation and Architecture Diagnostics block (Operation Zero-Defect)
  logStream.write("\n\n" + "=".repeat(80) + "\n");
  logStream.write("DETAILED EXPLANATION: CLICK DELAYS, COOKIES, AND LOGIN/SIGNUP BEHAVIOR\n");
  logStream.write("=".repeat(80) + "\n");
  logStream.write(`
1. WHY BUTTON CLICKS AND STEP ADVANCEMENTS TAKE TIME:
   - Anti-Bot Heuristics: SJA intentionally implements artificial delays when interacting with DOM elements. In 'packages/extension/src/lib/linkedin-autopilot.ts', the 'animateAndClick()' method calls 'moveCursorTo()' and 'animateClick()', simulating human-like cursor paths and click cycles. This prevents detection by anti-bot frameworks (e.g. Cloudflare, Datadome, or LinkedIn's tracking scripts).
   - Form Validation Constraints: If a button is clicked but the step does not advance, it is typically because the form has a native, client-side validation error (e.g. required dropdowns or regex-validated text inputs left blank).
   - Stagnancy Detection: If a page gets stuck, SJA's stagnant detector ('packages/extension/src/lib/autopilot/stagnant-detector.ts') monitors step-hashes. If the hash does not change for ${path.join("consecutive")} cycles, SJA pauses and prompts the user to resolve the blocker.

2. WHY COOKIE CONSENT BANNERS ARE NOT AUTOMATICALLY HANDLED:
   - High Interface Fragmentation: Cookie consent frames (like OneTrust, Cookiebot, or Iubenda) vary wildly in layout, use nested Shadow DOM roots, and deploy obfuscated class names. Auto-accepting them might trigger unexpected redirects or block browser rendering.
   - Privacy Boundaries: Automatically agreeing to cookies violates local privacy policies (e.g., GDPR/CCPA) without user visibility. SJA ignores these banners and recommends standard ad-blockers (like uBlock Origin or 'I Don't Care About Cookies') to clean up banners cleanly.

3. WHY CREATING ACCOUNTS, CONFIRM PASSWORDS, AND SIGN-UPS ARE PAUSED:
   - Account Creation Boundary: Automatically registering on new third-party career sites has severe legal (Terms of Service violations for automated signups) and security risks. Further, registration screens typically feature CAPTCHAs, MFA prompts, or email verification flows that cannot be solved programmatically.
   - Credentials Autofill Only: SJA's 'LoginCoordinator' and 'autofillLogin()' are designed specifically for logging into EXISTING accounts using matching credentials in 'credential-store.ts'. On new account creation pages, SJA will autofill standard fields (like Email, Password, and Confirm Password if they match standard classification), but it will halt and yield control to the user to solve CAPTCHAs and finalize registration.
`);

  addLog("Closing browser context...");
  await context.close();

  logStream.write("\n\n======================================================================\n");
  logStream.write("END OF MULTI-TAB PARALLEL TEST REPORT\n");
  logStream.write("======================================================================\n");
  logStream.end();
  console.log(`\nConsolidated multi-tab log report saved to: ${reportPath}`);
}

main().catch(console.error);
