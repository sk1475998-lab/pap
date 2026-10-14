/**
 * Passphrase-based encryption via Web Crypto (AES-GCM + PBKDF2).
 */
export interface EncryptedPayload {
  salt: string;
  iv: string;
  ciphertext: string;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * TS 5.6's DOM lib types BufferSource as ArrayBuffer-backed views only, while
 * crypto.getRandomValues/TextEncoder currently infer Uint8Array<ArrayBufferLike>.
 * Copying into a fresh ArrayBuffer-backed Uint8Array preserves bytes and keeps
 * Web Crypto call sites sound across browser/Node type libraries.
 */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", asBufferSource(enc.encode(passphrase)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(enc.encode(plaintext)));
  return { salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(cipher)) };
}

export async function decryptText(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromB64(payload.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(fromB64(payload.iv)) },
    key,
    asBufferSource(fromB64(payload.ciphertext))
  );
  return new TextDecoder().decode(plain);
}
