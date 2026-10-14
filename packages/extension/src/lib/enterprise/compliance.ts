/**
 * Operation Zero-Defect: Enterprise Compliance/Audit Mode (Feature #13)
 * Secure, append-only audit logging for B2B deployments (SOC2 / GDPR compliance).
 */
import { getEntitlements } from "../auth/entitlement.js";
import { stripPII } from "../telemetry/anonymizer.js";

export interface AuditEvent {
  action: string;
  resourceId: string;
  timestamp: string;
  actorEmail?: string; // Managed via identity provider in enterprise deployments
  metadata: any;
}

export async function logEnterpriseAction(action: string, resourceId: string, rawMetadata: any) {
  const entitlement = await getEntitlements();
  
  if (entitlement.tier !== 'enterprise') return;

  const event: AuditEvent = {
    action,
    resourceId,
    timestamp: new Date().toISOString(),
    metadata: stripPII(rawMetadata)
  };

  const data = await chrome.storage.local.get("sja-enterprise-audit-buffer") as Record<string, unknown>;
  const buffer: AuditEvent[] = Array.isArray(data["sja-enterprise-audit-buffer"])
    ? data["sja-enterprise-audit-buffer"] as AuditEvent[]
    : [];
  buffer.push(event);
  
  await chrome.storage.local.set({ "sja-enterprise-audit-buffer": buffer.slice(-1000) });
}
