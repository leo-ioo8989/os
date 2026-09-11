import type { Prisma, PrismaClient } from '@prisma/client';
import { validateWorkforceLifecycleProposal, type WorkforceLifecycleProposal } from '@founder-os/core';
import { AUDIT_EVENTS, sanitizeAuditMetadata } from './audit.js';

const RESOURCE_TYPE = 'WorkforceLifecycle';

function validateProposal(proposal: WorkforceLifecycleProposal): void {
  validateWorkforceLifecycleProposal(proposal);
}

function fromMetadata(metadata: unknown): WorkforceLifecycleProposal | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = metadata as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  const candidate = {
    proposalId: value.proposalId,
    organizationId: value.organizationId,
    target: value.target,
    action: value.action,
    reason: value.reason,
    risk: value.risk,
    ...(typeof value.currentStatus === 'string' ? { currentStatus: value.currentStatus } : {}),
    ...(typeof value.proposedStatus === 'string' ? { proposedStatus: value.proposedStatus } : {}),
    ...(value.roleSnapshot && typeof value.roleSnapshot === 'object' ? { roleSnapshot: value.roleSnapshot } : {}),
    authority: value.authority,
    approvalRequired: value.approvalRequired,
    provenance: value.provenance,
  };
  try {
    validateWorkforceLifecycleProposal(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function recordWorkforceLifecycleProposal(db: PrismaClient, proposal: WorkforceLifecycleProposal): Promise<WorkforceLifecycleProposal> {
  validateProposal(proposal);
  const existing = await getWorkforceLifecycleProposal(db, proposal.organizationId, proposal.proposalId);
  if (existing) return existing;
  const event = await db.auditEvent.create({
    data: {
      organization: { connect: { id: proposal.organizationId } },
      actorType: 'AGENT',
      eventType: AUDIT_EVENTS.WORKFORCE_LIFECYCLE_RECORDED,
      resourceType: RESOURCE_TYPE,
      resourceId: proposal.proposalId,
      action: 'record_workforce_lifecycle_proposal',
      result: 'SUCCESS',
      metadata: sanitizeAuditMetadata({
        schemaVersion: 1,
        proposalId: proposal.proposalId,
        organizationId: proposal.organizationId,
        target: proposal.target,
        action: proposal.action,
        reason: proposal.reason,
        risk: proposal.risk,
        currentStatus: proposal.currentStatus,
        proposedStatus: proposal.proposedStatus,
        roleSnapshot: proposal.roleSnapshot,
        authority: proposal.authority,
        approvalRequired: proposal.approvalRequired,
        provenance: proposal.provenance,
      }) as Prisma.InputJsonValue,
    },
  });
  const reconstructed = fromMetadata(event.metadata);
  if (!reconstructed) throw new Error('Persisted workforce lifecycle proposal could not be reconstructed.');
  return reconstructed;
}

export async function getWorkforceLifecycleProposal(db: PrismaClient, organizationId: string, proposalId: string): Promise<WorkforceLifecycleProposal | null> {
  const event = await db.auditEvent.findFirst({ where: { organizationId, eventType: AUDIT_EVENTS.WORKFORCE_LIFECYCLE_RECORDED, resourceType: RESOURCE_TYPE, resourceId: proposalId }, orderBy: { createdAt: 'desc' } });
  return event ? fromMetadata(event.metadata) : null;
}

export async function listWorkforceLifecycleProposals(db: PrismaClient, organizationId: string): Promise<WorkforceLifecycleProposal[]> {
  const events = await db.auditEvent.findMany({ where: { organizationId, eventType: AUDIT_EVENTS.WORKFORCE_LIFECYCLE_RECORDED, resourceType: RESOURCE_TYPE }, orderBy: { createdAt: 'desc' } });
  return events.map((event) => fromMetadata(event.metadata)).filter((value): value is WorkforceLifecycleProposal => value !== null && value.organizationId === organizationId);
}
