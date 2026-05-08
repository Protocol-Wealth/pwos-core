// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Cloud Logging severity levels. Mirrors the Google Cloud LogSeverity enum.
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
export type LogSeverity =
  | "DEFAULT"
  | "DEBUG"
  | "INFO"
  | "NOTICE"
  | "WARNING"
  | "ERROR"
  | "CRITICAL"
  | "ALERT"
  | "EMERGENCY";

/**
 * A Cloud Logging structured log entry. Cloud Logging treats JSON
 * stdout from Cloud Run / GKE / GCE as structured logs and lifts
 * `severity`, `message`, `httpRequest`, `logging.googleapis.com/labels`
 * etc. into the entry metadata.
 */
export interface CloudLogEntry {
  severity: LogSeverity;
  message: string;
  /** Free-form structured payload — the rest of the JSON object. */
  [field: string]: unknown;
}
