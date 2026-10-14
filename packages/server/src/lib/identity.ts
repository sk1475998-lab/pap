/**
 * First-party identity for the cloud API.
 *
 * Replaces the previous placeholder auth, which accepted any request body and
 * fell back to a hardcoded email — i.e. it authenticated everyone as the owner.
 * That is safe on `127.0.0.1` and a full account takeover once deployed.
 *
 * Deliberately dependency-free (node:crypto only) so the API image stays small
 * enough for a free tier and there is no third-party auth service to pay for:
 *   - passwords  → scrypt with a per-user random salt
 *   - sessions   → HMAC-SHA256 signed, expiring, stateless tokens
 *   - Google     → the ID token is VERIFIED against Google's tokeninfo endpoint
 *                  rather than trusted because the client said so
 */
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { getBaseStore } from "@superjob/core";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/** scrypt output length. 64 bytes is the standard recommendation. */
const KEY_LEN = 64;

/** How long a session token stays valid. Refreshed on every authenticated call. */
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SubscriptionTier = "free" | "pro" | "ultra";

export interface UserRecord {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  provider: "local" | "google";
  /** `scrypt$<saltHex>$<hashHex>`; absent for Google-only accounts. */
  passwordHash?: string;
  /**
   * Incremented to invalidate every token already issued to this user.
   *
   * Stateless tokens cannot be deleted, so revocation needs a value the token
   * carries and the server can compare. Bumped on "sign out everywhere" and on
   * a password change — a stolen token must not outlive the password it
   * belonged to.
   */
  tokenEpoch?: number;
  createdAt: number;
  lastLoginAt: number;
  // Monetization & Subscription Entitlements:
  tier?: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionExpiresAt?: number;
  stripeSubscriptionStatus?: string;
  stripeCancelAtPeriodEnd?: boolean;
  monthlyApplicationsUsed?: number;
  monthlyApplicationsResetAt?: number;
  /** @deprecated Retained when reading account records written by older releases. */
  dailyAppliesUsed?: number;
  /** @deprecated Retained when reading account records written by older releases. */
  dailyAppliesResetAt?: number;
}

/** Public view of a user — excludes authentication, billing, and quota internals. */
export type PublicUser = Omit<
  UserRecord,
  | "passwordHash"
  | "stripeCustomerId"
  | "stripeSubscriptionId"
  | "monthlyApplicationsUsed"
  | "monthlyApplicationsResetAt"
  | "dailyAppliesUsed"
  | "dailyAppliesResetAt"
>;

export function toPublicUser(u: UserRecord): PublicUser {
  const {
    passwordHash: _passwordHash,
    stripeCustomerId: _stripeCustomerId,
    stripeSubscriptionId: _stripeSubscriptionId,
    monthlyApplicationsUsed: _monthlyApplicationsUsed,
    monthlyApplicationsResetAt: _monthlyApplicationsResetAt,
    dailyAppliesUsed: _dailyAppliesUsed,
    dailyAppliesResetAt: _dailyAppliesResetAt,
    ...rest
  } = u;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Signing secret                                                      */
/* ------------------------------------------------------------------ */

let cachedSecret: Buffer | null = null;

/**
 * Resolve the HMAC secret used to sign session tokens.
 *
 * Preference order:
 *   1. `SUPERJOB_AUTH_SECRET` env var — the correct choice for production, and
 *      the only way to keep tokens valid across a multi-instance deploy.
 *   2. A random secret generated once and persisted, so tokens survive a
 *      restart on a single free-tier instance.
 *
 * There is intentionally no hardcoded fallback: a shipped default secret lets
 * anyone forge a session for any account.
 */
export async function getAuthSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SUPERJOB_AUTH_SECRET;
  if (fromEnv && fromEnv.trim().length >= 16) {
    cachedSecret = Buffer.from(fromEnv.trim(), "utf8");
    return cachedSecret;
  }
  const store = getBaseStore();
  const existing = await store.get<string>("authSecret");
  if (existing && existing.length >= 32) {
    cachedSecret = Buffer.from(existing, "hex");
    return cachedSecret;
  }
  const generated = randomBytes(32);
  await store.set("authSecret", generated.toString("hex"));
  console.warn(
    "[auth] SUPERJOB_AUTH_SECRET is not set — generated and persisted a random secret. " +
      "Set the env var before scaling beyond one instance, or sessions will break across instances.",
  );
  cachedSecret = generated;
  return cachedSecret;
}

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Constant-time password check. Returns false rather than throwing on bad input. */
export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Minimum viable password policy. Returned message is shown to the user. */
export function validatePassword(password: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof password !== "string" || password.length < 10) {
    return { ok: false, error: "Password must be at least 10 characters." };
  }
  if (password.length > 200) {
    return { ok: false, error: "Password must be under 200 characters." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Password must contain both a letter and a number." };
  }
  return { ok: true };
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

/** RFC-pragmatic email check — rejects the shapes that break key namespacing. */
export function isValidEmail(email: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && email.length <= 254;
}

/* ------------------------------------------------------------------ */
/* Session tokens                                                      */
/* ------------------------------------------------------------------ */

export interface TokenPayload {
  sub: string; // userId
  email: string;
  iat: number;
  exp: number;
  /** Token epoch at issue time. Compared with the user record to allow revocation. */
  ep?: number;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

async function sign(body: string): Promise<string> {
  const secret = await getAuthSecret();
  return b64url(createHmac("sha256", secret).update(body).digest());
}

export async function issueToken(user: UserRecord): Promise<string> {
  const now = Date.now();
  const payload: TokenPayload = {
    sub: user.userId,
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    ep: user.tokenEpoch ?? 0,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${await sign(body)}`;
}

/**
 * Verify a token's signature and expiry. Returns null on ANY problem —
 * malformed, wrong signature, or expired — so callers cannot accidentally
 * distinguish and leak which.
 */
export async function verifyToken(token: string | undefined): Promise<TokenPayload | null> {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  try {
    const expected = await sign(body);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload?.sub || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Pull a bearer token from the Authorization header. */
export function bearerFrom(headerValue: unknown): string | undefined {
  const raw = String(headerValue ?? "");
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || undefined;
}

/* ------------------------------------------------------------------ */
/* User records                                                        */
/* ------------------------------------------------------------------ */

/**
 * User records live in the BASE store, outside any tenant namespace — the
 * directory has to be readable before we know which tenant to open.
 */
const userKey = (email: string) => `users::${email}`;
const userIdKey = (userId: string) => `userIds::${userId}`;

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  return getBaseStore().get<UserRecord>(userKey(normalizeEmail(email)));
}

export async function findUserById(userId: string): Promise<UserRecord | undefined> {
  const email = await getBaseStore().get<string>(userIdKey(userId));
  return email ? findUserByEmail(email) : undefined;
}

export async function putUser(user: UserRecord): Promise<UserRecord> {
  const store = getBaseStore();
  await store.set(userKey(user.email), user);
  await store.set(userIdKey(user.userId), user.email);
  return user;
}

export function newUserId(): string {
  // Only characters `assertSafeNamespace` accepts, so this doubles as the
  // tenant namespace without further escaping.
  return `usr_${randomBytes(9).toString("hex")}`;
}

/** True when the token was issued before the user's current epoch. */
export function isTokenRevoked(payload: TokenPayload, user: UserRecord): boolean {
  // Use a well-defined value for "not yet set": any absent epoch is treated as 0.
  // The key requirement is that BOTH sides use the same absent-representation,
  // so a token issued before the first epoch bump (ep=undefined) is not
  // incorrectly treated as current when tokenEpoch is also undefined.
  const tokenEp = payload.ep !== null && payload.ep !== undefined ? Number(payload.ep) : 0;
  const userEp = user.tokenEpoch !== null && user.tokenEpoch !== undefined ? Number(user.tokenEpoch) : 0;
  return tokenEp !== userEp;
}

/** Invalidate every token already issued to this user. */
export async function bumpTokenEpoch(user: UserRecord): Promise<UserRecord> {
  return putUser({ ...user, tokenEpoch: (Number(user.tokenEpoch) || 0) + 1 });
}

export async function createUser(input: {
  email: string;
  name?: string;
  password?: string;
  picture?: string;
  provider: "local" | "google";
}): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  const now = Date.now();
  return putUser({
    userId: newUserId(),
    email,
    name: (input.name ?? email.split("@")[0] ?? "Candidate").trim(),
    picture: input.picture,
    provider: input.provider,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    createdAt: now,
    lastLoginAt: now,
    tier: "ultra",
    monthlyApplicationsUsed: 0,
    monthlyApplicationsResetAt: now + 30 * 24 * 60 * 60 * 1000,
  });
}

/* ------------------------------------------------------------------ */
/* Google ID token verification                                        */
/* ------------------------------------------------------------------ */

export interface GoogleIdentity {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Verify a Google ID token for real.
 *
 * The previous implementation accepted whatever email the client sent, which
 * means any caller could claim any account. Here the token is checked with
 * Google, the audience is pinned to our own client id when configured, and the
 * email must be verified on Google's side.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  if (!idToken || typeof idToken !== "string") return null;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const info = (await res.json()) as Record<string, string>;

    // Audience MUST be pinned to our own client ID.
    // If GOOGLE_CLIENT_ID is not configured, we cannot safely verify the audience,
    // so we reject all tokens rather than accept tokens from any app.
    const expectedAud = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!expectedAud) {
      console.warn("[auth/google] GOOGLE_CLIENT_ID is not set — rejecting all Google tokens. Set this env var to enable Google sign-in.");
      return null;
    }
    if (info.aud !== expectedAud) return null;
    if (info.email_verified !== "true" && (info as any).email_verified !== true) return null;
    const email = normalizeEmail(info.email);
    if (!email || !isValidEmail(email)) return null;
    if (Number(info.exp) * 1000 < Date.now()) return null;

    return { email, name: info.name, picture: info.picture };
  } catch {
    return null;
  }
}

/** True when Google sign-in is configured. Drives whether the UI offers it. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
}

/* ------------------------------------------------------------------ */
/* Stripe Webhook Idempotency & Customer Indexing                     */
/* ------------------------------------------------------------------ */

/** Check the durable idempotency record without claiming the event early. */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  return Boolean(await getBaseStore().get<boolean>(`stripe_event_${eventId}`));
}

/** Idempotency store for successfully processed webhook events */
export async function markEventProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return true;
  const store = getBaseStore();
  const key = `stripe_event_${eventId}`;
  const existing = await store.get<boolean>(key);
  if (existing) return false;
  await store.set(key, true);
  return true;
}

/** Secondary index mapping stripeCustomerId -> userId */
export async function indexStripeCustomer(customerId: string, userId: string): Promise<void> {
  if (!customerId || !userId) return;
  const store = getBaseStore();
  await store.set(`stripe_cust_${customerId}`, userId);
}

/** Lookup user by stripeCustomerId */
export async function findUserByStripeCustomer(customerId: string): Promise<UserRecord | null> {
  if (!customerId) return null;
  const store = getBaseStore();
  const userId = await store.get<string>(`stripe_cust_${customerId}`);
  if (!userId) return null;
  const user = await findUserById(userId);
  return user ?? null;
}
