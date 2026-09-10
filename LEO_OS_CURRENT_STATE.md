# LEO OS — CURRENT STATE

**Product:** LEO OS — Leadership & Execution Operating System  
**Audit date:** 2026-09-10  
**Repository:** `haeshitsa/firsy`  
**Branch:** `main`  
**Version target:** V1.06

## INTERNAL / PRIVATE STATUS
LEO OS is a private internal operating system intended to run the founder's company workflows on a local/private environment. It is not currently a public SaaS product. No public deployment, publishing or external integration work is part of scope.

## CURRENT ARCHITECTURE

```text
YOU → LEO OS → CEO / ORCHESTRATOR → OBJECTIVE ENGINE → TASK / DEPENDENCY GRAPH
→ AI WORKFORCE → TOOLS → EXECUTION → VALIDATION → APPROVAL → AUDIT / COMPANY MEMORY
```

Phase 1 remains an incremental control plane: API → authentication/context → RBAC → service → repository → Prisma/PostgreSQL; worker → trusted identity → job service → repository → Prisma/PostgreSQL. Deterministic policies remain in `packages/core`.

## V1.05 PRESERVED
- Durable Job and Checkpoint persistence.
- Atomic job claim, lease heartbeat, failure/retry and stale-lease recovery.
- Worker-facing JobService boundary.
- Organization-scoped repository operations and metadata redaction.
- Existing durable AuditEvent, Approval and Workflow foundations.
- No autonomous worker loop, AI execution, external integrations or Command Center UI.

## V1.06 IMPLEMENTED
- Persistent `Worker` identity with organization, name/type, lifecycle status, capabilities, permission profile and sanitized metadata.
- Deterministic worker lifecycle: `ACTIVE → SUSPENDED` or `ACTIVE → REVOKED`; suspended/revoked workers cannot authenticate or claim/continue privileged work. Existing owned jobs require recovery rather than silent continuation.
- Persistent `WorkerCredential` verifier records. Credentials use Node's built-in scrypt primitive with random salts; raw credentials are returned only to the caller at creation and are never persisted/audited.
- Credential rotation revokes active verifiers before creating a replacement; individual verifier records support revocation and expiration.
- Worker authentication is separate from human sessions and always resolves through `(workerId, organizationId)`.
- Extensible capability list and permission profile; capabilities are checked before execution authorization.
- Deterministic Execution Gateway with `ALLOW`, `DENY`, and `REQUIRES_APPROVAL` decisions.
- Risk model: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Current policy: LOW/MEDIUM allowed when capability is present; HIGH requires approval; CRITICAL denied by the gateway.
- Execution fingerprints bind action, target, sanitized parameters, risk and environment using SHA-256.
- Approval records now bind action fingerprint, policy version and requester worker; approved records can be consumed exactly once by the matching worker/action.
- Existing approval persistence remains the source of approval state; approval never performs an external action.
- Durable `WAITING_APPROVAL` job state added. Approved work returns to `RETRY_QUEUED`; rejected work becomes terminal `FAILED`.
- Workflow↔Job repository boundary added for same-organization linking and workflow job summaries covering current, active, queued, completed, failed, retryable, approval-blocked and resumable work.
- V1.06 audit vocabulary extends the existing AuditEvent system with worker, execution and workflow/job coordination events.
- Additive Prisma migration added; no tables/columns were cosmetically renamed or dropped.

## STATE OWNERSHIP
- **Workflow:** authoritative for workflow lifecycle, current workflow state and current task pointer.
- **Job:** authoritative for execution attempt/lease/retry/approval-blocked state and resumable execution state.
- **Task:** authoritative for task lifecycle and dependency semantics.
- **Approval:** authoritative for human authorization decision; it does not execute work.

## APPROVAL-BLOCKED / RESUMPTION MODEL
A privileged request that requires approval persists an Approval and returns `REQUIRES_APPROVAL`; no action is executed. A running job may persist `WAITING_APPROVAL`. Approval decision and later job resolution are durable database operations, so the state is not an in-memory flag. Approved resolution queues the job for a future authenticated worker claim; rejection fails the job deterministically.

## WORKER SUSPENSION / REVOCATION
Suspended and revoked workers cannot authenticate, claim new jobs, heartbeat, transition active jobs or checkpoint. Existing active jobs are not silently continued under a revoked identity; they require stale-lease/recovery or explicit orchestration. Automatic privileged takeover by another worker is not implemented yet.

## SECURITY REVIEW
Reviewed threats: forged worker ID, stolen/replayed credentials, cross-organization access, privilege escalation, worker impersonation, approval forgery/reuse, self-approval, stale approvals, revoked-worker execution, IDOR, secret leakage and gateway bypass.

Mitigations implemented: credential verification with scrypt/timing-safe comparison; organization predicates; worker lifecycle checks; explicit capabilities; central typed gateway; SHA-256 action binding; approval expiration/status checks; single-use approval consumption; serializable mutations for credential lifecycle/approval decisions/job approval transitions; existing recursive audit redaction. No raw credential is written to audit metadata. The current repository API itself is not exposed as a privileged external execution API.

## TEST STATUS
**IMPLEMENTED:** deterministic execution-policy tests, worker credential verifier tests, execution fingerprint tests, and existing V1.05 job tests.  
**NOT VERIFIED:** tests were not executed in this session; Prisma client generation, PostgreSQL migration application, real transaction/concurrency behavior and end-to-end worker/gateway runtime were not executed or verified. No successful CI run has been established.

## DATABASE
V1.06 migration `20260910170000_v106_trusted_worker_execution` is additive. It adds Worker/WorkerCredential, approval binding/consumption fields, the WorkerStatus enum, the durable `WAITING_APPROVAL` JobStatus and the optional Job→Worker identity foreign key. **Migration application is NOT VERIFIED.**

## REMAINING TECHNICAL DEBT / NEXT DEPENDENCY
- Verify Prisma generation and migrations against PostgreSQL.
- Add real integration/concurrency tests when a runnable local database is available.
- Add an authenticated worker transport boundary only when a real worker process needs remote access; current local service boundary is intentional.
- Complete workflow/job orchestration semantics for multiple jobs and automatic recovery only when execution orchestration begins.
- Add founder/security-event persistence for unauthenticated requests that have no trusted organization context without attributing attacker-controlled organization IDs.
- Keep all AI agents, model providers, MCP and external tools outside this phase.

## PHASE BOUNDARY
V1.06 does **not** implement AI agents, LLM/model providers, GitHub, Gmail, Instagram, Google Drive, Calendar, MCP, n8n, browser/computer use, autonomous external actions or Command Center UI. Those remain outside the current Phase 1 infrastructure boundary.

## STATUS VOCABULARY
IMPLEMENTED · CONNECTED · CONFIGURED · PENDING CREDENTIALS · PLANNED · BLOCKED · NOT VERIFIED

No external service is marked CONNECTED merely because adapter code exists.

## NAMING / COMPATIBILITY NOTES
Product identity is `LEO OS` / `LEO_OS` / `leo-os` / `leo_os` according to context. Existing `@founder-os/*` namespaces and historical database/migration identifiers remain compatibility identifiers and are intentionally not cosmetically renamed.
