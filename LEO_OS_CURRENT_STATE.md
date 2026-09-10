# LEO OS — CURRENT STATE

**Product:** LEO OS — Leadership & Execution Operating System  
**Audit date:** 2026-09-10  
**Repository:** `haeshitsa/firsy`  
**Branch:** `main`  
**Version target:** V1.07

## INTERNAL / PRIVATE STATUS
LEO OS is a private internal operating system intended to run the founder's company workflows on a local/private environment. It is not currently a public SaaS product. No public deployment, publishing or external integration work is part of scope.

## CURRENT ARCHITECTURE

```text
Objective → Workflow → Task / Dependency Graph → Durable Job
→ Trusted Worker → Execution Gateway → Approval when required
→ Job result / Checkpoint → Atomic Workflow advancement
→ Next durable Task/Job or terminal Workflow state → Audit
```

Phase 1 remains an incremental control plane: API → authentication/context → RBAC → service → repository → Prisma/PostgreSQL; worker → trusted identity → job service → repository → Prisma/PostgreSQL. Deterministic policies remain in `packages/core`.

## V1.07 IMPLEMENTED
- Explicit Workflow state machine: `PENDING`, `RUNNING`, `WAITING_APPROVAL`, `PAUSED`, `BLOCKED`, `COMPLETED`, `FAILED`, `CANCELLED`.
- Durable `currentTaskId` and `currentJobId` pointers; Workflow is authoritative for workflow position.
- Organization-scoped Job idempotency keys prevent duplicate workflow Job creation during repeated progression/restart processing.
- Job `SUCCEEDED` coordination atomically completes its Task, evaluates the dependency graph, selects the next task by dependency readiness then stable task ID, creates/gets the next queued Job, and persists the Workflow pointer.
- Retryable failures preserve a resumable Workflow; exhausted/permanent failures move the relevant Workflow/Task to failed state.
- Approval blocking/resumption is coordinated durably: Job `WAITING_APPROVAL` moves to `RETRY_QUEUED` after approval and the Workflow resumes; rejection fails the Job/Workflow.
- Workflow cancellation cancels remaining executable child Jobs and nonterminal Tasks atomically; terminal Workflows cannot generate new executable work.
- Deterministic reconciliation handles safe terminal-job, consumed-approval and missing-current-job-pointer repairs. Ambiguous states are returned without guessing.
- Existing Checkpoint persistence remains the resumable state boundary with worker ownership, organization isolation, version ordering and sensitive metadata redaction.
- Existing V1.06 Worker, WorkerCredential, Execution Gateway and Approval semantics are preserved.
- AuditEvent vocabulary now includes workflow started/resumed/task-selected/task-completed/blocked/failed/completed/reconciled events.

## STATE OWNERSHIP
- **Workflow:** authoritative for lifecycle, current state, current task and current job.
- **Job:** authoritative for execution attempt, lease, retry, approval-blocked and resumable execution state.
- **Task:** authoritative for task lifecycle and dependency semantics.
- **Approval:** authoritative for human authorization; it never executes work.
- **Checkpoint:** authoritative for versioned resumable execution snapshots for a Job.

## IDEMPOTENCY / EXACTLY-ONCE BOUNDARY
V1.07 does not claim mathematically perfect exactly-once external execution. It provides practical control-plane idempotency through organization-scoped Job idempotency keys, durable Workflow current-job pointers, serializable coordination transactions and deterministic transition rejection. Repeated completion/advancement processing either observes the existing durable state or returns an ambiguity/conflict result.

## RESTART / RECONCILIATION MODEL
Recovery is derived from durable Workflow + Job + Approval state. Expired active Jobs continue through V1.05 stale-lease recovery. Waiting approvals remain blocked until a durable approval decision exists. A consumed approval with a waiting Job can be reconciled to `RETRY_QUEUED`. A succeeded current Job can safely drive Workflow advancement. A terminal Workflow causes remaining executable Jobs to be cancelled during reconciliation. Multiple jobs for one current task, unresolved pointers and other ambiguous states are preserved and surfaced for human review.

## SECURITY REVIEW
V1.07 review covers cross-organization Workflow/Job IDs, forged parent IDs, duplicate transitions/completions/advancement, duplicate Job creation, approval replay/action mismatch, terminal Workflow/Job resurrection, unauthorized workflow advancement, suspended/revoked workers, lease ownership and checkpoint access, and secret leakage. Existing organization predicates, worker lifecycle checks, capability/Execution Gateway boundaries, approval binding, serializable transactions and recursive audit/checkpoint redaction remain in force.

## DATABASE
V1.07 migration `packages/db/prisma/migrations/20260910180000_v107_workflow_execution_coordination/migration.sql` is additive. It adds `WorkflowStatus.BLOCKED`, `Workflow.currentJobId`, `Job.idempotencyKey` and corresponding indexes/unique constraint. No historical `@founder-os/*`, `founder_os`, RBAC or `founder_os_session` compatibility identifiers were renamed. **Migration application is NOT VERIFIED.**

## TEST STATUS
**IMPLEMENTED:** deterministic Workflow state/selection tests plus existing V1.05/V1.06 tests.  
**NOT VERIFIED:** tests were not executed in this session; Prisma generation, PostgreSQL migration application, real concurrency, restart behavior, approval replay races and end-to-end Worker→Job→Gateway→Approval→Workflow runtime are not verified. No successful CI run has been established.

## BLOCKED / LIMITATIONS
Live PostgreSQL/Prisma verification is unavailable in this session. There is no autonomous worker polling loop, external action execution, AI agent, model provider or external integration in V1.07.

## NEXT DEPENDENCY
Review V1.07, then run it against a real PostgreSQL/Prisma environment with deterministic integration/concurrency/restart tests. Only after that review should V1.08 be considered.

## PHASE BOUNDARY
V1.07 does **not** implement AI agents, LLM/model providers, GitHub, Gmail, Instagram/Meta, Google Drive, Google Calendar, MCP, n8n, browser/computer use, external APIs, autonomous external actions or Command Center UI. V1.07 remains Phase 1 control-plane infrastructure.

## NAMING / COMPATIBILITY NOTES
Product identity is `LEO OS`. Existing `@founder-os/*` namespaces and historical database/migration identifiers remain compatibility identifiers and are intentionally not cosmetically renamed.
