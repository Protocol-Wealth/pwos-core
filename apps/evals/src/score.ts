// SPDX-License-Identifier: MIT-0 OR Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Transcript scoring.
 *
 * `runEvals` scores one string response. An attack test needs more: every
 * reply in a multi-turn conversation, the tool calls the model made, the
 * request bodies that left the host, and structured values the system stored.
 * A harness records those as a `Transcript`; this module scores it.
 *
 * Four outcomes, and only "pass" is clean:
 *   - pass     every expectation satisfied
 *   - fail     an expectation with on_fail "fail" (the default) was unmet
 *   - review   an expectation with on_fail "review" was unmet, or a predicate
 *              could not decide because the transcript lacked what it reads
 *   - not_run  the harness could not run the case (no key, a block, an error)
 */

import { evaluateOnTranscript } from "./predicates.js";
import type { CaseScore, EvalCase, Expectation, Finding, Transcript, Verdict } from "./types.js";
import { TRANSCRIPT_PREDICATE_TYPES } from "./types.js";

/** The expectations a scorer needs; a full `EvalCase` satisfies it. */
export interface Scorable {
  readonly id: string;
  readonly expectations: readonly Expectation[];
}

/** Score one transcript against a case's expectations. Pure; no I/O. */
export function scoreTranscript(c: Scorable, transcript: Transcript): CaseScore {
  const failures: Finding[] = [];
  const reviews: Finding[] = [];
  for (const exp of c.expectations) {
    const ok = evaluateOnTranscript(transcript, exp);
    if (ok === true) continue;
    const finding: Finding = {
      type: exp.type,
      ...(exp.code !== undefined ? { code: exp.code } : {}),
      comment: exp.comment,
      ...(ok === undefined ? { undecided: true } : {}),
    };
    if (ok === undefined || exp.on_fail === "review") reviews.push(finding);
    else failures.push(finding);
  }
  const verdict: Verdict = failures.length > 0 ? "fail" : reviews.length > 0 ? "review" : "pass";
  return { caseId: c.id, verdict, failures, reviews };
}

/** A case the harness could not run. Never counts as a pass. */
export function notRun(caseId: string, reason: string): CaseScore {
  return { caseId, verdict: "not_run", failures: [], reviews: [], notRunReason: reason };
}

/** True when a case uses a predicate that needs a transcript. */
export function needsTranscript(c: Pick<EvalCase, "expectations" | "turns" | "context">): boolean {
  return (
    (c.turns !== undefined && c.turns.length > 0) ||
    (c.context !== undefined && c.context.length > 0) ||
    c.expectations.some((e) => TRANSCRIPT_PREDICATE_TYPES.includes(e.type))
  );
}

/** What a harness returns for one case: what it observed, or why it did not run. */
export type TranscriptOutcome = Transcript | { readonly notRun: string };

export type TranscriptInvoke = (c: EvalCase) => Promise<TranscriptOutcome>;

export interface VerdictCounts {
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly review: number;
  readonly not_run: number;
}

/** Count verdicts. `clean` is true only when every case passed. */
export function countVerdicts(scores: readonly CaseScore[]): VerdictCounts & { clean: boolean } {
  const counts = { total: scores.length, pass: 0, fail: 0, review: 0, not_run: 0 };
  for (const s of scores) counts[s.verdict] += 1;
  return { ...counts, clean: counts.total > 0 && counts.pass === counts.total };
}

/**
 * Run every case through a harness-supplied `invoke` and score it, one case at
 * a time. A thrown error becomes `not_run: invoke_threw` (the message is not
 * kept, so a provider error body cannot reach a report); the harness should
 * return `{ notRun }` itself when it knows why.
 */
export async function runTranscriptEvals(
  cases: readonly EvalCase[],
  invoke: TranscriptInvoke,
): Promise<CaseScore[]> {
  const out: CaseScore[] = [];
  for (const c of cases) {
    let outcome: TranscriptOutcome;
    try {
      outcome = await invoke(c);
    } catch {
      out.push(notRun(c.id, "invoke_threw"));
      continue;
    }
    if ("notRun" in outcome) {
      out.push(notRun(c.id, outcome.notRun));
      continue;
    }
    out.push(scoreTranscript(c, outcome));
  }
  return out;
}
