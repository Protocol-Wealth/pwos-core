// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * PII incident classification and aggregation.
 *
 * Incidents are events where PII was at risk of exposure — whether
 * blocked, redacted, warned, or actually exposed. The classifier
 * suggests a severity bucket based on scope and disposition; the
 * firm's CCO has final say on escalation.
 */

import type { IncidentSeverity, PIIIncident } from "./types.js";

/**
 * Suggest a severity level based on incident shape.
 *
 * - **critical**: exposed + client-visible, or exposed + regulated data
 * - **high**: exposed (but not client-visible), or warned + >100 records
 * - **medium**: warned with any record count, or blocked affecting >10 records
 * - **low**: blocked / redacted with small record count
 */
export function classifySeverity(
  incident: Pick<PIIIncident, "disposition" | "affectedRecords" | "reportedToClient">,
): IncidentSeverity {
  const records = incident.affectedRecords ?? 1;

  if (incident.disposition === "exposed") {
    if (incident.reportedToClient || records > 100) return "critical";
    return "high";
  }

  if (incident.disposition === "warned") {
    if (records > 100) return "high";
    if (records > 0) return "medium";
  }

  if (incident.disposition === "blocked" || incident.disposition === "redacted") {
    if (records > 10) return "medium";
    return "low";
  }

  return "medium";
}

// ──────────────────────────────────────────────────────────────────────
// Aggregation helpers (for dashboards / SEC exam summaries)
// ──────────────────────────────────────────────────────────────────────

export interface IncidentSummary {
  totalIncidents: number;
  bySeverity: Record<IncidentSeverity, number>;
  byDisposition: Record<string, number>;
  exposureCount: number;
  recordsAffected: number;
  oldestAt: string | null;
  newestAt: string | null;
}

/** Aggregate a list of incidents into a summary suitable for reporting. */
export function summarize(incidents: readonly PIIIncident[]): IncidentSummary {
  const bySeverity: Record<IncidentSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const byDisposition: Record<string, number> = {};
  let exposureCount = 0;
  let recordsAffected = 0;
  let oldestAt: string | null = null;
  let newestAt: string | null = null;

  for (const incident of incidents) {
    bySeverity[incident.severity] += 1;
    byDisposition[incident.disposition] = (byDisposition[incident.disposition] ?? 0) + 1;
    if (incident.disposition === "exposed") exposureCount += 1;
    recordsAffected += incident.affectedRecords ?? 0;
    if (oldestAt === null || incident.detectedAt < oldestAt) oldestAt = incident.detectedAt;
    if (newestAt === null || incident.detectedAt > newestAt) newestAt = incident.detectedAt;
  }

  return {
    totalIncidents: incidents.length,
    bySeverity,
    byDisposition,
    exposureCount,
    recordsAffected,
    oldestAt,
    newestAt,
  };
}

/**
 * Filter incidents to those that need regulator / client notification.
 *
 * Heuristic: exposed disposition + (critical or client-reportable).
 * Firms should apply their own post-processing policy on top.
 */
export function notifiableIncidents(
  incidents: readonly PIIIncident[],
): PIIIncident[] {
  return incidents.filter(
    (i) =>
      i.disposition === "exposed" &&
      (i.severity === "critical" || i.reportedToClient === true),
  );
}
