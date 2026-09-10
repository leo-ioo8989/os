# LEO OS

**LEO = Leadership & Execution Operating System**

LEO OS is a private internal operating system for running the founder's company workflows. Phase 1 is control-plane infrastructure: durable objectives, tasks, workflows, jobs, trusted workers, approvals, checkpoints, audit state, deterministic orchestration and controlled internal execution.

## Internal / private status

LEO OS is private internal infrastructure for the founder's company/work. It is **not a public SaaS product**. No public deployment or external integration work is in scope.

## Current Phase 1 architecture

```text
Objective
  ↓
Workflow
  ↓
Task / Dependency Graph
  ↓
Durable Job
  ↓
Deterministic Orchestrator
  ↓
Job Dispatcher
  ↓
Trusted Worker Runtime
  ↓
Execution Gateway
  ↓
Approval when required
  ↓
Controlled internal Handler
  ↓
Result Validation
  ↓
Atomic workflow advancement
  ↓
Next durable task/job or terminal state
  ↓
Audit / company memory
```

Workflow and Job state are persisted independently but coordinated through serializable repository transactions. Workflow progression uses explicit current-task/current-job pointers, deterministic task selection and organization-scoped Job idempotency. Reconciliation reads durable state after restart and repairs only states that can be proven safe.

## Repository

```text
apps/api       HTTP API and application services
apps/worker    orchestrator, dispatcher and controlled worker runtime
packages/db    Prisma schema, repositories and transactions
packages/core  deterministic domain state machines and permission primitives
docs/          architecture, security, API and operations docs
```

## Development / verification

1. Copy `.env.example` to `.env` and provide safe local values.
2. Start the disposable PostgreSQL verification environment.
3. Install dependencies with `pnpm install`.
4. Generate and validate Prisma.
5. Apply migrations.
6. Run typecheck, lint, unit and integration tests.

The V1.07 disposable PostgreSQL 16 environment remains available on local port `55432` with database `founder_os_test`.

```bash
pnpm install
pnpm db:start
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:smoke
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm verify:v108
```

**Environment/configuration is not runtime proof.** The current execution session has not successfully executed PostgreSQL, Prisma or the test suite.

## V1.08

V1.08 implements a callable deterministic Orchestrator cycle, workflow Job bootstrap, deterministic Job Dispatcher, controlled Worker Runtime, internal test-safe Handler Registry and result validation. It deliberately contains no AI agents, model providers, MCP, external APIs, browser/computer automation, autonomous external actions or Command Center UI.

See `docs/V1.08_ORCHESTRATOR_WORKER_RUNTIME.md`.

**Current truthful status: V1.08 — IMPLEMENTED, RUNTIME VERIFICATION BLOCKED.**

V1.07 remains **V1.07 — IMPLEMENTED, RUNTIME VERIFICATION BLOCKED** until its live PostgreSQL verification evidence exists.

Some internal package names and legacy identifiers still use the historical `founder-os` / `founder_os` namespace for compatibility; these are technical compatibility identifiers, not the product identity.
