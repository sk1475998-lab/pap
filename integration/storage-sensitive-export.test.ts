import assert from "node:assert/strict";
import test from "node:test";
import {
  exportSnapshot,
  redactProfileForTransfer,
  setStore,
  type KVStore,
} from "../packages/core/src/storage.ts";

class MemoryStore implements KVStore {
  private values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async set<T>(key: string, value: T): Promise<void> { this.values.set(key, value); }
  async delete(key: string): Promise<void> { this.values.delete(key); }
  async keys(): Promise<string[]> { return [...this.values.keys()]; }
}

test("transfer redaction removes high-risk profile fields", async () => {
  const profile = {
    firstName: "Jane",
    email: "jane@example.test",
    pan: "identity-value",
    aadhaar: "identity-value",
    ssn: "identity-value",
    passportNumber: "identity-value",
    drivingLicenseNumber: "identity-value",
    defaultLoginPassword: "login-value",
    imapConfig: { password: "mail-value" },
    smtpConfig: { password: "mail-value" },
  };
  const redacted = redactProfileForTransfer(profile);
  assert.equal(redacted.firstName, "Jane");
  for (const key of ["pan", "aadhaar", "ssn", "passportNumber", "drivingLicenseNumber", "defaultLoginPassword", "imapConfig", "smtpConfig"]) {
    assert.equal((redacted as Record<string, unknown>)[key], undefined);
  }

  const store = new MemoryStore();
  await store.set("profile", profile);
  setStore(store);
  const snapshot = await exportSnapshot();
  assert.equal((snapshot.profile as Record<string, unknown>).defaultLoginPassword, undefined);
  assert.equal((snapshot.profile as Record<string, unknown>).pan, undefined);
});
