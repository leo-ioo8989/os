# LEO OS — V3.02 Governed Tool/Capability Adapters

Status: IMPLEMENTED / PENDING CERTIFICATION

## Purpose

V3.02 turns Phase-2 capability contracts into typed tool adapters without creating a second executor or authority system.

## Authoritative chain

`LEO PROPOSAL → CONTROL PLANE → POLICY/CAPABILITY → AUTHORIZED WORKER → TOOL ADAPTER → EXTERNAL SYSTEM → VALIDATED RESULT`

The V3.02 gateway is an execution boundary, but it is not a new control plane. It accepts only an already-authoritative `ControlPlaneWorkerBinding` from the Phase-1/Phase-2 path.

## Invariants

- A model cannot invoke a tool directly.
- A tool name/capability requirement never grants authorization.
- Only an existing control-plane worker binding can invoke a tool.
- Organization identity comes from the authoritative worker binding.
- Tool risk is evaluated through the existing execution policy.
- High-risk execution requires valid approval; critical execution is denied.
- Typed input and output schemas are mandatory.
- Idempotency keys prevent duplicate completion for supported idempotent flows.
- Tool results are bound to organization, task, worker, correlation and idempotency identity.
- Result data cannot carry authority-bearing fields into the governed pipeline.
- Tool adapters do not receive or own model/agent credentials.
- Failures are structured and retryability is explicit.

## Scope

V3.02 provides the contract and gateway boundary plus deterministic test adapters. It does not add Gmail, YouTube, GitHub automation, browser automation, MCP, generic arbitrary APIs, or real external credentials. Those are later governed capabilities.

## Certification

The independent V3.02 workflow must pass typecheck, lint, build, core tests, full unit/integration regression, malformed input, authorization, organization isolation, duplicate request, risk/approval and authority-injection tests.
