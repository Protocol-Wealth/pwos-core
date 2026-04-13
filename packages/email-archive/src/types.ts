// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Email archive types for SEC Rule 17a-4 compliance.
 *
 * SEC Rule 17a-4(f) requires broker-dealers to preserve electronic
 * records in non-rewriteable, non-erasable (WORM) storage. RIAs under
 * Rule 204-2 face similar expectations. These types describe the
 * archival record shape; WORM guarantees are the caller's responsibility
 * (object-lock storage, immutable DB tables, etc.) — this package
 * supplies chain-of-custody hashing primitives on top.
 */

/** Classification of an email's role in the firm. */
export type EmailClassification =
  | "client_communication"
  | "internal"
  | "marketing"
  | "regulatory"
  | "vendor"
  | "other";

/** Direction of the email flow. */
export type EmailDirection = "inbound" | "outbound";

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType?: string;
  /** Size in bytes. */
  size?: number;
  /** SHA-256 of the attachment bytes — ties to chain-of-custody. */
  sha256?: string;
}

/** A single archived email record. */
export interface ArchivedEmail {
  /** Stable identifier. */
  id: string;
  /** Internal message id from the originating system (RFC 5322). */
  messageId?: string;
  /** References to parent/thread messages. */
  inReplyTo?: string;
  /** Thread / conversation id the message belongs to. */
  threadId?: string;
  /** ISO-8601 when the message was sent or received. */
  occurredAt: string;
  /** ISO-8601 when we captured the message for archival. */
  archivedAt: string;
  /** Sender address. */
  from: EmailAddress;
  /** Recipient addresses. */
  to: readonly EmailAddress[];
  cc?: readonly EmailAddress[];
  bcc?: readonly EmailAddress[];
  /** Subject line. */
  subject: string;
  /** Text/plain body — preferred for indexing. */
  bodyText?: string;
  /** Text/html body — keep alongside plain text if present. */
  bodyHtml?: string;
  /** Attachments metadata (payloads live in object storage). */
  attachments?: readonly EmailAttachment[];
  /** Header fields we preserve verbatim for audit. */
  rawHeaders?: Record<string, string>;
  /** Classification used for retention policy routing. */
  classification: EmailClassification;
  direction: EmailDirection;
  /** ISO-8601 earliest date this record may be purged per retention policy. */
  retentionUntil?: string;
  /** Was the record placed under a legal hold? Overrides normal retention. */
  legalHold?: boolean;
  /** SHA-256 over a canonical projection of the record — populated by finalizeRecord. */
  contentHash?: string;
  /** Hash chain pointer — SHA-256 of the prior archived record in this stream. */
  previousHash?: string;
  /** Free-form metadata (ingest batch, source system, etc.). */
  metadata?: Record<string, unknown>;
}

/** Minimal search filter shape. */
export interface ArchiveQuery {
  from?: string;
  to?: string;
  subjectContains?: string;
  classification?: EmailClassification;
  direction?: EmailDirection;
  threadId?: string;
  /** ISO-8601 lower bound (inclusive). */
  occurredAfter?: string;
  /** ISO-8601 upper bound (exclusive). */
  occurredBefore?: string;
  /** Only include records still within retention. */
  withinRetention?: boolean;
  /** Include records under legal hold regardless of retention. */
  includeLegalHolds?: boolean;
}
