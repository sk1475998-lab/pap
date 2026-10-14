/** Prevents duplicate concurrent autofill runs (Infosys / SPA spam). */
let busy = false;
let lastRunAt = 0;
const COOLDOWN_MS = 3500;

export function canRunAutofill(): boolean {
  if (busy) return false;
  if (Date.now() - lastRunAt < COOLDOWN_MS) return false;
  return true;
}

export async function withAutofillGuard<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!canRunAutofill()) return null;
  busy = true;
  lastRunAt = Date.now();
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

export function isAutofillBusy(): boolean {
  return busy;
}
