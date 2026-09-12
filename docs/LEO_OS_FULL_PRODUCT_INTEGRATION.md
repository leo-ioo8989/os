# LEO OS — Full Product Integration Contract

LEO OS is delivered as an installable private app surface (PWA-capable Command Center) backed by the governed API and existing control plane.

## User experience

1. User signs into LEO OS.
2. User opens **Integrations**.
3. User chooses an application and selects **Connect**.
4. LEO OS redirects to the provider's official OAuth consent screen.
5. After consent, the provider redirects to the LEO OS callback.
6. LEO OS verifies signed state, exchanges the authorization code server-side, encrypts tokens with `INTEGRATION_ENCRYPTION_KEY`, and stores them organization-scoped.
7. The browser receives only connection status; credentials never enter browser storage.
8. Capabilities become available to the LEO OS adapter/control plane only after the existing identity, permission and policy gates.
9. Disconnect revokes the local connection and prevents further use.

## Initial one-click connectors

- Google Workspace — Gmail, Calendar, Drive
- Slack
- GitHub

## Governed intelligence providers

OpenAI and Anthropic remain provider adapters rather than browser logins. They use server-side credentials and the existing model gateway/routing policy. They must never be called directly by the Command Center.

## Security contract

- OAuth state is signed and short-lived.
- OAuth code exchange happens server-side.
- Access/refresh tokens are encrypted at rest.
- Organization and user ownership are persisted with each connection.
- Integration management requires `integration:manage`.
- No token is returned by API catalog/status endpoints.
- Disconnect marks connections revoked.
- External actions remain subject to LEO OS authorization and execution policy.

## Required deployment configuration

`SESSION_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `API_PUBLIC_ORIGIN`, `COMMAND_CENTER_ORIGIN`, and provider OAuth client credentials must be supplied through the deployment secret manager. Never commit them.

This contract deliberately separates **connectivity** from **authority**: connecting an app gives LEO OS a governed capability; it does not grant an AI, workflow, UI or adapter independent execution authority.
