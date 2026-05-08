// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Structured-log entry builder for Cloud Logging.
 *
 * Cloud Run / GKE / Cloud Functions parse JSON-shaped stdout into
 * structured `LogEntry` records, lifting `severity`, `message`,
 * `httpRequest`, `logging.googleapis.com/trace`, and a few other
 * special keys into the entry metadata. Everything else lands as
 * `jsonPayload`. This builder gives you a typed shape for those
 * conventions plus an `emit` that writes one line of JSON to stdout.
 *
 * Designed to be the only logging primitive a regulated app needs:
 *
 *   - `info`, `warn`, `error`, etc. — convenience severities
 *   - `withFields` — bind common fields (request id, actor id, trace id)
 *     once at the top of a request
 *   - Refuses raw `Error` objects in fields; they don't serialize
 *     usefully and accidentally leak stacks. Use `serializeError`.
 */

import type { CloudLogEntry, LogSeverity } from "./types.js";

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | undefined;
}

/** Convert an Error into a JSON-safe shape (recursive on `cause`). */
export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(err.stack !== undefined && { stack: err.stack }),
      ...(err.cause !== undefined && { cause: serializeError(err.cause) }),
    };
  }
  return { name: "NonError", message: String(err) };
}

export interface CloudLoggerOptions {
  /** Bind these fields onto every entry (request id, actor, etc.). */
  defaultFields?: Record<string, unknown>;
  /** Sink for serialized lines. Default: `console.log`. */
  sink?: (line: string) => void;
}

export interface CloudLogger {
  log(entry: CloudLogEntry): void;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** Returns a child logger with additional bound fields. */
  withFields(fields: Record<string, unknown>): CloudLogger;
}

function compose(
  defaults: Record<string, unknown> | undefined,
  fields: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!defaults && !fields) return {};
  return { ...(defaults ?? {}), ...(fields ?? {}) };
}

export function createCloudLogger(
  options: CloudLoggerOptions = {}
): CloudLogger {
  const sink = options.sink ?? ((line: string) => console.log(line));
  const defaults = options.defaultFields ?? {};

  function emit(severity: LogSeverity, message: string, fields?: Record<string, unknown>): void {
    const entry: CloudLogEntry = {
      severity,
      message,
      ...compose(defaults, fields),
    };
    sink(JSON.stringify(entry));
  }

  return {
    log(entry) {
      sink(JSON.stringify({ ...compose(defaults, undefined), ...entry }));
    },
    debug(message, fields) {
      emit("DEBUG", message, fields);
    },
    info(message, fields) {
      emit("INFO", message, fields);
    },
    warn(message, fields) {
      emit("WARNING", message, fields);
    },
    error(message, fields) {
      emit("ERROR", message, fields);
    },
    withFields(fields) {
      return createCloudLogger({
        defaultFields: { ...defaults, ...fields },
        sink,
      });
    },
  };
}
