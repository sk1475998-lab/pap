/**
 * Operation Zero-Defect: Team Workspace (Feature #12)
 * Allows users in a 'team' tier to share job boards, candidate notes, and tracking states.
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { getEntitlements } from "./auth/entitlement.js";

export interface TeamMember {
  id: string;
  name: string;
  role: 'admin' | 'member';
}

export interface SharedJobNote {
  jobKey: string;
  authorId: string;
  note: string;
  timestamp: number;
}

const TEAM_STORAGE_KEY = "sja-team-workspace";

export interface TeamWorkspaceContext {
  teamId: string | null;
  members: TeamMember[];
  sharedNotes: SharedJobNote[];
}

const EMPTY_TEAM_CONTEXT: TeamWorkspaceContext = {
  teamId: null,
  members: [],
  sharedNotes: [],
};

export async function getTeamContext(): Promise<TeamWorkspaceContext> {
  if (!isChromeRuntimeValid()) return { ...EMPTY_TEAM_CONTEXT };
  const data = await chrome.storage.local.get(TEAM_STORAGE_KEY) as Record<string, unknown>;
  return (data[TEAM_STORAGE_KEY] as TeamWorkspaceContext | undefined) ?? { ...EMPTY_TEAM_CONTEXT };
}

export async function addSharedNote(jobKey: string, note: string) {
  const entitlement = await getEntitlements();
  if (entitlement.tier === 'free') {
    throw new Error("Team workspaces require a Pro or Enterprise plan.");
  }
  
  const ctx = await getTeamContext();
  if (!ctx.teamId) throw new Error("No active team workspace found.");

  const newNote: SharedJobNote = {
    jobKey,
    authorId: "current_user_id", // Resolved via auth in production
    note,
    timestamp: Date.now()
  };

  ctx.sharedNotes.push(newNote);
  await chrome.storage.local.set({ [TEAM_STORAGE_KEY]: ctx });
  return newNote;
}

export async function getSharedNotesForJob(jobKey: string) {
  const ctx = await getTeamContext();
  return ctx.sharedNotes.filter((n: SharedJobNote) => n.jobKey === jobKey);
}
