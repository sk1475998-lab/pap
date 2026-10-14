import assert from "node:assert/strict";
import test from "node:test";
import { createProfile } from "../packages/core/src/profile.ts";

function installChromeStorageMock() {
  const local: Record<string, unknown> = {};
  const session: Record<string, unknown> = {};
  const area = (values: Record<string, unknown>) => ({
    async get(keys: string | string[] | null) {
      if (keys === null) return { ...values };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.map((key) => [key, values[key]]));
    },
    async set(items: Record<string, unknown>) { Object.assign(values, items); },
    async remove(keys: string | string[]) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
  });
  (globalThis as any).chrome = { runtime: { id: "profile-vault-test" }, storage: { local: area(local), session: area(session) } };
  return { local, session };
}

test("profile vault encrypts sensitive fields and requires an unlocked passphrase", async () => {
  const { local } = installChromeStorageMock();
  const { setCredentialPassphrase } = await import("../packages/extension/src/lib/credential-store.ts");
  const { hydrateProfileFromVault, protectProfileForStorage } = await import("../packages/extension/src/lib/profile-vault.ts");
  const profile = createProfile({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.test",
    pan: "ABCDE1234F",
    defaultLoginPassword: "vaulted-password",
  });

  setCredentialPassphrase("correct horse battery staple");
  const publicProfile = await protectProfileForStorage(profile);
  assert.equal(publicProfile.pan, "");
  assert.equal(publicProfile.defaultLoginPassword, "");
  assert.ok(local["sja-profile-sensitive-vault"]);
  assert.equal(JSON.stringify(local["sja-profile-sensitive-vault"]).includes("ABCDE1234F"), false);

  const restored = await hydrateProfileFromVault(publicProfile);
  assert.equal(restored?.pan, "ABCDE1234F");
  assert.equal(restored?.defaultLoginPassword, "vaulted-password");

  setCredentialPassphrase(null);
  await assert.rejects(() => protectProfileForStorage(profile), /vault passphrase/i);
});
