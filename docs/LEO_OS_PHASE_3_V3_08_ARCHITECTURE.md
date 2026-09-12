# LEO OS V3.08 — Observability, Cost & Resource Governance

## Status

PLANNING-ONLY PRE-IMPLEMENTATION GATE

V3.08 will govern observability, model/tool usage, cost, quotas and resource consumption without granting agents authority to bypass policy or spend autonomously.

## Architecture boundary

DURABLE EXECUTION/TOOL/MODEL EVIDENCE → OBSERVABILITY + RESOURCE ACCOUNTING → POLICY/QUOTA EVALUATION → GOVERNED RESOURCE DECISION → EXISTING CONTROL PLANE / APPROVAL PATH → AUTHORIZED EXECUTION → DURABLE RESULT + AUDIT

## Objectives

- Make model, tool and execution usage measurable and attributable.
- Track cost estimates and provider/model usage without allowing model output to alter financial authority.
- Enforce organization/business/project/resource boundaries.
- Provide deterministic quotas, rate limits, budgets and resource ceilings.
- Support free-first routing and bounded fallback with explicit resource policy.
- Detect abnormal usage and surface actionable governance signals.
- Preserve durable audit evidence for resource decisions.
- Fail closed when accounting, identity or policy evidence is missing for protected operations.

## Planned work packages

1. Typed usage and resource-event contracts with provenance.
2. Provider/model/tool usage attribution tied to organization, task, worker and correlation identity.
3. Cost estimation and normalization across providers without treating estimates as financial authorization.
4. Quota, budget, concurrency, latency and resource-limit policy contracts.
5. Governed resource decision boundary integrated with existing execution policy.
6. Approval integration for configured spend/resource thresholds.
7. Durable accounting/audit compatibility using existing authoritative state patterns; avoid parallel state machines.
8. Usage anomaly and threshold signals for LEO, proposal-only by default.
9. Deterministic fixtures and adversarial tests for forged usage, cross-org attribution, quota bypass and cost manipulation.
10. Dedicated V3.08 certification workflow plus Phase 1 regression certification.

## Security invariants

- Policy remains authoritative over model/provider recommendations.
- Capability is not authorization.
- Provider/model selection is not worker authorization.
- Cost estimate is not spend approval.
- Agents/models cannot edit accounting evidence or grant themselves budget.
- Organization/business ownership is authoritative and immutable at the decision boundary.
- High-risk and financial actions fail closed.
- No credential exposure through observability records.
- No browser bypass, arbitrary API execution, second executor or second control plane.
- Resource limits are bounded, cancellable, recoverable and auditable.

## Non-goals

V3.08 does not introduce autonomous operating loops, multi-business operating expansion, unrestricted spending, payment execution, new external integrations solely for telemetry, browser automation, or a new execution engine.

## Certification gate

V3.08 implementation must independently pass its dedicated certification workflow and the established Phase 1 regression gates. Post-merge certification remains mandatory before closure.

## Example governed flow

LEO proposes a model/tool action → V3.08 evaluates resource policy and estimated usage → if allowed, the existing control plane executes through the authorized worker → usage evidence is recorded → result is validated → accounting/audit evidence is durable → LEO receives proposal-only governance signals for future decisions.
