/**
 * Coalesces page/navigation events before running non-urgent autopilot work.
 * This avoids repeatedly scanning a stable application DOM on a fixed interval.
 */
export interface IdleSchedulerOptions {
  debounceMs?: number;
  idleTimeoutMs?: number;
}

type IdleRuntime = typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function createIdleDebouncedScheduler(
  task: () => void | Promise<void>,
  options: IdleSchedulerOptions = {}
): { schedule: () => void; stop: () => void } {
  const debounceMs = options.debounceMs ?? 350;
  const idleTimeoutMs = options.idleTimeoutMs ?? 1_500;
  const runtime = globalThis as IdleRuntime;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let idleHandle: number | null = null;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    void Promise.resolve(task()).catch(() => {
      // The caller owns diagnostics/error state; scheduling must not create an
      // unhandled rejection that disables subsequent page events.
    });
  };

  const schedule = () => {
    if (stopped) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (typeof runtime.requestIdleCallback === "function") {
        if (idleHandle != null && typeof runtime.cancelIdleCallback === "function") {
          runtime.cancelIdleCallback(idleHandle);
        }
        idleHandle = runtime.requestIdleCallback(() => {
          idleHandle = null;
          run();
        }, { timeout: idleTimeoutMs });
      } else {
        run();
      }
    }, debounceMs);
  };

  const stop = () => {
    stopped = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    if (idleHandle != null && typeof runtime.cancelIdleCallback === "function") {
      runtime.cancelIdleCallback(idleHandle);
    }
    idleHandle = null;
  };

  return { schedule, stop };
}
