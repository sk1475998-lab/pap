import { useEffect, useState } from "react";
import type { AgentSettings } from "@superjob/core";
import { DEFAULT_AGENT_SETTINGS } from "@superjob/core";
import { exportStoreSnapshot, importStoreSnapshot, getAgentSettings, saveAgentSettings, api } from "@/popup/api.js";
import type { RunAuditReport } from "@superjob/core";
import { getCloudLLMConfig, type CloudLLMConfigSummary } from "@/lib/cloud-llm.js";
import { getLLM } from "@/lib/store.js";
import { clearDiagnostics, exportDiagnosticsJson, getDiagnostics, type DiagEntry } from "@/lib/diagnostics.js";
import { exportAuditHistoryJson, getLastAudit } from "@/lib/audit-store.js";
import {
  deleteCredential,
  listCredentials,
  saveCredential,
  setCredentialPassphrase,
  type SiteCredential,
} from "@/lib/credential-store.js";
import { clearTimeline, exportTimelineJson, getTimeline, type TimelineEvent } from "@/lib/observability-timeline.js";
import { syncWithCloud, getSyncState, type SyncState, getCloudApiUrl, setCloudApiUrl, testCloudConnection, setCloudApiUrlAndTest } from "@/lib/sync/sync-client.js";
import { getQuotaStatus, type QuotaStatus } from "@/lib/quota/quota-client.js";

export function SettingsTab() {
  const [llmConfig, setLlmConfig] = useState<CloudLLMConfigSummary | null>(null);
  const [llmConfigError, setLlmConfigError] = useState("");
  const [agent, setAgent] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState<DiagEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [lastAudit, setLastAudit] = useState<RunAuditReport | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [cloudUrlInput, setCloudUrlInput] = useState("");
  const [cloudTestResult, setCloudTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cloudTestBusy, setCloudTestBusy] = useState(false);
  const [cloudUrlSaved, setCloudUrlSaved] = useState(false);
  const [cloudUrl, setCloudUrl] = useState("http://localhost:3001/api");
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [aiTestBusy, setAiTestBusy] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    void getCloudLLMConfig().then(setLlmConfig).catch((error) => {
      setLlmConfigError(error instanceof Error ? error.message : "Could not load dashboard AI configuration.");
    });
    void getAgentSettings().then(setAgent);
    void getLastAudit().then(setLastAudit);
    void getSyncState().then(setSyncState);
    void getCloudApiUrl().then((u) => { setCloudUrl(u); setCloudUrlInput(u); });
    void getCloudApiUrl().then(setCloudUrl);
    void getQuotaStatus().then(setQuota);

    const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.sja_quota_status?.newValue) {
        setQuota(changes.sja_quota_status.newValue as QuotaStatus);
      }
    };
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange);
      return () => chrome.storage.onChanged.removeListener(onStorageChange);
    }
  }, []);

  const handleSaveCloudUrl = async () => {
    if (!cloudUrlInput.trim()) return;
    setCloudTestBusy(true);
    setCloudTestResult(null);
    const { connectionTest } = await setCloudApiUrlAndTest(cloudUrlInput);
    setCloudUrl(cloudUrlInput);
    setCloudUrlSaved(true);
    setCloudTestResult(
      connectionTest.ok
        ? { ok: true, msg: `Connected (${connectionTest.latencyMs}ms)${connectionTest.serverVersion ? " v" + connectionTest.serverVersion : ""}` }
        : { ok: false, msg: `Failed: ${connectionTest.error}` }
    );
    setCloudTestBusy(false);
  };

  const handleTestOnly = async () => {
    setCloudTestBusy(true);
    setCloudTestResult(null);
    const r = await testCloudConnection(cloudUrlInput || cloudUrl);
    setCloudTestResult(r.ok ? { ok: true, msg: `Connected (${r.latencyMs}ms)` } : { ok: false, msg: `Failed: ${r.error}` });
    setCloudTestBusy(false);
  };
  const doSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    const res = await syncWithCloud();
    const st = await getSyncState();
    setSyncState(st);
    void getQuotaStatus(true).then(setQuota);
    setSyncing(false);
    if (res.ok) {
      setSyncMsg(`✅ Synced with Cloud (${res.changed?.length ?? 0} keys merged)`);
    } else {
      setSyncMsg(`❌ Sync error: ${res.error || 'Server unreachable'}`);
    }
  };

  const openDashboardBilling = () => {
    openWebDashboard("billing");
  };

  const openWebDashboard = (subpath = "") => {
    const target = `http://localhost:5173/${subpath.replace(/^\//, "")}`;
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      void chrome.tabs.create({ url: target });
    } else {
      window.open(target, "_blank");
    }
  };

  const handleTestAiConnection = async () => {
    setAiTestBusy(true);
    setAiTestResult(null);
    try {
      if (!llmConfig?.ready) {
        throw new Error(llmConfig?.message || "Configure an AI provider in the web dashboard first.");
      }
      const testClient = await getLLM();
      const start = Date.now();
      const reply = await testClient.complete([
        { role: "user", content: "Reply with exactly: AI connection test passed" }
      ]);
      const latency = Date.now() - start;
      setAiTestResult({ ok: true, msg: `Connected (${latency}ms): "${reply.trim()}"` });
    } catch (err) {
      setAiTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setAiTestBusy(false);
    }
  };

  const refreshLogs = async () => {
    setLogs(await getDiagnostics(50));
  };

  const save = async () => {
    await saveAgentSettings(agent);
    setSaved(true);
  };

  const toggleAgent = (key: keyof AgentSettings) => {
    const next = { ...agent, [key]: !agent[key] };
    setAgent(next);
    setSaved(false);
    // Auto-save on toggle so autopilot picks up changes immediately without
    // requiring an explicit "Save settings" click.
    void saveAgentSettings(next).then(() => setSaved(true));
  };

  const exportData = async () => {
    const json = await exportStoreSnapshot();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superjob-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const json = await file.text();
      await importStoreSnapshot(json);
      alert("Imported! Profile and settings are now in the extension.");
    } catch (e) {
      alert("Import failed: " + (e instanceof Error ? e.message : e));
    }
  };

  return (
    <div className="space-y-3">
      {/* Plan & Limits (SuperJob Subscription & Quota Engine) */}
      <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-3 space-y-2 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
            💎 Plan & Limits
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
            quota?.tier === "ultra"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : quota?.isPro
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-slate-700 text-slate-300"
          }`}>
            {quota?.tier === "ultra" ? "👑 ULTRA" : quota?.isPro ? "⚡ PRO" : "FREE"}
          </span>
        </div>

        {/* Quota bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Applications this 30-day period</span>
            <span className="font-semibold">
              {quota?.isPro ? "Unlimited" : `${quota?.usedThisPeriod ?? 0} / ${quota?.monthlyLimit ?? 150}`}
            </span>
          </div>
          {!quota?.isPro && (
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, ((quota?.usedThisPeriod ?? 0) / (quota?.monthlyLimit ?? 150)) * 100)}%` }}
              />
            </div>
          )}
          {!quota?.isPro && quota?.resetsAt && (
            <div className="text-[10px] text-slate-400">
              Resets {new Date(quota.resetsAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Upgrade CTA or Pro Features */}
        {!quota?.isPro ? (
          <div className="pt-1">
            <button
              type="button"
              onClick={openDashboardBilling}
              className="w-full bg-gradient-to-r from-amber-500 via-indigo-600 to-violet-600 hover:opacity-90 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md"
            >
              ⚡ Upgrade to Pro ($19/mo) — Unlimited Applies
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              ✓ {quota?.tier === "ultra" ? "Ultra" : "Pro"}: unlimited applications
            </div>
            {quota?.canManageSubscription && (
              <button type="button" onClick={openDashboardBilling} className="w-full rounded-lg border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/10">
                Manage subscription on Dashboard
              </button>
            )}
          </div>
        )}

      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-slate-900 p-3 text-white shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">AI configuration</div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            llmConfig?.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
          }`}>
            {llmConfig ? (llmConfig.ready ? "READY" : "NEEDS SETUP") : "CHECKING"}
          </span>
        </div>
        <div className="text-xs text-slate-300">
          {llmConfig
            ? `${llmConfig.provider} · ${llmConfig.model}. ${llmConfig.message}`
            : llmConfigError || "Loading the account's AI configuration…"}
        </div>
        <div className="flex gap-2">
          <a
            href="http://localhost:5173/settings"
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Manage on Dashboard
          </a>
          <button
            type="button"
            disabled={aiTestBusy || !llmConfig?.ready}
            onClick={handleTestAiConnection}
            className="rounded-lg border border-emerald-500/50 px-2.5 py-1.5 text-xs text-emerald-300 disabled:opacity-50"
          >
            {aiTestBusy ? "Testing…" : "Test AI"}
          </button>
        </div>
        {aiTestResult && (
          <div className={`rounded-lg border p-2 text-[11px] font-medium ${
            aiTestResult.ok
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-rose-500/30 bg-rose-950/40 text-rose-300"
          }`}>
            {aiTestResult.ok ? "✓ " : "Error: "}{aiTestResult.msg}
          </div>
        )}
      </div>

      {/* Cloud Sync Engine */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-3 space-y-2 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${syncState?.connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`}></span>
            ☁️ Cloud Sync Engine
          </div>
          <span className="text-[10px] text-slate-400">
            {syncState?.lastSyncAt ? `Synced ${new Date(syncState.lastSyncAt).toLocaleTimeString()}` : "Not synced yet"}
          </span>
        </div>
        <div className="text-xs text-slate-300">
          Syncs Profile, AI Answers, and Applications in real time with the Cloud Dashboard.
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void doSync()}
            disabled={syncing}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-50"
          >
            {syncing ? "🔄 Syncing with Cloud..." : "⚡ Sync Now with Cloud"}
          </button>
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white py-1.5 px-2.5 rounded-lg text-xs transition-all"
            title="Open Web Dashboard"
          >
            Dashboard ↗
          </a>
        </div>
        {syncMsg && (
          <div className={`text-[11px] font-medium pt-1 ${syncMsg.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>
            {syncMsg}
          </div>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
        <div className="text-[10px] font-semibold text-indigo-800 uppercase">🤖 Autonomous Copilot Mode</div>
        <label className="flex items-center gap-2 text-xs text-indigo-900 cursor-pointer">
          <input type="checkbox" checked={agent.autonomousMode} onChange={() => toggleAgent("autonomousMode")} className="accent-indigo-600" />
          Enable hands-free apply on LinkedIn
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.autoClickEasyApply} onChange={() => toggleAgent("autoClickEasyApply")} disabled={!agent.autonomousMode} />
          Auto-click Easy Apply
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.autoFillSteps} onChange={() => toggleAgent("autoFillSteps")} disabled={!agent.autonomousMode} />
          Auto-fill each step
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.autoAdvanceSteps} onChange={() => toggleAgent("autoAdvanceSteps")} disabled={!agent.autonomousMode} />
          Auto-click Next / Continue
        </label>
        <label className="flex items-center gap-2 text-[11px] text-rose-700 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.autoSubmit} onChange={() => toggleAgent("autoSubmit")} disabled={!agent.autonomousMode} />
          Auto-submit final application (use with care)
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.autoLogin ?? true} onChange={() => toggleAgent("autoLogin")} />
          Auto-fill login on career sites
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={agent.autoSubmitLogin ?? false}
            onChange={() => toggleAgent("autoSubmitLogin")}
            disabled={!agent.autoLogin}
          />
          Auto-submit login form
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.pauseOnOtp ?? true} onChange={() => toggleAgent("pauseOnOtp")} />
          Pause for OTP / verification code
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.verifyBeforeAdvance ?? true} onChange={() => toggleAgent("verifyBeforeAdvance")} disabled={!agent.autonomousMode} />
          Verify each step before continuing (manual review)
        </label>
        <label className="flex items-center gap-2 text-[11px] text-indigo-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.enableSubmitGuard ?? false} onChange={() => toggleAgent("enableSubmitGuard")} />
          Submit confirmation modal (Safeguard preview popup before submit)
        </label>
        <label className="flex items-center gap-2 text-[11px] text-emerald-800 cursor-pointer ml-4">
          <input type="checkbox" checked={agent.llmCacheEnabled ?? true} onChange={() => toggleAgent("llmCacheEnabled")} />
          Cache LLM answers (saves API quota)
        </label>
        <label className="flex items-center gap-2 text-[11px] text-emerald-800 cursor-pointer ml-4">
          <span className="w-28">Max LLM/run</span>
          <input
            type="number"
            min={0}
            max={20}
            value={agent.maxLlmCallsPerRun ?? 5}
            onChange={(e) => {
              const next = { ...agent, maxLlmCallsPerRun: Math.min(20, Math.max(0, Number(e.target.value) || 0)) };
              setAgent(next);
              setSaved(false);
              void saveAgentSettings(next).then(() => setSaved(true));
            }}
            className="w-14 text-xs border border-slate-200 rounded px-1 py-0.5"
          />
        </label>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div className="text-[10px] font-semibold text-slate-700 uppercase">🎯 Smart Job Targeting & Skip Filters</div>
        <div className="text-[11px] text-slate-500">
          Autopilot evaluates job postings against your criteria before applying, skipping unqualified roles to protect your quota.
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
            Target Job Titles (Whitelist)
          </label>
          <input
            type="text"
            placeholder="e.g. Software Engineer, Full Stack, Frontend (blank = any)"
            value={(agent.search?.titleKeywords ?? []).join(", ")}
            onChange={(e) => {
              const words = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              const next = { ...agent, search: { ...agent.search, titleKeywords: words } };
              setAgent(next);
              setSaved(false);
              void saveAgentSettings(next).then(() => setSaved(true));
            }}
            style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}
          />
          <div className="text-[10px] text-slate-400 mt-0.5">Only apply to postings matching at least one keyword.</div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-rose-700 mb-0.5">
            Exclude Job Titles (Blacklist / Skip Words)
          </label>
          <input
            type="text"
            placeholder="e.g. Senior, Lead, Director, Staff, Clearance, Intern, Unpaid"
            value={(agent.search?.titleBlacklist ?? []).join(", ")}
            onChange={(e) => {
              const words = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              const next = { ...agent, search: { ...agent.search, titleBlacklist: words } };
              setAgent(next);
              setSaved(false);
              void saveAgentSettings(next).then(() => setSaved(true));
            }}
            style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(244,63,94,0.40)", borderRadius: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}
          />
          <div className="text-[10px] text-slate-400 mt-0.5">Skip jobs if title contains any of these terms.</div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-rose-700 mb-0.5">
            Blacklisted Companies
          </label>
          <input
            type="text"
            placeholder="e.g. CyberCoders, Revature (comma-separated)"
            value={(agent.search?.blacklistedCompanies ?? []).join(", ")}
            onChange={(e) => {
              const words = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
              const next = { ...agent, search: { ...agent.search, blacklistedCompanies: words } };
              setAgent(next);
              setSaved(false);
              void saveAgentSettings(next).then(() => setSaved(true));
            }}
            style={{ width: "100%", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="text-[11px] font-medium text-slate-700">
            Max Experience Required (Years)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={30}
              value={agent.search?.maxExperienceYears ?? 0}
              onChange={(e) => {
                const num = Math.min(30, Math.max(0, Number(e.target.value) || 0));
                const next = { ...agent, search: { ...agent.search, maxExperienceYears: num } };
                setAgent(next);
                setSaved(false);
                void saveAgentSettings(next).then(() => setSaved(true));
              }}
              style={{ width: "64px", boxSizing: "border-box", fontSize: "12px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.04)", color: "var(--text-primary)", outline: "none" }}
            />
            <span className="text-[10px] text-slate-400">{agent.search?.maxExperienceYears ? "years max" : "No limit"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div>
            <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
              🔥 Prioritize Early Opportunities (&lt;25 applicants)
            </div>
            <div className="text-[10px] text-slate-500">
              Prefer postings with fewer listed applicants or posted within the last 24 hours.
            </div>
          </div>
          <input
            type="checkbox"
            checked={agent.search?.prioritizeEarlyApplicants ?? true}
            onChange={(e) => {
              const next = { ...agent, search: { ...agent.search, prioritizeEarlyApplicants: e.target.checked } };
              setAgent(next);
              setSaved(false);
              void saveAgentSettings(next).then(() => setSaved(true));
            }}
            className="accent-emerald-600 h-4 w-4 rounded"
          />
        </div>
      </div>

      <CredentialsSection />

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="text-[10px] font-medium text-slate-500 uppercase">CLI sync</div>
        <p className="text-[10px] text-slate-500">
          Export from here, then run <code className="bg-slate-100 px-1 rounded">npm run profile:import -- --file export.json</code> so crew/applier can use your profile.
        </p>
        <button
          type="button"
          onClick={() => void exportData()}
          className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-xs"
        >
          Export for CLI
        </button>
        <label className="flex items-center justify-center w-full border border-dashed border-slate-200 hover:border-indigo-400 rounded-lg py-2 text-xs text-slate-500 cursor-pointer">
          Import from CLI
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
            }}
          />
        </label>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium text-slate-500 uppercase">Last autofill audit</div>
          <button
            type="button"
            onClick={() => {
              setShowAudit(!showAudit);
              if (!showAudit) void getLastAudit().then(setLastAudit);
            }}
            className="text-[10px] text-indigo-600"
          >
            {showAudit ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          Auto-detects skipped fields, profile gaps, and applies safe repairs (CTC, notice period, etc.).
        </p>
        {showAudit && (
          <>
            {!lastAudit && <div className="text-[10px] text-slate-400">No audit yet — autofill a job form first.</div>}
            {lastAudit && (
              <div className="space-y-2 text-[10px]">
                <div className="text-slate-600">
                  {lastAudit.hostname} · {new Date(lastAudit.ts).toLocaleString()}
                </div>
                <div className="flex gap-3 text-slate-700">
                  <span className="text-green-700">✓ {lastAudit.summary.filled} filled</span>
                  <span className="text-amber-700">· {lastAudit.summary.skipped} skipped</span>
                  {lastAudit.summary.failed > 0 && (
                    <span className="text-rose-700">✗ {lastAudit.summary.failed} failed</span>
                  )}
                </div>
                {lastAudit.repairs.length > 0 && (
                  <div className="bg-emerald-50 rounded p-2 text-emerald-800">
                    Auto-fixed: {lastAudit.repairs.map((r) => r.action).join(", ")}
                  </div>
                )}
                {lastAudit.recommendations.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {lastAudit.recommendations.slice(0, 6).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const json = await exportAuditHistoryJson();
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `superjob-audit-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[10px] px-2 py-1 border rounded"
                >
                  Export audit history
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium text-slate-500 uppercase">Observability timeline</div>
          <button
            type="button"
            onClick={() => {
              setShowTimeline(!showTimeline);
              if (!showTimeline) void getTimeline(40).then(setTimeline);
            }}
            className="text-[10px] text-indigo-600"
          >
            {showTimeline ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-[10px] text-slate-500">Autofill steps, OTP pauses, and login events — no LLM cost.</p>
        {showTimeline && (
          <>
            <div className="flex gap-2">
              <button type="button" onClick={() => void getTimeline(40).then(setTimeline)} className="text-[10px] px-2 py-1 border rounded">
                Refresh
              </button>
              <button
                type="button"
                onClick={async () => {
                  const json = await exportTimelineJson();
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `superjob-timeline-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-[10px] px-2 py-1 border rounded"
              >
                Export
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearTimeline();
                  setTimeline([]);
                }}
                className="text-[10px] px-2 py-1 border rounded text-rose-600"
              >
                Clear
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 text-[9px] font-mono bg-slate-50 rounded p-2">
              {timeline.length === 0 && <div className="text-slate-400">No events yet.</div>}
              {timeline.map((e) => (
                <div key={e.id} className="text-slate-600">
                  [{new Date(e.ts).toLocaleTimeString()}] {e.kind}: {e.message}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium text-slate-500 uppercase">Diagnostics log</div>
          <button
            type="button"
            onClick={() => {
              setShowLogs(!showLogs);
              if (!showLogs) void refreshLogs();
            }}
            className="text-[10px] text-indigo-600"
          >
            {showLogs ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          Every autopilot step, skipped field, and error is logged here to pinpoint issues.
        </p>
        {showLogs && (
          <>
            <div className="flex gap-2">
              <button type="button" onClick={() => void refreshLogs()} className="text-[10px] px-2 py-1 border rounded">
                Refresh
              </button>
              <button
                type="button"
                onClick={async () => {
                  const json = await exportDiagnosticsJson();
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `superjob-diagnostics-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-[10px] px-2 py-1 border rounded"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearDiagnostics();
                  setLogs([]);
                }}
                className="text-[10px] px-2 py-1 border rounded text-rose-600"
              >
                Clear
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 text-[9px] font-mono bg-slate-50 rounded p-2">
              {logs.length === 0 && <div className="text-slate-400">No logs yet — apply to a job to generate entries.</div>}
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "error" ? "text-rose-700" : l.level === "warn" ? "text-amber-700" : "text-slate-600"
                  }
                >
                  [{new Date(l.ts).toLocaleTimeString()}] {l.area}/{l.event}: {l.message}
                  {l.data ? ` ${JSON.stringify(l.data)}` : ""}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="text-[10px] font-medium text-slate-500 uppercase">Sandbox demo</div>
        <p className="text-[10px] text-slate-500">
          Try autofill on a fake application hosted inside the extension — no signup, no real data sent anywhere.
        </p>
        <button
          type="button"
          onClick={() => {
            chrome.tabs.create({ url: chrome.runtime.getURL("demo-job.html") });
          }}
          className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2 rounded-lg text-xs"
        >
          Open demo application page
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="text-[10px] font-medium text-slate-500 uppercase">Keyboard shortcuts</div>
        <ul className="text-[10px] text-slate-500 space-y-1">
          <li><b>Alt + Shift + F</b> — Autofill the current page</li>
          <li><b>Alt + Shift + A</b> — Open Super Job Agent popup</li>
          <li style={{color:"#94a3b8"}}>Customize at <code>chrome://extensions/shortcuts</code></li>
        </ul>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="text-[10px] font-medium text-slate-500 uppercase">Autofill memory</div>
        <p className="text-[10px] text-slate-500">
          Super Job Agent remembers which selectors worked on each site (Adaptive pattern learning) to skip DOM scanning on your next visit. Clear it if a site's form has changed.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              try { await api.clearPatterns("origin"); alert("Cleared learned autofill patterns for this site."); }
              catch (e) { alert("No active job page to clear patterns for (" + (e instanceof Error ? e.message : String(e)) + "). Open a job page first, or use Clear all."); }
            }}
            className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs"
          >
            Clear for this site
          </button>
          <button
            type="button"
            onClick={async () => {
              try { await api.clearPatterns("all"); alert("Cleared all learned autofill patterns."); }
              catch { alert("Open any job page first, then try again."); }
            }}
            className="flex-1 border border-rose-200 hover:bg-rose-50 text-rose-700 py-2 rounded-lg text-xs"
          >
            Clear all sites
          </button>
        </div>
      </div>

      <button
        onClick={save}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm"
      >
        {saved ? "✓ Saved" : "Save settings"}
      </button>
    </div>
  );
}

function CredentialsSection() {
  const [creds, setCreds] = useState<SiteCredential[]>([]);
  const [host, setHost] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [vaultPass, setVaultPass] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = async () => setCreds(await listCredentials());

  useEffect(() => {
    void refresh();
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      chrome.storage.session.get("vaultPassphrase").then((res) => {
        const passphrase = (res as Record<string, unknown>).vaultPassphrase;
        if (typeof passphrase === "string" && passphrase) {
          setVaultPass(passphrase);
          setCredentialPassphrase(passphrase);
        }
      }).catch(() => {});
    }
  }, []);

  const add = async () => {
    if (!host.trim() || !email.trim() || !password) {
      setMsg("Hostname, email, and password are required.");
      return;
    }
    if (!vaultPass.trim()) {
      setMsg("Vault passphrase is required. Passwords are encrypted locally before saving.");
      return;
    }
    setCredentialPassphrase(vaultPass);
    await saveCredential({ hostname: host.trim(), email, password, label: label || undefined });
    setHost("");
    setEmail("");
    setPassword("");
    setLabel("");
    setMsg("Saved.");
    await refresh();
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div className="text-[10px] font-medium text-slate-500 uppercase">Site credentials</div>
      <p className="text-[10px] text-slate-500">
        Saved per hostname (e.g. career.infosys.com). Vault passphrase is required; passwords are encrypted locally and never logged.
      </p>
      <input
        type="password"
        placeholder="Vault passphrase (required to save passwords)"
        value={vaultPass}
        onChange={(e) => {
          setVaultPass(e.target.value);
          setCredentialPassphrase(e.target.value || null);
        }}
        className="text-xs border border-slate-200 rounded px-2 py-1.5 w-full"
      />
      {creds.length > 0 && (
        <ul className="space-y-1 text-[10px]">
          {creds.map((c) => (
            <li key={c.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
              <span>
                <b>{c.hostname}</b> · {c.email}
                {c.label ? ` (${c.label})` : ""}
              </span>
              <button
                type="button"
                className="text-rose-600"
                onClick={async () => {
                  await deleteCredential(c.id);
                  await refresh();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        <input
          type="text"
          placeholder="Hostname (career.infosys.com)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1.5"
        />
      </div>
      {msg && <div className="text-[10px] text-emerald-700">{msg}</div>}
      <button
        type="button"
        onClick={() => void add()}
        className="w-full border border-indigo-200 text-indigo-700 font-medium py-2 rounded-lg text-xs hover:bg-indigo-50"
      >
        Save credential
      </button>
    </div>
  );
}
