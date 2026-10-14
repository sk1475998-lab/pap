/**
 * Cloud ⇄ Extension Sync Client.
 *
 * Implements the client half of the enterprise sync engine.
 * Keeps the Chrome Extension synchronized with the Cloud API backend (http://localhost:3001).
 *
 *  - Pulls Profile, Settings, Saved Answers, and Applications from Cloud.
 *  - Pushes newly submitted job applications and updated settings to Cloud.
 *  - Authenticates via JWT bearer token (auto-negotiates dev session if needed).
 */
import {
  applySyncEnvelope,
  buildSyncEnvelope,
  type SyncEnvelope,
  type Application,
} from "@superjob/core";
import { diagLog } from "../diagnostics.js";
import { isChromeRuntimeValid } from "../runtime-guard.js";

export const DEFAULT_CLOUD_API = "http://localhost:3001/api";

export function normalizeCloudApiUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Cloud API URL must be a valid HTTPS URL.");
  }
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(isLoopback && url.protocol === "http:")) {
    throw new Error("Cloud API must use HTTPS. HTTP is allowed only for a local loopback development server.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Cloud API URL cannot contain credentials, a query, or a fragment.");
  }
  if (!url.pathname.endsWith("/api")) {
    throw new Error("Cloud API URL must end in /api.");
  }
  return url.href.replace(/\/$/, "");
}

export interface SyncState {
  connected: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  apiUrl: string;
}

/** Get the configured Cloud API base URL. */
export async function getCloudApiUrl(): Promise<string> {
  if (!isChromeRuntimeValid()) return DEFAULT_CLOUD_API;
  const data = await chrome.storage.local.get("sja_cloud_url");
  const configured = typeof data.sja_cloud_url === "string" ? data.sja_cloud_url : "";
  return configured ? normalizeCloudApiUrl(configured) : DEFAULT_CLOUD_API;
}

/** Set the configured Cloud API base URL. */
export async function setCloudApiUrl(url: string): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  await chrome.storage.local.set({ sja_cloud_url: normalizeCloudApiUrl(url) });
}

export async function setCloudToken(token: string): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  await chrome.storage.local.set({ sja_cloud_token: token });
}

/** Open the canonical dashboard so extension users can authenticate there. */
export async function openDashboardForSignIn(): Promise<void> {
  const apiUrl = await getCloudApiUrl();
  const raw = apiUrl.replace(/\/api\/?$/, "");
  const dashboardUrl = raw.includes("3001") ? "http://localhost:5173" : raw || "http://localhost:5173";
  if (!isChromeRuntimeValid() || !chrome.tabs?.create) {
    throw new Error("Open the web dashboard in Chrome to sign in and sync your profile.");
  }
  await chrome.tabs.create({ url: dashboardUrl, active: true });
}

/** Get or auto-acquire the Cloud auth token. */
export async function getCloudToken(forceRefresh = false): Promise<string | null> {
  if (!isChromeRuntimeValid()) return null;
  const data = await chrome.storage.local.get("sja_cloud_token");
  const existing = typeof data.sja_cloud_token === "string" ? data.sja_cloud_token : "";
  if (!existing) {
    void diagLog("sync", "token-missing", { data: { message: "No cloud token; sign in on the web dashboard." } });
    return null;
  }
  if (!forceRefresh) return existing;

  try {
    const apiUrl = await getCloudApiUrl();
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${existing}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      void diagLog("sync", "token-refresh-failed", {
        level: "warn",
        data: { status: response.status },
      });
      return null;
    }
    const result = await response.json();
    if (!result?.ok || typeof result.token !== "string" || !result.token) {
      void diagLog("sync", "token-refresh-failed", {
        level: "warn",
        data: { message: "Refresh endpoint returned an invalid token response." },
      });
      return null;
    }
    await setCloudToken(result.token);
    return result.token;
  } catch (error) {
    void diagLog("sync", "token-refresh-failed", {
      level: "warn",
      data: { message: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}

/** Fetch an authenticated Cloud API resource and refresh/retry once on 401. */
export async function authenticatedCloudFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiUrl = await getCloudApiUrl();
  let token = await getCloudToken();
  if (!token) throw new Error("Sign in on the web dashboard to use cloud services.");

  const request = (value: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${value}`);
    return fetch(`${apiUrl}${path}`, { ...init, headers });
  };
  const storeResponseToken = async (response: Response) => {
    const refreshed = response.headers.get("X-Superjob-Token");
    if (refreshed) await setCloudToken(refreshed);
  };

  let response = await request(token);
  await storeResponseToken(response);
  if (response.status === 401) {
    token = await getCloudToken(true) ?? "";
    if (token) {
      response = await request(token);
      await storeResponseToken(response);
    }
  }
  return response;
}

/**
 * Execute a full bidirectional sync with the Cloud API.
 * Uses `@superjob/core`'s `buildSyncEnvelope` and `applySyncEnvelope`.
 */
export async function syncWithCloud(): Promise<{ ok: boolean; changed?: string[]; error?: string }> {
  if (!isChromeRuntimeValid()) return { ok: false, error: "Chrome runtime unavailable" };
  const apiUrl = await getCloudApiUrl();
  let token = await getCloudToken();

  try {
    if (!token) throw new Error("Sign in on the web dashboard before syncing profile data.");
    // 1. Build local device envelope
    const envelope = await buildSyncEnvelope({ includeSensitive: true });

    // 2. Push envelope to cloud
    let res = await fetch(`${apiUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(envelope),
    });
    const refreshed = res.headers.get("X-Superjob-Token");
    if (refreshed) await setCloudToken(refreshed);

    // 3. Retry on 401 with refreshed token
    if (res.status === 401) {
      token = await getCloudToken(true);
      if (token) {
        res = await fetch(`${apiUrl}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(envelope),
        });
        const retriedToken = res.headers.get("X-Superjob-Token");
        if (retriedToken) await setCloudToken(retriedToken);
      }
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error || `HTTP ${res.status}`;
      await recordSyncFailure(msg);
      return { ok: false, error: msg };
    }

    // 4. Parse server envelope and merge into local extension storage
    const json = await res.json();
    const serverEnvelope = json.envelope as SyncEnvelope;
    if (!serverEnvelope) {
      await recordSyncFailure("Invalid response from cloud sync");
      return { ok: false, error: "Invalid response from cloud sync" };
    }

    const outcome = await applySyncEnvelope(serverEnvelope);

    await chrome.storage.local.set({
      sja_sync_status: {
        connected: true,
        lastSyncAt: Date.now(),
        lastError: null,
        apiUrl,
      } satisfies SyncState,
    });

    void diagLog("sync", "cloud-sync-success", {
      data: {
        changed: outcome.changed,
        notes: outcome.notes,
      },
    });

    return { ok: true, changed: outcome.changed };
  } catch (err: any) {
    const msg = err?.message || String(err);
    await recordSyncFailure(msg);
    return { ok: false, error: msg };
  }
}

/** Record sync failure state in storage. */
async function recordSyncFailure(error: string): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const apiUrl = await getCloudApiUrl();
  const current = (await chrome.storage.local.get("sja_sync_status"))?.sja_sync_status as Partial<SyncState> | undefined;
  await chrome.storage.local.set({
    sja_sync_status: {
      connected: false,
      lastSyncAt: current?.lastSyncAt ?? null,
      lastError: error,
      apiUrl,
    } satisfies SyncState,
  });
  void diagLog("sync", "cloud-sync-failed", { data: { error } });
}

/** Read current sync state. */
export async function getSyncState(): Promise<SyncState> {
  const defaultState: SyncState = {
    connected: false,
    lastSyncAt: null,
    lastError: null,
    apiUrl: DEFAULT_CLOUD_API,
  };
  if (!isChromeRuntimeValid()) return defaultState;
  const data = await chrome.storage.local.get("sja_sync_status");
  return (data.sja_sync_status as SyncState) || defaultState;
}

/**
 * Report an application directly to the Cloud tracker in real time.
 * Called immediately when LinkedIn Easy Apply or an ATS form completes.
 */
export async function reportApplicationToCloud(app: Partial<Application> & { source?: string }): Promise<boolean> {
  const apiUrl = await getCloudApiUrl();
  const token = await getCloudToken();
  try {
    const res = await fetch(`${apiUrl}/apps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: app.title,
        company: app.company,
        url: app.url,
        stage: app.stage || "applied",
        source: app.source || "extension",
        matchScore: app.matchScore ?? 0,
      }),
    });
    if (res.ok) {
      // Kick background sync to ensure full sync
      void syncWithCloud();
      return true;
    }
  } catch {}
  return false;
}

/**
 * GAP-SYNC-01 FIX: Test the configured cloud API endpoint.
 * Returns { ok: true, latencyMs } on success or { ok: false, error } on failure.
 * Used by the Settings UI "Test Connection" button.
 */
export async function testCloudConnection(customUrl?: string): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
  serverVersion?: string;
}> {
  const apiUrl = customUrl ?? (await getCloudApiUrl());
  const start = Date.now();
  try {
    const res = await fetch(`${apiUrl}/sync/status`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: true, latencyMs, serverVersion: json.version };
    }
    return { ok: false, error: `HTTP ${res.status}`, latencyMs };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === "TimeoutError" ? "Connection timed out (5s)" : String(err?.message ?? err),
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * GAP-SYNC-01 FIX: Save cloud API URL and immediately test the connection.
 */
export async function setCloudApiUrlAndTest(url: string): Promise<{
  saved: boolean;
  connectionTest: Awaited<ReturnType<typeof testCloudConnection>>;
}> {
  const normalised = url.trim().replace(/\/$/, "");
  await setCloudApiUrl(normalised);
  const connectionTest = await testCloudConnection(normalised);
  return { saved: true, connectionTest };
}
