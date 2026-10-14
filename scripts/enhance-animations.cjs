const fs = require('fs');
const path = require('path');

const filePath = path.resolve('dashboard.html');
let html = fs.readFileSync(filePath, 'utf8');

console.log('Original size before animation enhancement:', html.length, 'bytes');

// 1. ADD ADVANCED ANIMATION STYLES
const animationCss = `
/* ══════════════════ SUPERJOBAGENT ADVANCED MOTION & ANIMATION ENGINE ══════════════════ */

@keyframes sjaOrbitCW {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes sjaOrbitCCW {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}
@keyframes sjaPulseGlow {
  0%, 100% { filter: drop-shadow(0 0 3px #38BDF8) drop-shadow(0 0 8px rgba(99,102,241,0.5)); }
  50% { filter: drop-shadow(0 0 8px #38BDF8) drop-shadow(0 0 20px rgba(99,102,241,0.9)); }
}
@keyframes beamGlow {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
@keyframes photonTravel {
  0% { left: 0%; opacity: 0.2; transform: scale(0.8); }
  50% { left: 50%; opacity: 1; transform: scale(1.3); }
  100% { left: 96%; opacity: 0.2; transform: scale(0.8); }
}
@keyframes nodePulseActive {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
  50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
}
@keyframes borderSpark {
  0%, 100% { border-color: rgba(99,102,241,0.3); }
  50% { border-color: rgba(56,189,248,0.8); }
}

.sja-logo-orbit-outer {
  transform-origin: 16px 16px;
  animation: sjaOrbitCW 8s linear infinite;
}
.sja-logo-orbit-inner {
  transform-origin: 16px 16px;
  animation: sjaOrbitCCW 14s linear infinite;
}
.sja-logo-bolt {
  animation: sjaPulseGlow 2.5s ease-in-out infinite;
}

/* ── Floating Live Execution HUD Banner ── */
#live-execution-hud {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 8500;
  max-width: 480px;
  background: rgba(12, 18, 32, 0.94);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: var(--r16);
  padding: 16px 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 24px rgba(99, 102, 241, 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: rise 0.3s ease;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
#live-execution-hud.minimized {
  transform: translateY(80px);
  opacity: 0;
  pointer-events: none;
}
.hud-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.hud-logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hud-title {
  font-family: var(--font2);
  font-size: 13.5px;
  font-weight: 800;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.hud-wait-badge {
  font-size: 10px;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.15);
  color: var(--em);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.hud-msg {
  font-size: 12px;
  color: var(--t2);
  line-height: 1.45;
}
.hud-bar-wrap {
  height: 6px;
  background: var(--bg1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--b0);
}
.hud-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366F1, #38BDF8, #10B981);
  border-radius: 3px;
  width: 65%;
  position: relative;
  transition: width 0.8s ease;
}
.hud-bar-fill::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 40px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
  animation: beamGlow 1.8s infinite;
}
.hud-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

/* ── Live Worker Card Dynamic Transitions ── */
.worker-card.running {
  border-left: 3px solid var(--ind);
  animation: borderSpark 4s ease-in-out infinite;
}
.worker-card.running .pipeline-step.active {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: #fff;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.7);
  animation: nodePulseActive 2s infinite;
}
.worker-card.paused {
  border-left: 3px solid var(--amb);
}
.worker-card.completed {
  border-left: 3px solid var(--em);
}
`;

html = html.replace('</style>', `${animationCss}\n</style>`);

// 2. ENHANCE LOGO SVG TO USE ORBIT ANIMATION CLASSES
const oldLogoSvg = `<svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" stroke="#38BDF8" stroke-width="1.75" stroke-dasharray="3 3"/>
        <circle cx="16" cy="16" r="10.5" stroke="#818CF8" stroke-width="1" opacity="0.5"/>
        <path d="M17.5 4L9 16.5H15.5L14 28L23 14.5H16.5L17.5 4Z" fill="#38BDF8"/>
      </svg>`;

const animatedLogoSvg = `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" stroke="#38BDF8" stroke-width="1.75" stroke-dasharray="4 3" class="sja-logo-orbit-outer"/>
        <circle cx="16" cy="16" r="10" stroke="#818CF8" stroke-width="1.2" stroke-dasharray="2 4" opacity="0.6" class="sja-logo-orbit-inner"/>
        <path d="M17.5 4L9 16.5H15.5L14 28L23 14.5H16.5L17.5 4Z" fill="#38BDF8" class="sja-logo-bolt"/>
      </svg>`;

// Replace all occurrences of the old logo SVG with the animated one
html = html.split(oldLogoSvg).join(animatedLogoSvg);

// 3. INJECT THE FLOATING LIVE EXECUTION HUD BEFORE </body>
const hudHtml = `
<!-- ══════════════════ ⚡ FLOATING LIVE EXECUTION HUD ══════════════════ -->
<div id="live-execution-hud">
  <div class="hud-hdr">
    <div class="hud-logo-wrap">
      <div style="width:32px;height:32px;border-radius:9px;background:var(--bg1);border:1px solid rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center">
        ${animatedLogoSvg}
      </div>
      <div>
        <div class="hud-title">SuperJobAgent Running <span class="ats-pulse"></span></div>
        <div style="font-size:10.5px;color:var(--t4)" id="hud-sub-status">7 concurrent workers active</div>
      </div>
    </div>
    <span class="hud-wait-badge" id="hud-wait-time">~45s remaining</span>
  </div>

  <div class="hud-msg" id="hud-msg-text">
    ⚡ <strong>Worker 01:</strong> Piercing Workday Shadow DOM & injecting profile skills... Please wait ~1 minute for automated verification.
  </div>

  <div class="hud-bar-wrap">
    <div class="hud-bar-fill" id="hud-progress-bar" style="width: 65%"></div>
  </div>

  <div class="hud-actions">
    <button class="btn-back" style="flex:1;padding:6px;font-size:11.5px" onclick="toggleFleetAll()">
      <span id="hud-pause-btn-txt">⏸ Pause Fleet</span>
    </button>
    <button class="btn-back" style="flex:1;padding:6px;font-size:11.5px" onclick="go('fleet', null)">
      🚀 View Fleet Operations
    </button>
    <button class="btn-back" style="padding:6px 10px;font-size:11.5px" onclick="dismissHud()" title="Minimize HUD">
      ✕
    </button>
  </div>
</div>
`;

html = html.replace('</body>', `${hudHtml}\n</body>`);

// 4. ADD CONTINUOUS REAL-TIME WORKER ENGINE TICKER & HUD CONTROLLER IN SCRIPT
const engineJs = `
// ══════════════════════════════════════════════════════════════════════
// REAL-TIME ANIMATED WORKER ENGINE & EXECUTION HUD CONTROLLER
// ══════════════════════════════════════════════════════════════════════

let hudDismissed = false;
let globalExecutionTimer = null;
let simulatedSeconds = 0;

// Continuous 1-second simulation engine loop
function startGlobalWorkerEngine() {
  if (globalExecutionTimer) clearInterval(globalExecutionTimer);

  globalExecutionTimer = setInterval(() => {
    if (fleetPaused) return;

    simulatedSeconds++;

    // Update active workers progress & elapsed timers
    let hasRunningWorkers = false;

    fleetWorkers.forEach((w) => {
      if (w.status === 'running') {
        hasRunningWorkers = true;
        // Parse elapsed seconds
        let parts = w.elapsed.split(' ');
        let m = 0, s = 0;
        parts.forEach(p => {
          if (p.includes('m')) m = parseInt(p.replace('m',''), 10) || 0;
          if (p.includes('s')) s = parseInt(p.replace('s',''), 10) || 0;
        });
        let totalSec = m * 60 + s + 1;
        let newM = Math.floor(totalSec / 60);
        let newS = totalSec % 60;
        w.elapsed = newM > 0 ? \`\${newM}m \${String(newS).padStart(2, '0')}s\` : \`\${newS}s\`;

        // Advance progress
        if (w.progress < 100) {
          w.progress = Math.min(100, w.progress + Math.floor(Math.random() * 3 + 1));
          const stepNames = [
            'Shadow DOM Traversal',
            'Resolving Form Fields',
            'Tailoring Master Resume',
            'Screening Q&A Solver',
            'Validation Watchdog Check',
            'Pre-Flight Review Ready',
            'Final Submission Handshake'
          ];
          const stepIndex = Math.min(stepNames.length - 1, Math.floor((w.progress / 100) * stepNames.length));
          w.step = stepNames[stepIndex];
        } else {
          w.status = 'completed';
          w.step = 'Submission Complete';
        }
      }
    });

    // Update UI if user is on the fleet page
    const container = document.getElementById('workers-grid-container');
    const isFleetPageOn = document.getElementById('pg-fleet')?.classList.contains('on');
    if (container && isFleetPageOn) {
      loadFleetData();
    }

    // Update Floating Execution HUD
    const hud = document.getElementById('live-execution-hud');
    if (hud && !hudDismissed) {
      const runningWorkers = fleetWorkers.filter(w => w.status === 'running');
      if (runningWorkers.length > 0) {
        hud.classList.remove('minimized');
        const primeWorker = runningWorkers[0];
        const bar = document.getElementById('hud-progress-bar');
        const msg = document.getElementById('hud-msg-text');
        const wait = document.getElementById('hud-wait-time');
        const sub = document.getElementById('hud-sub-status');

        if (bar) bar.style.width = \`\${primeWorker.progress}%\`;
        if (msg) {
          msg.innerHTML = \`⚡ <strong>Worker \${primeWorker.id} (\${primeWorker.company}):</strong> \${esc(primeWorker.step)}... Please wait ~1 minute while the autonomous agent validates DOM fields.\`;
        }
        if (wait) {
          const rem = Math.max(5, Math.floor((100 - primeWorker.progress) * 0.8));
          wait.textContent = \`~\${rem}s remaining\`;
        }
        if (sub) {
          sub.textContent = \`\${runningWorkers.length} parallel pipelines executing\`;
        }
      } else {
        hud.classList.add('minimized');
      }
    }
  }, 1000);
}

function dismissHud() {
  hudDismissed = true;
  const hud = document.getElementById('live-execution-hud');
  if (hud) hud.classList.add('minimized');
  toast('Execution HUD minimized. Operations continue in background.', 'info');
}

// Start worker engine automatically
startGlobalWorkerEngine();
`;

html = html.replace('</script>', `${engineJs}\n</script>`);

fs.writeFileSync(filePath, html, 'utf8');
console.log('Successfully enhanced dashboard.html animations! New size:', html.length, 'bytes');
