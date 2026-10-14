/**
 * Remote Configuration Manager
 * Fetches ATS configs from a remote server with HMAC-SHA256 signature validation.
 * Implements local caching with TTL-based expiration.
 */
import type { ATSConfig, RemoteConfigResponse } from "./schemas.js";
import { RemoteConfigResponseSchema } from "./schemas.js";
import { isSignedConfigEnvelope, verifySignedConfig, type SignedConfigEnvelope } from "./config-signing.js";

/** Remote config manager options */
export interface RemoteConfigOptions {
  /** Base URL for config server */
  baseUrl: string;
  /** Shared secret for HMAC validation (server/CLI only; do not ship in extension) */
  secretKey?: string;
  /** Public key for extension-safe ECDSA signed config verification */
  publicKeyJwk?: JsonWebKey;
  /** Cache TTL in seconds (default: 24 hours) */
  cacheTtl?: number;
  /** Storage implementation for caching */
  storage: ConfigStorage;
}

/** Storage interface for config caching */
export interface ConfigStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Cache entry structure */
interface CacheEntry {
  configs: ATSConfig[];
  fetchedAt: number;
  ttl: number;
}

const CACHE_KEY = "superjob:ats-configs:cache";

/**
 * Remote Configuration Manager
 * Handles fetching, validating, and caching ATS configs from a remote server.
 */
export class RemoteConfigManager {
  private options: Required<Omit<RemoteConfigOptions, "secretKey" | "publicKeyJwk">> & {
    secretKey?: string;
    publicKeyJwk?: JsonWebKey;
  };
  private memoryCache: CacheEntry | null = null;

  constructor(options: RemoteConfigOptions) {
    this.options = {
      ...options,
      cacheTtl: options.cacheTtl ?? 86400, // 24 hours default
    };
  }

  /**
   * Get all configs, preferring cache if valid.
   */
  async getConfigs(): Promise<ATSConfig[]> {
    // Check memory cache first
    if (this.memoryCache && !this.isExpired(this.memoryCache)) {
      return this.memoryCache.configs;
    }

    // Check persistent cache
    const cached = await this.loadFromCache();
    if (cached && !this.isExpired(cached)) {
      this.memoryCache = cached;
      return cached.configs;
    }

    // Fetch fresh configs
    try {
      const configs = await this.fetchConfigs();
      this.memoryCache = {
        configs,
        fetchedAt: Date.now(),
        ttl: this.options.cacheTtl,
      };
      await this.saveToCache(this.memoryCache);
      return configs;
    } catch (error) {
      // If fetch fails but we have stale cache, use it
      if (cached) {
        console.warn("[ats-config] Using stale cache after fetch error:", error);
        return cached.configs;
      }
      throw error;
    }
  }

  /**
   * Force refresh configs from server.
   */
  async refreshConfigs(): Promise<ATSConfig[]> {
    const configs = await this.fetchConfigs();
    this.memoryCache = {
      configs,
      fetchedAt: Date.now(),
      ttl: this.options.cacheTtl,
    };
    await this.saveToCache(this.memoryCache);
    return configs;
  }

  /**
   * Clear all cached configs.
   */
  async clearCache(): Promise<void> {
    this.memoryCache = null;
    await this.options.storage.delete(CACHE_KEY);
  }

  /**
   * Fetch configs from remote server.
   */
  private async fetchConfigs(): Promise<ATSConfig[]> {
    const url = `${this.options.baseUrl}/configs`;
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
    };

    // Add signature if secret key is configured
    if (this.options.secretKey) {
      const signature = await this.generateSignature(timestamp, nonce);
      headers["X-Signature"] = signature;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Config fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Preferred extension-safe format: public-key signed envelope.
    if (this.options.publicKeyJwk) {
      if (!isSignedConfigEnvelope(data)) {
        throw new Error("Remote config is not a signed envelope");
      }
      const verified = await verifySignedConfig(data as SignedConfigEnvelope<RemoteConfigResponse>, this.options.publicKeyJwk);
      if (!verified.ok) throw new Error(verified.error);
      const parsed = RemoteConfigResponseSchema.parse(verified.payload);
      const age = Date.now() - parsed.timestamp;
      if (age > 24 * 60 * 60 * 1000 || age < -5 * 60 * 1000) {
        throw new Error("Signed config payload timestamp too old or in future");
      }
      return parsed.configs;
    }

    // Legacy server/CLI format. Do not use secretKey in browser extensions.
    const parsed = RemoteConfigResponseSchema.parse(data);

    if (this.options.secretKey) {
      const valid = await this.validateSignature(
        parsed.signature,
        parsed.timestamp,
        JSON.stringify(parsed.configs)
      );
      if (!valid) {
        throw new Error("Invalid config signature");
      }
    }

    // Check timestamp freshness (within 5 minutes)
    const age = Date.now() - parsed.timestamp;
    if (age > 5 * 60 * 1000 || age < -5 * 60 * 1000) {
      throw new Error("Config timestamp too old or in future");
    }

    return parsed.configs;
  }

  /**
   * Generate HMAC-SHA256 signature.
   */
  private async generateSignature(
    timestamp: string,
    nonce: string
  ): Promise<string> {
    if (!this.options.secretKey) return "";

    const message = `${timestamp}:${nonce}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.options.secretKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    return this.arrayBufferToHex(signature);
  }

  /**
   * Validate response signature.
   */
  private async validateSignature(
    signature: string,
    timestamp: number,
    body: string
  ): Promise<boolean> {
    if (!this.options.secretKey) return true;

    const message = `${timestamp}:${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.options.secretKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = this.hexToArrayBuffer(signature);
    return crypto.subtle.verify("HMAC", cryptoKey, signatureBytes, messageData);
  }

  private isExpired(entry: CacheEntry): boolean {
    const age = (Date.now() - entry.fetchedAt) / 1000;
    return age > entry.ttl;
  }

  private async loadFromCache(): Promise<CacheEntry | null> {
    try {
      const raw = await this.options.storage.get(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }

  private async saveToCache(entry: CacheEntry): Promise<void> {
    try {
      await this.options.storage.set(CACHE_KEY, JSON.stringify(entry));
    } catch (error) {
      console.warn("[ats-config] Failed to save cache:", error);
    }
  }

  private generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return this.arrayBufferToHex(bytes.buffer as ArrayBuffer);
  }

  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer as ArrayBuffer;
  }
}

/**
 * In-memory storage implementation for testing.
 */
export class MemoryStorage implements ConfigStorage {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Chrome storage implementation for extension use.
 */
export class ChromeStorage implements ConfigStorage {
  constructor(private area: "local" | "session" = "local") {}

  async get(key: string): Promise<string | null> {
    if (typeof chrome === "undefined") return null;
    const result = await chrome.storage[this.area].get(key) as Record<string, unknown>;
    const value = result[key];
    return typeof value === "string" ? value : null;
  }

  async set(key: string, value: string): Promise<void> {
    if (typeof chrome === "undefined") return;
    await chrome.storage[this.area].set({ [key]: value });
  }

  async delete(key: string): Promise<void> {
    if (typeof chrome === "undefined") return;
    await chrome.storage[this.area].remove(key);
  }
}
