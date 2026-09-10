# FOUNDER OS PROJECT STATE

**Last updated:** 2026-09-10  
**Current version:** V1.05

## CURRENT PHASE
Phase 1 control-plane reliability: durable audit/security coverage → persistent worker/job boundary → restart-safe state.

## IMPLEMENTED
- V1.03 authentication, organization isolation and RBAC preserved.
- V1.04 repository boundaries, transactional mutations, durable audit/approval/workflow foundations preserved.
- Deterministic job lifecycle policy added to `packages/core`.
- Persistent Job and Checkpoint models added with additive Prisma migration.
- `JobRepository` provides organization-scoped job access, atomic claiming, worker leases, heartbeats, transitions, failure/retry persistence, stale-lease recovery and checkpoints.
- `JobService` provides the worker-facing service boundary; worker code does not access Prisma directly.
- Job creation validates optional objective/task/workflow relationships against the same organization.
- Job/checkpoint/audit metadata is sanitized for credential-like keys.
- Worker lifecycle audit events use the existing durable AuditEvent system.
- Job attempt count and maximum attempts prevent infinite retry loops.
- Terminal job states cannot resume through the deterministic core policy.
- Worker entrypoint remains a minimal persistence-boundary process; no autonomous execution loop was introduced.
- External integrations, AI providers and Command Center remain untouched.

## JOB STATE MACHINE
`QUEUED → CLAIMED → RUNNING → SUCCEEDED`.
Failure: `CLAIMED/RUNNING → RETRY_QUEUED` when retryable and attempts remain; otherwise `FAILED`.
Queued/active work may be cancelled according to the repository transition boundary. `SUCCEEDED`, `FAILED`, `CANCELLED` are terminal.

## WORKER / LEASE DESIGN
Claim occurs inside a serializable transaction and atomically assigns `workerId`, increments `attemptNumber`, records heartbeat and sets `leaseExpiresAt`. Heartbeats require the same worker identity and a live lease. Expired active leases can be recovered deterministically into `RETRY_QUEUED` or `FAILED` according to attempt limits.

## CHECKPOINT / RESUMPTION DESIGN
Checkpoints are versioned per job with a database uniqueness constraint on `(jobId, version)`. The checkpoint and job resumable state update are atomic with their audit event. Only the current worker owning an active lease may checkpoint. A future worker can reconstruct resumable state from the job plus latest checkpoint; terminal jobs are not resumable.

## RETRY / FAILURE POLICY
Attempts increment on claim. Default maximum attempts is 3. Retryable failures schedule immediate eligibility via `nextRetryAt`; permanent failures or exhausted attempts become terminal `FAILED`. Failure code/message/retryability are persisted without credentials. No arbitrary exponential backoff or infinite retry loop exists.

## AUDIT
Audit vocabulary now includes job creation, claim, start, checkpoint, failure, retry scheduling, resume, success, cancellation and stale-lease recovery. Security events already have centralized vocabulary. Authentication failures without trusted organization context are not force-written to organization audit rows, avoiding attacker-controlled organization attribution.

## TESTED
- Test source added for job lifecycle transitions, retry exhaustion, terminal-state protection and credential redaction.

## NOT VERIFIED
- Tests were NOT executed in this session.
- Prisma client generation is NOT VERIFIED.
- PostgreSQL connectivity and migration application are NOT VERIFIED.
- Real repository CRUD, transaction rollback and concurrent worker-claim behavior are NOT VERIFIED.
- No successful GitHub Actions CI run has been verified.

## SECURITY REVIEW
- Job reads/mutations require organization predicates.
- Optional parent objective/task/workflow references are verified within the same organization before job creation.
- Worker ownership is required for heartbeat, active transition, failure and checkpoint operations.
- Stale lease recovery is serialized and requires an actually expired lease.
- Checkpoint version duplication is database-protected.
- Audit/checkpoint metadata redacts credential-like fields.
- No public job API or external execution capability was added, limiting current attack surface.
- Worker identity is not yet cryptographically authenticated; that is required before untrusted workers are allowed to execute privileged work.
- Serializable concurrency behavior remains NOT VERIFIED without PostgreSQL execution.

## BLOCKED / NOT VERIFIED
- Nothing in the V1.05 code boundary is intentionally blocked.
- Live database verification is NOT VERIFIED because a runnable PostgreSQL/Prisma environment is unavailable in this session.
- External integrations remain PENDING CREDENTIALS/PLANNED and intentionally untouched.

## REMAINING TECHNICAL DEBT
- Add API-level job endpoints only after defining their RBAC contract.
- Add authenticated worker identity/attestation before privileged execution.
- Add durable idempotency keys when an actual execution command/event contract exists.
- Add a recovery/polling loop only when the durable execution/orchestrator phase begins.
- Eventually centralize all status policies in `packages/core`.

## NEXT PRIORITY
Harden trusted security-event recording where an organization context exists, then establish the privileged execution/approval gateway and workflow-to-job coordination boundary. Keep AI execution, external integrations and Command Center out of scope.

## NEXT AUTOMATIC STEP
Review and implement trusted API security-event persistence and the control-plane gateway boundary for future execution, without enabling autonomous or external actions.

## STATUS VOCABULARY
IMPLEMENTED · CONNECTED · CONFIGURED · PENDING CREDENTIALS · PLANNED · BLOCKED · NOT VERIFIED
