# LEO OS — Phase 2 Slice #5 — Model Runtime & Routing Boundary

**Status: IMPLEMENTED — CERTIFICATION PENDING**  
**Scope:** provider-neutral model capability, deterministic routing, runtime invocation, provenance, and fail-closed fallback only.

## 1. Purpose

Slice #5 introduces the governed runtime boundary between LEO OS intelligence and replaceable model providers. A model is a cognitive engine, not an authority system. Model selection never grants permissions, capabilities, approvals, credentials, worker identity, or execution authority.

## 2. Architecture

```text
OWNER / INTENT
      ↓
MODEL REQUIREMENT
      ↓
MODEL ROUTING POLICY
      ↓
DETERMINISTIC MODEL ROUTER
      ↓
ELIGIBLE MODEL
      ↓
MODEL RUNTIME
      ↓
MODEL PROVIDER
      ↓
MODEL RESPONSE
      ↓
PROVENANCE / RESPONSE VALIDATION
      ↓
CEO REASONING / GOVERNED PROCESSING
      ↓
PLAN PROPOSAL
      ↓
CERTIFIED CONTROL PLANE
```

The runtime has no execution, worker, credential, approval-granting, or external-action interface.

## 3. Model capability abstraction

Capabilities are technical characteristics only:

- `reasoning`
- `structured_output`
- `long_context`
- `vision`
- `coding`
- `tool_use`

A capability does not create authorization. For example, `coding` does not authorize repository modification and `tool_use` does not authorize tool execution.

## 4. Model definition

`ModelDefinition` describes a provider-neutral model:

- provider ID
- model ID
- capabilities
- quality tier
- cost metadata
- latency metadata
- availability
- context metadata
- version
- provenance
- optional organization ownership

Definitions are configuration/data. They do not contain credentials or authority grants.

## 5. Model requirement

`ModelRequirementProfile` expresses cognitive requirements and routing constraints:

- request/correlation identity
- organization/owner context when applicable
- purpose
- required/preferred capabilities
- minimum quality tier
- latency sensitivity
- maximum cost
- fallback allowance
- timestamp
- model input/context
- timeout metadata

It deliberately has no permission grant, capability grant, approval grant, worker, credential, execute, or dispatch field.

## 6. Routing policy

`ModelRoutingPolicy` controls eligibility through deterministic configuration:

- policy version
- optional provider allowlist
- optional model allowlist
- optional quality-tier allowlist
- fallback policy
- organization-match requirement

The router is not the policy engine for execution. It only determines model eligibility under this model-routing policy.

## 7. Routing algorithm

Given the same request, registry, and policy, routing is deterministic.

Eligibility requires:

1. organization boundary satisfied
2. provider/model allowlists satisfied
3. model available
4. all required capabilities present
5. minimum quality satisfied
6. maximum cost satisfied

Eligible models are ranked by:

1. preferred-capability score
2. quality tier
3. latency when latency-sensitive
4. input cost
5. stable provider/model identifier tie-breaker

No free-form model output influences routing.

## 8. Routing result

`ModelRoutingResult` records:

- request ID
- organization context
- selected provider/model
- deterministic selection reason
- eligible candidates and reasons
- policy version
- fallback allowance
- correlation ID
- deterministic routing provenance

It contains no authorization grants.

## 9. Runtime responsibilities

`ModelRuntime`:

1. validates requirements
2. invokes deterministic routing
3. resolves only an eligible registered provider
4. constructs the provider-neutral `ModelRequest`
5. invokes the existing `ModelProvider` abstraction
6. validates response shape
7. verifies provider/model/request/correlation provenance
8. returns success data or structured failure
9. attempts fallback only among already eligible routed candidates

The runtime does not execute tasks, dispatch jobs, approve actions, grant authority, access credentials, mutate workflow state, or invoke execution handlers.

## 10. Provider responsibilities

A provider implements the existing provider-neutral `ModelProvider` contract. Slice #5 adds no real provider. The deterministic local test model remains the only provider implementation used by tests.

A provider response is untrusted data until validated by the runtime and subsequent governed processing.

## 11. Fallback behavior

Fallback is permitted only when both request and routing policy allow it. Candidates come exclusively from the deterministic eligible set.

```text
PRIMARY FAILURE
      ↓
FALLBACK ALLOWED?
      ↓
NEXT ELIGIBLE CANDIDATE
      ↓
INVOKE
      ↓
SUCCESS → RETURN
FAILURE → NEXT / FAIL CLOSED
```

No silent provider invention, policy bypass, or lower-security substitution is permitted. Every attempted candidate is returned in the runtime result.

Non-provider failures such as invalid request/response or provenance mismatch fail closed rather than being hidden by fallback.

## 12. Provenance

The request identity, correlation ID, provider ID, and model ID are carried from requirement → routing → provider request → response. A response whose identity differs from the routed provider/model or whose provenance claims a different request/correlation fails closed with `PROVENANCE_MISMATCH`.

## 13. Organization isolation

Organization identity is supplied by the request context. Organization-owned model definitions are eligible only for their matching organization when organization matching is required. Model metadata cannot override authoritative organization or owner identity.

Global provider/model definitions may be shared configuration; organization-owned definitions cannot cross the organization boundary.

## 14. Budget and cost

Cost is routing metadata only. Maximum cost excludes models whose declared input cost exceeds the request constraint. No billing, payment, purchasing, or automatic spending exists in this slice.

An over-budget model is ineligible; the runtime does not silently select an unauthorized alternative outside policy.

## 15. Failure behavior

The runtime represents at minimum:

- `NO_ELIGIBLE_MODEL`
- `ROUTING_POLICY_REJECTED`
- `PROVIDER_UNAVAILABLE`
- `MODEL_UNAVAILABLE`
- `TIMEOUT`
- `INVALID_REQUEST`
- `INVALID_RESPONSE`
- `PROVIDER_FAILURE`
- `PROVENANCE_MISMATCH`
- `FALLBACK_EXHAUSTED`

Failures are structured and fail closed.

## 16. Security boundary

```text
MODEL SELECTION ≠ AUTHORIZATION
MODEL CAPABILITY ≠ PERMISSION
MODEL OUTPUT ≠ COMMAND
MODEL OUTPUT ≠ APPROVAL
MODEL ROUTER ≠ POLICY ENGINE
MODEL PROVIDER ≠ AUTHORIZED WORKER
MODEL FAILURE ≠ EXECUTION
ROUTING ≠ EXECUTION
```

The existing Phase 1 control plane remains authoritative for permissions, capabilities, approvals, workers, credentials, jobs, workflows, and execution.

## 17. Explicit non-goals

This slice does not implement:

- real model providers
- provider SDKs
- API keys or secrets
- network calls
- billing or payments
- external integrations
- MCP
- n8n
- tools or browser automation
- AI workforce or employees
- LEO Executive Identity
- delegation
- persistent conversations
- vector databases
- embeddings/RAG
- autonomous loops
- Command Center UI

## 18. Testing

Focused coverage includes capability matching, required-capability rejection, preferred capability ranking, quality, budget, latency, allowlists, deterministic routing, no eligible model, policy rejection, provider failures, timeout, fallback success/exhaustion, fallback policy boundaries, provenance, organization isolation, authority absence, invalid input, unregistered providers, and execution-side-effect absence. Existing Slice #2/#3/#4 and Phase 1 regression gates remain mandatory.

## 19. Future real-provider boundary

A future provider integration may implement `ModelProvider` behind this runtime. It must not change the control-plane authority model. Provider credentials, network access, provider-specific adapters, rate limits, and provider health policies belong outside the core routing contract and require a separately approved slice.

## 20. Certification boundary

Certification applies only to the provider-neutral model runtime/routing boundary and compatibility with certified prior slices. It does not certify any real provider, external model API, billing system, workforce, delegation, tool execution, or autonomous operation.
