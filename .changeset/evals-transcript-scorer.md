---
"@protocolwealthos/evals": minor
---

First npm release of the eval harness as `@protocolwealthos/evals` (previously the private `@protocolwealthos-apps/evals`).

Adds attack-test scoring on top of the existing string predicates:

- Cases may carry follow-up `turns` (multi-turn, Crescendo-style escalation) and untrusted `context` blocks the harness feeds the system under test.
- A `Transcript` records replies, tool calls, outbound model-request bodies, source text and stored values. New predicates read it: `must_not_call_tool`, `tool_input_must_not_contain`, `urls_only_from`, `outbound_must_not_contain`, `outbound_must_not_match`, `field_must_equal`.
- `scoreTranscript` returns pass, fail, review or not_run. Only pass is clean: a predicate that cannot decide (the transcript lacks what it reads) is a review, and `on_fail: "review"` marks borderline expectations. Expectations may carry an adopter failure `code`.
- `runScorerSelfTest()` scores canned bad answers (S1 to S5) and one clean answer (S6); it is not ok when any bad answer passes, so a caller can stop before any paid model call. `pnpm evals:selftest` runs it.
- Four generic transcript fixtures (`inj_05` to `inj_08`): tool-data injection, fence breaking, and two multi-turn escalations. `runEvals` skips transcript cases with reason `needs_transcript_runner`.
