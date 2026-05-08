// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.

/**
 * Household profile / goals / notes — "financial memory" for advisor
 * platforms.
 *
 * The pattern: across client meetings, advisors accumulate a body of
 * structured context that should not live in unstructured chat
 * histories. Risk tolerance, tax bracket, dependent count, real-estate
 * footprint, beneficiary intentions, philosophical preferences — these
 * are facts a household-aware AI should be able to surface deterministically.
 *
 * This module ships three append-friendly types:
 *   - `HouseholdProfile` — versioned attribute snapshot (one current
 *     row + history)
 *   - `HouseholdGoal` — named financial goal with target / horizon /
 *     priority
 *   - `HouseholdNote` — timestamped + actor-attributed note (always
 *     append-only)
 *
 * All three are designed to compose with `@protocolwealthos/audit-log`
 * so every mutation produces an audit row. Profile updates create a
 * new version row rather than overwriting; the history is a
 * recordkeeping artifact.
 */

export type RiskTolerance =
  | "conservative"
  | "moderately_conservative"
  | "moderate"
  | "moderately_aggressive"
  | "aggressive";

export type CareerStage =
  | "early_career"
  | "mid_career"
  | "peak_earning"
  | "pre_retirement"
  | "retired"
  | "post_career_transition";

export type TaxFilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household"
  | "qualifying_widow_widower";

export type RealEstateFootprint =
  | "renter"
  | "primary_only"
  | "primary_plus_secondary"
  | "primary_plus_investment"
  | "multi_property"
  | "no_real_estate";

export type LiquidityProfile =
  | "low" // most assets in illiquid private/real-estate
  | "moderate"
  | "high"
  | "all_liquid";

/**
 * One versioned snapshot of a household's profile. Profile mutations
 * create a new row with `effectiveAt` set to now and the old row
 * keeps `effectiveAt` unchanged (history is the audit trail). Use the
 * latest row by `effectiveAt` for current-state queries.
 */
export interface HouseholdProfile {
  /** Profile-version id. */
  id: string;
  householdId: string;
  /** Wall-clock time this profile snapshot became current. */
  effectiveAt: string;
  /** Wall-clock time the row was inserted. */
  recordedAt: string;
  /** Actor who recorded this version. */
  recordedBy: string;

  // ── Risk + investment posture ──────────────────────────────────
  riskTolerance?: RiskTolerance;
  /** Free-form context behind the rating ("client lost sleep in 2022 drawdown"). */
  riskTolerancePrincipalNotes?: string;

  // ── Tax posture ────────────────────────────────────────────────
  taxFilingStatus?: TaxFilingStatus;
  /** Estimated marginal federal bracket as a percentage (e.g. 32 → 32%). */
  marginalFederalBracketPct?: number;
  /** State of residence for tax purposes (US 2-letter code). */
  taxResidencyState?: string;

  // ── Family + life stage ────────────────────────────────────────
  dependentCount?: number;
  careerStage?: CareerStage;
  /** ISO-8601 date used for retirement / RMD modeling. Optional — not all households have a date. */
  expectedRetirementOn?: string;

  // ── Asset footprint ────────────────────────────────────────────
  realEstateFootprint?: RealEstateFootprint;
  liquidityProfile?: LiquidityProfile;
  /** Whether the household has a closely-held business interest. */
  hasBusinessInterest?: boolean;

  // ── Estate + legacy ────────────────────────────────────────────
  hasWill?: boolean;
  hasLivingTrust?: boolean;
  hasPowerOfAttorney?: boolean;
  hasHealthcareDirective?: boolean;
  beneficiaryReviewLastDoneAt?: string;

  // ── Free-form ──────────────────────────────────────────────────
  philosophicalPreferences?: string;
  notes?: string;
  meta?: Readonly<Record<string, string>>;
}

export type GoalKind =
  | "retirement"
  | "education"
  | "home_purchase"
  | "major_expense"
  | "emergency_fund"
  | "legacy"
  | "philanthropy"
  | "business_exit"
  | "debt_payoff"
  | "other";

export type GoalStatus = "draft" | "active" | "achieved" | "abandoned" | "deferred";

export type GoalPriority = "primary" | "secondary" | "stretch";

/**
 * A named financial goal. `targetAmountMinorUnits` is in cents (or
 * equivalent minor units of `currency`); pair with the ledger /
 * holdings `MoneyAmount` shape for arithmetic.
 */
export interface HouseholdGoal {
  id: string;
  householdId: string;
  kind: GoalKind;
  title: string;
  description?: string;
  /** ISO 4217 / asset code. */
  currency: string;
  /** Goal target in minor units. */
  targetAmountMinorUnits?: bigint;
  /** ISO-8601 target date / horizon. */
  targetDate?: string;
  priority: GoalPriority;
  status: GoalStatus;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. */
  updatedAt: string;
  /** Optional progress toward target, in same minor units. */
  progressMinorUnits?: bigint;
  meta?: Readonly<Record<string, string>>;
}

export type NoteKind =
  | "meeting"
  | "phone_call"
  | "decision"
  | "advisor_observation"
  | "client_request"
  | "compliance"
  | "system"
  | "other";

/** Append-only timestamped note. New facts get new notes; never edit. */
export interface HouseholdNote {
  id: string;
  householdId: string;
  kind: NoteKind;
  /** ISO-8601 wall-clock time of the event the note describes. */
  occurredAt: string;
  /** ISO-8601 wall-clock time the note was recorded. */
  recordedAt: string;
  recordedBy: string;
  /** Brief subject. */
  subject?: string;
  /** The note content. PII candidate — pair with @protocolwealthos/pii-guard. */
  body: string;
  tags?: readonly string[];
  /** When this note relates to a specific contact within the household. */
  contactId?: string;
  /** When this note relates to a specific goal. */
  goalId?: string;
  meta?: Readonly<Record<string, string>>;
}

/** Pick the latest profile version for a household. */
export function currentHouseholdProfile(
  versions: readonly HouseholdProfile[]
): HouseholdProfile | undefined {
  let best: HouseholdProfile | undefined;
  for (const v of versions) {
    if (!best || v.effectiveAt > best.effectiveAt) best = v;
  }
  return best;
}

/** Active goals filtered by household. */
export function activeGoals(
  goals: readonly HouseholdGoal[],
  householdId: string
): HouseholdGoal[] {
  return goals.filter((g) => g.householdId === householdId && g.status === "active");
}

/**
 * Identify households whose profile is "stale" — no new profile
 * version recorded in the last `staleAfterDays`. Useful for
 * quarterly-review reminders.
 */
export function staleProfiles(
  versions: readonly HouseholdProfile[],
  asOfIso: string,
  staleAfterDays: number
): string[] {
  const latest = new Map<string, HouseholdProfile>();
  for (const v of versions) {
    const prev = latest.get(v.householdId);
    if (!prev || v.effectiveAt > prev.effectiveAt) latest.set(v.householdId, v);
  }
  const horizon = Date.parse(asOfIso) - staleAfterDays * 86_400_000;
  const stale: string[] = [];
  for (const [id, v] of latest) {
    if (Date.parse(v.effectiveAt) < horizon) stale.push(id);
  }
  return stale;
}
