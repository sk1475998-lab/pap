/**
 * Email OAuth2 Provider — Gap 8 Fix
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEM: The current IMAP client uses plaintext app passwords stored in
 * the user's store/profile. Gmail is deprecating app passwords for OAuth 2.0
 * and Google Workspace mandates OAuth 2.0 since 2023.
 *
 * SOLUTION: This module provides:
 *   1. Gmail OAuth2 token refresh (using the Google token endpoint directly —
 *      no heavyweight googleapis SDK required).
 *   2. Microsoft Outlook / Office 365 OAuth2 token refresh via MSAL-compatible
 *      endpoint (client_credentials flow for delegated access).
 *   3. `getImapAuthForOAuth2()` — drops a refreshed access token into the
 *      ImapFlow `auth` config so the existing imap-client.ts works unchanged.
 *
 * SETUP (Google):
 *   1. Go to Google Cloud Console → APIs & Services → Credentials.
 *   2. Create OAuth 2.0 Client (Web Application).
 *   3. Add http://localhost:3001/api/email/oauth2/callback as authorized redirect.
 *   4. The server handles the callback and stores tokens in the user's store.
 *
 * SETUP (Microsoft):
 *   1. Azure Portal → App registrations → New registration.
 *   2. Add https://your-domain.com/api/email/oauth2/microsoft/callback as redirect.
 *   3. Grant IMAP.AccessAsUser.All scope.
 *
 * ENVIRONMENT VARIABLES:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface OAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
  provider: "gmail" | "outlook";
  email: string;
}

export interface OAuth2ImapAuth {
  user: string;
  accessToken: string;
}

// ── Google / Gmail ────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GMAIL_SCOPES = [
  "https://mail.google.com/",          // Full IMAP access
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

/**
 * Build the Google OAuth2 authorization URL to redirect the user to.
 * The `state` param should be a CSRF token (stored in session).
 */
export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID env var not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",  // Force consent to always get a refresh_token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/**
 * Exchange a Google OAuth2 authorization code for access + refresh tokens.
 * Called from the OAuth2 callback route.
 */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuth2Tokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Fetch the user's email from Google's userinfo endpoint.
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userInfo = await userRes.json() as { email?: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
    provider: "gmail",
    email: userInfo.email ?? "",
  };
}

/**
 * Refresh a Gmail access token using the stored refresh token.
 * Called automatically before each IMAP session when the token is near expiry.
 */
export async function refreshGoogleToken(tokens: OAuth2Tokens): Promise<OAuth2Tokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  return {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope ?? tokens.scope,
  };
}

// ── Microsoft / Outlook ───────────────────────────────────────────────────────

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com";
const OUTLOOK_SCOPES = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access openid email";

export function buildMicrosoftAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID env var not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OUTLOOK_SCOPES,
    response_mode: "query",
    state,
  });
  return `${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(code: string, redirectUri: string): Promise<OAuth2Tokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: OUTLOOK_SCOPES,
  });

  const res = await fetch(`${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };

  // Extract email from id_token JWT payload (base64 middle segment).
  let email = "";
  if (data.id_token) {
    try {
      const payload = JSON.parse(atob(data.id_token.split(".")[1])) as { email?: string; preferred_username?: string };
      email = payload.email ?? payload.preferred_username ?? "";
    } catch { /* non-fatal */ }
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
    provider: "outlook",
    email,
  };
}

export async function refreshMicrosoftToken(tokens: OAuth2Tokens): Promise<OAuth2Tokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
    scope: OUTLOOK_SCOPES,
  });

  const res = await fetch(`${MICROSOFT_AUTH_URL}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    ...tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
}

// ── Shared: auto-refresh + IMAP auth builder ──────────────────────────────────

/** Buffer (ms) before expiry at which we proactively refresh. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Gap 8 Fix: Return a valid IMAP auth object, refreshing the access token if
 * it's within 5 minutes of expiry. Writes the updated tokens back to the store
 * so the next call benefits from the fresh token.
 *
 * @param tokens - Current stored tokens (from user's KVStore).
 * @param saveTokens - Callback to persist refreshed tokens back to the store.
 * @returns ImapFlow-compatible auth object with XOAuth2 string.
 */
export async function getImapAuthForOAuth2(
  tokens: OAuth2Tokens,
  saveTokens: (updated: OAuth2Tokens) => Promise<void>,
): Promise<OAuth2ImapAuth> {
  let current = tokens;

  // Refresh if token expires within the buffer window.
  if (Date.now() > current.expiresAt - REFRESH_BUFFER_MS) {
    try {
      if (current.provider === "gmail") {
        current = await refreshGoogleToken(current);
      } else {
        current = await refreshMicrosoftToken(current);
      }
      await saveTokens(current);
    } catch (e) {
      console.error("[oauth2-email] Token refresh failed — IMAP will likely fail:", e);
      // Return the stale token anyway; ImapFlow will produce a clear error message.
    }
  }

  return {
    user: current.email,
    accessToken: current.accessToken,
  };
}

/**
 * True when the user has configured OAuth2 tokens (preferred over app passwords).
 */
export function hasOAuth2Tokens(stored: unknown): stored is OAuth2Tokens {
  const t = stored as any;
  return (
    typeof t === "object" &&
    t !== null &&
    typeof t.accessToken === "string" &&
    typeof t.refreshToken === "string" &&
    (t.provider === "gmail" || t.provider === "outlook")
  );
}
