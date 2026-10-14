/**
 * Lifecycle module — barrel export for status machine, events, and tracker.
 */
export { AutofillStatus, statusBus } from "./status-events.js";
export type { StatusPayload } from "./status-events.js";
export { StatusMachine, statusMachine } from "./status-machine.js";
export { applicationTracker } from "./application-tracker.js";
export type { JobProgress } from "./application-tracker.js";
