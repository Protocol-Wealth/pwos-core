---
"@protocolwealthos/crm": minor
---

Add household profile / goals / notes — "financial memory" types for advisor platforms.

**`HouseholdProfile`** (versioned) — captures the structured context advisors accumulate across client meetings: risk tolerance + principal notes, tax filing status + marginal federal bracket + state of residence, dependent count, career stage, expected retirement date, real-estate footprint, liquidity profile, business interest flag, estate-document flags (will / trust / POA / healthcare directive), beneficiary review timestamp, philosophical preferences. Profile mutations create a **new version row** (don't overwrite); history is the audit trail.

**`HouseholdGoal`** — named financial goal: kind (retirement / education / home_purchase / major_expense / emergency_fund / legacy / philanthropy / business_exit / debt_payoff), target amount + currency + date, priority (primary / secondary / stretch), status (draft / active / achieved / abandoned / deferred), progress tracker.

**`HouseholdNote`** — append-only timestamped note with kind enum (meeting / phone_call / decision / advisor_observation / client_request / compliance / system) and optional contact / goal linkage. New facts get new notes; never edit.

Three helpers:
- `currentHouseholdProfile(versions)` — pick the latest by `effectiveAt`
- `activeGoals(goals, householdId)` — active goals filtered by household
- `staleProfiles(versions, asOfIso, staleAfterDays)` — for nightly "quarterly review" reminders

All three types are designed to compose with `@protocolwealthos/audit-log` so every mutation produces one hash-chained audit row.
