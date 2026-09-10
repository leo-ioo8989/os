# FOUNDER OS V0.1 — Engineering Specification

## 1. Mission
FOUNDER OS converts founder objectives into durable, observable, permission-aware execution graphs. It is a control plane, not a chatbot.

## 2. Architecture

```text
Founder UI
  -> API/Auth/RBAC
  -> Command Service
  -> Orchestrator
  -> Planner -> Task Graph -> Scheduler/Queue
  -> Agent Runtime
  -> Model Router -> Provider Adapter
  -> Tool Gateway -> Connector/API/MCP
  -> Validation/QA
  -> Permission Engine -> Approval Center when required
  -> Action Executor
  -> Audit/Event Stream + Metrics
  -> Company Memory
  -> Workflow state / next-action evaluation
```

### Components
- `web`: dashboard, command center, projects, tasks, agents, tools, approvals, memory, audit.
- `api`: authenticated HTTP boundary; domain/application services; no direct UI-to-provider access.
- `worker`: durable background jobs, task execution, retries, timeouts, escalation.
- `db`: PostgreSQL as source of truth for operational state.
- `core`: domain contracts, enums, policy evaluation interfaces.
- `connectors`: provider-specific integrations behind stable interfaces.
- `docs`: architecture, security, API and operations documentation.

## 3. Repository structure

```text
apps/
  web/
  api/
  worker/
packages/
  core/
  db/
  config/
  connectors/
docs/
  FOUNDER-OS-V0.1-SPEC.md
  security.md
  api.md
  operations.md
```

## 4. Database model

Core entities:
- `users`, `roles`, `user_roles`, `sessions`
- `organizations`, `memberships`
- `projects`, `milestones`
- `objectives`
- `tasks`, `task_dependencies`, `task_attempts`
- `agents`, `agent_capabilities`, `agent_tool_bindings`
- `tools`, `tool_permissions`
- `permission_policies`, `permission_decisions`
- `approvals`, `approval_events`
- `memory_items`, `memory_versions`
- `artifacts`
- `workflow_runs`, `workflow_events`
- `audit_events`
- `model_providers`, `model_configs`, `model_usage`
- `integrations`, `credentials_metadata`

Every company-owned row is tenant-scoped by `organization_id`. Sensitive credentials are never stored as plaintext application data.

### State conventions
Tasks: `PENDING | READY | RUNNING | BLOCKED | AWAITING_APPROVAL | SUCCEEDED | FAILED | CANCELLED`.
Workflow runs: `PENDING | RUNNING | PAUSED | SUCCEEDED | FAILED | CANCELLED`.
Risk: `GREEN | YELLOW | RED`.

## 5. API architecture

Versioned REST API initially:

```text
/api/v1/auth/*
/api/v1/objectives/*
/api/v1/projects/*
/api/v1/tasks/*
/api/v1/agents/*
/api/v1/tools/*
/api/v1/approvals/*
/api/v1/memory/*
/api/v1/audit/*
/api/v1/workflows/*
/api/v1/models/*
/api/v1/integrations/*
```

Rules:
- authentication and authorization before domain execution;
- idempotency keys for action endpoints;
- request/response schemas validated at the boundary;
- pagination on collections;
- correlation/request IDs;
- errors use stable machine-readable codes;
- secrets never returned by API.

## 6. Agent architecture

An agent is a constrained runtime identity, not merely a prompt.

```text
AgentDefinition
  identity
  role
  capabilities
  allowed tools
  forbidden tools
  model policy
  cost policy
  memory scopes
  execution limits
  output contract
```

The runtime receives only the tools, memory and context granted for the current task.

## 7. Tool architecture

```text
Agent
 -> Tool Gateway
 -> policy check
 -> schema validation
 -> connector
 -> external API/MCP
 -> result validation
 -> audit event
```

Tool metadata includes ID, version, schemas, risk class, required permission, allowed agents, authentication reference, rate limit and cost metadata.

## 8. Permission architecture

Permission is evaluated server-side immediately before every external or consequential action. Policy is based on organization, actor/agent, tool, action, target, environment, risk and approval state.

- GREEN: execute if policy permits.
- YELLOW: create approval request and pause workflow; execution token is unavailable until approval.
- RED: deny machine execution; route to Founder/manual process.

Prompt instructions are never a security boundary.

## 9. Approval architecture

Approval is a durable state machine:
`REQUESTED -> APPROVED | REJECTED | CHANGES_REQUESTED | EXPIRED`.

An approval is bound to a specific action intent, target, payload hash, risk classification and policy version. Approving one intent does not grant broad future access.

## 10. Memory architecture

Memory is structured, scoped and provenance-aware. Each item stores source, timestamp, confidence, owner/scope, content hash/version and lifecycle metadata. Retrieval is permission-filtered. Agent-generated claims are marked with provenance and cannot silently become authoritative company facts.

V0.1 uses PostgreSQL storage and metadata-first retrieval; vector retrieval can be added without changing the memory contract.

## 11. Audit/observability

Meaningful state transitions and tool actions emit immutable audit events with timestamp, actor, agent, task, workflow, tool, action metadata, decision, approval reference, result metadata, errors, retry count and cost where available.

Application logs, metrics and traces use correlation IDs. Secrets and sensitive payloads are redacted.

## 12. Workflow/task architecture

Objectives become projects/tasks through a planner. Dependencies form a DAG. Only dependency-satisfied tasks enter `READY`. Workers claim tasks transactionally, execute with timeout, validate output, persist artifacts/results, and schedule successors.

Retries are bounded and policy-driven. A retry preserves prior attempt evidence. Repeated failure transitions to `FAILED`/escalation rather than looping indefinitely.

## 13. Model provider architecture

```text
ModelRouter
  -> ProviderAdapter interface
      -> OpenAI adapter (initial)
      -> future Anthropic/Google adapters
```

The router chooses by task type, capability, context, latency, reliability and cost policy. Provider SDK types do not leak into domain contracts.

## 14. Integration architecture

Connectors are modular adapters. OAuth/API credentials are represented by references to a secret store or platform credential mechanism. GitHub and n8n are first-class connector interfaces in V0.1; actual external actions require configured credentials and permissions.

## 15. Security architecture

- tenant isolation and RBAC;
- least privilege by agent/tool/action;
- server-side authorization;
- encrypted transport and encrypted secret storage;
- no secrets in prompts, logs or source control;
- development/staging/production separation;
- sandboxed code execution for untrusted/generated code;
- outbound network restrictions where appropriate;
- schema validation and output sanitization;
- prompt-injection-aware handling of external content;
- approval gates for consequential actions;
- rate/cost limits;
- auditability and incident-ready logs.

## 16. Deployment

Bootstrapped target:
- one web service;
- one API service;
- one worker service;
- managed or self-hosted PostgreSQL;
- object storage when artifacts require it;
- optional Redis only when a demonstrated need exists.

CI runs typecheck, lint, unit/integration tests and security checks. Production deployments are separated from development credentials and databases.

## 17. Environment configuration

Configuration is validated at startup. Required secrets are supplied through environment/secret management and are never committed. `.env.example` contains names and safe placeholders only.

## 18. Testing strategy

- unit tests for domain rules and permission decisions;
- integration tests for database transactions and API authorization;
- contract tests for connectors and model adapters;
- workflow tests for dependency/retry/approval behavior;
- security tests for tenant isolation and privilege escalation;
- end-to-end smoke tests for command -> plan -> task -> approval -> completion.

## 19. V0.1 implementation order

1. Repository/tooling foundation.
2. PostgreSQL schema + migrations.
3. Authentication/RBAC.
4. Agent/tool registries.
5. Permission engine.
6. Approval center.
7. Memory.
8. Audit/observability.
9. Orchestrator/task graph/workers.
10. Model provider abstraction + initial provider.
11. GitHub/n8n connector foundations.
12. Founder dashboard/command center.
13. Hardening, tests and documentation.

## 20. Acceptance criteria

V0.1 is accepted when a founder can authenticate, create an objective, inspect a generated project/task graph, see agent/tool assignments, execute an allowed task, observe durable workflow state, encounter a real approval gate for a yellow action, see the audit trail, retrieve provenance-aware memory, observe bounded retries/failure escalation, and use a provider adapter without domain code depending on its SDK.

No acceptance criterion may depend on simulated success for a security-sensitive path.
