# LEO OS — AI Company Operating Model v1

**Status:** Normative operating-model definition; implementation is explicitly partial
**Phase 1:** Frozen and certified
**Phase 2 Slice #1:** Verified / certified
**Phase 2 Slice #2:** Verified / certified
**Phase 2 Slice #3:** Implemented domain boundary / verification pending

> This document defines the intended operating model of LEO OS. It does not imply that every capability described here is currently implemented.

## A. Company model

LEO OS is intended to operate as a private AI-operated company system with a human Owner at the top of the authority hierarchy.

```text
OWNER
  ↓
LEO / CEO
  ↓
AI WORKFORCE
  ↓
AUTHORIZED WORKERS / TOOLS
  ↓
REAL WORK
  ↓
QA / VALIDATION
  ↓
RESULT
```

- **Human Owner:** ultimate authority over the company, material commitments, policy, permissions, consequential approvals and strategic direction.
- **LEO / CEO:** the intended executive intelligence and operating coordinator. LEO can reason about objectives, plans, priorities, risks and delegation within policy, but does not outrank the Owner or the control plane.
- **AI workforce:** bounded AI roles/specialists that receive delegated work and operate only within granted scope.
- **One CEO / multiple businesses and projects:** LEO is intended to coordinate multiple businesses, products and projects while preserving organization, business and project isolation.
- **Owner remains ultimate authority:** automation never creates authority merely by reasoning that authority would be useful.

## B. Target operating loop

The target company loop is:

```text
OWNER INTENT
→ LEO UNDERSTANDS
→ LEO PLANS
→ LEO DELEGATES
→ AI WORKERS EXECUTE
→ QA VALIDATES
→ LEO REVIEWS
→ RESULT DELIVERED
```

This is the **target operating model**, not a claim about the current runtime. Phase 1 currently provides the durable, governed execution foundation. Phase 2 intelligence is being introduced incrementally through separately bounded slices.

## C. Authority model

```text
OWNER
→ ultimate authority

LEO / CEO
→ strategic and operational decision authority within policy

AI EMPLOYEES
→ delegated authority only

CONTROL PLANE
→ authoritative enforcement layer

WORKERS
→ execution only within granted authority

MODEL OUTPUT
→ intelligence / data only
```

The control plane is authoritative even when an AI system is acting in a CEO role. LEO may recommend, plan, delegate or disagree with a proposed course of action, but cannot silently convert reasoning into authorization.

## D. Core rule

# Agents propose. LEO OS decides. Authorized workers execute.

Model confidence, agent intent, a proposed role, a proposed capability or a proposed approval requirement never becomes authority by itself.

## E. Risk and approval model

Approval is policy-controlled. It must never be inferred solely from model output.

The intended policy boundary covers, at minimum:

| Activity | Intended authority boundary |
|---|---|
| Research | Normally low-risk delegated work; bounded by policy and data access |
| Writing | Normally low-risk internal work; publication/external delivery may require approval |
| Coding | Delegated implementation within authorized repositories/scopes; production impact remains governed |
| Design | Delegated creative/product work within project scope |
| Internal company changes | Governed according to impact; material changes require owner visibility/approval |
| Creating/changing AI employees | Explicitly governed; no agent may create authority for itself or another agent implicitly |
| Email | External or consequential communication requires explicit policy/approval boundaries |
| Social posting | External publication requires explicit policy and, where required, owner approval |
| Customer communication | Governed external communication; approval depends on policy, sensitivity and commitment |
| Purchasing | Owner-controlled unless a future bounded spending policy explicitly authorizes it |
| Spending | Owner-controlled unless a future bounded spending policy explicitly authorizes it |
| Deployment | Policy-controlled; production/material deployment requires the appropriate approval gate |
| Deleting data | High-risk; explicit authorization and fail-closed controls required |
| Infrastructure changes | Governed by capability, risk and approval policy |
| Contracts | Owner-controlled / explicit approval required for commitments |
| External company communication | Explicit policy and approval boundaries; never inferred from model intent |

The current Phase 1 execution gateway already provides a risk/capability/approval foundation. The broader policy matrix above is a target operating-model definition and is not claimed as fully implemented.

## F. Delegation

LEO is intended to delegate work to bounded AI employees and authorized workers.

Delegation must remain bounded by:

- task scope;
- organization/business/project boundary;
- capabilities;
- permissions;
- risk policy;
- approval requirements;
- budget policy;
- lifecycle and expiry where applicable;
- auditability.

Authority does not increase merely because an agent reasons that it should. There is no uncontrolled recursive delegation, no shadow execution path and no bypass of the control plane.

## G. Workforce

The target workforce is capability- and role-oriented rather than dependent on one permanently fixed list of agents.

A future AI employee definition may include:

- role;
- capabilities;
- authority boundary;
- model assignment;
- context;
- task scope;
- lifecycle;
- temporary/permanent status;
- activation/deactivation state;
- least-privilege constraints.

Temporary specialists may be created for bounded work and deactivated when no longer needed. Creation or modification of AI employees is itself a governed company action; it does not grant the created employee authority beyond explicit policy.

The repository currently contains an additive `AgentDefinition` / `AgentRegistry` domain model, but a dynamic workforce lifecycle is **not** claimed to be implemented.

## H. Memory

The intended memory model is layered:

1. **Owner memory** — durable owner preferences, decisions and explicitly retained context.
2. **Company memory** — company-wide knowledge, policies, operating history and reusable facts.
3. **Business memory** — business-specific context isolated from other businesses.
4. **Project memory** — project-specific plans, decisions, artifacts and context.
5. **Department / working memory** — bounded temporary or functional context needed to perform delegated work.
6. **Audit / history** — authoritative record of consequential control-plane activity and state transitions.

Access follows the same organization/business/project and least-privilege boundaries as other data. **Memory does not grant authority.** A fact stored in memory cannot override policy, permissions, approval state, worker identity or control-plane decisions.

Layered memory is a future operating-model target; Phase 1 audit/history is the currently implemented foundation. No vector database or autonomous memory runtime is implied by this document.

## I. QA

QA is a first-class part of the intended operating loop.

The target QA model includes:

- deterministic validation where the result can be checked mechanically;
- role-separated review where the producer should not be the sole reviewer;
- multi-reviewer or independent validation for critical work;
- rejection and rework when validation fails;
- contextual stopping conditions rather than unbounded attempts;
- durable evidence for consequential validation decisions.

Phase 1 already provides result-validation and durable control-plane foundations. The broader AI QA/reviewer operating model remains future work.

## J. Failure / recovery

The intended recovery ladder is:

```text
FAILURE
→ RETRY
→ STRATEGY CHANGE
→ MODEL CHANGE
→ WORKER REASSIGNMENT
→ ESCALATION
→ FAIL CLOSED FOR HIGH-RISK ACTIONS
```

Recovery must preserve authorization, idempotency, auditability and organization isolation. A recovery action must not silently widen authority.

Phase 1 currently implements durable retry, lease recovery, reconciliation, cancellation, checkpoint/restart recovery and execution-risk enforcement. Strategy/model change and AI worker reassignment are future intelligence capabilities.

## K. Spending

Spending is Owner-controlled unless an explicit future policy grants bounded authority.

A model or agent may recommend spending, estimate cost or identify a purchase as useful. Those facts do not authorize a transaction. Any future spending policy must be explicit, scoped, auditable and enforced by the control plane.

## L. External communication

External communication may occur only according to explicit policy and approval boundaries.

Email, social posts, customer messages, partner communication, public publication and other external company communications are not authorized merely because an agent can generate the content. The system must evaluate identity, organization, scope, risk, policy and approval before any future external side effect.

## M. Self-initiated work

LEO may proactively identify problems, opportunities, bottlenecks, unfinished work, cost issues or useful next actions and recommend them to the Owner.

LEO must not silently:

- create a major new business;
- create a material strategic initiative;
- make a material company commitment;
- spend money outside an explicit bounded policy;
- establish a new authority boundary;
- suppress Owner visibility.

Proactivity is recommendation/intelligence unless an explicit policy grants bounded execution authority.

## N. Multi-business operation

LEO is intended to operate multiple businesses, products and projects under a common CEO-level operating model while maintaining strict isolation.

```text
LEO / CEO
├── Business A
│   ├── Project A1
│   └── Project A2
├── Business B
│   └── Project B1
└── Shared company policy / governance
```

Organization identity remains authoritative. Business/project context cannot be used to cross an organization boundary, and future memory/tool access must preserve the same isolation.

## O. Security principles

The following are normative principles:

```text
CONTROL PLANE > AGENT
POLICY > MODEL OUTPUT
APPROVAL > AGENT INTENT
AUDIT > ASSUMPTION
DURABILITY > IN-MEMORY STATE
EXPLICIT AUTHORITY > IMPLICIT TRUST
FAIL CLOSED FOR HIGH-RISK ACTIONS
```

These principles apply even to a future LEO CEO reasoning layer. Intelligence is an untrusted proposal source relative to the authoritative control plane.

## P. Implementation status

| Operating-model area | Status |
|---|---|
| Owner / organization authority foundation | **Currently implemented foundation** |
| Durable workflow, task graph and job execution control | **Currently implemented / Phase 1 certified** |
| Policy/capability/approval execution boundary | **Currently implemented foundation / Phase 1 certified** |
| Owner Intent → PlanProposal boundary | **Currently implemented / Slice #1 certified** |
| Provider-neutral model abstraction | **Currently implemented / Slice #2 certified** |
| CEO reasoning / decision intelligence | **Implemented bounded proposal/data boundary; verification pending** |
| Fixed `AgentDefinition` / `AgentRegistry` domain model | **Currently present; not a dynamic workforce runtime** |
| Dynamic AI employee lifecycle | **Future target architecture** |
| Full LEO CEO operating loop | **Future target architecture** |
| Layered owner/company/business/project memory | **Future target architecture; Phase 1 audit/history is present** |
| AI QA/reviewer orchestration | **Partially implemented foundation; broader runtime future** |
| Strategy/model switching recovery | **Future target architecture** |
| Autonomous external communication | **Not implemented; future governed capability** |
| Autonomous spending | **Not implemented; future governed capability** |
| Autonomous business creation / strategic commitment | **Not implemented; requires Owner authority** |

### Current truth

This document is a **normative target operating model**, not a claim that LEO OS already operates a complete autonomous AI company. Phase 1 is the certified control-plane foundation; Phase 2 is adding intelligence in separately governed slices.

**Documentation gap closed:** `docs/LEO_OS_AI_COMPANY_OPERATING_MODEL_v1.md` now exists. Its contents do not add runtime authority or implementation dependencies.
