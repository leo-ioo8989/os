# LEO OS — Phase 2 Implementation Boundary

**Status:** SLICE #1 IMPLEMENTED — INTENT → PLAN PROPOSAL ONLY
**Phase 1:** Frozen and certified
**Phase 2 rule:** Agents propose. LEO OS decides. Authorized workers execute.

## 1. Current boundary

Phase 2 Slice #1 establishes an additive, domain-level boundary:

```text
OWNER INTENT
    ↓
STRUCTURED OWNER INTENT
    ↓
DETERMINISTIC PLAN PROPOSAL
    ↓
EXISTING TASK GRAPH VALIDATOR
    ↓
CERTIFIED LEO OS CONTROL PLANE (separate future operation)
```

The implemented slice stops at proposal validation. It does not invoke the orchestrator, dispatcher, worker runtime, execution gateway, handlers, credentials, tools, approvals, spending or external systems.

## 2. Implemented today

- `packages/core/src/intent.ts`: strongly typed OwnerIntent contract and basic required-field/budget validation.
- `packages/core/src/plan-proposal.ts`: strongly typed PlanProposal/ProposedTask contracts and deterministic planner.
- `packages/core/src/plan-validation.ts`: proposal-to-existing-TaskGraph adaptation plus organization/shape checks, followed by the existing authoritative `validateTaskGraph`.
- `packages/core/src/index.ts`: additive exports.
- focused core tests for intent, proposal generation, authority metadata, deterministic behavior, graph validation and organization isolation.

The deterministic planner is a test/domain implementation only. It has no model provider, network, API key, credential or execution dependency.

## 3. Authority boundary

A `PlanProposal` carries `authority: 'PROPOSAL_ONLY'`. This is an explicit contract marker, not an authorization grant.

The proposal can express:

- required capabilities;
- required permissions;
- execution risk;
- approval requirement;
- proposed worker role;
- resource/budget estimate.

None of those fields grant permission. The existing Phase 1 control plane remains responsible for actual authorization, capability checks, approval consumption, worker authorization, execution and result validation.

In particular:

```text
proposal.approvalRequired === true
```

means **approval is required**; it never means approval has been granted.

Likewise:

```text
proposal.tasks[n].requiredCapabilities
```

means **capabilities would be required**; it never means the proposed worker possesses them.

## 4. Existing Phase 1 authority retained

The slice reuses `packages/core/src/task-graph.ts` rather than implementing a competing graph validator. Existing validation remains authoritative for duplicate task IDs, missing dependencies, self-dependencies and cycles.

Existing execution authority remains unchanged:

```text
Workflow → Job → Dispatcher → Worker Runtime → Execution Gateway → Handler
```

No new path from proposal generation enters that chain.

## 5. Organization boundary

Every proposal carries an organization ID. Every proposed task also carries a target organization ID. Validation rejects a task whose target organization differs from the proposal organization before the graph is accepted.

This is an additional proposal-layer fail-closed check; it does not replace Phase 1 organization authorization.

## 6. Risk and approval boundary

The proposal uses the existing `ExecutionRisk` vocabulary (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and existing RBAC `Permission` type. It expresses requirements only.

No new policy engine was introduced.

No approval record is created by proposal generation.

## 7. Explicitly not implemented

This slice does **not** implement:

- LLMs or model providers;
- model routing or paid/free model selection;
- autonomous CEO loop;
- dynamic employee creation/lifecycle;
- memory or knowledge systems;
- external integrations;
- Gmail, GitHub, Instagram or WhatsApp;
- MCP or n8n;
- browser/computer automation;
- autonomous spending;
- autonomous contracts/legal commitments;
- unrestricted credentials;
- Command Center UI;
- automatic workflow/job creation or execution from a proposal;
- a shadow orchestrator, dispatcher or worker path.

## 8. Compatibility rule for the next slices

Future intelligence may replace the deterministic planner implementation, but it must emit the same governed proposal boundary or a separately reviewed compatible contract. It must not gain execution authority through the intelligence layer.

Every future Phase 2 change must preserve the Phase 1 compatibility contract, including durable state, deterministic task ordering/readiness, idempotency, organization isolation, approval integrity, capability enforcement, audit, retry/recovery, cancellation, concurrency correctness, worker authorization, result validation and terminal-state protection.

## 9. Rollback

Slice #1 is additive. Removing its three core modules and their exports/tests leaves the existing Phase 1 control plane and execution path structurally intact. No database migration or API change is required to roll it back.
