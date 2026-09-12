# LEO OS — Full Product Runtime

## Product boundary

LEO OS is the private company operating system. Intelligence may propose; policy may authorize; the control plane decides; executors execute; LEO OS records important actions.

## Integrated runtime surfaces

- Command Center: private local operational UI.
- API: authenticated organization-scoped control-plane API.
- Database: durable operational state and migrations.
- AI providers: provider-neutral gateway with governed OpenAI and Anthropic HTTP adapters.
- Google Workspace: Gmail, Calendar and Drive adapters through Google OAuth access tokens.
- Slack: authenticated Web API adapter.
- GitHub: authenticated REST API adapter.
- Existing internal workflow, worker, audit, recovery, security and governance modules remain the authoritative control path.

## Provider activation

External integrations are disabled by default. An integration becomes callable only when its explicit enable flag and required credential are present. Missing credentials fail closed. Secrets are read from environment variables and are never written into source code.

This repository cannot manufacture third-party OAuth credentials or API keys. To make an external provider live, the company owner must supply credentials in the deployment environment and configure the provider's redirect/permissions. That is an operational secret-management step, not a code placeholder.

## Required production sequence

1. Configure secrets in the private runtime environment.
2. Configure Google OAuth redirect and least-privilege scopes if Google is enabled.
3. Enable only the providers actually required.
4. Start database, API, worker and Command Center.
5. Execute integration smoke tests with test accounts/workspaces.
6. Execute full Phase 1–5 regression and adversarial certification.
7. Fix any failure and start a fresh certification run.
8. Freeze only after all gates are green.

## Safety

No integration is allowed to bypass authorization, policy, control-plane decisions, execution governance, audit/provenance, quota/cost boundaries or recovery behavior. Real external actions remain subject to the existing approval and governance layers.
