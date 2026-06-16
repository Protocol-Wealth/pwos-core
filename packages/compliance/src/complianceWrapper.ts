// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Wrap an arbitrary tool output with the firm's compliance posture before it
 * is surfaced to a human.
 *
 * The motivating case: a sibling analytical engine (nexus-core) ships public
 * planning tools whose outputs end with a `disclaimer` string — e.g.
 * `optimize_allocation` (target weights + a `regime` + a `disclaimer`) and
 * `build_planning_report` (`{ report, disclaimer }`). A firm consumer
 * (pw-api, pw-os-v2) must attach its own compliance envelope around ANY such
 * output before it reaches an advisor or client: the firm's machine-readable
 * `DisclosureCard`, the firm-approved `disclaimer` copy, and — optionally — an
 * audit-log id and a provenance hash sealing what was produced.
 *
 * Design constraints (kept deliberately narrow):
 *
 *   - **Generic over the payload.** The wrapper neither reads nor mutates
 *     `data`; it carries it through unchanged. The same envelope wraps an
 *     allocation, a report, or anything else with a disclaimer.
 *   - **Firm copy stays in the consumer.** The `DisclosureCard` and the
 *     `disclaimer` string are caller-supplied. This OSS package carries the
 *     SHAPE of a compliance envelope, never Protocol Wealth's approved text or
 *     posture — that lives in the private estate.
 *   - **Audit + provenance are injected, not depended on.** They are optional
 *     async callbacks so this module composes `@protocolwealthos/audit-log`
 *     and `@protocolwealthos/shared/provenance` WITHOUT taking a hard
 *     dependency on either. Absent a hook, the corresponding `meta` field is
 *     omitted rather than set to `undefined`.
 *   - **Posture is validated at the boundary.** The card is run through
 *     `@protocolwealthos/disclosure-card`'s parser, so a malformed posture is
 *     caught here instead of leaking to a client surface.
 *
 * This aligns with `@protocolwealthos/mcp-tools`'s `disclaimerFilter` (which
 * attaches a disclaimer to a streaming `ToolResult`); the wrapper is the
 * one-shot, schema-validated, audit-aware sibling for non-MCP call sites.
 */

import { parseDisclosureCard, type DisclosureCard } from "@protocolwealthos/disclosure-card";

/**
 * Context passed to the optional `recordAudit` hook. Intentionally minimal and
 * PII-free — it identifies WHAT was wrapped, not the payload contents.
 */
export interface ComplianceAuditContext {
  /** Logical name of the tool / capability that produced `data`. */
  readonly toolName: string;
  /** Validated disclosure card attached to the envelope. */
  readonly disclosureCard: DisclosureCard;
  /** The disclaimer copy attached to the envelope. */
  readonly disclaimer: string;
  /** ISO-8601 timestamp the envelope was sealed. */
  readonly generatedAt: string;
}

/** Compliance metadata recorded alongside the wrapped payload. */
export interface ComplianceMeta {
  /** Identifier returned by the audit sink, if a `recordAudit` hook ran. */
  readonly auditId?: string;
  /** Content hash of the wrapped payload, if a `hashProvenance` hook ran. */
  readonly provenanceHash?: string;
  /** ISO-8601 timestamp the envelope was sealed. */
  readonly generatedAt: string;
}

/**
 * The firm-wrapped tool output. `data` is the original payload, untouched.
 */
export interface ComplianceEnvelope<T> {
  readonly data: T;
  /** Validated firm disclosure card. */
  readonly disclosureCard: DisclosureCard;
  /** Firm-approved disclaimer copy. */
  readonly disclaimer: string;
  readonly meta: ComplianceMeta;
}

/** Options for {@link wrapWithCompliance}. */
export interface WrapWithComplianceOptions<T> {
  /**
   * Firm disclosure card. Validated via the disclosure-card parser; a
   * malformed card throws a `ZodError` before any hook runs.
   */
  readonly disclosureCard: unknown;
  /** Firm-approved disclaimer copy. Must be a non-empty string. */
  readonly disclaimer: string;
  /**
   * Logical name of the producing tool (e.g. `"optimize_allocation"`). Passed
   * to `recordAudit`; defaults to `"unknown"`.
   */
  readonly toolName?: string;
  /**
   * ISO-8601 timestamp to stamp on the envelope. Defaults to
   * `new Date().toISOString()`. Injectable for deterministic tests.
   */
  readonly generatedAt?: string;
  /**
   * Optional audit sink. Returns the audit-row id to attach as
   * `meta.auditId`. Composes `@protocolwealthos/audit-log` without a hard
   * dependency.
   */
  readonly recordAudit?: (ctx: ComplianceAuditContext) => Promise<string>;
  /**
   * Optional provenance hasher. Returns a content hash to attach as
   * `meta.provenanceHash`. Composes `@protocolwealthos/shared/provenance`
   * without a hard dependency.
   */
  readonly hashProvenance?: (data: T) => Promise<string>;
}

/**
 * Wrap `data` with the firm's compliance posture.
 *
 * Steps, in order:
 *   1. Validate `disclaimer` is a non-empty string.
 *   2. Validate the disclosure card via the disclosure-card parser (throws on
 *      a malformed card — fail fast at the boundary).
 *   3. Run the optional `hashProvenance` and `recordAudit` hooks. Each
 *      populates its `meta` field only when present; absent hooks leave the
 *      field off entirely.
 *
 * The payload is returned by reference, unchanged.
 *
 * @throws {Error}    if `disclaimer` is empty / not a string.
 * @throws {ZodError} if `disclosureCard` fails disclosure-card validation.
 */
export async function wrapWithCompliance<T>(
  data: T,
  options: WrapWithComplianceOptions<T>,
): Promise<ComplianceEnvelope<T>> {
  const { disclaimer, recordAudit, hashProvenance } = options;

  if (typeof disclaimer !== "string" || disclaimer.trim().length === 0) {
    throw new Error("wrapWithCompliance: `disclaimer` must be a non-empty string.");
  }

  // Throws ZodError on a malformed posture — caught here, never surfaced.
  const disclosureCard = parseDisclosureCard(options.disclosureCard);

  const toolName = options.toolName ?? "unknown";
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const provenanceHash = hashProvenance ? await hashProvenance(data) : undefined;

  const auditId = recordAudit
    ? await recordAudit({ toolName, disclosureCard, disclaimer, generatedAt })
    : undefined;

  // Build `meta` with only the fields we actually have, so absent hooks leave
  // their keys off the object entirely (not set to `undefined`).
  const meta: ComplianceMeta = {
    generatedAt,
    ...(auditId !== undefined ? { auditId } : {}),
    ...(provenanceHash !== undefined ? { provenanceHash } : {}),
  };

  return { data, disclosureCard, disclaimer, meta };
}
