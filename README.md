# FOUNDER OS

FOUNDER OS is an AI-native operating system for running a company. It turns founder objectives into durable, permission-aware workflows executed by specialized AI agents and verified by the system.

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
apps/web       Founder dashboard and command center
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
5. Start web, API and worker in development mode.

No production credentials are committed to this repository.
