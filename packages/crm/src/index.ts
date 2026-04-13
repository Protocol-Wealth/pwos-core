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

export const VERSION = "0.1.0";

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
