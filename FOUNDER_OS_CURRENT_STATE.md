# FOUNDER OS — CURRENT STATE

**Audit date:** 2026-09-10  
**Repository:** `haeshitsa/firsy`  
**Branch:** `main`  
**Version target:** V1.04

## CURRENT ARCHITECTURE

Founder OS remains an incremental Phase 1 control plane. The persistence boundary is now:

API → authentication/context → RBAC → service → repository → Prisma/PostgreSQL.

Deterministic objective/task/dependency rules remain in `packages/core`. Repository mutations use serializable Prisma transactions where a control-plane mutation must atomically persist state plus its audit event.

## IMPLEMENTED

- Existing V1.03 authentication, organization context and RBAC preserved.
- Dedicated `ControlPlaneRepository` for Objective/Task/Dependency persistence.
- Serializable transaction boundary for important Objective/Task/Dependency mutations.
- Mutation + audit-event atomicity for repository-backed control-plane writes.
- Typed audit event vocabulary and persistent `AuditEvent` model.
- Organization-scoped audit indexes and foreign keys.
- Recursive audit metadata redaction for credential-like keys.
- Persistent `Approval` model and repository with lifecycle transitions.
- Organization-scoped approval service foundation with existing RBAC checks and requester self-approval prevention.
- Persistent `Workflow` model and repository with resumable state, retry count, failure fields and lifecycle transitions.
- Additive V1.04 Prisma migration for audit, approval and workflow persistence.
- V1.04 invariant tests for approval transitions, workflow transitions and audit redaction.

## TRANSACTION BOUNDARIES

- Objective create/update/status/delete: state mutation and corresponding audit event are one serializable transaction.
- Task create/update/status/delete: state mutation and corresponding audit event are one serializable transaction.
- Dependency add/remove: relationship mutation and audit event are one serializable transaction; dependency creation performs the existing `packages/core` graph validation inside that transaction before insert.
- Approval create/decision: approval state and audit event are one serializable transaction.
- Workflow create/update: workflow state and audit event are one serializable transaction.

Pre-read authorization and domain validation remain above the repository. Database-scoped predicates are retained on mutations to reduce IDOR/TOCTOU exposure.

## AUDIT

Audit events are organization-scoped and include actor type, event type, resource, action, result and safe metadata. Event vocabulary is centralized in `packages/db/src/audit.ts`. Passwords, tokens, secrets, API keys, credentials, cookies and private-key-like fields are redacted from audit metadata.

## APPROVALS

Statuses: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
Only `PENDING` approvals can transition. Expired pending approvals are persisted as `EXPIRED`. The service requires the existing `approval:decide` permission for decisions and rejects requester self-approval.

This is persistence/control logic only; there is no Approval Center UI and no external action execution.

## WORKFLOW STATE

Statuses: `PENDING`, `RUNNING`, `WAITING_APPROVAL`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`.
Workflow records retain current state/task, resumable JSON state, retry count, failure information and timestamps. This is a durable state foundation, not an autonomous orchestrator.

## DATABASE INTEGRITY

The V1.04 migration is additive. Existing foreign keys and organization indexes are preserved; new AuditEvent, Approval and Workflow tables use organization foreign keys with restrictive organization deletion behavior. Composite approval/dependency uniqueness and existing relationship constraints remain database-enforced.

## TEST STATUS

**IMPLEMENTED:** V1.04 repository/domain-foundation tests were added.  
**NOT VERIFIED:** tests were not executed from this session because no repository shell/Prisma runtime or verified CI execution is available. Live PostgreSQL connectivity, Prisma generation, migration application and integration tests remain unverified.

## SECURITY REVIEW

- Organization IDs remain derived from authenticated membership; repositories require explicit organization scope.
- Approval reads/writes are organization-scoped at the service/repository boundary.
- Approval decisions require the existing RBAC permission and cannot be made by the requester.
- Audit records are append-only through repository APIs; no public audit mutation API exists.
- Audit metadata is sanitized for credential-like fields.
- Dependency graph validation remains in `packages/core`; it is not duplicated in the database/API.
- Serializable transactions reduce concurrent dependency/state race risk, but live concurrency behavior is **NOT VERIFIED** until PostgreSQL execution is available.
- No external integrations or AI execution were introduced.

## REMAINING LIMITATIONS / TECHNICAL DEBT

- Prisma client generation and live migrations are not verified.
- Repository integration tests against PostgreSQL are not verified.
- Status policies still exist in the API service and should eventually move into a shared deterministic domain policy in `packages/core`.
- Authentication security-event audit coverage is not yet wired into the request path.
- Approval/workflow persistence has no public API surface yet; it is intentionally a backend foundation for the next control-plane step.
- Retry/idempotency keys for external durable jobs are not yet implemented because external execution is out of scope for V1.04.

## NEXT PRIORITY

Add durable audit/security-event coverage to the authenticated API and then establish the persistent job/workflow execution boundary needed for restart-safe orchestration. Do not begin external integrations or model/agent execution yet.

## STATUS VOCABULARY

IMPLEMENTED · CONNECTED · CONFIGURED · PENDING CREDENTIALS · PLANNED · BLOCKED · NOT VERIFIED

No external service is marked CONNECTED merely because adapter code exists.
