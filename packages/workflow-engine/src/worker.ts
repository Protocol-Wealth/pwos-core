// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Worker runtime — pulls jobs from a queue, dispatches to handlers,
 * enforces retry + backoff policy.
 *
 * Consumers register handlers for job ``type``, then call
 * ``Worker.processOne()`` or ``Worker.run()``. The worker uses the
 * supplied backoff strategy to schedule retries and declares a job
 * permanently failed when either:
 *
 *   1. A ``PermanentJobError`` is thrown from the handler
 *   2. ``maxAttempts`` has been exhausted
 */

import { exponential, withFullJitter, type BackoffStrategy } from "./backoff.js";
import type { Job, JobContext, JobHandler, JobQueue, ProgressReporter } from "./types.js";
import { PermanentJobError } from "./types.js";

export interface WorkerOptions {
  /** The queue to pull from. */
  queue: JobQueue;
  /** Retry backoff. Default: exponential 1s base, capped at 60s, with jitter. */
  backoff?: BackoffStrategy;
  /** Progress reporter factory — returns a reporter scoped to the running job. */
  progress?: (job: Job) => ProgressReporter;
  /** Optional observer called after every attempt (audit / metrics hook). */
  observer?: (event: WorkerEvent) => void | Promise<void>;
  /** Clock override for deterministic tests. */
  clock?: () => Date;
  /** Types to filter — worker only pulls matching jobs. */
  types?: readonly string[];
}

export type WorkerEvent =
  | { kind: "started"; job: Job }
  | { kind: "succeeded"; job: Job; result: unknown }
  | { kind: "failed"; job: Job; error: string; willRetry: boolean; nextAttemptAt?: string };

export class Worker {
  private readonly queue: JobQueue;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly backoff: BackoffStrategy;
  private readonly progressFactory: (job: Job) => ProgressReporter;
  private readonly observer?: WorkerOptions["observer"];
  private readonly clock: () => Date;
  private readonly typeFilter?: readonly string[];
  private running = false;

  constructor(opts: WorkerOptions) {
    this.queue = opts.queue;
    this.backoff = opts.backoff ?? withFullJitter(exponential(1_000));
    this.progressFactory = opts.progress ?? (() => () => { /* no-op */ });
    this.observer = opts.observer;
    this.clock = opts.clock ?? (() => new Date());
    this.typeFilter = opts.types;
  }

  /** Register a handler for one job type. */
  register<Payload, Result>(type: string, handler: JobHandler<Payload, Result>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /** Pull and process one job. Returns null if the queue was empty. */
  async processOne(): Promise<Job | null> {
    const job = await this.queue.dequeue(this.typeFilter);
    if (!job) return null;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      // No handler registered — mark as permanently failed.
      return this.recordFailure(job, `No handler registered for type "${job.type}"`, true);
    }

    const running = await this.queue.markRunning(job.id);
    if (!running) return null;
    await this.emit({ kind: "started", job: running });

    const ctx: JobContext = {
      job: running,
      reportProgress: this.progressFactory(running),
    };

    try {
      const result = await handler(ctx);
      const updated = await this.queue.markSucceeded(running.id, result);
      if (updated) await this.emit({ kind: "succeeded", job: updated, result });
      return updated ?? running;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const permanent = err instanceof PermanentJobError;
      return this.recordFailure(running, msg, permanent);
    }
  }

  /** Drain the queue until empty. Useful for tests. */
  async drain(): Promise<number> {
    let count = 0;
    // Guard against infinite loops — stop after a large number of iterations.
    for (let i = 0; i < 10_000; i++) {
      const processed = await this.processOne();
      if (!processed) break;
      count += 1;
    }
    return count;
  }

  /** Start a long-running poll loop. Call stop() to exit cleanly. */
  async run(pollIntervalMs: number = 500): Promise<void> {
    this.running = true;
    while (this.running) {
      const processed = await this.processOne();
      if (!processed) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  // ────────────────────────────────────────────────────────────

  private async recordFailure(
    job: Job,
    error: string,
    permanent: boolean,
  ): Promise<Job> {
    const willRetry = !permanent && job.attempts.length < job.maxAttempts;
    const nextAttemptAt = willRetry
      ? new Date(this.clock().getTime() + this.backoff(job.attempts.length))
      : undefined;

    const updated = await this.queue.markFailed(job.id, error, nextAttemptAt);
    await this.emit({
      kind: "failed",
      job: updated ?? job,
      error,
      willRetry,
      nextAttemptAt: nextAttemptAt?.toISOString(),
    });
    return updated ?? job;
  }

  private async emit(event: WorkerEvent): Promise<void> {
    if (!this.observer) return;
    try {
      await this.observer(event);
    } catch {
      // Observer errors must not break job processing.
    }
  }
}
