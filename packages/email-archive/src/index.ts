// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @pwos/email-archive
 *
 * Email-archive primitives for SEC Rule 17a-4 / Rule 204-2 compliance:
 * typed archive records with chain-of-custody hashing, retention
 * eligibility checks, and an in-memory query evaluator useful for
 * tests and eDiscovery prototypes.
 *
 * Storage is the caller's responsibility — pair these primitives with
 * object-lock S3, an immutable DB table, or a dedicated archive
 * backend. WORM guarantees come from the storage layer, not this
 * package.
 */

export const VERSION = "0.1.0";

export {
  canonicalize,
  finalizeRecord,
  hashEmail,
  verifyChain,
} from "./integrity.js";

export {
  evaluateQuery,
  isPurgeable,
  purgeableEmails,
} from "./retention.js";

export type {
  ArchivedEmail,
  ArchiveQuery,
  EmailAddress,
  EmailAttachment,
  EmailClassification,
  EmailDirection,
} from "./types.js";
