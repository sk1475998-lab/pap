/**
 * Lightweight orchestrator entry shim.
 *
 * The full job-application runtime is loaded only after the gated injector has
 * identified a supported job/application page. This keeps the executable
 * content-script entry small while preserving all production behavior.
 */
import { diagLog } from "@/lib/diagnostics.js";

let started = false;

export function createOrchestrator(): void {
  if (started) return;
  started = true;
  void import("@/lib/orchestrator/main.js")
    .then((mod) => mod.createOrchestrator())
    .catch((error) => {
      started = false;
      void diagLog("content", "orchestrator-load-error", {
        level: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
}
