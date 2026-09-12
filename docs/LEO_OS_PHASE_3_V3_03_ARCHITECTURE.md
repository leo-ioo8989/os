# LEO OS V3.03 — Real AI Model Providers & Governed Routing

## Purpose
V3.03 upgrades the model boundary from deterministic/test providers to real provider adapters while preserving the Phase 1 control plane and Phase 2 governance boundaries.

## Authoritative chain
OWNER INTENT → LEO EXECUTIVE → PLAN/CAPABILITY REQUIREMENTS → EXISTING MODEL ROUTING POLICY → AUTHORIZED PROVIDER BINDING → CREDENTIAL BROKER → REAL PROVIDER ADAPTER → PROVIDER RESPONSE → PROVENANCE VALIDATION → EXISTING GOVERNED PIPELINE.

## Providers
The implementation supplies provider-neutral asynchronous interfaces and adapters for OpenAI and Anthropic. Provider-specific HTTP translation is isolated inside adapters. The production HTTP transport uses the platform's `fetch` implementation with bounded request timeouts.

No provider SDK is required, and no provider-specific logic is placed in CEO reasoning or planning.

## Credential boundary
Model requests, routing results, and returned model responses contain no credential secret. A credential reference identifies an authorized provider binding; only the credential broker resolves secret material into a short-lived in-process lease passed to the adapter. The model and agent layers never receive the lease.

The credential resolver is injected by the hosting platform. V3.03 does not invent a new persistent secret store or duplicate V3.01 credential authority.

## Routing
`GovernedRealModelRuntime` applies organization, provider/model allowlists, availability, required capability, quality and cost constraints before attempting a provider. Fallback is permitted only when both the requirement and routing policy allow it. Provider/model identity is checked again on the response and provenance mismatch fails closed.

Provider selection is not worker authorization, and credential possession is not authority.

## Failure boundary
Authentication, authorization, rate limit, timeout, provider error and malformed response conditions remain structured failures. Retry/fallback is bounded by the existing routing policy. A provider response is data only; it cannot authorize execution, grant a capability, approve an action, select a worker, or mutate company state.

## Non-goals
- No Gmail, YouTube, Instagram, WhatsApp or other business integration.
- No browser/computer automation.
- No media generation.
- No autonomous operating loop.
- No new executor or control plane.
- No agent-owned credentials.
- No payment/spending authority.
- No new persistent secret store.

## Certification target
The V3.03 gate must prove real-provider translation, timeout/failure handling, routing allowlists, organization isolation, credential isolation, provenance validation, bounded fallback, existing Phase 1/Phase 2 regression, build/typecheck/lint, unit tests and integration tests.
