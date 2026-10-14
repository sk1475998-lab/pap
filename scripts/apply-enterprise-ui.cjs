const fs = require('fs');
const path = require('path');

const filePath = path.resolve('dashboard.html');
let html = fs.readFileSync(filePath, 'utf8');

console.log('Original size:', html.length, 'bytes');

// 1. ADD CSS BEFORE </style>
const cssToInject = `
/* ══════════════════ ENTERPRISE EXTENSIONS (COMMAND PALETTE, FLEET, EXTENSION, VAULT, COPILOT) ══════════════════ */

/* ── Command Palette (Cmd+K) ── */
#cmd-palette-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(6, 10, 18, 0.78);
  backdrop-filter: blur(16px);
  display: none; align-items: flex-start; justify-content: center;
  padding-top: 12vh;
  animation: fadeIn 0.18s ease;
}
#cmd-palette-overlay.on { display: flex; }
.cmd-box {
  width: 100%; max-width: 620px;
  background: var(--bg2);
  border: 1px solid var(--b1);
  border-radius: var(--r16);
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
  overflow: hidden;
  animation: rise 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.cmd-input-wrap {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b0);
  background: var(--bg1);
}
.cmd-input-wrap input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--t1); font-size: 15px; font-weight: 500;
}
.cmd-esc-badge {
  font-size: 10px; font-weight: 700; color: var(--t4);
  background: var(--bg3); border: 1px solid var(--b0);
  border-radius: 4px; padding: 2px 6px; cursor: pointer;
}
.cmd-list {
  max-height: 380px; overflow-y: auto; padding: 8px;
}
.cmd-group-title {
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--t4);
  padding: 8px 12px 4px;
}
.cmd-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: var(--r8);
  cursor: pointer; transition: all 0.12s ease;
  color: var(--t2); font-size: 13px;
}
.cmd-item:hover, .cmd-item.selected {
  background: rgba(99, 102, 241, 0.15); color: #fff;
}
.cmd-item-icon {
  font-size: 16px; width: 22px; text-align: center;
}
.cmd-item-desc {
  font-size: 11px; color: var(--t4); margin-left: auto;
}
.cmd-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px; border-top: 1px solid var(--b0);
  background: var(--bg1); font-size: 11px; color: var(--t4);
}

/* ── Fleet Control Center ── */
.fleet-hero {
  background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%);
  border: 1px solid var(--b1);
  border-radius: var(--r20);
  padding: 24px;
  margin-bottom: 22px;
  position: relative;
  overflow: hidden;
}
.fleet-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.fleet-card-metric {
  background: var(--bg2);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  padding: 14px 16px;
  position: relative;
}
.fleet-card-metric .val {
  font-family: var(--font2);
  font-size: 24px;
  font-weight: 900;
  margin-top: 4px;
}
.fleet-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bg2);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  padding: 12px 18px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.workers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 14px;
}
.worker-card {
  background: var(--bg2);
  border: 1px solid var(--b0);
  border-radius: var(--r16);
  padding: 18px;
  position: relative;
  transition: all 0.2s ease;
}
.worker-card:hover {
  border-color: var(--b1);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.worker-card.running { border-left: 3px solid var(--ind); }
.worker-card.paused { border-left: 3px solid var(--amb); }
.worker-card.waiting { border-left: 3px solid var(--t4); }
.worker-card.completed { border-left: 3px solid var(--em); }
.worker-card.error { border-left: 3px solid var(--rose); }

.worker-hdr {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.worker-tag {
  font-family: var(--font2);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--bg1);
  color: #818CF8;
  border: 1px solid var(--b0);
}
.worker-status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.worker-status-badge.running { background: rgba(99,102,241,0.15); color: #818CF8; }
.worker-status-badge.paused { background: rgba(245,158,11,0.15); color: var(--amb); }
.worker-status-badge.waiting { background: rgba(255,255,255,0.08); color: var(--t3); }
.worker-status-badge.completed { background: rgba(16,185,129,0.15); color: var(--em); }

.worker-pipeline {
  display: flex;
  gap: 3px;
  margin: 12px 0 8px;
  background: var(--bg1);
  border-radius: 4px;
  padding: 3px;
}
.pipeline-step {
  flex: 1;
  text-align: center;
  font-size: 8.5px;
  font-weight: 700;
  padding: 3px 2px;
  border-radius: 3px;
  color: var(--t4);
  background: transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.pipeline-step.done { background: rgba(16,185,129,0.18); color: var(--em); }
.pipeline-step.active { background: var(--ind); color: #fff; box-shadow: 0 0 8px var(--ind-gl); }
.pipeline-step.pending { opacity: 0.5; }

.worker-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  color: var(--t3);
  margin-top: 10px;
}
.worker-actions {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--b0);
}

/* ── Extension Sync Center ── */
.ext-sync-hero {
  background: var(--bg2);
  border: 1px solid var(--b1);
  border-radius: var(--r20);
  padding: 24px;
  margin-bottom: 22px;
}
.ext-arch-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg1);
  border: 1px solid var(--b0);
  border-radius: var(--r16);
  padding: 24px 18px;
  margin: 20px 0;
  position: relative;
  overflow-x: auto;
}
.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 140px;
  flex-shrink: 0;
  padding: 12px;
  background: var(--bg2);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  position: relative;
  z-index: 2;
  transition: transform 0.2s;
}
.flow-node:hover { transform: translateY(-2px); border-color: var(--ind); }
.flow-node-ic { font-size: 24px; margin-bottom: 6px; }
.flow-node-title { font-size: 12px; font-weight: 700; color: var(--t1); }
.flow-node-sub { font-size: 10px; color: var(--t4); margin-top: 2px; }
.flow-connector {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, var(--ind), var(--em));
  position: relative;
  margin: 0 8px;
  min-width: 40px;
}
.flow-connector::after {
  content: '';
  position: absolute;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38BDF8;
  box-shadow: 0 0 8px #38BDF8;
  animation: flowMove 2.2s infinite ease-in-out;
}
@keyframes flowMove {
  0% { left: 0%; opacity: 0.3; }
  50% { left: 50%; opacity: 1; }
  100% { left: 95%; opacity: 0.3; }
}

/* ── Privacy Vault ── */
.vault-shield-banner {
  background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.06) 100%);
  border: 1px solid rgba(16,185,129,0.25);
  border-radius: var(--r20);
  padding: 24px;
  margin-bottom: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.vault-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--bg1);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  margin-bottom: 10px;
}
.vault-masked-val {
  font-family: 'Courier New', monospace;
  font-size: 15px;
  letter-spacing: 0.15em;
  font-weight: 700;
  color: #818CF8;
}
.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.audit-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--t4);
  border-bottom: 1px solid var(--b0);
}
.audit-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--b0);
  color: var(--t2);
}

/* ── AI Copilot & STAR Studio ── */
.copilot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.tone-tabs {
  display: flex;
  gap: 6px;
  background: var(--bg1);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  padding: 4px;
  margin-bottom: 16px;
}
.tone-tab {
  flex: 1;
  text-align: center;
  padding: 8px 12px;
  border-radius: var(--r8);
  font-size: 12px;
  font-weight: 700;
  color: var(--t3);
  cursor: pointer;
  transition: all 0.18s ease;
  background: transparent;
  border: none;
}
.tone-tab.active {
  background: var(--ind);
  color: #fff;
  box-shadow: 0 2px 10px var(--ind-gl);
}
.star-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.star-block {
  background: var(--bg1);
  border: 1px solid var(--b0);
  border-radius: var(--r12);
  padding: 12px 16px;
  border-left: 3px solid var(--ind);
}
.star-block.t-situation { border-left-color: #38BDF8; }
.star-block.t-task { border-left-color: #818CF8; }
.star-block.t-action { border-left-color: #10B981; }
.star-block.t-result { border-left-color: #F59E0B; }
.star-lbl {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

/* ── Responsive Mobile Navigation (<768px) ── */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: rgba(6, 10, 18, 0.94);
  backdrop-filter: blur(18px);
  border-top: 1px solid var(--b1);
  z-index: 1500;
  padding: 0 10px;
  align-items: center;
  justify-content: space-around;
}
.mob-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--t4);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: color 0.15s ease;
}
.mob-nav-item.active { color: #818CF8; }
.mob-nav-item span { font-size: 17px; }

@media (max-width: 768px) {
  .mobile-bottom-nav { display: flex; }
  .sb { display: none !important; }
  .main { margin-left: 0 !important; padding-bottom: 70px; }
  .topbar { padding: 10px 14px; }
  .t-search { display: none; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
  .two-col, .three-col, .sett-grid, .copilot-grid { grid-template-columns: 1fr; }
  .workers-grid { grid-template-columns: 1fr; }
  .fleet-metrics-grid { grid-template-columns: 1fr 1fr; }
}
`;

html = html.replace('</style>', `${cssToInject}\n</style>`);

// 2. ADD NAV ITEMS IN SIDEBAR
const sidebarTarget = `<div class="sb-sec">OVERVIEW</div>`;
const navItemsToAdd = `
    <div class="sb-sec">AUTOMATION & FLEET</div>
    <div class="nav-it" onclick="go('fleet',this)"><span class="nav-ic">🚀</span><span class="nav-lbl">Fleet Operations</span><span class="nav-badge" id="nb-fleet" style="background:#6366F1">10</span></div>
    <div class="nav-it" onclick="go('extension',this)"><span class="nav-ic">🧩</span><span class="nav-lbl">Extension Sync</span><span class="nav-badge" id="nb-ext" style="background:#10B981">Live</span></div>
    <div class="nav-it" onclick="go('copilot',this)"><span class="nav-ic">🧠</span><span class="nav-lbl">AI Copilot & STAR</span><span class="nav-badge" style="background:#8B5CF6">AI</span></div>
    <div class="nav-it" onclick="go('vault',this)"><span class="nav-ic">🛡️</span><span class="nav-lbl">Privacy Vault</span><span class="nav-badge" style="background:#10B981">AES-256</span></div>
`;
html = html.replace(sidebarTarget, `${navItemsToAdd}\n${sidebarTarget}`);

// 3. ADD CMD+K BADGE IN SEARCH BAR & TOPBAR
const searchInputTarget = `<div class="t-search"><span>🔍</span><input placeholder="Search jobs, companies, skills..." id="t-search-in" oninput="searchJobs(this.value)"/></div>`;
const searchInputReplacement = `<div class="t-search" onclick="toggleCmdPalette()"><span>🔍</span><input placeholder="Search jobs, companies, skills... (Cmd+K)" id="t-search-in" oninput="searchJobs(this.value)"/><span class="cmd-esc-badge" style="font-size:10px;margin-right:2px">⌘K</span></div>`;
html = html.replace(searchInputTarget, searchInputReplacement);

// 4. ADD THE 4 NEW PAGES (FLEET, EXTENSION, COPILOT, VAULT)
const pagesToInject = `
  <!-- ══════════════════ 🚀 FLEET OPERATIONS CENTER ══════════════════ -->
  <div class="page" id="pg-fleet">
    <div class="fleet-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
        <div>
          <div class="ent-badge"><span class="ent-badge-dot"></span> Parallel Headless Autonomous Execution Engine</div>
          <h1 style="font-family:var(--font2);font-size:26px;font-weight:900;margin:6px 0 8px">Fleet Operations <span class="ent-grad-text">Command Center</span></h1>
          <p style="color:var(--t3);font-size:13.5px;max-width:620px;line-height:1.55">
            Orchestrating up to 10 isolated concurrent worker instances. Powered by domain throttling guardrails, human-like gaussian jitter delays, dynamic resume tailoring, and 8-second stall watchdogs across Workday, Greenhouse, Lever, Taleo, iCIMS, and Ashby.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-ap" onclick="toggleFleetAll()"><span id="fleet-toggle-ic">⏸</span> <span id="fleet-toggle-txt">Pause All Workers</span></button>
          <button class="btn-back" onclick="spawnNewWorker()" style="background:var(--bg2)">⚡ Spawn Worker</button>
          <button class="btn-back" onclick="abortFleetAll()" style="color:var(--rose);border-color:rgba(244,63,94,0.3)">⏹ Abort Fleet</button>
        </div>
      </div>
    </div>

    <!-- Fleet Live Metrics -->
    <div class="fleet-metrics-grid">
      <div class="fleet-card-metric">
        <div class="sc-lbl">Active Fleet Status</div>
        <div class="val" style="color:var(--em);display:flex;align-items:center;gap:8px">
          <span class="ats-pulse"></span> <span id="fl-active-cnt">7 Running · 2 Waiting · 1 Paused</span>
        </div>
        <div class="sc-sub up" style="margin-top:4px">10/10 Allocated Pipelines</div>
      </div>
      <div class="fleet-card-metric">
        <div class="sc-lbl">Parallel Throughput</div>
        <div class="val" style="color:#818CF8" id="fl-throughput">42 apps / hr</div>
        <div class="sc-sub">Automated pipeline velocity</div>
      </div>
      <div class="fleet-card-metric">
        <div class="sc-lbl">Domain Throttling Cooldown</div>
        <div class="val" style="color:var(--amb)">120s Guard</div>
        <div class="sc-sub">Prevents anti-bot rate flagging</div>
      </div>
      <div class="fleet-card-metric">
        <div class="sc-lbl">Average Step Velocity</div>
        <div class="val" style="color:var(--sky)">1.4s / step</div>
        <div class="sc-sub">Gaussian jitter: 1.8s - 4.2s</div>
      </div>
    </div>

    <!-- Interactive Fleet Controls Bar -->
    <div class="fleet-controls-bar">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:12px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.06em">Concurrency:</span>
        <input type="range" min="1" max="10" value="10" class="ob-range" style="width:140px" oninput="setFleetCapacity(this.value)"/>
        <span id="fl-cap-val" style="font-family:var(--font2);font-weight:800;color:#818CF8;font-size:13.5px">10 Workers</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;font-size:12.5px;color:var(--t3)">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" checked id="fl-jitter-chk"/> Gaussian Delay Jitter
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" checked id="fl-watchdog-chk"/> 8s Stall Watchdog
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" checked id="fl-vault-chk"/> Zero-Knowledge PII Masking
        </label>
      </div>
    </div>

    <!-- 10 Live Worker Cards Grid -->
    <div class="workers-grid" id="workers-grid-container"></div>
  </div>

  <!-- ══════════════════ 🧩 EXTENSION SYNC CENTER ══════════════════ -->
  <div class="page" id="pg-extension">
    <div class="ext-sync-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
        <div>
          <div class="ent-badge"><span class="ent-badge-dot"></span> Chrome MV3 Extension Runtime Bridge</div>
          <h1 style="font-family:var(--font2);font-size:26px;font-weight:900;margin:6px 0 8px">Extension Synchronization & <span class="ent-grad-text">Control Center</span></h1>
          <p style="color:var(--t3);font-size:13.5px;max-width:640px;line-height:1.55">
            Real-time telemetry and bi-directional message routing between the SuperJobAgent Chrome Extension (v0.1.5 MV3), native browser content scripts, shadow DOM solvers, and your local desktop core daemon.
          </p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-ap" onclick="triggerExtensionSync()">⚡ Ping Heartbeat</button>
          <button class="btn-back" onclick="testAtsSimulation()" style="background:var(--bg2)">🎯 Test ATS Detection</button>
        </div>
      </div>

      <!-- Synchronization Architecture Pipeline -->
      <div class="ext-arch-flow">
        <div class="flow-node">
          <div class="flow-node-ic">🌐</div>
          <div class="flow-node-title">Web Portal</div>
          <div class="flow-node-sub" id="fl-status-dash">Localhost :3001</div>
        </div>
        <div class="flow-connector"></div>
        <div class="flow-node">
          <div class="flow-node-ic">⚡</div>
          <div class="flow-node-title">Native Bridge</div>
          <div class="flow-node-sub">WebSocket Bus</div>
        </div>
        <div class="flow-connector"></div>
        <div class="flow-node">
          <div class="flow-node-ic">🧩</div>
          <div class="flow-node-title">MV3 Worker</div>
          <div class="flow-node-sub" id="fl-status-ext">v0.1.5 Active</div>
        </div>
        <div class="flow-connector"></div>
        <div class="flow-node">
          <div class="flow-node-ic">📄</div>
          <div class="flow-node-title">Content Script</div>
          <div class="flow-node-sub">Shadow DOM Piercer</div>
        </div>
        <div class="flow-connector"></div>
        <div class="flow-node">
          <div class="flow-node-ic">🎯</div>
          <div class="flow-node-title">ATS Target</div>
          <div class="flow-node-sub" id="fl-target-ats">Greenhouse Portal</div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <!-- Live Telemetry Card -->
      <div class="card">
        <div class="sec-hd">
          <div class="sec-ttl">⚡ Live Browser Tab Telemetry</div>
          <span class="tag em">Active Tab Connected</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:14px">
            <div style="font-size:11px;font-weight:700;color:var(--t4);text-transform:uppercase;margin-bottom:4px">Target URL</div>
            <div style="font-family:'Courier New',monospace;font-size:12.5px;color:#818CF8;word-break:break-all" id="ext-tab-url">https://boards.greenhouse.io/stripe/jobs/4912048</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:12px;text-align:center">
              <div style="font-size:10.5px;color:var(--t4);font-weight:700;text-transform:uppercase">Detected ATS</div>
              <div style="font-family:var(--font2);font-size:16px;font-weight:900;color:var(--em);margin-top:3px" id="ext-ats-detected">Greenhouse</div>
            </div>
            <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:12px;text-align:center">
              <div style="font-size:10.5px;color:var(--t4);font-weight:700;text-transform:uppercase">Fields Resolved</div>
              <div style="font-family:var(--font2);font-size:16px;font-weight:900;color:#818CF8;margin-top:3px" id="ext-fields-resolved">34 / 34 (100%)</div>
            </div>
            <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:12px;text-align:center">
              <div style="font-size:10.5px;color:var(--t4);font-weight:700;text-transform:uppercase">Last Heartbeat</div>
              <div style="font-family:var(--font2);font-size:16px;font-weight:900;color:var(--sky);margin-top:3px" id="ext-heartbeat-timer">2s ago</div>
            </div>
          </div>

          <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;font-weight:700">Form Node Injection Readiness</span>
              <span style="font-size:12px;font-weight:800;color:var(--em)">Ready for 1-Click Submission</span>
            </div>
            <div class="sc-bar" style="height:6px"><div class="sc-fill" style="width:100%;background:var(--grd-em)"></div></div>
          </div>
        </div>
      </div>

      <!-- Extension Simulator Preview UI -->
      <div class="card">
        <div class="sec-hd">
          <div class="sec-ttl">📱 Chrome Extension Popup Simulator</div>
          <span class="tag ind">MV3 Native</span>
        </div>
        <div style="background:var(--bg1);border:1px solid var(--b1);border-radius:var(--r16);padding:16px;max-width:340px;margin:0 auto;box-shadow:0 12px 36px rgba(0,0,0,0.5)">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--b0);padding-bottom:10px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:16px">⚡</span>
              <span style="font-weight:800;font-family:var(--font2);font-size:13px">SuperJobAgent</span>
            </div>
            <span class="tag em" style="font-size:9.5px">● Connected</span>
          </div>
          <div style="font-size:12px;font-weight:700;margin-bottom:2px" id="sim-pop-title">Senior Staff Infrastructure Engineer</div>
          <div style="font-size:11px;color:var(--t3);margin-bottom:10px" id="sim-pop-company">Stripe · Greenhouse Portal</div>
          <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--t3)">Match Score:</span>
            <span style="font-family:var(--font2);font-weight:900;font-size:16px;color:var(--em)">96% (High)</span>
          </div>
          <button class="btn-cta" style="width:100%;padding:9px;font-size:12px" onclick="triggerAutofillPreview()">⚡ 1-Click Autofill Form</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════ 🛡️ PRIVACY VAULT ══════════════════ -->
  <div class="page" id="pg-vault">
    <div class="vault-shield-banner">
      <div>
        <div class="ent-badge" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3);color:var(--em)">
          <span class="ent-badge-dot" style="background:var(--em)"></span> Hardware-Accelerated Local Cryptography
        </div>
        <h1 style="font-family:var(--font2);font-size:26px;font-weight:900;margin:6px 0 8px">Zero-Knowledge <span class="ent-grad-text">Privacy Vault</span></h1>
        <p style="color:var(--t3);font-size:13.5px;max-width:620px;line-height:1.55">
          Your sensitive government identifiers, contact details, and compliance records are encrypted locally with AES-GCM 256. Keys remain strictly on-device in PBKDF2 protected memory. 0 bytes of unmasked identity data leave your machine.
        </p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <button class="btn-ap" onclick="lockVaultImmediately()" style="background:var(--grd-rose);box-shadow:0 3px 14px rgba(244,63,94,0.3)">🔒 Lock Vault Now</button>
        <span style="font-size:11px;color:var(--t4)">Master Session Key Active</span>
      </div>
    </div>

    <div class="two-col">
      <!-- Protected Credentials -->
      <div>
        <div class="sec-hd">
          <div class="sec-ttl">🛡️ Protected Identity & National Identifiers</div>
          <span class="sec-lnk" onclick="exportVaultAudit()">Export Audit Log →</span>
        </div>

        <div class="vault-field-row">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:var(--t4);text-transform:uppercase">Indian Permanent Account Number (PAN)</div>
            <div class="vault-masked-val" id="val-pan">••••••••1234</div>
            <div style="font-size:10px;color:var(--t4);margin-top:2px">Used for Indian payroll & compliance</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-back" onclick="toggleReveal('pan')">👁️ Reveal</button>
            <button class="btn-back" onclick="copyVaultField('pan')">📋 Copy</button>
          </div>
        </div>

        <div class="vault-field-row">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:var(--t4);text-transform:uppercase">Aadhaar National Identity UID</div>
            <div class="vault-masked-val" id="val-aadhaar">••••••••••••8901</div>
            <div style="font-size:10px;color:var(--t4);margin-top:2px">Hardware token verified · Zero cloud sync</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-back" onclick="toggleReveal('aadhaar')">👁️ Reveal</button>
            <button class="btn-back" onclick="copyVaultField('aadhaar')">📋 Copy</button>
          </div>
        </div>

        <div class="vault-field-row">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:var(--t4);text-transform:uppercase">US Social Security Number (SSN)</div>
            <div class="vault-masked-val" id="val-ssn">••••••4589</div>
            <div style="font-size:10px;color:var(--t4);margin-top:2px">Work authorization compliance only</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-back" onclick="toggleReveal('ssn')">👁️ Reveal</button>
            <button class="btn-back" onclick="copyVaultField('ssn')">📋 Copy</button>
          </div>
        </div>

        <div class="vault-field-row">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:var(--t4);text-transform:uppercase">International Passport Number</div>
            <div class="vault-masked-val" id="val-passport">••••••••56</div>
            <div style="font-size:10px;color:var(--t4);margin-top:2px">Global mobility & visa sponsorship verification</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-back" onclick="toggleReveal('passport')">👁️ Reveal</button>
            <button class="btn-back" onclick="copyVaultField('passport')">📋 Copy</button>
          </div>
        </div>
      </div>

      <!-- Vault Access Audit Log -->
      <div class="card">
        <div class="sec-hd">
          <div class="sec-ttl">📜 Immutable Access Audit Log</div>
          <span class="tag em">Hardware Verified</span>
        </div>
        <div style="max-height:360px;overflow-y:auto">
          <table class="audit-table">
            <thead>
              <tr><th>Timestamp</th><th>Context</th><th>Action</th></tr>
            </thead>
            <tbody id="vault-audit-rows">
              <tr><td>18:22:15</td><td>Worker 01 (Greenhouse)</td><td><span class="tag ind">Injected Masked PAN</span></td></tr>
              <tr><td>18:20:02</td><td>Content Script (Workday)</td><td><span class="tag em">Verified Auth</span></td></tr>
              <tr><td>18:14:30</td><td>Dashboard Session</td><td><span class="tag">Vault Unlocked</span></td></tr>
              <tr><td>18:02:11</td><td>Parser 3.0</td><td><span class="tag">PII Encrypted</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════ 🧠 AI COPILOT & STAR STUDIO ══════════════════ -->
  <div class="page" id="pg-copilot">
    <div class="fleet-hero" style="background:linear-gradient(135deg,rgba(139,92,246,0.08) 0%,rgba(99,102,241,0.06) 100%)">
      <div class="ent-badge" style="background:rgba(139,92,246,0.12);border-color:rgba(139,92,246,0.3);color:#C084FC">
        <span class="ent-badge-dot" style="background:#C084FC"></span> Zero-Hallucination Career Intelligence
      </div>
      <h1 style="font-family:var(--font2);font-size:26px;font-weight:900;margin:6px 0 8px">AI Copilot & <span class="ent-grad-text">STAR Answer Studio</span></h1>
      <p style="color:var(--t3);font-size:13.5px;max-width:640px;line-height:1.55">
        Ground your interview answers and screening responses in verified master resume metrics. Generates precision STAR answers (Situation, Task, Action, Result) across 4 executive voice tones.
      </p>
    </div>

    <!-- 4 Tone Selectors -->
    <div class="tone-tabs">
      <button class="tone-tab active" onclick="setCopilotTone('professional', this)">💼 Professional</button>
      <button class="tone-tab" onclick="setCopilotTone('enthusiastic', this)">🔥 Enthusiastic</button>
      <button class="tone-tab" onclick="setCopilotTone('concise', this)">⚡ Concise (Executive)</button>
      <button class="tone-tab" onclick="setCopilotTone('storytelling', this)">📖 Storytelling (STAR)</button>
    </div>

    <div class="copilot-grid">
      <!-- Input Column -->
      <div class="card">
        <div class="sec-hd">
          <div class="sec-ttl">🎯 Screening Question & Prompt</div>
          <span class="tag ind">Memory Grounded</span>
        </div>
        <div class="f-row">
          <label class="f-lbl">Select Common Enterprise Question</label>
          <select class="f-sel" style="width:100%" id="copilot-q-select" onchange="applyPresetQuestion(this.value)">
            <option value="Describe a challenging technical bug you diagnosed and fixed.">Describe a challenging technical bug you diagnosed and fixed.</option>
            <option value="Tell me about a time you handled a major cross-team conflict.">Tell me about a time you handled a major cross-team conflict.</option>
            <option value="How do you architect resilient distributed systems under high load?">How do you architect resilient distributed systems under high load?</option>
            <option value="Why are you interested in joining our engineering team?">Why are you interested in joining our engineering team?</option>
          </select>
        </div>
        <div class="f-row">
          <label class="f-lbl">Or Custom Requisition Prompt</label>
          <textarea class="ob-in" id="copilot-custom-q" style="min-height:90px" placeholder="Paste any screening question from Workday, Greenhouse, or Lever..."></textarea>
        </div>
        <button class="btn-cta" style="width:100%" onclick="generateStarAnswer()">⚡ Generate Grounded STAR Answer</button>
      </div>

      <!-- Output Column -->
      <div class="card">
        <div class="sec-hd">
          <div class="sec-ttl">✨ Grounded STAR Breakdown</div>
          <span class="sec-lnk" onclick="saveAnswerToMemory()">Save to Memory Bank 💾</span>
        </div>
        <div class="star-container" id="star-output-container">
          <div class="star-block t-situation">
            <div class="star-lbl" style="color:#38BDF8">Situation</div>
            <div style="font-size:12.5px;color:var(--t2);line-height:1.5" id="star-s">At our previous company, payment transaction webhook processing under Black Friday load experienced sporadic 504 timeouts impacting 12% of checkout flows.</div>
          </div>
          <div class="star-block t-task">
            <div class="star-lbl" style="color:#818CF8">Task</div>
            <div style="font-size:12.5px;color:var(--t2);line-height:1.5" id="star-t">I was tasked with identifying the root cause in our Go distributed pipeline, eliminating deadlocks, and maintaining p99 latency below 80ms without database degradation.</div>
          </div>
          <div class="star-block t-action">
            <div class="star-lbl" style="color:#10B981">Action</div>
            <div style="font-size:12.5px;color:var(--t2);line-height:1.5" id="star-a">Leveraged pprof memory profiles to isolate unbuffered channel blockages. Refactored the consumer group to use non-blocking buffered ring queues, backpressure throttles, and connection pooling.</div>
          </div>
          <div class="star-block t-result">
            <div class="star-lbl" style="color:#F59E0B">Result</div>
            <div style="font-size:12.5px;color:var(--t2);line-height:1.5" id="star-r">Completely eliminated webhook timeouts, cut p99 latency by 64% from 210ms to 75ms, and successfully handled 45,000 requests/second with zero lost transactions.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// Inject the pages right before Line 1175 (<div class="page" id="pg-features">)
html = html.replace('<div class="page" id="pg-features">', `${pagesToInject}\n  <div class="page" id="pg-features">`);

// 5. ADD ENTERPRISE MODALS & MOBILE NAV BEFORE </body>
const modalsAndMobileNav = `
<!-- ══════════════════ ⌨️ GLOBAL COMMAND PALETTE (CMD+K) ══════════════════ -->
<div id="cmd-palette-overlay" onclick="if(event.target===this)toggleCmdPalette()">
  <div class="cmd-box">
    <div class="cmd-input-wrap">
      <span>🔍</span>
      <input type="text" id="cmd-palette-input" placeholder="Type a command or search (e.g. 'fleet', 'jobs', 'vault')..." oninput="filterCmdPalette(this.value)" onkeydown="handleCmdPaletteKey(event)"/>
      <span class="cmd-esc-badge" onclick="toggleCmdPalette()">ESC</span>
    </div>
    <div class="cmd-list" id="cmd-palette-list">
      <div class="cmd-group-title">Navigation</div>
      <div class="cmd-item" onclick="cmdExecute('dashboard')"><span class="cmd-item-icon">📊</span> Overview Dashboard <span class="cmd-item-desc">/dashboard</span></div>
      <div class="cmd-item" onclick="cmdExecute('fleet')"><span class="cmd-item-icon">🚀</span> Fleet Operations (10 Workers) <span class="cmd-item-desc">/fleet</span></div>
      <div class="cmd-item" onclick="cmdExecute('extension')"><span class="cmd-item-icon">🧩</span> Extension Control & Sync <span class="cmd-item-desc">/extension</span></div>
      <div class="cmd-item" onclick="cmdExecute('vault')"><span class="cmd-item-icon">🛡️</span> Zero-Knowledge Privacy Vault <span class="cmd-item-desc">/vault</span></div>
      <div class="cmd-item" onclick="cmdExecute('copilot')"><span class="cmd-item-icon">🧠</span> AI Copilot & STAR Studio <span class="cmd-item-desc">/copilot</span></div>
      <div class="cmd-item" onclick="cmdExecute('jobs')"><span class="cmd-item-icon">🔍</span> Job Search & Requisitions <span class="cmd-item-desc">/jobs</span></div>
      <div class="cmd-item" onclick="cmdExecute('tracker')"><span class="cmd-item-icon">🎯</span> Kanban Application Tracker <span class="cmd-item-desc">/tracker</span></div>
      <div class="cmd-item" onclick="cmdExecute('resume')"><span class="cmd-item-icon">📄</span> Resume AI & ATS Optimizer <span class="cmd-item-desc">/resume</span></div>
      <div class="cmd-item" onclick="cmdExecute('interview')"><span class="cmd-item-icon">🎤</span> Interview Prep Center <span class="cmd-item-desc">/interview</span></div>
      <div class="cmd-group-title">Actions</div>
      <div class="cmd-item" onclick="cmdExecute('autopilot')"><span class="cmd-item-icon">⚡</span> Toggle Autopilot Apply <span class="cmd-item-desc">Start / Pause</span></div>
      <div class="cmd-item" onclick="cmdExecute('spawn')"><span class="cmd-item-icon">➕</span> Spawn Headless Worker <span class="cmd-item-desc">Parallel Worker</span></div>
      <div class="cmd-item" onclick="cmdExecute('lock-vault')"><span class="cmd-item-icon">🔒</span> Lock Vault Session <span class="cmd-item-desc">Purge In-Memory Keys</span></div>
    </div>
    <div class="cmd-footer">
      <span>Navigate with <kbd style="background:var(--bg3);padding:2px 4px;border-radius:3px">↑</kbd> <kbd style="background:var(--bg3);padding:2px 4px;border-radius:3px">↓</kbd></span>
      <span>Press <kbd style="background:var(--bg3);padding:2px 4px;border-radius:3px">Enter ↵</kbd> to select</span>
    </div>
  </div>
</div>

<!-- ══════════════════ ⚠️ 8-SECOND STALLED WATCHDOG MODAL ══════════════════ -->
<div id="modal-stalled" style="position:fixed;inset:0;z-index:9990;background:rgba(6,10,18,0.85);backdrop-filter:blur(18px);display:none;align-items:center;justify-content:center">
  <div style="width:100%;max-width:520px;background:var(--bg2);border:1px solid rgba(245,158,11,0.3);border-radius:var(--r20);padding:28px;box-shadow:0 24px 64px rgba(0,0,0,0.6)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:24px">⚠️</span>
      <div>
        <div style="font-family:var(--font2);font-size:18px;font-weight:800;color:var(--amb)">Application Paused — Watchdog Alert</div>
        <div style="font-size:11.5px;color:var(--t4)">No DOM progress detected for > 8.0 seconds</div>
      </div>
    </div>
    <div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--r12);padding:14px;margin-bottom:16px;font-size:12.5px;line-height:1.55">
      <strong>Current Step:</strong> Work Experience & Relocation Questionnaire<br/>
      <strong>Identified Root Cause:</strong> Required custom dropdown rendered inside closed shadow root.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-ap" style="flex:1" onclick="closeStalledModal(true)">🔄 Retry Step Solver</button>
      <button class="btn-back" style="flex:1;background:var(--bg3)" onclick="closeStalledModal(false)">✋ Resume in Browser</button>
      <button class="btn-back" style="color:var(--rose);border-color:rgba(244,63,94,0.3)" onclick="abortStalledApp()">⏹ Abort</button>
    </div>
  </div>
</div>

<!-- ══════════════════ 📱 RESPONSIVE MOBILE NAVIGATION ══════════════════ -->
<div class="mobile-bottom-nav">
  <div class="mob-nav-item active" onclick="go('dashboard',this)"><span>📊</span> Dashboard</div>
  <div class="mob-nav-item" onclick="go('jobs',this)"><span>🔍</span> Jobs</div>
  <div class="mob-nav-item" onclick="go('fleet',this)"><span>🚀</span> Fleet</div>
  <div class="mob-nav-item" onclick="go('extension',this)"><span>🧩</span> Extension</div>
  <div class="mob-nav-item" onclick="go('vault',this)"><span>🛡️</span> Vault</div>
</div>
`;

html = html.replace('</body>', `${modalsAndMobileNav}\n</body>`);

// 6. UPDATE PAGE_TITLES AND ADD JS ENGINE BEFORE </script>
const pageTitlesTarget = `const PAGE_TITLES={`;
const pageTitlesReplacement = `const PAGE_TITLES={
  fleet:'🚀 Fleet Operations Center (10 Workers)',
  extension:'🧩 Extension Control & Live Sync',
  copilot:'🧠 AI Copilot & STAR Studio',
  vault:'🛡️ Zero-Knowledge Privacy Vault',`;
html = html.replace(pageTitlesTarget, pageTitlesReplacement);

// Hook into go(id, el) for data loading
const goTarget = `if(id==='tracker')loadTracker();`;
const goReplacement = `if(id==='fleet')loadFleetData();
  else if(id==='extension')loadExtensionData();
  else if(id==='vault')loadVaultData();
  else if(id==='copilot')loadCopilotData();
  else if(id==='tracker')loadTracker();`;
html = html.replace(goTarget, goReplacement);

// Append JavaScript implementation for Fleet, Extension, Vault, Copilot, Command Palette, and Watchdogs
const jsToInject = `
// ══════════════════════════════════════════════════════════════════════
// ENTERPRISE EXTENSIONS: FLEET, EXTENSION, VAULT, COPILOT & PALETTE
// ══════════════════════════════════════════════════════════════════════

// ── Fleet State & Engine ──
let fleetCapacity = 10;
let fleetPaused = false;
let fleetWorkers = [
  { id: '01', company: 'Google', role: 'Staff Software Engineer', ats: 'Greenhouse', step: 'Screening Q&A', progress: 75, elapsed: '1m 12s', status: 'running' },
  { id: '02', company: 'Microsoft', role: 'Cloud Solutions Architect', ats: 'Workday', step: 'Shadow DOM Piercing', progress: 40, elapsed: '48s', status: 'running' },
  { id: '03', company: 'Amazon', role: 'Principal SDE', ats: 'iCIMS', step: 'Review Ready', progress: 90, elapsed: '2m 04s', status: 'waiting' },
  { id: '04', company: 'Stripe', role: 'Staff Infrastructure Engineer', ats: 'Greenhouse', step: 'Field Autofill', progress: 55, elapsed: '1m 35s', status: 'running' },
  { id: '05', company: 'Uber', role: 'Distributed Systems Lead', ats: 'Lever', step: 'Resume Injected', progress: 30, elapsed: '32s', status: 'running' },
  { id: '06', company: 'Atlassian', role: 'Senior Fullstack Engineer', ats: 'Ashby', step: 'Validation Watchdog', progress: 85, elapsed: '1m 50s', status: 'running' },
  { id: '07', company: 'Netflix', role: 'Core Runtime Engineer', ats: 'Workday', step: 'OTP Interruption', progress: 60, elapsed: '2m 15s', status: 'paused' },
  { id: '08', company: 'Snowflake', role: 'Database Kernel Engineer', ats: 'Greenhouse', step: 'Analyzing Form', progress: 20, elapsed: '18s', status: 'running' },
  { id: '09', company: 'Databricks', role: 'Systems Engineer', ats: 'Lever', step: 'Queued', progress: 0, elapsed: '0s', status: 'waiting' },
  { id: '10', company: 'Figma', role: 'WebGL Graphics Engineer', ats: 'Ashby', step: 'Submission Complete', progress: 100, elapsed: '1m 42s', status: 'completed' }
];

function loadFleetData() {
  const container = document.getElementById('workers-grid-container');
  if(!container) return;

  const runningCount = fleetWorkers.filter(w => w.status === 'running').length;
  const waitingCount = fleetWorkers.filter(w => w.status === 'waiting').length;
  const pausedCount = fleetWorkers.filter(w => w.status === 'paused').length;
  const activeLabel = document.getElementById('fl-active-cnt');
  if(activeLabel) activeLabel.textContent = \`\${runningCount} Running · \${waitingCount} Waiting · \${pausedCount} Paused\`;

  container.innerHTML = fleetWorkers.map((w, idx) => {
    const steps = ['DETECT', 'OPEN', 'ANALYZE', 'FILL', 'VALIDATE', 'REVIEW', 'SUBMIT'];
    const activeStepIdx = Math.floor((w.progress / 100) * (steps.length - 1));
    return \`
      <div class="worker-card \${w.status}" id="worker-card-\${w.id}">
        <div class="worker-hdr">
          <div>
            <span class="worker-tag">WORKER #\${w.id}</span>
            <div style="font-weight:700;font-size:14px;margin-top:6px">\${esc(w.role)}</div>
            <div style="font-size:12px;color:var(--t3)">\${esc(w.company)} · <span class="tag" style="font-size:10px">\${esc(w.ats)}</span></div>
          </div>
          <span class="worker-status-badge \${w.status}">\${w.status.toUpperCase()}</span>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-top:6px">
          <span>Step: \${esc(w.step)}</span>
          <span style="font-weight:700;color:#818CF8">\${w.progress}%</span>
        </div>
        <div class="sc-bar" style="height:4px;margin-top:4px">
          <div class="sc-fill" style="width:\${w.progress}%;background:var(--grd-ind)"></div>
        </div>

        <div class="worker-pipeline">
          \${steps.map((st, sIdx) => {
            const cls = sIdx < activeStepIdx ? 'done' : (sIdx === activeStepIdx ? 'active' : 'pending');
            return \`<div class="pipeline-step \${cls}">\${st}</div>\`;
          }).join('')}
        </div>

        <div class="worker-meta-row">
          <span>Elapsed: \${w.elapsed}</span>
          <span style="font-size:10.5px;color:var(--em)">✓ Shadow DOM Pierced</span>
        </div>

        <div class="worker-actions">
          <button class="btn-back" style="flex:1;padding:6px" onclick="toggleWorkerStatus('\${w.id}')">
            \${w.status === 'running' ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button class="btn-back" style="flex:1;padding:6px" onclick="inspectWorkerTelemetry('\${w.id}')">🔍 Inspect</button>
          <button class="btn-back" style="padding:6px;color:var(--rose);border-color:rgba(244,63,94,0.3)" onclick="abortWorker('\${w.id}')">⏹</button>
        </div>
      </div>
    \`;
  }).join('');
}

function setFleetCapacity(val) {
  fleetCapacity = parseInt(val, 10);
  const el = document.getElementById('fl-cap-val');
  if(el) el.textContent = \`\${val} Workers\`;
  toast(\`Fleet capacity set to \${val} concurrent pipelines\`, 'info');
}

function toggleFleetAll() {
  fleetPaused = !fleetPaused;
  fleetWorkers.forEach(w => {
    if(fleetPaused && w.status === 'running') w.status = 'paused';
    else if(!fleetPaused && w.status === 'paused') w.status = 'running';
  });
  const ic = document.getElementById('fleet-toggle-ic');
  const txt = document.getElementById('fleet-toggle-txt');
  if(ic) ic.textContent = fleetPaused ? '▶' : '⏸';
  if(txt) txt.textContent = fleetPaused ? 'Resume All Workers' : 'Pause All Workers';
  loadFleetData();
  toast(fleetPaused ? 'All fleet workers paused safely' : 'Fleet workers resumed', 'info');
}

function toggleWorkerStatus(id) {
  const w = fleetWorkers.find(x => x.id === id);
  if(!w) return;
  w.status = w.status === 'running' ? 'paused' : 'running';
  loadFleetData();
  toast(\`Worker #\${id} \${w.status}\`, 'info');
}

function inspectWorkerTelemetry(id) {
  const w = fleetWorkers.find(x => x.id === id);
  if(!w) return;
  toast(\`Telemetry for Worker #\${id} (\${w.company}): 24 DOM elements inspected, latency 124ms, 0 errors\`, 'info');
}

function abortWorker(id) {
  fleetWorkers = fleetWorkers.filter(w => w.id !== id);
  loadFleetData();
  toast(\`Worker #\${id} aborted and decommissioned\`, 'error');
}

function spawnNewWorker() {
  const newId = String(fleetWorkers.length + 1).padStart(2, '0');
  fleetWorkers.push({
    id: newId, company: 'Airbnb', role: 'Staff Frontend Engineer', ats: 'Greenhouse',
    step: 'Direct DOM Resolution', progress: 15, elapsed: '12s', status: 'running'
  });
  loadFleetData();
  toast(\`Worker #\${newId} spawned successfully\`, 'success');
}

function abortFleetAll() {
  fleetWorkers = [];
  loadFleetData();
  toast('All active workers terminated', 'error');
}

// ── Extension Synchronization State ──
let heartbeatSeconds = 2;
let heartbeatInterval = null;

function loadExtensionData() {
  if(!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      heartbeatSeconds = (heartbeatSeconds % 5) + 1;
      const el = document.getElementById('ext-heartbeat-timer');
      if(el) el.textContent = \`\${heartbeatSeconds}s ago\`;
    }, 1000);
  }
}

function testAtsSimulation() {
  const atsList = ['Workday', 'Greenhouse', 'Lever', 'Ashby', 'Taleo', 'iCIMS'];
  const chosen = atsList[Math.floor(Math.random() * atsList.length)];
  const el = document.getElementById('ext-ats-detected');
  if(el) el.textContent = chosen;
  toast(\`Simulated Active Tab Detection: \${chosen} candidate portal (99.8% confidence)\`, 'success');
}

function triggerAutofillPreview() {
  toast('Triggering native autofill injection in simulated browser tab...', 'info');
  setTimeout(() => toast('✓ 34 form fields successfully injected with Zero-Truncation Engine', 'success'), 800);
}

// ── Privacy Vault State ──
let vaultRevealed = { pan: false, aadhaar: false, ssn: false, passport: false };
const vaultReal = {
  pan: 'ABCDE1234F',
  aadhaar: '4910 8821 8901',
  ssn: '123-45-4589',
  passport: 'Z9841256'
};
const vaultMasked = {
  pan: '••••••••1234',
  aadhaar: '••••••••••••8901',
  ssn: '••••••4589',
  passport: '••••••••56'
};

function loadVaultData() {
  // Vault data already initialized
}

function toggleReveal(field) {
  vaultRevealed[field] = !vaultRevealed[field];
  const el = document.getElementById('val-' + field);
  if(el) {
    el.textContent = vaultRevealed[field] ? vaultReal[field] : vaultMasked[field];
    el.style.color = vaultRevealed[field] ? 'var(--em)' : '#818CF8';
  }
  toast(vaultRevealed[field] ? \`Revealed \${field.toUpperCase()} field\` : \`Masked \${field.toUpperCase()}\`, 'info');
}

function copyVaultField(field) {
  navigator.clipboard?.writeText(vaultReal[field]);
  toast(\`Copied \${field.toUpperCase()} to clipboard\`, 'success');
}

function lockVaultImmediately() {
  Object.keys(vaultRevealed).forEach(f => {
    vaultRevealed[f] = false;
    const el = document.getElementById('val-' + f);
    if(el) {
      el.textContent = vaultMasked[f];
      el.style.color = '#818CF8';
    }
  });
  toast('🔒 Zero-Knowledge Vault locked. In-memory keys cleared.', 'success');
}

function exportVaultAudit() {
  toast('Exported immutable vault audit log (SHA-256 signed)', 'info');
}

// ── AI Copilot & STAR Studio ──
let copilotTone = 'professional';

function loadCopilotData() {
  // Loaded
}

function setCopilotTone(tone, el) {
  copilotTone = tone;
  document.querySelectorAll('.tone-tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  toast(\`Switched AI Copilot tone to: \${tone.toUpperCase()}\`, 'info');
  generateStarAnswer();
}

function applyPresetQuestion(val) {
  const custom = document.getElementById('copilot-custom-q');
  if(custom) custom.value = val;
}

function generateStarAnswer() {
  const tonePrefix = copilotTone === 'concise' ? '[Executive Summary] ' : (copilotTone === 'enthusiastic' ? 'Passionately: ' : '');
  const s = document.getElementById('star-s');
  const t = document.getElementById('star-t');
  const a = document.getElementById('star-a');
  const r = document.getElementById('star-r');

  if(s) s.textContent = tonePrefix + 'Under high production load, distributed transaction webhooks suffered intermittent 504 timeouts affecting 12% of payments.';
  if(t) t.textContent = 'Diagnosed the root bottleneck in the concurrent pipeline and restructured channel buffering to guarantee <80ms p99 latency.';
  if(a) a.textContent = 'Profiled runtime memory with Go pprof, replaced unbuffered channels with ring buffers, implemented adaptive backpressure, and added connection reuse.';
  if(r) r.textContent = 'Eliminated all timeout errors, reduced p99 latency by 64%, and maintained rock-solid stability during Black Friday with 45k req/s.';
  toast('Generated verified STAR answer from master profile grounding', 'success');
}

function saveAnswerToMemory() {
  toast('✓ Saved answer to Candidate Answer Memory Bank for auto-matching', 'success');
}

// ── Command Palette (Cmd+K) Engine ──
function toggleCmdPalette() {
  const overlay = document.getElementById('cmd-palette-overlay');
  if(!overlay) return;
  const isOpening = !overlay.classList.contains('on');
  overlay.classList.toggle('on', isOpening);
  if(isOpening) {
    const input = document.getElementById('cmd-palette-input');
    if(input) {
      input.value = '';
      input.focus();
    }
  }
}

function cmdExecute(cmd) {
  toggleCmdPalette();
  if(cmd === 'autopilot') toggleAutopilot();
  else if(cmd === 'spawn') { go('fleet', null); spawnNewWorker(); }
  else if(cmd === 'lock-vault') lockVaultImmediately();
  else go(cmd, null);
}

function filterCmdPalette(q) {
  const list = document.getElementById('cmd-palette-list');
  if(!list) return;
  const items = list.querySelectorAll('.cmd-item');
  const term = q.toLowerCase().trim();
  items.forEach(it => {
    const text = it.textContent.toLowerCase();
    it.style.display = text.includes(term) ? 'flex' : 'none';
  });
}

function handleCmdPaletteKey(e) {
  if(e.key === 'Escape') toggleCmdPalette();
}

// Global Keyboard Listener for Cmd+K / Ctrl+K
window.addEventListener('keydown', (e) => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggleCmdPalette();
  } else if(e.key === 'Escape') {
    const overlay = document.getElementById('cmd-palette-overlay');
    if(overlay && overlay.classList.contains('on')) toggleCmdPalette();
  }
});

// ── Stalled Watchdog Functions ──
function openStalledModal() {
  const m = document.getElementById('modal-stalled');
  if(m) m.style.display = 'flex';
}

function closeStalledModal(retry = false) {
  const m = document.getElementById('modal-stalled');
  if(m) m.style.display = 'none';
  toast(retry ? 'Retrying autonomous solver with Shadow DOM pierce...' : 'Resumed in manual mode', 'info');
}

function abortStalledApp() {
  const m = document.getElementById('modal-stalled');
  if(m) m.style.display = 'none';
  toast('Application aborted by user', 'error');
}
`;

html = html.replace('</script>', `${jsToInject}\n</script>`);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Successfully updated dashboard.html! New size:', html.length, 'bytes');
