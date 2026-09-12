# LEO OS V3.09 — Bounded Autonomous Operation

## Implementation status

IMPLEMENTED — CERTIFICATION GATE

V3.09 adds a bounded autonomy decision boundary that allows LEO to continue multi-step work only while explicit step, time, budget, failure, risk, provenance, and V3.08 resource-governance constraints remain satisfied.

## Operating boundary

OWNER OBJECTIVE → EXISTING LEO PLAN/DELEGATION → V3.09 AUTONOMY BOUNDARY → V3.08 RESOURCE GOVERNANCE → EXISTING CONTROL PLANE / APPROVAL PATH → EXISTING EXECUTION RUNTIME.

V3.09 is not a new executor or control plane. It cannot grant credentials, permissions, worker identity, approval, spending authority, or external-action authority.

## Delivered

- Explicit autonomy limits for steps, elapsed duration, budget and consecutive failures.
- Durable organization/objective/task/correlation binding on every proposed step.
- Fail-closed behavior for rebinding and missing provenance.
- Explicit CONTINUE, STOP and APPROVAL_REQUIRED outcomes.
- High/critical-risk autonomy requires approval unless explicitly permitted by policy.
- V3.08 resource governance is evaluated before autonomous continuation.
- State application advances only on a CONTINUE decision.
- Deterministic adversarial tests for step, time, risk, resource and binding boundaries.
- Dedicated V3.09 certification workflow running the full established regression suite.

## Certification exit criteria

1. V3.09 dedicated workflow succeeds.
2. V3.08 and Phase 1 regression remain green.
3. Typecheck, lint, build and unit/integration tests succeed.
4. Adversarial V3.09 fixtures pass.
5. Post-merge certification succeeds on the resulting main commit.

## Security invariant

Autonomy controls continuation; they do not authorize execution. Every actual action remains subordinate to the existing control-plane authorization and execution path.
