// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * CSV generation — RFC 4180 compliant.
 *
 * Handles quoting, embedded commas, newlines, and quote escaping. No
 * external dependency; returns a plain string suitable for writing to
 * a file, streaming, or embedding in an HTTP response.
 *
 * For large datasets consider streaming row-by-row rather than building
 * the whole string in memory.
 */

export interface CsvOptions {
  /** Field separator. Defaults to ",". */
  delimiter?: string;
  /** End-of-line. Defaults to "\r\n" per RFC 4180. */
  eol?: string;
  /** Whether to emit a UTF-8 BOM — helps Excel interpret non-ASCII. */
  bom?: boolean;
  /** Headers to emit as the first row. Omit to skip the header row. */
  headers?: string[];
}

/** Escape a single field for CSV output. */
export function escapeCsvField(value: unknown, delimiter: string = ","): string {
  const str = value === null || value === undefined ? "" : String(value);
  const needsQuoting = str.includes(delimiter) || str.includes("\n") || str.includes("\r") || str.includes('"');
  if (!needsQuoting) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Convert a 2D array (optionally with headers) to CSV text. */
export function rowsToCsv(
  rows: Array<Array<unknown>>,
  opts: CsvOptions = {},
): string {
  const delimiter = opts.delimiter ?? ",";
  const eol = opts.eol ?? "\r\n";
  const lines: string[] = [];

  if (opts.headers) {
    lines.push(opts.headers.map((h) => escapeCsvField(h, delimiter)).join(delimiter));
  }

  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(cell, delimiter)).join(delimiter));
  }

  const body = lines.join(eol);
  return opts.bom ? `\uFEFF${body}` : body;
}

/** Convert an array of objects to CSV. Keys of the first object become headers. */
export function objectsToCsv<T extends Record<string, unknown>>(
  objects: T[],
  opts: Omit<CsvOptions, "headers"> & { headers?: string[] } = {},
): string {
  if (objects.length === 0) {
    return opts.headers ? rowsToCsv([], opts) : "";
  }
  const headers = opts.headers ?? Object.keys(objects[0]);
  const rows = objects.map((obj) => headers.map((h) => obj[h]));
  return rowsToCsv(rows, { ...opts, headers });
}
