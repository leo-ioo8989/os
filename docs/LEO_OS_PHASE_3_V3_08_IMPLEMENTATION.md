# LEO OS V3.08 — Observability, Cost & Resource Governance

## Implementation status

IMPLEMENTED — PRE-MERGE CERTIFICATION GATE

V3.08 adds a provider-neutral resource-governance boundary without creating a second executor or control plane.

## Implemented boundary

DURABLE EXECUTION/TOOL/MODEL EVIDENCE → USAGE CONTRACTS → RESOURCE POLICY EVALUATION → GOVERNED RESOURCE DECISION → EXISTING CONTROL PLANE / APPROVAL PATH.

## Delivered

- Typed usage events with organization/project/task/job/worker/correlation provenance.
- Provider/model/tool attribution fields.
- Normalized estimated cost with explicit currency and no authorization semantics.
- Deterministic quota, budget, concurrency, latency and per-action cost checks.
- Configurable provider/model/tool allow-lists.
- Explicit `ALLOW`, `APPROVAL_REQUIRED`, and `DENY` decisions.
- Fail-closed behavior when protected identity or accounting evidence is absent.
- Proposal-safe anomaly signals for cross-organization correlation, cost spikes and latency spikes.
- Credential-like metadata sanitization for observability records.
- Adversarial unit coverage for quota/budget/provider bypass and cost-threshold approval.
- Dedicated V3.08 certification workflow that also executes the established regression suite.

## Security boundary

V3.08 does not authorize spend, grant credentials, select workers, bypass approvals, or execute tools. A cost estimate is evidence only. Resource decisions remain subordinate to the existing authorization/control-plane path.

## Certification exit criteria

1. V3.08 dedicated workflow succeeds.
2. Existing Phase 1 regression suite succeeds.
3. Typecheck, lint, build and unit/integration tests succeed.
4. Adversarial V3.08 fixtures pass.
5. Post-merge certification succeeds on the resulting main commit.
