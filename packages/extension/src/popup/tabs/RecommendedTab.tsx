/**
 * Recommended / Advanced Search Tab
 *
 * Combines:
 *  - Local-first active-page recommendations (deterministic match scoring).
 *  - Advanced Job Search: live API boards (Arbeitnow, RemoteOK, Indeed*, Greenhouse, Lever)
 *    plus "open in tab" deep links for LinkedIn, Naukri, and other sites (no ingestion).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecommendationBatch, RecommendedJob } from "@superjob/core";
import {
  getJobRecommendationsForActivePage,
  runAdvancedJobSearch,
  openSearchResultInTab,
  type AdvancedSearchFilters,
  type SearchBoardId,
  type SearchResultSet,
} from "@/popup/api.js";
import { IconSearch, IconRefresh, IconSparkles, IconBriefcase, IconExternalLink, IconBolt } from "@/lib/icons.jsx";

/* ─── Design tokens ─────────────────────────────────────────────────── */
const decisionColor: Record<string, string> = {
  apply_now:    "#34D399",
  tailor_first: "#FBBF24",
  review:       "#60A5FA",
  save:         "rgba(255,255,255,0.45)",
  skip:         "#FB7185",
};
const decisionBg: Record<string, string> = {
  apply_now:    "rgba(52,211,153,0.12)",
  tailor_first: "rgba(251,191,36,0.12)",
  review:       "rgba(96,165,250,0.12)",
  save:         "rgba(255,255,255,0.06)",
  skip:         "rgba(251,113,133,0.12)",
};

function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-faint)";
  return score >= 80 ? "#34D399" : score >= 60 ? "#FBBF24" : "#FB7185";
}

function postedLabel(postedAt?: string): string {
  if (!postedAt) return "Posting date unavailable";
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return "Posting date unavailable";
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  return `Posted ${days} days ago`;
}

type ViewMode = "active" | "search";

const DEFAULT_FILTERS: AdvancedSearchFilters = {
  keywords: "",
  location: "Remote / Worldwide",
  experienceYears: 0,
  remote: "any",
  jobType: "fulltime",
  postedWithinDays: 7,
  minMatchScore: 50,
  indiaOnly: false,
  limit: 25,
  sources: ["arbeitnow","remoteok","greenhouse","lever","linkedin","naukri","apna","instahyre","hirist","foundit","wellfound","glassdoor"],
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "14px",
  padding: "14px 16px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: "11px", padding: "6px 10px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "7px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const labelStyle: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const,
  letterSpacing: "0.10em", color: "var(--text-faint)", marginBottom: "4px", display: "block",
};

/* ─── Main component ─────────────────────────────────────────────────── */
export function RecommendedTab() {
  const [view, setView] = useState<ViewMode>("active");
  const [activeBatch, setActiveBatch] = useState<RecommendationBatch | null>(null);
  const [activeLoading, setActiveLoading] = useState(true);
  const [filters, setFilters] = useState<AdvancedSearchFilters>(DEFAULT_FILTERS);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResultSet | null>(null);
  const [error, setError] = useState("");

  const refreshActive = useCallback(() => {
    setActiveLoading(true);
    getJobRecommendationsForActivePage()
      .then((b) => setActiveBatch(b))
      .finally(() => setActiveLoading(false));
  }, []);

  useEffect(() => { if (view === "active") refreshActive(); }, [view, refreshActive]);

  const doSearch = async () => {
    setError("");
    setResults(null);
    setSearching(true);
    try { setResults(await runAdvancedJobSearch(filters)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSearching(false); }
  };

  const update = <K extends keyof AdvancedSearchFilters>(k: K, v: AdvancedSearchFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const toggleSource = (id: SearchBoardId) => {
    const cur = new Set(filters.sources ?? []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    update("sources", [...cur] as AdvancedSearchFilters["sources"]);
  };

  const allSources = useMemo<Array<{ id: SearchBoardId; name: string; scraper: boolean }>>(() => [
    { id: "arbeitnow",  name: "Arbeitnow (API)",      scraper: true  },
    { id: "remoteok",   name: "RemoteOK (API)",        scraper: true  },
    { id: "greenhouse", name: "Greenhouse (4 boards)", scraper: true  },
    { id: "lever",      name: "Lever (3 boards)",      scraper: true  },
    { id: "linkedin",   name: "LinkedIn",              scraper: false },
    { id: "naukri",     name: "Naukri",                scraper: false },
    { id: "indeed",     name: "Indeed",                scraper: true  },
    { id: "apna",       name: "Apna",                  scraper: false },
    { id: "instahyre",  name: "Instahyre",             scraper: false },
    { id: "cutshort",   name: "Cutshort",              scraper: false },
    { id: "hirist",     name: "Hirist",                scraper: false },
    { id: "foundit",    name: "foundit (Monster)",     scraper: false },
    { id: "glassdoor",  name: "Glassdoor",             scraper: false },
    { id: "wellfound",  name: "Wellfound",             scraper: false },
  ], []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* View toggle */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        background: "rgba(255,255,255,0.04)", borderRadius: "12px",
        padding: "4px", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {(["active","search"] as ViewMode[]).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} style={{
            fontSize: "11px", fontWeight: 700, padding: "7px",
            borderRadius: "9px", border: "none", cursor: "pointer",
            background: view === v ? "rgba(255,255,255,0.09)" : "none",
            color: view === v ? "#fff" : "var(--text-faint)",
            boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
            transition: "all 0.15s",
          }}>
            {v === "active" ? "Current page" : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                <IconSearch size={11} /> Advanced Search
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "active"
        ? <ActiveView batch={activeBatch} loading={activeLoading} onRefresh={refreshActive} />
        : <SearchView filters={filters} update={update} toggleSource={toggleSource}
            allSources={allSources} onSearch={doSearch} searching={searching}
            results={results} error={error} />
      }
    </div>
  );
}

/* ─── Active page view ───────────────────────────────────────────────── */
function ActiveView({ batch, loading, onRefresh }: { batch: RecommendationBatch | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: "11px" }}>Scoring best jobs locally…</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Header card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(20,184,166,0.20), rgba(99,102,241,0.25))",
        border: "1px solid rgba(52,211,153,0.20)", borderRadius: "14px", padding: "14px 16px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(52,211,153,0.80)", fontWeight: 700, marginBottom: "4px" }}>
          Local-first recommendations
        </div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>Best jobs to apply first</div>
        <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>
          {batch?.summary ?? "Open a job page or search result, then refresh. Scored locally — no paid AI."}
        </div>
        {typeof batch?.total === "number" && (
          <div style={{
            marginTop: "8px", display: "inline-block", fontSize: "10px", fontWeight: 600,
            background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)",
            borderRadius: "99px", padding: "2px 10px", color: "#34D399",
          }}>
            {batch.total} job{batch.total === 1 ? "" : "s"} scored
          </div>
        )}
      </div>

      <button type="button" onClick={onRefresh} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
        width: "100%", padding: "8px", fontSize: "11px", fontWeight: 600,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px", color: "var(--text-secondary)", cursor: "pointer",
      }}>
        <IconRefresh size={11} /> Refresh
      </button>

      {(!batch || batch.top.length === 0) ? (
        <div style={{ ...card, fontSize: "11px", color: "var(--text-secondary)" }}>
          💡 Tip: Open a job detail page on LinkedIn, Naukri, or an ATS site. Scoring uses your profile, ATS heuristics, freshness, and fit — locally when possible.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {batch.top.slice(0, 20).map((r, idx) => <JobCard key={r.cacheKey} r={r} idx={idx} />)}
        </div>
      )}
    </div>
  );
}

function JobCard({ r, idx }: { r: RecommendedJob; idx: number }) {
  const dec = r.decision;
  return (
    <a href={r.job.url || undefined} target="_blank" rel="noreferrer" style={{
      display: "block", textDecoration: "none",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "12px", padding: "12px 14px", transition: "border-color 0.15s",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.30)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: 600, marginBottom: "2px" }}>#{idx + 1} · {r.priority}</div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.job.title || "Current job"}</div>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.job.company || "Unknown"} · {r.job.location || "Remote"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1, color: scoreColor(r.score) }}>{r.score}</div>
          <span style={{
            display: "inline-block", marginTop: "3px", fontSize: "8px", fontWeight: 700,
            padding: "1px 7px", borderRadius: "99px",
            background: decisionBg[dec] || "rgba(255,255,255,0.06)",
            color: decisionColor[dec] || "var(--text-faint)",
          }}>{dec.replace("_", " ")}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "5px", marginTop: "10px" }}>
        {[["ATS", r.ats.passProbability],["Quality", r.india.indiaScore],["Trust", r.india.trust.score],["Req", r.ats.requiredScore]].map(([label, value]) => (
          <div key={label as string} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "6px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: scoreColor(value as number) }}>{value}</div>
            <div style={{ fontSize: "7.5px", textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
        {r.reasons.slice(0, 4).map((reason, i) => (
          <div key={i} style={{
            fontSize: "10px",
            color: reason.kind === "positive" ? "#34D399" : reason.kind === "risk" ? "#FB7185" : "#FBBF24",
          }}>
            {reason.kind === "positive" ? "✓" : reason.kind === "risk" ? "⚠" : "•"} {reason.label}: {reason.detail}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "8px", padding: "8px 10px",
      }}>
        <div style={{ fontSize: "8.5px", textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.08em", marginBottom: "3px" }}>Next action</div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{r.actions[0]}</div>
      </div>
    </a>
  );
}

/* ─── Advanced Search pane ───────────────────────────────────────────── */
function SearchView({
  filters, update, toggleSource, allSources, onSearch, searching, results, error,
}: {
  filters: AdvancedSearchFilters;
  update: <K extends keyof AdvancedSearchFilters>(k: K, v: AdvancedSearchFilters[K]) => void;
  toggleSource: (id: SearchBoardId) => void;
  allSources: { id: SearchBoardId; name: string; scraper: boolean }[];
  onSearch: () => void;
  searching: boolean;
  results: SearchResultSet | null;
  error: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Hero card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.22), rgba(217,70,239,0.18))",
        border: "1px solid rgba(139,92,246,0.25)", borderRadius: "14px", padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <IconSparkles size={14} />
          <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(196,181,253,0.80)", fontWeight: 700 }}>
            Job discovery
          </div>
        </div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>Live APIs + board deep links</div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.60)", marginTop: "4px", lineHeight: 1.5 }}>
          Sources marked with • are queried by the extension. Your profile is scored locally; other boards open a pre-filled search page. Indeed may be blocked by its site.
        </div>
      </div>

      {/* Filter form */}
      <div style={{ ...card }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <div>
            <label style={labelStyle}>Keywords</label>
            <input style={inputStyle} placeholder="e.g. data scientist" value={filters.keywords} onChange={(e) => update("keywords", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} placeholder="e.g. Remote, Bengaluru" value={filters.location} onChange={(e) => update("location", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <div>
            <label style={labelStyle}>Experience (yrs)</label>
            <input style={inputStyle} type="number" value={filters.experienceYears ?? 0} onChange={(e) => update("experienceYears", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label style={labelStyle}>Remote</label>
            <select style={selectStyle} value={filters.remote} onChange={(e) => update("remote", e.target.value as AdvancedSearchFilters["remote"])}>
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Job type</label>
            <select style={selectStyle} value={filters.jobType} onChange={(e) => update("jobType", e.target.value as AdvancedSearchFilters["jobType"])}>
              <option value="fulltime">Full-time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
              <option value="parttime">Part-time</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
          <div>
            <label style={labelStyle}>Posted within</label>
            <select style={selectStyle} value={filters.postedWithinDays} onChange={(e) => update("postedWithinDays", Number(e.target.value))}>
              <option value={1}>24 hours</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Min match %</label>
            <input style={inputStyle} type="number" min={0} max={100} value={filters.minMatchScore}
              onChange={(e) => update("minMatchScore", Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
          </div>
          <div>
            <label style={labelStyle}>Min CTC (LPA)</label>
            <input style={inputStyle} type="number" value={filters.minSalaryLpa ?? ""}
              onChange={(e) => update("minSalaryLpa", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>

        {/* Board chips */}
        <div style={{ marginBottom: "10px" }}>
          <div style={{ ...labelStyle, marginBottom: "6px" }}>Boards ({(filters.sources ?? []).length} selected)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {allSources.map((b) => {
              const active = (filters.sources ?? []).includes(b.id as any);
              return (
                <button key={b.id} type="button" onClick={() => toggleSource(b.id)} style={{
                  fontSize: "9px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px", cursor: "pointer",
                  background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                  color: active ? "#A5B4FC" : "var(--text-faint)",
                  border: `1px solid ${active ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.10)"}`,
                  transition: "all 0.12s",
                }}>
                  {b.name}{b.scraper ? " •" : ""}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-faint)", marginTop: "5px" }}>• = live feed queried now; Greenhouse and Lever query only the listed configured company boards. Other boards open pre-filled search pages.</div>
        </div>

        <button type="button" onClick={onSearch} disabled={searching || !filters.keywords.trim()} style={{
          width: "100%", padding: "9px", fontSize: "11px", fontWeight: 700, borderRadius: "10px", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          background: searching || !filters.keywords.trim()
            ? "rgba(255,255,255,0.06)"
            : "linear-gradient(135deg,#6366F1,#8B5CF6)",
          color: searching || !filters.keywords.trim() ? "rgba(255,255,255,0.30)" : "#fff",
          boxShadow: searching || !filters.keywords.trim() ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
          cursor: searching || !filters.keywords.trim() ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}>
          <IconSearch size={12} />
          {searching ? "Searching & scoring…" : "Search jobs & score matches"}
        </button>

        {error && (
          <div style={{
            marginTop: "8px", fontSize: "10px", color: "#FB7185",
            background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.20)",
            borderRadius: "8px", padding: "8px 10px",
          }}>{error}</div>
        )}
      </div>

      {results && (
        <>
          <div style={{
            ...card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))",
          }}>
            <div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-faint)", fontWeight: 700 }}>
                Search results
              </div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                {results.total} {results.total === 1 ? "posting" : "postings"}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-faint)", marginTop: "2px" }}>
                {results.query.keywords} · {results.query.location || "Location not specified"}
              </div>
            </div>
            <button type="button" onClick={onSearch} disabled={searching} style={{
              flexShrink: 0,
              padding: "7px 10px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-secondary)",
              fontSize: "10px",
              fontWeight: 700,
              cursor: searching ? "wait" : "pointer",
              opacity: searching ? 0.6 : 1,
            }}>
              <IconRefresh size={11} /> {searching ? "Refreshing" : "Refresh"}
            </button>
          </div>

          <div style={{
            ...card,
            fontSize: "10px",
            color: "var(--text-secondary)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: "7px" }}>Live source status</div>
            {results.discovery.boardStatuses.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: results.discovery.message ? "6px" : 0 }}>
                {results.discovery.boardStatuses.map((source) => (
                  <span key={source.board} style={{
                    padding: "2px 7px",
                    borderRadius: "99px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: source.status === "succeeded" ? "#34D399" : "#FB7185",
                    background: source.status === "succeeded" ? "rgba(52,211,153,0.10)" : "rgba(251,113,133,0.10)",
                  }}>
                    {source.board} · {source.status === "succeeded" ? "responded" : "failed"}
                  </span>
                ))}
              </div>
            )}
            {results.discovery.message && <div style={{ lineHeight: 1.5 }}>{results.discovery.message}</div>}
          </div>

          {/* Deep links */}
          {results.deepLinks.length > 0 && <div style={card}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-faint)", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px" }}>
              <IconBriefcase size={10} /> Board deep links ({results.deepLinks.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {results.deepLinks.map((l) => (
                <button key={l.id} type="button" onClick={() => openSearchResultInTab(l.url)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "5px",
                  fontSize: "10px", padding: "7px 10px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", textAlign: "left", cursor: "pointer", transition: "all 0.12s",
                  color: "var(--text-secondary)",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.30)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  <IconExternalLink size={10} />
                </button>
              ))}
            </div>
          </div>}

          {/* Scraped & scored */}
          <div>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-faint)", fontWeight: 700, marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
              <IconBolt size={10} /> Recommended postings ({results.scrapedJobs.length})
            </div>
            <div style={{ fontSize: "9px", color: "var(--text-faint)", marginBottom: "8px", lineHeight: 1.5 }}>
              Match scores are profile-fit ranking signals, not ATS pass or interview predictions. Verify details on the employer’s posting.
            </div>
            {results.scrapedJobs.length === 0 ? (
              <div style={{ ...card, fontSize: "11px", color: "var(--text-secondary)" }}>
                {results.discovery.message ?? "No jobs matched the selected filters."} Use a job or board link above to open the posting; review it before applying.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {results.scrapedJobs
                  .filter((j) => j.matchScore === null || j.matchScore >= (filters.minMatchScore ?? 0))
                  .slice(0, 25)
                  .map((j, idx) => {
                    const dec = j.decision;
                    return (
                      <button key={j.id || idx} type="button"
                        aria-label={`Open ${j.title || "job posting"} at ${j.company || "the original source"}; review before applying`}
                        onClick={() => openSearchResultInTab(j.deepLinkUrl)} style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "12px", padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s",
                        color: "inherit",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.30)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: 600, marginBottom: "2px" }}>#{idx + 1} · {j.source} · {postedLabel(j.postedAt)}</div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title || "Untitled job"}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {j.company} · {j.location || "—"} {j.salary ? `· ${j.salary}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1, color: scoreColor(j.matchScore) }}>
                              {j.matchScore === null ? "—" : j.matchScore}
                            </div>
                            <div style={{ fontSize: "7px", color: "var(--text-faint)", marginTop: "1px" }}>
                              {j.matchScore === null ? "NO PROFILE SCORE" : "PROFILE MATCH / 100"}
                            </div>
                            <span style={{
                              display: "inline-block", marginTop: "3px", fontSize: "8px", fontWeight: 700,
                              padding: "1px 7px", borderRadius: "99px",
                              background: decisionBg[dec] || "rgba(255,255,255,0.06)",
                              color: decisionColor[dec] || "var(--text-faint)",
                            }}>{dec.replace("_", " ")}</span>
                            {j.quickApplySupported && (
                              <div style={{ fontSize: "8px", fontWeight: 700, color: "#34D399", marginTop: "3px" }}>SJA autofill</div>
                            )}
                          </div>
                        </div>
                        {j.reasons.length > 0 && (
                          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                            {j.reasons.slice(0, 2).map((r, i) => (
                              <div key={i} style={{ fontSize: "10px", color: "var(--text-secondary)" }}>• {r}</div>
                            ))}
                          </div>
                        )}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginTop: "10px",
                          paddingTop: "8px",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          color: "#A5B4FC",
                          fontSize: "9px",
                          fontWeight: 700,
                        }}>
                          <span>{j.quickApplySupported ? "SJA autofill supported · review before applying" : "Open original posting · review before applying"}</span>
                          <IconExternalLink size={11} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
      {searching && !results && (
        <div role="status" aria-live="polite" style={{
          ...card,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--text-secondary)",
          fontSize: "10px",
        }}>
          <IconSearch size={12} /> Searching selected live feeds and preparing board links…
        </div>
      )}
    </div>
  );
}
