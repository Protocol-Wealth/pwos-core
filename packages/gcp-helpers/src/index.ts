// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * @protocolwealthos/gcp-helpers — storage-agnostic helpers for
 * applications running on Google Cloud.
 *
 * Zero `@google-cloud/*` dependencies. The package ships:
 *
 *   - `createCloudLogger` — JSON-line logging for Cloud Run / GKE.
 *     Cloud Logging lifts the structured fields automatically.
 *   - `pickConnectionStrategy` + `CloudSqlIamConnector` interface —
 *     choose IAM auth when `CLOUD_SQL_INSTANCE_CONNECTION_NAME` is
 *     set; refuse silent fallbacks.
 *   - `createCachingSecretLoader` + `SecretLoader` / `InMemorySecretLoader`
 *     — read-through cache around a Secret Manager loader of your
 *     choosing.
 *   - `buildFrontendErrorReport` — payload shape for React/Vue error
 *     boundaries that POST to your server and forward to Cloud Logging.
 *
 * Bring your own `@google-cloud/cloud-sql-connector` and
 * `@google-cloud/secret-manager` instances; this package wires them
 * behind interfaces so the rest of your code stays testable.
 */

export {
  createCloudLogger,
  serializeError,
} from "./structuredLog.js";
export type {
  CloudLogger,
  CloudLoggerOptions,
  SerializedError,
} from "./structuredLog.js";

export {
  pickConnectionStrategy,
} from "./cloudSqlIam.js";
export type {
  CloudSqlIamConnectionOptions,
  CloudSqlIamConnector,
  DbConnectionStrategy,
  PickStrategyEnv,
} from "./cloudSqlIam.js";

export {
  createCachingSecretLoader,
  InMemorySecretLoader,
} from "./secretManager.js";
export type {
  CachingSecretLoader,
  CachingSecretLoaderOptions,
  SecretLoader,
} from "./secretManager.js";

export { buildFrontendErrorReport } from "./errorBoundaryShape.js";
export type {
  BuildReportInput,
  FrontendErrorReport,
} from "./errorBoundaryShape.js";

export type { CloudLogEntry, LogSeverity } from "./types.js";
