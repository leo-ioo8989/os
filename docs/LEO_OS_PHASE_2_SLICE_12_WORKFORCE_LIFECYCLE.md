# LEO OS — Phase 2 Slice 12
## Governed Workforce Lifecycle & Staffing Decision Boundary

Status: VERIFIED/CERTIFIED

### Certification
Slice 12 was independently certified on the Slice 12 branch by the official LEO OS V1.09 Certification workflow (Run #264). This document is carried forward as part of the Slice 13 certified-baseline integrity check.

### Architecture review
The workforce domain defines roles, employees, capabilities and provider/model eligibility. The bounded capability introduced by Slice 12 is a governed, durable boundary for proposing workforce lifecycle changes without granting an agent authority to mutate workforce state.

### Boundary
`LEO / GOVERNED INTELLIGENCE → WORKFORCE LIFECYCLE PROPOSAL → EXISTING CONTROL/APPROVAL AUTHORITY → DURABLE AUDIT HISTORY → FUTURE AUTHORIZED LIFECYCLE EXECUTION`

Slice 12 implements the proposal and durable-history boundary only. It does not create a second workforce control plane.

### Supported lifecycle proposals
- CREATE_ROLE
- ACTIVATE
- SUSPEND
- DEACTIVATE
- UPDATE_SCOPE
- RETIRE

A proposal identifies an organization and a role or employee, records reason/risk/current and proposed status where applicable, and remains `PROPOSAL_ONLY`.

### Authority invariants
- `CONTROL PLANE > AGENT`
- `POLICY > MODEL OUTPUT`
- `APPROVAL > AGENT INTENT`
- `AUDIT > ASSUMPTION`
- `EXPLICIT AUTHORITY > IMPLICIT TRUST`
- `PROPOSAL ≠ EXECUTION`
- `APPROVAL REQUIRED ≠ APPROVAL GRANTED`
- `WORKFORCE ROLE ≠ AUTHORIZED WORKER`

No lifecycle proposal may grant permissions/capabilities, create authorization, approve itself, create credentials, dispatch work, execute work, spend, delete data, or call an external system.

### Durability
The existing append-only `AuditEvent` authority stores lifecycle proposals. No new Prisma model, state machine, queue, cache, or workforce database is introduced. Sequential duplicate writes for the same organization + proposal ID return the existing proposal.

### Organization isolation
Every proposal is organization-bound. Reads are scoped by organization and cross-organization targets are rejected.

### Failure semantics
Malformed proposals fail closed before durable write. Persisted records are reconstructed only when they retain proposal-only authority and valid identity/provenance.

### Non-goals
- no automatic employee activation/deactivation
- no worker creation or authorization
- no approval granting
- no dispatcher/executor changes
- no provider integration
- no external tools
- no autonomous workforce loop
- no UI
- no new database schema

### Next architectural extension
A later slice may connect an approved lifecycle decision to an existing authoritative workforce/worker control path, but Slice 12 deliberately stops before that authority boundary.
