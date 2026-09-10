# LEO OS — Architecture Traceability

**Status:** ARCHITECTURE / AUDIT RECORD ONLY
**Baseline:** `d9e5fc40eb40607fc7407186e842c01c9d74c5ec`
**Certified Phase 1 implementation:** `e0365cc89af539fefc37681522b4bd756692bb58`
**Final certification:** Run #141 / `34486653370` — SUCCESS

## 1. Traceability legend

- **EXISTS** — implemented and supported by repository artifacts.
- **PARTIALLY EXISTS** — some primitives exist, but the operating-model capability is incomplete.
- **FOUNDATION EXISTS** — control-plane primitives exist that can support the capability, but the intelligence/company behavior is not implemented.
- **DOCUMENTED ONLY** — architecture/specification exists without implementation evidence.
- **MISSING** — no implementation found.
- **FUTURE / OUT OF SCOPE** — intentionally deferred by Phase 2 boundary/non-goals.

## 2. Repository-to-architecture traceability

| Requirement / layer | Current evidence | Status | Gap / future implication |
|---|---|---|---|
| Owner identity and authority | `User`, `Membership`, `Role`, auth/session | EXISTS | Owner-level product semantics need an explicit intent/decision layer |
| Owner gives an outcome | `Objective` model/API | PARTIALLY EXISTS | Current input is structured control-plane data, not natural-language intent |
| Intent Layer | No intent runtime | MISSING | First Phase 2 slice |
| LEO / CEO identity | `INITIAL_AGENTS` contains `ceo` definition | FOUNDATION EXISTS | No reasoning runtime or CEO decision loop |
| AI employee identity | `AgentDefinition`, `AgentRegistry`, `Task.assignedAgentId` | FOUNDATION EXISTS | No durable lifecycle/identity authority |
| Dynamic employees | Static initial registry | MISSING | Later Phase 2 |
| Departments | Role-like static agent definitions | FOUNDATION EXISTS | No department entity/staffing/delegation policy |
| Model abstraction | `preferredModels` field only | MISSING | Provider-neutral model interface required |
| Model routing | No routing runtime | MISSING | Later/core after abstraction |
| Free-first model policy | No model runtime/cost policy | MISSING | Must be explicit before paid models |
| Paid model approval | Cost fields/approval primitives exist, but no model spend engine | PARTIALLY EXISTS | Model-level budget/approval policy required |
| Planning | Agent definition lists planning capability; no planning engine | FOUNDATION EXISTS | Structured plan proposal contract required |
| Task graph | `packages/core/src/task-graph.ts` | EXISTS | Must remain authoritative for proposed graphs |
| Dependency readiness | `getReadyTasks` / `analyzeTaskGraph` | EXISTS | Must not be duplicated in agent layer |
| Durable workflow | Prisma `Workflow`, workflow repositories/services | EXISTS | Phase 2 must use it, not shadow it |
| Durable job | Prisma `Job`, job repository/service | EXISTS | Phase 2 must submit governed jobs |
| Deterministic orchestrator | `apps/worker/src/orchestrator.ts` | EXISTS | It is not yet a reasoning CEO |
| Dispatcher | `apps/worker/src/job-dispatcher.ts` | EXISTS | Remains worker selection boundary |
| Worker identity | `Worker`, `WorkerCredential` | EXISTS | Future agent identity must not replace worker authorization |
| Worker runtime | `apps/worker/src/worker-runtime.ts` | EXISTS | Remains execution boundary |
| Execution Gateway | `apps/api/src/execution-gateway.ts`, `packages/core/src/execution.ts` | EXISTS | All future tools must pass through governed path |
| Capabilities | Worker capability/permission data + core checks | EXISTS | Agent permissions must be narrower than control-plane authority |
| Risk classification | Core execution policy + risk fields | EXISTS | Business/strategic risk categories may need extension later |
| Approval | Approval model/service/repository | EXISTS | Strategic/spend/external policies need explicit classification |
| Self-approval protection | Approval binding/decision rules | EXISTS | Must remain invariant |
| Tool layer | Controlled internal handler registry only | FOUNDATION EXISTS | Adapter framework is later; no external tools initially |
| Result validation | Worker runtime/result path | EXISTS | Business-level QA remains a future layer |
| QA employee | Static QA definition | FOUNDATION EXISTS | No independent verification workflow |
| Audit | `AuditEvent`, audit service/repositories | EXISTS | Intelligence provenance will need auditable records |
| Retry | Job retry/lease state | EXISTS | Agent loops must not invent separate retries |
| Cancellation | Workflow/job cancellation | EXISTS | Intelligence must honor cancellation |
| Recovery | Stale leases, checkpoints, reconciliation | EXISTS | Agent process failure must defer to durable state |
| Company memory | No durable company-memory subsystem | MISSING | Later Phase 2 |
| Context management | No dedicated context builder | MISSING | Core Phase 2 |
| Knowledge layer | No knowledge/retrieval subsystem | MISSING | Later Phase 2 |
| CEO decision records | Audit is generic control-plane evidence | PARTIALLY EXISTS | Dedicated intelligence decision provenance may be needed |
| Delegation | Static assignment field and jobs | FOUNDATION EXISTS | No dynamic agent-to-agent delegation runtime |
| Autonomous execution loop | Orchestrator is callable but deterministic | FOUNDATION EXISTS | Future bounded intelligence loop must submit governed proposals |
| Proactive company monitoring | No company-state intelligence | MISSING | Later Phase 2 |
| Cost intelligence | Objective/task/job cost fields | FOUNDATION EXISTS | No aggregated budgets/model/tool cost engine |
| Business/project management | Objective/task/workflow primitives | FOUNDATION EXISTS | No company operating view |
| Owner reporting | Durable state/audit | FOUNDATION EXISTS | Executive reporting layer missing |
| Company state | Distributed durable operational state only | PARTIALLY EXISTS | Need derived company-state model later |
| Multi-business coordination | Organization isolation exists; no business portfolio coordinator | MISSING | Later/post-core |
| External integration boundary | No adapters | DOCUMENTED ONLY | Keep external integrations out of initial slices |
| Command Center UI | None | FUTURE / OUT OF SCOPE | Explicit non-goal |

## 3. Phase 1 invariant traceability

The Phase 1 compatibility contract requires future changes to preserve the following guarantees. The existing schema demonstrates durable Workflow/Job/Approval/Worker/Checkpoint entities and organization-scoped relationships. fileciteturn1007file0

| Current Phase 1 guarantee | Future Phase 2 dependency | Preservation rule |
|---|---|---|
| Durable workflow/job state | Agent loop and delegated work | Agent state cannot be the source of truth; governed work must live in Workflow/Job state |
| Deterministic task ordering | Planning and task-graph proposals | Agents propose; existing deterministic readiness/selection remains authoritative |
| Dependency readiness | Plan generation | Proposed dependencies must pass existing graph validation |
| Idempotency | Repeated agent attempts / retries | Every governed execution request must use existing idempotency semantics; no duplicate side effects from re-planning |
| Organization isolation | Context, agents, memory, tools | Organization is resolved/authorized by control plane, not by prompt or model output |
| Approval integrity | CEO decisions and consequential actions | Agent may request approval; cannot approve itself; approval remains action-bound and single-use |
| Capability enforcement | Tool/action proposals | Proposed capability is checked by existing policy/gateway before execution |
| Audit integrity | Agent/model provenance | Intelligence decisions and policy outcomes must remain auditable without secrets |
| Retry semantics | Agent continuation | Job retry limits/leases remain authoritative; agent cannot silently multiply retries |
| Cancellation | Long-running agent loop | Cancellation must stop governed work and cannot be overridden by the model |
| Stale lease recovery | Agent/worker failure | Recovery comes from durable lease/reconciliation mechanisms, not agent memory |
| Checkpoint recovery | Resumable reasoning/work | Any future durable checkpoint must complement, not replace, job checkpoint semantics |
| Terminal-state protection | Agent continuation | Completed/cancelled workflows/jobs cannot be revived by a model response |
| Concurrency correctness | Multiple agent/CEO cycles | Concurrent proposals must converge through existing transactional/idempotent control-plane paths |
| Worker authorization | AI employee/tool execution | Agent identity is not worker authority; authorized worker credentials remain required |
| Result validation | Agent result interpretation | A model saying “done” cannot mark work successful; validated execution result is authoritative |
| Recovery reconciliation | Agent restart | Agent restart resumes from durable control-plane truth and reconciles before continuing |

## 4. Trust-boundary traceability

The existing authentication path resolves a session, membership and role, and can require an organization-scoped permission before returning an `AuthContext`. fileciteturn1020file0

The future boundary is therefore:

```text
Owner
  ↓
Intent
  ↓
Agent / Model
  ↓ proposal only
Task Graph Proposal
  ↓
CERTIFIED CONTROL PLANE
  ├─ ownership
  ├─ workflow state
  ├─ idempotency
  ├─ policy
  ├─ capability
  ├─ approval
  └─ audit
  ↓
Authorized Worker
  ↓
Controlled Tool / Handler
  ↓
Result Validation
  ↓
Durable State + Audit
  ↓
CEO Report
  ↓
Owner
```

No Phase 2 intelligence component may become an alternative execution authority.

## 5. Operating-model decision traceability

| Owner operating decision | Current state | Required architectural treatment |
|---|---|---|
| Show plan and start normal authorized work | Control plane can execute an existing workflow | Add intent/planning layer; preserve direct low-risk authorization path |
| Major strategic changes require approval | Generic approval/risk exists | Add strategic decision classification later |
| Minor tactical changes may auto-adjust | Workflow/job mutations are governed | Add bounded tactical-planning policy |
| Execute, verify, then complete | Certified runtime does this | Preserve as non-negotiable completion contract |
| Dynamic employees, not 50 fixed agents | Static registry exists | Replace static product assumption with governed lifecycle later, not in first slice |
| LEO may create/modify employees within authority | No lifecycle engine | Later employee-management capability with explicit policy |
| External communication contextual/risk-based | No external adapters | Future boundary only |
| Spending requires approval unless approved budget | Cost + approval primitives exist | Add budget policy before spend tools |
| `LEO, run the company` | No company command runtime | Future intent/company-state layer |
| Proactive issue/opportunity detection | No proactive intelligence | Future company-state loop |
| LEO may disagree, not override Owner | RBAC/control-plane authority exists | CEO decision protocol must preserve Owner authority |
| No self-created mission | No mission authority layer | Explicit future policy: mission is Owner-controlled |
| Free-first model selection | No model runtime | First model abstraction must encode routing policy |
| Paid model needs approval/budget | No model cost enforcement | Model router must consult policy/budget before paid use |
| Ordinary failures auto-recover | Certified recovery exists | Agent loop must consume recovery state, not replace it |
| Critical work can use multiple validation paths | Basic result validation exists | Add independent QA orchestration later |
| CEO-level reporting | No executive report layer | Future report builder over verified state |

## 6. Architecture-definition document alignment

The existing Phase 2 architecture explicitly states that Phase 2 adds intelligence around the certified control plane rather than replacing it. Its diagrams define proposal-only agent interaction, governed approval, gateway-based tool execution, durable recovery and organization boundaries. fileciteturn1002file0

The compatibility contract makes the Phase 1 invariants mandatory for future work. The present traceability record converts those principles into implementation gates.

## 7. Required evidence for the first Phase 2 certification

A first Phase 2 slice should not be called certified merely because TypeScript compiles. Evidence should demonstrate:

1. Structured intent/proposal contracts are validated deterministically.
2. Existing task-graph validation remains the single graph invariant implementation.
3. No proposal can directly execute privileged work.
4. Organization ownership cannot be changed by model/agent output.
5. Risk/capability/approval boundaries remain in the certified path.
6. No terminal workflow/job state can be bypassed.
7. No hidden autonomous retry/delegation loop exists.
8. Existing Phase 1 verification passes unchanged.
9. The new slice can be removed without changing Phase 1 behavior.

## 8. Repository documentation discrepancy

At the audited GitHub baseline, `docs/LEO_OS_AI_COMPANY_OPERATING_MODEL_v1.md` was not present despite being named as a repository document in the Step 4 request. This traceability record therefore uses the operating-model requirements supplied in the request as its behavioral reference and explicitly avoids claiming that the absent repository file was inspected.

That discrepancy should be resolved by committing the operating-model document before a future certification treats it as repository-controlled specification.

## 9. Final architecture conclusion

**Current repository:** certified deterministic execution/control plane with partial agent-definition foundations.

**Future LEO company:** requires a bounded intelligence layer that translates Owner intent into governed proposals and interprets verified results.

**Hard boundary:** intelligence is never an authority simply because it is capable of reasoning. Execution authority remains with the certified LEO OS control plane and authorized workers.
