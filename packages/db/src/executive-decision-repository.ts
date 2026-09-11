import type { PrismaClient } from '@prisma/client';
import type { ExecutiveContinuationDecision } from '@founder-os/core';
import { AUDIT_EVENTS, sanitizeAuditMetadata } from './audit.js';

export interface DurableExecutiveDecision {
  continuationId: string;
  organizationId: string;
  ownerUserId: string;
  objectiveId: string;
  workflowId?: string;
  taskId?: string;
  jobId: string;
  disposition: ExecutiveContinuationDecision['disposition'];
  rationale: string;
  risks: readonly string[];
  authority: 'PROPOSAL_ONLY';
  provenance: ExecutiveContinuationDecision['provenance'];
  nextProposal?: ExecutiveContinuationDecision['nextProposal'];
  recordedAt: Date;
}

const RESOURCE_TYPE = 'ExecutiveContinuation';

function toDecision(metadata: unknown, createdAt: Date): DurableExecutiveDecision | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = metadata as Record<string, unknown>;
  if (value.schemaVersion !== 1 || typeof value.continuationId !== 'string' || typeof value.organizationId !== 'string' || typeof value.ownerUserId !== 'string' || typeof value.objectiveId !== 'string' || typeof value.jobId !== 'string' || typeof value.disposition !== 'string' || typeof value.rationale !== 'string') return null;
  if (value.authority !== 'PROPOSAL_ONLY' || !Array.isArray(value.risks) || !value.provenance || typeof value.provenance !== 'object') return null;
  return {
    continuationId: value.continuationId,
    organizationId: value.organizationId,
    ownerUserId: value.ownerUserId,
    objectiveId: value.objectiveId,
    ...(typeof value.workflowId === 'string' ? { workflowId: value.workflowId } : {}),
    ...(typeof value.taskId === 'string' ? { taskId: value.taskId } : {}),
    jobId: value.jobId,
    disposition: value.disposition as ExecutiveContinuationDecision['disposition'],
    rationale: value.rationale,
    risks: value.risks.filter((risk): risk is string => typeof risk === 'string'),
    authority: 'PROPOSAL_ONLY',
    provenance: value.provenance as ExecutiveContinuationDecision['provenance'],
    ...(value.nextProposal && typeof value.nextProposal === 'object' ? { nextProposal: value.nextProposal as ExecutiveContinuationDecision['nextProposal'] } : {}),
    recordedAt: createdAt,
  };
}

/**
 * Durable executive history uses the existing append-only audit authority.
 * It records proposals only; it never changes objective/workflow/job state.
 */
export async function recordExecutiveContinuation(db: PrismaClient, decision: ExecutiveContinuationDecision): Promise<DurableExecutiveDecision> {
  if (decision.authority !== 'PROPOSAL_ONLY') throw new Error('Only proposal-only executive decisions may be persisted.');
  const existing = await getExecutiveContinuation(db, decision.organizationId, decision.continuationId);
  if (existing) return existing;

  const event = await db.auditEvent.create({
    data: {
      organization: { connect: { id: decision.organizationId } },
      actorType: 'AGENT',
      eventType: AUDIT_EVENTS.EXECUTIVE_CONTINUATION_RECORDED,
      resourceType: RESOURCE_TYPE,
      resourceId: decision.continuationId,
      action: 'record_executive_continuation',
      result: 'SUCCESS',
      metadata: sanitizeAuditMetadata({
        schemaVersion: 1,
        continuationId: decision.continuationId,
        organizationId: decision.organizationId,
        ownerUserId: decision.ownerUserId,
        objectiveId: decision.objectiveId,
        workflowId: decision.workflowId,
        taskId: decision.taskId,
        jobId: decision.jobId,
        disposition: decision.disposition,
        rationale: decision.rationale,
        risks: decision.risks,
        authority: decision.authority,
        provenance: decision.provenance,
        nextProposal: decision.nextProposal,
      }) as object,
    },
  });
  const recorded = toDecision(event.metadata, event.createdAt);
  if (!recorded) throw new Error('Persisted executive continuation could not be reconstructed.');
  return recorded;
}

export async function getExecutiveContinuation(db: PrismaClient, organizationId: string, continuationId: string): Promise<DurableExecutiveDecision | null> {
  const event = await db.auditEvent.findFirst({
    where: { organizationId, eventType: AUDIT_EVENTS.EXECUTIVE_CONTINUATION_RECORDED, resourceType: RESOURCE_TYPE, resourceId: continuationId },
    orderBy: { createdAt: 'desc' },
  });
  return event ? toDecision(event.metadata, event.createdAt) : null;
}

export async function listExecutiveContinuations(db: PrismaClient, organizationId: string, objectiveId?: string): Promise<DurableExecutiveDecision[]> {
  const events = await db.auditEvent.findMany({
    where: { organizationId, eventType: AUDIT_EVENTS.EXECUTIVE_CONTINUATION_RECORDED, resourceType: RESOURCE_TYPE },
    orderBy: { createdAt: 'desc' },
  });
  return events.map((event) => toDecision(event.metadata, event.createdAt)).filter((decision): decision is DurableExecutiveDecision => decision !== null && (!objectiveId || decision.objectiveId === objectiveId));
}
