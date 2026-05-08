// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Vendor-document advisory metadata schema.
 *
 * Vendor compliance documents — SOC 2 reports, DPAs, pen-test reports,
 * insurance certificates, privacy policies — carry structured facts
 * (audit period, opinion type, sub-processors, retention/breach
 * windows) that compliance teams want to surface in dashboards and
 * search.
 *
 * The shapes here are deliberately framed as **advisory metadata**:
 * the source PDF remains the system of record. A common workflow is to
 * run an AI structured-extraction pass over the PDF and emit one of
 * these records for downstream rendering — but if the AI's output
 * disagrees with the PDF, the PDF wins. Always.
 *
 * Pair with `VendorAssessment` (see `types.ts`) for the longer-running
 * vendor risk assessment record; this module is per-document.
 */

export type VendorDocKind =
  | "soc1_type1"
  | "soc1_type2"
  | "soc2_type1"
  | "soc2_type2"
  | "iso_27001"
  | "iso_27017"
  | "iso_27018"
  | "pci_dss"
  | "hitrust"
  | "fedramp"
  | "dpa"
  | "pentest"
  | "insurance_certificate"
  | "privacy_policy"
  | "tos"
  | "other";

/** Auditor's opinion type for an attestation report. */
export type AttestationOpinion =
  | "unqualified"
  | "qualified"
  | "adverse"
  | "disclaimer"
  | "unknown";

/** SOC 2 trust services criteria scope. */
export type TrustServicesCriteria =
  | "security"
  | "availability"
  | "processing_integrity"
  | "confidentiality"
  | "privacy";

/** Reference to a sub-processor disclosed in a DPA or SOC 2. */
export interface DisclosedSubprocessor {
  name: string;
  /** What service the sub-processor provides. */
  service?: string;
  /** Country/region where data is processed. */
  region?: string;
  /** Whether the sub-processor signed a Data Processing Agreement. */
  hasDpa?: boolean;
}

/**
 * Advisory metadata extracted (typically via AI) from one vendor
 * compliance document. Every field is optional — a partial extraction
 * is better than none, and the source PDF remains authoritative.
 */
export interface VendorDocMetadata {
  /** Stable id for the metadata record (caller-supplied). */
  id: string;
  /** Reference back to the vendor (matches `VendorAssessment.id`). */
  vendorId: string;
  /** What kind of document this metadata describes. */
  kind: VendorDocKind;
  /** Display title / filename. */
  title?: string;
  /** Identifier of the source PDF (URI, GCS key, S3 key, etc.). */
  sourceRef?: string;
  /** SHA-256 hex of the source PDF — chain-of-custody anchor. */
  sourceSha256?: string;
  /** ISO-8601 date the document was issued / signed. */
  issuedAt?: string;
  /** ISO-8601 date the document expires (or is expected to be re-issued). */
  expiresAt?: string;

  // ── Attestation-specific (SOC 2 / SOC 1 / ISO) ────────────────────
  /** ISO-8601 audit period start. */
  auditPeriodStart?: string;
  /** ISO-8601 audit period end. */
  auditPeriodEnd?: string;
  /** Auditor's opinion type. */
  opinion?: AttestationOpinion;
  /** Trust services criteria covered. */
  trustServicesCriteria?: readonly TrustServicesCriteria[];
  /** Number of exceptions / qualifications noted. */
  exceptionCount?: number;
  /** Headline finding summaries (advisory; PDF is source of truth). */
  findingSummaries?: readonly string[];

  // ── DPA / privacy-specific ───────────────────────────────────────
  /** Disclosed sub-processors. */
  subprocessors?: readonly DisclosedSubprocessor[];
  /** Data-retention window per the DPA, in days. */
  retentionWindowDays?: number;
  /** Breach-notification window the vendor commits to, in days. */
  breachNotificationWindowDays?: number;

  // ── Pen-test specific ────────────────────────────────────────────
  /** Highest severity finding still open at issue date. */
  highestOpenSeverity?: "critical" | "high" | "medium" | "low" | "info" | "none";
  /** Open-vs-resolved counts. */
  findingsByStatus?: { open?: number; resolved?: number };

  /** Free-form notes from the extractor. */
  notes?: string;

  /**
   * Provenance: how this metadata was produced.
   * - `human` — entered by a person from the PDF
   * - `ai_advisory` — extracted by an AI pass; PDF remains authoritative
   */
  provenance: "human" | "ai_advisory";

  /** ISO-8601 timestamp the record was created. */
  createdAt: string;
}

/**
 * True if the document is currently within its validity window.
 * Documents without an `expiresAt` are considered current.
 */
export function isVendorDocCurrent(
  doc: VendorDocMetadata,
  nowIso: string
): boolean {
  if (!doc.expiresAt) return true;
  return Date.parse(doc.expiresAt) > Date.parse(nowIso);
}

/**
 * Documents whose `expiresAt` is within `daysAhead` of `nowIso`.
 * Useful for nightly "re-up your SOC 2" reminders.
 */
export function vendorDocsExpiringSoon(
  docs: readonly VendorDocMetadata[],
  nowIso: string,
  daysAhead: number
): VendorDocMetadata[] {
  const now = Date.parse(nowIso);
  const horizon = now + daysAhead * 86_400_000;
  return docs.filter((d) => {
    if (!d.expiresAt) return false;
    const exp = Date.parse(d.expiresAt);
    return exp >= now && exp <= horizon;
  });
}
