// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Audit-log anomaly detectors.
 *
 * Three detectors, each a pure function over an array of `AuditEntry`.
 * Run them on a nightly cron against your day's audit events and surface
 * findings on a partner-tier review board:
 *
 *   - `detectOffHours` — admin actions outside business hours, by actor,
 *     in a configurable timezone.
 *   - `detectRapidSequential` — clusters of admin actions by the same
 *     actor within a short window. Often a leading indicator of a
 *     compromised session running automated tooling.
 *   - `detectNewActorOnAdmin` — first-ever appearance of an actor on a
 *     privileged action. Compared against a "known prior actors" set you
 *     accumulate over time.
 *
 * Pure functions, deterministic; no I/O. Compose them with whatever
 * scheduler you use (Cloud Scheduler → Cloud Run job, Kubernetes
 * CronJob, GitHub Actions, etc.).
 */

import type { AuditEntry } from "./types.js";

export type AnomalySeverity = "low" | "medium" | "high";

export interface AnomalyFinding {
  rule: "off_hours" | "rapid_sequential" | "new_actor_on_admin";
  severity: AnomalySeverity;
  actorId: string;
  /** Sample of entry ids that triggered the finding (cap defaults to 5). */
  sampleEntryIds: string[];
  /** ISO-8601 instant the finding refers to (window start, etc.). */
  at: string;
  /** Human-readable message. */
  message: string;
}

export interface OffHoursOptions {
  /**
   * Predicate to identify "admin"-class actions. Default: any action
   * whose prefix appears in `adminActionPrefixes` below; provide a
   * custom predicate for richer logic.
   */
  isAdminAction?: (entry: AuditEntry) => boolean;
  /** Common admin prefixes if you don't supply a predicate. */
  adminActionPrefixes?: readonly string[];
  /**
   * IANA timezone for the "business hours" judgment. Default
   * `America/New_York` — change for your jurisdiction.
   */
  timezone?: string;
  /** Inclusive start hour (0-23). Default 8. */
  startHour?: number;
  /** Exclusive end hour (0-23). Default 20. */
  endHour?: number;
  /** Treat Saturday and Sunday as off-hours regardless of clock. Default true. */
  weekendsOff?: boolean;
}

const DEFAULT_ADMIN_PREFIXES: readonly string[] = [
  "vendor.",
  "policy.",
  "user.role",
  "auth.role",
  "client.delete",
  "audit.",
];

function defaultIsAdmin(prefixes: readonly string[]) {
  return (e: AuditEntry) => prefixes.some((p) => e.action.startsWith(p));
}

function localParts(
  iso: string,
  timezone: string
): { hour: number; weekday: number } {
  const date = new Date(iso);
  // Use Intl to extract local hour & weekday in the configured tz.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  let hour = 0;
  let weekday = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = parseInt(p.value, 10);
    else if (p.type === "weekday") {
      // Normalize: Sun=0 .. Sat=6
      const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      weekday = map[p.value] ?? 0;
    }
  }
  return { hour, weekday };
}

/**
 * Detect admin actions performed outside business hours.
 * Deduplicated per `(actorId, local-day-key)` so an actor whose entire
 * shift is off-hours produces one finding, not hundreds.
 */
export function detectOffHours(
  entries: readonly AuditEntry[],
  options: OffHoursOptions = {}
): AnomalyFinding[] {
  const isAdmin =
    options.isAdminAction ?? defaultIsAdmin(options.adminActionPrefixes ?? DEFAULT_ADMIN_PREFIXES);
  const tz = options.timezone ?? "America/New_York";
  const startHour = options.startHour ?? 8;
  const endHour = options.endHour ?? 20;
  const weekendsOff = options.weekendsOff ?? true;

  const buckets = new Map<string, { entryIds: string[]; at: string; actor: string }>();
  for (const e of entries) {
    if (!isAdmin(e)) continue;
    const { hour, weekday } = localParts(e.timestamp, tz);
    const isWeekend = weekday === 0 || weekday === 6;
    const offHours = (weekendsOff && isWeekend) || hour < startHour || hour >= endHour;
    if (!offHours) continue;
    const day = e.timestamp.slice(0, 10);
    const key = `${e.actorId}|${day}`;
    const bucket = buckets.get(key) ?? { entryIds: [], at: e.timestamp, actor: e.actorId };
    bucket.entryIds.push(e.id);
    buckets.set(key, bucket);
  }
  const out: AnomalyFinding[] = [];
  for (const b of buckets.values()) {
    out.push({
      rule: "off_hours",
      severity: "medium",
      actorId: b.actor,
      sampleEntryIds: b.entryIds.slice(0, 5),
      at: b.at,
      message: `Admin action(s) outside business hours (${b.entryIds.length} total)`,
    });
  }
  return out;
}

export interface RapidSequentialOptions {
  /** Window size in milliseconds. Default 60_000 (1 min). */
  windowMs?: number;
  /** Minimum events in the window to trigger. Default 8. */
  threshold?: number;
  isAdminAction?: (entry: AuditEntry) => boolean;
  adminActionPrefixes?: readonly string[];
}

/**
 * Detect rapid bursts of admin actions by the same actor — a leading
 * indicator of a compromised session running automated tooling. Uses a
 * sliding-window count by `actorId`.
 */
export function detectRapidSequential(
  entries: readonly AuditEntry[],
  options: RapidSequentialOptions = {}
): AnomalyFinding[] {
  const isAdmin =
    options.isAdminAction ?? defaultIsAdmin(options.adminActionPrefixes ?? DEFAULT_ADMIN_PREFIXES);
  const windowMs = options.windowMs ?? 60_000;
  const threshold = options.threshold ?? 8;

  // Group by actor; entries are not assumed sorted.
  const byActor = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    if (!isAdmin(e)) continue;
    const arr = byActor.get(e.actorId) ?? [];
    arr.push(e);
    byActor.set(e.actorId, arr);
  }

  const out: AnomalyFinding[] = [];
  for (const [actor, list] of byActor.entries()) {
    list.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    let left = 0;
    for (let right = 0; right < list.length; right++) {
      const rT = Date.parse(list[right]!.timestamp);
      while (rT - Date.parse(list[left]!.timestamp) > windowMs) left++;
      const count = right - left + 1;
      if (count >= threshold) {
        const slice = list.slice(left, right + 1);
        out.push({
          rule: "rapid_sequential",
          severity: count >= threshold * 2 ? "high" : "medium",
          actorId: actor,
          sampleEntryIds: slice.slice(0, 5).map((e) => e.id),
          at: slice[0]!.timestamp,
          message: `${count} admin actions within ${Math.round(windowMs / 1000)}s window`,
        });
        // Skip to the end of the window to avoid emitting overlapping findings.
        left = right + 1;
      }
    }
  }
  return out;
}

export interface NewActorOnAdminOptions {
  /** Set of actor ids known to have performed admin actions before today's batch. */
  knownActors: ReadonlySet<string>;
  isAdminAction?: (entry: AuditEntry) => boolean;
  adminActionPrefixes?: readonly string[];
}

/**
 * Detect first-ever appearance of an actor on a privileged action.
 * Run with the running set of "every actor that has previously performed
 * an admin action"; new entries with unknown actors trigger findings.
 */
export function detectNewActorOnAdmin(
  entries: readonly AuditEntry[],
  options: NewActorOnAdminOptions
): AnomalyFinding[] {
  const isAdmin =
    options.isAdminAction ?? defaultIsAdmin(options.adminActionPrefixes ?? DEFAULT_ADMIN_PREFIXES);
  const seenThisBatch = new Set<string>();
  const out: AnomalyFinding[] = [];
  for (const e of entries) {
    if (!isAdmin(e)) continue;
    if (options.knownActors.has(e.actorId)) continue;
    if (seenThisBatch.has(e.actorId)) continue;
    seenThisBatch.add(e.actorId);
    out.push({
      rule: "new_actor_on_admin",
      severity: "high",
      actorId: e.actorId,
      sampleEntryIds: [e.id],
      at: e.timestamp,
      message: `Actor "${e.actorId}" performing privileged action "${e.action}" for the first time`,
    });
  }
  return out;
}
