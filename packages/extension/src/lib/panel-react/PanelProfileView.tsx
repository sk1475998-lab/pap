import React, { useEffect, useState } from "react";
import type { Profile } from "@superjob/core";
import { getProfile } from "../store.js";
import { getCloudApiUrl, getSyncState, type SyncState } from "../sync/sync-client.js";
import { IconUser } from "../icons.jsx";

interface PanelProfileViewProps {
  setStatus: (text: string) => void;
}

function dashboardUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return base.includes("3001") ? "http://localhost:5173" : base || "http://localhost:5173";
}

export const PanelProfileView: React.FC<PanelProfileViewProps> = ({ setStatus }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [dashboard, setDashboard] = useState("http://localhost:5173");
  const [loadError, setLoadError] = useState(false);


  useEffect(() => {
    let active = true;
    void Promise.all([getProfile(), getSyncState(), getCloudApiUrl()])
      .then(([storedProfile, sync, apiUrl]) => {
        if (!active) return;
        setProfile(storedProfile ?? null);
        setSyncState(sync);
        setDashboard(dashboardUrl(apiUrl) || "http://localhost:3001");
      })
      .catch(() => {
        if (active) setLoadError(true);
      });

    return () => { active = false; };
  }, []);

  const hasProfile = Boolean(profile && (
    profile.firstName || profile.email || profile.masterResumeText || profile.skills?.length
  ));
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return (
    <div className="sja-card sja-profile-card">
      <div className="sja-card-title" style={{ borderBottom: "1px solid var(--sja-border)", paddingBottom: "6px" }}>
        <span className="sja-card-icon" aria-hidden="true"><IconUser size={14} /></span>
        Profile from Dashboard
      </div>

      <p style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--sja-text-secondary)", margin: "10px 0" }}>
        Profile and resume details are managed on the web dashboard. The extension uses the synced copy for autofill and does not edit or collect profile details here.
      </p>

      <div className="sja-card" style={{ fontSize: "11px", marginBottom: "10px" }} role="status">
        <strong>{loadError ? "Could not load synced profile" : hasProfile ? "Synced profile available" : "No profile data found locally"}</strong>
        {syncState?.lastSyncAt ? (
          <div style={{ color: "var(--sja-text-secondary)", marginTop: "4px" }}>
            Last cloud sync: {new Date(syncState.lastSyncAt).toLocaleString()}
          </div>
        ) : (
          <div style={{ color: "var(--sja-text-secondary)", marginTop: "4px" }}>
            {syncState?.connected ? "Connected; waiting for profile sync." : "Cloud sync has not completed yet."}
          </div>
        )}
      </div>

      {hasProfile && profile && (
        <dl style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: "5px 8px", fontSize: "11px" }}>
          <dt style={{ color: "var(--sja-text-secondary)" }}>Name</dt><dd>{fullName || "—"}</dd>
          <dt style={{ color: "var(--sja-text-secondary)" }}>Email</dt><dd>{profile.email || "—"}</dd>
          <dt style={{ color: "var(--sja-text-secondary)" }}>Phone</dt><dd>{profile.phone || "—"}</dd>
          <dt style={{ color: "var(--sja-text-secondary)" }}>Resume</dt>
          <dd>{profile.resumeFileName || (profile.masterResumeText ? "Synced" : "Not available")}</dd>
        </dl>
      )}

      <a
        href={dashboard}
        target="_blank"
        rel="noreferrer"
        onClick={() => setStatus("Opening the dashboard to manage your profile.")}
        className="sja-btn sja-btn-primary"
        style={{ display: "block", marginTop: "14px", textAlign: "center", textDecoration: "none" }}
      >
        Open Dashboard to manage profile ↗
      </a>
    </div>
  );
};
