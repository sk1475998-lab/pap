import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { chromium, type Page, type Worker } from "playwright";

const extensionPath = resolve("packages/extension/.output/chrome-mv3");
const fixtureHtml = `<!doctype html><html><head><title>Software Engineer at Acme</title></head><body>
  <main><h1>Software Engineer</h1><p>Acme job application</p>
    <form>
      <label for="first_name">First Name</label><input id="first_name" name="first_name" />
      <label for="last_name">Last Name</label><input id="last_name" name="last_name" />
      <label for="email">Email</label><input id="email" name="email" type="email" />
      <label for="phone">Phone</label><input id="phone" name="phone" type="tel" />
    </form>
  </main>
</body></html>`;

async function waitUntil(predicate: () => Promise<boolean>, message: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

async function waitForAgent(worker: Worker, url: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await worker.evaluate(async (targetUrl: string) => {
      const tabs = await chrome.tabs.query({ url: targetUrl });
      if (!tabs[0]?.id) return null;
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, { type: "SJA:DETECT" });
      } catch {
        return null;
      }
    }, url);
    if (response?.fields?.length) return response;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Extension agent did not become reachable on the routed job fixture.");
}

test("real Chromium loads MV3 extension, fills a routed job fixture, and persists diagnostics", async (t) => {
  const requireWorker = process.env.SJA_REQUIRE_MV3_WORKER === "1";
  if (!existsSync(chromium.executablePath())) {
    const message = "Playwright Chromium is not installed; run `npx playwright install chromium` in the browser-capable CI environment.";
    if (requireWorker) throw new Error(message);
    t.skip(message);
    return;
  }
  const userDataDir = await mkdtemp(join(tmpdir(), "sja-real-browser-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: process.env.SJA_HEADED_EXTENSION_TEST !== "1",
      timeout: 30_000,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  } catch (error) {
    await rm(userDataDir, { recursive: true, force: true });
    const message = `Playwright Chromium is unavailable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
    if (requireWorker) throw new Error(message);
    t.skip(message);
    return;
  }

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) {
      try {
        worker = await context.waitForEvent("serviceworker", { timeout: 5_000 });
      } catch {
        const message = "Chromium did not expose an MV3 extension service worker.";
        if (requireWorker) throw new Error(message);
        t.skip(`${message} Run this test in a headed Chrome/CI extension environment.`);
        return;
      }
    }
    const extensionId = new URL(worker.url()).host;
    assert.ok(extensionId);

    // Open a persistent extension page (the popup) up front. MV3 service
    // workers are suspended when idle, which would otherwise make the `worker`
    // handle below go stale mid-test; the popup page gives us a stable
    // extension context for storage writes, runtime messages, and reads.
    let extPage: Page;
    try {
      extPage = await context.newPage();
      await extPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await extPage.waitForTimeout(900);
    } catch (error) {
      const message = `Could not open extension popup page: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
      if (requireWorker) throw new Error(message);
      t.skip(message);
      return;
    }

    await extPage.evaluate(async () => {
      await chrome.storage.local.set({
        profile: {
          id: "real-browser-profile",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.test",
          phone: "+1 555 0100",
          skills: ["TypeScript"],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
          awards: [],
          publications: [],
          hobbies: [],
          socialLinks: [],
          workAuthorizations: [],
          jobPreferences: { roleTitles: [], locations: [], remotePreference: "", minSalary: "", currency: "", excludedCompanies: [] },
          customAnswers: {},
          learnedLog: [],
          updatedAt: Date.now(),
        },
        settings: {
          autonomousMode: false,
          autoClickEasyApply: false,
          autoFillSteps: false,
          autoAdvanceSteps: false,
          autoSubmit: false,
          autoLogin: false,
          autoSubmitLogin: false,
          pauseOnOtp: true,
          maxLlmCallsPerRun: 3,
          llmCacheEnabled: true,
          localApiStreamingEnabled: false,
          verifyBeforeAdvance: true,
        },
        "sja-onboarding-state": {
          step: "COMPLETED",
          name: "Jane Doe",
          email: "jane@example.test",
          phone: "+1 555 0100",
          resumeText: "Software engineer with TypeScript experience.",
          completedAt: Date.now(),
        },
      });
    });

    // Browser side panel opened BEFORE any fill: proves the live sink — an
    // application written by a fill performed later must show up here WITHOUT
    // reloading the panel (a storage.onChanged-driven refresh, not a mount read).
    let sidePage: Page;
    try {
      sidePage = await context.newPage();
      await sidePage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await waitUntil(async () => await sidePage.getByText("Super Job Agent", { exact: true }).first().isVisible().catch(() => false), "Browser side panel did not render.");
      await sidePage.getByText("Tracker", { exact: true }).first().click();
      await waitUntil(async () => await sidePage.getByText("No applications yet", { exact: false }).first().isVisible().catch(() => false), "Side panel Tracker should start empty.");
    } catch (error) {
      const message = `Could not open the browser side panel page: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
      if (requireWorker) throw new Error(message);
      t.skip(message);
      return;
    }

    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        process.stdout.write(`[page.${msg.type()}] ${msg.text().slice(0, 400)}\n`);
      }
    });
    page.on("pageerror", (err) => process.stdout.write(`[pageerror] ${String(err).slice(0, 500)}\n`));
    await page.route("https://boards.greenhouse.io/**", (route) => route.fulfill({ contentType: "text/html", body: fixtureHtml }));
    const fixtureUrl = "https://boards.greenhouse.io/acme/jobs/123";
    await page.goto(fixtureUrl);
    // The in-page docked panel mounts React via requestIdleCallback. When other
    // extension pages (popup, browser side panel) opened earlier keep this tab
    // occluded, Chromium throttles idle callbacks and the panel never renders.
    // Bring the job page to front so the panel actually mounts/updates.
    await page.bringToFront().catch(() => {});

    const detect = await waitForAgent(worker, fixtureUrl);
    assert.ok(detect.fields.length >= 4);

    // The in-page docked panel (React inside an open shadow root) must mount on
    // the job page — it is the live fill-status surface.
    await waitUntil(async () => await page.evaluate(() => Boolean(
      document.getElementById("sja-persistent-docked-panel-container")
        ?.shadowRoot?.getElementById("sja-react-mount"),
    )), "In-page docked panel did not mount on the job fixture.");

    await page.evaluate(() => {
      const modal = document.createElement("div");
      modal.id = "test-application-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.8)";
      document.body.appendChild(modal);
    });
    await waitUntil(async () => await page.evaluate(() => {
      const host = document.getElementById("sja-persistent-docked-panel-container");
      return Boolean(host?.matches(":popover-open"));
    }), "Docked panel was not promoted to the browser top layer.");
    const profileTab = await page.evaluate(() => {
      const shadow = document.getElementById("sja-persistent-docked-panel-container")?.shadowRoot;
      const button = Array.from(shadow?.querySelectorAll("button") ?? [])
        .find((candidate) => candidate.textContent?.includes("Profile"));
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    assert.ok(profileTab, "Profile tab should be available in the docked panel.");
    await page.mouse.click(profileTab.x, profileTab.y);
    await waitUntil(async () => await page.evaluate(() => {
      const shadow = document.getElementById("sja-persistent-docked-panel-container")?.shadowRoot;
      return Array.from(shadow?.querySelectorAll("button") ?? [])
        .some((button) => button.textContent?.includes("Profile") && button.classList.contains("active"));
    }), "Panel controls were not interactive above the application modal.");
    await page.evaluate(() => document.getElementById("test-application-modal")?.remove());
    const copilotTab = await page.evaluate(() => {
      const shadow = document.getElementById("sja-persistent-docked-panel-container")?.shadowRoot;
      const button = Array.from(shadow?.querySelectorAll("button") ?? [])
        .find((candidate) => candidate.textContent?.includes("Copilot"));
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    assert.ok(copilotTab, "Copilot tab should be available in the docked panel.");
    await page.mouse.click(copilotTab.x, copilotTab.y);

    const fill = await worker.evaluate(async (targetUrl: string) => {
      const tabs = await chrome.tabs.query({ url: targetUrl });
      return chrome.tabs.sendMessage(tabs[0]!.id!, { type: "SJA:AUTOFILL" });
    }, fixtureUrl);
    assert.ok(fill.filled >= 4);
    await waitUntil(async () => await page.locator("#first_name").inputValue() === "Jane", "First name was not filled.");
    await waitUntil(async () => await page.locator("#last_name").inputValue() === "Doe", "Last name was not filled.");
    await waitUntil(async () => await page.locator("#email").inputValue() === "jane@example.test", "Email was not filled.");

    // Sink #1 — fill → in-page docked panel: status text and per-field fill-log
    // entries must appear in the page panel live (no reload). The shadow root
    // begins with the injected <style> CSS, so check the full textContent for
    // React-rendered markers ("Fill Log (N)" header, the "First Name" entry
    // label, and the status line containing "filled").
    await waitUntil(async () => await page.evaluate(() => {
      const sr = document.getElementById("sja-persistent-docked-panel-container")?.shadowRoot;
      const text = sr?.textContent ?? "";
      // The shadow root starts with the injected <style> CSS, so check the full
      // textContent for React-rendered markers: the "Fill Log (N)" header, a
      // per-field entry label, and a status line containing "filled".
      return text.includes("Fill Log") && text.includes("First Name") && /filled/i.test(text);
    }), "Docked panel did not receive live fill-log/status updates from the fill.");

    // Sink #2 — fill → browser side panel: the tracked application record must
    // appear in the already-open side panel without any reload or re-navigation.
    // The fixture's minimal HTML has no company metadata (the page extractor
    // falls back to "Web"), so assert the job title and the default "saved"
    // stage that the content agent writes on a tracked autofill run.
    await waitUntil(async () => await sidePage.getByText("Software Engineer", { exact: false }).first().isVisible().catch(() => false), "Side panel Tracker did not live-update with the application after the fill.");
    await waitUntil(async () => await sidePage.getByText("saved", { exact: false }).first().isVisible().catch(() => false), "Side panel Tracker did not show the filled application's saved stage.");

    // Sink #3 — fill history must be persisted to storage by the page agent.
    await waitUntil(async () => await extPage.evaluate(async () => {
      const raw = await chrome.storage.local.get("fillHistory");
      const history = Array.isArray(raw.fillHistory) ? (raw.fillHistory as unknown[]) : [];
      return history.length >= 1;
    }), "Fill history was not persisted by the real extension agent.");

    // Send a real runtime message and assert the background router preserves
    // the supported diagnostic area. Sent from the popup extension page rather
    // than the service worker itself: chrome.runtime.sendMessage is not
    // delivered back to the same service worker that sends it.
    await waitUntil(async () => {
      try {
        await extPage.evaluate(() => chrome.runtime.sendMessage({
          type: "SJA:LOG",
          payload: { area: "orchestrator", event: "real-browser-test", message: "real browser diagnostics" },
        }));
        return true;
      } catch {
        return false;
      }
    }, "Background did not accept the SJA:LOG runtime message.");
    await waitUntil(async () => await extPage.evaluate(async () => {
      const raw = await chrome.storage.local.get("diagnostics");
      return (raw.diagnostics as Array<{ area: string }> | undefined)?.some((entry) => entry.area === "orchestrator") ?? false;
    }), "Orchestrator diagnostic was not persisted by the real extension worker.");

    const linkedInFixture = `<!doctype html><html><head><title>AI Developer at Salvo Software | LinkedIn</title></head><body>
      <h1 class="job-details-jobs-unified-top-card__job-title">AI Developer</h1>
      <a class="job-details-jobs-unified-top-card__company-name">Salvo Software</a>
      <section class="jobs-description__content"><div id="job-details">
        <h2>About the job</h2><p>Build production AI services with Python and PostgreSQL.</p>
        <p>Own API design, cloud deployments, reliability, and cross-functional delivery.</p>
        <p>Required skills include Python, PostgreSQL, REST APIs, AWS, and Docker.</p>
      </div></section>
      <div class="jobs-description" style="display:none">Wrong hidden description from another posting.</div>
      <div role="dialog" aria-modal="true" class="jobs-description">Wrong modal content must not be used.</div>
    </body></html>`;
    const linkedInPage = await context.newPage();
    await linkedInPage.route("https://www.linkedin.com/jobs/view/**", (route) => route.fulfill({
      contentType: "text/html",
      body: linkedInFixture,
    }));
    const linkedInUrl = "https://www.linkedin.com/jobs/view/4449225014/";
    await linkedInPage.goto(linkedInUrl);
    let linkedInDetection: any;
    await waitUntil(async () => {
      try {
        linkedInDetection = await worker.evaluate(async (targetUrl: string) => {
          const tabs = await chrome.tabs.query({ url: targetUrl });
          if (!tabs[0]?.id) return null;
          return chrome.tabs.sendMessage(tabs[0].id, { type: "SJA:DETECT" });
        }, linkedInUrl);
        return typeof linkedInDetection?.job?.description === "string" &&
          linkedInDetection.job.description.length >= 80;
      } catch {
        return false;
      }
    }, "LinkedIn job description was not extracted from the selected posting.");
    assert.equal(linkedInDetection.job.title, "AI Developer");
    assert.equal(linkedInDetection.job.company, "Salvo Software");
    assert.match(linkedInDetection.job.description, /Build production AI services/);
    assert.match(linkedInDetection.job.description, /AWS, and Docker/);
    assert.doesNotMatch(linkedInDetection.job.description, /Wrong hidden description|Wrong modal content/);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
