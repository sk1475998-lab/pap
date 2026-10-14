/**
 * Per-request tenant scoping for the cloud API.
 *
 * THE PROBLEM THIS SOLVES
 *
 * `@superjob/core` exposes a single process-wide store (`getStore()`), which is
 * exactly right in the extension: one browser profile, one user. A multi-tenant
 * server does not work that way — two concurrent requests belong to two
 * different users, and swapping a module-level singleton per request would
 * interleave and serve one user's profile to another. That is a data breach,
 * not a race you can retry.
 *
 * So instead of assigning the store, we install ONE resolver (core's
 * `setStoreResolver`) backed by `AsyncLocalStorage`. Node keeps that context
 * attached to the async call chain of a single request, so it is per-request by
 * construction and cannot leak across interleaved awaits.
 *
 * The payoff for "don't duplicate any code": every core helper — `readProfile`,
 * `buildSyncEnvelope`, `applySyncEnvelope`, the profile brain, the matcher —
 * runs unmodified inside a request and transparently reads and writes that
 * user's namespace. No parallel server-side data layer exists.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import {
  getBaseStore,
  namespacedStore,
  setStoreResolver,
  createPostgresStore,
  type KVStore,
} from "@superjob/core";
import {
  bearerFrom,
  findUserById,
  isTokenRevoked,
  issueToken,
  toPublicUser,
  verifyToken,
  type PublicUser,
  type TokenPayload,
  type UserRecord,
} from "./identity.js";

export interface RequestContext {
  user: UserRecord;
  store: KVStore;
}

const als = new AsyncLocalStorage<RequestContext>();

let installed = false;

/** Why a token did not resolve to a session. Drives the user-facing message. */
export type TokenResolution =
  | { ok: true; user: UserRecord; payload: TokenPayload }
  | { ok: false; reason: "invalid" | "no-account" | "revoked" };

/**
 * The single definition of "is this token a live session?".
 *
 * Three checks that must always happen together — valid signature and expiry,
 * the account still exists, and the token's epoch still matches the user's. A
 * token passing two of three is not a session. Keeping them in one function is
 * why the WebSocket handshake cannot accidentally accept a token the REST API
 * would reject.
 */
export async function resolveToken(token: string | undefined): Promise<TokenResolution> {
  const payload = await verifyToken(token);
  if (!payload) return { ok: false, reason: "invalid" };
  const user = await findUserById(payload.sub);
  if (!user) return { ok: false, reason: "no-account" };
  if (isTokenRevoked(payload, user)) return { ok: false, reason: "revoked" };
  return { ok: true, user, payload };
}

/** Convenience wrapper for callers that only need the user (e.g. WebSocket). */
export async function userFromToken(token: string | undefined): Promise<UserRecord | undefined> {
  const resolved = await resolveToken(token);
  return resolved.ok ? resolved.user : undefined;
}

/**
 * Look up a user directly by userId — used by the WS ticket redemption path
 * (Gap 7.1 fix) where the ticket has already been validated and only the
 * userId needs to be converted back into a full UserRecord.
 */
export async function userFromUserId(userId: string | undefined): Promise<UserRecord | undefined> {
  if (!userId) return undefined;
  return findUserById(userId);
}



/**
 * Point core's store resolver at the current request's tenant store.
 *
 * Idempotent, and safe to call at import time. When there is no active request
 * context the resolver returns undefined, so core falls back to the host store
 * (the right answer for the scheduler, CLI paths and startup code).
 */
export function installTenantResolver(): void {
  if (installed) return;
  installed = true;
  setStoreResolver(() => als.getStore()?.store);
}

installTenantResolver();

/** The current request's user, or undefined outside a request. */
export function currentUser(): UserRecord | undefined {
  return als.getStore()?.user;
}

/** The current request's tenant store, or the host store outside a request. */
export function currentStore(): KVStore {
  return als.getStore()?.store ?? getBaseStore();
}

/**
 * Gap 2.2 Fix — resolve the per-user KV store.
 * When DATABASE_URL is set (cloud): use an isolated PostgresStore namespace.
 * When not (local dev / CLI):       use namespacedStore over the file-based store.
 */
function tenantStore(userId: string): KVStore {
  if (process.env.DATABASE_URL) {
    return createPostgresStore(userId);
  }
  return namespacedStore(getBaseStore(), userId);
}

/** Run `fn` with the store scoped to `user`. Used by requests and by jobs. */
export function runAsUser<T>(user: UserRecord, fn: () => Promise<T> | T): Promise<T> | T {
  const store = tenantStore(user.userId);
  return als.run({ user, store }, fn);
}

/** Express augmentation so handlers can read `req.user` with types intact. */
export interface AuthedRequest extends Request {
  user?: UserRecord;
  publicUser?: PublicUser;
}

function unauthorized(res: Response, message = "Sign in required.") {
  // 401 + a machine-readable code so the extension knows to re-authenticate
  // rather than showing a generic network error.
  res.status(401).json({ ok: false, error: message, code: "UNAUTHENTICATED" });
}

/**
 * Require a valid bearer token, then run the rest of the request inside that
 * user's namespace.
 *
 * Wrapping `next()` in `als.run` is what makes the scoping automatic: every
 * downstream handler, and everything it awaits, inherits the context. Handlers
 * therefore need no tenant awareness at all — they just call core.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = bearerFrom(req.headers.authorization);

  const resolved = await resolveToken(token);
  if (!resolved.ok) {
    if (resolved.reason === "no-account") return unauthorized(res, "Account no longer exists.");
    if (resolved.reason === "revoked") {
      return unauthorized(res, "This session was signed out. Please sign in again.");
    }
    return unauthorized(res);
  }
  const { user, payload } = resolved;

  req.user = user;
  req.publicUser = toPublicUser(user);

  // Sliding session: a user who keeps using the product never gets logged out,
  // and the extension picks the refreshed token up from this header.
  const halfLife = Number(payload.exp) - Number(payload.iat) > 0
    ? (Number(payload.exp) - Number(payload.iat)) / 2
    : 0;
  if (halfLife > 0 && Date.now() > Number(payload.iat) + halfLife) {
    try {
      res.setHeader("X-Superjob-Token", await issueToken(user));
    } catch {
      /* refresh is a convenience; never fail the request over it */
    }
  }

  als.run({ user, store: tenantStore(user.userId) }, () => next());
}

/**
 * Attach a user when a token is present, but allow the request through when it
 * is not. For endpoints that are useful anonymously yet richer when signed in.
 */
export async function optionalAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = bearerFrom(req.headers.authorization);
  if (!token) return next();
  const resolved = await resolveToken(token);
  if (!resolved.ok) return next();
  req.user = resolved.user;
  req.publicUser = toPublicUser(resolved.user);
  als.run({ user: resolved.user, store: tenantStore(resolved.user.userId) }, () => next());
}

/**
 * Wrap an async handler so a rejected promise becomes a 500 instead of an
 * unhandled rejection that takes the process down. Express 4 does not await
 * handlers, so this is not optional.
 *
 * SECURITY: The full error message is NEVER sent to the client, because it can
 * contain internal paths, file names, API keys from LLM calls, or database
 * query strings. A correlation ID is emitted in both the log and the response
 * so the client can report it and the operator can trace it.
 */
export function asyncRoute<R extends Request = Request>(
  fn: (req: R, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as R, res)).catch((e) => {
      if (res.headersSent) {
        // Headers already sent — cannot send an error response. Let Express
        // error middleware handle it (e.g. to close a streaming response).
        return next(e);
      }
      const correlationId = `err_${Date.now().toString(36)}`;
      const message = e instanceof Error ? e.message : String(e);
      // Log the full detail server-side, never expose to the client.
      console.error("[api]", req.method, req.originalUrl, `[${correlationId}]`, "→", message, e instanceof Error ? e.stack : "");
      res.status(500).json({ ok: false, error: "An internal error occurred.", correlationId });
    });
  };
}
