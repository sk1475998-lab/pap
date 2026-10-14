/**
 * Minimal REST API + dashboard for the Docker deployment.
 *
 * No Express — uses Node's built-in http module to keep deps at zero.
 * Endpoints:
 *   GET  /                dashboard (HTML)
 *   GET  /api/status      scheduler + run status
 *   GET  /api/applications  list tracked applications
 *   GET  /api/profile      current profile
 *   POST /api/profile      import store snapshot (profile + settings)
 *   POST /api/run          trigger a crew run immediately
 *   GET  /api/health       health check
 */
import { createServer } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  readApplications,
  readProfile,
  getStore,
  importSnapshot,
  redactProfileForTransfer,
  DEFAULT_LLM_CONFIG,
  type Application,
  type Profile,
  type LLMConfig,
  type StoreSnapshot,
  buildIntelligenceDashboard,
  careerMemoryFromApplications,
} from "@superjob/core";
import { createJobSourceFromEnv, searchConfigFromEnv } from "./env-config.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.SUPERJOB_API_HOST ?? "127.0.0.1";
const API_TOKEN = process.env.SUPERJOB_API_TOKEN?.trim();
const MAX_BODY_BYTES = 1_000_000;

let lastRunSummary = "No runs yet.";
let runInProgress = false;

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function isAuthorized(req: import("node:http").IncomingMessage): boolean {
  if (!API_TOKEN) return false;
  const authorization = req.headers.authorization ?? "";
  if (authorization === `Bearer ${API_TOKEN}` || req.headers["x-superjob-token"] === API_TOKEN) return true;
  const basic = Buffer.from(`superjob:${API_TOKEN}`).toString("base64");
  return authorization === `Basic ${basic}`;
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new HttpError(413, "Request body exceeds the 1 MB limit.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function runCrew(keywords?: string | null, location?: string | null) {
  const { createJobSearchCrew } = await import("../packages/crew/src/index.js");
  const profile = await readProfile<Profile>();
  if (!profile) throw new Error("No profile configured");

  const cfg = searchConfigFromEnv({
    keywords: keywords ?? undefined,
    location: location ?? undefined,
  });
  const stored = await getStore().get<Partial<LLMConfig>>("llmConfig");
  const llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG, ...(stored ?? {}) };
  const source = await createJobSourceFromEnv(cfg.scrape);
  const crew = createJobSearchCrew(source);

  const result = await crew.kickoff({
    profile,
    llmConfig,
    searchParams: {
      keywords: cfg.keywords,
      location: cfg.location,
      limit: cfg.limit,
      minScore: cfg.minScore,
      dryRun: cfg.dryRun,
      maxApplications: cfg.maxApplications,
    },
  });
  return result.summary;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // Health remains unauthenticated for local container probes. Every endpoint
    // that can expose or mutate user data requires an explicitly configured token.
    if (pathname !== "/api/health" && !isAuthorized(req)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Super Job Agent"');
      json(res, { error: "Unauthorized. Configure SUPERJOB_API_TOKEN and send it as Bearer, X-SuperJob-Token, or HTTP Basic auth." }, 401);
      return;
    }

    if (pathname === "/api/log" && req.method === "POST") {
      const body = await readBody(req);
      try {
        const payload = JSON.parse(body);
        if (payload.type === "diag") {
          const entry = payload.entry;
          const timeStr = new Date(entry.ts).toLocaleTimeString();
          const levelStr = entry.level.toUpperCase();
          const logMsg = `[LIVE-LOG][${timeStr}][${levelStr}][SJA:${entry.area}] ${entry.message}`;
          const logData = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
          console.log(logMsg + logData);

          // Append log to live_monitor_log.txt in workspace
          const logFilePath = path.resolve(process.cwd(), "live_monitor_log.txt");
          fs.appendFileSync(logFilePath, `${logMsg}${logData}\n`, "utf8");
        } else if (payload.type === "audit") {
          const report = payload.report;
          const timeStr = new Date(report.ts).toLocaleTimeString();
          const auditHeader = `[LIVE-AUDIT][${timeStr}] Completed fill session for ${report.url}`;
          const summaryStr = `   Summary: ${report.summary.filled} filled, ${report.summary.skipped} skipped, ${report.summary.failed} failed, ${report.summary.alreadyFilled} already filled`;
          console.log(auditHeader);
          console.log(summaryStr);

          // Write/append audit reports to handoffs/live-audit.json
          const auditFilePath = path.resolve(process.cwd(), "handoffs/live-audit.json");
          let existingAudits: any[] = [];
          if (fs.existsSync(auditFilePath)) {
            try {
              const raw = fs.readFileSync(auditFilePath, "utf8");
              existingAudits = JSON.parse(raw);
              if (!Array.isArray(existingAudits)) existingAudits = [];
            } catch {
              existingAudits = [];
            }
          }
          existingAudits.push(report);
          fs.writeFileSync(auditFilePath, JSON.stringify(existingAudits, null, 2), "utf8");
        }
        json(res, { ok: true });
      } catch (err: any) {
        json(res, { error: `Failed to parse or log: ${err.message}` }, 400);
      }
      return;
    }

    if (pathname === "/api/health") {
      json(res, { ok: true, ts: Date.now() });
      return;
    }

    if (pathname === "/api/status") {
      json(res, {
        running: runInProgress,
        lastRun: lastRunSummary,
        uptime: process.uptime(),
        config: searchConfigFromEnv(),
      });
      return;
    }

    if (pathname === "/api/applications") {
      const apps = (await readApplications<Application>()) ?? [];
      json(res, apps);
      return;
    }

    if (pathname === "/api/intelligence") {
      const apps = (await readApplications<Application>()) ?? [];
      json(res, buildIntelligenceDashboard(apps, { memory: careerMemoryFromApplications(apps) }));
      return;
    }

    if (pathname === "/api/profile" && req.method === "GET") {
      const profile = await readProfile<Profile>();
      json(res, profile ? redactProfileForTransfer(profile as unknown as Record<string, unknown>) : { error: "No profile set. POST a snapshot or import via CLI." });
      return;
    }

    if (pathname === "/api/profile" && req.method === "POST") {
      const body = await readBody(req);
      const snap = JSON.parse(body) as StoreSnapshot | Profile;
      if ("masterResumeText" in snap || "firstName" in snap) {
        await importSnapshot({ profile: snap as Profile });
      } else {
        await importSnapshot(snap as StoreSnapshot);
      }
      json(res, { ok: true, message: "Profile imported" });
      return;
    }

    if (pathname === "/api/run" && req.method === "POST") {
      if (runInProgress) {
        json(res, { error: "A run is already in progress" }, 409);
        return;
      }
      const profile = await readProfile<Profile>();
      if (!profile) {
        json(res, { error: "No profile configured. POST /api/profile first." }, 400);
        return;
      }
      runInProgress = true;
      runCrew(url.searchParams.get("keywords"), url.searchParams.get("location"))
        .then((summary) => {
          lastRunSummary = summary;
          runInProgress = false;
        })
        .catch((e) => {
          lastRunSummary = `Run failed: ${e instanceof Error ? e.message : e}`;
          runInProgress = false;
        });
      json(res, { message: "Run started", runId: Date.now() });
      return;
    }

    if (pathname === "/") {
      const apps = (await readApplications<Application>()) ?? [];
      const profile = await readProfile<Profile>();
      html(res, dashboardHtml(apps, profile, runInProgress, lastRunSummary));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    json(res, { error: e instanceof Error ? e.message : String(e) }, status);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n🌐 Super Job Agent API running at http://${HOST}:${PORT}`);
  console.log(`   Dashboard:  http://localhost:${PORT}/`);
  console.log(`   Health:     http://localhost:${PORT}/api/health\n`);
});

function shutdown(signal: string) {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function json(res: import("node:http").ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function html(res: import("node:http").ServerResponse, content: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(content);
}

function dashboardHtml(apps: Application[], profile: Profile | undefined, running: boolean, lastRun: string) {
  const intelligence = buildIntelligenceDashboard(apps, { memory: careerMemoryFromApplications(apps) });
  const stats = {
    total: apps.length,
    applied: apps.filter((a) => a.stage === "applied").length,
    interview: apps.filter((a) => a.stage === "interview").length,
    offer: apps.filter((a) => a.stage === "offer").length,
  };
  const rows = apps
    .slice(0, 50)
    .map(
      (a) => `<tr>
        <td>${esc(a.title)}</td>
        <td>${esc(a.company)}</td>
        <td><b>${a.matchScore}</b></td>
        <td><span class="stage ${a.stage}">${a.stage}</span></td>
        <td>${new Date(a.updatedAt).toLocaleDateString()}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Super Job Agent</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  body{background:#0f172a;color:#e2e8f0;padding:24px}
  h1{font-size:1.5rem;margin-bottom:4px}
  .sub{color:#94a3b8;font-size:.875rem;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;max-width:1000px}
  .intel{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;max-width:1000px}
  .rec{background:#111827;border:1px solid #334155;border-radius:10px;padding:10px;margin:6px 0;max-width:1000px}
  .card{background:#1e293b;border-radius:12px;padding:16px}
  .card .n{font-size:2rem;font-weight:700}
  .card .l{font-size:.75rem;color:#94a3b8;text-transform:uppercase}
  .status{display:inline-block;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:600;margin-bottom:16px}
  .status.running{background:#22c55e20;color:#22c55e}
  .status.idle{background:#64748b20;color:#94a3b8}
  table{width:100%;border-collapse:collapse;max-width:800px}
  th{text-align:left;font-size:.75rem;text-transform:uppercase;color:#94a3b8;padding:8px;border-bottom:1px solid #334155}
  td{padding:8px;border-bottom:1px solid #1e293b;font-size:.875rem}
  .stage{padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600}
  .stage.applied{background:#6366f120;color:#a5b4fc}
  .stage.interview{background:#eab30820;color:#fde047}
  .stage.offer{background:#22c55e20;color:#86efac}
  .stage.saved{background:#64748b20;color:#cbd5e1}
  .btn{background:#6366f1;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:.875rem;cursor:pointer;margin-bottom:16px}
  .btn:hover{background:#4f46e5}
  .btn:disabled{opacity:.5;cursor:default}
</style></head><body>
  <h1>⚡ Super Job Agent</h1>
  <div class="sub">Local-first AI job-application agent — Docker deployment · Creator: Shashi kumar banoth</div>
  <div class="status ${running ? "running" : "idle"}">${running ? "● Running" : "○ Idle"}</div>
  <div class="sub">Last: ${esc(lastRun)}</div>
  <div class="sub">${profile ? "✓ Profile loaded" : "⚠ No profile — POST /api/profile or import via CLI"}</div>
  <button class="btn" onclick="runNow()" ${running ? "disabled" : ""}>▶ Run now</button>
  <div class="grid">
    <div class="card"><div class="n">${stats.total}</div><div class="l">Total</div></div>
    <div class="card"><div class="n">${stats.applied}</div><div class="l">Applied</div></div>
    <div class="card"><div class="n">${stats.interview}</div><div class="l">Interview</div></div>
    <div class="card"><div class="n">${stats.offer}</div><div class="l">Offers</div></div>
  </div>
  <div class="intel">
    <div class="card"><div class="n">${intelligence.averages.atsPassProbability}%</div><div class="l">ATS Pass</div></div>
    <div class="card"><div class="n">${intelligence.averages.interviewProbability}%</div><div class="l">Interview</div></div>
    <div class="card"><div class="n">${intelligence.conversion.responseRate}%</div><div class="l">Response</div></div>
    <div class="card"><div class="n">${intelligence.conversion.offerRate}%</div><div class="l">Offer Conv.</div></div>
  </div>
  <h2 style="font-size:1rem;margin:8px 0">🧠 AI Recommendations</h2>
  ${intelligence.recommendations.map((r) => `<div class="rec">✦ ${esc(r)}</div>`).join("")}
  ${apps.length === 0 ? '<div style="color:#64748b;padding:24px">No applications yet. Import a profile and trigger a run.</div>' : `
  <table><thead><tr><th>Title</th><th>Company</th><th>Match</th><th>Stage</th><th>Date</th></tr></thead>
  <tbody>${rows}</tbody></table>`}
  <script>
    async function runNow(){
      const r=await fetch('/api/run',{method:'POST'});
      const d=await r.json();
      if(d.error)alert(d.error);else setTimeout(()=>location.reload(),2000);
    }
  </script>
</body></html>`;
}

function esc(s: string): string {
  return String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}
