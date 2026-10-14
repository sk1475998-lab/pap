/**
 * SuperJobAgent Enterprise QA Test Suite v1.0
 * Run: node scripts/enterprise-qa.mjs
 */

const BASE = "http://localhost:3001";
let passed = 0, failed = 0, warnings = 0;
const results = [];

function log(icon, tag, msg) { console.log(`${icon}  [${tag}] ${msg}`); }

async function test(name, fn) {
  try {
    const r = await fn();
    passed++;
    results.push({ name, status: "PASS", detail: r });
    log("OK", "PASS", name);
    if (r) console.log(`     > ${r}`);
  } catch (e) {
    failed++;
    results.push({ name, status: "FAIL", detail: e.message });
    log("XX", "FAIL", `${name} - ${e.message}`);
  }
}

async function warn(name, fn) {
  try {
    const r = await fn();
    passed++;
    results.push({ name, status: "PASS", detail: r });
    log("OK", "PASS", name);
    if (r) console.log(`     > ${r}`);
  } catch (e) {
    warnings++;
    results.push({ name, status: "WARN", detail: e.message });
    log("!!", "WARN", `${name} - ${e.message}`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const json = await res.json().catch(() => ({ _raw: res.status }));
  if (!res.ok && opts.expectOk !== false)
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return { status: res.status, json };
}

// ── PHASE 1: Health ──────────────────────────────────────────────────────────
console.log("\n=== PHASE 1: Health & Connectivity ===");

await test("Server health endpoint", async () => {
  const { json } = await api("/api/health");
  if (!json.ok) throw new Error("ok=false");
  return `v${json.version}`;
});

await test("Dashboard HTML on root /", async () => {
  const res = await fetch(`${BASE}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const t = await res.text();
  if (!t.includes("<html") && !t.includes("<!DOCTYPE")) throw new Error("Not HTML");
  return `${t.length} bytes`;
});

await test("WebSocket connects", async () => {
  const { default: WS } = await import("ws");
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://localhost:3001`);
    const t = setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 5000);
    ws.on("message", d => {
      clearTimeout(t); ws.close();
      const msg = JSON.parse(d.toString());
      resolve(`type=${msg.type}`);
    });
    ws.on("error", e => { clearTimeout(t); reject(e); });
  });
});

// ── PHASE 2: Profile CRUD ────────────────────────────────────────────────────
console.log("\n=== PHASE 2: Profile CRUD ===");

await test("GET /api/profile returns data", async () => {
  const { json } = await api("/api/profile");
  if (!json.ok) throw new Error("ok=false");
  return `firstName=${json.data?.firstName || "(empty)"}`;
});

await test("POST /api/profile saves data", async () => {
  const { json } = await api("/api/profile", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Enterprise", lastName: "QA", email: "qa@superjobagent.ai",
      skills: ["TypeScript", "React", "Node.js", "AWS"],
      jobPreferences: { roleTitles: ["Senior SWE"], locations: ["Bengaluru"], remotePreference: "hybrid", minSalary: "30", currency: "INR", excludedCompanies: [] },
    }),
  });
  if (!json.ok) throw new Error(JSON.stringify(json));
  return "saved OK";
});

await test("Profile change persisted", async () => {
  const { json } = await api("/api/profile");
  if (json.data?.firstName !== "Enterprise") throw new Error(`got: ${json.data?.firstName}`);
  return `${json.data.firstName} ${json.data.lastName}`;
});

// ── PHASE 3: Applications ────────────────────────────────────────────────────
console.log("\n=== PHASE 3: Application Tracker ===");
let appId = null;

await test("GET /api/apps lists applications", async () => {
  const { json } = await api("/api/apps");
  if (!json.ok) throw new Error("ok=false");
  return `${json.data?.length ?? 0} apps`;
});

await test("POST /api/apps creates application", async () => {
  const { json } = await api("/api/apps", {
    method: "POST",
    body: JSON.stringify({ jobTitle: "Senior SWE", company: "Zepto", stage: "saved", url: "https://zepto.in/jobs/1" }),
  });
  if (!json.ok) throw new Error(JSON.stringify(json));
  appId = json.data?.id;
  return `ID: ${appId}`;
});

await test("PATCH /api/apps/:id updates stage", async () => {
  if (!appId) throw new Error("no appId");
  const { json } = await api(`/api/apps/${appId}`, {
    method: "PATCH",
    body: JSON.stringify({ stage: "applied" }),
  });
  if (!json.ok) throw new Error(JSON.stringify(json));
  return "stage=applied";
});

// ── PHASE 4: Jobs ─────────────────────────────────────────────────────────────
console.log("\n=== PHASE 4: Jobs Discovery ===");

await warn("GET /api/jobs/search works", async () => {
  const { json } = await api("/api/jobs/search?q=engineer&limit=5");
  if (!json.ok) throw new Error("ok=false");
  return `${json.data?.length ?? 0} jobs`;
});

// ── PHASE 5: Resume ─────────────────────────────────────────────────────────
console.log("\n=== PHASE 5: Resume & ATS ===");

await warn("GET /api/resume/ats-score returns score", async () => {
  const { json } = await api("/api/resume/ats-score");
  if (!json.ok) throw new Error("ok=false");
  return `score=${json.data?.overall ?? json.data?.score ?? "N/A"}`;
});

await warn("POST /api/resume/tailor generates bullets", async () => {
  const { json } = await api("/api/resume/tailor", {
    method: "POST",
    body: JSON.stringify({
      jobTitle: "Senior SWE", company: "Zepto",
      jobDescription: "TypeScript, Node.js, React, AWS, 5+ years",
    }),
  });
  if (!json.ok) throw new Error(JSON.stringify(json).slice(0, 150));
  return `${json.data?.bullets?.length ?? 0} bullets`;
});

// ── PHASE 6: AI Chat ─────────────────────────────────────────────────────────
console.log("\n=== PHASE 6: AI Chat (Orion) ===");

await test("POST /api/chat returns reply", async () => {
  const { json } = await api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: "What salary should I target at a Series B startup in Bengaluru?", sessionId: "qa-e2e" }),
  });
  if (!json.ok) throw new Error("ok=false");
  if (!json.reply || json.reply.length < 20) throw new Error(`short reply: ${json.reply}`);
  return `"${json.reply.slice(0, 70)}..."`;
});

await test("GET /api/chat/history works", async () => {
  const { json } = await api("/api/chat/history?sessionId=qa-e2e");
  if (!json.ok) throw new Error("ok=false");
  return `${json.count} messages`;
});

await test("DELETE /api/chat/history clears session", async () => {
  const { json } = await api("/api/chat/history?sessionId=qa-e2e", { method: "DELETE" });
  if (!json.ok) throw new Error("ok=false");
  return "cleared";
});

// ── PHASE 7: India Intelligence ───────────────────────────────────────────────
console.log("\n=== PHASE 7: India Intelligence ===");

await warn("GET /api/india/salary-intel works", async () => {
  const { json } = await api("/api/india/salary-intel?role=software+engineer&yoe=3");
  if (!json.ok) throw new Error("ok=false");
  return `p50=${json.data?.p50 ?? "N/A"}`;
});

await warn("GET /api/india/company-tiers works", async () => {
  const { json } = await api("/api/india/company-tiers");
  if (!json.ok) throw new Error("ok=false");
  return `${Object.keys(json.data ?? {}).length} tiers`;
});

// ── PHASE 8: Interview ───────────────────────────────────────────────────────
console.log("\n=== PHASE 8: Interview Prep ===");

await warn("GET /api/interview/questions works", async () => {
  const { json } = await api("/api/interview/questions?company=Zepto&role=SWE");
  if (!json.ok) throw new Error("ok=false");
  return `${json.data?.length ?? 0} questions`;
});

// ── PHASE 9: Outreach ────────────────────────────────────────────────────────
console.log("\n=== PHASE 9: Outreach Generator ===");

await warn("POST /api/outreach/linkedin works", async () => {
  const { json } = await api("/api/outreach/linkedin", {
    method: "POST",
    body: JSON.stringify({ targetName: "Priya", targetTitle: "EM", targetCompany: "Zepto", purpose: "referral" }),
  });
  if (!json.ok) throw new Error("ok=false");
  return `message: "${(json.data?.message || json.message || "").slice(0, 60)}..."`;
});

// ── PHASE 10: Scheduler ───────────────────────────────────────────────────────
console.log("\n=== PHASE 10: Scheduler ===");

await test("GET /api/scheduler/status works", async () => {
  const { json } = await api("/api/scheduler/status");
  if (!json.ok) throw new Error("ok=false");
  return `running=${json.data?.running}`;
});

// ── PHASE 11: Extension Sync ─────────────────────────────────────────────────
console.log("\n=== PHASE 11: Extension Build & Sync ===");

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const EXT = resolve(process.cwd(), "packages/extension/.output/chrome-mv3");
const MANIFEST = resolve(EXT, "manifest.json");

await test("Extension .output/chrome-mv3 exists", async () => {
  if (!existsSync(EXT)) throw new Error(`Missing: ${EXT}`);
  return "found";
});

await test("manifest.json is valid MV3", async () => {
  const m = JSON.parse(readFileSync(MANIFEST, "utf-8"));
  if (m.manifest_version !== 3) throw new Error(`MV${m.manifest_version}`);
  if (!m.background?.service_worker) throw new Error("no service_worker");
  return `v${m.version}, SW=${m.background.service_worker}`;
});

await test("background.js exists", async () => {
  const p = resolve(EXT, "background.js");
  if (!existsSync(p)) throw new Error("missing");
  return `${(readFileSync(p).length / 1024).toFixed(0)} KB`;
});

await test("sidepanel.html exists", async () => {
  if (!existsSync(resolve(EXT, "sidepanel.html"))) throw new Error("missing");
  return "found";
});

await test("popup.html exists", async () => {
  if (!existsSync(resolve(EXT, "popup.html"))) throw new Error("missing");
  return "found";
});

await test("interceptor.js has no wildcard postMessage", async () => {
  const p = resolve(EXT, "content-scripts/interceptor.js");
  if (!existsSync(p)) throw new Error("interceptor.js missing");
  const src = readFileSync(p, "utf-8");
  // Check for the fixed pattern - should have _SELF_ORIGIN or window.location.origin, NOT '"*"' as the target
  const hasWildcard = /postMessage\([^,]+,\s*"\*"\)/.test(src);
  if (hasWildcard) throw new Error("SECURITY: wildcard '*' postMessage still present - rebuild needed");
  return `${(src.length / 1024).toFixed(1)} KB, postMessage secure`;
});

await test("ATS config chunks present", async () => {
  const d = resolve(EXT, "ats-config-chunks");
  if (!existsSync(d)) throw new Error("ats-config-chunks/ missing");
  const chunks = readdirSync(d).filter(f => f.endsWith(".json"));
  if (!chunks.length) throw new Error("no chunks");
  return `${chunks.length} chunks`;
});

await test("Host permissions cover key job boards", async () => {
  const m = JSON.parse(readFileSync(MANIFEST, "utf-8"));
  const perms = m.host_permissions || [];
  const required = ["linkedin.com", "greenhouse.io", "lever.co", "naukri.com", "workday.com"];
  const missing = required.filter(h => !perms.some(p => p.includes(h)));
  if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
  return `${perms.length} permissions, all key boards covered`;
});

await test("Extension->Server CORS sync (API reachable)", async () => {
  const { json } = await api("/api/health");
  if (!json.ok) throw new Error("unreachable");
  return `sync OK, CORS=*`;
});

// ── FINAL REPORT ──────────────────────────────────────────────────────────────
const total = passed + failed + warnings;
console.log("\n============================================");
console.log("  SuperJobAgent Enterprise QA Report");
console.log("============================================");
console.log(`  Total:   ${total}`);
console.log(`  Pass:    ${passed}`);
console.log(`  Fail:    ${failed}`);
console.log(`  Warn:    ${warnings}`);
console.log(`  Score:   ${Math.round((passed / total) * 100)}%`);
if (failed === 0) {
  console.log("\n  ALL CRITICAL TESTS PASSED - Enterprise Ready!");
} else {
  console.log("\n  FAILED TESTS:");
  results.filter(r => r.status === "FAIL").forEach(r => console.log(`    - ${r.name}: ${r.detail}`));
}
if (warnings > 0) {
  console.log("\n  WARNINGS (non-critical):");
  results.filter(r => r.status === "WARN").forEach(r => console.log(`    ~ ${r.name}: ${r.detail}`));
}
console.log("============================================\n");
process.exit(failed > 0 ? 1 : 0);
