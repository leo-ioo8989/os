# LEO OS — Phase 1 Compatibility Contract

**Status:** Binding architectural contract for any future phase  
**Phase 1:** Frozen and certified

Any future intelligence or integration must preserve these invariants.

## Mandatory invariants

1. **Durable workflow state** — workflow lifecycle and current pointers remain durable and authoritative.
2. **Durable job state** — execution attempts, leases, retries, approval blocking, and terminal outcomes remain durable.
3. **Deterministic task ordering** — readiness and stable Task-ID ordering remain deterministic.
4. **Dependency readiness** — dependencies are validated and readiness remains control-plane governed.
5. **Idempotency** — duplicate job/workflow execution cannot create unintended duplicate durable work.
6. **Organization isolation** — every resource and execution remains bound to its authorized organization.
7. **Approval integrity** — approvals remain action/context-bound, authorized, and single-use where applicable.
8. **Capability enforcement** — workers cannot perform actions outside their authorized capabilities.
9. **Audit integrity** — consequential control-plane actions remain durably auditable without leaking secrets.
10. **Retry semantics** — retry limits, failure classification, and exhaustion remain explicit and durable.
11. **Cancellation** — cancellation remains authoritative and cannot be silently undone by an agent.
12. **Stale lease recovery** — failed workers cannot permanently own work.
13. **Checkpoint recovery** — resumable state remains durable and ownership-controlled.
14. **Terminal-state protection** — completed/cancelled terminal states cannot be resurrected by model output or agent intent.
15. **Concurrency correctness** — PostgreSQL transaction/concurrency boundaries remain authoritative.
16. **Worker authorization** — execution requires authenticated and authorized worker identity.
17. **Result validation** — successful-looking agent/tool output does not itself establish job success.
18. **Recovery reconciliation** — durable workflow/job truth survives process failure and is reconciled by the control plane.

## Architectural consequence
Future agents, models, planners, contexts, memories, and tools are extensions around these primitives. They must not become alternative sources of truth for workflow/job state or alternative privileged execution paths.

## Compatibility rule
A future change that violates any mandatory invariant is **architecturally invalid** until separately reviewed and explicitly authorized as a change to the frozen Phase-1 contract.

## Authority statement
**Agents propose. LEO OS decides. Authorized workers execute.**
