import { useEffect, useState } from "react";
import type { Profile } from "@superjob/core";
import { createProfile, validateProfile } from "@superjob/core";
import { getProfileFromStore } from "@/popup/api.js";
import { getCloudApiUrl, getSyncState, type SyncState } from "@/lib/sync/sync-client.js";

function dashboardUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return base.includes("3001") ? "http://localhost:5173" : base || "http://localhost:5173";
}

export function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [dashboard, setDashboard] = useState("http://localhost:5173");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      getProfileFromStore<Profile>(),
      getSyncState(),
      getCloudApiUrl(),
    ]).then(([storedProfile, sync, apiUrl]) => {
      if (!active) return;
      setProfile(storedProfile ? createProfile(storedProfile) : null);
      setSyncState(sync);
      setDashboard(dashboardUrl(apiUrl) || "http://localhost:3001");
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Could not read the synced profile from extension storage.");
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="text-xs text-[var(--text-muted)] p-4">Loading synced profile status…</div>;
  }

  const validation = profile ? validateProfile(profile) : null;
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const experience = Array.isArray(profile?.experience) ? profile.experience : [];
  const education = Array.isArray(profile?.education) ? profile.education : [];
  const projects = Array.isArray(profile?.projects) ? profile.projects : [];
  const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];
  const hasProfile = Boolean(profile && (
    profile.firstName || profile.email || profile.masterResumeText || skills.length
  ));
  const valueRows = profile ? [
    ["Name", displayName],
    ["Preferred name", profile.preferredName],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["LinkedIn", profile.linkedin],
    ["GitHub", profile.github],
    ["Website", profile.website || profile.portfolio],
    ["Headline", profile.headline],
    ["Location", profile.location || [profile.city, profile.state, profile.country].filter(Boolean).join(", ")],
    ["Address", [profile.address, profile.addressLine2, profile.city, profile.state, profile.pincode, profile.country].filter(Boolean).join(", ")],
    ["Years of experience", profile.yearsOfExperience],
    ["Notice period", profile.noticePeriod],
    ["Current compensation", profile.currentCTC],
    ["Expected compensation", profile.expectedCTC],
    ["Work authorization", profile.workAuthorization],
    ["Resume file", profile.resumeFileName],
  ].filter(([, value]) => typeof value === "string" && value.trim()) : [];

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Profile from Dashboard</h2>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            validation?.complete
              ? "bg-emerald-500/10 text-emerald-400"
              : hasProfile
                ? "bg-amber-500/10 text-amber-300"
                : "bg-slate-500/10 text-slate-300"
          }`}>
            {loadError ? "Unavailable" : validation?.complete ? "Ready to apply" : hasProfile ? "Needs setup" : "Not synced"}
          </span>
        </div>

        {loadError && (
          <p className="mt-2 text-[11px] text-rose-300" role="alert">
            Could not load the extension’s synced profile: {loadError}
          </p>
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Your profile and resume are managed on the web dashboard. The extension reads the synced copy for autofill; edit them there to avoid duplicate or conflicting data.
        </p>

        {profile && hasProfile && (
          <dl className="mt-3 grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-[var(--text-muted)]">Name</dt>
            <dd>{displayName || "—"}</dd>
            <dt className="text-[var(--text-muted)]">Email</dt>
            <dd>{profile.email || "—"}</dd>
            <dt className="text-[var(--text-muted)]">Phone</dt>
            <dd>{profile.phone || "—"}</dd>
            <dt className="text-[var(--text-muted)]">Resume</dt>
            <dd>{profile.resumeFileName || (profile.masterResumeText ? "Synced" : "Not available")}</dd>
            <dt className="text-[var(--text-muted)]">Skills</dt>
            <dd>{skills.length} synced</dd>
          </dl>
        )}

        {hasProfile && (
          <div className="mt-4 space-y-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
            <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
              Read-only account data. The extension uses this synced profile for matching fields; it does not infer missing answers.
            </p>

            {valueRows.length > 0 && (
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profile details</h3>
                <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-1 text-[11px]">
                  {valueRows.map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-[var(--text-muted)]">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Skills ({skills.length})
              </h3>
              {skills.length ? (
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill, index) => (
                    <span key={`${skill}-${index}`} className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-1 text-[10px]">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : <p className="text-[11px] text-[var(--text-muted)]">No parsed skills are synced.</p>}
            </section>

            {experience.length > 0 && (
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Experience ({experience.length})</h3>
                <div className="space-y-2">
                  {experience.map((item, index) => (
                    <article key={item.id || `${item.company}-${item.title}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.07)] p-2">
                      <p className="text-[11px] font-medium">{item.title || "Role"}{item.company ? ` · ${item.company}` : ""}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {[item.startDate, item.endDate || (item.current ? "Present" : ""), item.location].filter(Boolean).join(" · ")}
                      </p>
                      {item.description && <p className="mt-1 whitespace-pre-wrap text-[10px]">{item.description}</p>}
                      {!!item.bullets?.length && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px]">
                          {item.bullets.map((bullet, bulletIndex) => <li key={`${index}-${bulletIndex}`}>{bullet}</li>)}
                        </ul>
                      )}
                      {!!item.skills?.length && <p className="mt-1 break-words text-[10px] text-[var(--text-muted)]">Skills: {item.skills.join(", ")}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {education.length > 0 && (
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Education ({education.length})</h3>
                <div className="space-y-2">
                  {education.map((item, index) => (
                    <article key={item.id || `${item.school}-${item.degree}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.07)] p-2 text-[10px]">
                      <p className="font-medium">{item.degree}{item.field || item.discipline ? ` · ${item.field || item.discipline}` : ""}</p>
                      <p className="text-[var(--text-muted)]">{item.school}</p>
                      <p>{[item.startDate, item.endDate || item.graduationYear, item.gpa].filter(Boolean).join(" · ")}</p>
                      {item.description && <p className="mt-1 whitespace-pre-wrap">{item.description}</p>}
                      {item.activities && <p className="mt-1 whitespace-pre-wrap">Activities: {item.activities}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {projects.length > 0 && (
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Projects ({projects.length})</h3>
                <div className="space-y-2">
                  {projects.map((item, index) => (
                    <article key={item.id || `${item.name}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.07)] p-2">
                      <p className="break-words text-[11px] font-medium">{item.name}</p>
                      {item.url && <p className="break-all text-[10px] text-sky-300">{item.url}</p>}
                      {item.description && <p className="mt-1 whitespace-pre-wrap text-[10px]">{item.description}</p>}
                      {!!item.technologies?.length && <p className="mt-1 break-words text-[10px] text-[var(--text-muted)]">Technologies: {item.technologies.join(", ")}</p>}
                      {!!item.bullets?.length && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px]">
                          {item.bullets.map((bullet, bulletIndex) => <li key={`${index}-${bulletIndex}`}>{bullet}</li>)}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {certifications.length > 0 && (
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Certifications ({certifications.length})</h3>
                <ul className="space-y-1 text-[10px]">
                  {certifications.map((item, index) => (
                    <li key={item.id || `${item.name}-${index}`}>
                      {item.name}{item.issuer ? ` · ${item.issuer}` : ""}{item.issueDate ? ` · ${item.issueDate}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {syncState && (
          <p className="mt-3 text-[10px] text-[var(--text-muted)]" role="status">
            {syncState.lastSyncAt
              ? `Last cloud sync: ${new Date(syncState.lastSyncAt).toLocaleString()}`
              : syncState.connected
                ? "Connected to cloud; waiting for the first profile sync."
                : "Cloud sync has not completed yet."}
          </p>
        )}

        <a
          href="http://localhost:5173/resume"
          target="_blank"
          rel="noreferrer"
          className="mt-4 block w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          {syncState?.connected ? "Manage Profile on React Dashboard ↗" : "Open React Dashboard to Sync ↗"}
        </a>
      </section>
    </div>
  );
}
