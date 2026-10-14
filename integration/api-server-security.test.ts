import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function waitForReady(child: ReturnType<typeof spawn>, timeoutMs = 10_000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let stderrText = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderrText += data.toString();
    });
    const timer = setTimeout(() => reject(new Error(`API server did not become ready (stderr: ${stderrText})`)), timeoutMs);
    const onData = (data: Buffer) => {
      if (data.toString().includes("API running")) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`API server exited before ready (${code}): ${stderrText}`)));
  });
}

test("Docker API binds securely and protects non-health routes with a token", async () => {
  const port = 39000 + (process.pid % 1000);
  const token = "test-api-token";
  const dataDir = await mkdtemp(join(tmpdir(), "sja-api-test-"));
  const child = spawn(process.execPath, ["--import", "tsx", "docker/api-server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SUPERJOB_API_HOST: "127.0.0.1",
      SUPERJOB_API_TOKEN: token,
      SUPERJOB_HOME: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForReady(child);
    const base = `http://127.0.0.1:${port}`;

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);

    const blocked = await fetch(`${base}/api/profile`);
    assert.equal(blocked.status, 401);
    assert.equal(blocked.headers.get("access-control-allow-origin"), null);

    const profileImport = await fetch(`${base}/api/profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Jane", defaultLoginPassword: "login-value", pan: "identity-value" }),
    });
    assert.equal(profileImport.status, 200);

    const allowed = await fetch(`${base}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(allowed.status, 200);
    const publicProfile = await allowed.json() as Record<string, unknown>;
    assert.equal(publicProfile.firstName, "Jane");
    assert.equal(publicProfile.defaultLoginPassword, undefined);
    assert.equal(publicProfile.pan, undefined);

    const oversized = await fetch(`${base}/api/profile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(1_000_001) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    if (child.exitCode === null) {
      try {
        child.kill();
      } catch {}
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(resolve, 2000);
      });
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
