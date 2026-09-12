# LEO OS V3.10 — Autonomous Recovery & Resumability

## Implementation status

IMPLEMENTED — CERTIFICATION GATE

V3.10 adds a deterministic recovery boundary for interrupted bounded-autonomy work. Recovery may resume only from an exact, provenance-bound checkpoint and remains subordinate to the existing LEO control plane.

## Operating boundary

DURABLE AUTONOMY STATE → V3.10 RECOVERY CHECKPOINT → PROVENANCE / STATE VALIDATION → EXISTING V3.09 AUTONOMY BOUNDARY → EXISTING CONTROL PLANE / APPROVAL PATH.

V3.10 is not a new executor, scheduler, authorization system, or control plane. It cannot grant credentials, permissions, approval, spending authority, or external-action authority.

## Delivered

- Exact checkpoint representation for organization/objective/task/correlation and step identity.
- Deterministic checkpoint integrity validation.
- Fail-closed provenance and state-binding validation.
- Retry-limit enforcement.
- Explicit RESUME, STOP and APPROVAL_REQUIRED outcomes.
- Critical-risk recovery requires approval.
- Completed/cancelled objectives cannot be resumed.
- Resume does not mutate progress; execution remains owned by the existing runtime.
- Adversarial tests for checkpoint mismatch, rebinding, retry limits, risk, terminal states and safe resume.
- Dedicated V3.10 certification workflow with full established regression.

## Certification exit criteria

1. V3.10 dedicated workflow succeeds.
2. V3.09/V3.08 and Phase 1 regression remain green.
3. Typecheck, lint, build and unit/integration tests succeed.
4. Adversarial V3.10 fixtures pass.
5. Post-merge certification succeeds on the resulting main commit.

## Security invariant

Recovery restores eligible state; it does not authorize execution. Every resumed action remains subordinate to the existing control-plane authorization and execution path.
