/**
 * First-run onboarding tab.
 *
 * Goal: open the extension popup so the user can follow its dashboard link
 * to set up their profile, then close this welcome tab. We can't programmatically open the popup
 * from a web page (Chrome security restriction) but we CAN open the popup
 * programmatically from chrome://extensions pages — from our own extension
 * page, `chrome.action.openPopup()` works on MV3 (Chrome 127+). As a
 * fallback we open the side panel (which IS openable from any extension
 * page), and finally we show a toast pointing the user to the toolbar icon.
 */

function toast(message: string, kind: "info" | "success" | "error" = "info", ms = 3500) {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, ms);
}

async function openPopup(): Promise<void> {
  const api = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!api?.action) {
    toast("Click the Super Job Agent (S) icon in the Chrome toolbar to open setup.", "info", 6000);
    return;
  }
  try {
    // chrome.action.openPopup() is the ideal: opens the popup right here.
    // Available in Chrome 127+.
    if (typeof (api.action as any).openPopup === "function") {
      await (api.action as any).openPopup();
      toast("Popup opened — add your profile and resume on the web dashboard, then sync to the extension.", "success");
      return;
    }
  } catch (_) {
    /* fall through */
  }
  try {
    // side panel is openable from any extension page
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId != null && api.sidePanel?.open) {
      await api.sidePanel.open({ windowId: tab.windowId });
      toast("Side panel opened — click the S icon in the toolbar for the full popup.", "success");
      return;
    }
  } catch (_) {
    /* fall through */
  }
  toast(
    "Chrome blocked the auto-open. Click the Super Job Agent (S) icon in the toolbar to continue.",
    "error",
    6000,
  );
}

document.getElementById("openPopup")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Opening…";
  try {
    await openPopup();
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "🚀 Open Super Job Agent";
    }, 1500);
  }
});

document.getElementById("closeTab")?.addEventListener("click", () => {
  window.close();
});
