# LEO OS — Phase 2 Slice 11
## Durable Executive Decision State & Audit Boundary

Status: IMPLEMENTATION IN PROGRESS

### Purpose
Slice 10 introduced the governed executive continuation decision, but the decision existed only as a returned in-process value. Slice 11 gives that proposal-only executive state durable history without creating a second control plane or execution state machine.

### Architecture
`VALIDATED OUTCOME → EXECUTIVE CONTINUATION → PROPOSAL-ONLY DECISION → EXISTING AUDIT AUTHORITY → DURABLE EXECUTIVE HISTORY`

The durable record is an append-only audit event. It is historical state, not execution authority.

### Invariants
- `CONTROL PLANE > AGENT`
- `POLICY > MODEL OUTPUT`
- `APPROVAL > AGENT INTENT`
- `AUDIT > ASSUMPTION`
- `DURABILITY > IN-MEMORY STATE`
- `EXPLICIT AUTHORITY > IMPLICIT TRUST`
- `FAIL CLOSED FOR HIGH-RISK ACTIONS`
- `PROPOSAL ≠ EXECUTION`
- `APPROVAL REQUIRED ≠ APPROVAL GRANTED`

### Boundary
The repository accepts only `PROPOSAL_ONLY` executive continuation decisions. It preserves organization, owner, objective, task/job references, disposition, rationale, risks, provenance and optional next proposal. It rejects authority-bearing executive state with any other authority classification.

No persisted executive decision can authorize, approve, dispatch, retry, reassign, spend, access credentials, mutate a Job/Task/Workflow/Objective, or call an external system.

### Organization isolation
All reads are scoped by `organizationId`. A continuation identifier from another organization is not visible through the repository API.

### Durability model
The existing `AuditEvent` table remains the single durable historical authority. No parallel executive state table, event bus, queue, cache, or in-memory registry is introduced.

The same continuation ID is treated as the deterministic record key for sequential idempotent writes: an already-recorded proposal is returned instead of creating another record.

### Failure semantics
Malformed or authority-bearing records fail closed and are not persisted. If an existing audit record cannot be reconstructed as a valid proposal-only executive decision, it is ignored by the read boundary rather than promoted to authority.

### Non-goals
- no autonomous executive loop
- no execution or dispatch
- no approval granting
- no worker lifecycle changes
- no provider/model integration
- no external integrations
- no new control plane
- no new execution state machine
- no UI

### Expected implementation surface
- `packages/db/src/executive-decision-repository.ts`
- `packages/db/src/audit.ts`
- `packages/db/src/index.ts`
- focused repository tests

No Prisma schema or migration change is required because the existing durable audit authority is sufficient.
