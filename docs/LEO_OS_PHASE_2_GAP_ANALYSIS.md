# LEO OS — Phase 2 Architecture Gap Analysis

**Status:** ARCHITECTURE / AUDIT ONLY — NO PHASE 2 IMPLEMENTATION
**Audit baseline:** `dccc91ca1951e8aba47a5d3e2587fa0f3421bd72`
**Certified implementation:** `e0365cc89af539fefc37681522b4bd756692bb58`
**Certification:** GitHub Actions Run #141 / `34486653370` — SUCCESS

## 1. Audit method and source-of-truth rule

This document records what is actually present in the repository, not what a future architecture says should exist. Repository source, Prisma schema, tests, package configuration, CI configuration, and existing architecture/certification documents were inspected before this mapping.

A repository fact is marked **EXISTS** only when there is an implementation artifact supporting it. Documentation alone is not treated as implementation evidence.

### Important repository observation

The requested path `docs/LEO_OS_AI_COMPANY_OPERATING_MODEL_v1.md` was **not present at the inspected GitHub baseline** `dccc91ca1951e8aba47a5d3e2587fa0f3421bd72`; fetching that exact path returned 404. Therefore this audit uses the authoritative AI Company Operating Model requirements supplied in the Step 4 task as the behavioral specification, while recording the repository-file absence as a documentation gap. The operating-model file should be committed before it is treated as a repository-controlled normative source.

## 2. Current implementation inventory

### 2.1 Workspace/application structure

| Area | Current implementation | Status |
|---|---|---|
| Root workspace | pnpm workspace, root scripts, TypeScript/Prettier | EXISTS |
| API application | `apps/api` with HTTP/auth/control-plane services | EXISTS |
| Worker application | `apps/worker` with dispatcher, runtime, orchestrator, handlers | EXISTS |
| Core domain package | `packages/core` with objectives, task graph, workflow, jobs, security, RBAC, agent definitions | EXISTS |
| DB package | `packages/db` with Prisma, migrations and repositories | EXISTS |
| UI / Command Center | No Command Center implementation | MISSING / OUT OF SCOPE |
| AI/model runtime | No model provider/runtime | MISSING |
| External integrations | None introduced in certified Phase 1 | MISSING / OUT OF SCOPE |

The root package identifies the workspace as `leo-os`, while technical compatibility namespaces remain `@founder-os/*`. The current package scripts cover build, typecheck, lint, unit/integration verification and disposable PostgreSQL verification. fileciteturn1006file0

### 2.2 Domain and execution modules

| Component | Relevant implementation | Actual role |
|---|---|---|
| Objective | `packages/core/src/objectives.ts`, `packages/db/src/objectives.ts`, `apps/api/src/control-plane.ts` | Durable objective definition and API/control-plane handling |
| Task graph | `packages/core/src/task-graph.ts` | Graph validation, dependency readiness, blocked analysis and execution waves |
| Workflow | `packages/core/src/workflow.ts`, `packages/db/src/workflow-repository.ts`, `packages/db/src/workflow-execution-repository.ts`, `apps/api/src/workflow-state-service.ts` | Durable workflow state machine and progression |
| Job | `packages/core/src/jobs.ts`, `packages/db/src/job-repository.ts`, `apps/worker/src/job-service.ts` | Durable execution unit, leases, retries and terminal states |
| Orchestrator | `apps/worker/src/orchestrator.ts` | Callable deterministic control-plane execution cycle; not an LLM CEO |
| Dispatcher | `apps/worker/src/job-dispatcher.ts` | Deterministic job/worker selection |
| Worker runtime | `apps/worker/src/worker-runtime.ts` | Authenticated controlled execution path |
| Worker | `apps/worker/src/worker.ts`, `apps/worker/src/index.ts` | Worker process entrypoint/coordination |
| Execution gateway | `apps/api/src/execution-gateway.ts`, `packages/core/src/execution.ts` | Risk/capability/approval authorization boundary |
| Handlers | `apps/worker/src/execution-handlers.ts` | Controlled internal handler registry |
| Result validation | `apps/worker/src/worker-runtime.ts` and execution path | Validates execution outputs before durable success |
| Approval | `apps/api/src/approval-service.ts`, `packages/db/src/approval-repository.ts` | Durable, bound, single-use human approval lifecycle |
| Policy/capability | `packages/core/src/security.ts`, `packages/core/src/execution.ts`, Worker permission/capability data | Worker/action authorization and risk decisions |
| Audit | `packages/db/src/audit.ts`, `AuditEvent` schema, services | Durable org-scoped audit trail with redaction controls |
| Recovery | Job leases/checkpoints + workflow reconciliation | Stale lease, retry and restart recovery |
| Concurrency | Serializable DB transactions and race tests | PostgreSQL conflict handling and deterministic outcomes |
| Auth/RBAC | `apps/api/src/auth-context.ts`, `packages/core/src/rbac.ts`, `packages/db/src/auth.ts` | Session authentication, org membership and permissions |

The task graph implementation validates duplicate IDs, missing dependencies, self-dependencies and dependency cycles; readiness requires all dependencies to be completed. fileciteturn1018file0

The callable orchestrator currently reconciles workflow state, ensures a workflow job, dispatches to a worker, resolves credentials/approval, invokes the worker runtime and records the orchestration cycle. It is deterministic infrastructure, not an autonomous reasoning agent. fileciteturn1019file0

## 3. Database reality

The Prisma schema contains durable entities for `Organization`, `User`, `Membership`, `Session`, `Objective`, `Task`, `TaskDependency`, `AuditEvent`, `Approval`, `Workflow`, `Worker`, `WorkerCredential`, `Job`, and `Checkpoint`. It also contains status/risk/role/actor/approval enums required by the Phase 1 control plane. fileciteturn1007file0

Important existing fields include:

- `Objective.successCriteria`, budget/cost fields and deadline.
- `Task.assignedAgentId`, risk/cost/retry metadata.
- `Workflow.currentTaskId`, `Workflow.currentJobId`, resumable state and terminal status.
- `Job.idempotencyKey`, worker identity, lease, retry and resumable state.
- `Approval.requesterAgentId`, action fingerprint, policy version, risk, evidence, expiration and consumption binding.
- `Worker.capabilities` and `permissionProfile`.
- `Checkpoint.version` and durable state.

These fields provide some **future extension seams**, but their existence does not mean a complete AI company exists. For example, `assignedAgentId` and the `AgentDefinition` registry are not equivalent to a durable employee lifecycle, model runtime, delegation engine or CEO reasoning system.

## 4. Actual agent implementation: important distinction

`packages/core/src/agents.ts` contains an `AgentDefinition` interface and an `AgentRegistry`, plus a static `INITIAL_AGENTS` list containing a CEO and functional roles. The definitions include capabilities, allowed/forbidden tools, preferred models, permission level, cost limit, instructions and schemas. fileciteturn1015file0

This is **FOUNDATION EXISTS / PARTIALLY EXISTS**, not a functioning AI workforce. There is no model invocation layer, no dynamic employee lifecycle, no persistent employee entity, no delegation runtime, no model routing, no context/memory system and no external tool execution for these definitions.

The registry is exported through `packages/core/src/index.ts`, but the certified execution architecture still relies on controlled workflows/jobs/workers rather than an agent runtime. fileciteturn1016file0

## 5. Operating-model traceability summary

The following status mapping is based on the behavioral requirements supplied for the AI Company Operating Model v1.

| Operating-model capability | Status | Evidence / gap |
|---|---|---|
| Owner gives high-level outcome | PARTIALLY EXISTS | Objectives exist; no natural-language intent layer |
| LEO understands intent | MISSING | No intent interpreter/model runtime |
| LEO explains a plan | MISSING | No CEO reasoning/planning response layer |
| Authorized low-risk work starts automatically | FOUNDATION EXISTS | Control-plane execution/risk path exists; no intelligence deciding intent |
| LEO delegates work | PARTIALLY EXISTS | Task assignment/agent IDs and deterministic jobs exist; no agent delegation runtime |
| AI employees work dynamically | MISSING | Static registry only; no lifecycle/execution intelligence |
| Ordinary problems solved automatically | MISSING | No reasoning/agent loop |
| QA/validation before completion | EXISTS / PARTIAL | Execution result validation is certified; business-level independent QA orchestration is absent |
| Owner receives final result | PARTIALLY EXISTS | Durable outcomes/audit exist; CEO-level reporting layer absent |
| Ask owner only at real approval boundaries | FOUNDATION EXISTS | Approval/risk boundary exists; no intent/agent layer deciding when to ask |
| Major strategic change requires approval | PARTIALLY EXISTS | Approval/risk primitives exist; strategic-change classification/policy is absent |
| Minor tactical changes within scope | FOUNDATION EXISTS | Controlled workflow/job mutation and policy primitives exist; no autonomous tactical planner |
| Dynamic employee creation/modification | MISSING | Static in-memory registry; no governed lifecycle |
| Contextual external communication | MISSING | No external communication adapter/policy runtime |
| Spending requires approval / future budget policy | PARTIALLY EXISTS | Objective/task/job cost fields and approval evidence exist; no enforced company-wide spend budget engine |
| `LEO, run the company` | MISSING | No command/intent parser or company operating loop |
| Proactive problems/opportunities/bottlenecks | MISSING | No company-state analytics/reasoning loop |
| LEO can disagree with Owner but cannot override legitimate authority | FOUNDATION EXISTS | RBAC/approval/control-plane authority model exists; CEO disagreement protocol is not implemented |
| No invented high-level mission | MISSING | No mission/strategy authority model |
| Free-first model selection | MISSING | No model abstraction/routing |
| Paid model requires approval or approved budget | MISSING | No model cost/policy engine |
| Ordinary failure recovery | EXISTS | Certified job retry, stale lease recovery and reconciliation |
| Critical work can use independent validation paths | PARTIALLY EXISTS | Result validation exists; multi-path business validation orchestration absent |
| CEO-level reporting rather than raw logs | MISSING | Audit exists; executive reporting layer absent |

## 6. Architecture gap categories

### Required for core Phase 2

1. **Intent contract** — convert Owner intent into a structured, auditable request without granting execution authority.
2. **CEO/agent decision boundary** — a bounded intelligence layer that can interpret authorized intent and propose plans.
3. **Model abstraction** — provider-neutral request/result contract with provenance, budget, timeout and failure metadata.
4. **Planning proposal contract** — structured objective/task/dependency/action proposals validated by the certified control plane.
5. **Agent execution state** — durable/resumable intelligence attempts linked to governed workflow/job state rather than hidden process memory.
6. **Decision/provenance records** — durable explanation of what was proposed, by which intelligence identity/model, under which policy context.
7. **Basic context assembly** — authorized context for an agent without bypassing organization or resource boundaries.
8. **Bounded agent loop** — observe → reason → propose → await governed result → interpret → continue/stop, with explicit limits.
9. **Approval integration** — translate policy outcomes into Owner approval requests without allowing self-approval.
10. **CEO result/report contract** — turn validated durable outcomes into an Owner-facing summary rather than raw logs.

### Later Phase 2

- dynamic employee lifecycle;
- department specialization and staffing policies;
- model routing optimization;
- durable company memory/knowledge retrieval;
- cost intelligence and budget accounting;
- multi-step QA orchestration;
- business/project management views;
- proactive company-state analysis;
- multi-business coordination;
- governed tool adapter framework.

### Future / post-Phase-2

- broad external integrations;
- autonomous external communication;
- unrestricted browser/computer operation;
- autonomous spending;
- autonomous contracts/legal commitments;
- public SaaS deployment;
- unrestricted internet access;
- general-purpose autonomous infrastructure administration.

## 7. Critical architectural finding

The repository is already a strong **execution/control-plane foundation**, but it is not yet the AI-operated company described by the operating model.

The largest gap is not another worker or another static agent definition. The missing center is a **governed intelligence-to-control-plane contract**: Owner intent must become a structured proposal, the proposal must be policy-checked, the certified control plane must create durable work, and validated results must return to the intelligence layer for bounded continuation.

That boundary is consistent with the existing Phase 2 architecture document: intelligence proposes; the certified control plane remains authoritative. fileciteturn1002file0

## 8. No implementation performed

This audit does not add model providers, integrations, MCP, n8n, browser/computer automation, Command Center UI, schema changes, worker changes or orchestration changes.
