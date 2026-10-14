/** True when the extension runtime is still valid (not reloaded/disconnected). */
export function isChromeRuntimeValid(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}
