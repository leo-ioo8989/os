# LEO OS — Phase 2 Implementation Boundary

**Status:** DESIGN ONLY — DO NOT TREAT AS IMPLEMENTED
**Audit baseline:** `07c50e451f80ce4e8c256694f090a64ba9fedfd6`
**Phase 1:** Frozen and certified

## 1. Boundary statement

Phase 2 adds a bounded intelligence layer around the certified LEO OS control plane. It does not replace the workflow state machine, durable Job lifecycle, deterministic task readiness/selection, Execution Gateway, approval boundary, worker authorization, result validation or audit source of truth.

**Fundamental rule:**

> Agents propose. LEO OS decides. Authorized workers execute.

## 2. Target conceptual architecture

```text
OWNER
  ↓
INTENT LAYER                         [FUTURE]
  ↓
AGENT / INTELLIGENCE LAYER          [FUTURE]
  ├── model abstraction             [FUTURE]
  ├── model routing                 [FUTURE]
  ├── planning                      [FUTURE]
  ├── context                       [FUTURE]
  ├── memory                        [FUTURE]
  └── reasoning                     [FUTURE]
  ↓
TASK GRAPH PROPOSAL                 [FUTURE]
  ↓
CERTIFIED LEO OS CONTROL PLANE      [EXISTS]
  ├── workflow                      [EXISTS]
  ├── job                           [EXISTS]
  ├── policy                        [EXISTS]
  ├── capability                    [EXISTS]
  ├── approval                      [EXISTS]
  ├── worker                        [EXISTS]
  ├── validation                    [EXISTS]
  └── audit                         [EXISTS]
  ↓
AUTHORIZED WORKERS                 [EXISTS]
  ↓
TOOLS / EXTERNAL SYSTEMS            [FUTURE / LATER]
  ↓
RESULT                              [EXISTS]
  ↓
VALIDATION                          [EXISTS]
  ↓
DURABLE STATE + AUDIT               [EXISTS]
  ↓
LEO REPORT                          [FUTURE]
  ↓
OWNER
```

## 3. Layer ownership

| Layer | Authority | Initial Phase 2 rule |
|---|---|---|
| Owner | Ultimate business authority | Gives intent, approves consequential decisions |
| Intent | Intelligence-facing interpretation | Produces structured intent; never executes |
| Agent/CEO | Reasoning/proposal authority | Proposes plans and next actions; cannot bypass control plane |
| Model | Reasoning engine | Replaceable, provenance-tracked, policy-governed |
| Planning | Proposal generation | Produces candidate graph/actions for validation |
| Context | Information assembly | Only authorized relevant context |
| Memory | Supporting knowledge | Cannot override durable control-plane truth |
| Control plane | Execution authority | Remains authoritative |
| Policy/capability | Security authority | Decides whether requested action is allowed |
| Approval | Human authorization | Required at defined risk/authority boundaries |
| Worker | Execution authority after authorization | Executes only authorized jobs |
| Validation | Completion authority | Determines whether execution result is acceptable |
| Audit | Evidence authority | Records governed decisions and outcomes |
| Report | Owner communication | Summarizes verified state and decisions |

## 4. What exists versus what is missing

### Exists today

- Objective/task graph primitives.
- Durable Workflow and Job state.
- Deterministic task dependency/readiness logic.
- Callable deterministic Orchestrator.
- Deterministic Dispatcher.
- Trusted Worker identity and credentials.
- Controlled Worker Runtime.
- Execution Gateway with risk/capability/approval decisions.
- Controlled internal handlers.
- Result validation.
- Durable checkpoints and stale-lease recovery.
- Organization-scoped authentication/RBAC.
- Durable approvals with action binding and single-use consumption.
- Audit events and redaction.

The schema itself confirms durable Workflow/Job/Approval/Worker/Checkpoint structures and their ownership/indexing boundaries. fileciteturn1007file0

### Missing / future

- Natural-language Owner intent interpretation.
- Real CEO reasoning.
- Model provider abstraction and routing.
- Agent memory/context/knowledge runtime.
- Dynamic employee lifecycle.
- Department staffing/delegation runtime.
- CEO decision records as a first-class intelligence artifact.
- Business-level QA orchestration.
- Cost intelligence/model budgets.
- Company-state/proactive operating loop.
- Executive reporting.
- Multi-business coordination.
- External tool adapters.

## 5. First implementation slice — recommendation only

The first Phase 2 slice should be a **Governed Intent → Plan Proposal Boundary**, without any external integrations and without changing the certified control plane.

### Scope

Build only the intelligence-facing contract and a deterministic proposal validator around it:

```text
Owner intent
  ↓
Structured Intent Contract
  ↓
CEO/Agent Proposal Contract
  ↓
Existing Task Graph Validator
  ↓
Existing Control Plane (later execution step)
```

For the first slice, the intelligence can be represented by a deterministic/test double rather than a live model provider. This keeps the slice certifiable without introducing provider coupling or paid/free routing complexity.

### Likely future files/modules

These are proposed locations, not files to create during Step 4:

```text
packages/core/src/intent.ts
packages/core/src/plan-proposal.ts
packages/core/src/plan-validation.ts
packages/core/test/intent.test.ts
packages/core/test/plan-proposal.test.ts
```

If durable persistence is later required, it must be introduced only through a separately reviewed schema/migration decision. This Step 4 boundary does not authorize schema work.

### First-slice acceptance criteria

1. A structured Owner intent can be represented without embedding execution credentials.
2. A plan proposal can contain objective/task/dependency intent and proposed risk/capability requirements.
3. Invalid graphs are rejected using the existing core graph validation rather than a second graph implementation.
4. A proposal cannot directly execute a Job or mutate terminal workflow state.
5. Organization ownership is explicit and cannot be reassigned by proposal content.
6. Proposed high-risk/consequential work is represented as requiring policy/approval evaluation rather than silently allowed.
7. Proposal validation is deterministic and independently unit-testable.
8. No model provider, external integration, MCP, browser automation or UI is required.
9. Existing Phase 1 verification remains unchanged and passes unchanged.
10. Removing the new proposal layer leaves the certified control plane operational.

### Dependencies

The slice depends on:

- `packages/core/src/task-graph.ts` for graph invariants.
- Existing Objective/Task/Workflow/Job concepts.
- Existing organization and authorization semantics.
- Existing risk/capability vocabulary.
- The Phase 1 compatibility contract.

It must not depend on a specific LLM vendor.

### What it enables

- Real CEO reasoning later.
- Model abstraction without execution coupling.
- Dynamic planning.
- Governed delegation.
- Agent loops that submit proposals instead of performing privileged actions.
- Future employee lifecycle and department specialization.

### Explicitly excluded from the first slice

- Live LLM provider.
- Model routing.
- Paid/free model selection.
- Memory/vector database.
- External tools.
- Gmail/GitHub/Instagram/WhatsApp.
- MCP.
- n8n.
- Browser/computer automation.
- Spending.
- Contracts/legal commitments.
- Command Center UI.
- Autonomous company loop.
- Dynamic employee creation in production.
- Schema changes unless separately authorized.

### Testing model

The first slice should be certifiable with deterministic unit tests plus regression execution of the unchanged Phase 1 suite. Tests should cover:

- valid proposal;
- malformed proposal;
- missing dependency;
- cycle;
- duplicate task ID/dependency;
- cross-organization target;
- terminal workflow target;
- prohibited capability/risk combination;
- proposal idempotency semantics if the proposal is persisted later;
- proof that proposal generation has no direct execution side effect.

### Rollback

The preferred rollback is deletion/reversion of only the new intelligence proposal modules. No Phase 1 file should need to be reverted. The certified control plane must remain buildable and testable without the new layer.

## 6. Future implementation sequence

### Core Phase 2

1. Governed Intent → Plan Proposal Boundary.
2. Provider-neutral Model Abstraction using deterministic test doubles first.
3. Bounded CEO/Agent decision loop over existing durable jobs/workflows.
4. Durable intelligence provenance/decision records.
5. Basic authorized context assembly.
6. Owner-facing verified result/report contract.

### Later Phase 2

7. Dynamic employee lifecycle.
8. Department/delegation model.
9. Memory/knowledge layer.
10. Model routing and cost intelligence.
11. QA/independent validation orchestration.
12. Company-state and proactive operating loop.
13. Multi-business coordination.
14. Governed tool-adapter framework.

### Post-Phase-2

15. External integrations.
16. Broad internet/browser/computer capabilities.
17. Autonomous spending/contracts.
18. Public deployment and multi-tenant productization.

## 7. Compatibility gate for every Phase 2 PR

A Phase 2 change is not acceptable if it causes any of the following:

- Agent directly mutates privileged database state.
- Agent bypasses policy/capability evaluation.
- Agent bypasses approval.
- Agent executes outside authorized worker boundaries.
- Agent declares execution success without result validation.
- Agent creates a shadow workflow/job state machine.
- Agent overrides organization ownership.
- Agent mutates terminal workflow/job state through an intelligence-only path.
- Agent introduces hidden retries or hidden autonomous loops.
- Agent suppresses or bypasses audit evidence.
- Model selection silently changes authority or policy.
- Memory or context can override durable control-plane truth.

Any such change requires a new architectural decision before implementation.

## 8. Rollout principle

Phase 2 should be introduced as additive capability. The safest progression is:

**proposal → validation → governed execution → verified result → bounded continuation**.

Do not jump directly from Owner prompt to external action.
