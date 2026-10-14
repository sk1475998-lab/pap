/**
 * `/api/ats-config` — ATS Configuration Cloud Sync Router (Gap 9.6 Fix).
 *
 * Serves dynamic selector rules and flow configs to Chrome extensions and Playwright
 * workers in real time. Eliminates the need to wait 3–7 business days for Chrome Web Store
 * extension review when an ATS vendor (Workday, Greenhouse, Lever, etc.) changes a DOM selector.
 */
import { Router } from "express";
import { createHmac, createHash } from "node:crypto";
import { BUILTIN_CONFIGS } from "@superjob/ats-config";
import type { ATSConfig } from "@superjob/ats-config";
import { asyncRoute, requireAuth, type AuthedRequest } from "../lib/tenant.js";

export const atsConfigRouter = Router();

// In-memory runtime hotfixes (can be seeded or persisted to Postgres/disk)
const dynamicOverrides = new Map<string, Partial<ATSConfig>>();

/** Generates canonical ETag based on config version hash */
function computeConfigEtag(configs: ATSConfig[], revision: number): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(configs));
  hash.update(String(revision));
  return `"${hash.digest("hex").slice(0, 16)}"`;
}

let configRevision = 1;
let lastModified = new Date();

/**
 * GET /api/ats-config/configs
 * Returns the full suite of verified ATS configurations with HMAC signature.
 * Compatible with `RemoteConfigManager` in `@superjob/ats-config`.
 */
atsConfigRouter.get(
  "/configs",
  asyncRoute(async (req, res) => {
    // Merge builtin configs with dynamic hotfix overrides
    const mergedConfigs: ATSConfig[] = BUILTIN_CONFIGS.map((cfg) => {
      const override = dynamicOverrides.get(cfg.platformId);
      if (!override) return cfg;
      return {
        ...cfg,
        ...override,
        fieldMappings: override.fieldMappings ?? cfg.fieldMappings,
      };
    });

    const etag = computeConfigEtag(mergedConfigs, configRevision);
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    const timestamp = Date.now();
    const ttl = 86400; // 24 hours TTL

    // Generate HMAC signature if secret configured
    const secret = process.env.SUPERJOB_CONFIG_SECRET || "sja-default-config-secret-2026";
    const hmac = createHmac("sha256", secret);
    hmac.update(`${timestamp}:${JSON.stringify(mergedConfigs)}`);
    const signature = hmac.digest("hex");

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", lastModified.toUTCString());
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

    res.json({
      configs: mergedConfigs,
      signature,
      timestamp,
      ttl,
      revision: configRevision,
      platformsCount: mergedConfigs.length,
    });
  }),
);

/**
 * GET /api/ats-config/configs/:platformId
 * Returns configuration specifically for a single ATS platform (e.g. "greenhouse", "workday").
 */
atsConfigRouter.get(
  "/configs/:platformId",
  asyncRoute(async (req, res) => {
    const platformId = String(req.params.platformId || "");
    const base = BUILTIN_CONFIGS.find((c) => c.platformId.toLowerCase() === platformId.toLowerCase());
    if (!base) {
      return res.status(404).json({ ok: false, error: `ATS Platform '${platformId}' not found` });
    }

    const override = dynamicOverrides.get(base.platformId);
    const config = override ? { ...base, ...override } : base;

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ ok: true, config });
  }),
);

/**
 * POST /api/ats-config/override
 * Allows platform administrators (ultra tier) to hotfix an ATS selector rule instantly.
 */
atsConfigRouter.post(
  "/override",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user || user.tier !== "ultra") {
      return res.status(403).json({ ok: false, error: "Ultra tier authorization required to push ATS overrides." });
    }

    const { platformId, override } = req.body;
    if (!platformId || !override || typeof override !== "object") {
      return res.status(400).json({ ok: false, error: "platformId and override object required." });
    }

    dynamicOverrides.set(platformId, override);
    configRevision += 1;
    lastModified = new Date();

    res.json({
      ok: true,
      message: `Dynamic override applied for ${platformId}. Broadcast to clients on next sync.`,
      revision: configRevision,
    });
  }),
);

/**
 * GET /api/ats-config/version
 * Returns revision metadata for fast cache-validation checks.
 */
atsConfigRouter.get("/version", (_req, res) => {
  res.json({
    ok: true,
    revision: configRevision,
    lastModified: lastModified.toISOString(),
    supportedPlatforms: BUILTIN_CONFIGS.map((c) => c.platformId),
  });
});
