// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * Backoff strategies for retrying failed jobs.
 *
 * Strategies are pure functions of (attempt number, base delay) so
 * they're trivially testable and deterministic. Pair with jitter to
 * avoid thundering-herd retries when many jobs fail simultaneously.
 */

/** Compute the delay before the next attempt, in milliseconds. */
export type BackoffStrategy = (attemptsSoFar: number) => number;

/** Fixed delay between attempts. */
export function fixed(delayMs: number): BackoffStrategy {
  return () => delayMs;
}

/** Linear backoff: base * attempt. */
export function linear(baseMs: number): BackoffStrategy {
  return (attempts) => baseMs * Math.max(1, attempts);
}

/**
 * Exponential backoff: base * 2^(attempts - 1).
 *
 * Standard choice for network-bound retries. ``capMs`` caps the
 * computed delay — useful when you don't want attempt 10 to wait 17
 * minutes.
 */
export function exponential(baseMs: number, capMs: number = 60_000): BackoffStrategy {
  return (attempts) => {
    const raw = baseMs * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(raw, capMs);
  };
}

/** Wrap another strategy with full jitter — final delay in [0, computed]. */
export function withFullJitter(
  strategy: BackoffStrategy,
  random: () => number = Math.random,
): BackoffStrategy {
  return (attempts) => {
    const computed = strategy(attempts);
    return Math.floor(random() * computed);
  };
}

/** Wrap another strategy with equal jitter — final delay in [computed/2, computed]. */
export function withEqualJitter(
  strategy: BackoffStrategy,
  random: () => number = Math.random,
): BackoffStrategy {
  return (attempts) => {
    const computed = strategy(attempts);
    const half = computed / 2;
    return Math.floor(half + random() * half);
  };
}
