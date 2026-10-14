import { getStore, type Application, type ApplicationStage } from "@superjob/core";
import type { JobEmail, EmailUpdate } from "./types.js";

export async function syncEmailToTracker(email: JobEmail): Promise<EmailUpdate> {
  const store = getStore();
  const apps = ((await store.get<Application[]>("applications")) ?? []) as Application[];
  const match = findMatch(email, apps);

  if (match && email.newStage) {
    const oldStage = match.stage;
    if (shouldUpdateStage(oldStage, email.newStage)) {
      match.stage = email.newStage;
      match.notes = match.notes + "\n[" + email.date.toISOString().slice(0, 10) + "] " + email.summary;
      match.updatedAt = Date.now();
      const idx = apps.findIndex((a) => a.id === match.id);
      if (idx >= 0) apps[idx] = match;
      await store.set("applications", apps);
      return { email, matchedApplication: { id: match.id, title: match.title, company: match.company, oldStage, newStage: match.stage }, created: false };
    }
  }

  if (!match && isPositiveSignal(email) && email.company) {
    const newApp: Application = {
      id: "email_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      jobId: "email_" + email.messageId, url: "", title: email.role ?? "(from email)",
      company: email.company, stage: email.newStage ?? "screening",
      notes: "Auto-detected from email: " + email.summary, appliedAt: email.date.getTime(),
      updatedAt: Date.now(), matchScore: 0,
    } as Application;
    apps.unshift(newApp);
    await store.set("applications", apps);
    return { email, matchedApplication: { id: newApp.id, title: newApp.title, company: newApp.company, oldStage: "(new)", newStage: newApp.stage }, created: true };
  }

  return { email, created: false };
}

function findMatch(email: JobEmail, apps: Application[]): Application | undefined {
  if (!email.company) return undefined;
  const ec = norm(email.company);
  const ed = email.from.split("@")[1]?.split(".")[0]?.toLowerCase() ?? "";
  let m = apps.find((a) => norm(a.company) === ec); if (m) return m;
  m = apps.find((a) => { const ad = norm(a.company); return ad === ed || ed.includes(ad) || ad.includes(ed); }); if (m) return m;
  m = apps.find((a) => { const ac = norm(a.company); return ac.length >= 3 && norm(email.subject + " " + email.body).includes(ac); }); return m;
}

function norm(s: string): string { return s.toLowerCase().trim().replace(/[^a-z0-9]/g, ""); }

const ORDER: Record<ApplicationStage, number> = { saved: 0, applied: 1, screening: 2, interview: 3, offer: 4, rejected: 5 };

function shouldUpdateStage(old: ApplicationStage, next: ApplicationStage): boolean {
  if (next === "rejected") return true;
  return ORDER[next] > ORDER[old];
}

function isPositiveSignal(email: JobEmail): boolean {
  return ["interview-invitation", "offer", "assessment", "recruiter-outreach"].includes(email.category);
}
