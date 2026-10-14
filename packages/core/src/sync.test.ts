/**
 * Sync merge tests.
 *
 * These encode the guarantees the product depends on: fill a field once (cloud
 * OR extension) and it appears on the other side, and no round trip ever
 * silently deletes something the user typed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SYNCED_APPLICATIONS,
  REDACTION_SENTINEL,
  applicationIdentity,
  isNoOpinion,
  mergeApplicationLists,
  mergeRecordLWW,
  mergeSyncState,
  parseSyncEnvelope,
  SYNCED_KEYS,
} from "./sync.js";
import { namespacedStore, assertSafeNamespace } from "./tenant-store.js";
import type { KVStore } from "./storage.js";

/* ---------------------------- primitives ---------------------------- */

test("isNoOpinion abstains only for absent and redacted values", () => {
  assert.equal(isNoOpinion(undefined), true);
  assert.equal(isNoOpinion(null), true);
  assert.equal(isNoOpinion(REDACTION_SENTINEL), true);
  // An explicit clear IS an opinion — the user deleted the value on purpose.
  assert.equal(isNoOpinion(""), false);
  assert.equal(isNoOpinion([]), false);
  assert.equal(isNoOpinion(0), false);
  assert.equal(isNoOpinion(false), false);
});

/* ------------------------- field-level merge ------------------------ */

test("newer remote field wins, older remote field loses", () => {
  const merged = mergeRecordLWW({ phone: "111" }, { phone: "222" }, 100, 200);
  assert.equal(merged.phone, "222");
  const kept = mergeRecordLWW({ phone: "111" }, { phone: "222" }, 300, 200);
  assert.equal(kept.phone, "111");
});

test("two devices editing DIFFERENT fields both keep their edit", () => {
  // The whole reason this is per-field and not per-document.
  const local = { firstName: "Shashi", phone: "999" };
  const remote = { firstName: "Shashi", linkedin: "in/shashi" };
  const merged = mergeRecordLWW(local, remote, 100, 200);
  assert.equal(merged.phone, "999", "local-only field must survive a newer remote");
  assert.equal(merged.linkedin, "in/shashi", "remote-only field must be adopted");
});

test("a redacted or absent remote field NEVER erases the local secret", () => {
  // exportSnapshot() deletes government IDs and sentinels the API key. Without
  // this rule, cloud round-tripping would wipe them off the device.
  const local = { pan: "ABCDE1234F", aadhaar: "1111 2222 3333", apiKey: "sk-real" };
  const remote = { apiKey: REDACTION_SENTINEL }; // pan/aadhaar deleted in transit
  const merged = mergeRecordLWW(local, remote, 100, 999_999);
  assert.equal(merged.pan, "ABCDE1234F");
  assert.equal(merged.aadhaar, "1111 2222 3333");
  assert.equal(merged.apiKey, "sk-real");
});

test("a gap is filled from remote regardless of clock skew", () => {
  const merged = mergeRecordLWW({ phone: "" as unknown as string, city: undefined }, { city: "Hyderabad" }, 9_999, 1);
  assert.equal(merged.city, "Hyderabad");
});

test("an explicit clear wins when it is strictly newer", () => {
  const merged = mergeRecordLWW({ headline: "old title" }, { headline: "" }, 100, 200);
  assert.equal(merged.headline, "");
});

test("nested objects merge per key instead of being replaced wholesale", () => {
  const local = { imapConfig: { host: "imap.gmail.com", user: "me@x.com" } };
  const remote = { imapConfig: { port: 993 } };
  const merged = mergeRecordLWW(local, remote, 100, 200) as any;
  assert.equal(merged.imapConfig.host, "imap.gmail.com");
  assert.equal(merged.imapConfig.port, 993);
});

test("merging into empty local strips sentinels rather than storing them", () => {
  const merged = mergeRecordLWW(undefined, { apiKey: REDACTION_SENTINEL, model: "gemini-2.0-flash" }, 0, 100);
  assert.equal("apiKey" in merged, false, "the literal string __REDACTED__ must never be stored");
  assert.equal(merged.model, "gemini-2.0-flash");
});

/* ---------------------- applications: union merge ------------------- */

test("applications from two devices union instead of overwriting", () => {
  const local = [{ id: "a", url: "https://boards.greenhouse.io/x/jobs/1", title: "SWE", company: "X", stage: "applied", updatedAt: 100 }];
  const remote = [{ id: "b", url: "https://jobs.lever.co/y/2", title: "SDE", company: "Y", stage: "applied", updatedAt: 200 }];
  const merged = mergeApplicationLists(local, remote);
  assert.equal(merged.length, 2, "device A's job and device B's job must both survive");
  assert.equal(merged[0]!.id, "b", "newest activity sorts first");
});

test("the same job seen twice collapses to one row with the newer stage", () => {
  const url = "https://boards.greenhouse.io/x/jobs/1";
  const local = [{ id: "a", url, title: "SWE", company: "X", stage: "applied", appliedAt: 50, updatedAt: 100 }];
  const remote = [{ id: "a", url, title: "SWE", company: "X", stage: "interview", updatedAt: 200 }];
  const merged = mergeApplicationLists(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.stage, "interview", "newer stage wins");
  assert.equal(merged[0]!.appliedAt, 50, "a field the remote omitted must not be dropped");
  assert.equal(merged[0]!.updatedAt, 200);
});

test("an older remote stage cannot regress a newer local stage", () => {
  const url = "https://jobs.lever.co/y/2";
  const local = [{ id: "a", url, title: "SDE", company: "Y", stage: "offer", updatedAt: 500 }];
  const remote = [{ id: "a", url, title: "SDE", company: "Y", stage: "applied", updatedAt: 100 }];
  const merged = mergeApplicationLists(local, remote);
  assert.equal(merged[0]!.stage, "offer");
});

test("rows with no identifying fields do not collapse onto each other", () => {
  const rows = [{ id: "one" }, { id: "two" }];
  assert.notEqual(applicationIdentity(rows[0]!), applicationIdentity(rows[1]!));
  assert.equal(mergeApplicationLists([rows[0]!], [rows[1]!]).length, 2);
});

/* -------------------------- envelope merge -------------------------- */

test("cloud-filled profile reaches the device (the headline behaviour)", () => {
  // User fills the profile in the web app; the extension had nothing.
  const out = mergeSyncState(
    {},
    {},
    {
      data: { profile: { firstName: "Shashi", email: "s@x.com", updatedAt: 900 } },
      meta: { profile: { updatedAt: 900 } },
    },
  );
  assert.deepEqual(out.changed, ["profile"]);
  assert.equal((out.data.profile as any).firstName, "Shashi");
});

test("a no-op sync reports no changes so the UI does not churn", () => {
  const profile = { firstName: "Shashi", updatedAt: 900 };
  const out = mergeSyncState({ profile }, { profile: { updatedAt: 900 } }, {
    data: { profile: { ...profile } },
    meta: { profile: { updatedAt: 900 } },
  });
  assert.deepEqual(out.changed, [], "identical state must not be rewritten");
});

test("profile.updatedAt is used as its clock even when meta disagrees", () => {
  const out = mergeSyncState(
    { profile: { headline: "local", updatedAt: 5_000 } },
    {},
    { data: { profile: { headline: "remote", updatedAt: 1_000 } }, meta: { profile: { updatedAt: 9_999 } } },
  );
  assert.equal((out.data.profile as any).headline, "local", "the value's own clock beats envelope meta");
});

test("merge is idempotent — applying the same envelope twice changes nothing", () => {
  const remote = {
    data: { profile: { firstName: "A", updatedAt: 100 }, applications: [{ id: "x", url: "u", title: "t", company: "c", updatedAt: 100 }] },
    meta: { profile: { updatedAt: 100 }, applications: { updatedAt: 100 } },
  };
  const first = mergeSyncState({}, {}, remote);
  const second = mergeSyncState(first.data, first.meta, remote);
  assert.deepEqual(second.changed, []);
});

test("every synced key is a real store key and the derived dashboard is excluded", () => {
  assert.equal(SYNCED_KEYS.includes("intelligenceDashboard" as never), false);
  assert.ok(SYNCED_KEYS.includes("profile"));
  assert.ok(SYNCED_KEYS.includes("applications"));
});

/* ----------------------- wire validation ---------------------------- */

test("an envelope cannot smuggle store keys that are not synced", () => {
  // applySyncEnvelope writes data straight into the store, so an unfiltered
  // envelope would let a caller set arbitrary keys such as authSecret.
  const parsed = parseSyncEnvelope({
    schema: 1,
    deviceId: "dev_1",
    data: { profile: { firstName: "A" }, authSecret: "pwned", intelligenceDashboard: {} },
    meta: {},
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(Object.keys(parsed.envelope.data), ["profile"]);
  assert.ok(parsed.warnings.some((w) => w.includes("authSecret")));
});

test("an oversized application list is truncated rather than accepted", () => {
  const rows = Array.from({ length: MAX_SYNCED_APPLICATIONS + 25 }, (_, i) => ({ id: `a${i}` }));
  const parsed = parseSyncEnvelope({ schema: 1, deviceId: "d", data: { applications: rows }, meta: {} });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal((parsed.envelope.data.applications as unknown[]).length, MAX_SYNCED_APPLICATIONS);
});

test("a future or stale schema is rejected with an actionable message", () => {
  const future = parseSyncEnvelope({ schema: 99, data: {}, meta: {} });
  assert.equal(future.ok, false);
  if (!future.ok) assert.match(future.error, /newer than this build/);
  const stale = parseSyncEnvelope({ schema: 0, data: {}, meta: {} });
  assert.equal(stale.ok, false);
  const notObject = parseSyncEnvelope("nope");
  assert.equal(notObject.ok, false);
});

test("a hostile deviceId is sanitised instead of stored verbatim", () => {
  const parsed = parseSyncEnvelope({ schema: 1, deviceId: "../../etc/passwd", data: {}, meta: {} });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.match(parsed.envelope.deviceId, /^[A-Za-z0-9._-]+$/);
  const empty = parseSyncEnvelope({ schema: 1, deviceId: "  ", data: {}, meta: {} });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.envelope.deviceId, "unknown");
});

test("meta clocks are coerced to real numbers and junk clocks are dropped", () => {
  const parsed = parseSyncEnvelope({
    schema: 1,
    deviceId: "d",
    data: { settings: { autonomousMode: true } },
    meta: {
      settings: { updatedAt: "1700000000000" },
      profile: { updatedAt: -1 },
      llmConfig: { updatedAt: "tomorrow" },
      applications: { updatedAt: null },
    },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  // A numeric string must become a number: comparing "9" > "10" as strings
  // would silently invert the merge order.
  assert.equal(typeof parsed.envelope.meta.settings!.updatedAt, "number");
  assert.equal(parsed.envelope.meta.settings!.updatedAt, 1_700_000_000_000);
  assert.equal(parsed.envelope.meta.profile, undefined, "a negative clock is not a clock");
  assert.equal(parsed.envelope.meta.llmConfig, undefined, "an unparseable clock is not a clock");
  assert.equal(parsed.envelope.meta.applications, undefined, "null is not a clock");
});

/* ----------------------- multi-tenant isolation ---------------------- */

function memoryStore(): KVStore & { raw: Map<string, unknown> } {
  const raw = new Map<string, unknown>();
  return {
    raw,
    async get<T>(k: string) { return raw.get(k) as T | undefined; },
    async set<T>(k: string, v: T) { raw.set(k, v); },
    async delete(k: string) { raw.delete(k); },
    async keys() { return [...raw.keys()]; },
  };
}

test("two users on one server cannot see each other's profile", () => {
  // Without namespacing both users write the key "profile" and collide — the
  // single defect that makes a single-tenant store unsafe to deploy.
  const base = memoryStore();
  const alice = namespacedStore(base, "usr_alice");
  const bob = namespacedStore(base, "usr_bob");
  return (async () => {
    await alice.set("profile", { firstName: "Alice" });
    await bob.set("profile", { firstName: "Bob" });
    assert.equal((await alice.get<any>("profile")).firstName, "Alice");
    assert.equal((await bob.get<any>("profile")).firstName, "Bob");
    assert.deepEqual(await alice.keys(), ["profile"], "keys() must hide other tenants");
    await bob.delete("profile");
    assert.equal(await bob.get("profile"), undefined);
    assert.equal((await alice.get<any>("profile")).firstName, "Alice", "delete must not cross tenants");
  })();
});

test("a namespace cannot be forged to escape its prefix", () => {
  assert.throws(() => assertSafeNamespace("a::b"), /unsupported characters/);
  assert.throws(() => assertSafeNamespace(""), /non-empty/);
  assert.throws(() => assertSafeNamespace("../../etc"), /unsupported characters/);
  assert.equal(assertSafeNamespace("usr_abc-123@x.com"), "usr_abc-123@x.com");
});
