# LEO OS

**LEO = Leadership & Execution Operating System**

LEO OS is an internal AI-native operating system for running the founder's company workflows. It turns objectives into durable, permission-aware workflows executed by specialized AI agents and verified by the system.

## Internal / private status

LEO OS is currently a private internal operating system intended only for the founder's company and work. It is **not currently a public SaaS product**. No public deployment or publishing infrastructure is part of the current scope.

## V0.1 architecture

- Web: Next.js + React + TypeScript
- API: Fastify + TypeScript
- Worker: TypeScript workers backed by PostgreSQL jobs (pg-boss)
- Database: PostgreSQL + Prisma
- AI: provider abstraction with one initial provider adapter
- Integrations: adapter/connector architecture
- Auth: session-based authentication with RBAC
- Storage: S3-compatible object storage abstraction
- Observability: structured application events, audit log, metrics/tracing hooks

## Repository

```text
apps/web       LEO OS dashboard and command center (planned)
apps/api       HTTP API and application services
apps/worker    durable orchestration/execution workers
packages/db    Prisma schema and database client
packages/core  domain contracts and permission primitives
packages/config shared environment/config validation
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

The repository is being evolved incrementally through Phase 1. The current V1.05 work establishes the durable worker/job execution boundary and restart-safe persistence state. External integrations, model-provider connections and the Command Center UI remain intentionally out of scope until their later roadmap phase.

Some internal package names and legacy identifiers still use the historical `founder-os` / `founder_os` namespace for compatibility; these are technical compatibility identifiers, not the product identity.
