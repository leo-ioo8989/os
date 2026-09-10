# LEO OS

**LEO = Leadership & Execution Operating System**

LEO OS is a private internal operating system for running the founder's company workflows. The current Phase 1 implementation is control-plane infrastructure: durable objectives, tasks, workflows, jobs, trusted workers, approvals, checkpoints and audit state.

## Internal / private status

LEO OS is currently a private internal operating system intended only for the founder's company and work. It is **not currently a public SaaS product**. No public deployment or publishing infrastructure is part of the current scope.

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
Trusted Worker
  ↓
Execution Gateway
  ↓
Approval Gateway when required
  ↓
Job result / checkpoint
  ↓
Atomic workflow advancement
  ↓
Next durable task/job or terminal workflow state
  ↓
Audit / company memory
```

Workflow and Job state are persisted independently but coordinated through serializable repository transactions. Workflow progression uses an explicit current-task/current-job pointer, deterministic task selection and job idempotency keys. Reconciliation reads durable state after restart and only repairs states that can be proven safe; ambiguous states are surfaced rather than guessed.

## Repository

```text
apps/api       HTTP API and application services
apps/worker    durable worker/job boundary
packages/db    Prisma schema, repositories and transactions
packages/core  deterministic domain state machines and permission primitives
docs/          architecture, security, API and operations docs
```

## Development

1. Copy `.env.example` to `.env` and provide required local values.
2. Start PostgreSQL.
3. Install dependencies with `pnpm install`.
4. Run Prisma migrations/generate.
5. Start available services in development mode.

No production credentials are committed to this repository.

## Current scope

The repository is being evolved incrementally through **Phase 1**. **V1.07** establishes durable Workflow↔Job coordination, deterministic next-task selection, workflow/job idempotency, atomic success/retry/approval coordination, cancellation, checkpoint-compatible resumable state and restart-safe reconciliation. External integrations, AI agents, model providers and the Command Center UI remain intentionally out of scope.

Some internal package names and legacy identifiers still use the historical `founder-os` / `founder_os` namespace for compatibility; these are technical compatibility identifiers, not the product identity.
