# LEO OS — Integration Setup

The integration layer is implemented in `packages/core/src/integration-runtime.ts` and `google-workspace-runtime.ts`. All providers are disabled by default.

## AI

Set `LEO_OS_OPENAI_ENABLED=true` and `OPENAI_API_KEY` for OpenAI, or `LEO_OS_ANTHROPIC_ENABLED=true` and `ANTHROPIC_API_KEY` for Anthropic.

## Google Workspace

Create a Google OAuth application, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and obtain an access token with only the scopes needed for Gmail, Calendar and/or Drive. Set `LEO_OS_GOOGLE_ENABLED=true` and `GOOGLE_ACCESS_TOKEN` in the private runtime.

## Slack

Create a Slack app/bot with the minimum required scopes, install it into the company workspace, set `SLACK_BOT_TOKEN`, and set `LEO_OS_SLACK_ENABLED=true`.

## GitHub

Use a GitHub App or fine-grained token with only the repositories and operations LEO OS needs. Set `GITHUB_TOKEN` and `LEO_OS_GITHUB_ENABLED=true`.

## Important

The code cannot create third-party accounts, OAuth applications, consent grants, or secrets on behalf of the company. Those credentials must be provisioned by an authorized administrator. Never commit secrets to Git. Use the deployment secret store/environment.

After credentials are provisioned, integration smoke tests and the full Phase 1–5 certification gate must be run. A provider must not be considered production-live merely because its adapter exists.
