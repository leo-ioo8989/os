# LEO OS — Phase 2 Slice #7 — Governed AI Workforce, Capability & Provider Registry

**Status: IMPLEMENTATION — CERTIFICATION PENDING**

## Objective

Slice #7 defines the organizational registry required for future governed delegation: roles/employees, capabilities, capability contracts, providers, models, eligibility, free-first policy, context scope, QA, escalation, temporary specialists, and proposal-only workforce selection.

**SLICE #7 DEFINES WHO/CAPABILITY/PROVIDER CAN BE USED.**

**SLICE #8 WILL DEFINE HOW WORK IS DELEGATED AND EXECUTED.**

## Architecture

```text
LEO
 ↓
OBJECTIVE / TASK REQUIREMENTS
 ↓
WORKFORCE REGISTRY
 ↓
CAPABILITY MATCHING
 ↓
CAPABILITY CONTRACT
 ↓
ELIGIBLE PROVIDER / MODEL SET
 ↓
MODEL RUNTIME
 ↓
WORKFORCE SELECTION PROPOSAL
 ↓
STOP
```

The control plane remains the final authority. Slice #7 creates no execution bridge.

## Workforce model

A workforce role represents organizational responsibility. A workforce employee is an organizational identity record only in this slice. Identity includes organization binding, name, role/category, responsibilities, status, employment type, reporting relationship, capability requirements, model-policy reference, context scope, QA responsibility, escalation policy and lifecycle metadata.

Supported lifecycle metadata distinguishes permanent and project/temporary specialists. Temporary specialists require explicit project scope and expiration metadata. No autonomous process is created.

## Employee vs worker

```text
EMPLOYEE / ROLE ≠ WORKER
ROLE ≠ PERMISSION
EMPLOYEE ≠ AUTHORITY
```

The registry contains no worker runtime, worker credentials, dispatch API, execution API, or autonomous process.

## Capability model

Capabilities describe the intelligence/work category required by a task. The registry supports capabilities such as research, strategy, product analysis, engineering, debugging, architecture, design, copywriting, SEO, growth, data analysis, security review, content QA and technical QA.

A capability does not grant a permission or capability token. Matching is deterministic.

## Capability contracts

Each capability can define required inputs, expected outputs, quality criteria, risk, required context scopes, QA responsibility, escalation conditions, model requirements and compatible provider characteristics.

Contracts describe work requirements. They do not authorize work.

## Provider/model registry

Providers are provider-neutral metadata records containing identity, type, availability, cost classification, supported workforce capabilities, routing eligibility and provenance. Models are represented independently with provider identity, capability metadata, context/quality/latency characteristics, availability, cost classification and routing eligibility.

No real provider SDK, secret, API key or network client is included.

## Eligibility

Eligibility is deterministic and considers organization ownership, provider/model availability, routing eligibility, required capabilities, context requirements and latency policy. Eligibility is not authorization.

```text
ELIGIBLE MODEL ≠ AUTHORIZED MODEL
MODEL ≠ WORKER
MODEL SELECTION ≠ AUTHORIZATION
```

## Free-first policy

The registry supports `FREE_FIRST` behavior through free/free-limited cost classes. Eligible free options are ordered before paid options. A policy can require a free eligible option and fail closed with `NO_FREE_ELIGIBLE_OPTION` when none exists.

The registry does not purchase, activate, bill, or spend money. Cost classification is configuration metadata and is not a permanent assertion about a provider's commercial offering.

## Temporary specialists

Temporary/project specialists are represented as scoped role/employee metadata with project identity and expiration. This slice does not autonomously create specialists, delegate work, create recursive agent trees, or execute lifecycle transitions.

## Context scope / least privilege

Roles carry explicit organization-bound context scope, optionally narrowed by business, project, department or working context. Context metadata does not grant access. The implementation rejects cross-organization model/provider metadata and requires project scope when the routing policy demands it.

Memory remains context, not authority; Slice #7 does not replace the Slice #4 governed memory boundary.

## QA responsibility

QA is represented as metadata: whether QA is required, whether it must be independent, the QA role, and quality criteria. Slice #7 does not run QA or rework.

## Escalation

Escalation metadata identifies reasons such as missing capability/context, high risk, quality failure, security concern, ambiguity, policy conflict or provider unavailability, and targets such as LEO, a QA role or the control plane. Escalation metadata does not itself trigger an action.

## LEO workforce-selection proposal

LEO-compatible deterministic selection can produce a `WorkforceSelectionProposal` for task requirements. A candidate records the role, required capabilities, rationale, eligible provider/model options, cost policy, context scope, QA responsibility and escalation policy.

The result is always:

```text
authority = PROPOSAL_ONLY
```

No employee is created merely by producing a proposal. No worker is created, dispatched or executed.

## Security boundary

Non-negotiable invariants:

- employee/role is not a worker;
- role is not permission;
- capability is not authority;
- model is not worker;
- provider is not executor;
- model selection is not authorization;
- capability matching is not permission grant;
- workforce proposal is not workforce creation;
- workforce proposal is not execution;
- approval required is not approval granted;
- model output cannot forge organization identity;
- no registry operation grants permissions, capabilities or approval;
- no registry operation accesses credentials or external systems.

Authority-bearing fields such as `organizationId` from an untrusted recommendation, `ownerUserId`, `grantedPermissions`, `grantedCapabilities`, `approvalGranted`, `workerId`, `credentialId`, `execute`, `dispatch`, `externalAction`, `permissionGrant`, `capabilityGrant` and `authorization` are not part of the workforce proposal contract.

## Organization isolation

Organization identity is authoritative and must match the workforce routing policy and task. Organization-owned providers/models are rejected when they belong to another organization. Workforce selection rejects cross-organization tasks and roles.

## Execution boundary

There is deliberately no path from Slice #7 to:

- Dispatcher
- WorkerRuntime
- ExecutionGateway
- handlers
- credentials
- external APIs
- Gmail, GitHub, Instagram, WhatsApp, Calendar or Google Drive
- MCP or n8n
- browser/computer automation
- payments or spending
- infrastructure mutation

The boundary ends at workforce registry/selection proposal data.

## Relationship to Slice #8

Slice #8 may later consume this registry to implement governed delegation and actual workforce work. Slice #7 does not implement:

```text
LEO → TASK → WORKFORCE SELECTION → AUTHORIZED WORKER → EXECUTION → QA
```

That loop remains outside this slice.

## Known limitations

- Registry is in-memory/provider-neutral metadata; no Prisma persistence was added.
- No real model provider integration exists.
- No provider billing or live availability verification exists.
- Workforce lifecycle is represented as validated metadata, not an autonomous lifecycle service.
- Workforce selection is deterministic and proposal-only.
- QA and escalation are represented, not executed.
- No delegation or worker execution is implemented.
