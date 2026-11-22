# @protocolwealthos/workflow-engine

> Storage-agnostic durable-job runtime with retries, backoff strategies, and pluggable queue backends.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Quick start

```ts
import {
  Worker,
  InMemoryJobQueue,
} from "@protocolwealthos/workflow-engine";

const queue = new InMemoryJobQueue();
const worker = new Worker({ queue });

worker.register("send_email", async (ctx) => {
  await deliver(ctx.job.payload);
});

await queue.enqueue("send_email", { to: "user@example.com" });
await worker.processOne();
```

The in-memory queue is for tests and local development. Production deployments implement `JobQueue` against Redis (BullMQ), Postgres, SQS, or Temporal. Backoff helpers include `fixed`, `linear`, `exponential`, `withEqualJitter`, and `withFullJitter`. Use `PermanentJobError` to stop retries.

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
