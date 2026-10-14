import { ImapFlow } from "imapflow";
import type { ImapConfig } from "./types.js";
import { simpleParser } from "mailparser";
import {
  hasOAuth2Tokens,
  getImapAuthForOAuth2,
  type OAuth2Tokens,
} from "./oauth2-provider.js";

export interface RawEmail {
  messageId: string;
  from: string;
  fromName: string;
  subject: string;
  text: string;
  html: string;
  date: Date;
}

/**
 * Gap 8 Fix: Build ImapFlow auth config.
 * Prefers OAuth2 XOAUTH2 when tokens are available; falls back to password.
 * `saveTokens` is only called when the access token is refreshed.
 */
async function buildImapAuth(
  config: ImapConfig,
  oauth2Tokens?: OAuth2Tokens,
  saveTokens?: (t: OAuth2Tokens) => Promise<void>,
): Promise<{ user: string; pass?: string; accessToken?: string }> {
  if (oauth2Tokens && hasOAuth2Tokens(oauth2Tokens)) {
    // OAuth2 path (Gap 8 Fix)
    const auth = await getImapAuthForOAuth2(
      oauth2Tokens,
      saveTokens ?? (() => Promise.resolve()),
    );
    return { user: auth.user, accessToken: auth.accessToken };
  }
  // Legacy app-password path
  return { user: config.user, pass: config.password };
}

export async function fetchEmails(
  config: ImapConfig,
  oauth2Tokens?: OAuth2Tokens,
  saveTokens?: (t: OAuth2Tokens) => Promise<void>,
): Promise<RawEmail[]> {
  const auth = await buildImapAuth(config, oauth2Tokens, saveTokens);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth,
    logger: false,
  });

  const emails: RawEmail[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox ?? "INBOX");
    try {
      const since = new Date();
      since.setDate(since.getDate() - (config.sinceDays ?? 7));

      const searchResult: unknown = await client.search({ since }, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? (searchResult as number[]) : [];
      const toFetch = uids.slice(-(config.maxScan ?? 100));

      if (toFetch.length === 0) return [];

      for (const uid of toFetch) {
        const msg: unknown = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        const source = (msg as Record<string, unknown>)?.source;
        if (!source) continue;

        try {
          const parsed = await simpleParser(source as Buffer);
          emails.push({
            messageId: parsed.messageId ?? String(uid),
            from: parsed.from?.value?.[0]?.address ?? "",
            fromName: parsed.from?.value?.[0]?.name ?? "",
            subject: parsed.subject ?? "(no subject)",
            text: parsed.text ?? "",
            html: typeof parsed.html === "string" ? parsed.html : "",
            date: parsed.date ?? new Date(),
          });
        } catch {
          continue;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return emails;
}

export async function testConnection(
  config: ImapConfig,
  oauth2Tokens?: OAuth2Tokens,
  saveTokens?: (t: OAuth2Tokens) => Promise<void>,
): Promise<{ ok: boolean; error?: string; info?: string }> {
  const auth = await buildImapAuth(config, oauth2Tokens, saveTokens);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth,
    logger: false,
  });

  try {
    await client.connect();
    const status = await client.status(config.mailbox ?? "INBOX", { messages: true, unseen: true });
    return { ok: true, info: `${status.messages} messages (${status.unseen} unseen)` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await client.logout().catch(() => {});
  }
}
