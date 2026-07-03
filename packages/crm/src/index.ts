// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC and contributors.
/**
 * @protocolwealthos/crm
 *
 * Advisor CRM primitives — contacts, households, interactions,
 * opportunities, tasks — plus status/aging helpers for dashboard
 * computation. Storage-agnostic: downstream projects map these types
 * to whatever schema they use.
 */

export const VERSION = "0.3.1";

export {
  groupByLifecycle,
  isOverdueTask,
  isStaleContact,
  isStalledOpportunity,
  overdueTasks,
  pipelineValueByStage,
  staleContacts,
  stalledOpportunities,
} from "./status.js";

export type {
  Contact,
  ContactKind,
  CrmTask,
  Household,
  Interaction,
  InteractionChannel,
  InteractionDirection,
  LifecycleStage,
  Opportunity,
  OpportunityStage,
  RelationshipType,
  TaskStatus,
} from "./types.js";

export {
  activeGoals,
  currentHouseholdProfile,
  staleProfiles,
} from "./householdProfile.js";
export type {
  CareerStage,
  GoalKind,
  GoalPriority,
  GoalStatus,
  HouseholdGoal,
  HouseholdNote,
  HouseholdProfile,
  LiquidityProfile,
  NoteKind,
  RealEstateFootprint,
  RiskTolerance,
  TaxFilingStatus,
} from "./householdProfile.js";
