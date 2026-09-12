# LEO OS — Production Readiness Baseline

## Purpose

This document closes the productization gap between the certified Phase 1–5 architecture and a usable private internal system. It is an implementation baseline, not a claim of runtime certification.

## Included

- Private dependency-free Command Center web application under `apps/command-center`.
- API liveness probe at `GET /health`.
- API database readiness probe at `GET /ready`; it returns ready only after a successful PostgreSQL query.
- Existing authenticated, organization-scoped objective/task API remains the source of live operational state.
- No second control plane, executor, policy engine, or authorization source is introduced.
- Command Center is read-only in this baseline; mutations continue through the authenticated API and existing control-plane services.
- Existing Phase 4/5 intelligence remains proposal-oriented and cannot directly grant execution authority.

## Local operation

1. Start PostgreSQL with `pnpm db:start`.
2. Apply schema with `pnpm db:generate && pnpm db:migrate`.
3. Start API with `pnpm --filter @founder-os/api dev`.
4. Start Command Center with `pnpm --filter @founder-os/command-center dev`.
5. Open the Command Center on its configured local port.
6. Authenticate through the existing session mechanism and provide the organization context required by the API.

## Security boundary

The Command Center does not store credentials or bypass API authorization. Browser state is not treated as authority. The API remains responsible for authentication, organization selection, permission checks and control-plane mutations.

## Runtime certification

The repository must still be certified from the resulting production-completion head before this state is called runtime-certified. Code completion and certification are intentionally separate gates.
