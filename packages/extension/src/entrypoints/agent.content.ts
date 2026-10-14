import { defineContentScript } from "wxt/utils/define-content-script";
import { createOrchestrator } from "@/lib/orchestrator/main.js";
import { JOB_HOST_MATCHES } from "@/lib/permission-policy.js";

export default defineContentScript({
  matches: [...JOB_HOST_MATCHES],
  registration: "runtime",
  main() {
    createOrchestrator();
  },
});
