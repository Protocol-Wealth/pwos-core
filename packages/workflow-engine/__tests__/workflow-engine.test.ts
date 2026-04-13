// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
import { describe, expect, it } from "vitest";

import {
  InMemoryJobQueue,
  PermanentJobError,
  Worker,
  exponential,
  fixed,
  linear,
  withEqualJitter,
  withFullJitter,
  type Job,
  type JobContext,
  type WorkerEvent,
} from "../src/index.js";

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// ──────────────────────────────────────────────────────────────────────
// Backoff strategies
// ──────────────────────────────────────────────────────────────────────

describe("backoff", () => {
  it("fixed returns constant delay", () => {
    const b = fixed(500);
    expect(b(1)).toBe(500);
    expect(b(5)).toBe(500);
  });

  it("linear scales with attempts", () => {
    const b = linear(100);
    expect(b(1)).toBe(100);
    expect(b(3)).toBe(300);
  });

  it("exponential doubles each attempt", () => {
    const b = exponential(100, 10_000);
    expect(b(1)).toBe(100);
    expect(b(2)).toBe(200);
    expect(b(3)).toBe(400);
    expect(b(4)).toBe(800);
  });

  it("exponential caps at the supplied maximum", () => {
    const b = exponential(1000, 3_000);
    expect(b(10)).toBe(3_000);
  });

  it("withFullJitter stays in [0, computed]", () => {
    const rng = seededRandom(42);
    const b = withFullJitter(exponential(100), rng);
    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = b(attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(100 * Math.pow(2, attempt - 1));
    }
  });

  it("withEqualJitter stays in [computed/2, computed]", () => {
    const rng = seededRandom(42);
    const b = withEqualJitter(exponential(100), rng);
    const attempt = 4;
    const computed = 100 * Math.pow(2, attempt - 1);
    const delay = b(attempt);
    expect(delay).toBeGreaterThanOrEqual(computed / 2);
    expect(delay).toBeLessThanOrEqual(computed);
  });
});

// ──────────────────────────────────────────────────────────────────────
// InMemoryJobQueue
// ──────────────────────────────────────────────────────────────────────

describe("InMemoryJobQueue", () => {
  function freshQueue() {
    let i = 0;
    let t = Date.parse("2026-01-01T00:00:00Z");
    return new InMemoryJobQueue({
      idProvider: () => `job_${++i}`,
      clock: () => new Date((t += 1000)),
    });
  }

  it("enqueue stores a queued job", async () => {
    const q = freshQueue();
    const job = await q.enqueue("work", { x: 1 });
    expect(job.state).toBe("queued");
    expect(job.payload).toEqual({ x: 1 });
    expect(job.maxAttempts).toBe(3);
  });

  it("dequeue returns the highest-priority queued job", async () => {
    const q = freshQueue();
    await q.enqueue("work", { n: 1 }, { priority: 1 });
    await q.enqueue("work", { n: 2 }, { priority: 10 });
    await q.enqueue("work", { n: 3 }, { priority: 5 });
    const next = await q.dequeue();
    expect((next?.payload as { n: number }).n).toBe(2);
  });

  it("idempotency key dedupes enqueues", async () => {
    const q = freshQueue();
    const a = await q.enqueue("work", {}, { idempotencyKey: "dedupe-1" });
    const b = await q.enqueue("work", {}, { idempotencyKey: "dedupe-1" });
    expect(a.id).toBe(b.id);
    expect(q.list()).toHaveLength(1);
  });

  it("runAfter delays availability", async () => {
    const q = freshQueue();
    const future = new Date("2030-01-01T00:00:00Z");
    await q.enqueue("work", {}, { runAfter: future });
    expect(await q.dequeue()).toBeNull();
  });

  it("markRunning adds an attempt", async () => {
    const q = freshQueue();
    const enqueued = await q.enqueue("work", {});
    const running = await q.markRunning(enqueued.id);
    expect(running?.state).toBe("running");
    expect(running?.attempts).toHaveLength(1);
    expect(running?.attempts[0].attempt).toBe(1);
  });

  it("markSucceeded stores result and closes attempt", async () => {
    const q = freshQueue();
    const job = await q.enqueue("work", {});
    await q.markRunning(job.id);
    const done = await q.markSucceeded(job.id, { ok: true });
    expect(done?.state).toBe("succeeded");
    expect(done?.result).toEqual({ ok: true });
    expect(done?.attempts[0].endedAt).toBeDefined();
  });

  it("markFailed with retryAt reschedules queued", async () => {
    const q = freshQueue();
    const job = await q.enqueue("work", {});
    await q.markRunning(job.id);
    const retryAt = new Date("2030-01-01T00:00:00Z");
    const failed = await q.markFailed(job.id, "boom", retryAt);
    expect(failed?.state).toBe("queued");
    expect(failed?.runAfter).toBe(retryAt.toISOString());
  });

  it("markFailed without retryAt is terminal", async () => {
    const q = freshQueue();
    const job = await q.enqueue("work", {});
    await q.markRunning(job.id);
    const failed = await q.markFailed(job.id, "boom");
    expect(failed?.state).toBe("failed");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Worker
// ──────────────────────────────────────────────────────────────────────

describe("Worker", () => {
  it("executes registered handler on success", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({ queue: q });
    worker.register("echo", (ctx) => (ctx.job.payload as { value: string }).value);

    await q.enqueue("echo", { value: "hello" });
    const result = await worker.processOne();
    expect(result?.state).toBe("succeeded");
    expect(result?.result).toBe("hello");
  });

  it("returns null when queue is empty", async () => {
    const worker = new Worker({ queue: new InMemoryJobQueue() });
    expect(await worker.processOne()).toBeNull();
  });

  it("fails permanently when no handler registered", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({ queue: q, backoff: fixed(0) });
    await q.enqueue("unknown", {});
    const result = await worker.processOne();
    expect(result?.state).toBe("failed");
  });

  it("retries on transient failures up to maxAttempts", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({
      queue: q,
      backoff: fixed(0),
      clock: () => new Date("2026-01-01T00:00:00Z"),
    });
    let calls = 0;
    worker.register("flaky", () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });

    const enqueued = await q.enqueue("flaky", {}, { maxAttempts: 3 });
    await worker.drain();
    const job = (await q.get(enqueued.id))!;
    expect(calls).toBe(3);
    expect(job.state).toBe("succeeded");
    expect(job.attempts).toHaveLength(3);
  });

  it("stops retrying after maxAttempts", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({ queue: q, backoff: fixed(0) });
    let calls = 0;
    worker.register("always_fails", () => {
      calls++;
      throw new Error("nope");
    });

    await q.enqueue("always_fails", {}, { maxAttempts: 2 });
    await worker.drain();
    expect(calls).toBe(2);
  });

  it("PermanentJobError skips retries", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({ queue: q });
    let calls = 0;
    worker.register("bad_input", () => {
      calls++;
      throw new PermanentJobError("invalid payload");
    });

    await q.enqueue("bad_input", {}, { maxAttempts: 5 });
    await worker.drain();
    expect(calls).toBe(1);
  });

  it("observer sees started/succeeded/failed events", async () => {
    const q = new InMemoryJobQueue();
    const events: WorkerEvent["kind"][] = [];
    const worker = new Worker({
      queue: q,
      observer: (e) => {
        events.push(e.kind);
      },
    });
    worker.register("x", () => "ok");
    await q.enqueue("x", {});
    await worker.processOne();
    expect(events).toEqual(["started", "succeeded"]);
  });

  it("observer errors do not break job processing", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({
      queue: q,
      observer: () => {
        throw new Error("audit down");
      },
    });
    worker.register("x", () => "ok");
    await q.enqueue("x", {});
    const result = await worker.processOne();
    expect(result?.state).toBe("succeeded");
  });

  it("type filter limits which jobs the worker pulls", async () => {
    const q = new InMemoryJobQueue();
    const worker = new Worker({ queue: q, types: ["wanted"] });
    worker.register("wanted", () => "w");
    worker.register("ignored", () => "i");

    await q.enqueue("ignored", {});
    await q.enqueue("wanted", {});

    const result = await worker.processOne();
    expect(result?.type).toBe("wanted");
  });

  it("progress reporter receives handler updates", async () => {
    const q = new InMemoryJobQueue();
    const reports: Array<[string, number | undefined]> = [];
    const worker = new Worker({
      queue: q,
      progress: () => (msg, pct) => {
        reports.push([msg, pct]);
      },
    });
    worker.register("progressive", (ctx: JobContext) => {
      ctx.reportProgress("starting", 0);
      ctx.reportProgress("halfway", 50);
      ctx.reportProgress("done", 100);
      return "ok";
    });
    await q.enqueue("progressive", {});
    await worker.processOne();
    expect(reports).toHaveLength(3);
    expect(reports[1][1]).toBe(50);
  });
});
