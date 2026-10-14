/**
 * Signed remote ATS config verification.
 *
 * Remote selector/config updates are powerful because they influence DOM access
 * and filling behavior. Treat them like executable policy: verify integrity,
 * reject stale/future envelopes, and keep a bundled fallback when verification
 * fails.
 */

export interface SignedConfigEnvelope<T = unknown> {
  version: string;
  generatedAt: string;
  payload: T;
  signature: string;
  algorithm: "ECDSA-P256-SHA256";
}

export interface SignedConfigVerificationOptions {
  /** Maximum envelope age in milliseconds. Default: 24 hours. */
  maxAgeMs?: number;
  /** Allowed future clock skew in milliseconds. Default: 5 minutes. */
  maxFutureSkewMs?: number;
  /** Test hook / deterministic verification clock. */
  nowMs?: number;
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(",")}}`;
}

function signedConfigCanonicalPayload<T>(envelope: SignedConfigEnvelope<T>): string {
  return canonicalJson({
    version: envelope.version,
    generatedAt: envelope.generatedAt,
    payload: envelope.payload,
    algorithm: envelope.algorithm,
  });
}

function validateGeneratedAt(generatedAt: string, options: SignedConfigVerificationOptions = {}): string | null {
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) return "Signed config generatedAt is invalid";

  const now = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxFutureSkewMs = options.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  const ageMs = now - generatedAtMs;

  if (ageMs > maxAgeMs) return "Signed config envelope is stale";
  if (ageMs < -maxFutureSkewMs) return "Signed config envelope is from the future";
  return null;
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

export async function verifySignedConfig<T>(
  envelope: SignedConfigEnvelope<T>,
  publicKeyJwk: JsonWebKey,
  options: SignedConfigVerificationOptions = {}
): Promise<{ ok: true; payload: T } | { ok: false; error: string }> {
  try {
    if (!isSignedConfigEnvelope(envelope)) {
      return { ok: false, error: "Signed config envelope is malformed" };
    }
    if (envelope.algorithm !== "ECDSA-P256-SHA256") {
      return { ok: false, error: `Unsupported config signature algorithm: ${envelope.algorithm}` };
    }
    if (!envelope.version || !envelope.generatedAt || !envelope.signature) {
      return { ok: false, error: "Signed config envelope is incomplete" };
    }

    const freshnessError = validateGeneratedAt(envelope.generatedAt, options);
    if (freshnessError) return { ok: false, error: freshnessError };

    const key = await importPublicKey(publicKeyJwk);
    const signedBytes = asBufferSource(new TextEncoder().encode(signedConfigCanonicalPayload(envelope)));
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64urlToBytes(envelope.signature),
      signedBytes
    );
    return ok ? { ok: true, payload: envelope.payload } : { ok: false, error: "Config signature verification failed" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isSignedConfigEnvelope(value: unknown): value is SignedConfigEnvelope {
  return typeof value === "object" && value !== null &&
    typeof (value as SignedConfigEnvelope).version === "string" &&
    typeof (value as SignedConfigEnvelope).generatedAt === "string" &&
    typeof (value as SignedConfigEnvelope).signature === "string" &&
    (value as SignedConfigEnvelope).algorithm === "ECDSA-P256-SHA256" &&
    "payload" in value;
}
