export const MEMORY_SCOPES = [
  'OWNER',
  'COMPANY',
  'BUSINESS',
  'PROJECT',
  'WORKING',
  'AUDIT',
] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_SENSITIVITY = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export type MemorySensitivity = (typeof MEMORY_SENSITIVITY)[number];

export const MEMORY_STATUSES = ['ACTIVE', 'ARCHIVED', 'INVALIDATED'] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export interface MemoryItem {
  memoryId: string;
  organizationId: string;
  scope: MemoryScope;
  ownerUserId?: string;
  businessId?: string;
  projectId?: string;
  departmentId?: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  provenance: MemoryProvenance;
  sensitivity: MemorySensitivity;
  version: number;
  status: MemoryStatus;
}

export interface MemoryProvenance {
  source: string;
  correlationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryAccessContext {
  organizationId: string;
  ownerUserId?: string;
  businessId?: string;
  projectId?: string;
  departmentId?: string;
  allowedScopes: readonly MemoryScope[];
}

export interface MemoryQuery {
  organizationId: string;
  scope?: MemoryScope;
  businessId?: string;
  projectId?: string;
  departmentId?: string;
  ownerUserId?: string;
  status?: MemoryStatus;
}

export interface GovernedMemoryContext {
  readonly organizationId: string;
  readonly memoryIds: readonly string[];
  readonly facts: readonly string[];
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function assertScopeAssociations(item: MemoryItem): void {
  if (item.scope === 'OWNER' && !item.ownerUserId) throw new Error('OWNER memory requires ownerUserId');
  if (item.scope === 'BUSINESS' && !item.businessId) throw new Error('BUSINESS memory requires businessId');
  if (item.scope === 'PROJECT' && !item.projectId) throw new Error('PROJECT memory requires projectId');
  if (item.scope === 'WORKING' && !item.departmentId && !item.projectId) {
    throw new Error('WORKING memory requires departmentId or projectId');
  }
  if (item.scope === 'AUDIT') throw new Error('AUDIT memory is historical record and cannot be created by this domain writer');
}

export function validateMemoryItem(item: MemoryItem): void {
  if (!item.memoryId || !item.organizationId || !item.content || !item.source) {
    throw new Error('Memory item is missing required identity, organization, content, or source');
  }
  if (!MEMORY_SCOPES.includes(item.scope)) throw new Error(`Invalid memory scope: ${String(item.scope)}`);
  if (!MEMORY_SENSITIVITY.includes(item.sensitivity)) throw new Error(`Invalid memory sensitivity: ${String(item.sensitivity)}`);
  if (!MEMORY_STATUSES.includes(item.status)) throw new Error(`Invalid memory status: ${String(item.status)}`);
  if (!Number.isInteger(item.version) || item.version < 1) throw new Error('Memory version must be a positive integer');
  if (!isValidTimestamp(item.createdAt) || !isValidTimestamp(item.updatedAt)) throw new Error('Memory timestamps must be valid ISO timestamps');
  if (item.provenance.source !== item.source) throw new Error('Memory provenance source must match memory source');
  assertScopeAssociations(item);
}

function sameOptional(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || expected === actual;
}

function canAccess(item: MemoryItem, context: MemoryAccessContext): boolean {
  if (item.organizationId !== context.organizationId) return false;
  if (!context.allowedScopes.includes(item.scope)) return false;
  if (!sameOptional(item.ownerUserId, context.ownerUserId)) return false;
  if (!sameOptional(item.businessId, context.businessId)) return false;
  if (!sameOptional(item.projectId, context.projectId)) return false;
  if (!sameOptional(item.departmentId, context.departmentId)) return false;
  return true;
}

export function assertMemoryAccess(item: MemoryItem, context: MemoryAccessContext): void {
  if (!canAccess(item, context)) throw new Error('Memory access denied by organization or scope boundary');
}

/**
 * Provider/storage-neutral in-memory memory boundary. It is deliberately not
 * connected to Prisma, APIs, workers, models, credentials, or external systems.
 */
export class InMemoryMemoryStore {
  private readonly items = new Map<string, MemoryItem>();

  store(item: MemoryItem): MemoryItem {
    validateMemoryItem(item);
    if (this.items.has(item.memoryId)) throw new Error(`Memory already exists: ${item.memoryId}`);
    this.items.set(item.memoryId, { ...item, provenance: { ...item.provenance } });
    return this.items.get(item.memoryId)!;
  }

  retrieve(query: MemoryQuery, access: MemoryAccessContext): MemoryItem[] {
    if (query.organizationId !== access.organizationId) throw new Error('Memory query organization does not match access context');
    return [...this.items.values()]
      .filter((item) => query.scope === undefined || item.scope === query.scope)
      .filter((item) => query.status === undefined || item.status === query.status)
      .filter((item) => sameOptional(item.ownerUserId, query.ownerUserId))
      .filter((item) => sameOptional(item.businessId, query.businessId))
      .filter((item) => sameOptional(item.projectId, query.projectId))
      .filter((item) => sameOptional(item.departmentId, query.departmentId))
      .filter((item) => canAccess(item, access))
      .map((item) => ({ ...item, provenance: { ...item.provenance } }));
  }

  update(memoryId: string, access: MemoryAccessContext, changes: Pick<MemoryItem, 'content' | 'source' | 'sensitivity'>, updatedAt: string, correlationId?: string): MemoryItem {
    const existing = this.items.get(memoryId);
    if (!existing) throw new Error(`Memory not found: ${memoryId}`);
    assertMemoryAccess(existing, access);
    if (!isValidTimestamp(updatedAt)) throw new Error('Memory update timestamp must be a valid ISO timestamp');
    const updated: MemoryItem = {
      ...existing,
      content: changes.content,
      source: changes.source,
      sensitivity: changes.sensitivity,
      updatedAt,
      version: existing.version + 1,
      provenance: { source: changes.source, correlationId, createdAt: existing.provenance.createdAt, updatedAt },
    };
    validateMemoryItem(updated);
    this.items.set(memoryId, updated);
    return { ...updated, provenance: { ...updated.provenance } };
  }

  archive(memoryId: string, access: MemoryAccessContext, updatedAt: string): MemoryItem {
    const existing = this.items.get(memoryId);
    if (!existing) throw new Error(`Memory not found: ${memoryId}`);
    assertMemoryAccess(existing, access);
    const updated: MemoryItem = { ...existing, status: 'ARCHIVED', updatedAt, version: existing.version + 1 };
    validateMemoryItem(updated);
    this.items.set(memoryId, updated);
    return { ...updated, provenance: { ...updated.provenance } };
  }

  /** Memory is data only: this method deliberately exposes no authority-bearing fields. */
  toGovernedContext(items: readonly MemoryItem[], access: MemoryAccessContext): GovernedMemoryContext {
    for (const item of items) assertMemoryAccess(item, access);
    return {
      organizationId: access.organizationId,
      memoryIds: items.map((item) => item.memoryId),
      facts: items.filter((item) => item.status === 'ACTIVE').map((item) => item.content),
    };
  }
}

/**
 * Adapter for the certified CEO reasoning context. Memory supplies facts only;
 * authoritative identity remains in OwnerIntent and the reasoning request.
 */
export function memoryContextToCEOFacts(context: GovernedMemoryContext): readonly string[] {
  return [...context.facts];
}
