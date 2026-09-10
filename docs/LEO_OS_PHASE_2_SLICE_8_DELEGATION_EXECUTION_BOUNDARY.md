# LEO OS — Phase 2 Slice #8
## Governed Delegation & Workforce Execution Boundary

**Status:** IMPLEMENTATION — CERTIFICATION PENDING

## Objective

Slice #8 introduces the governed transition from workforce selection to an explicitly authorized worker and controlled, validated execution. It does not create a second execution architecture. The Phase 1 control plane remains authoritative.

## Architecture

```text
OWNER
  ↓
LEO
  ↓
OBJECTIVE / TASK
  ↓
WORKFORCE SELECTION
  ↓
DELEGATION PROPOSAL (PROPOSAL_ONLY)
  ↓
CONTROL-PLANE AUTHORIZATION
  ↓
AUTHORIZED WORKER
  ↓
AUTHORIZED CONTEXT
  ↓
MODEL RUNTIME / DETERMINISTIC TEST WORKER
  ↓
WORK RESULT
  ↓
RESULT VALIDATION
  ↓
QA
  ↓
PASS → TASK COMPLETION
  ├→ REWORK / RETRY
  ├→ REASSIGN
  └→ ESCALATE
```

There is no permitted direct path from LEO, model output, memory, workforce registry, provider/model selection, or proposal data to execution.

## Delegation model

`DelegationProposal` binds organization, owner, task, selected role, required capability, capability contract, selected eligible provider/model metadata, risk, approval requirement, requested context, correlation and idempotency information. Its authority is permanently `PROPOSAL_ONLY`.

The proposal contains no credential, worker identity, approval grant, permission grant, capability grant, execution command, dispatch authority, or external-action authority.

## Authorization transition

The explicit transition is:

```text
DELEGATION PROPOSAL
        ↓
CONTROL-PLANE AUTHORIZATION
        ↓
AUTHORIZED WORKER
```

Authorization verifies organization binding, role/capability binding, selected provider/model, context scope, approval state, and execution risk using the existing `decideExecution` policy. HIGH risk requires valid approval; CRITICAL remains denied. Authorization is not implied by workforce selection.

## Worker identity

An `AuthorizedWorker` is an execution instance, not a permanent employee. It is bound to organization, task, delegation, role, authorized capabilities, authorized context, provider/model metadata and risk. Its lifecycle is represented by governed states such as `AUTHORIZED`, `RUNNING`, `RETRYING`, `SUCCEEDED`, `FAILED`, `REASSIGNED`, `ESCALATED`, `CANCELLED`, and `EXPIRED`.

A worker does not receive credentials or permanent employee authority.

## Execution boundary

The core executor accepts an already authorized worker and an explicit worker implementation. It refuses execution from non-authorized/non-retrying worker states, checks all identity bindings, enforces the authorized context, validates results before success, and uses bounded attempts.

The deterministic worker is test/runtime infrastructure only. It has no network, provider SDK, credential, billing, external tool, shell, or arbitrary execution dependency.

Existing Phase 1 `WorkerRuntime`, dispatcher, execution gateway, handler registry, job repository, lease/recovery and workflow/job state machinery remain the authoritative durable execution path. Slice #8 does not duplicate those control-plane primitives.

## Model runtime integration

Slice #8 carries the provider/model selected by Slice #7 as metadata on the authorized worker. Real providers are not added. Where model-backed execution is wired, the existing Slice #5 `ModelRuntime` remains the model routing/runtime boundary; model output remains untrusted data and cannot authorize or execute itself.

## Result validation

`WorkerResult` is bound to worker, organization, task and delegation identity and carries provider/model provenance and timestamps. Successful results cannot contain failure metadata; failed results require structured failure metadata. Provenance or identity mismatch fails closed.

## QA

QA is deterministic and bounded. Decisions are `PASS`, `REWORK`, or `ESCALATE`. A failed or rework result does not silently complete the task. Rework may consume a bounded retry budget; unresolved work can be reassigned or escalated according to policy.

No autonomous QA swarm is introduced.

## Failure, retry, reassignment, escalation

Retry is bounded by `maxAttempts`. Retryable worker failures may retry. When the retry budget is exhausted, the executor can produce `REASSIGNED` when reassignment is permitted, otherwise it can escalate or fail according to policy. There is no infinite retry loop.

## Idempotency

The executor maintains a deterministic idempotency key on the delegation proposal and returns the existing completed outcome for duplicate requests in the same executor instance. The durable Phase 1 job idempotency mechanism remains authoritative for persisted execution; this core boundary does not replace it.

## Concurrency and terminal-state protection

Terminal workers cannot be executed again. Durable concurrency, leases, stale recovery and terminal-state protection continue to be enforced by Phase 1 control-plane infrastructure rather than a parallel Slice #8 state machine.

## Organization isolation

Organization identity is authoritative from the control-plane context and proposal. Delegation, authorization, worker and result bindings are checked against the same organization. A worker cannot expand context into another organization or project.

Model output cannot define or override organization identity.

## Approval semantics

`APPROVAL REQUIRED ≠ APPROVAL GRANTED`.

The delegation proposal can only recommend/request approval. Authorization requires an actual approval signal when required. LEO output, model output, memory, workforce selection, or delegation proposal cannot manufacture approval.

## Risk semantics

Risk is copied from the task/proposal and is never silently downgraded. Existing `decideExecution` semantics remain authoritative: LOW/MEDIUM can be allowed when capability/policy permit, HIGH requires valid approval, and CRITICAL is denied.

## Audit boundary

Slice #8 exposes the authority transitions that must be audited: proposal, authorization, worker creation, execution start/result, validation, QA, retry, reassignment, escalation and terminal outcome. Durable audit remains the existing Phase 1 audit infrastructure; no competing audit store is introduced here.

## Security invariants

- EMPLOYEE ≠ WORKER
- ROLE ≠ WORKER
- CAPABILITY ≠ AUTHORITY
- PROVIDER ≠ WORKER
- MODEL ≠ WORKER
- WORKFORCE SELECTION ≠ AUTHORIZATION
- AUTHORIZATION ≠ EXECUTION
- PROPOSAL ≠ APPROVAL
- APPROVAL REQUIRED ≠ APPROVAL GRANTED
- MODEL OUTPUT ≠ COMMAND
- MODEL OUTPUT ≠ AUTHORITY
- MEMORY ≠ AUTHORITY
- CONTEXT ≠ AUTHORITY
- LEO DOES NOT DIRECTLY EXECUTE

## Files changed

- `packages/core/src/delegation.ts`
- `packages/core/src/index.ts`
- `packages/core/test/delegation.test.ts`
- `docs/LEO_OS_PHASE_2_SLICE_8_DELEGATION_EXECUTION_BOUNDARY.md`

## Schema status

No Prisma schema or migration was added. The Slice #8 core boundary uses existing Phase 1 durable job/worker/workflow/approval infrastructure and adds provider-neutral delegation contracts in `packages/core`.

## Dependencies

No real model provider, SDK, API key, secret, network client, billing integration, MCP, n8n, external API, Gmail, GitHub, Instagram, WhatsApp, browser automation, or payment dependency was added.

## Known limitations

1. The new delegation contracts are provider-neutral core primitives; durable persistence remains in existing Phase 1 control-plane services.
2. The deterministic worker is a local test/runtime fixture, not a real AI provider.
3. The core executor's in-memory idempotency cache is intentionally not a replacement for durable Phase 1 job idempotency.
4. QA is deterministic and minimal; it does not implement autonomous QA agents.
5. Real provider execution and external tools remain out of scope.
6. Durable workflow advancement and audit persistence continue through existing Phase 1 services.

## Explicit future boundaries

Slice #8 does **not** implement Slice #9, autonomous 24/7 company operation, real provider integrations, external tools, Command Center, autonomous spending, external communication, production deployment automation, or dynamic real-world hiring.

**SLICE #7 CERTIFICATION STATUS:** must be independently verified; this document does not mark Slice #7 certified.
