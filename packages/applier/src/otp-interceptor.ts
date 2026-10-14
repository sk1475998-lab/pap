import { fetchEmails } from "@superjob/email-monitor";
import type { ImapConfig } from "@superjob/email-monitor";

interface OTPResult {
  code: string;
  source: "email" | "timeout";
}

export class OTPInterceptor {
  private imapConfig: ImapConfig;
  private pollIntervalMs = 3000;
  private timeoutMs = 90000; // 90 seconds maximum wait

  constructor(imapConfig: ImapConfig) {
    this.imapConfig = imapConfig;
  }

  async waitForOTP(platform: string): Promise<OTPResult> {
    const startTime = Date.now();
    const deadline = startTime + this.timeoutMs;

    while (Date.now() < deadline) {
      try {
        // Fetch emails from the last day to be safe, then filter locally by arrival timestamp
        const recentEmails = await fetchEmails({
          ...this.imapConfig,
          sinceDays: 1,
          maxScan: 10,
        });

        // Filter emails that arrived after our start time
        const newEmails = recentEmails.filter((email) => email.date.getTime() >= startTime - 5000);

        for (const email of newEmails) {
          if (!this.isValidSender(email.from, platform)) {
            console.log(`OTP Interceptor: Skipped verification mail from unverified sender: ${email.from}`);
            continue;
          }
          const otp = this.extractOTPFromEmail(email.text || email.html, platform);
          if (otp) {
            return { code: otp, source: "email" };
          }
        }
      } catch (err) {
        // Log error and retry polling
        console.error("OTP IMAP poll error:", err);
      }

      await this.sleep(this.pollIntervalMs);
    }

    throw new Error(`OTP timeout: verification code not received for platform: ${platform}`);
  }

  private isValidSender(from: string, platform: string): boolean {
    if (!from) return false;
    // Extract email from "Display Name <address@domain.com>" if present
    const emailMatch = from.match(/<([^>]+)>/);
    const rawEmail = (emailMatch ? emailMatch[1] : from).toLowerCase().trim();
    const parts = rawEmail.split("@");
    if (parts.length !== 2) return false;
    const senderDomain = parts[1];

    // Whitelisted root domains per platform
    const whitelist: Record<string, string[]> = {
      naukri: ["naukri.com", "naukri.org", "naukriemail.com"],
      linkedin: ["linkedin.com", "e.linkedin.com"],
      shine: ["shine.com"],
      foundit: ["foundit.in", "foundit.sg", "monsterindia.com"],
    };

    const allowedDomains = whitelist[platform.toLowerCase()];
    if (!allowedDomains) return true; // Fallback to allow if platform not whitelisted explicitly

    // Strict boundary match: domain must exactly equal or be a subdomain (.domain)
    return allowedDomains.some(
      (d) => senderDomain === d || senderDomain.endsWith("." + d)
    );
  }

  private extractOTPFromEmail(body: string, platform: string): string | null {
    if (!body) return null;

    const patterns = [
      /\b(\d{6})\b(?=.*(?:verification|verify|otp|code))/i,
      /(?:OTP|verification\s*code|otp\s*code|code|pin)[^\d]*(\d{4,8})/i,
      /(\d{6})\s*is\s*your/i,
      /use\s*(?:code|otp|verification)[:\s]+(\d{4,8})/i,
      platform === "naukri" ? new RegExp("naukri.*?(\\d{6})", "i") : null,
      platform === "linkedin" ? new RegExp("linkedin.*?(\\d{6})", "i") : null,
    ].filter((p): p is RegExp => p !== null);

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
