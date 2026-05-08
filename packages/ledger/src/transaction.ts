// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

import { negateAmount } from "./decimal.js";
import type {
  Amount,
  Posting,
  Transaction,
  TxId,
} from "./types.js";

export interface BuildTransactionInput {
  id: TxId;
  date: string;
  flag?: Transaction["flag"];
  payee?: string;
  narration: string;
  tags?: readonly string[];
  links?: readonly string[];
  postings: readonly Posting[];
  meta?: Readonly<Record<string, string>>;
  recordedAt?: string; // defaults to `new Date().toISOString()`
  reverses?: TxId;
}

/**
 * Construct a `Transaction` value object. Does NOT validate the
 * sum-to-zero invariant — that's the validator's job, called when
 * appending to a `LedgerStore`.
 */
export function buildTransaction(input: BuildTransactionInput): Transaction {
  return {
    id: input.id,
    date: input.date,
    flag: input.flag ?? "*",
    ...(input.payee !== undefined && { payee: input.payee }),
    narration: input.narration,
    tags: new Set(input.tags ?? []),
    links: new Set(input.links ?? []),
    postings: input.postings,
    meta: input.meta ?? {},
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    ...(input.reverses !== undefined && { reverses: input.reverses }),
  };
}

/**
 * Build a reversing transaction for `original`. Postings are
 * sign-flipped; metadata gains `reversed_from: original.id`. Use when
 * correcting a previously-posted transaction.
 *
 * The returned transaction has not yet been appended to a store —
 * callers must explicitly `append` it so audit-log + validators run.
 */
export function reverseTransaction(
  original: Transaction,
  newId: TxId,
  options: {
    date?: string;
    narration?: string;
    recordedAt?: string;
  } = {}
): Transaction {
  const flippedPostings: Posting[] = original.postings.map((p) => ({
    ...p,
    amount: negateAmount(p.amount),
  }));
  return buildTransaction({
    id: newId,
    date: options.date ?? new Date().toISOString().slice(0, 10),
    flag: original.flag,
    payee: original.payee ?? "",
    narration:
      options.narration ?? `Reverses ${original.id}: ${original.narration}`,
    tags: Array.from(original.tags),
    links: Array.from(original.links),
    postings: flippedPostings,
    meta: { ...original.meta, reversed_from: original.id },
    recordedAt: options.recordedAt ?? new Date().toISOString(),
    reverses: original.id,
  });
}

/**
 * Convenience: build a posting. Use when constructing transactions
 * inline; otherwise consumers can build the object literal directly.
 */
export function posting(
  account: Posting["account"],
  amount: Amount,
  options: { flag?: Posting["flag"]; meta?: Posting["meta"] } = {}
): Posting {
  return {
    account,
    amount,
    ...(options.flag !== undefined && { flag: options.flag }),
    ...(options.meta !== undefined && { meta: options.meta }),
  };
}
