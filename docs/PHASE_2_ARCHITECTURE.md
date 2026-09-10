# LEO OS — Phase 2 Architecture

**Status: PROPOSED / NOT IMPLEMENTED**  
**Phase 1:** Frozen. This document defines extension points only.

## 1. Design rule
Phase 2 adds intelligence around the certified control plane; it does not replace the control plane.

## 2. Current Phase-1 architecture — certified
```mermaid
flowchart TD
 U[Human] --> O[Objective]
 O --> TG[Task Graph]
 TG --> W[Workflow]
 W --> J[Durable Job]
 J --> ORC[Deterministic Orchestrator]
 ORC --> D[Job Dispatcher]
 D --> WR[Trusted Worker Runtime]
 WR --> EG[Execution Gateway]
 EG --> A[Approval / Policy]
 A --> H[Controlled Handler]
 H --> RV[Result Validation]
 RV --> S[Durable Job / Workflow State]
 S --> AU[Audit]
```

## 3. Proposed component map — NOT IMPLEMENTED
```mermaid
flowchart LR
 U[Human Intent] --> IN[PROPOSED Intent Layer]
 IN --> AG[PROPOSED Agent Layer]
 AG --> MA[PROPOSED Model Abstraction]
 AG --> PL[PROPOSED Planning]
 PL --> CS[PROPOSED Context]
 CS --> MS[PROPOSED Memory]
 PL --> TG[Certified Task Graph]
 TG --> CP[Certified LEO OS Control Plane]
 CP --> PE[Certified Policy / Capability]
 PE --> AP[Certified Approval]
 AP --> EX[Certified Worker Execution]
 EX --> RV[Certified Result Validation]
 RV --> AG
 CP --> AU[Certified Audit]
```

**PROPOSED / NOT IMPLEMENTED:** Intent Layer, Agent Layer, Model Abstraction, Planning, Context, Memory, and any future tool infrastructure.

## 4. Agent → Control Plane interaction
```mermaid
sequenceDiagram
 participant U as Human
 participant A as PROPOSED Agent
 participant CP as Certified Control Plane
 participant P as Certified Policy
 participant W as Authorized Worker
 U->>A: Authorized intent
 A->>CP: Proposed plan / task graph / action request
 CP->>CP: Validate ownership, state, dependencies
 CP->>P: Capability + risk evaluation
 P-->>CP: Allow / approval required / deny
 CP->>W: Authorized durable job
 W-->>CP: Validated execution result
 CP-->>A: Governed result/state
```

## 5. Approval flow
```mermaid
flowchart TD
 R[Agent or Human action request] --> P[Certified Policy]
 P --> Q{Approval required?}
 Q -- No --> E[Authorized execution]
 Q -- Yes --> AP[Certified Approval Record]
 AP --> H[Authorized Human Approver]
 H --> D{Decision}
 D -- Approved --> E
 D -- Rejected --> X[Rejected / durable outcome]
 D -- Expired --> X
 D -- Cancelled --> X
 E --> V[Certified Result Validation]
 V --> AU[Audit]
```

Approval is bound to the governed action context; an agent cannot self-approve.

## 6. Tool execution boundary
```mermaid
flowchart LR
 A[PROPOSED Agent] --> TR[PROPOSED Tool Request]
 TR --> EG[Certified Execution Gateway]
 EG --> PC[Capability / Risk / Approval]
 PC --> W[Authorized Worker]
 W --> H[Controlled Handler]
 H --> RV[Certified Result Validation]
 RV --> S[Durable State]
 S --> AU[Audit]
```

A tool is a capability request, not a privileged identity. No future tool may create a parallel execution path.

## 7. Failure / recovery relationship
```mermaid
flowchart TD
 A[Agent attempt] --> J[Durable Job]
 J --> X{Process / worker failure?}
 X -- No --> R[Validated result]
 X -- Yes --> L[Lease becomes stale]
 L --> RC[Certified stale recovery / reconciliation]
 RC --> RR[Retry or resumable state]
 RR --> W[Authorized worker]
 W --> R
 R --> WF[Workflow progression]
 WF --> AU[Audit]
```

The agent process may disappear without becoming the source of truth for recovery.

## 8. Organization / security boundary
```mermaid
flowchart TD
 O1[Organization A] --> CP1[Control Plane scope A]
 O2[Organization B] --> CP2[Control Plane scope B]
 AG[PROPOSED Agent] --> ID[Authenticated / authorized identity]
 ID --> CP1
 ID -. forbidden cross-org .-> CP2
 CP1 --> POL[Policy + Capability]
 POL --> WR[Authorized Worker]
 WR --> AU[Org-scoped Audit]
```

Organization ownership remains authoritative in the control plane. An agent's requested organization, target ID, or prompt text cannot redefine ownership.

## 9. Agent layer
A bounded agent would own reasoning and proposal generation, not execution authority. Agent state should be resumable through explicit control-plane jobs rather than hidden in process memory.

## 10. Model abstraction
A future model interface should normalize model requests/results, budgets, timeouts, failure categories, and provenance. Models are replaceable reasoning engines, not authorities. Model selection must be explicit and policy-governed; no uncontrolled model switching.

## 11. Planning layer
Planning converts authorized intent into candidate objectives/tasks/dependencies. It should produce structured proposals that the control plane validates before durable creation. Planning must not directly persist arbitrary privileged state.

## 12. Context system
Context supplies only authorized, relevant information to an agent. Organization, workflow, task, approval, and worker boundaries remain authoritative. Context assembly must not become an implicit privilege escalation path.

## 13. Memory system
Future memory should distinguish durable company facts, workflow state, task history, and ephemeral reasoning context. Durable control-plane truth must remain in the certified sources of truth; memory cannot override workflow/job state.

## 14. Tool abstraction
A future tool is an explicit capability contract: identity, required capability, risk classification, input/output schema, authorization requirements, and audit semantics. Tools should route through the Execution Gateway and authorized workers rather than create parallel privileged paths.

## 15. Permission and policy
Reuse the existing organization/RBAC, worker identity, capability, execution-risk, approval, ownership, and terminal-state controls. Future agent permissions should be narrower than the authority available to the underlying control plane.

## 16. Approval integration
When policy requires approval, the agent can request approval but cannot approve itself. Approval must bind to the consequential action context and remain single-use under the certified approval model.

## 17. Task Graph generation
Agents may propose a graph. The existing graph validation and deterministic readiness/selection logic remains authoritative. Invalid, cyclic, duplicate, self-dependent, or cross-organization proposals are rejected by the control plane.

## 18. Agent execution loop
Conceptually:
```text
observe authorized context
→ reason
→ propose next action
→ submit to control plane
→ await policy/approval/execution result
→ interpret validated result
→ continue, retry, escalate, or stop
```

The loop is bounded by durable jobs/workflows, policy, budgets, cancellation, and human escalation. It is not an unrestricted autonomous loop.

## 19. Result interpretation
Agents may interpret validated outputs. They cannot mark a job successful merely by producing a success-looking message. Durable success remains determined by existing execution/result-validation boundaries.

## 20. Retry and recovery
Agents may recommend retry or escalation. Job retry limits, leases, stale recovery, checkpoints, reconciliation, and terminal protection remain owned by the control plane.

## 21. Observability
Future intelligence should expose model/agent provenance, latency, token/cost metadata where available, decisions, tool requests, policy outcomes, approvals, and failures through controlled observability and audit records without leaking secrets.

## 22. Cost controls
Potential controls include per-organization budgets, per-workflow budgets, per-agent/model budgets, action limits, context limits, and escalation thresholds. Budget exhaustion should fail closed or require an explicit authorized decision.

## 23. Model failure handling
Treat timeouts, malformed outputs, unavailable models, unsafe/invalid proposals, and inconsistent structured output as failures. Never silently substitute a different authority. A fallback model, if later permitted, must remain inside explicit policy and provenance rules.

## 24. Agent failure handling
Persist sufficient durable state to recover a failed agent attempt. The agent process may fail; the workflow/job state must remain recoverable. Stale leases and reconciliation remain control-plane mechanisms.

## 25. Tool failure handling
Normalize tool failures into structured results. Retry only according to existing policy. Never turn a tool exception into assumed success.

## 26. Human escalation
Escalate when policy requires approval, ambiguity exceeds configured bounds, risk is high, budgets are exhausted, repeated failures occur, or the agent cannot safely proceed. Humans can cancel or redirect governed work.

## 27. Security boundaries
The minimum boundary is:
```text
Agent
  ↓ proposal/request only
Control Plane
  ↓ policy/capability/approval
Authorized Worker
  ↓ controlled handler
Result Validation
  ↓
Durable State + Audit
```

No future Phase-2 component may introduce a shadow execution path.

## 28. Extension rule
Phase 2 must integrate with existing Phase-1 primitives. Replacing the orchestrator, workflow state machine, job lifecycle, execution gateway, approval boundary, or audit source of truth would require a separate architectural decision and is outside this definition.
