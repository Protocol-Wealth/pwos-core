// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Status + aging helpers for CRM data.
 *
 * Reporting / dashboard logic typically needs to know: which contacts
 * have gone stale, which opportunities have slipped, which tasks are
 * overdue. These helpers operate on plain types — no store access.
 */

import type { Contact, CrmTask, Opportunity } from "./types.js";

/** Contact is "stale" when lastActivityAt is older than ``days`` ago. */
export function isStaleContact(
  contact: Pick<Contact, "lastActivityAt" | "createdAt">,
  days: number,
  now: Date = new Date(),
): boolean {
  const ref = contact.lastActivityAt ?? contact.createdAt;
  if (!ref) return true;
  const age = now.getTime() - new Date(ref).getTime();
  return age > days * 24 * 60 * 60 * 1000;
}

/** Return only contacts that are stale. */
export function staleContacts(
  contacts: readonly Contact[],
  days: number,
  now: Date = new Date(),
): Contact[] {
  return contacts.filter((c) => isStaleContact(c, days, now));
}

/** Task is overdue if dueAt is in the past AND status is not terminal. */
export function isOverdueTask(task: CrmTask, now: Date = new Date()): boolean {
  if (!task.dueAt) return false;
  if (task.status === "done" || task.status === "canceled") return false;
  return new Date(task.dueAt) < now;
}

export function overdueTasks(tasks: readonly CrmTask[], now: Date = new Date()): CrmTask[] {
  return tasks.filter((t) => isOverdueTask(t, now));
}

/** Opportunity is stalled if expectedCloseAt is past and still open. */
export function isStalledOpportunity(
  opp: Opportunity,
  now: Date = new Date(),
): boolean {
  if (opp.stage === "won" || opp.stage === "lost" || opp.stage === "abandoned") {
    return false;
  }
  if (!opp.expectedCloseAt) return false;
  return new Date(opp.expectedCloseAt) < now;
}

export function stalledOpportunities(
  opps: readonly Opportunity[],
  now: Date = new Date(),
): Opportunity[] {
  return opps.filter((o) => isStalledOpportunity(o, now));
}

// ──────────────────────────────────────────────────────────────────────
// Aggregation
// ──────────────────────────────────────────────────────────────────────

/** Count contacts by lifecycle stage. Useful for pipeline dashboards. */
export function groupByLifecycle(
  contacts: readonly Contact[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of contacts) {
    const key = c.lifecycleStage ?? "unspecified";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Sum opportunity values by stage. */
export function pipelineValueByStage(
  opps: readonly Opportunity[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of opps) {
    if (!o.value) continue;
    out[o.stage] = (out[o.stage] ?? 0) + o.value;
  }
  return out;
}
