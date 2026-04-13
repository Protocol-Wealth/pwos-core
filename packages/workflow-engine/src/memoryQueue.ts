// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * In-memory ``JobQueue`` implementation.
 *
 * Useful for unit tests and local development. NOT durable — jobs are
 * lost on process restart. Production deployments should implement
 * ``JobQueue`` against a persistent backend (Redis via BullMQ,
 * Postgres, DynamoDB, etc.).
 *
 * The implementation honors priority (higher first), runAfter
 * scheduling, and idempotency keys.
 */

import type { EnqueueOptions, Job, JobQueue, JobState } from "./types.js";

interface MemoryQueueOptions {
  idProvider?: () => string;
  clock?: () => Date;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly idProvider: () => string;
  private readonly clock: () => Date;

  constructor(opts: MemoryQueueOptions = {}) {
    this.idProvider = opts.idProvider ?? defaultIdProvider;
    this.clock = opts.clock ?? (() => new Date());
  }

  async enqueue<Payload>(
    type: string,
    payload: Payload,
    opts: EnqueueOptions = {},
  ): Promise<Job<Payload>> {
    // Dedupe via idempotency key.
    if (opts.idempotencyKey) {
      const existing = this.idempotencyIndex.get(opts.idempotencyKey);
      if (existing) {
        const job = this.jobs.get(existing);
        if (job) return job as Job<Payload>;
      }
    }

    const now = this.clock();
    const runAfter = opts.runAfter
      ? new Date(opts.runAfter).toISOString()
      : undefined;

    const job: Job<Payload> = {
      id: this.idProvider(),
      type,
      payload,
      state: "queued",
      priority: opts.priority ?? 0,
      enqueuedAt: now.toISOString(),
      runAfter,
      attempts: [],
      maxAttempts: opts.maxAttempts ?? 3,
      idempotencyKey: opts.idempotencyKey,
      metadata: opts.metadata,
    };

    this.jobs.set(job.id, job as Job);
    if (opts.idempotencyKey) this.idempotencyIndex.set(opts.idempotencyKey, job.id);
    return job;
  }

  async dequeue(types?: readonly string[]): Promise<Job | null> {
    const now = this.clock();
    const typeFilter = types ? new Set(types) : null;

    let best: Job | null = null;
    for (const job of this.jobs.values()) {
      if (job.state !== "queued") continue;
      if (typeFilter && !typeFilter.has(job.type)) continue;
      if (job.runAfter && new Date(job.runAfter) > now) continue;

      if (
        !best ||
        (job.priority ?? 0) > (best.priority ?? 0) ||
        ((job.priority ?? 0) === (best.priority ?? 0) && job.enqueuedAt < best.enqueuedAt)
      ) {
        best = job;
      }
    }
    return best;
  }

  async markRunning(jobId: string): Promise<Job | null> {
    return this.mutate(jobId, (job) => {
      job.state = "running";
      job.attempts.push({
        attempt: job.attempts.length + 1,
        startedAt: this.clock().toISOString(),
      });
    });
  }

  async markSucceeded(jobId: string, result: unknown): Promise<Job | null> {
    return this.mutate(jobId, (job) => {
      job.state = "succeeded";
      job.result = result;
      const last = job.attempts[job.attempts.length - 1];
      if (last) last.endedAt = this.clock().toISOString();
    });
  }

  async markFailed(jobId: string, error: string, retryAt?: Date): Promise<Job | null> {
    return this.mutate(jobId, (job) => {
      const last = job.attempts[job.attempts.length - 1];
      if (last) {
        last.endedAt = this.clock().toISOString();
        last.error = error;
      }
      if (retryAt) {
        job.state = "queued";
        job.runAfter = retryAt.toISOString();
      } else {
        job.state = "failed" as JobState;
      }
    });
  }

  async get(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) ?? null;
  }

  /** Snapshot all jobs (for tests / admin panels). */
  list(): Job[] {
    return [...this.jobs.values()];
  }

  private mutate(jobId: string, fn: (job: Job) => void): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    fn(job);
    return job;
  }
}

function defaultIdProvider(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
