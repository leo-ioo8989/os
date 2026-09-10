# LEO OS PROJECT STATE

**Product:** LEO OS — Leadership & Execution Operating System  
**Last updated:** 2026-09-10  
**Current version:** V1.07

## INTERNAL / PRIVATE STATUS
LEO OS is a private internal operating system intended to run the founder's company/workflows on a local/private environment. It is not currently a public SaaS product. No public deployment or external integration work is in scope.

## CURRENT PHASE
Phase 1 control-plane reliability, trusted execution infrastructure and durable workflow coordination.

## IMPLEMENTED
- V1.03 authentication, organization isolation and RBAC preserved.
- V1.04 repository boundaries, transactional mutations, durable audit/approval/workflow foundations preserved.
- V1.05 durable Job/Checkpoint execution boundary preserved.
- V1.06 trusted Worker identity, credentials, capabilities, Execution Gateway and fingerprint-bound Approval preserved.
- Explicit deterministic Workflow lifecycle: `PENDING → RUNNING → WAITING_APPROVAL / PAUSED / BLOCKED / FAILED / COMPLETED / CANCELLED`, with terminal-state protection.
- Durable Workflow `currentTaskId` + `currentJobId` pointers.
- Durable Job idempotency keys scoped by organization; repeated workflow job creation returns the existing durable job.
- Atomic Job `SUCCEEDED` → task completion → deterministic next-task selection → queued next Job / terminal Workflow state.
- Deterministic next-task policy: dependency readiness first, then stable task ID ordering because Task has no existing priority field.
- Retryable Job failures remain `RETRY_QUEUED` and keep the Workflow resumable; exhausted/permanent failures move the Workflow/Task to failed state.
- Durable approval blocking/resumption: `WAITING_APPROVAL` is persisted; approved work returns to `RETRY_QUEUED`; rejected work fails the Job/Workflow.
- Workflow cancellation atomically cancels executable child Jobs and nonterminal Tasks; terminal Workflows do not resume or create new work.
- Deterministic Workflow reconciliation reads persisted Workflow/Job/Approval state and repairs only proven-safe pointer/approval/terminal contradictions; ambiguous states are surfaced without guessing.
- Existing Checkpoint repository remains the resumable execution state boundary with organization, worker ownership and redaction protections.
- Existing AuditEvent system extended with workflow start/resume/task-selection/task-completion/blocked/failed/completed/reconciled events.
- Additive V1.07 Prisma migration; no compatibility identifiers renamed or existing tables/columns dropped.

## STATE OWNERSHIP
Workflow owns workflow lifecycle/current state/current task/current job. Job owns execution attempt/lease/retry/approval-blocked/resumable execution state. Task owns task/dependency state. Approval owns human authorization state and never executes actions. Checkpoint owns versioned resumable execution snapshots for a Job.

## IDEMPOTENCY / EXACTLY-ONCE BOUNDARY
LEO OS does **not** claim mathematically perfect exactly-once external execution. V1.07 provides practical control-plane idempotency: organization-scoped Job idempotency keys, explicit Workflow current-job pointers, serializable coordination transactions and deterministic transition rejection. Repeated completion/advancement processing either observes the existing durable result or is rejected as ambiguous/invalid.

## RECOVERY / RECONCILIATION
Restart recovery uses durable state rather than in-memory state. Expired active Job leases continue through the V1.05 stale-lease recovery path. Approval-blocked Jobs remain blocked until a durable approval resolution exists. A consumed approval with a waiting Job can be reconciled to `RETRY_QUEUED`. A succeeded current Job can safely drive Workflow advancement. Terminal Workflows cancel remaining executable Jobs during reconciliation. Ambiguous states, such as multiple Jobs for one current Task or an unresolved current-job pointer, are preserved and surfaced rather than guessed.

## SECURITY REVIEW
Reviewed for V1.07: cross-organization Workflow/Job IDs, forged parent IDs, duplicate transition/completion/advancement, duplicate Job creation, approval replay/mismatch, terminal Workflow/Job resurrection, unauthorized workflow advancement, suspended/revoked worker continuation, lease ownership bypass, checkpoint ownership and secret leakage. Organization predicates, worker lifecycle checks, deterministic state machines, serializable transactions, approval binding and existing recursive metadata redaction remain the security boundaries.

## DATABASE
V1.07 migration: `packages/db/prisma/migrations/20260910180000_v107_workflow_execution_coordination/migration.sql`. Additive changes: `Workflow.currentJobId`, `WorkflowStatus.BLOCKED`, organization-scoped `Job.idempotencyKey`, and corresponding indexes/unique constraint. **Migration application is NOT VERIFIED.**

## TESTED
- Added deterministic core tests for Workflow transitions, terminal protection, dependency-aware selection and stable task ordering.
- Existing V1.05/V1.06 test sources remain preserved.

## NOT VERIFIED
- Tests were NOT executed in this session.
- Prisma client generation is NOT VERIFIED after V1.07 schema changes.
- PostgreSQL connectivity and V1.07 migration application are NOT VERIFIED.
- Real serializable concurrency, duplicate completion races, approval replay races, lease races and restart behavior are NOT VERIFIED against a live database.
- End-to-end worker → Job → Execution Gateway → Approval → Workflow continuation is NOT VERIFIED.
- No successful CI run has been verified.

## BLOCKED / LIMITATIONS
Live PostgreSQL/Prisma verification remains unavailable in this session. Autonomous worker polling and external action execution remain intentionally absent. V1.07 is control-plane coordination only.

## NEXT DEPENDENCY
V1.07 should be reviewed and then verified against a runnable PostgreSQL/Prisma environment, including concurrency and end-to-end control-plane tests, before V1.08. Phase 2 integrations, AI providers, MCP and Command Center remain out of scope.

## STATUS VOCABULARY
IMPLEMENTED · CONNECTED · CONFIGURED · PENDING CREDENTIALS · PLANNED · BLOCKED · NOT VERIFIED

## COMPATIBILITY
Product identity remains LEO OS. Existing `@founder-os/*` package namespaces, historical migrations, database identifiers, storage identifiers and `founder_os_session` remain unchanged where renaming would create compatibility risk.
