import type { ApplicationStage } from "@superjob/core";

export type EmailCategory =
  | "interview-invitation" | "rejection" | "offer" | "acknowledgment"
  | "assessment" | "status-update" | "recruiter-outreach" | "irrelevant";

export interface JobEmail {
  id: string; messageId: string; from: string; fromName: string;
  subject: string; body: string; date: Date;
  category: EmailCategory; confidence: number;
  company?: string; role?: string; newStage?: ApplicationStage; summary: string;
}

export interface EmailScanResult {
  scanned: number; classified: number;
  byCategory: Record<string, number>; updates: EmailUpdate[];
}

export interface EmailUpdate {
  email: JobEmail;
  matchedApplication?: { id: string; title: string; company: string; oldStage: string; newStage: string };
  created: boolean;
}

export interface ImapConfig {
  host: string; port: number; user: string; password: string; tls: boolean;
  mailbox?: string; sinceDays?: number; maxScan?: number;
}

export const PROVIDER_PRESETS: Record<string, Omit<ImapConfig, "user" | "password">> = {
  gmail: { host: "imap.gmail.com", port: 993, tls: true },
  outlook: { host: "outlook.office365.com", port: 993, tls: true },
  yahoo: { host: "imap.mail.yahoo.com", port: 993, tls: true },
  generic: { host: "", port: 993, tls: true },
};

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

