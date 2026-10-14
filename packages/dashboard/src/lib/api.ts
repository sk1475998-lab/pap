/**
 * API client for SuperJobAgent server
 * All requests go through /api (proxied by Vite dev server to :3001)
 */

const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("sja_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse { ok: boolean; token?: string; user?: PublicUser; error?: string; }
export interface PublicUser { userId: string; email: string; tier: string; name?: string; }

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, name?: string): Promise<LoginResponse> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function me(): Promise<{ ok: boolean; user: PublicUser }> {
  return request("/api/auth/me");
}

export async function getWsTicket(): Promise<{ ticket: string }> {
  return request("/api/auth/ws-ticket", { method: "POST" });
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<{ ok: boolean; data: any }> {
  return request("/api/profile");
}
export async function saveProfile(profile: any): Promise<{ ok: boolean }> {
  return request("/api/profile", { method: "POST", body: JSON.stringify(profile) });
}

// ── Applications ──────────────────────────────────────────────────────────────

export async function getApplications(params?: { limit?: number; offset?: number; status?: string }): Promise<{ ok: boolean; data: any[] }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.status) q.set("status", params.status);
  return request(`/api/applications?${q}`);
}

// ── Autopilot ─────────────────────────────────────────────────────────────────

export interface AutopilotStatus { running: boolean; progress: number; message: string; applied: number; }

export async function getAutopilotStatus(): Promise<{ ok: boolean } & AutopilotStatus> {
  return request("/api/autopilot/status");
}

export async function startAutopilot(overrides?: any): Promise<{ ok: boolean }> {
  return request("/api/autopilot/start", { method: "POST", body: JSON.stringify(overrides ?? {}) });
}

export async function stopAutopilot(): Promise<{ ok: boolean }> {
  return request("/api/autopilot/stop", { method: "POST" });
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export async function getQueueHealth(): Promise<{ ok: boolean; data: any }> {
  return request("/api/queue/health");
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function discoverJobs(query: any): Promise<{ ok: boolean; data: any[] }> {
  return request("/api/jobs/discover", { method: "POST", body: JSON.stringify(query) });
}

// ── Intelligence / Dashboard stats ───────────────────────────────────────────

export async function getIntelligence(): Promise<{ ok: boolean; data: any }> {
  return request("/api/intelligence");
}

// ── LLM config ───────────────────────────────────────────────────────────────

export async function getLlmConfig(): Promise<{ ok: boolean; data: any }> {
  return request("/api/llm/config");
}
export async function saveLlmConfig(config: any): Promise<{ ok: boolean }> {
  return request("/api/llm/config", { method: "POST", body: JSON.stringify(config) });
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ ok: boolean; version: string }> {
  return request("/api/health");
}
