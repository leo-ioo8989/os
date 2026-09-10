# LEO OS — Phase 2 Slice #2 — Provider-Neutral Model Boundary

**Status:** IMPLEMENTED — VERIFICATION PENDING
**Phase 1:** Frozen and certified
**Phase 2 Slice #1:** Verified / certified

## 1. Boundary

Slice #2 establishes a provider-neutral intelligence contract only:

```text
OWNER INTENT
    ↓
STRUCTURED INTENT
    ↓
MODEL REQUEST
    ↓
MODEL PROVIDER
    ↓
MODEL RESPONSE
    ↓
GOVERNED PLAN PROPOSAL ADAPTER
    ↓
EXISTING TASK GRAPH VALIDATOR
    ↓
STOP
```

The model layer produces data. It does not execute work.

## 2. Implemented

- `packages/core/src/model.ts`: provider-neutral request, response, provider, failure, usage, timeout/budget metadata, and provenance contracts.
- `packages/core/src/model.ts`: deterministic local test provider with deterministic success and configured failure behavior.
- `packages/core/src/model-plan-adapter.ts`: fail-closed conversion from untrusted model plan output into the existing `PlanProposal` contract.
- `packages/core/src/index.ts`: additive exports.
- focused tests for the model contract, deterministic behavior, failures, provenance, malformed output, authority separation, organization identity, and proposal integration.

## 3. Authority boundary

The model response is untrusted data. The adapter supplies authoritative `organizationId`, `sourceIntentId`, and `authority: 'PROPOSAL_ONLY'` from the application/OwnerIntent boundary.

Model output cannot grant:

- permissions;
- capabilities;
- approvals;
- worker authorization;
- credentials;
- execution authority.

Required permissions and capabilities remain proposal requirements only. `approvalRequired` remains a requirement, not an approval grant. `proposedWorkerRole` remains metadata only.

## 4. Provenance

Every model response carries:

- provider identity;
- model identity;
- request identity;
- response identity;
- timestamp;
- correlation identity;
- deterministic/test provenance;
- success/failure status.

No persistence system is introduced.

## 5. Failure contract

Failures are explicit and distinguishable from success. Supported failure categories are:

- provider unavailable;
- timeout;
- invalid request;
- invalid response;
- provider failure;
- unsupported operation.

A failed model response cannot become a PlanProposal.

## 6. Deterministic test provider

`DeterministicTestModel` has no network, API key, model SDK, credential, or execution dependency. Response identity and output are deterministic from the request and configured failure behavior.

It exists solely for domain testing and does not represent a production model provider.

## 7. Plan Proposal integration

`modelResponseToPlanProposal()` is the only model-to-proposal seam. It:

1. rejects failed responses;
2. verifies response/provenance correlation;
3. validates the model plan output shape and known permission/risk values;
4. takes organization identity from `OwnerIntent`, not model output;
5. constructs a `PlanProposal` with `PROPOSAL_ONLY` authority;
6. invokes the existing `validatePlanProposal()`;
7. therefore terminates at the existing authoritative `validateTaskGraph()`.

No model response directly enters the Phase 1 execution path.

## 8. Explicitly not implemented

This slice does not implement:

- OpenAI, Anthropic, Gemini, OpenRouter, Ollama, or any real provider;
- network requests or API keys;
- provider routing or paid/free selection;
- autonomous CEO reasoning or loops;
- memory, vector databases, or knowledge systems;
- employee/delegation runtime;
- external tools or integrations;
- browser/computer automation;
- spending, payments, contracts, or external communication;
- Command Center;
- automatic workflow/job creation;
- worker dispatch or execution.

## 9. Compatibility

Slice #2 is additive to Slice #1 and Phase 1. The existing PlanProposal contract and TaskGraph validator remain the governed seam. No database schema, migration, API endpoint, worker, dispatcher, orchestrator, execution gateway, or Phase 1 certification artifact is changed by this slice.

Removing the Slice #2 modules and their exports/tests leaves the previously certified Phase 1 and Slice #1 layers structurally intact.

## 10. Verification state

This document intentionally remains **VERIFICATION PENDING** until the repository's actual CI verification completes successfully. No certification is claimed by implementation alone.
