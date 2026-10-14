import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, isSignedConfigEnvelope, verifySignedConfig, type SignedConfigEnvelope } from "../packages/ats-config/src/config-signing.ts";
import type { RemoteConfigResponse } from "../packages/ats-config/src/schemas.ts";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signedBytes<T>(envelope: Omit<SignedConfigEnvelope<T>, "signature">): Uint8Array {
  return new TextEncoder().encode(canonicalJson({
    version: envelope.version,
    generatedAt: envelope.generatedAt,
    payload: envelope.payload,
    algorithm: envelope.algorithm,
  }));
}

async function createSignedEnvelope<T>(payload: T, generatedAt: string) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const unsigned = {
    version: "test-v1",
    generatedAt,
    payload,
    algorithm: "ECDSA-P256-SHA256" as const,
  };
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    signedBytes(unsigned)
  );
  const envelope: SignedConfigEnvelope<T> = {
    ...unsigned,
    signature: bytesToBase64Url(new Uint8Array(signature)),
  };
  return { envelope, publicKeyJwk };
}

const nowMs = Date.parse("2026-07-02T08:30:00.000Z");
const generatedAt = new Date(nowMs).toISOString();

function remotePayload(): RemoteConfigResponse {
  return {
    configs: [{
      platformId: "testats",
      platformName: "Test ATS",
      urlPatterns: ["https://example.test/jobs/*"],
      fieldMappings: [{
        canonicalName: "email",
        label: "Email",
        fieldType: "email",
        selectors: [{ type: "css", value: "input[type=email]", priority: 1 }],
        required: true,
      }],
      isMultiStep: false,
      version: 1,
      active: true,
    }],
    signature: "payload-signature-for-legacy-format",
    timestamp: nowMs,
    ttl: 86400,
  };
}

test("verifySignedConfig accepts a valid ECDSA P-256 signed envelope", async () => {
  const payload = remotePayload();
  const { envelope, publicKeyJwk } = await createSignedEnvelope(payload, generatedAt);

  const result = await verifySignedConfig(envelope, publicKeyJwk, { nowMs });

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.payload, payload);
});

test("verifySignedConfig rejects a tampered payload with invalid signature", async () => {
  const { envelope, publicKeyJwk } = await createSignedEnvelope(remotePayload(), generatedAt);
  const tampered: SignedConfigEnvelope<RemoteConfigResponse> = {
    ...envelope,
    payload: {
      ...envelope.payload,
      configs: [{ ...envelope.payload.configs[0], platformName: "Tampered ATS" }],
    },
  };

  const result = await verifySignedConfig(tampered, publicKeyJwk, { nowMs });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /signature verification failed/i);
});

test("verifySignedConfig rejects stale envelopes", async () => {
  const staleGeneratedAt = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString();
  const { envelope, publicKeyJwk } = await createSignedEnvelope(remotePayload(), staleGeneratedAt);

  const result = await verifySignedConfig(envelope, publicKeyJwk, { nowMs });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /stale/i);
});

test("verifySignedConfig rejects malformed envelopes before crypto verification", async () => {
  const malformed = {
    version: "test-v1",
    generatedAt,
    payload: remotePayload(),
    signature: "abc",
    algorithm: "HMAC-SHA256",
  };

  assert.equal(isSignedConfigEnvelope(malformed), false);

  const { publicKeyJwk } = await createSignedEnvelope(remotePayload(), generatedAt);
  const result = await verifySignedConfig(malformed as any, publicKeyJwk, { nowMs });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /malformed/i);
});
