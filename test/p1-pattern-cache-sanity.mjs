/**
 * Sanity check for pattern-cache API surface (non-DB; verifies module
 * tree-shakes/loads in a Node environment by checking file existence and
 * expected exports).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const modPath = path.join(ROOT, "packages/extension/src/lib/pattern-cache.ts");
const src = fs.readFileSync(modPath, "utf8");

function assert(match, msg) {
  if (!match) { console.error("FAIL:", msg); process.exit(1); }
  else console.log("PASS:", msg);
}

for (const name of [
  "getCachedSelector",
  "rememberSelector",
  "getCachedSelectors",
  "clearPatternsForOrigin",
  "purgeExpired",
  "clearAllPatterns",
  "computeFormSig",
]) {
  assert(new RegExp(`export (async )?function ${name}\\b`).test(src), `exports ${name}`);
}

// TTL must be 14 days
assert(/TTL_MS = 14 \* 24/.test(src), "TTL is 14 days");

// DB name constant
assert(/DB_NAME = "sja-pattern-cache"/.test(src), "DB_NAME is sja-pattern-cache");

console.log("\nNOT TESTED here: IndexedDB open/put/get/clear/purgeExpired — these require a live browser DOM and are verified by loading the built extension in Chromium.");
