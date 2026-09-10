# ADR — LEO OS Phase 2 Boundary

**Status:** Accepted architectural decision  
**Scope:** Future design only; no implementation

## Context
LEO OS Phase 1 established a durable control plane for objectives, tasks, workflows, jobs, trusted workers, policy, approvals, result validation, recovery, concurrency, and audit. Future intelligence may make planning and interpretation substantially more capable, but model output is probabilistic and must not become implicit execution authority.

## Decision
> **The LEO OS control plane remains the authoritative execution boundary. Intelligence may propose plans, tasks, and actions, but execution authority remains governed by LEO OS policy, capabilities, approvals, workflow state, and audit mechanisms.**

Future agents are therefore subordinate participants. They may propose and request; the certified control plane decides whether durable state may advance and whether execution is authorized.

## Alternatives considered

### 1. Agent as ultimate authority — rejected
Would allow model output to bypass policy and durable governance. It creates unacceptable security and audit ambiguity.

### 2. Agent with direct database access — rejected
Would make database permissions an implicit execution API and undermine organization isolation, state-machine invariants, terminal protection, and audit boundaries.

### 3. Replace Phase-1 orchestration with an autonomous agent loop — rejected
Would duplicate or weaken proven durability, retries, reconciliation, concurrency, and terminal-state semantics.

### 4. Intelligence only as a passive chatbot — rejected as the long-term product direction
It does not use the durable execution substrate. LEO OS should eventually connect reasoning to governed planning and execution without surrendering authority.

### 5. Bounded intelligence behind the existing control plane — accepted
Preserves Phase-1 authority while enabling future planning, context, memory, model abstraction, and tool capabilities.

## Consequences

### Positive
- Clear separation between reasoning and authority.
- Existing Phase-1 durability remains reusable.
- High-risk actions can remain human-governed.
- Model/provider changes need not redefine execution authority.
- Failures remain recoverable through durable jobs/workflows.
- Audit and organization isolation remain central.

### Costs
- Agent proposals need structured validation.
- Some seemingly simple autonomous actions require control-plane round trips.
- Future tool integrations must carry explicit capability/risk contracts.
- Observability must correlate agent reasoning requests with durable execution state without exposing sensitive reasoning or secrets.

## Security implications
The control plane is the trust anchor. Agents must not receive unrestricted database credentials, worker credentials, policy bypasses, terminal-state mutation authority, or arbitrary external execution rights. High-risk execution must fail closed when authorization or approval is absent.

## Future extension points
- bounded agent layer;
- model abstraction and provenance;
- structured planning/proposal protocol;
- authorized context and memory;
- explicit tool contracts;
- cost/budget controls;
- human escalation;
- agent-aware observability;
- integration with existing workflow/job/approval/execution primitives.

All extension points remain **PROPOSED / NOT IMPLEMENTED** until separately authorized.
