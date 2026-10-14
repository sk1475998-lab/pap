import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";

let server: Server;
let baseUrl: string;
let storeFile: string;
let priorStoreHome: string | undefined;
let resetApplications: () => Promise<void>;

before(async () => {
  priorStoreHome = process.env.SUPERJOB_HOME;
  storeFile = join(process.cwd(), "packages", "server", `.apps-route-test-${process.pid}.json`);
  process.env.SUPERJOB_HOME = storeFile;

  const [{ default: express }, { appsRouter }, core] = await Promise.all([
    import("express"),
    import("../packages/server/src/routes/apps.js"),
    import("@superjob/core"),
  ]);
  resetApplications = () => core.writeApplications([]);

  const app = express();
  app.use(express.json());
  app.use("/api/apps", appsRouter);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (storeFile) await rm(storeFile, { force: true });
  if (priorStoreHome === undefined) delete process.env.SUPERJOB_HOME;
  else process.env.SUPERJOB_HOME = priorStoreHome;
});

async function postApplication(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/api/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const result = await response.json() as { ok: boolean; data: Record<string, unknown> };
  assert.equal(result.ok, true);
  return result.data;
}

test("POST /api/apps defaults omitted stage to saved without an applied timestamp", async () => {
  await resetApplications();
  const row = await postApplication({ title: "Stale client listing", appliedAt: 123 });
  assert.equal(row.stage, "saved");
  assert.equal(row.appliedAt, undefined);
});

test("POST /api/apps preserves explicit saved and applied stages", async () => {
  await resetApplications();
  const saved = await postApplication({ title: "Saved listing", stage: "saved", appliedAt: 123 });
  const applied = await postApplication({ title: "Submitted listing", stage: "applied" });

  assert.equal(saved.stage, "saved");
  assert.equal(saved.appliedAt, undefined);
  assert.equal(applied.stage, "applied");
  assert.equal(typeof applied.appliedAt, "number");
  assert.ok(Number(applied.appliedAt) > 0);
});

test("GET /api/apps counts rejected applications as responses, not progression", async () => {
  await resetApplications();
  await postApplication({ title: "Saved", stage: "saved" });
  await postApplication({ title: "Applied", stage: "applied" });
  await postApplication({ title: "Rejected", stage: "rejected" });
  await postApplication({ title: "In screening", stage: "screening" });

  const response = await fetch(`${baseUrl}/api/apps`);
  assert.equal(response.status, 200);
  const result = await response.json() as {
    stats: { sent: number; responseRate: number; progressionRate: number };
  };
  assert.equal(result.stats.sent, 3);
  assert.equal(result.stats.responseRate, 67);
  assert.equal(result.stats.progressionRate, 33);
});
