# LEO OS — Phase 2 Slice #8
## Governed Delegation & Workforce Execution Boundary

**Status:** IMPLEMENTED — CERTIFICATION PENDING

## Objective

Slice #8 introduces the governed transition from workforce selection to an explicitly authorized worker and then into the **existing Phase 1 durable execution architecture**.

**Slice #8 does not create a second execution system.** The Phase 1 control plane remains the sole authoritative execution architecture.

## Authoritative architecture

```text
OWNER
  ↓
LEO
  ↓
OBJECTIVE / TASK GRAPH
  ↓
REQUIRED CAPABILITIES
  ↓
WORKFORCE SELECTION
  ↓
DELEGATION PROPOSAL (PROPOSAL_ONLY)
  ↓
CONTROL-PLANE AUTHORIZATION
  ↓
AUTHORIZED WORKER
  ↓
EXISTING PHASE 1 JOB
  ↓
EXISTING DISPATCHER
  ↓
EXISTING WORKER RUNTIME
  ↓
EXISTING EXECUTION GATEWAY
  ↓
EXISTING HANDLER
  ↓
RESULT VALIDATION
  ↓
QA
  ↓
TASK / JOB COMPLETION
```

No direct LEO → execute, model → execute, memory → execute, workforce registry → execute, proposal → execute, or provider → execute path is permitted.

## Architectural correction

The original Slice #8 core boundary contained a `GovernedDelegationExecutor` that directly invoked supplied worker behavior and stored completed outcomes in an in-memory idempotency map. That was a genuine boundary defect because it created a parallel execution state machine and a competing idempotency source of truth.

The corrected design removes that executor. Core now produces an `AuthorizedDelegationJobInput` containing the authoritative organization, task, existing control-plane worker identity, deterministic delegation idempotency key, and non-authoritative metadata.

`apps/worker/src/delegation-job-adapter.ts` is a thin integration adapter. It creates the existing Phase 1 `Job`, preserves `workerIdentityId` and the delegation idempotency key, then exposes the existing `JobDispatcher` and `WorkerRuntime`. It does not implement a second worker state machine, retry engine, lease manager, completion mechanism, or idempotency store.

## Delegation model

`DelegationProposal` binds organization, owner, task, selected role, required capabilities, capability contract, selected eligible provider/model metadata, risk, approval requirement, requested context, correlation and idempotency information.

Its authority is permanently `PROPOSAL_ONLY`.

The proposal contains no credential, worker identity, approval grant, permission grant, capability grant, execution command, dispatch authority, or external-action authority.

## Authorization transition

```text
DELEGATION PROPOSAL
        ↓
CONTROL-PLANE AUTHORIZATION
        ↓
EXISTING CONTROL-PLANE WORKER IDENTITY
        ↓
AUTHORIZED WORKER CONTRACT
        ↓
EXISTING PHASE 1 JOB
```

Authorization requires an explicit existing worker identity. The worker is not created as a permanent employee and the workforce registry does not become an execution authority.

Authorization preserves organization, role, capability, selected provider/model, context and risk bindings. HIGH requires approval; CRITICAL remains denied by the existing execution policy.

## Worker identity

`AuthorizedWorker` is an execution-instance contract bound to organization, task, delegation, role, capabilities, context, provider/model metadata and risk.

It is distinct from:

- employee identity
- workforce role
- provider identity
- model identity
- credential identity
- authorization itself

The actual durable worker identity used by execution is the existing Phase 1 control-plane worker identity referenced by `workerIdentityId` on the Job.

## Existing Job integration

`buildAuthorizedDelegationJobInput()` produces the exact information needed to create the existing Phase 1 Job:

- `organizationId`
- `taskId`
- `workerIdentityId`
- delegation `idempotencyKey`
- bounded delegation metadata

The existing `JobRepository.create()` remains responsible for durable creation, organization validation, worker binding and idempotent duplicate handling.

No Slice #8 durable job store is introduced.

## Dispatcher integration

`DelegationJobAdapter.dispatch()` delegates to the existing `JobDispatcher.dispatchNext()`.

The Phase 1 dispatcher remains responsible for queued/retry-queued job selection, organization scope, active-worker eligibility, deterministic ordering and atomic job claiming.

Slice #8 does not implement another dispatcher.

## WorkerRuntime integration

`DelegationJobAdapter.run()` delegates to the existing `WorkerRuntime.run()`.

The Phase 1 runtime remains responsible for:

- task/job validation
- worker authentication
- job claiming and leases
- handler validation
- execution authorization
- approval blocking/consumption
- heartbeat
- controlled handler execution
- result validation
- durable success/failure/retry state
- audit

Slice #8 does not directly invoke arbitrary worker behavior as an execution path.

## ExecutionGateway integration

The existing Phase 1 `ExecutionGateway` remains the authority for execution authorization. It verifies authenticated worker identity, organization, capability, risk, approval binding and execution fingerprint.

`APPROVAL REQUIRED ≠ APPROVAL GRANTED`.

Slice #8 cannot manufacture approval through LEO output, model output, workforce selection, memory, context or delegation proposal data.

## Handler boundary

Actual deterministic execution continues through the existing Phase 1 `ExecutionHandlerRegistry` and its controlled handlers. Unknown handlers, mismatched capabilities/risk, invalid input and invalid output are rejected.

No arbitrary shell, network, provider SDK, credential selection or external action is introduced.

## Model Runtime integration

Slice #8 reuses the provider/model metadata selected by Slice #7. It does not create a second model router.

Where model-backed reasoning/runtime is later connected, Slice #5 `ModelRuntime` remains the model boundary. Model output remains untrusted data and cannot authorize itself, change organization identity, grant permissions/capabilities, grant approval, select credentials, dispatch jobs or execute external actions.

## Result validation

Slice #8 retains the provider-neutral `WorkerResult` contract and validation helpers for delegation/result provenance. Actual durable job execution continues to use the Phase 1 handler result validation boundary before Job completion.

Malformed, unauthorized, cross-organization or provenance-mismatched results fail closed.

## QA

The Slice #8 core boundary represents QA outcomes as `PASS`, `REWORK`, or `ESCALATE` for governed result handling. QA does not bypass the durable Job state machine.

A failed or rework result cannot silently complete a task.

No autonomous QA swarm is introduced.

## Retry, reassignment and escalation

The previous parallel retry/reassignment loop has been removed from the core execution boundary.

Durable retry, bounded attempts, retry exhaustion, stale recovery, cancellation and terminal-state protection remain the responsibility of the existing Phase 1 Job/WorkerRuntime/Workflow machinery.

Reassignment is a governed future transition using the existing control-plane worker/job mechanisms; it cannot bypass capability, approval, risk or organization checks.

## Idempotency source of truth

The delegation proposal carries a deterministic idempotency key so that the delegation can map to a durable Job.

The **existing Phase 1 durable Job idempotency mechanism is the only source of truth for persisted execution idempotency**.

The removed Slice #8 in-memory outcome map is not replaced by another competing cache.

## Concurrency source of truth

Existing Phase 1 PostgreSQL transactions, serializable claim/transition operations, leases, stale recovery and terminal-state protections remain authoritative.

Slice #8 does not introduce another concurrency architecture.

## Organization isolation

Organization identity comes from authoritative control-plane context. Job creation validates organization ownership and worker identity binding; dispatcher and runtime remain organization-scoped.

Delegation, worker context and results must remain within the same organization. Model output and worker output cannot override organization identity.

## Capability enforcement

Slice #7 eligibility remains separate from authorization:

```text
TASK CAPABILITY
+
MODEL CAPABILITY
+
PROVIDER SUPPORTED CAPABILITY
        ↓
ELIGIBILITY
        ↓
DELEGATION PROPOSAL
        ↓
CONTROL-PLANE AUTHORIZATION
        ↓
EXECUTION
```

Capability matching does not grant authority.

## Risk semantics

Risk is copied from authoritative task/delegation state and cannot be silently downgraded.

Existing Phase 1 execution policy remains authoritative: LOW/MEDIUM may be allowed when policy and capability permit, HIGH requires appropriate approval, and CRITICAL remains denied.

## Audit boundary

The durable Phase 1 audit infrastructure remains the source of truth for execution events, including Job creation, claim, start, approval blocking/consumption, success/failure, retry scheduling, stale recovery and terminal transitions.

Slice #8 adds no competing audit store.

## Security invariants

- EMPLOYEE ≠ WORKER
- ROLE ≠ WORKER
- CAPABILITY ≠ AUTHORITY
- PROVIDER ≠ AUTHORIZED EXECUTOR
- MODEL ≠ WORKER
- WORKFORCE SELECTION ≠ AUTHORIZATION
- AUTHORIZATION ≠ EXECUTION
- PROPOSAL ≠ APPROVAL
- APPROVAL REQUIRED ≠ APPROVAL GRANTED
- MODEL OUTPUT ≠ AUTHORITY
- MEMORY ≠ AUTHORITY
- CONTEXT ≠ AUTHORITY
- LEO DOES NOT DIRECTLY EXECUTE

## Files changed by the correction

- `packages/core/src/delegation.ts`
- `packages/core/test/delegation.test.ts`
- `apps/worker/src/delegation-job-adapter.ts`
- `apps/worker/src/index.ts`
- this boundary document

No Phase 1 database schema or migration was changed.

## Schema status

No Prisma schema or migration is required. Existing durable `Job`, `Worker`, workflow, approval and audit structures are sufficient for the corrected boundary.

## External dependency status

No real model provider, provider SDK, API key, credential store, network client, billing, MCP, n8n, Gmail, GitHub, Instagram, WhatsApp, browser automation, payment or external execution dependency is introduced.

## Known limitations

1. Workforce registry metadata remains provider-neutral and in-memory as defined by Slice #7.
2. The corrected Slice #8 core package does not own durable execution state; the existing Phase 1 control plane does.
3. The deterministic worker remains a local result fixture. Actual deterministic execution uses existing Phase 1 controlled handlers.
4. QA remains minimal and governed rather than an autonomous QA system.
5. Reassignment is represented as a governed boundary and must use existing durable worker/job mechanisms.
6. Real model providers and external tools remain outside Slice #8.

## Explicit future boundaries

Slice #8 does **not** implement Slice #9, autonomous 24/7 company operation, real provider integrations, external tools, Command Center, autonomous spending, external communication, production deployment automation, or dynamic real-world hiring.

**SLICE #7 CERTIFICATION STATUS:** independent current-state verification required; this document does not certify Slice #7.
