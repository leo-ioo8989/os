# LEO OS Phase 2 — Slice 13
## Governed Operating Event Orchestration Boundary

Status: IMPLEMENTATION IN PROGRESS

## Purpose

Slices 1–12 establish proposal, model, executive reasoning, governed memory, model runtime, LEO identity, workforce/capability/provider registry, durable delegated execution, outcome evaluation, executive continuation, durable executive history, and proposal-only workforce lifecycle decisions.

The next material gap is the absence of a governed way to turn durable operating facts into a deterministic, auditable trigger for an existing LEO decision path. Without this boundary, future autonomous/background operation would either require ad-hoc polling or risk creating a second orchestration system.

Slice 13 introduces a **governed operating event boundary**. It observes authoritative durable state and produces a proposal-only event/trigger for LEO. It does not execute work.

## Architecture

`DURABLE AUTHORITATIVE STATE → GOVERNED OPERATING EVENT → LEO-CONSUMABLE TRIGGER → EXISTING EXECUTIVE/PLAN PROPOSAL PATH → EXISTING CONTROL PLANE`

This slice is an event/trigger boundary, not an executor, scheduler, queue, or second control plane.

## Event Sources

Only existing authoritative state may produce an event:

- workflow/task/job terminal transitions already represented by the control plane
- validated outcome/evaluation state from Slice 9
- executive continuation history from Slice 11
- governed workforce lifecycle proposals from Slice 12

No model output, memory fact, or arbitrary payload can create authority.

## Event Contract

A `GovernedOperatingEvent` contains:

- eventId
- eventType
- organizationId
- ownerUserId
- objectiveId when applicable
- workflowId when applicable
- taskId when applicable
- jobId when applicable
- sourceResourceType
- sourceResourceId
- sourceState/version marker
- correlationId
- occurredAt
- provenance
- authority: `PROPOSAL_ONLY`

Event payloads are data only. They cannot contain or confer permissions, capabilities, approvals, worker identity, credentials, execution commands, spending authority, or external-action authority.

## Determinism and Idempotency

The same authoritative source identity + source version/state + event type must produce the same event identity. Re-processing an already observed event must not create a second semantic event.

No in-memory Map/Set registry is introduced as durable state. Existing durable records remain authoritative.

## Security Boundary

Slice 13 MUST NOT:

- execute or dispatch jobs
- authorize workers
- grant permissions/capabilities
- grant approvals
- retry/reassign work
- mutate workflow/job/task/objective state
- access credentials
- spend money
- call external systems
- create an autonomous infinite loop
- create a second control plane
- create a second execution state machine

## Failure Semantics

- Missing authoritative source state: fail closed.
- Cross-organization relationships: reject/fail closed.
- Malformed or authority-bearing event payload: reject and do not persist.
- Duplicate source observation: return existing semantic event.
- Event processing failure cannot mutate execution state.

## Durable History

Use the existing append-only `AuditEvent` authority where durable event history is required. Do not create a parallel event table, queue, event bus, cache, or state machine unless repository evidence proves the existing audit authority cannot satisfy the contract.

## Relationship to LEO

Slice 13 may provide an event as an input to LEO's existing governed reasoning/continuation path. LEO remains proposal-only. The control plane remains the final authority.

`EVENT ≠ DECISION`

`DECISION ≠ AUTHORIZATION`

`PROPOSAL ≠ EXECUTION`

## Phase 2 Boundary

Slice 13 establishes the governed trigger/event boundary. It does not implement generalized autonomous operation. Later slices may add governed scheduling/proactive intelligence or external action, but only through explicit policy and existing control-plane authority.
