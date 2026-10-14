/**
 * `/api/auth` — first-party authentication.
 *
 * WHAT THIS REPLACES, AND WHY IT MATTERED
 *
 * The previous implementation was a placeholder that would have been a full
 * account takeover the moment this API left `127.0.0.1`:
 *
 *   - `POST /google` did `const userEmail = email || "…@gmail.com"` and NEVER
 *     verified the Google credential. Any caller could post `{email: "you"}`
 *     and be signed in as anyone — or post nothing and be signed in as the
 *     owner.
 *   - `activeSession` was a single module-level variable, so the last person to
 *     log in *was* every other request's identity.
 *   - `POST /otp/send` returned the code in the response body whenever
 *     `NODE_ENV !== "production"`. `NODE_ENV` is unset by default on most hosts,
 *     so that leak would have shipped enabled. The OTP flow gated nothing that
 *     the password and Google paths do not gate properly, so it is gone rather
 *     than half-fixed.
 *
 * Now: scrypt-hashed passwords, verified Google ID tokens, stateless signed
 * tokens with real revocation, and brute-force rate limiting. No auth service
 * to pay for and no new dependencies — see `lib/identity.ts`.
 */
import { Router } from "express";
import { getStore, mergeAgentSettings, type Profile } from "@superjob/core";
import {
  bumpTokenEpoch,
  createUser,
  findUserByEmail,
  hashPassword,
  isGoogleConfigured,
  issueToken,
  normalizeEmail,
  isValidEmail,
  putUser,
  toPublicUser,
  TOKEN_TTL_MS,
  validatePassword,
  verifyGoogleIdToken,
  verifyPassword,
  type UserRecord,
} from "../lib/identity.js";
import {
  asyncRoute,
  optionalAuth,
  requireAuth,
  runAsUser,
  type AuthedRequest,
} from "../lib/tenant.js";
import { LOGIN_RULE, REGISTER_RULE, clientKey, consume, reset } from "../lib/rate-limit.js";

export const authRouter = Router();

/** Shape returned on every successful authentication. One shape, one parser. */
async function authSuccess(user: UserRecord) {
  const updated = await putUser({ ...user, lastLoginAt: Date.now() });
  return {
    ok: true as const,
    token: await issueToken(updated),
    expiresAt: Date.now() + TOKEN_TTL_MS,
    user: toPublicUser(updated),
  };
}

/**
 * Seed a brand-new tenant so the first sync has something coherent to merge.
 *
 * Runs inside the new user's namespace via `runAsUser`, and writes through
 * core's own helpers — no server-side copy of the profile or settings schema.
 */
async function seedTenant(user: UserRecord): Promise<void> {
  await runAsUser(user, async () => {
    const store = getStore();
    const existing = await store.get<Profile>("profile");
    if (!existing) {
      const [firstName, ...restName] = user.name.split(" ");
      await store.set("profile", {
        firstName: firstName ?? "",
        lastName: restName.join(" "),
        email: user.email,
        updatedAt: Date.now(),
      } as unknown as Profile);
    }
    if (!(await store.get("settings"))) {
      // mergeAgentSettings owns the defaults. Inventing a second default set
      // here is exactly the duplication that made cloud and extension diverge.
      await store.set("settings", mergeAgentSettings({}));
    }
  });
}

/* ----------------------------- discovery ---------------------------- */

/** What sign-in methods this deployment offers. Drives the UI, costs nothing. */
authRouter.get("/config", (_req, res) => {
  res.json({
    ok: true,
    data: {
      google: isGoogleConfigured(),
      password: true,
      tokenTtlMs: TOKEN_TTL_MS,
    },
  });
});

/* ------------------------------ register ---------------------------- */

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    const limitKey = `register:${clientKey(req)}`;
    const verdict = consume(limitKey, REGISTER_RULE);
    if (!verdict.allowed) {
      return res.status(429).json({ ok: false, error: "Too many sign-up attempts. Try again later.", code: "RATE_LIMITED" });
    }

    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    }
    const policy = validatePassword(req.body?.password);
    if (!policy.ok) return res.status(400).json({ ok: false, error: policy.error });

    if (await findUserByEmail(email)) {
      // Deliberately explicit: email existence is discoverable from the sign-in
      // form anyway, and a vague error here just makes real users retry blindly.
      return res.status(409).json({ ok: false, error: "An account with this email already exists. Sign in instead.", code: "EMAIL_TAKEN" });
    }

    const name = String(req.body?.name ?? "").trim().slice(0, 120);
    const user = await createUser({ email, name, password: String(req.body.password), provider: "local" });
    await seedTenant(user);
    res.json(await authSuccess(user));
  }),
);

/* -------------------------------- login ----------------------------- */

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    // Rate-limit per account AND per client, so neither one account nor one
    // source address can be ground through a password list.
    const keys = [`login:ip:${clientKey(req)}`, `login:acct:${email || "blank"}`];
    for (const k of keys) {
      if (!consume(k, LOGIN_RULE).allowed) {
        return res.status(429).json({ ok: false, error: "Too many sign-in attempts. Try again in a few minutes.", code: "RATE_LIMITED" });
      }
    }

    const password = String(req.body?.password ?? "");
    const user = await findUserByEmail(email);

    // Same message and comparable work for "no such user" and "wrong password",
    // so the endpoint is not an account-enumeration oracle.
    const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, undefined);
    if (!user || !ok) {
      if (user && !user.passwordHash) {
        return res.status(400).json({
          ok: false,
          error: "This account was created with Google. Use Continue with Google.",
          code: "USE_GOOGLE",
        });
      }
      return res.status(401).json({ ok: false, error: "Incorrect email or password.", code: "BAD_CREDENTIALS" });
    }

    for (const k of keys) reset(k);
    await seedTenant(user);
    res.json(await authSuccess(user));
  }),
);

/* --------------------------- dev / local session --------------------- */
/**
 * Instant session for local development, desktop agent runs, and dashboard auto-login.
 * Generates or retrieves a user and issues a standard signed JWT.
 */
/**
 * Explicit loopback-only development login. Non-production NODE_ENV is common
 * on hosted services, so it is not a sufficient deployment safety boundary.
 */
authRouter.post(
  "/dev-session",
  asyncRoute(async (req, res) => {
    const enabled = process.env.SUPERJOB_ENABLE_DEV_SESSION === "true";
    const address = req.ip?.replace(/^::ffff:/, "");
    if (
      !enabled ||
      process.env.NODE_ENV === "production" ||
      (address !== "127.0.0.1" && address !== "::1")
    ) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || "Local Development User").trim();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "A valid development email is required." });
    }
    let user = await findUserByEmail(email);
    if (!user) user = await createUser({ email, name, provider: "local" });
    await seedTenant(user);
    res.json(await authSuccess(user));
  }),
);

/* ------------------------------- google ----------------------------- */

authRouter.post(
  "/google",
  asyncRoute(async (req, res) => {
    if (!consume(`google:${clientKey(req)}`, LOGIN_RULE).allowed) {
      return res.status(429).json({ ok: false, error: "Too many attempts. Try again shortly.", code: "RATE_LIMITED" });
    }

    const credential = String(req.body?.credential ?? req.body?.idToken ?? "");
    if (!credential) {
      return res.status(400).json({ ok: false, error: "Missing Google credential.", code: "NO_CREDENTIAL" });
    }

    const identity = await verifyGoogleIdToken(credential);
    if (!identity) {
      return res.status(401).json({ ok: false, error: "Google sign-in could not be verified.", code: "BAD_GOOGLE_TOKEN" });
    }

    let user = await findUserByEmail(identity.email);
    if (!user) {
      user = await createUser({
        email: identity.email,
        name: identity.name,
        picture: identity.picture,
        provider: "google",
      });
    } else if (identity.picture && identity.picture !== user.picture) {
      user = await putUser({ ...user, picture: identity.picture });
    }

    await seedTenant(user);
    res.json(await authSuccess(user));
  }),
);

/* ------------------------------ session ----------------------------- */

/**
 * Who am I? Answers `authenticated: false` rather than 401 so a signed-out UI
 * can render its landing state without treating it as an error.
 */
authRouter.get(
  "/session",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user) return res.json({ ok: true, authenticated: false, user: null });
    res.json({ ok: true, authenticated: true, user: toPublicUser(user) });
  }),
);

/** Refresh a valid token before it expires, without re-entering a password. */
authRouter.post(
  "/refresh",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user!;
    res.json({ ok: true, token: await issueToken(user), expiresAt: Date.now() + TOKEN_TTL_MS, user: toPublicUser(user) });
  }),
);

/* ----------------------------- password ----------------------------- */

authRouter.post(
  "/password",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user!;
    const policy = validatePassword(req.body?.newPassword);
    if (!policy.ok) return res.status(400).json({ ok: false, error: policy.error });

    // A Google-only account setting a password for the first time has nothing to
    // prove beyond the valid session it already holds.
    if (user.passwordHash) {
      const currentOk = await verifyPassword(String(req.body?.currentPassword ?? ""), user.passwordHash);
      if (!currentOk) return res.status(401).json({ ok: false, error: "Current password is incorrect." });
    }

    const updated = await bumpTokenEpoch({
      ...user,
      passwordHash: await hashPassword(String(req.body.newPassword)),
    });
    // Every previously issued token is now dead, including the one that made
    // this call, so hand back a fresh one or the user is logged out mid-flow.
    res.json({
      ok: true,
      message: "Password updated. Other devices have been signed out.",
      token: await issueToken(updated),
      expiresAt: Date.now() + TOKEN_TTL_MS,
      user: toPublicUser(updated),
    });
  }),
);

/* ------------------------------- logout ----------------------------- */

/**
 * Sign out this client. Tokens are stateless by design, so the client discards
 * it; nothing server-side needs to change. Use `/logout-all` to actually
 * invalidate tokens held elsewhere.
 */
authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true, message: "Signed out.", clearToken: true });
});

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncRoute(async (req, res) => {
    await bumpTokenEpoch((req as AuthedRequest).user!);
    res.json({ ok: true, message: "Signed out on all devices.", clearToken: true });
  }),
);

/* ─────────────────── WebSocket single-use ticket (Gap 7.1 Fix) ──────────────
 *
 * PROBLEM FIXED: The WS handshake was passing the long-lived bearer token as
 * ?token= in the URL query string. Nginx/CloudFront/Cloudflare log the full
 * request URL, so 30-day tokens were leaking into infrastructure access logs.
 *
 * SOLUTION: Client calls POST /api/auth/ws-ticket (authenticated via header)
 * → receives a short-lived, single-use nonce (30 seconds TTL).
 * Client opens wss://...?ticket=<nonce> instead of ?token=<bearer>.
 * Server redeems + invalidates the nonce on first WS connect, maps it to userId.
 *
 * Tickets are stored in-process (Map). For multi-instance deployments replace
 * with Redis: SET ws_ticket:<nonce> <userId> EX 30
 * ──────────────────────────────────────────────────────────────────────────── */

interface WsTicket {
  userId: string;
  expiresAt: number;
}

/** In-process ticket store. Replace with Redis for multi-instance deployments. */
export const wsTicketStore = new Map<string, WsTicket>();

// Purge expired tickets every 60 s to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [nonce, ticket] of wsTicketStore) {
    if (ticket.expiresAt <= now) wsTicketStore.delete(nonce);
  }
}, 60_000);

/** Issue a single-use WS ticket for the authenticated caller. */
authRouter.post(
  "/ws-ticket",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = (req as AuthedRequest).user!;
    const { randomBytes } = await import("node:crypto");
    const nonce = randomBytes(24).toString("base64url");
    const TICKET_TTL_MS = 30_000; // 30 seconds — enough for a WS handshake
    wsTicketStore.set(nonce, { userId: user.userId, expiresAt: Date.now() + TICKET_TTL_MS });
    res.json({
      ok: true,
      ticket: nonce,
      expiresAt: Date.now() + TICKET_TTL_MS,
      note: "Connect wss://...?ticket=<ticket> within 30 s. Ticket is single-use.",
    });
  }),
);

/**
 * Redeem a WS ticket nonce → userId.
 * Called by the WebSocket upgrade handler in index.ts.
 * Returns undefined if the ticket is missing, expired, or already redeemed.
 */
export function redeemWsTicket(nonce: string | undefined): string | undefined {
  if (!nonce) return undefined;
  const ticket = wsTicketStore.get(nonce);
  if (!ticket) return undefined;
  wsTicketStore.delete(nonce); // single-use: invalidate immediately
  if (Date.now() > ticket.expiresAt) return undefined;
  return ticket.userId;
}

