import nodemailer from "nodemailer";
import type { SmtpConfig } from "./types.js";
import type { DraftedReply } from "./reply-agent.js";

export class SmtpSender {
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  /**
   * Send the drafted email reply immediately or schedule it with delay bounds.
   */
  async send(reply: DraftedReply): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure, // true for 465, false for other ports
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    });

    // SEC-002: Sanitize and validate recipient email to prevent SMTP header injection
    if (/[\r\n]/.test(reply.toEmail)) {
      throw new Error("Security Exception: Invalid email address containing newlines.");
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(reply.toEmail)) {
      throw new Error("Security Exception: Invalid email address format.");
    }

    // Sanitize subject header to prevent CRLF injection in subject
    const sanitizedSubject = reply.subject.replace(/[\r\n]+/g, " ").trim();

    const now = Date.now();
    if (reply.sendAfter.getTime() > now) {
      const waitMs = reply.sendAfter.getTime() - now;
      console.log(`Scheduling email response to ${reply.toEmail} in ${Math.round(waitMs / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    await transporter.sendMail({
      from: this.config.user,
      to: reply.toEmail,
      subject: sanitizedSubject,
      text: reply.body,
    });

    console.log(`Email successfully dispatched via SMTP to ${reply.toEmail}`);
  }
}
