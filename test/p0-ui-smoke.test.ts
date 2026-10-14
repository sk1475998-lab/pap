/**
 * P0 UI smoke tests against the built MV3 extension in a real Chromium
 * extension context. `file://` is not representative: it cannot load extension
 * APIs and rejects the absolute asset URLs emitted by WXT.
 *
 * Run after `npm run build:ext`: npx tsx --test test/p0-ui-smoke.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "packages", "extension", ".output", "chrome-mv3");

let context: BrowserContext;
let userDataDir: string;
let extensionId: string;

async function openExtensionPage(file: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${file}`);
  return page;
}

test.before(async () => {
  userDataDir = await mkdtemp(path.join(os.tmpdir(), "sja-p0-ui-smoke-"));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    timeout: 30_000,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${OUT}`,
      `--load-extension=${OUT}`,
    ],
  });

  const worker = context.serviceWorkers()[0] ??
    await context.waitForEvent("serviceworker", { timeout: 20_000 });
  extensionId = new URL(worker.url()).host;
});

test.after(async () => {
  await context?.close();
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true });
});

test("popup: every current navigation tab mounts and switches", async () => {
  const page = await openExtensionPage("popup.html");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator("#root").waitFor({ state: "attached" });

  for (const label of ["Apply", "Jobs", "Profile", "Tracker", "ATS Score", "Intel", "Campaigns", "Settings"]) {
    const tab = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    await tab.waitFor({ state: "visible" });
    await tab.click();
  }

  await page.getByRole("button", { name: /Profile/i }).first().click();
  await page.getByRole("heading", { name: "Profile from Dashboard" }).waitFor({ state: "visible" });
  assert.equal(await page.locator(".tab-content input, .tab-content textarea").count(), 0);
  await page.getByRole("link", { name: /Open Dashboard to manage profile/i }).waitFor({ state: "visible" });

  const refresh = page.getByRole("button", { name: /refresh/i }).first();
  await assert.doesNotReject(() => refresh.click());
  assert.deepEqual(errors, []);
  await page.close();
});

test("sidepanel: dashboard-managed profile workflow and application actions mount", async () => {
  const page = await openExtensionPage("sidepanel.html");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator("main").waitFor({ state: "visible" });

  await page.getByRole("button", { name: /Autofill page/i }).click();
  await page.getByRole("button", { name: /Check match/i }).waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  await page.close();
});

test("onboarding: primary action and close action are available", async () => {
  const page = await openExtensionPage("onboarding.html");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const openButton = page.locator("#openPopup");
  const closeButton = page.locator("#closeTab");
  await openButton.waitFor({ state: "visible" });
  await closeButton.waitFor({ state: "visible" });
  assert.match(await page.locator("body").innerText(), /Super Job Agent/);
  await openButton.click();
  assert.deepEqual(errors, []);
  await page.close();
});

test("built manifest declares keyboard commands and excludes preserved source copies", async () => {
  const manifest = JSON.parse(await readFile(path.join(OUT, "manifest.json"), "utf8"));
  assert.equal(manifest.commands?.["autofill-page"]?.suggested_key?.default, "Alt+Shift+F");
  assert.equal(manifest.commands?.["open-popup"]?.suggested_key?.default, "Alt+Shift+A");
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("sidePanel"));

  const scan = async (directory: string): Promise<string[]> => {
    const { readdir } = await import("node:fs/promises");
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await scan(absolute));
      else if (entry.name.includes("-shashikumar.")) files.push(absolute);
    }
    return files;
  };
  assert.deepEqual(await scan(OUT), []);
});
