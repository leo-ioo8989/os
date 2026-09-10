import type { Prisma, PrismaClient, ApprovalStatus } from '@prisma/client';
import { AUDIT_EVENTS, type AuditEventInput } from './audit.js';

export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: [], REJECTED: [], EXPIRED: [], CANCELLED: [],
};

export interface CreateApprovalInput {
  organizationId: string;
  requesterId?: string;
  requesterAgentId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  action: string;
  riskLevel: Prisma.ApprovalCreateInput['riskLevel'];
  reason: string;
  evidence: Record<string, unknown>;
  estimatedCost?: number;
  expiresAt?: Date;
}

export class ApprovalRepository {
  constructor(private readonly db: PrismaClient) {}
  async create(input: CreateApprovalInput, audit: Omit<AuditEventInput, 'eventType'>) {
    return this.db.$transaction(async (tx) => {
      const item = await tx.approval.create({ data: {
        organization: { connect: { id: input.organizationId } },
        requester: input.requesterId ? { connect: { id: input.requesterId } } : undefined,
        requesterAgentId: input.requesterAgentId,
        targetResourceType: input.targetResourceType,
        targetResourceId: input.targetResourceId,
        action: input.action,
        riskLevel: input.riskLevel,
        reason: input.reason,
        evidence: input.evidence,
        estimatedCost: input.estimatedCost,
        expiresAt: input.expiresAt,
      } });
      await tx.auditEvent.create({ data: { organization: { connect: { id: input.organizationId } }, actor: audit.actorId ? { connect: { id: audit.actorId } } : undefined, actorType: audit.actorType, eventType: AUDIT_EVENTS.APPROVAL_CREATED, resourceType: 'Approval', resourceId: item.id, action: audit.action, result: audit.result, metadata: audit.metadata ?? {} } });
      return item;
    }, { isolationLevel: 'Serializable' });
  }
  list(organizationId: string) { return this.db.approval.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }); }
  get(organizationId: string, id: string) { return this.db.approval.findFirst({ where: { organizationId, id } }); }
  async decide(organizationId: string, id: string, next: ApprovalStatus, decidingUserId: string, audit: Omit<AuditEventInput, 'eventType'>) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.approval.findFirst({ where: { organizationId, id } });
      if (!current) return { kind: 'missing' as const };
      if (current.expiresAt && current.expiresAt <= new Date() && current.status === 'PENDING') {
        await tx.approval.update({ where: { id }, data: { status: 'EXPIRED' } });
        await tx.auditEvent.create({ data: { organization: { connect: { id: organizationId } }, actor: audit.actorId ? { connect: { id: audit.actorId } } : undefined, actorType: audit.actorType, eventType: AUDIT_EVENTS.APPROVAL_EXPIRED, resourceType: 'Approval', resourceId: id, action: 'expire', result: audit.result, metadata: audit.metadata ?? {} } });
        return { kind: 'expired' as const };
      }
      if (!APPROVAL_TRANSITIONS[current.status].includes(next)) return { kind: 'conflict' as const, status: current.status };
      const updated = await tx.approval.update({ where: { id }, data: { status: next, decidedAt: new Date(), decidedBy: decidingUserId } });
      const eventType = next === 'APPROVED' ? AUDIT_EVENTS.APPROVAL_APPROVED : next === 'REJECTED' ? AUDIT_EVENTS.APPROVAL_REJECTED : AUDIT_EVENTS.APPROVAL_CANCELLED;
      await tx.auditEvent.create({ data: { organization: { connect: { id: organizationId } }, actor: { connect: { id: decidingUserId } }, actorType: 'USER', eventType, resourceType: 'Approval', resourceId: id, action: next.toLowerCase(), result: audit.result, metadata: audit.metadata ?? {} } });
      return { kind: 'updated' as const, item: updated };
    }, { isolationLevel: 'Serializable' });
  }
}
