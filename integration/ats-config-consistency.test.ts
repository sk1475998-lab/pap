import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const publicChunkDir = path.join(repo, "packages/extension/src/public/ats-config-chunks");
const libIndexFile = path.join(repo, "packages/extension/src/lib/ats-config-chunks/index.json");
const publicIndexFile = path.join(publicChunkDir, "index.json");

/** Sort arrays recursively so ordering differences don't count as config drift. */
function canon(o: unknown): string {
  if (Array.isArray(o)) return JSON.stringify(o.map(canon).sort());
  if (o && typeof o === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o as Record<string, unknown>).sort()) {
      out[k] = canon((o as Record<string, unknown>)[k]);
    }
    return JSON.stringify(out);
  }
  return JSON.stringify(o);
}

const SITES = [
  "adp", "adp_v2", "ashbyhq", "bamboohr", "breezyhr", "careerplug", "greenhouse",
  "hireology", "icims", "jazzhr", "jobvite", "lever", "meta", "oraclecloud",
  "paylocity", "taleo", "workable", "workday",
];

test("ATS config index lists exactly the shipped chunk files", () => {
  const publicIndex = JSON.parse(fs.readFileSync(publicIndexFile, "utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(publicIndex).sort(), SITES, "index.json keys must equal the site chunk set");

  const libIndex = JSON.parse(fs.readFileSync(libIndexFile, "utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(libIndex).sort(), SITES, "lib index keys must equal the site chunk set");
  assert.equal(canon(libIndex), canon(publicIndex), "lib/ats-config-chunks/index.json must mirror public/index.json");
});

test("each site chunk is a directory-consistent, well-formed config", () => {
  for (const site of SITES) {
    const file = path.join(publicChunkDir, `${site}.json`);
    const cfg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      atsName?: string;
      urls?: string[];
    };
    assert.ok(cfg.atsName, `${site}.json must declare atsName`);
    assert.ok(Array.isArray(cfg.urls) && cfg.urls.length > 0, `${site}.json must declare at least one url pattern`);
  }
});

test("bundled ATS_CONFIGS data matches the canonical public chunks", async () => {
  const { ATS_CONFIGS } = await import("../packages/extension/src/lib/ats-configs-data.js");
  const bundled = ATS_CONFIGS as Record<string, { atsName?: string }>;
  for (const site of SITES) {
    const chunk = JSON.parse(fs.readFileSync(path.join(publicChunkDir, `${site}.json`), "utf8"));
    const key = (chunk as { atsName?: string }).atsName ?? site;
    const entry = bundled[key];
    assert.ok(entry, `bundled ATS_CONFIGS is missing ${site} (${key})`);
    assert.equal(canon(chunk), canon(entry), `bundled ATS_CONFIGS[${key}] drifted from ${site}.json`);
  }
});

test("every shipped flow chunk validates under AtsFlowConfigSchema", async () => {
  // Shipped per-site chunks are flow-configs (XPath/entity automation model).
  // They must validate under AtsFlowConfigSchema — the schema the runtime chunk loader enforces.
  const { AtsFlowConfigSchema, ATSConfigSchema } = await import(
    "../packages/ats-config/src/schemas.js"
  );
  const { ATS_CONFIGS } = await import("../packages/extension/src/lib/ats-configs-data.js");
  const bundled = ATS_CONFIGS as Record<string, Record<string, unknown>>;

  for (const site of SITES) {
    const publicCfg = JSON.parse(fs.readFileSync(path.join(publicChunkDir, `${site}.json`), "utf8"));
    const key = (publicCfg as { atsName?: string }).atsName ?? site;
    const bundledCfg = bundled[key];
    assert.ok(bundledCfg, `bundled ATS_CONFIGS is missing ${site} (${key})`);

    for (const [label, cfg] of [
      [`public/${site}`, publicCfg],
      [`bundled ${key}`, bundledCfg],
    ] as const) {
      const flow = AtsFlowConfigSchema.safeParse(cfg);
      assert.ok(
        flow.success,
        `${label}.json must validate under AtsFlowConfigSchema: ` +
          (flow.success ? "" : JSON.stringify(flow.error.issues.slice(0, 3))),
      );
    }
  }

  // Guard the model boundary: the 18 flow chunks must NOT silently become valid
  // modern field-mapping configs (that would mean the loader could serve the
  // wrong model to the wrong consumer). This is a regression canary, not a
  // judgement on data quality.
  for (const site of SITES) {
    const cfg = JSON.parse(fs.readFileSync(path.join(publicChunkDir, `${site}.json`), "utf8"));
    assert.equal(
      ATSConfigSchema.safeParse(cfg).success,
      false,
      `${site}.json should not satisfy the modern field-mapping ATSConfigSchema`,
    );
  }
});

test("builtin modern configs validate under ATSConfigSchema", async () => {
  const { ATSConfigSchema } = await import("../packages/ats-config/src/schemas.js");
  const { BUILTIN_CONFIGS } = await import("../packages/ats-config/src/builtin-configs.js");
  assert.ok(BUILTIN_CONFIGS.length > 0, "BUILTIN_CONFIGS must be non-empty");
  for (const cfg of BUILTIN_CONFIGS) {
    const r = ATSConfigSchema.safeParse(cfg);
    assert.ok(r.success, `builtin config ${cfg.platformId} must satisfy ATSConfigSchema`);
  }
});
