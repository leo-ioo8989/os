# LEO OS — Phase 2 Slice #8
## Governed Delegation & Workforce Execution Boundary

**Status:** ARCHITECTURAL CORRECTION — CERTIFICATION PENDING

## Objective

Slice #8 defines the governed transition from workforce selection to a delegation proposal and then into the **existing Phase 1 durable execution architecture**.

**Slice #8 is not an authorization authority and does not create a second execution system.**

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
EXISTING CONTROL-PLANE WORKER IDENTITY
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
EXISTING RESULT VALIDATION
  ↓
DURABLE COMPLETION
```

No direct LEO → execute, model → execute, memory → execute, workforce registry → execute, proposal → execute, or provider → execute path is permitted.

## Architectural correction

The pre-correction Slice #8 core contained `authorizeDelegation()` and `createAuthorizedWorker()`. Those functions allowed the delegation package to construct authorization-bearing state and an `AUTHORIZED` worker contract from an agent-supplied `approvalGranted` value.

Those APIs have been removed from the core boundary.

The corrected core produces a `ControlPlaneWorkerBinding` as **input data supplied by the authoritative control-plane worker identity boundary**. Core validates that the binding matches the delegation requirements but does not create, activate, approve, or authorize the worker.

The authoritative execution authorization remains the existing Phase 1 `ExecutionGateway`, reached by `WorkerRuntime`. Approval state is represented by the existing control-plane approval system and approval fingerprints/consumption remain authoritative there.

## Delegation model

`DelegationProposal` binds organization, owner, task, selected role, required capabilities, capability contract, selected eligible provider/model metadata, risk, approval requirement, requested context, correlation and idempotency information.

Its authority is permanently `PROPOSAL_ONLY`.

The proposal contains no credential, worker identity, approval grant, permission grant, capability grant, execution command, dispatch authority, or external-action authority.

## Worker identity boundary

Slice #8 does not construct an authoritative worker.

`ControlPlaneWorkerBinding` is a data contract describing an **already existing** worker identity and its task/delegation binding. It is supplied to the durable execution adapter; it does not activate the worker or grant authorization.

The authoritative durable worker identity remains the Phase 1 `Worker` record. Worker creation, status, credential lifecycle and authentication remain in `WorkerRepository`/control-plane services.

The distinction remains:

```text
WORKFORCE ROLE
    ≠
WORKFORCE SELECTION
    ≠
CONTROL-PLANE WORKER IDENTITY
    ≠
EXECUTION AUTHORIZATION
```

## Approval boundary

`approvalRequired` is proposal metadata only.

There is no Slice #8 `approvalGranted` input and no Slice #8 approval grant operation.

For execution, `WorkerRuntime` invokes the existing `ExecutionGateway` with the real worker credential and optional authoritative approval reference. The gateway remains responsible for worker authentication, capability checks, risk evaluation, approval binding/fingerprint validation and approval consumption.

Therefore:

```text
APPROVAL REQUIRED ≠ APPROVAL GRANTED
PROPOSAL ASSERTION ≠ AUTHORITATIVE APPROVAL
```

HIGH-risk execution remains approval-gated and CRITICAL remains fail-closed by the existing Phase 1 execution policy.

## Existing Job integration

`buildDelegationJobInput()` produces only the information needed by the existing Phase 1 Job layer:

- `organizationId`
- `taskId`
- `workerIdentityId`
- deterministic delegation `idempotencyKey`
- bounded delegation metadata

The function performs binding validation only. It does not execute or authorize.

`DelegationJobAdapter.enqueue()` then calls `JobService.create()`, which calls the durable `JobRepository.create()`.

The existing `JobRepository` remains responsible for durable creation, organization validation, worker binding and durable idempotency.

No Slice #8 job store or in-memory execution-idempotency authority exists.

## Real delegation → execution integration

`DelegationJobAdapter.executeDelegation()` is the Slice #8 production integration boundary.

Its call path is:

```text
DelegationProposal
      ↓
ControlPlaneWorkerBinding
      ↓
DelegationJobAdapter.executeDelegation()
      ↓
buildDelegationJobInput()
      ↓
JobService.create()
      ↓
JobRepository.create()
      ↓
JobDispatcher.dispatchNext()
      ↓
JobService.claim()
      ↓
WorkerRuntime.run()
      ↓
Worker authentication / claim
      ↓
ExecutionGateway authorization
      ↓
existing ExecutionHandlerRegistry handler
      ↓
validateHandlerResult()
      ↓
JobService.succeed()/fail()
      ↓
JobRepository durable completion
```

No alternative execution path is introduced by Slice #8.

## Dispatcher

`DelegationJobAdapter.dispatch()` delegates to the existing `JobDispatcher.dispatchNext()`.

The Phase 1 dispatcher remains responsible for queued/retry-queued job selection, organization scope, active-worker eligibility, deterministic ordering and atomic claiming.

Slice #8 does not implement another dispatcher.

## WorkerRuntime

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

Slice #8 does not directly execute arbitrary worker functions in production.

## ExecutionGateway

The existing Phase 1 `ExecutionGateway` is the sole execution authorization boundary.

It verifies authenticated worker identity, organization, capability, risk, approval binding/fingerprint and execution policy before controlled handler execution.

Slice #8 cannot manufacture approval, grant permissions/capabilities, create credentials, or bypass the gateway.

## Handler boundary

Actual deterministic execution continues through the existing Phase 1 `ExecutionHandlerRegistry` and controlled handlers.

Unknown handlers, mismatched capabilities/risk, invalid input and invalid output are rejected.

No arbitrary shell, network, provider SDK, external action or credential-selection path is introduced.

## Result validation and QA

The Phase 1 handler result validator remains authoritative for durable Job success/failure.

Slice #8 retains provider-neutral `WorkerResult` provenance validation and `validateQA()` for governed result interpretation. These helpers do not mutate Job state and do not grant authority.

QA decisions remain:

```text
PASS
REWORK
ESCALATE
```

A QA decision is not an authorization decision.

Full durable QA-driven rework/escalation orchestration is not invented by Slice #8 where no existing Phase 1 lifecycle exists; such behavior must use the authoritative workflow/job machinery in a later approved boundary.

## Retry, reassignment and recovery

Slice #8 does not own a retry or recovery state machine.

Durable retry, bounded attempts, stale lease recovery, heartbeat, cancellation and terminal-state protection remain the existing Phase 1 Job/WorkerRuntime/Workflow responsibility.

Reassignment is not implemented as a competing local lifecycle. Where reassignment is required, the worker/job must be changed through the authoritative control-plane mechanisms and then re-enter the same durable execution path.

## Idempotency

The delegation proposal carries a deterministic organization-bound idempotency key.

`DelegationJobAdapter.enqueue()` passes that key to `JobService.create()` and `JobRepository.create()`.

The existing PostgreSQL durable Job uniqueness/transaction mechanism is the **only execution idempotency source of truth**.

No Slice #8 Map, Set, process-local outcome store, or execution cache is authoritative.

## Organization isolation

Organization identity is authoritative outside the delegation proposal.

The delegation proposal, control-plane worker binding, durable Job, dispatcher, WorkerRuntime and ExecutionGateway all require same-organization bindings.

Cross-organization worker, job, capability or execution access must fail closed.

## Slice #7 compatibility

Slice #7 remains a workforce metadata and eligibility boundary:

```text
ROLE
 ↓
CAPABILITY
 ↓
PROVIDER / MODEL ELIGIBILITY
 ↓
WORKFORCE SELECTION PROPOSAL
 ↓
STOP
```

Slice #7 does not execute, authorize, grant credentials, grant permissions or grant capabilities.

## Security invariants

- CONTROL PLANE > AGENT
- POLICY > MODEL OUTPUT
- APPROVAL > AGENT INTENT
- AUDIT > ASSUMPTION
- DURABILITY > IN-MEMORY STATE
- EXPLICIT AUTHORITY > IMPLICIT TRUST
- FAIL CLOSED FOR HIGH-RISK ACTIONS
- MODEL SELECTION ≠ AUTHORIZATION
- MODEL CAPABILITY ≠ PERMISSION
- MODEL OUTPUT ≠ COMMAND
- WORKFORCE SELECTION ≠ AUTHORIZATION
- DELEGATION ≠ EXECUTION AUTHORITY
- PROPOSAL ≠ EXECUTION
- APPROVAL REQUIRED ≠ APPROVAL GRANTED
- LEO DOES NOT DIRECTLY EXECUTE

## Files changed by this correction

- `packages/core/src/delegation.ts`
- `packages/core/test/delegation.test.ts`
- `apps/worker/src/delegation-job-adapter.ts`
- `apps/worker/test/v208-delegation-execution.test.ts`
- this boundary document

No Prisma schema or migration was changed.

## External dependency status

No real model provider, provider SDK, API key, network client, billing, MCP, n8n, Gmail, GitHub, Instagram, WhatsApp, browser automation, payment or external execution dependency is introduced.

## Verification status

Certification remains pending until the corrected implementation passes focused tests, Phase 1 regression, Phase 2 compatibility checks, and the official certification workflow.

Green CI alone is not treated as architectural proof.

## Known limitations

1. Slice #7 workforce/provider metadata remains in-memory and provider-neutral as previously defined.
2. Slice #8 does not own durable worker identity or execution authorization.
3. The deterministic worker in core remains a test-only result fixture; production execution uses existing Phase 1 controlled handlers.
4. QA remains a governed result boundary, not a second completion state machine.
5. Reassignment/escalation is not implemented as a parallel execution lifecycle.
6. Real model providers and external tools remain outside Slice #8.
7. Task/workflow progression is performed by the existing Phase 1 workflow machinery when the Job has a workflow binding; the Slice #8 adapter does not invent a separate progression engine.

## Explicit future boundaries

Slice #8 does **not** implement Slice #9, autonomous 24/7 company operation, real provider integrations, external tools, Command Center, autonomous spending, external communication, production deployment automation, or dynamic real-world hiring.
