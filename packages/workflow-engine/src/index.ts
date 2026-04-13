// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @protocolwealthos/workflow-engine
 *
 * Storage-agnostic durable-job runtime with retries, backoff, and
 * pluggable queue backends. Ships an in-memory queue for tests +
 * local dev; production deployments implement ``JobQueue`` against
 * Redis (BullMQ), Postgres, SQS, or Temporal.
 *
 * Quick start::
 *
 *     import {
 *       Worker,
 *       InMemoryJobQueue,
 *       PermanentJobError,
 *     } from "@protocolwealthos/workflow-engine";
 *
 *     const queue = new InMemoryJobQueue();
 *     const worker = new Worker({ queue });
 *
 *     worker.register("send_email", async (ctx) => {
 *       await deliver(ctx.job.payload);
 *     });
 *
 *     await queue.enqueue("send_email", { to: "user@x.com" });
 *     await worker.processOne();
 *
 * Third-party compatibility:
 * - BullMQ (MIT) — implement JobQueue wrapping ``bullmq.Queue`` + ``Worker``
 * - Temporal (MIT) — wrap workflows as jobs with Temporal signaling
 * - Trigger.dev (MIT) — similar adapter pattern
 */

export const VERSION = "0.1.0";

export {
  type BackoffStrategy,
  exponential,
  fixed,
  linear,
  withEqualJitter,
  withFullJitter,
} from "./backoff.js";

export { InMemoryJobQueue } from "./memoryQueue.js";

export {
  PermanentJobError,
  type EnqueueOptions,
  type Job,
  type JobAttempt,
  type JobContext,
  type JobHandler,
  type JobQueue,
  type JobState,
  type ProgressReporter,
} from "./types.js";

export {
  type WorkerEvent,
  type WorkerOptions,
  Worker,
} from "./worker.js";
