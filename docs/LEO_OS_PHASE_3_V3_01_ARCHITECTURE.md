# LEO OS — V3.01 REAL PROVIDER & CREDENTIAL FOUNDATION

**Status:** IMPLEMENTATION
**Phase 1:** VERIFIED/CERTIFIED and frozen
**Phase 2:** VERIFIED/CERTIFIED, exactly 17 slices, frozen
**Version:** V3.01

## Purpose

V3.01 establishes the first real-world provider and credential boundary. It does not replace the Phase-1 control plane or create a second executor. It provides the typed infrastructure boundary through which future real providers can be reached by already-authorized execution contexts.

## Architecture

```text
OWNER INTENT
  ↓
LEO EXECUTIVE
  ↓
PLAN / CAPABILITY REQUIREMENTS
  ↓
WORKFORCE + PROVIDER ELIGIBILITY
  ↓
MODEL RUNTIME
  ↓
EXISTING CONTROL-PLANE AUTHORIZATION
  ↓
AUTHORIZED WORKER
  ↓
PROVIDER GATEWAY
  ↓
CREDENTIAL BROKER
  ↓
PROVIDER ADAPTER
  ↓
REAL PROVIDER
  ↓
MODEL RESPONSE
  ↓
EXISTING RESULT VALIDATION / OUTCOME PATH
```

## Security invariants

- Model output is untrusted data.
- Provider selection is not authorization.
- Model selection is not authorization.
- Credential references are not credentials and credentials are not authority.
- Agents and models never receive raw credentials.
- A provider cannot grant worker authority, permissions, capabilities, approval, or spending authority.
- Organization ownership is authoritative and cannot be supplied by model output.
- Credential and provider organization bindings must match the authoritative execution context.
- Revoked, expired, disabled, or mismatched credentials fail closed.
- Provider responses require provenance validation before entering governed downstream processing.
- Secrets never enter prompts, model context, ordinary audit payloads, or response metadata.
- V3.01 introduces no shadow executor, dispatcher, worker runtime, approval engine, or control plane.

## Provider boundary

`ProviderRegistry` describes which providers/models exist, their capabilities, policy class, organization binding, and provenance. It does not authorize execution.

`ProviderAdapter` is provider-specific translation. It receives a credential lease only inside the broker-controlled operation and returns a provider-neutral response.

`ProviderGateway` validates the authoritative call context, provider binding, model support, credential binding/status, and response provenance. It does not create authorization.

## Credential boundary

`CredentialReference` contains only a stable reference and governance metadata:

- credential ID;
- organization ID;
- provider ID;
- status;
- scope;
- version.

`CredentialBroker` is the only boundary that resolves a reference into a secret lease. The secret is scoped to the provider operation and is not part of `ProviderRequest`.

The V3.01 test broker is deterministic test infrastructure. Production deployments must bind `CredentialBroker` to an approved secret-management mechanism; secrets must not be committed to source control.

## Failure semantics

Failures are normalized into typed codes including provider unavailable/disabled, unsupported model, credential missing/revoked/expired/disabled, organization/provider mismatch, authorization required, invalid provider response, and provider failure.

Transient provider failures may be retryable. Authorization, organization, credential-binding, and provenance failures are not silently retried as permission grants.

## Explicit non-goals

V3.01 does not implement YouTube, Gmail, GitHub external operations, browser automation, media production, autonomous loops, spending execution, or general tool adapters. Those remain later Phase-3 versions.

## Certification boundary

V3.01 is complete only when the implementation and certification workflow prove:

1. provider registration and deterministic identity;
2. credential reference binding;
3. credential isolation by organization and provider;
4. no raw-secret propagation into model/provider-neutral request data;
5. authorized-worker context requirement;
6. provider/model eligibility checks;
7. revocation/expiry/disable fail-closed behavior;
8. response provenance validation;
9. structured failure behavior;
10. Phase-1 and Phase-2 regression compatibility;
11. no new executor/control plane/authority grant;
12. typecheck, lint, build, unit/integration tests and official certification workflow all pass.
