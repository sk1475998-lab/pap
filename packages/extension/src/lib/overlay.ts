/**
 * Floating match-badge overlay injected on job pages.
 * Shows a live match score and a one-click "Auto-fill" button.
 * Shadow DOM keeps our styles isolated from the host page.
 */
const HOST_ID = "super-job-agent-overlay";

export interface OverlayData {
  score: number;
  matched: number;
  total: number;
}

export function mountOverlay(opts: {
  onAutofill: () => void;
}) {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;bottom:18px;right:18px;z-index:2147483647;all:initial";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host, * { all: revert; box-sizing: border-box; }
      .card { font-family: -apple-system,Segoe UI,Roboto,sans-serif;
        background:#0f172a; color:#e2e8f0; border-radius:14px;
        padding:10px 12px; display:flex; align-items:center; gap:10px;
        box-shadow:0 10px 30px rgba(0,0,0,.35); min-width:210px;
        opacity:0; transform:translateY(8px); transition:.2s; cursor:pointer; }
      .card.show { opacity:1; transform:none; }
      .ring { position:relative; width:42px; height:42px; flex:0 0 42px; }
      .ring svg { transform:rotate(-90deg); }
      .ring .track { stroke:#1e293b; }
      .ring .bar { stroke:#22c55e; transition:.4s; stroke-linecap:round; }
      .ring .num { position:absolute; inset:0; display:flex; align-items:center;
        justify-content:center; font-size:12px; font-weight:700; }
      .meta { font-size:12px; line-height:1.25; }
      .meta b { font-size:13px; }
      .btn { margin-left:auto; background:#6366f1; color:#fff; border:0;
        border-radius:8px; padding:7px 10px; font-size:12px; font-weight:600; cursor:pointer; }
      .btn:hover { background:#4f46e5; }
      .btn:disabled { opacity:.6; cursor:default; }
    </style>
    <div class="card" part="card">
      <div class="ring">
        <svg width="42" height="42" viewBox="0 0 42 42">
          <circle class="track" cx="21" cy="21" r="17" fill="none" stroke-width="4"/>
          <circle class="bar"   cx="21" cy="21" r="17" fill="none" stroke-width="4"
                  stroke-dasharray="106.8" stroke-dashoffset="106.8"/>
        </svg>
        <div class="num">--</div>
      </div>
      <div class="meta"><b>Match</b><br/><span class="sub">Super Job Agent</span></div>
      <button class="btn">Auto-fill</button>
    </div>`;
  document.documentElement.appendChild(host);

  const card = shadow.querySelector(".card")!;
  const bar = shadow.querySelector(".bar") as SVGCircleElement;
  const num = shadow.querySelector(".num")!;
  const sub = shadow.querySelector(".sub")!;
  const btn = shadow.querySelector(".btn") as HTMLButtonElement;

  requestAnimationFrame(() => card.classList.add("show"));

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Filling…";
    opts.onAutofill();
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Auto-fill";
    }, 4000);
  });

  return {
    update(d: OverlayData) {
      num.textContent = String(d.score);
      const circ = 106.8;
      bar.style.strokeDashoffset = String(circ * (1 - d.score / 100));
      bar.style.stroke =
        d.score >= 80 ? "#22c55e" : d.score >= 60 ? "#eab308" : "#ef4444";
      sub.textContent = `${d.matched}/${d.total} keywords · click to fill`;
    },
    setStatus(text: string) {
      sub.textContent = text;
    },
  };
}
