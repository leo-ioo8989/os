# FOUNDER OS — CURRENT STATE

**Audit date:** 2026-09-10
**Repository:** `haeshitsa/firsy`
**Branch:** `main`
**Version target:** V1.03

## CURRENT ARCHITECTURE

Founder OS is being evolved incrementally from the V0.1 foundation. The control plane now has PostgreSQL/Prisma persistence for organizations, users, memberships, sessions, objectives, tasks and dependencies. The API boundary resolves persistent sessions, organization membership and the shared core RBAC matrix before calling organization-scoped control-plane services.

Current flow:
Founder → authenticated API context → organization membership/RBAC → control-plane service → Prisma/PostgreSQL.

## IMPLEMENTED

- Strict TypeScript monorepo foundation.
- Deterministic GREEN/YELLOW/RED permission primitive.
- Objective and task domain contracts.
- Deterministic dependency graph validation, cycle detection, ready/blocked analysis and execution-wave discovery.
- Common 21-agent registry.
- PostgreSQL/Prisma control-plane schema and migration foundation.
- Persistent User, Membership and Session models.
- Existing scrypt password hashing and SHA-256 session-token hashing preserved.
- Session authentication for Bearer tokens and the `founder_os_session` cookie.
- Reusable authenticated organization context and shared RBAC enforcement.
- Organization-scoped Objective API: create, list, retrieve, update, status transition and delete.
- Organization-scoped Task API: create, list, retrieve, update, status transition and delete.
- Task dependency API with existing `packages/core` graph validation for self, duplicate, missing-reference and cycle rejection.
- Bounded JSON request parsing and non-sensitive consistent API error responses.
- Agent assignment validation against the existing agent registry.
- API/core/db TypeScript test-runner configuration.
- Authentication/RBAC and dependency test suites added.

## NOT VERIFIED

- PostgreSQL connectivity, Prisma client generation and migrations have not been executed in a live environment from this session.
- API integration tests against a real PostgreSQL database have not been executed.
- GitHub Actions has not provided a verified successful CI run in this session.
- Runtime production deployment, TLS, rate limiting and infrastructure secret management are not verified.

## SECURITY BOUNDARIES

- Organization ownership is derived from authenticated membership, never from an objective/task payload.
- Resource queries include organization scope; task resources additionally scope through their parent objective.
- A supplied organization header is only a selector among organizations the authenticated user actually belongs to.
- Multiple memberships require explicit selection; an unrecognized organization is rejected.
- Roles are checked through the existing core permission matrix rather than endpoint-specific ad hoc role logic.
- Authentication failures do not reveal whether a session exists.
- API errors do not expose database errors, stack traces, credentials or tokens.
- Dependency writes validate the complete graph before persistence.

## API SURFACE

- `GET /health`
- `GET /v1/objectives`
- `POST /v1/objectives`
- `GET /v1/objectives/:objectiveId`
- `PATCH /v1/objectives/:objectiveId`
- `DELETE /v1/objectives/:objectiveId`
- `POST /v1/objectives/:objectiveId/status`
- `GET /v1/objectives/:objectiveId/tasks`
- `POST /v1/objectives/:objectiveId/tasks`
- `GET /v1/tasks/:taskId`
- `PATCH /v1/tasks/:taskId`
- `DELETE /v1/tasks/:taskId`
- `POST /v1/tasks/:taskId/status`
- `POST /v1/tasks/:taskId/dependencies`
- `DELETE /v1/tasks/:taskId/dependencies/:dependencyId`

## RBAC

- FOUNDER: full existing permission matrix.
- ADMIN: administrative/project permissions defined by the existing matrix; no founder-control permission.
- OPERATOR: execution-oriented objective/task/workflow/tool permissions defined by the existing matrix.
- VIEWER: read-only objective/task/audit permissions defined by the existing matrix.

No new role or permission category was invented for V1.03.

## REMAINING LIMITATIONS

- API service code currently sits in `apps/api/src/control-plane.ts`; a dedicated repository boundary should be introduced before the API grows further.
- Objective/task status transition policy is implemented locally in the API service and should eventually be centralized as a shared domain policy.
- Dependency mutation uses a transaction-safe database boundary as the next hardening step; current graph validation prevents invalid single-writer mutations but live concurrency has not been verified.
- No autonomous workflow execution should be enabled yet.
- External integrations remain `PENDING CREDENTIALS`/`PLANNED`; none are connected.

## NEXT PRIORITIES

1. Harden the repository/service boundary and transactional control-plane mutations, including dependency writes.
2. Add durable audit records and API-level security/event logging.
3. Add approval persistence and founder-control primitives before any privileged execution gateway.
4. Add durable workflow/job state and restart-safe orchestration.
5. Only then begin model/tool provider and external integration layers.

## STATUS VOCABULARY

IMPLEMENTED · CONNECTED · CONFIGURED · PENDING CREDENTIALS · PLANNED · BLOCKED · NOT VERIFIED

No external service is marked CONNECTED merely because adapter code exists.
