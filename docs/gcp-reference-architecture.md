# GCP Reference Architecture for Regulated Workloads

> A generic, vendor-agnostic posture for advisor / fintech / RIA workloads on Google Cloud. Patterns only — no client identifiers, no firm-specific names. Pair with the application-layer primitives in `pwos-core` packages.

This document describes a Google Cloud baseline that's compatible with **SEC Rule 204-2** (Books & Records, 5-year retention), **SEC Rule 17a-4** (non-rewriteable / non-erasable), **Regulation S-P** (privacy + breach notification), and the typical control families an SOC 2 / ISO 27001 auditor will look for.

It is intentionally opinionated: every choice maps to a specific control objective, and where there's a less-secure but more-convenient option, we don't document it.

The patterns here are not Terraform modules — they're choices and shapes. Use the `pwos-core` packages as the application-layer half of the architecture; provision GCP via your own IaC.

---

## Layout overview

```
                 ┌─────────────────────┐
                 │   Cloudflare        │
                 │   (DNS + edge WAF)  │
                 └──────────┬──────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
   ┌──────────▼──────────┐    ┌───────────▼──────────┐
   │  Cloud Run          │    │  Cloud Run           │
   │  Frontend           │    │  Public webhooks     │
   │  (public ingress,   │    │  (public ingress,    │
   │   auth at app)      │    │   HMAC-verified)     │
   └──────────┬──────────┘    └───────────┬──────────┘
              │                           │
              │ INTERNAL_ONLY ingress     │
              ▼                           ▼
       ┌──────────────────────────────────────┐
       │  Cloud Run Backend Services          │
       │  (one per logical service)           │
       │  - VPC connector to private subnet   │
       │  - dedicated IAM service account     │
       │  - secret-key references at runtime  │
       └──────┬───────────────────────┬───────┘
              │                       │
   ┌──────────▼─────────┐  ┌──────────▼─────────┐
   │  Cloud SQL         │  │  Memorystore       │
   │  (Postgres / MySQL)│  │  (Redis 7)         │
   │  - Private IP only │  │  - TLS + AUTH      │
   │  - IAM auth        │  │  - Private IP only │
   │  - HA + PITR       │  │  - Standard HA     │
   └────────────────────┘  └────────────────────┘

                    ┌────────────────────────────┐
                    │  Cloud Audit Logs (org-wide)│
                    │  ─ Data Access on every API │
                    │  ─ → BigQuery (1-yr query)  │
                    │  ─ → GCS (7-yr lock-locked) │
                    └────────────────────────────┘
```

---

## Compute — Cloud Run

**Choice: Cloud Run for every application service.**

| Property | Value | Why |
|---|---|---|
| Region | Single primary region (e.g. `us-central1`) | Latency homogeneity; data-residency clarity |
| Ingress | `INGRESS_INTERNAL_ONLY` for backends; public for frontends + webhooks | Backends only callable from inside the VPC |
| Service account | Dedicated per service | Per-service IAM, scoped Secret Manager access |
| Egress | VPC connector to a `cloud-run` subnet, with Cloud NAT for outbound | Private DB / cache reachability + egress control |
| Concurrency | 80 default; tune per service | |
| Min instances | 0 for low-traffic; ≥1 for latency-sensitive paths | |
| Secrets | Secret-key references — never env literals | |

**Pattern: separate frontends from backends.** Frontends are CDN-cacheable static + light edge logic; auth + business logic lives behind `INTERNAL_ONLY` backends. The frontend reaches the backend via service-to-service auth (signed Google ID tokens for the backend SA) — never through a public URL.

**Pattern: separate webhook handlers from primary backends.** A public webhook surface is its own Cloud Run service, isolated so that compromise of a vendor signature secret does not give an attacker a foothold inside the primary application surface. Use [`@protocolwealthos/webhooks`](../packages/webhooks) for HMAC verification and idempotency.

---

## Database — Cloud SQL with IAM auth

**Choice: Cloud SQL Postgres (HA), private IP only, IAM authentication via the Cloud SQL connector.**

| Property | Value | Why |
|---|---|---|
| Engine | Postgres 15+ (or MySQL 8+) | |
| HA | Regional / multi-zone | |
| Public IP | **Disabled** | No public ingress to the database |
| IAM auth | Enabled | No static database passwords in env or vault |
| Backups | Automated daily + transaction logs | PITR for the regulated database |
| Audit | `pgaudit` extension (Postgres) for query-level audit | |
| Retention | Backups retained per regulatory floor | |

**Pattern: hand-authored SQL migrations.** ORM `db push` / `synchronize` are forbidden. Migrations ship in code review; production application happens via a Cloud Run **Job** that runs once per deploy and writes audit log entries for each migration. The Cloud Run Job uses a deployer service account; the application's runtime service account does not have DDL privileges.

**Pattern: append-only audit table with BEFORE DELETE / BEFORE UPDATE triggers.** See [`packages/audit-log/src/sql/appendOnlyTrigger.sql`](../packages/audit-log/src/sql/appendOnlyTrigger.sql) for a template.

**Pattern: row-level security (RLS) for tenant separation.** A query against the wrong tenant context fails before it can return data. Don't rely on application-layer "I checked the tenant id in the WHERE clause" — that's procedural, not architectural.

Use [`pickConnectionStrategy`](../packages/gcp-helpers/src/cloudSqlIam.ts) to refuse silent fallback to password auth.

---

## Cache — Memorystore with TLS + AUTH

**Choice: Memorystore Redis 7, Standard HA, private IP only, TLS in transit, AUTH required.**

**Pattern: refuse PII in cache keys.** Cache keys appear in eviction logs, slow-key metrics, and crash reports — surfaces with weaker retention than your primary database. Use [`@protocolwealthos/cache-keys`](../packages/cache-keys) to enforce the namespace shape and reject identifying values at write time.

**Pattern: short TTLs on tenant-scoped data.** Cache poisoning that crosses tenant boundaries is a multi-tenant nightmare. Keep TTLs short, scope keys to the tenant, and evict aggressively on tenant-context changes.

---

## Storage — GCS with retention lock for the audit archive

**Choice: separate buckets per data class.**

| Bucket purpose | Retention lock | Public access prevention | Uniform bucket-level access |
|---|---|---|---|
| Audit archive | **7 years (locked)** | Required | Required |
| Vendor compliance docs | None | Required | Required |
| Application uploads (chat attachments, etc.) | None | Required | Required |

**Retention lock semantics**: the lock cannot be shortened, only extended. This satisfies SEC Rule 17a-4's "non-rewriteable / non-erasable" technical control. The lock is set at bucket creation and is not undone by IAM compromise, accidental terraform `-replace`, or malicious deletion attempts.

**Pattern: org-policy `iam.allowedPolicyMemberDomains`** to refuse any IAM grant outside your Workspace domain. Prevents social-engineering paths where a phishing victim grants `objectAdmin` to an external Google account.

---

## Identity — Workload Identity Federation for CI

**Choice: GitHub Actions → GCP via Workload Identity Federation; no service-account JSON keys exist anywhere.**

| Property | Value | Why |
|---|---|---|
| Identity pool | One per environment (prod, staging) | Blast-radius separation |
| Provider | GitHub OIDC | |
| Attribute condition | Pinned to your org + a list of repos | Refuse OIDC tokens from forks |
| Service accounts | Per-job, least-privilege, disabled by default | |

**Pattern: no service-account JSON keys.** Anywhere. Local dev uses `gcloud auth application-default login` (short-lived OAuth tokens for individual humans). CI uses WIF. Production uses Cloud Run's attached SA. There is no fourth option.

---

## Secrets — Secret Manager only, IAM-bound per secret

**Choice: every secret in Secret Manager; per-secret IAM bindings to the minimal set of service accounts that need it.**

| Property | Value |
|---|---|
| Storage | Secret Manager (never env literals, never build artifacts) |
| Reference | Cloud Run secret-key references (mounted at runtime) |
| Rotation | Manual + alert on drift (CI script reads `secrets.list` against Cloud Run env mounts) |
| Audit | Org-wide Data Access logs capture every secret read |

Use [`createCachingSecretLoader`](../packages/gcp-helpers/src/secretManager.ts) to bound TTL on cached values so rotation eventually propagates without restarts.

**Pattern: pre-commit secret scanning.** Catches accidental check-ins. Run [`gitleaks`](https://github.com/gitleaks/gitleaks) or equivalent in a pre-commit hook + a required CI check.

---

## Audit logging — org-wide Data Access sinks

**Choice: org-wide Cloud Audit Logs with Data Access on `allServices`, sinking to BigQuery + retention-locked GCS.**

| Sink | Destination | Retention |
|---|---|---|
| Queryable | BigQuery dataset, partitioned tables | 1 year (or your jurisdiction's queryable floor) |
| Archive | GCS bucket, retention-locked | 7 years |

**Pattern: Cloud Audit Logs is the *forensic* log; the application audit log (`@protocolwealthos/audit-log`) is the *application* log.** They serve different audiences:

- **Application audit log** is what you show clients, examiners, and your CCO. It carries actor-and-action shape that maps to your business model.
- **Cloud Audit Logs** is what you reach for when you suspect a control failure: who called which Google API, when, from which service account, with what authorization decision.

Both should exist. They overlap deliberately.

**Pattern: nightly anomaly detection.** Run [`detectOffHours` / `detectRapidSequential` / `detectNewActorOnAdmin`](../packages/audit-log/src/anomaly.ts) against the previous day's application audit rows; surface findings on a partner-tier review board. The review action itself writes an audit row.

---

## Edge — Cloudflare in front of public surfaces

**Choice: Cloudflare for DNS + edge security; security headers come from the application layer, not the CDN.**

| Property | Value | Why |
|---|---|---|
| DNS | Cloudflare | |
| TLS | Full (strict) — origin cert pinned to GCP | |
| Bot challenge | On marketing surface; **off** on authenticated platform domains | Avoids friction with legit advisor traffic |
| Cloudflare Pages | Marketing site only | Authenticated app stays on Cloud Run |
| Security headers | **Application layer**, not CF dashboard | A CDN config drift becomes a silent regression otherwise |

Use [`@protocolwealthos/security-headers`](../packages/security-headers) `buildSecurityHeaders` and pair with a daily probe that fetches your live site and compares the wire headers against a committed baseline. Drift = open issue.

---

## AI — Anthropic with ZDR + workspace assertion + prompt cache

**Choice: Anthropic Zero-Data-Retention workspace, US-region only, workspace-id asserted at boot.**

| Property | Value |
|---|---|
| Provider | Anthropic |
| Workspace | ZDR-enrolled |
| Region | US |
| Model strings | Application aliases only (FRONTIER / WORKHORSE / EXTRACTION); resolved from env |
| Prompt caching | System-prompt + tool-definition prefix |
| PII boundary | Outbound scrubber → placeholder; inbound rehydrator inside firm infrastructure |
| Audit | Per-call row with `sha256(prompt)`, `sha256(response)`, model id, trace id, token counts — never raw content |

Use [`@protocolwealthos/ai-guardrails`](../packages/ai-guardrails) for the workspace assertion, model resolver, prompt-cache markers, and audit-row builder. Use [`@protocolwealthos/pii-guard`](../packages/pii-guard) for the scrubber/rehydrator pipeline.

**Pattern: assert workspace at boot.** A credential rotation that silently moves traffic to a non-ZDR workspace would route firm data through a path that doesn't satisfy your obligations. Fail fast.

**Pattern: refuse hardcoded model literals.** Add a CI lint over the source tree that grep's for `"claude-..."` outside the resolver module; require all callers go through `models.resolve("FRONTIER")`.

---

## Observability — Cloud Logging + self-hosted AI tracer

**Choice: Cloud Logging for service logs; self-hosted Langfuse (or equivalent) for AI traces.**

| Surface | Tool | Why |
|---|---|---|
| Service logs | Cloud Logging (auto from Cloud Run JSON stdout) | One-stop with Cloud Audit Logs |
| AI traces | **Self-hosted** Langfuse (or equivalent) | AI traces never leave firm infrastructure |
| Frontend errors | Application endpoint → Cloud Logging | Don't log directly browser → 3rd-party SaaS |
| Alerts | Cloud Monitoring with absence-of-signal alerts | Catches scheduler ticks that go silent |

Use [`createCloudLogger`](../packages/gcp-helpers/src/structuredLog.ts) for the structured-log shape and [`buildFrontendErrorReport`](../packages/gcp-helpers/src/errorBoundaryShape.ts) for browser-side error capture.

**Pattern: alert on the absence of signal.** Most outages are not "service errored" — they're "service stopped reporting at all". Configure absence alerts on every scheduled job's tick.

---

## Backup + recovery

| Property | Value |
|---|---|
| Cloud SQL | Daily automated + transaction-log PITR |
| GCS | Object versioning on regulated buckets; lifecycle rules to archival storage class after N days |
| Quarterly drill | PITR restore to a sandbox project; verify schema + sample queries |

The drill itself is on the compliance calendar (`@protocolwealthos/compliance` `evaluateCalendar`).

---

## Network segmentation

| Layer | Choice |
|---|---|
| VPC | One per environment; subnets per role (cloud-run, reserved, peering) |
| DB / cache ingress | Private IP only; no public CIDR in firewall rules |
| VPC service controls | On the project containing the audit archive bucket — refuse data egress to non-org projects |
| Cloud NAT | Egress for Cloud Run services that need external HTTP; static-IP for vendor IP allowlists |

---

## What's deliberately *not* here

- **Trade execution surfaces.** AI is additive only; a regulated platform should have *no* code path that can place, modify, or cancel a trade based solely on AI output. Enforce by absence: the surface simply doesn't exist in the codebase.
- **Customer-managed encryption keys (CMEK).** Google-managed keys (AES-256) is the default; CMEK is overhead worth paying only when a specific control objective demands it. Reach for it explicitly when needed.
- **Multi-region active-active.** Regional HA is the default; multi-region is operational complexity that compounds incident response and rarely buys what teams expect.
- **Custom IAM conditions for routine grants.** They're hard to read in an audit. Use minimal-scope service accounts instead.

---

## Mapping to control frameworks

Use the controls table in your firm's security page; this architecture is designed to satisfy the typical mapping for an early-stage RIA / fintech:

| Control area | ISO 27001 Annex A | SOC 2 (TSC) | Where it lives in this doc |
|---|---|---|---|
| Identity + access | A.5.15–A.5.18, A.8.2–A.8.5 | CC6.1, CC6.2, CC6.3 | "Identity — WIF" + Workspace SSO + role guards |
| Encryption | A.8.24, A.8.20 | CC6.7 | Cloud SQL/GCS/Memorystore default + TLS 1.2+ |
| Audit logging | A.8.15, A.8.16 | CC7.2, CC7.3, CC4.1 | Cloud Audit Logs + application audit log |
| Change management | A.8.32, A.8.31 | CC8.1 | "Compute — Cloud Run" deploys via WIF; no console clicks |
| Vulnerability mgmt | A.8.8 | CC7.1 | CodeQL / Trivy / Dependabot in CI |
| Vendor oversight | A.5.19–A.5.22 | CC9.2 | `VendorAssessment` + `VendorDocMetadata` |
| Cryptographic key mgmt | A.8.24 | CC6.7 | Secret Manager + per-secret IAM |
| Network segmentation | A.8.22 | CC6.6 | VPC + private-IP-only DB/cache |
| Information classification (PII) | A.5.12, A.5.13 | P3.2, P4.2 | `pii-guard` + `cache-keys` + AI guardrails |
| Incident management | A.5.24–A.5.27 | CC7.4, CC7.5 | Audit anomaly cron + IRP doc |
| Backup + recovery | A.8.13 | A1.2, A1.3 | Cloud SQL backups + PITR + quarterly drill |
| Records retention | A.5.34 | CC7.3 (records) | Retention-locked GCS audit archive |

---

## License

This document is part of `pwos-core` and licensed Apache 2.0. The patterns here are extracted from production deployments and intentionally generic — apply them to your own workload, audit them, send patches.
