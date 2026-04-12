/**
 * @pwos/workflow-engine
 *
 * Durable workflow execution with BullMQ (lightweight) and Temporal
 * (mission-critical).
 *
 * Third-party libraries:
 * - BullMQ (MIT) - https://github.com/taskforcesh/bullmq
 *   Redis-backed job queue with scheduled/repeatable jobs
 * - Temporal TypeScript SDK (MIT) - https://github.com/temporalio/sdk-typescript
 *   Durable execution engine for mission-critical workflows
 * - Trigger.dev (MIT) - https://github.com/triggerdotdev/trigger.dev
 *   Background jobs with checkpoint-resume
 * - Activepieces (MIT) - https://github.com/activepieces/activepieces
 *   Workflow automation with MCP servers
 *
 * Our original work: unified API, audit-trail integration on every
 * workflow step, compliance-gated workflow outputs.
 *
 * Copyright 2026 Protocol Wealth, LLC
 * Licensed under Apache 2.0
 */

export const VERSION = "0.1.0";
