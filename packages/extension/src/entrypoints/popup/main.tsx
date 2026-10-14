import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

const root = document.getElementById("root");

function showFatal(error: unknown) {
  const msg = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (root) {
    root.innerHTML = `
      <div style="font-family:system-ui,sans-serif;width:360px;padding:14px;color:#0f172a;background:#fff">
        <h3 style="margin:0 0 8px;font-size:14px">Super Job Agent could not open</h3>
        <p style="font-size:12px;line-height:1.4;color:#475569">Reload the extension from chrome://extensions. If this repeats, rebuild with <code>npm run build:ext</code>.</p>
        <pre style="white-space:pre-wrap;font-size:10px;background:#fee2e2;color:#991b1b;padding:8px;border-radius:8px;max-height:220px;overflow:auto"></pre>
      </div>`;
    const pre = root.querySelector("pre");
    if (pre) pre.textContent = msg.slice(0, 2000);
  }
}

window.addEventListener("error", (ev) => showFatal(ev.error ?? ev.message));
window.addEventListener("unhandledrejection", (ev) => showFatal(ev.reason));

try {
  if (!root) throw new Error("Popup root element not found");
  // Mount shared toast host so popup can use showToast()
  import("@/lib/ui.js").then(({ mountToastHost }) => mountToastHost()).catch(() => {});
  root.textContent = "Loading Super Job Agent…";
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  showFatal(e);
}
