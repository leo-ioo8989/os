import { validateGovernedOperatingEvent, type GovernedOperatingEvent } from '@founder-os/core';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AUDIT_EVENTS, sanitizeAuditMetadata } from './audit.js';

const RESOURCE_TYPE = 'GovernedOperatingEvent';

function isGovernedOperatingEvent(value: unknown): value is GovernedOperatingEvent {
  return validateGovernedOperatingEvent(value);
}

function reconstruct(metadata: unknown): GovernedOperatingEvent | null {
  return isGovernedOperatingEvent(metadata) ? (metadata as GovernedOperatingEvent) : null;
}

export async function recordGovernedOperatingEvent(db: PrismaClient, event: GovernedOperatingEvent): Promise<GovernedOperatingEvent> {
  if (!isGovernedOperatingEvent(event)) throw new Error('Invalid governed operating event');
  const existing = await getGovernedOperatingEvent(db, event.organizationId, event.eventId);
  if (existing) return existing;
  const record = await db.auditEvent.create({
    data: {
      organization: { connect: { id: event.organizationId } },
      actorType: 'AGENT',
      eventType: AUDIT_EVENTS.GOVERNED_OPERATING_EVENT_RECORDED,
      resourceType: RESOURCE_TYPE,
      resourceId: event.eventId,
      action: 'record_governed_operating_event',
      result: 'SUCCESS',
      metadata: sanitizeAuditMetadata(event) as Prisma.InputJsonValue,
    },
  });
  const reconstructed = reconstruct(record.metadata);
  if (!reconstructed) throw new Error('Persisted governed operating event could not be reconstructed.');
  return reconstructed;
}

export async function getGovernedOperatingEvent(db: PrismaClient, organizationId: string, eventId: string): Promise<GovernedOperatingEvent | null> {
  const record = await db.auditEvent.findFirst({ where: { organizationId, eventType: AUDIT_EVENTS.GOVERNED_OPERATING_EVENT_RECORDED, resourceType: RESOURCE_TYPE, resourceId: eventId }, orderBy: { createdAt: 'desc' } });
  return record ? reconstruct(record.metadata) : null;
}

export async function listGovernedOperatingEvents(db: PrismaClient, organizationId: string, eventType?: GovernedOperatingEvent['eventType']): Promise<GovernedOperatingEvent[]> {
  const records = await db.auditEvent.findMany({ where: { organizationId, eventType: AUDIT_EVENTS.GOVERNED_OPERATING_EVENT_RECORDED, resourceType: RESOURCE_TYPE }, orderBy: { createdAt: 'desc' } });
  return records.map((record) => reconstruct(record.metadata)).filter((event): event is GovernedOperatingEvent => event !== null).filter((event) => eventType === undefined || event.eventType === eventType);
}
