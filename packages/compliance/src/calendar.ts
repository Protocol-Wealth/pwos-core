// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Compliance calendar — compute the next due date for recurring
 * regulatory and internal obligations.
 *
 * Covers the common RIA deadlines:
 *   - Annual ADV amendment (SEC due within 90 days of fiscal year end)
 *   - Quarterly 13F (within 45 days of quarter end, if required)
 *   - Annual compliance review (SEC Rule 206(4)-7)
 *   - CCO annual certification
 *   - State notice renewals
 *
 * This package ships the date-math; specific firm events (which ADV
 * fiscal year you use, which states you're registered in) stay in the
 * downstream project.
 */

import type { ComplianceEvent, RecurrencePattern } from "./types.js";

/** Status of an event relative to today's date. */
export type EventStatus = "current" | "upcoming" | "due_today" | "overdue";

/** Event with computed next-due information. */
export interface EvaluatedEvent extends ComplianceEvent {
  nextDueAt: Date | null;
  daysUntilDue: number | null;
  status: EventStatus;
}

/** Compute the next occurrence of a recurrence pattern on or after ``from``. */
export function nextOccurrence(recurrence: RecurrencePattern, from: Date): Date | null {
  switch (recurrence.type) {
    case "once":
      // Caller supplies the absolute date via a different mechanism.
      return null;

    case "annual": {
      const year = from.getUTCFullYear();
      let candidate = new Date(Date.UTC(year, recurrence.month - 1, recurrence.day));
      if (candidate < from) {
        candidate = new Date(Date.UTC(year + 1, recurrence.month - 1, recurrence.day));
      }
      return candidate;
    }

    case "quarterly": {
      // Quarter-end dates: Mar 31, Jun 30, Sep 30, Dec 31
      const quarterEnds = [
        new Date(Date.UTC(from.getUTCFullYear(), 2, 31)),
        new Date(Date.UTC(from.getUTCFullYear(), 5, 30)),
        new Date(Date.UTC(from.getUTCFullYear(), 8, 30)),
        new Date(Date.UTC(from.getUTCFullYear(), 11, 31)),
      ];
      for (const qe of quarterEnds) {
        const due = addDays(qe, recurrence.offsetDays);
        if (due >= from) return due;
      }
      // All quarter-ends this year passed — first of next year.
      const nextYearQe = new Date(Date.UTC(from.getUTCFullYear() + 1, 2, 31));
      return addDays(nextYearQe, recurrence.offsetDays);
    }

    case "monthly": {
      let year = from.getUTCFullYear();
      let month = from.getUTCMonth();
      let candidate = new Date(Date.UTC(year, month, recurrence.day));
      if (candidate < from) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
        candidate = new Date(Date.UTC(year, month, recurrence.day));
      }
      return candidate;
    }

    case "custom":
      // Custom recurrence must be evaluated by caller logic.
      return null;
  }
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function classifyStatus(daysUntilDue: number | null): EventStatus {
  if (daysUntilDue === null) return "current";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue <= 30) return "upcoming";
  return "current";
}

/** Evaluate a list of events against ``asOf``, returning upcoming status. */
export function evaluateCalendar(
  events: readonly ComplianceEvent[],
  asOf: Date = new Date(),
): EvaluatedEvent[] {
  return events.map((event) => {
    const nextDueAt = nextOccurrence(event.recurrence, asOf);
    const daysUntilDue = nextDueAt ? daysBetween(asOf, nextDueAt) : null;
    return {
      ...event,
      nextDueAt,
      daysUntilDue,
      status: classifyStatus(daysUntilDue),
    };
  });
}

/** Convenience: items that are either overdue or due within ``withinDays``. */
export function upcomingOrOverdue(
  events: readonly ComplianceEvent[],
  withinDays: number = 30,
  asOf: Date = new Date(),
): EvaluatedEvent[] {
  return evaluateCalendar(events, asOf).filter((e) => {
    if (e.status === "overdue" || e.status === "due_today") return true;
    if (e.daysUntilDue !== null && e.daysUntilDue <= withinDays) return true;
    return false;
  });
}
