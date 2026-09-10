# LEO OS — Phase 2 Non-Goals

**Status: PROPOSED SCOPE BOUNDARY / NOT IMPLEMENTED**

Phase 2 is an intelligence-extension phase, not an unrestricted automation rewrite.

## Explicit non-goals

Phase 2 will not attempt to build:

- autonomous unrestricted internet access;
- unrestricted external actions;
- arbitrary privileged execution;
- approval bypasses;
- direct agent database authority;
- a replacement for the Phase-1 orchestrator;
- a replacement for the Phase-1 workflow state machine;
- a replacement for durable Job lifecycle semantics;
- uncontrolled model switching;
- hidden execution paths;
- arbitrary shell/code execution by agents;
- self-created worker credentials or privileges;
- silent terminal workflow mutation;
- unbounded autonomous loops;
- audit suppression or audit rewriting;
- a public SaaS deployment as part of the architecture definition;
- Command Center UI;
- Phase-1 schema refactoring merely to accommodate intelligence;
- external integrations simply because an agent can request them.

## Scope-control test
A proposed Phase-2 feature is out of scope or architecturally suspect if it requires an agent to become the ultimate authority, bypasses the certified control plane, creates a second privileged execution path, or makes durable state depend solely on in-memory model/agent state.

## Boundary
Phase 2 may eventually add intelligence that proposes and interprets. It must not silently convert proposal authority into execution authority.
