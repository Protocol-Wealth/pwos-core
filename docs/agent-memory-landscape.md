# Agent memory landscape: patterns to evaluate

Reviewed 2026-09-28. This is a reading and experiment guide, not a dependency
decision or a claim that any listed system has been tested with PWOS Core. The
existing [three-tier architecture](three-tier-agent-memory-architecture.md)
remains the scope and authorization contract for client, advisor, and firm
memory. Use synthetic data in public examples.

## What transfers to a storage-agnostic substrate

1. **Separate source events from derived memories.** Keep the source reference,
   time observed, time claimed to be valid, extractor version, and review state.
   New evidence may supersede a belief without erasing what was previously known.
   A derived summary is not the source record.
2. **Keep capture, retrieval, reflection, and forgetting distinct.** Each has a
   different authorization and audit boundary. Never let a successful read imply
   permission to persist a model-generated claim or edit an agent instruction.
3. **Retrieve in stages.** Scope by principal, tenant, project, and time before
   ranking. Compare exact/keyword matching with semantic and graph-neighbor
   retrieval; only include source detail in the prompt when needed. This can be
   implemented with existing Postgres capabilities before adding a new database.
4. **Treat learned skills as proposed changes.** Session-derived instructions
   need a source, diff, reviewer, and rollback path before they become shared
   guidance. Raw transcripts are sensitive records, not portable public memory.
5. **Measure the whole system.** Retrieval precision and recall, stale-fact
   handling, cross-scope leakage, answer support, prompt tokens, latency, and
   cost all matter. Compare with simple keyword and full-context baselines.

## Reference map

| Project | Pattern worth studying | Boundary for this repository |
| --- | --- | --- |
| [Mem0](https://github.com/mem0ai/mem0) | User/session/agent scopes; append-only fact extraction, entity linking, and combined retrieval in its April 2026 description. | Its README says the new benchmark scores use a managed platform with proprietary optimizations; do not present them as open source SDK results. |
| [Hindsight](https://github.com/vectorize-io/hindsight) | Separate retain, recall, and reflect operations; factual, experiential, and synthesized memory; semantic, keyword, graph, and temporal search. | Keep reflection outputs marked as interpretation, with source links and review status. |
| [memU](https://github.com/NevaMind-AI/memU) | Distill coding sessions into readable Markdown skills, then retrieve skills for similar work. | Do not auto-promote transcript content into `AGENTS.md` or firm policy. Check the repository license before any code reuse. |
| [Cognee](https://github.com/topoteretes/cognee) | Explicit remember, recall, improve, and forget lifecycle across text, code, graph, and session knowledge. | Keep deletion and correction behavior explicit for each of the three PWOS memory scopes. |
| [Graphiti](https://github.com/getzep/graphiti) | Episode provenance, validity windows, contradiction history, and hybrid retrieval for changing facts. | Its graph backends are architectural references; this is not a reason to add a second graph store. |
| [OpenViking](https://github.com/volcengine/OpenViking) | Directory-scoped search and abstract/overview/detail loading let agents inspect small context before opening full records. | The main project is AGPL-3.0; use ideas as references and write original implementation. A virtual directory is not an authorization boundary. |
| [Letta](https://github.com/letta-ai/letta) / [Letta Code](https://github.com/letta-ai/letta-code) | Stateful agents, editable memory, searchable history, and versioned context. The Letta README points to Letta Code as its current source. | Self-editing memory or skills must not bypass PWOS authorization, review, or audit. |
| [OpenMemory](https://github.com/mem0ai/openmemory) | Selected session transfer between coding harnesses. | Treat imports/exports as sensitive transcript movement; check scope, redaction, and destination before transfer. Its README labels autosync as planned. |
| [Agent Memory Benchmark](https://github.com/vectorize-io/agent-memory-benchmark) | Separates ingestion, retrieval, answer generation, and judgment; includes retrieval-only cases that penalize irrelevant memories. | Reproduce on synthetic PWOS cases with fixed models and prompts. The authors also develop Hindsight, so use independent baselines. Confirm licensing before copying benchmark code. |

## Small, reproducible evaluation before integration

Use a synthetic set of client A/client B/advisor/firm records containing changed
preferences, retracted claims, exact identifiers, and dated facts. Include
questions that require one old detail and cases where the correct answer is
"insufficient evidence." Run each candidate with the same ingestion and query
budget. Record:

- retrieval IDs and whether required and forbidden records appeared;
- source and validity time for each supported answer;
- cross-client or cross-advisor leakage (must be zero);
- correction, deletion, and stale-fact outcomes;
- prompt tokens, ingestion cost, query cost, and p50/p95 latency.

Start with keyword search and the current Postgres/pgvector path as baselines.
Evaluate any external memory store only after it improves the relevant measures
without weakening the [three-tier boundary](three-tier-agent-memory-architecture.md).

## Local-agent context is a separate concern

The [XDA local-agent account](https://www.xda-developers.com/stopped-my-local-llm-agent-from-running-out-of-context/)
reports that raising its runner context and adjusting model/KV-cache settings
let one workflow finish. Treat its hardware numbers as one configuration report,
not a portable default. The general lesson is to log the *effective* context
window, input/output token use, model load settings, and context-exhaustion
errors. [LM Studio's load API](https://lmstudio.ai/docs/developer/rest/load)
exposes the applied context length and Flash Attention setting; its
[model configuration](https://lmstudio.ai/docs/typescript/api-reference/llm-load-model-config)
documents KV-cache precision and memory tradeoffs. More context still needs
scoped retrieval and a resumable handoff when long tasks exceed the window.
