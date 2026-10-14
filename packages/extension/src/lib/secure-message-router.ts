/**
 * Typed, sender-aware runtime message helpers.
 *
 * This is intentionally dependency-free (no zod in the extension bundle) but
 * enforces the same security principles: known message types, payload guards,
 * sender URL policy, and consistent error envelopes.
 */
import { decideInjectionForUrl } from "./permission-policy.js";

export interface MessageEnvelope<T = unknown> {
  type: string;
  payload?: T;
  requestId?: string;
}

export interface MessageResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export type Guard<T> = (value: unknown) => value is T;
export type SecureHandler<TPayload, TResult> = (ctx: {
  payload: TPayload;
  sender: chrome.runtime.MessageSender;
  tabId?: number;
}) => TResult | Promise<TResult>;

export interface HandlerOptions<TPayload> {
  type: string;
  guard?: Guard<TPayload>;
  allowFrom?: "extension" | "content" | "any";
  requireJobContext?: boolean;
  handler: SecureHandler<TPayload, unknown>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const unknownPayload: Guard<unknown> = (_value: unknown): _value is unknown => true;

export function objectPayload(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

export function hasStringProp<K extends string>(key: K): Guard<Record<K, string>> {
  return (value: unknown): value is Record<K, string> => isObject(value) && typeof value[key] === "string";
}

export function isExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !sender.tab;
}

export function isContentSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && Boolean(sender.tab?.id);
}

function validateSender(sender: chrome.runtime.MessageSender, allowFrom: HandlerOptions<unknown>["allowFrom"]): MessageResult | null {
  if (!sender.id || sender.id !== chrome.runtime.id) {
    return { ok: false, code: "sender-denied", error: "Message sender is not this extension." };
  }
  if (allowFrom === "extension" && !isExtensionSender(sender)) {
    return { ok: false, code: "sender-denied", error: "Message is only accepted from extension pages." };
  }
  if (allowFrom === "content" && !isContentSender(sender)) {
    return { ok: false, code: "sender-denied", error: "Message is only accepted from content scripts." };
  }
  return null;
}

function validateJobContext(sender: chrome.runtime.MessageSender): MessageResult | null {
  const url = sender.tab?.url ?? sender.url;
  const decision = decideInjectionForUrl(url);
  if (!decision.allowed) {
    return { ok: false, code: "url-denied", error: `Denied on this URL: ${decision.reason}` };
  }
  return null;
}

export function createSecureRuntimeRouter() {
  const handlers = new Map<string, HandlerOptions<unknown>>();

  function register<TPayload>(options: HandlerOptions<TPayload>): void {
    handlers.set(options.type, options as HandlerOptions<unknown>);
  }

  function listener(message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: MessageResult) => void): boolean {
    const envelope = isObject(message) ? (message as unknown as MessageEnvelope) : null;
    const type = envelope?.type;
    if (!type || typeof type !== "string") return false;

    const options = handlers.get(type);
    if (!options) return false;

    void (async () => {
      try {
        const senderError = validateSender(sender, options.allowFrom ?? "any");
        if (senderError) {
          sendResponse(senderError);
          return;
        }

        if (options.requireJobContext) {
          const urlError = validateJobContext(sender);
          if (urlError) {
            sendResponse(urlError);
            return;
          }
        }

        const payload = envelope.payload ?? (message as Record<string, unknown>);
        const guard = options.guard ?? unknownPayload;
        if (!guard(payload)) {
          sendResponse({ ok: false, code: "invalid-payload", error: `Invalid payload for ${type}` });
          return;
        }

        const data = await options.handler({ payload, sender, tabId: sender.tab?.id });
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, code: "handler-error", error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return true;
  }

  function install(): void {
    chrome.runtime.onMessage.addListener(listener);
  }

  return { register, install, listener, types: () => Array.from(handlers.keys()) };
}

export async function sendSecureMessage<T = unknown>(type: string, payload?: unknown): Promise<MessageResult<T>> {
  return chrome.runtime.sendMessage({ type, payload });
}
