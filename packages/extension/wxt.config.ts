import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JOB_HOST_MATCHES } from "./src/lib/permission-policy";

// Content scripts may use granular path patterns. Host permissions and
// web-accessible-resource matches must be valid origin-style patterns.
const JOB_HOST_PERMISSION_PATTERNS = [...new Set(JOB_HOST_MATCHES.map((pattern) => {
  const match = pattern.match(/^(\*|http|https):\/\/([^/]+)\//);
  if (!match) throw new Error(`Invalid job host match pattern: ${pattern}`);
  return `${match[1]}://${match[2]}/*`;
}))];

// Ensure pdf.worker.min.mjs is copied to the public folder during configuration loading
try {
  const require = createRequire(import.meta.url);
  const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.join(__dirname, "src/public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const workerDest = path.join(publicDir, "pdf.worker.min.mjs");
  
  let shouldCopy = true;
  if (fs.existsSync(workerDest)) {
    const srcStat = fs.statSync(workerSrc);
    const destStat = fs.statSync(workerDest);
    if (srcStat.size === destStat.size) {
      shouldCopy = false;
    }
  }
  
  if (shouldCopy) {
    fs.copyFileSync(workerSrc, workerDest);
    console.log("Successfully copied pdf.worker.min.mjs to src/public");
  }
} catch (err) {
  console.error("Failed to copy pdf.worker.min.mjs:", err);
}


export default defineConfig({
  srcDir: "src",
  // WXT 0.20 defaults public assets to project-root/public. This project
  // deliberately keeps extension assets beside source under src/public.
  publicDir: "src/public",
  hooks: {
    "entrypoints:found": (_wxt, entrypoints) => {
      for (let index = entrypoints.length - 1; index >= 0; index--) {
        if (path.basename(entrypoints[index].inputPath).includes("-shashikumar.")) {
          entrypoints.splice(index, 1);
        }
      }
    },
    "build:done": (wxt, output) => {
      for (let index = output.publicAssets.length - 1; index >= 0; index--) {
        const asset = output.publicAssets[index];
        if (!asset.fileName.includes("-shashikumar.")) continue;

        const filePath = path.resolve(wxt.config.outDir, asset.fileName);
        const relativePath = path.relative(wxt.config.outDir, filePath);
        if (
          !relativePath ||
          relativePath === ".." ||
          relativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativePath)
        ) {
          throw new Error(`Refusing to remove a build asset outside the output directory: ${asset.fileName}`);
        }
        fs.rmSync(filePath, { force: true });
        output.publicAssets.splice(index, 1);
      }
    },
    // Keep the popup as the primary quick-action surface; profile management
    // and account settings live on the synced web dashboard.
  },
  manifest: {
    name: "Super Job Agent",
    description: "AI-powered job application auto-filler and copilot.",
    version: "0.1.5",
    permissions: [
      "storage",
      "activeTab",
      "tabs",
      "alarms",
      "contextMenus",
      "sidePanel",
      "offscreen",
      "scripting"
    ],
    commands: {
      "autofill-page": {
        suggested_key: { default: "Alt+Shift+F", mac: "Alt+Shift+F" },
        description: "Auto-fill the active job page"
      },
      "open-popup": {
        suggested_key: { default: "Alt+Shift+A", mac: "Alt+Shift+A" },
        description: "Open Super Job Agent side panel"
      }
    },
    // Known ATS/job domains are granted at install time. We also request
    // <all_urls> so the auto-fill engine works on arbitrary company career
    // pages without requiring a second permission prompt. Sensitive pages
    // (chrome://, webstores, internal) are protected by the MV3 scheme filter
    // and the extension's own permission-policy gate.
    host_permissions: [...JOB_HOST_PERMISSION_PATTERNS, "<all_urls>"],
    optional_host_permissions: [],
    side_panel: {
      default_path: "sidepanel.html"
    },
    web_accessible_resources: [
      {
        resources: [
          "ats-config-chunks/*.json",
          "pdf.worker.min.mjs",
          "content-scripts/agent.js",
          "content-scripts/orchestrator.js",
          "demo-job.html",
          "demo-job.js",
          "onboarding.html",
          "popup.html",
          "sidepanel.html",
        ],
        matches: ["<all_urls>"]
      }
    ]
  },
  vite: () => ({
    resolve: {
      alias: {
        "@superjob/ats-config": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ats-config/src/index.ts"),
        "@superjob/crew/fleet": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../crew/src/fleet/index.ts"),
      },
    },
    plugins: [react()],
    esbuild: {
      // Emit non-ASCII as \uXXXX escapes instead of raw UTF-8 bytes. With the
      // default "utf8" charset, esbuild constant-folds authored escapes and
      // String.fromCharCode(0xffff) into a *literal U+FFFF noncharacter*, which
      // Chrome's strict script loader rejects ("isn't UTF-8 encoded") and which
      // previously broke content-script injection (content-scripts/agent.js).
      charset: "ascii",
    },
    build: {
      // WXT handles content script bundling via esbuild, which is safer here.
      minify: "esbuild",
      cssMinify: "esbuild",
    },
  } as any),
});
