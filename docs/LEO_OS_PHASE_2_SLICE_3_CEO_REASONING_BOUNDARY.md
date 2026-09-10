# LEO OS — Phase 2 Slice #3 — CEO Reasoning / Decision Intelligence Boundary

**Status:** IMPLEMENTED — VERIFICATION PENDING
**Phase 1:** Frozen and certified
**Phase 2 Slice #1:** Verified / certified
**Phase 2 Slice #2:** Verified / certified

## 1. Purpose

Slice #3 introduces the first controlled domain boundary for LEO CEO reasoning. It converts structured Owner Intent plus bounded context into decision intelligence and a governed decision proposal.

It does **not** introduce autonomous execution.

## 2. Architecture

```text
OWNER INTENT
      ↓
STRUCTURED INTENT
      ↓
CERTIFIED MODEL ABSTRACTION
      ↓
CEO REASONING / DECISION PROPOSAL
      ↓
GOVERNED PLAN PROPOSAL
      ↓
EXISTING PLAN VALIDATION
      ↓
EXISTING TASK GRAPH VALIDATION
      ↓
STOP
```

There is no Slice #3 path into the Phase 1 workflow/job/orchestrator/dispatcher/worker/execution chain.

## 3. Contracts

The additive core domain boundary is `packages/core/src/ceo-reasoning.ts`.

### `CEOReasoningRequest`

Carries:

- request identity;
- authoritative `OwnerIntent`;
- bounded reasoning context;
- timestamp;
- correlation ID.

The organization and owner identity come from `OwnerIntent` and are copied into the existing `ModelRequest`. They are not selected by reasoning output.

### `CEOReasoningModelOutput`

Carries intelligence/data such as:

- strategy;
- priorities;
- risks;
- rationale;
- clarification recommendation;
- approval recommendation;
- a plan-shaped output compatible with the existing Slice #2 model-to-proposal boundary.

The contract explicitly rejects authority-bearing output fields including organization identity, owner identity, granted permissions/capabilities, approval grants, worker IDs, credential IDs, execution flags, dispatch flags and external-action flags.

### `DecisionProposal`

The application constructs a proposal with:

- authoritative organization identity from OwnerIntent;
- source intent identity;
- CEO strategy/priorities/risks/rationale;
- clarification/approval recommendations;
- the existing governed `PlanProposal`;
- `authority: 'PROPOSAL_ONLY'`.

`authority` is a contract marker, not an authorization grant.

## 4. Authority boundary

CEO reasoning is not the source of:

- authorization;
- permissions;
- capabilities;
- approvals;
- worker authority;
- organization identity;
- credentials.

If model output attempts to provide authority-bearing fields, the reasoning boundary fails closed.

The authoritative sequence remains:

```text
MODEL OUTPUT
→ GOVERNED PROPOSAL
→ CONTROL-PLANE VALIDATION
→ POLICY / CAPABILITY / APPROVAL DECISION
→ AUTHORIZED EXECUTION ONLY
```

Slice #3 stops before the final two stages.

## 5. Security model

The boundary follows these rules:

```text
CONTROL PLANE > CEO REASONING
POLICY > MODEL OUTPUT
APPROVAL > MODEL RECOMMENDATION
AUTHORITATIVE OWNER INTENT > MODEL IDENTITY CLAIMS
PROPOSAL > EXECUTION
FAIL CLOSED > ASSUMPTION
```

No credentials, worker identities, execution handlers, dispatcher interfaces, external tools or network clients are imported by the Slice #3 implementation.

## 6. Model relationship

Slice #3 reuses the certified Slice #2 `ModelProvider`, `ModelRequest`, `ModelResponse` and deterministic test model abstraction.

No second model abstraction is introduced.

No real provider, API key, provider SDK, network call, paid model routing or model credential is introduced.

The CEO reasoning layer is provider-neutral. A future real provider must satisfy the same governed boundary and must not receive execution authority merely by being selected as a model.

## 7. Plan relationship

CEO reasoning does not create a competing planner or graph validator.

The plan-shaped reasoning output is adapted through the existing Slice #2 `modelResponseToPlanProposal()` boundary, which then calls the existing `validatePlanProposal()`, which terminates at the existing authoritative `validateTaskGraph()`.

```text
CEO reasoning
      ↓
Decision / plan data
      ↓
modelResponseToPlanProposal()
      ↓
validatePlanProposal()
      ↓
validateTaskGraph()
      ↓
STOP
```

## 8. Failure behavior

The boundary fails closed when:

- the reasoning request is malformed;
- model generation fails;
- response provenance does not match the request;
- reasoning output is malformed;
- forbidden authority fields appear;
- the resulting governed plan is invalid;
- task dependencies violate the existing task-graph rules.

No failure path creates a job, dispatches a worker, calls a handler or performs an external action.

## 9. Explicit non-goals

Slice #3 does **not** implement:

- autonomous execution;
- job creation;
- worker dispatch;
- execution gateway calls;
- handlers;
- email or external communication;
- spending or purchasing;
- credentials;
- approval granting;
- permission or capability granting;
- organization switching;
- dynamic AI employee creation/lifecycle;
- memory/vector database;
- delegation runtime;
- external integrations;
- real model providers;
- autonomous CEO loops;
- infinite loops or background daemons;
- Command Center UI;
- database schema or migration changes;
- API contract changes.

## 10. Testing

Focused tests cover:

1. request construction;
2. response construction;
3. deterministic reasoning behavior;
4. valid proposal generation;
5. malformed output fail-closed behavior;
6. organization identity protection;
7. permission/capability grant rejection;
8. self-approval rejection;
9. worker selection/authorization rejection;
10. execution/dispatch rejection;
11. credential access rejection;
12. external-side-effect boundary;
13. existing proposal validation authority;
14. existing task-graph validation authority;
15. model failure handling;
16. proposal-only authority markers.

The full repository verification additionally serves as the compatibility gate for Phase 1, Slice #1 and Slice #2.

## 11. Compatibility

Slice #3 is additive. It does not modify:

- Prisma schema;
- migrations;
- API contracts;
- worker runtime;
- dispatcher;
- orchestrator;
- execution gateway;
- handlers;
- credentials;
- external integrations.

The Phase 1 execution path remains:

```text
Workflow → Job → Dispatcher → Worker Runtime → Execution Gateway → Handler
```

No Slice #3 code enters that path.

Removing `ceo-reasoning.ts`, its export and its focused tests leaves the preceding Phase 1 + Slice #1 + Slice #2 architecture intact.

## 12. Known limitations

- CEO reasoning is represented by a provider-neutral domain boundary; no production reasoning provider is integrated.
- The deterministic test model remains a test provider and is not a production CEO intelligence system.
- Dynamic employee lifecycle, memory, delegation runtime and broader policy orchestration remain future work.
- Full AI-company operating-loop behavior is not certified by this slice.

## 13. Certification rule

This document remains **VERIFICATION PENDING** until the repository's actual CI verification completes successfully. Implementation alone is not certification.

Certification, if achieved, will be limited to the CEO reasoning / decision-proposal boundary and its compatibility with the certified proposal/task-graph and Phase 1 control-plane boundaries.
