# @protocolwealthos/crm

> Advisor CRM primitives: contacts, households, interactions, opportunities, and tasks, plus status and aging helpers for dashboard computation.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Why

The types are storage-agnostic. Downstream projects map them onto whatever schema they use, then call the helpers on the resulting arrays.

## What ships

- **Entities:** `Contact`, `Household`, `HouseholdProfile`, `HouseholdGoal`, `Interaction`, `Opportunity`, `CrmTask`.
- **Aging / pipeline helpers:** `isStaleContact`, `staleContacts`, `isOverdueTask`, `overdueTasks`, `isStalledOpportunity`, `stalledOpportunities`, `groupByLifecycle`, `pipelineValueByStage`.
- **Household profile helpers:** `activeGoals`, `currentHouseholdProfile`, `staleProfiles`.

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
