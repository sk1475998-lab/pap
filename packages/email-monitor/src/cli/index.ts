#!/usr/bin/env node
import { parseArgs } from "node:util";
import { scanInbox, watchInbox, testConnection, PROVIDER_PRESETS, type ImapConfig } from "../index.js";

const { values, positionals } = parseArgs({
  options: {
    provider: { type: "string", default: "gmail" },
    host: { type: "string" }, port: { type: "string" },
    user: { type: "string" }, pass: { type: "string" },
    mailbox: { type: "string" }, days: { type: "string", default: "7" },
    limit: { type: "string", default: "100" }, interval: { type: "string", default: "15" },
  }, allowPositionals: true, strict: false,
});

function buildConfig(): ImapConfig {
  const preset = PROVIDER_PRESETS[(typeof values.provider === "string" ? values.provider : "gmail")] ?? PROVIDER_PRESETS.gmail;
  const user = typeof values.user === "string" ? values.user : (process.env.SUPERJOB_IMAP_USER ?? "");
  const password = typeof values.pass === "string" ? values.pass : (process.env.SUPERJOB_IMAP_PASSWORD ?? "");
  if (!user || !password) {
    console.error("Missing IMAP credentials.\n\nGmail setup (FREE):\n  1. myaccount.google.com → Security → enable 2-Step Verification\n  2. myaccount.google.com/apppasswords → create App Password\n  3. superjob scan --provider gmail --user YOU@gmail.com --pass XXXX\n\nOr set: SUPERJOB_IMAP_USER, SUPERJOB_IMAP_PASSWORD");
    process.exit(1);
  }
  return {
    host: typeof values.host === "string" ? values.host : preset.host,
    port: values.port ? Number(values.port) : preset.port,
    tls: preset.tls, user, password,
    mailbox: typeof values.mailbox === "string" ? values.mailbox : "INBOX",
    sinceDays: Number(values.days), maxScan: Number(values.limit),
  };
}

const ICONS: Record<string, string> = {
  "interview-invitation": "🎤", rejection: "❌", offer: "🎉", assessment: "📝",
  acknowledgment: "📥", "status-update": "📊", "recruiter-outreach": "👋", irrelevant: "  ",
};

async function main() {
  const cmd = positionals[0] ?? "help";
  const config = buildConfig();

  if (cmd === "test") {
    console.log("Testing connection to " + config.host + "…");
    const r = await testConnection(config);
    if (r.ok) console.log("✓ Connected! " + r.info);
    else { console.error("✗ Failed: " + r.error); process.exit(1); }
    return;
  }

  if (cmd === "scan") {
    console.log("\n📬 Scanning inbox (" + config.mailbox + ") for the last " + config.sinceDays + " days…\n");
    const result = await scanInbox({ imap: config }, {
      onFetch: (n) => console.log("   Fetched " + n + " emails"),
      onClassify: (e) => console.log("   " + (ICONS[e.category] ?? "·") + " [" + e.category + "] " + e.subject.slice(0, 60)),
      onUpdate: (u) => {
        const m = u.matchedApplication!;
        console.log(u.created ? "   ✨ NEW: " + m.title + " at " + m.company + " → " + m.newStage
                                : "   🔄 UPDATED: " + m.title + " at " + m.company + ": " + m.oldStage + " → " + m.newStage);
      },
    });
    console.log("\n" + "═".repeat(50));
    console.log("  Scanned: " + result.scanned);
    console.log("  Job-related: " + result.classified);
    for (const [cat, n] of Object.entries(result.byCategory)) console.log("    " + (ICONS[cat] ?? "·") + " " + cat + ": " + n);
    console.log("  Tracker updates: " + result.updates.length);
    console.log("═".repeat(50) + "\n");
    return;
  }

  if (cmd === "watch") {
    const min = Number(values.interval);
    console.log("\n⏰ Watching inbox every " + min + " min. Ctrl+C to stop.\n");
    watchInbox({ imap: config }, min * 60 * 1000, {
      onFetch: (n) => console.log("[" + new Date().toLocaleTimeString() + "] Fetched " + n + " emails"),
      onUpdate: (u) => { const m = u.matchedApplication!; console.log("[" + new Date().toLocaleTimeString() + "] " + (u.created ? "NEW" : "UPDATED") + ": " + m.title + " at " + m.company + " → " + m.newStage); },
      onScanComplete: (r) => { if (r.classified > 0) console.log("[" + new Date().toLocaleTimeString() + "] " + r.classified + " job emails, " + r.updates.length + " updates"); },
      onError: (e) => console.error("[" + new Date().toLocaleTimeString() + "] Error: " + e.message),
    });
    return new Promise(() => {});
  }

  console.log("Super Job Agent — Email Monitor CLI\n\nUSAGE:\n  superjob test    --provider gmail --user X --pass X\n  superjob scan    --provider gmail --user X --pass X\n  superjob watch   --provider gmail --user X --pass X\n\nGMAIL (FREE): 2FA → App Password at myaccount.google.com/apppasswords\n\n100% FREE: IMAP + Gmail App Passwords + Gemini free tier or local Ollama");
}

main().catch((e) => { console.error("Error:", e instanceof Error ? e.message : e); process.exit(1); });
