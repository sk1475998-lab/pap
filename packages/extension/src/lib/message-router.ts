/**
 * Message Router
 * Simple, type-safe message routing between extension contexts.
 */

type MessageHandler = (payload: any, sender: chrome.runtime.MessageSender) => Promise<any>;

/**
 * Create a message router for handling typed messages.
 */
export function createRouter() {
  const handlers = new Map<string, MessageHandler>();

  return {
    /**
     * Register a handler for a message type.
     */
    handle(type: string, handler: MessageHandler) {
      handlers.set(type, handler);
    },

    /**
     * Dispatch a message to the appropriate handler.
     */
    async dispatch(type: string, payload: any, sender: chrome.runtime.MessageSender) {
      const handler = handlers.get(type);
      if (!handler) {
        console.warn(`[Router] No handler for message type: ${type}`);
        return { error: `Unknown message type: ${type}` };
      }

      try {
        return await handler(payload, sender);
      } catch (err) {
        console.error(`[Router] Handler error for ${type}:`, err);
        return { error: String(err) };
      }
    },

    /**
     * Check if a handler exists for a type.
     */
    has(type: string): boolean {
      return handlers.has(type);
    },

    /**
     * Remove a handler.
     */
    remove(type: string) {
      handlers.delete(type);
    },

    /**
     * Get all registered types.
     */
    types(): string[] {
      return Array.from(handlers.keys());
    },
  };
}

export interface SecureMessageResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

function normalizeMessageType(type: string): string {
  return type.startsWith("SJA:") ? type : `SJA:${type}`;
}

/**
 * Send a message and wait for the raw receiver response.
 * Callers may use either `ACTION` or the full `SJA:ACTION` type; the prefix is
 * normalized exactly once at this boundary.
 */
export async function sendMessage<T = any>(
  type: string,
  payload?: unknown,
  tabId?: number
): Promise<T> {
  const message = { type: normalizeMessageType(type), payload };

  if (tabId != null) {
    return chrome.tabs.sendMessage(tabId, message);
  }
  return chrome.runtime.sendMessage(message);
}

/** Send a message to the background service worker. */
export async function sendToBackground<T = any>(
  type: string,
  payload?: unknown
): Promise<T> {
  return sendMessage<T>(type, payload);
}

/**
 * Send a secure-router message and unwrap its documented `{ ok, data, error }`
 * envelope. UI callers should use this instead of assuming handler values are
 * returned at the top level.
 */
export async function sendToBackgroundData<T = unknown>(
  type: string,
  payload?: unknown
): Promise<T> {
  const response = await sendToBackground<SecureMessageResult<T>>(type, payload);
  if (!response?.ok) {
    throw new Error(response?.error || "Background request failed.");
  }
  if (response.data === undefined) {
    throw new Error("Background response did not include data.");
  }
  return response.data;
}

/**
 * Send a message to a specific tab's content script.
 */
export async function sendToTab<T = any>(
  tabId: number,
  type: string,
  payload?: any
): Promise<T> {
  return sendMessage<T>(type, payload, tabId);
}
