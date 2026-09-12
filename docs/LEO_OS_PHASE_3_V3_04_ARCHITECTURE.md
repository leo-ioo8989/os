# LEO OS V3.04 — Creator & Media Production Capability

## Boundary
`LEO/PLAN PROPOSAL → PHASE 1 CONTROL PLANE → PHASE 2 GOVERNANCE → AUTHORIZED WORKER → MEDIA PRODUCER ADAPTER → ASSET REFERENCE → TECHNICAL QA → CONTENT QA → VERIFIED MEDIA PACKAGE`

V3.04 is a production/generation boundary. It never publishes, uploads, communicates externally, or grants authority.

## Implemented contracts
- Typed capability contracts for research, script, audio, image/thumbnail, video, captions, metadata and media-package outputs.
- Stable asset identity, organization/task/correlation binding, lineage, producer provenance, optional provider/model provenance, content hash and storage reference.
- Producer registry with organization isolation and availability state.
- Gateway requiring authoritative `ControlPlaneWorkerBinding`, worker capability, existing execution policy and approval semantics.
- Deterministic failure normalization and idempotent success handling.
- Technical/content QA gate before an asset can become `VERIFIED`.
- Publication/authority-shaped fields are rejected from producer output.

## Provider/storage boundary
V3.04 producer adapters are provider-neutral. Real provider credentials remain behind V3.01 and model selection remains behind V3.03. Media bytes are represented by durable storage references; audit records must use safe references/hashes rather than raw media.

## Non-goals
YouTube publication is V3.05. Business communication is V3.06. Browser/computer automation is V3.07. Autonomous recurring creator loops are V3.09. V3.04 does not introduce a second executor, control plane, credential owner, or publication path.

## Certification invariants
1. Authorized worker only.
2. Capability and organization boundaries are enforced.
3. Malformed inputs/outputs fail closed.
4. Provenance and lineage are mandatory.
5. Technical and content QA precede verification.
6. Invalid/partial assets cannot become verified.
7. Provider/model/credential metadata cannot grant authority.
8. Generation cannot publish.
9. Phase 1 execution and Phase 2 governance remain authoritative.
10. V3.01–V3.03 and legacy regressions remain green.
