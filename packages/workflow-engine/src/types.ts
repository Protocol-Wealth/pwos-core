// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Durable-job primitives.
 *
 * This package ships a storage-agnostic job runner with retries, backoff,
 * and typed handlers. It does not wrap BullMQ or Temporal directly — it
 * supplies an abstract ``JobQueue`` interface so the same job handlers
 * can run against an in-memory queue (tests), a Redis queue (BullMQ),
 * or a durable engine (Temporal).
 *
 * The contract is deliberately minimal: ``enqueue`` adds a job, the
 * runner pulls jobs and invokes the registered handler. Progress events
 * are optional.
 */

/** State a job can be in. */
export type JobState = "queued" | "running" | "succeeded" | "failed" | "canceled";

/** A single attempt to run a job. */
export interface JobAttempt {
  /** 1-indexed attempt number. */
  attempt: number;
  /** ISO-8601 when the attempt started. */
  startedAt: string;
  /** ISO-8601 when the attempt finished, or undefined if still running. */
  endedAt?: string;
  /** Failure message if the attempt failed. */
  error?: string;
}

/** A durable job record. Handlers receive a ``Job`` and return a payload. */
export interface Job<Payload = unknown, Result = unknown> {
  /** Stable identifier. */
  id: string;
  /** Logical queue name / handler key. */
  type: string;
  /** Input data for the handler. */
  payload: Payload;
  /** Current state. */
  state: JobState;
  /** Optional priority (higher = earlier). Default 0. */
  priority?: number;
  /** ISO-8601 when the job was enqueued. */
  enqueuedAt: string;
  /** ISO-8601 earliest time the job should run. Future values = scheduled. */
  runAfter?: string;
  /** How many attempts have been made so far. */
  attempts: JobAttempt[];
  /** Max allowed attempts before giving up. */
  maxAttempts: number;
  /** Last result payload (populated on success). */
  result?: Result;
  /** Idempotency key — duplicate enqueues with this key are merged. */
  idempotencyKey?: string;
  /** Free-form metadata (correlation id, advisor id, etc.). */
  metadata?: Record<string, unknown>;
}

/** Callback run when a handler yields progress. */
export interface ProgressReporter {
  (message: string, percent?: number): void;
}

/** Context passed to every handler. */
export interface JobContext<Payload = unknown> {
  job: Job<Payload>;
  /** Report progress; workers may persist these for UIs. */
  reportProgress: ProgressReporter;
  /** Abort signal — honored by cooperating handlers. */
  signal?: AbortSignal;
}

/** Handler function for a job type. */
export type JobHandler<Payload = unknown, Result = unknown> = (
  ctx: JobContext<Payload>,
) => Promise<Result> | Result;

/** Options for queueing a new job. */
export interface EnqueueOptions {
  priority?: number;
  runAfter?: Date | string;
  maxAttempts?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/** Error thrown when a job is explicitly non-retryable. Handler throws this. */
export class PermanentJobError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PermanentJobError";
  }
}

/** Abstract queue backend. Implement to plug in BullMQ, Redis, SQS, etc. */
export interface JobQueue {
  /** Persist a new job and return it. */
  enqueue<Payload>(type: string, payload: Payload, opts?: EnqueueOptions): Promise<Job<Payload>>;

  /** Pull the next available job, or null if queue is empty. */
  dequeue(types?: readonly string[]): Promise<Job | null>;

  /** Mark a job as running (sets state + adds attempt). */
  markRunning(jobId: string): Promise<Job | null>;

  /** Mark a job as succeeded with the given result. */
  markSucceeded(jobId: string, result: unknown): Promise<Job | null>;

  /** Mark a job as failed; runner decides whether to retry. */
  markFailed(jobId: string, error: string, retryAt?: Date): Promise<Job | null>;

  /** Look up a job by id. */
  get(jobId: string): Promise<Job | null>;
}
