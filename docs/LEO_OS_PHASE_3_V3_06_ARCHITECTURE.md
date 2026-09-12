# LEO OS V3.06 — Business Communication & Workspace Operations

Status: PRE-PLANNING COMPLETE — NO PRODUCTION IMPLEMENTATION

## Goal
Add governed Gmail, Google Drive, Google Calendar, Slack/workspace-style communication and document operations without weakening the Phase 1 control plane, Phase 2 governance, or V3.01–V3.05 boundaries.

## Target boundary
OWNER INTENT → LEO EXECUTIVE → PLAN/TASK GRAPH → WORKFORCE/CAPABILITY → MODEL ROUTING → GOVERNED WORKSPACE TOOL PROPOSAL → EXTERNAL-ACTION GOVERNANCE → APPROVAL WHEN REQUIRED → AUTHORIZED WORKER → V3.02 TOOL GATEWAY → PROVIDER-SPECIFIC ADAPTER → VERIFIED RESULT → OUTCOME EVALUATION.

## Planned work packages
1. Provider/account/workspace identity and organization binding.
2. OAuth credential references through V3.01; no raw tokens in models or workers.
3. Typed message, email, file, calendar-event and workspace contracts.
4. Read operations separated from write/send operations.
5. Recipient/account ownership and organization policy validation.
6. Approval policy for outbound communication, destructive changes, sensitive files and external commitments.
7. V3.02 ToolGateway as the only external tool boundary.
8. Idempotency keys and durable result compatibility with Phase 1.
9. Provider-specific structured failures, rate limits and bounded recovery.
10. Result verification and outcome evaluation before continuation.
11. Adversarial certification: cross-org account, wrong OAuth reference, forged approval, recipient spoofing, prompt injection, duplicate send, destructive file action, calendar manipulation and secret leakage.

## Critical invariants
- Communication action != internal proposal.
- Credential reference != authority.
- OAuth/account identity is authoritative, never model-selected.
- Model cannot choose arbitrary credentials, approve itself, or grant permissions.
- Read and write capabilities are distinct.
- External side effects require the existing governance path.
- High-risk external communication fails closed.
- Durable state and audit evidence outrank in-memory model context.
- No second executor, control plane, credential store or browser automation path.

## Non-goals
No browser/computer automation (V3.07), no autonomous bounded operating loops (V3.09), no multi-business expansion (V3.10), no Command Center UI, and no unrestricted general-purpose API client.

## Status
Planning only. V3.06 production code must not begin until explicitly started and must be independently certified as its own version.
