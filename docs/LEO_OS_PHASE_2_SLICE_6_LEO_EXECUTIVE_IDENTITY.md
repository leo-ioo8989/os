# LEO OS — Phase 2 Slice #6 — LEO Executive Identity & CEO Operating Loop

**Status: IMPLEMENTED — CERTIFICATION PENDING**

## 1. Purpose

Slice #6 establishes LEO as a stable, provider-neutral executive identity and defines the governed CEO operating loop. The loop interprets authoritative OwnerIntent, consumes already-authorized context, invokes the existing CEO reasoning boundary through the certified model runtime, produces a structured decision proposal, converts it to the existing PlanProposal contract, validates the plan/task graph, and stops.

```text
OWNER INTENT
    ↓
LEO EXECUTIVE IDENTITY
    ↓
GOVERNED COMPANY CONTEXT
    ↓
CEO REASONING
    ↓
DECISION PROPOSAL
    ↓
PLAN PROPOSAL
    ↓
CERTIFIED CONTROL PLANE BOUNDARY
    ↓
STOP
```

## 2. LEO identity

`LEOExecutiveIdentity` is provider-neutral and stable for an organization. The default `leoId` is `${organizationId}:leo`; it is not derived from a model/provider identity. The identity records the CEO role, Owner relationship, purpose, responsibilities, operating principles, governance classification, status and identity version.

The authority classification is explicit:

```text
authority = GOVERNED_BY_LEO_OS
```

This is a governance classification, not an authorization grant.

## 3. LEO responsibilities

LEO's bounded executive responsibilities are to interpret Owner intent, understand governed context, form strategy and decisions, prioritize outcomes and risks, propose governed plans, recommend delegation as data, recommend approval or clarification, and report decisions/state to the Owner.

## 4. LEO non-responsibilities

LEO is not a model, provider, worker, credential holder, permission grantor, approval grantor, control plane, authorized executor, dispatcher, external communicator, spender, or replacement for policy. LEO has no execution API, credential API, spending API, permission-grant API or capability-grant API.

## 5. CEO operating loop

The implemented loop is deterministic around the supplied OwnerIntent, governed context, routing policy and model response:

1. validate the Owner/organization relationship;
2. construct governed executive context;
3. return `CLARIFICATION_REQUIRED` for deterministic underspecification before reasoning;
4. invoke the existing `CEOReasoningEngine`;
5. route model cognition through the existing `ModelRuntime` boundary;
6. reject authority-bearing model fields fail closed;
7. enforce the OwnerIntent risk floor and approval requirements;
8. reuse the existing model-to-PlanProposal adapter;
9. validate `PlanProposal` and the existing `TaskGraph` boundary;
10. return a proposal-only executive result.

No task/job is created or dispatched by this loop.

## 6. Governed context

`GovernedExecutiveContext` contains authoritative Owner/organization identity, business/project context, facts supplied by the certified Slice #4 memory boundary, memory IDs, and current-state summaries. Memory facts are data only. A memory context from another organization is rejected.

The Slice #4 adapter remains responsible for turning governed memory into facts-only CEO context. The Slice #6 loop does not treat memory text as policy or authorization.

## 7. CEO reasoning relationship

Slice #6 reuses the certified `CEOReasoningEngine` from Slice #3. It does not create a second reasoning engine. The loop supplies authoritative intent/context and receives a proposal-only `DecisionProposal`.

## 8. Model runtime relationship

The CEO reasoning boundary is backed by a small runtime adapter that invokes the certified Slice #5 `ModelRuntime`. Model selection remains the router's responsibility and model output remains untrusted data. The underlying provider can change without changing the LEO identity.

```text
LEO
 ↓
CEOReasoningEngine
 ↓
ModelRuntime
 ↓
ModelRouter
 ↓
Registered ModelProvider
 ↓
Validated ModelResponse
```

No real provider, SDK, secret, API key or network client is introduced.

## 9. Decision proposals

`CEOOperatingDecision` carries the LEO identity, Owner relationship, strategy, priorities, risks, rationale, alternatives, assumptions, recommended next steps, delegation recommendations and model provenance. Its authority is always:

```text
PROPOSAL_ONLY
```

Identity is restored from authoritative system context rather than accepted from model output.

## 10. Plan proposals

The loop reuses the existing `PlanProposal` and `validatePlanProposal()` path. That path continues into the existing authoritative `validateTaskGraph()` boundary. Required permissions, required capabilities, risk and approval requirements remain requirements; none become grants.

## 11. Clarification behavior

The loop can stop with `CLARIFICATION_REQUIRED` when the OwnerIntent is deterministically underspecified, such as an extremely short/ambiguous outcome, a direct must/must-not constraint conflict, or an invalid requested deadline. It does not invent critical facts and does not execute while clarification is required. CEO reasoning may also return a clarification result.

## 12. Risk behavior

LEO may analyze and recommend risk handling. Slice #6 enforces that model reasoning cannot lower the plan risk below the authoritative OwnerIntent priority and cannot remove an approval requirement implied by a critical priority or explicit risk requirement. LEO cannot downgrade risk to enable execution and cannot override the control plane.

## 13. Approval semantics

`approvalRecommended` and `approvalRequired` are proposal data. They never mean approval has been granted. The CEO loop has no approval-granting operation and rejects `approvalGranted` and related authority-bearing model fields.

## 14. Strategic adaptation

A model may recommend a changed strategy when a dependency fails or a better approach emerges. The resulting strategy remains part of a proposal-only decision and must pass the same plan validation boundary. Strategy adaptation does not create automatic authorization.

## 15. Proactive intelligence boundary

The data model supports future proactive reporting of risks, opportunities, stalled work, priorities and recommended next actions. Slice #6 does not implement scheduled polling, autonomous background loops, autonomous execution, or external actions.

## 16. Owner reporting boundary

`CEOOperatingResult` is a structured reporting contract containing LEO identity, OwnerIntent, governed context metadata, executive analysis, decision proposal, plan proposal, validation state, approval recommendation, risks and correlation. It is suitable for future Owner-facing reporting but no Command Center or dashboard is implemented.

## 17. Organization isolation

The authoritative organization and Owner identity come from `OwnerIntent` and the LEO identity relationship. A mismatched organization or Owner is rejected before the CEO loop can produce a proposal. Governed memory context must carry the same organization. Model routing continues to enforce its existing organization policy.

LEO never rewrites `organizationId`.

## 18. Authority model

```text
LEO IDENTITY       ≠ MODEL IDENTITY
LEO IDENTITY       ≠ WORKER IDENTITY
LEO IDENTITY       ≠ AUTHORIZATION
MODEL OUTPUT       ≠ AUTHORITY
MEMORY             ≠ AUTHORITY
APPROVAL REQUIRED  ≠ APPROVAL GRANTED
DECISION PROPOSAL  ≠ EXECUTION
PLAN PROPOSAL      ≠ EXECUTION
```

The control plane remains the final authority.

## 19. Security invariants

1. LEO identity cannot grant authorization.
2. CEO reasoning cannot grant authorization.
3. Memory cannot grant authorization.
4. Model output cannot grant authorization.
5. Decision proposals cannot execute.
6. Plan proposals cannot execute directly.
7. LEO cannot approve its own proposal.
8. LEO cannot bypass the control plane.
9. LEO cannot dispatch jobs.
10. LEO cannot execute workers.
11. LEO cannot access credentials.
12. LEO cannot send external communication.
13. LEO cannot spend money.
14. LEO cannot create permissions.
15. LEO cannot create capabilities.
16. LEO cannot change organization identity.
17. LEO cannot cross organization boundaries.
18. LEO cannot treat memory as policy.
19. LEO cannot treat model output as authority.
20. LEO cannot turn `approval required` into `approval granted`.

Authority-bearing model fields are rejected fail closed, including nested occurrences of organization/owner identity, granted permissions/capabilities, approval grants, worker/credential identifiers, execute/dispatch flags and external-action flags.

## 20. Explicit non-goals

Not implemented in Slice #6:

- AI workforce
- AI employees
- departments
- staffing
- delegation execution
- employee lifecycle
- real model providers
- provider SDKs
- API keys or secrets
- network calls
- external tools
- MCP
- n8n
- Gmail
- GitHub
- Instagram
- WhatsApp
- Calendar
- Google Drive
- browser automation
- computer use
- payments
- spending
- external communication
- Command Center
- autonomous background loops
- autonomous execution
- persistent external model conversations
- vector DB
- embeddings
- RAG

## 21. Future workforce relationship

LEO may recommend that specialized expertise is useful, but this slice never creates an employee, worker, department or delegation. A future workforce layer must remain subordinate to the control plane: role is not permission, employee identity is not authority, and delegation is not execution authorization.

## 22. Future real-provider relationship

Future providers must implement the existing provider-neutral model boundary and remain replaceable cognitive engines. Replacing a model must not replace the LEO identity, weaken provenance, bypass routing policy, or create authority. Provider credentials and network access require a separately approved future slice.

## Compatibility

Slice #6 is additive. It reuses the certified OwnerIntent, CEO reasoning, memory context, ModelRuntime, PlanProposal and TaskGraph validation boundaries. Phase 1 workflow/job/worker/execution semantics are not modified.

**Certification decision:** pending the official repository verification workflow. Historical certification records are not rewritten by this slice.
