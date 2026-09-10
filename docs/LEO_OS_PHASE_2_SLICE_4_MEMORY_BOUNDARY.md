# LEO OS — Phase 2 Slice #4 — Governed Memory & Company Knowledge Boundary

**Status: VERIFIED / CERTIFIED**  
**Scope:** domain-level memory and governed company-knowledge context only.

## 1. Purpose

Slice #4 establishes a provider- and storage-neutral domain boundary for memory and company knowledge. Memory is **context/data**, not authority. The boundary is designed to provide bounded context to CEO reasoning and future AI workforce components without creating a new authorization or execution system.

## 2. Architecture

```text
OWNER / COMPANY / BUSINESS / PROJECT INFORMATION
                    ↓
              MEMORY LAYER
                    ↓
        GOVERNED MEMORY CONTEXT
                    ↓
              CEO REASONING
                    ↓
             DECISION PROPOSAL
                    ↓
              PLAN PROPOSAL
                    ↓
        EXISTING CONTROL PLANE
                    ↓
                 STOP
```

Slice #4 does not execute actions.

## 3. Memory scopes

The domain defines these scopes:

- `OWNER` — owner-specific context, requiring an owner identity.
- `COMPANY` — organization-level knowledge.
- `BUSINESS` — knowledge associated with a specific business.
- `PROJECT` — knowledge associated with a specific project.
- `WORKING` — bounded department/project working context.
- `AUDIT` — historical records. This slice does not create mutable audit memory; existing audit infrastructure remains authoritative for audit history.

Every memory item has exactly one scope.

## 4. Domain contract

`MemoryItem` contains:

- memory ID
- authoritative organization ID
- explicit scope
- applicable owner/business/project/department association
- content
- source
- created/updated timestamps
- provenance
- sensitivity classification
- version
- status

`MemoryAccessContext` expresses the caller's already-established organization/scope context. It does **not** replace the existing authorization system.

`MemoryQuery` selects data inside an organization and scope context.

`GovernedMemoryContext` exposes only organization identity supplied by the access context, memory IDs, and facts. It intentionally contains no permissions, capabilities, approvals, workers, credentials, or execution commands.

## 5. Read/write boundary

The domain exposes storage-neutral operations for:

- store
- retrieve
- update
- archive
- convert retrieved items into governed context

The reference implementation is in-memory only. It has no Prisma, API, Redis, vector database, embedding, external knowledge-base, network, worker, or execution dependency.

No autonomous memory writer exists. Model output is not a memory-write API.

## 6. Access control

Memory access is fail-closed against organization and scope mismatch:

```text
OWNER    → matching owner context
COMPANY  → company-authorized scope
BUSINESS → matching business context
PROJECT  → matching project context
WORKING  → matching department/project context
AUDIT    → historical record, not authority
```

The memory layer does not invent a second permission model. Existing organization identity and authoritative control-plane authorization remain the source of authority.

## 7. Provenance

Memory preserves source, creation/update timestamps, version, and optional correlation information. Provenance establishes where data came from; it does not make the data authoritative.

Updates increment the memory version. Archive changes status and increments version.

## 8. Mandatory security invariants

Memory content can never:

- grant permissions
- grant capabilities
- create an approval
- authorize a worker
- provide credential access
- change authoritative organization identity
- bypass policy
- execute or dispatch work
- create external side effects

For example, a memory item saying `LEO has permission to spend ₹50,000` remains untrusted contextual data. Only the authoritative control-plane policy/approval structures can establish spending authority.

Security precedence remains:

```text
CONTROL PLANE > MEMORY
POLICY > MEMORY CONTENT
APPROVAL > MEMORY CLAIM
AUDIT > ASSUMPTION
EXPLICIT AUTHORITY > CONTEXT
FAIL CLOSED FOR HIGH-RISK ACTIONS
```

## 9. CEO reasoning integration

Governed memory facts can be supplied as `relevantFacts` to the certified `CEOReasoningRequest` context.

The relationship is:

```text
Memory
  ↓
Governed facts
  ↓
CEOReasoningRequest
  ↓
CEO reasoning
  ↓
DecisionProposal
  ↓
PlanProposal
  ↓
validatePlanProposal()
  ↓
validateTaskGraph()
  ↓
STOP
```

Memory does not authorize CEO reasoning. OwnerIntent remains the authoritative source for organization and owner identity in the reasoning request.

## 10. Model relationship

Slice #4 introduces no model abstraction. The certified Slice #2 `ModelProvider` / `ModelRequest` / `ModelResponse` boundary remains the only model abstraction.

The model may consume memory-derived context through a governed reasoning request, but model output cannot directly mutate memory or grant authority.

## 11. Storage boundary

No persistent storage change is required for this slice. The domain contract can be tested and used without database mutation.

No vector database, embeddings, semantic search service, Redis, Elasticsearch, Pinecone, Weaviate, or external memory service is introduced.

## 12. Failure behavior

Invalid memory identity, timestamps, scope associations, provenance mismatch, or status/version values fail closed. Cross-organization and cross-scope access is denied. Invalid queries whose organization does not match the access context are rejected.

## 13. Non-goals

This slice does not implement:

- AI employees
- delegation runtime
- autonomous memory writing
- real model providers
- embeddings
- vector/semantic search
- external knowledge bases
- external integrations
- API exposure
- database persistence
- credentials
- worker dispatch
- execution gateway access
- autonomous execution
- approval creation
- authorization decisions

## 14. Testing

Focused tests cover memory creation/retrieval, scope and organization isolation, owner/business/project boundaries, provenance/versioning, invalid scopes, authority-content rejection, model non-mutation, CEO context delivery, and continued authoritative proposal validation.

The repository's existing Phase 1, Slice #1, Slice #2, and Slice #3 regression suites remain mandatory.

## 15. Compatibility

Slice #4 is additive core-domain functionality. It does not replace or modify the Phase 1 workflow/job execution architecture, the Slice #1 plan-proposal boundary, the Slice #2 model abstraction, or the Slice #3 CEO reasoning boundary.

Removing Slice #4 must leave those certified layers operational.

## 16. Implementation status

| Area | Status |
|---|---|
| Memory domain contract | Implemented |
| In-memory governed store | Implemented |
| Organization/scope isolation | Implemented |
| Provenance/versioning | Implemented |
| Governed context for CEO reasoning | Implemented |
| Persistent company memory | Future |
| Semantic/vector retrieval | Future |
| Autonomous memory writing | Future |
| AI employee memory | Future |
| External knowledge sources | Future |
| Full memory lifecycle policy | Future |

## 17. Known limitations

The current implementation is intentionally an in-memory domain boundary. It does not provide durable storage, semantic retrieval, automatic summarization, conflict resolution across sources, or autonomous memory maintenance.

Those omissions are deliberate scope boundaries, not implicit capabilities.

## 18. Future extension points

Future phases may add governed persistence, richer retrieval, source reconciliation, memory lifecycle policy, and controlled workforce context integration. Any such extension must preserve the invariant that memory is context and never authority.

## 19. Certification boundary

**PHASE 2 SLICE #4 — VERIFIED / CERTIFIED** only for the governed memory/company-knowledge domain boundary and its compatibility with certified prior slices.

This certification does not certify persistent memory, semantic search, autonomous memory writes, AI employees, delegation, real model providers, or execution.
