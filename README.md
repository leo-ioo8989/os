# LEO OS

**LEO = Leadership & Execution Operating System**

LEO OS is a private internal company operating system designed to turn intelligence into controlled, auditable execution. The architecture is complete through Phase 5 (V5.01–V5.12); the repository also includes the production-readiness surface described below.

## Architectural law

> **INTELLIGENCE MAY PROPOSE. POLICY MAY AUTHORIZE. THE CONTROL PLANE DECIDES. EXECUTORS EXECUTE. LEO OS RECORDS EVERYTHING IMPORTANT.**

No intelligence, agent, UI, adapter or workflow may become a second execution authority.

## Current state

- Phase 1: frozen / certified.
- Phase 2: frozen / certified.
- Phase 3: V3.01–V3.11 frozen / certified.
- Phase 4: V4.01–V4.12 implemented; certification gate previously passed.
- Phase 5: V5.01–V5.12 implemented; certification gate previously passed and freeze record created.
- Production-readiness layer: implemented on the `production-completion` branch.
- Runtime certification of the production-completion head remains a separate gate and has intentionally not been run yet.

## Runtime surfaces

```text
Command Center
      ↓
Authenticated API
      ↓
Identity + organization + permissions
      ↓
Existing LEO OS control plane
      ↓
Durable workflows / jobs / trusted workers
      ↓
Controlled execution
      ↓
Audit / provenance / recovery
```

### Command Center

`apps/command-center` is a dependency-free private web surface for operational visibility. It reads live objectives through the authenticated API and does not hold execution authority or credentials.

### API

`apps/api` provides authenticated, organization-scoped control-plane operations for objectives, tasks and dependencies. It exposes:

- `GET /health` — process liveness.
- `GET /ready` — database-backed readiness; only succeeds after PostgreSQL responds.

## Private-by-design boundary

LEO OS remains private internal infrastructure. This completion pass does not connect public SaaS providers, Gmail, Instagram, MCP, model providers, n8n, browser automation or other external systems. Adapter boundaries exist architecturally, but real external credentials/actions remain an explicit future authorization decision.

## Development

```bash
pnpm install
pnpm db:start
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:smoke
pnpm dev
```

For the production-readiness baseline, see `docs/LEO_OS_PRODUCTION_READINESS.md`.

## Compatibility

Some package and database identifiers retain the historical `founder-os` / `founder_os` namespace for compatibility. The product identity is LEO OS.
