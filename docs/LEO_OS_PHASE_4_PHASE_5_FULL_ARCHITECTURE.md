# LEO OS — PHASE 4 + PHASE 5 FULL ARCHITECTURE

**Document version:** 1.0  
**Status:** Architecture / implementation master plan  
**Scope:** Private internal LEO OS  
**Coverage:** V4.01–V4.12 and V5.01–V5.12  
**Phase 3 boundary:** V3.11 is the final Phase 3 version. No V3.12+ is part of this plan.

---

## 0. EXECUTIVE DECISION

Phase 1, Phase 2 and Phase 3 establish the trusted foundation and bounded execution architecture of LEO OS. Phase 4 turns that foundation into a durable operational system. Phase 5 adds controlled company intelligence on top of that operational system.

### Phase 4 — OPERATIONALIZATION

Phase 4 makes LEO OS usable as an internal company operating system:

- command center
- identity and administration
- human approvals
- durable workflows
- event fabric
- audit and provenance
- resource/cost governance
- integration boundaries
- workers and jobs
- reliability and recovery operations
- security hardening
- full-system certification

### Phase 5 — INTELLIGENT COMPANY OS

Phase 5 makes LEO OS capable of understanding company context, retrieving authorized knowledge, analyzing information, proposing plans, operating bounded agents and coordinating recurring company workflows — while preserving the existing control plane as the sole execution authority.

### Non-negotiable architectural law

> **INTELLIGENCE MAY PROPOSE. POLICY MAY AUTHORIZE. THE CONTROL PLANE DECIDES. EXECUTORS EXECUTE. LEO OS RECORDS EVERYTHING IMPORTANT.**

No Phase 4 or Phase 5 version may introduce a competing executor, authorization system, policy engine, autonomy engine, or hidden control plane.

---

# 1. TARGET ARCHITECTURE

```text
HUMANS / ADMINISTRATORS
        |
        v
COMMAND CENTER + APPROVALS
        |
        v
INTELLIGENCE / PLANNING / RECOMMENDATIONS
        |
        v
IDENTITY + AUTHORITY + POLICY + RISK + RESOURCE GOVERNANCE
        |
        v
EXISTING LEO OS CONTROL PLANE
        |
        v
BOUNDED AUTONOMY (V3.09) + RECOVERY (V3.10)
        |
        v
AUTHORIZED WORKERS / JOBS / ADAPTERS
        |
        v
EXTERNAL SYSTEMS / INTERNAL SERVICES
        |
        v
DATA + EVENT FABRIC + AUDIT + PROVENANCE + TELEMETRY
        |
        +------------------------------+
        |                              |
        +----> COMPANY CONTEXT <-------+
                    |
                    v
              INTELLIGENCE LOOP
```

## 1.1 Authority hierarchy

1. Human/operator authority.
2. Explicit organization and role authority.
3. Explicit policy and delegation rules.
4. Existing LEO OS control plane.
5. V3.08 resource governance.
6. V3.09 bounded autonomy.
7. V3.10 deterministic recovery.
8. V3.11 deterministic planning.
9. Phase 5 intelligence and agents.
10. Workers and integrations.

Lower layers cannot override higher layers.

## 1.2 Core invariants

1. One control plane.
2. Proposal is never authority.
3. Deny by default.
4. Fail closed on ambiguity or provenance mismatch.
5. Every meaningful decision is traceable.
6. Every autonomous operation has real bounds.
7. Human cancellation and override remain available.
8. Intelligence providers remain replaceable.
9. Side effects require explicit authorization.
10. Recovery is a first-class state transition.
11. Cost and resource use are governed.
12. Security follows data and identity.
13. No direct intelligence-to-database mutation path for privileged state.
14. No hidden background executor.
15. No self-modifying authority or security policy.

---

# 2. PHASE 4 — OPERATIONALIZATION

Phase 4 contains exactly **12 versions: V4.01 through V4.12**.

Recommended dependency order:

`V4.01 -> V4.02 -> V4.03 -> V4.04 -> V4.05 -> V4.06 -> V4.07 -> V4.08 -> V4.09 -> V4.10 -> V4.11 -> V4.12`

Each version must be independently implemented, tested, architecturally reviewed and certified before the next version begins.

---

# V4.01 — COMMAND CENTER FOUNDATION

## Purpose

Create the first real internal operator surface for LEO OS without allowing the UI to become an authority layer.

## Problem solved

The existing foundation can enforce behavior, but operators need a safe way to inspect system state, understand active work and reach the existing authorization/control mechanisms.

## Scope

- authenticated internal command center shell
- organization/workspace context
- navigation
- objective overview
- task overview
- autonomy status
- active executions
- approval inbox placeholder/interface
- alerts and health summary
- recent audit summary
- global search surface
- explicit operator identity context

## Architecture

`UI -> authenticated session -> application API -> existing authorization -> existing control plane`

The UI never writes privileged state directly.

## Core modules

- CommandCenterShell
- SessionContext
- OrganizationContext
- ObjectiveView
- TaskView
- ExecutionView
- ApprovalViewAdapter
- HealthView
- AuditSummaryView
- SearchFacade

## Data requirements

Read models should identify:

- organizationId
- actorId
- objectiveId
- taskId
- correlationId
- status
- timestamps
- risk level
- current authority/policy reference

## API boundary

Read APIs must be authenticated and authorization-aware. Mutation endpoints, if introduced for navigation or operator actions, must route through the existing control plane and produce audit records.

## Security

- no anonymous privileged pages
- organization isolation
- server-side authorization
- session expiry
- no client-only permission checks
- no secrets in browser payloads

## Failure behavior

Unavailable backend = read-only/error state, never fabricated state. Authorization uncertainty = deny.

## Tests

- authenticated/unauthenticated access
- cross-organization access denial
- stale session
- malformed identifiers
- unauthorized mutation
- UI cannot bypass server authorization
- audit correlation preservation

## Certification gate

Command Center can inspect real system state, cannot bypass authorization, preserves identity/provenance, and all Phase 1–3 regression remains green.

## Explicit non-goals

No AI assistant, external integrations, autonomous actions, or second workflow engine.

## Dependency

Requires Phase 3 APIs/state contracts. Enables V4.02 administrative identity surfaces.

---

# V4.02 — IDENTITY, ROLES & ADMINISTRATIVE CONTROL

## Purpose

Establish explicit identity, organization, role and administrative authority for operational use.

## Scope

- users
- organizations
- roles
- role bindings
- administrative scopes
- service identities
- operator/session identity
- permission evaluation
- privileged-operation classification
- emergency administrative controls

## Canonical model

`Actor -> Organization -> RoleBinding -> Scope -> Permission`

Every privileged operation receives an actor, organization and authority context.

## Rules

- deny by default
- least privilege
- explicit scopes
- no hidden superuser path
- service identities are distinct from humans
- administrative actions are audited
- emergency controls remain narrow and auditable

## Interfaces

- `resolveActorContext()`
- `evaluatePermission()`
- `requirePermission()`
- `resolveOrganizationScope()`
- `recordAdministrativeAction()`

These are authorization primitives, not a replacement for the existing control plane.

## Tests

Role matrix, scope escalation, organization isolation, revoked role, expired session, service-vs-human identity, replayed authorization context, malformed claims and concurrent revocation.

## Certification gate

Every privileged Phase 4 surface can resolve a canonical actor/organization/permission context and unauthorized operations fail closed.

## Non-goals

No AI-generated permissions and no autonomous policy changes.

## Dependency

V4.01. Enables V4.03 approvals and V4.06 audit attribution.

---

# V4.03 — APPROVAL & HUMAN-IN-THE-LOOP ENGINE

## Purpose

Create durable human approval as a first-class state machine for operations that require consent.

## Scope

- approval request
- requester
- approver/routing rule
- requested action summary
- risk classification
- evidence
- state: PENDING / APPROVED / REJECTED / EXPIRED / CANCELLED
- timestamps
- expiration
- escalation
- approval history

## Architecture

`proposal -> approval request -> authorized human decision -> existing control plane`

Approval does not execute work itself.

## Rules

- approval must bind to exact action/proposal/version
- approval cannot be reused for materially different action
- expired approval is invalid
- rejected approval cannot silently resume
- approval identity is immutable in audit history

## Tests

Duplicate approval, stale proposal, wrong approver, expired request, approval replay, cancellation race, organization mismatch, risk downgrade attempt, approval after execution, approval without evidence.

## Certification gate

High-risk actions can pause and resume only through durable, identity-bound approval and existing control-plane authorization.

## Dependency

V4.02. Required by V4.04 and later intelligent workflows.

---

# V4.04 — WORKFLOW & ORCHESTRATION RUNTIME

## Purpose

Represent durable multi-step business workflows without creating a second autonomy/control system.

## Scope

- workflow definition
- workflow version
- workflow instance
- step definition
- step state
- dependency graph
- retry policy reference
- timeout
- compensation hook
- correlation/causation IDs
- execution state machine

## Architecture rule

Workflow runtime **describes and coordinates work**. Existing control-plane authorization and execution remain authoritative.

## State model

`CREATED -> READY -> RUNNING -> WAITING -> COMPLETED`

with controlled terminal states:

`FAILED / CANCELLED / STOPPED / EXPIRED`

## Safety

- deterministic transitions
- idempotency key per side-effecting step
- no arbitrary recursive workflow spawning
- explicit maximum depth
- explicit timeout
- explicit cancellation

## Tests

Dependency cycles, duplicate steps, replay, concurrent transitions, stale worker, timeout, cancellation race, partial completion, compensation failure, unauthorized transition.

## Certification gate

A workflow can execute only through the existing control plane and remains reconstructable from durable state/events.

## Dependency

V4.03. Enables V4.05 durable events.

---

# V4.05 — EVENT FABRIC & DURABLE STATE

## Purpose

Create reliable domain events and durable state transitions for operational coordination.

## Event envelope

Every important event should support:

- eventId
- eventType
- eventVersion
- organizationId
- actorId/serviceIdentity
- objectiveId
- taskId
- correlationId
- causationId
- occurredAt
- recordedAt
- payload
- schema version
- idempotency key where applicable

## Rules

- events are immutable
- consumers are replay-safe
- duplicate delivery is expected and harmless
- schema changes are versioned
- transaction/event boundaries are explicit
- event order is never assumed unless guaranteed by contract

## Data strategy

Use the existing database as the durable source for authoritative state and an event layer for state-change propagation. Avoid introducing a distributed event platform until operationally justified.

## Tests

Duplicate events, out-of-order events, malformed event, schema mismatch, replay, transaction failure, consumer restart, idempotency, correlation preservation.

## Certification gate

Critical workflow transitions can be reconstructed and consumers tolerate retries/replay.

## Dependency

V4.04. Enables V4.06 audit and V4.09 worker operations.

---

# V4.06 — AUDIT, PROVENANCE & EXPLAINABILITY

## Purpose

Make important LEO OS behavior explainable after the fact.

## Audit record

Minimum fields:

- auditId
- actor/identity
- authority
- policyVersion
- organization
- objective/task
- correlationId
- causationId
- decision
- reason
- risk
- resource usage
- timestamps
- approval reference
- execution reference
- result

## Required capability

Given an operation, an administrator should be able to answer:

1. Who caused it?
2. Under what authority?
3. What objective/task did it belong to?
4. Which policy/version applied?
5. What decision was made?
6. Why?
7. What resources were consumed?
8. What approval was used?
9. What actually executed?
10. What happened afterward?

## Security

Audit records are append-only from application perspective. Sensitive payloads should be minimized or referenced rather than duplicated.

## Tests

Missing provenance, forged actor, mismatched correlation, audit omission, tampering attempt, duplicate audit, partial operation, approval mismatch.

## Certification gate

Critical operations have a complete provenance chain and can be reconstructed deterministically enough for incident investigation.

## Dependency

V4.05. Enables V4.07 governance and V4.10 incidents.

---

# V4.07 — RESOURCE, COST & QUOTA OPERATIONS

## Purpose

Operationalize V3.08 resource governance with budgets, quotas and cost attribution.

## Scope

- organization budget
- workflow budget
- task quota
- execution quota
- reservation
- usage ledger
- cost attribution
- threshold alerts
- budget policy
- operator visibility

## Architecture

V4.07 provides operational accounting and configuration. V3.08 remains the enforcement authority for resource governance.

## Rules

- no silent overrun
- accounting must be idempotent
- reservation and release must be balanced
- budget exhaustion stops or escalates according to policy
- cost attribution preserves correlation

## Tests

Concurrent spending, duplicate usage, quota exhaustion, reservation leak, negative accounting, stale reservation, cross-organization accounting, bypass attempt.

## Certification gate

Resource limits are enforced by the existing governance layer and usage can be reconciled against executions.

## Dependency

V4.06 and V3.08. Enables V4.08 integration cost/rate controls.

---

# V4.08 — INTEGRATION ADAPTER FRAMEWORK

## Purpose

Create a provider-neutral boundary for future external/internal integrations.

## Scope

- adapter interface
- connector identity
- capability declaration
- credential reference model
- input/output schemas
- timeout
- retry policy
- rate limit
- health
- audit hooks
- side-effect classification

## Architecture

`control plane -> authorized adapter -> provider`

Never:

`AI -> provider directly`

## Credential rules

Credentials are references, not ordinary workflow data. Secrets must not be exposed to intelligence or UI components unless an explicitly authorized capability requires it.

## Tests

Provider failure, timeout, retry storm, malformed response, credential denial, capability spoofing, side-effect misclassification, duplicate request, rate-limit exhaustion.

## Certification gate

Adapters are replaceable, bounded, authorized and fully auditable.

## Non-goals

Do not connect every provider here. Build the boundary first; add individual integrations only when a later workflow requires one.

## Dependency

V4.07. Enables V4.09 execution operations.

---

# V4.09 — JOB, WORKER & EXECUTION OPERATIONS

## Purpose

Operationalize workers and background execution under the existing control plane.

## Scope

- worker registry
- queue abstraction
- job lifecycle
- leases
- heartbeats
- retries
- dead-letter queue
- cancellation
- controlled concurrency
- worker health
- structured execution logs

## Worker rule

Workers are executors, never policy authorities.

## Job states

`QUEUED -> LEASED -> RUNNING -> SUCCEEDED`

or

`FAILED / CANCELLED / EXPIRED / DEAD_LETTERED`

## Safety

- lease ownership
- idempotent side effects
- cancellation checkpoints
- bounded retries
- poison-job isolation
- no unbounded queue growth

## Tests

Duplicate worker, lease expiry, worker crash, heartbeat loss, duplicate execution, cancellation race, retry storm, DLQ recovery, unauthorized job mutation.

## Certification gate

Workers can fail without corrupting authoritative state and every execution remains traceable.

## Dependency

V4.08. Enables V4.10 reliability operations.

---

# V4.10 — RELIABILITY, RECOVERY & INCIDENT OPERATIONS

## Purpose

Turn failure handling into an operational discipline.

## Scope

- health checks
- readiness
- liveness
- failure classification
- recovery workflow
- incident record
- degraded mode
- safe shutdown
- stale-job recovery
- operator intervention
- recovery audit

## Architecture

V3.10 remains the deterministic recovery authority for bounded autonomy. V4.10 supplies operational incident handling around it.

## Failure classes

- transient
- permanent
- dependency failure
- authorization failure
- resource exhaustion
- integrity/provenance failure
- operator cancellation
- unknown/unsafe

Unknown/unsafe failures fail closed.

## Tests

Database outage, event outage, worker crash, provider outage, stale lease, recovery loop, repeated failure, cancellation, corrupted checkpoint, operator override.

## Certification gate

The system can enter safe degraded mode, recover eligible operations and stop unsafe operations without inventing state.

## Dependency

V4.09 and V3.10. Enables V4.11 security operations.

---

# V4.11 — SECURITY HARDENING & GOVERNANCE

## Purpose

Harden the operational platform before intelligence and broad integrations are introduced.

## Scope

- secret handling boundaries
- credential isolation
- encryption-at-rest requirements
- transport security
- security events
- data classification
- retention policy
- access review
- privilege review
- dependency/security scanning
- threat-model review
- sensitive operation controls

## Rules

- security policy cannot be modified by intelligence
- sensitive data follows least privilege
- logs do not become secret exfiltration paths
- credentials are never copied into prompts
- privileged actions require explicit authority

## Tests

Privilege escalation, secret leakage, cross-tenant access, log leakage, insecure default, expired credential, dependency vulnerability gate, malformed security event, audit bypass.

## Certification gate

Security review passes and critical data/authority boundaries are demonstrably enforced.

## Dependency

V4.10. This is the final hardening gate before full Phase 4 certification.

---

# V4.12 — PHASE 4 INTEGRATION & CERTIFICATION

## Purpose

Certify the entire operational platform, not merely V4.12's own code.

## Required regression

- Phase 1 complete certification
- Phase 2 complete certification
- V3.01–V3.11 certification
- V4.01–V4.11 tests
- database migration validation
- identity/authorization
- approvals
- workflows
- events
- audit/provenance
- resource governance
- adapters
- workers/jobs
- failure/recovery
- security
- end-to-end operations

## Mandatory E2E scenarios

1. Human creates objective -> workflow -> authorized execution -> audit.
2. High-risk proposal -> approval -> execution.
3. Unauthorized request -> denial -> audit.
4. Budget exhaustion -> safe stop.
5. Worker crash -> recovery -> outcome.
6. Cancellation -> safe termination.
7. Duplicate/replayed event -> no duplicate side effect.
8. Cross-organization access -> denial.
9. Provider outage -> bounded failure.
10. Incident reconstruction from audit/provenance.

## Phase 4 DONE

Phase 4 is complete only when the full Phase 1–4 gate is green, architecture invariants hold, no duplicate authority exists, and the certified commit is recorded.

**After V4.12 passes, Phase 4 is frozen.**

---

# 3. PHASE 5 — INTELLIGENT COMPANY OS

Phase 5 contains exactly **12 versions: V5.01 through V5.12**.

Recommended dependency order:

`V5.01 -> V5.02 -> V5.03 -> V5.04 -> V5.05 -> V5.06 -> V5.07 -> V5.08 -> V5.09 -> V5.10 -> V5.11 -> V5.12`

Phase 5 must not begin until V4.12 has certified the full Phase 1–4 stack.

---

# V5.01 — COMPANY CONTEXT GRAPH

## Purpose

Create a canonical model of the company that intelligence can reason over.

## Core entities

- organization
- person
- team
- role
- project
- objective
- task
- workflow
- resource
- system
- document
- decision
- event
- metric
- relationship

## Rules

Canonical identifiers must map back to existing LEO OS identifiers. The graph is a context model, not a second source of authorization.

## Provenance

Every meaningful fact should carry source, timestamp, authority/access context and freshness metadata.

## Tests

Identity collision, stale fact, unauthorized relationship, duplicate entity, deleted entity, cross-organization leakage, provenance loss.

## Certification gate

Company context can be queried consistently and remains subordinate to canonical identity/authorization.

## Dependency

Phase 4. Enables V5.02 knowledge retrieval.

---

# V5.02 — INTERNAL KNOWLEDGE & RETRIEVAL

## Purpose

Give intelligence access to relevant internal knowledge while preserving authorization.

## Scope

- document ingestion
- indexing
- chunking/metadata
- retrieval
- access-aware filtering
- source attribution
- freshness tracking
- permission propagation
- deletion propagation
- citation/provenance

## Critical rule

**Retrieval is authorization-aware.** A model must never see content merely because the retrieval index can technically return it.

## Retrieval result

Each result should preserve:

- document/source ID
- owner/scope
- content reference
- relevance metadata
- timestamp/freshness
- authorization basis

## Tests

Unauthorized retrieval, deleted document retrieval, stale index, cross-organization search, prompt injection in documents, poisoned metadata, citation mismatch.

## Certification gate

No unauthorized knowledge reaches intelligence context.

## Dependency

V5.01 and V4.11.

---

# V5.03 — INTELLIGENCE GATEWAY

## Purpose

Create a provider-neutral intelligence boundary.

## Scope

- provider abstraction
- request schema
- response schema
- model policy
- model/version tracking
- token/cost budget
- timeout
- fallback
- safety policy
- prompt/context provenance
- output classification

## Architecture

`LEO intelligence client -> gateway -> approved provider`

The provider cannot become the control plane.

## Rules

- explicit model selection/policy
- bounded token/cost usage
- deterministic metadata capture
- provider failures are bounded
- generated output is untrusted until validated

## Tests

Provider timeout, malicious output, malformed output, excessive cost, context leakage, wrong model policy, fallback loops, prompt injection, missing provenance.

## Certification gate

All intelligence requests are governed, attributable and provider-independent.

## Dependency

V5.02 and V4.07/V4.11.

---

# V5.04 — INTELLIGENT ANALYST

## Purpose

Add useful intelligence for analysis without allowing analysis to perform privileged actions.

## Capabilities

- summarize
- compare
- identify anomalies
- explain trends
- identify risks
- generate reports
- answer company-context questions
- cite sources

## Output contract

Every material answer should distinguish:

- observed facts
- retrieved evidence
- model inference
- uncertainty
- recommendation

## Rules

Analysis is advisory unless explicitly routed into an authorized workflow.

## Tests

Hallucinated source, unsupported claim, stale evidence, unauthorized context, contradictory evidence, prompt injection, fabricated certainty.

## Certification gate

Analyst output is attributable to sources/model/version and cannot directly mutate privileged state.

## Dependency

V5.03.

---

# V5.05 — GOAL DECOMPOSITION ENGINE

## Purpose

Convert a company objective into candidate work while preserving constraints and authority boundaries.

## Pipeline

`objective -> constraints -> desired outcome -> candidate tasks -> dependencies -> risks -> resources -> proposed plan`

## Output

Candidate tasks must include:

- task ID
- objective ID
- rationale
- dependencies
- estimated resource needs
- risk
- proposed priority
- provenance
- confidence/uncertainty where relevant

## Rules

Generated work is a proposal. It is not automatically authorized.

## Tests

Scope expansion, invented task authority, dependency cycle, duplicate task, missing provenance, resource overcommitment, malicious objective text.

## Certification gate

Decomposition produces bounded proposals compatible with V3.11 and the existing control plane.

## Dependency

V5.04 and V3.11.

---

# V5.06 — STRATEGIC PLANNER

## Purpose

Add intelligent planning above deterministic V3.11 while keeping deterministic validation authoritative.

## Architecture

```text
Objective
  -> Context / Knowledge
  -> Intelligent candidate plan
  -> V3.11 deterministic validation
  -> V3.08 resource governance
  -> V3.09 bounded autonomy
  -> V3.10 recovery
  -> existing control plane
  -> authorization
  -> execution
```

## Rules

The intelligent planner cannot:

- execute directly
- grant permissions
- increase budgets
- disable approvals
- modify security policy
- bypass V3.11
- create a new executor

## Tests

Bad plan, circular plan, unsafe plan, budget violation, privilege escalation, approval bypass, stale context, planner disagreement, malformed model output.

## Certification gate

Every intelligent plan passes deterministic validation and existing authority gates before execution.

## Dependency

V5.05, V3.08, V3.09, V3.10, V3.11.

---

# V5.07 — CONTROLLED AGENT RUNTIME

## Purpose

Introduce bounded agents as controlled workers/clients of LEO OS.

## Agent identity

Every agent has:

- agentId
- organizationId
- objectiveId
- taskId
- allowed tools
- permission scope
- risk ceiling
- max steps
- max duration
- max budget
- failure limit
- cancellation token/state
- provenance

## Architecture

`agent -> existing control plane -> authorized capability -> worker`

Never `agent -> unrestricted environment`.

## Rules

- bounded execution
- explicit scope
- explicit tool list
- human approval for configured high-risk actions
- cancellation always available
- no recursive unlimited agents
- no self-granted authority

## Tests

Tool escalation, budget exhaustion, recursive spawning, cancellation race, credential exposure, high-risk bypass, stale objective, provenance mismatch, runaway loop.

## Certification gate

Agents demonstrably remain subordinate to V3.09/V3.10 and the existing control plane.

## Dependency

V5.06 and Phase 4 worker/tool infrastructure.

---

# V5.08 — TOOL & CAPABILITY REGISTRY

## Purpose

Create a canonical registry describing what an agent/workflow is allowed to request.

## Capability record

- capabilityId
- version
- input schema
- output schema
- permission requirement
- risk level
- cost class
- rate limit
- side-effect class
- approval requirement
- adapter/worker binding
- audit requirement

## Example capabilities

- read approved data
- create task
- update project
- generate report
- run approved workflow
- send approved communication

## Rules

A tool being registered does not grant permission to use it.

## Tests

Capability spoofing, schema confusion, permission mismatch, side-effect misclassification, version mismatch, revoked capability, rate-limit bypass.

## Certification gate

Every agent/tool call has explicit capability identity and authorization.

## Dependency

V5.07 and V4.08/V4.09.

---

# V5.09 — AUTONOMOUS COMPANY WORKFLOWS

## Purpose

Combine context, intelligence, planning, agents, tools and operational workflows into useful bounded company processes.

## Initial workflow classes

- project launch
- customer follow-up
- internal reporting
- research
- operational review
- issue triage
- planning cycle

## Standard lifecycle

`trigger -> context -> analysis -> proposal -> validation -> approval if required -> execution -> verification -> outcome -> audit -> evaluation`

## Rules

Every workflow has:

- objective
- owner
- bounds
- budget
- allowed capabilities
- cancellation
- escalation
- audit
- completion criteria

## Tests

Partial failure, approval timeout, tool outage, bad model output, budget exhaustion, cancellation, duplicate trigger, stale data, wrong organization.

## Certification gate

At least representative end-to-end company workflows operate safely through the existing control plane.

## Dependency

V5.01–V5.08 and V4.12 certification.

---

# V5.10 — EVALUATION, LEARNING & OPTIMIZATION

## Purpose

Measure whether intelligence and automation actually improve outcomes.

## Metrics

- task success
- objective success
- plan quality
- failure rate
- recovery rate
- cost efficiency
- latency
- human override rate
- approval rate
- rejection rate
- tool error rate
- regression rate
- policy effectiveness

## Learning rules

Learning may optimize recommendations and workflow parameters within approved bounds, but cannot silently rewrite:

- identity
- authorization
- security policy
- risk ceilings
- budget ceilings
- audit requirements
- control-plane authority

## Tests

Metric poisoning, feedback loops, reward hacking, regression masking, policy mutation, stale evaluation, biased success signal.

## Certification gate

Optimization improves measurable outcomes without changing authority boundaries.

## Dependency

V5.09.

---

# V5.11 — EXECUTIVE INTELLIGENCE & COMPANY OPERATING LOOP

## Purpose

Provide leadership with a coherent operating picture and recommendations.

## Outputs

- daily/weekly company brief
- objective health
- strategic risks
- blocked work
- resource pressure
- decisions needed
- deadlines
- opportunities
- recommendations
- unresolved approvals
- system health

## Rules

Executive intelligence is decision support. Strategic human leadership retains final authority.

Recommendations must separate evidence from inference and identify uncertainty.

## Tests

Incorrect KPI, stale data, unauthorized information, fabricated recommendation, source mismatch, conflicting metrics, recommendation/action confusion.

## Certification gate

Leadership receives useful, attributable intelligence without accidental autonomous strategic decisions.

## Dependency

V5.10 and all operational/intelligence foundations.

---

# V5.12 — FULL SYSTEM CERTIFICATION

## Purpose

Certify LEO OS as the complete planned architecture.

## Required regression

### Phase 1

Full certified Phase 1 gate.

### Phase 2

Full certified Phase 2 gate.

### Phase 3

V3.01–V3.11 full certification/regression.

### Phase 4

V4.01–V4.12 full certification/regression.

### Phase 5

V5.01–V5.11 full certification/regression.

## Additional intelligence certification

- retrieval authorization
- model/provider boundary
- prompt/context provenance
- malicious model output
- hallucination-resistant execution gates
- agent scope
- tool permissions
- cost/budget limits
- approval bypass resistance
- adversarial autonomy
- cancellation
- recovery
- audit reconstruction
- end-to-end company workflows

## Mandatory E2E scenarios

1. Objective -> context -> analysis -> plan -> deterministic validation -> approval -> execution -> audit.
2. Objective -> bounded autonomous execution -> failure -> V3.10 recovery -> completion.
3. Unauthorized knowledge -> retrieval denial.
4. High-risk tool -> approval required.
5. Budget exhaustion -> autonomous stop.
6. Model/provider outage -> bounded failure/fallback.
7. Malicious document/prompt injection -> no unauthorized action.
8. Agent attempts privilege escalation -> denied and audited.
9. Cancellation during tool execution -> safe termination.
10. Replayed workflow/event -> no duplicate side effect.
11. Executive report -> evidence/provenance reconstruction.
12. Full incident -> reconstruct actor, authority, policy, decision, execution and outcome.

## Phase 5 DONE

Phase 5 is complete only when the full Phase 1–5 gate is green and all architectural invariants remain true.

**After V5.12 passes, the planned Phase 1–5 architecture is frozen.**

---

# 4. VERSION DEPENDENCY MAP

```text
PHASE 1 FOUNDATION
        |
PHASE 2 CORE ARCHITECTURE
        |
V3.01 ... V3.11
        |
        +--------------------------+
        |                          |
      V4.01                      V4.02
        |                          |
        +--> V4.03 --> V4.04 --> V4.05 --> V4.06
                                             |
                                             v
                                           V4.07
                                             |
                                  V4.08 --> V4.09 --> V4.10 --> V4.11 --> V4.12
                                                                               |
                                                                               v
                                                                            V5.01
                                                                               |
                                                                            V5.02
                                                                               |
                                                                            V5.03
                                                                               |
                                                                            V5.04
                                                                               |
                                                                            V5.05
                                                                               |
                                                                            V5.06
                                                                               |
                                                                            V5.07
                                                                               |
                                                                            V5.08
                                                                               |
                                                                            V5.09
                                                                               |
                                                                            V5.10
                                                                               |
                                                                            V5.11
                                                                               |
                                                                            V5.12
```

Cross-version dependencies must be explicit in implementation PRs. A later version may consume an earlier contract but must not silently replace its authority.

---

# 5. UNIVERSAL VERSION IMPLEMENTATION PROTOCOL

Every V4/V5 version follows the same loop:

1. Freeze the architectural boundary.
2. Inspect current repository state and existing invariants.
3. Define exact contracts/types/schema.
4. Implement the smallest complete version within scope.
5. Add unit tests.
6. Add adversarial/security tests.
7. Add integration tests.
8. Wire exports/interfaces.
9. Add database migration only if required.
10. Add targeted certification workflow.
11. Run targeted verification.
12. Run relevant historical regression.
13. Fix all failures.
14. Re-run certification.
15. Perform architecture review.
16. Merge only when green.
17. Record certified implementation commit.
18. Start the next version only after the current version is verified/certified.

A green local test is not sufficient for certification.

---

# 6. UNIVERSAL ADVERSARIAL TEST MATRIX

Every version must consider:

- missing provenance
- mismatched organization
- mismatched actor
- privilege escalation
- duplicate request
- replay
- race condition
- stale state
- dependency violation
- malformed input
- malformed model output
- budget exhaustion
- quota exhaustion
- timeout
- cancellation
- worker crash
- provider failure
- partial transaction
- event replay
- event reordering
- malicious content/prompt injection
- unauthorized data retrieval
- credential leakage
- policy mismatch
- approval replay
- audit omission

Not every test applies identically to every version, but each implementation must explicitly classify applicability.

---

# 7. UNIVERSAL DATA/PROVENANCE CONTRACT

Where applicable, privileged or autonomous state should preserve:

```text
organizationId
actorId / serviceIdentity
objectiveId
taskId
correlationId
causationId
policyVersion
authority
risk
resource/budget context
createdAt
updatedAt
status
reason
```

Phase 5 intelligence additionally records, where applicable:

```text
model/provider
modelVersion
prompt/context reference
retrieved source IDs
retrieval timestamp
output classification
confidence/uncertainty metadata
```

No secret should be inserted into generic provenance or model context merely for convenience.

---

# 8. UNIVERSAL CERTIFICATION STANDARD

A version is **IMPLEMENTED** when its intended code exists.

A version is **TESTED** when its unit/integration/adversarial tests pass.

A version is **VERIFIED** when the implementation satisfies its architecture and acceptance criteria.

A version is **CERTIFIED** only when its dedicated certification workflow and required regression gates pass.

A version is not complete merely because its own tests are green.

## Certification chain

`IMPLEMENTED -> UNIT TESTED -> INTEGRATION TESTED -> ADVERSARIAL TESTED -> ARCHITECTURE REVIEWED -> CERTIFICATION WORKFLOW -> REGRESSION -> MERGE -> POST-MERGE CERTIFICATION`

---

# 9. COST-CONSCIOUS IMPLEMENTATION STRATEGY

LEO OS should remain budget-friendly and private.

## Principles

- prefer existing repository infrastructure
- avoid introducing managed infrastructure without need
- use the existing database until scale proves otherwise
- use provider-neutral interfaces before provider proliferation
- use one queue/event mechanism until operational requirements justify another
- use open-source/local components where they meet security and reliability requirements
- keep model usage bounded by cost budgets
- do not pay for infrastructure merely for architectural fashion
- build adapters only when a real workflow needs them

The architecture must remain production-capable without requiring a large enterprise cloud bill during development.

---

# 10. THINGS EXPLICITLY FORBIDDEN IN PHASE 4/5

Do not build:

- unrestricted autonomous agents
- unrestricted external actions
- a second control plane
- a second authorization system
- provider-specific core architecture
- hidden background executors
- AI-controlled security policy
- AI-controlled permission grants
- self-modifying production authority
- unbounded recursive planning
- unlimited model/tool budgets
- silent policy changes
- direct intelligence writes to privileged database state
- integrations without audit/provenance
- automatic strategic decisions without human authority
- a new autonomy engine that bypasses V3.09
- a new recovery engine that bypasses V3.10
- a new deterministic planner that replaces V3.11

---

# 11. PHASE COMPLETION RULES

## Phase 4 completion

`V4.01–V4.11 certified + V4.12 full Phase 1–4 certification = PHASE 4 COMPLETE`

Then freeze Phase 4.

## Phase 5 completion

`V5.01–V5.11 certified + V5.12 full Phase 1–5 certification = PHASE 5 COMPLETE`

Then freeze the planned Phase 1–5 architecture.

## No skipping

Do not begin the next version merely because the code compiles. The preceding version must have passed its required verification/certification gate.

---

# 12. FINAL COMPANY OS VISION

The final planned LEO OS architecture is:

```text
                    COMPANY LEADERSHIP
                           |
                           v
                    COMMAND CENTER
                           |
                           v
                COMPANY CONTEXT + KNOWLEDGE
                           |
                           v
              INTELLIGENCE / ANALYSIS / PLANS
                           |
                           v
                 DETERMINISTIC VALIDATION
                           |
                           v
             POLICY + AUTHORITY + RISK + COST
                           |
                           v
                  LEO OS CONTROL PLANE
                           |
                  +--------+--------+
                  |                 |
                  v                 v
            BOUNDED AUTONOMY     RECOVERY
             V3.09              V3.10
                  |
                  v
          DETERMINISTIC PLANNING
               V3.11
                  |
                  v
            AUTHORIZED TOOLS
                  |
                  v
          WORKERS / INTEGRATIONS
                  |
                  v
             COMPANY ACTION
                  |
                  v
       OUTCOME + AUDIT + TELEMETRY
                  |
                  v
        EVALUATION + COMPANY CONTEXT
                  |
                  +------> INTELLIGENCE LOOP
```

The goal is not to make LEO OS an uncontrolled AI that can do anything.

The goal is to make LEO OS a **bounded, auditable, secure company operating system in which intelligence can understand the company, propose useful work and coordinate authorized execution while the existing control plane remains the ultimate technical authority.**

---

# 13. MASTER VERSION CHECKLIST

## Phase 4

- [ ] V4.01 Command Center Foundation
- [ ] V4.02 Identity, Roles & Administrative Control
- [ ] V4.03 Approval & Human-in-the-Loop Engine
- [ ] V4.04 Workflow & Orchestration Runtime
- [ ] V4.05 Event Fabric & Durable State
- [ ] V4.06 Audit, Provenance & Explainability
- [ ] V4.07 Resource, Cost & Quota Operations
- [ ] V4.08 Integration Adapter Framework
- [ ] V4.09 Job, Worker & Execution Operations
- [ ] V4.10 Reliability, Recovery & Incident Operations
- [ ] V4.11 Security Hardening & Governance
- [ ] V4.12 Phase 4 Integration & Certification

## Phase 5

- [ ] V5.01 Company Context Graph
- [ ] V5.02 Internal Knowledge & Retrieval
- [ ] V5.03 Intelligence Gateway
- [ ] V5.04 Intelligent Analyst
- [ ] V5.05 Goal Decomposition Engine
- [ ] V5.06 Strategic Planner
- [ ] V5.07 Controlled Agent Runtime
- [ ] V5.08 Tool & Capability Registry
- [ ] V5.09 Autonomous Company Workflows
- [ ] V5.10 Evaluation, Learning & Optimization
- [ ] V5.11 Executive Intelligence & Company Operating Loop
- [ ] V5.12 Full System Certification

---

# 14. NEXT IMPLEMENTATION TARGET

The architecture is planning-only until implementation begins.

**Next implementation target: V4.01.**

Do not implement V4.02 before V4.01 is fully verified/certified.

Do not begin Phase 5 before V4.12 has passed the full Phase 1–4 certification gate.

**Phase 3 remains frozen at V3.11.**

---

**END OF MASTER ARCHITECTURE**
