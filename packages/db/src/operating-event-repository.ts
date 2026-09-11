import { validateGovernedOperatingEvent, type GovernedOperatingEvent } from '@founder-os/core';
import type { PrismaClient } from '@prisma/client';
import { AUDIT_EVENTS, sanitizeAuditMetadata } from './audit.js';

const RESOURCE_TYPE = 'GovernedOperatingEvent';

export async function recordGovernedOperatingEvent(db: PrismaClient, event: GovernedOperatingEvent): Promise<GovernedOperatingEvent> {
  if (!validateGovernedOperatingEvent(event)) throw new Error('Invalid governed operating event');
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
      metadata: sanitizeAuditMetadata(event) as any,
    },
  });
  if (!validateGovernedOperatingEvent(record.metadata)) throw new Error('Persisted governed operating event could not be reconstructed.');
  return record.metadata;
}

export async function getGovernedOperatingEvent(db: PrismaClient, organizationId: string, eventId: string): Promise<GovernedOperatingEvent | null> {
  const record = await db.auditEvent.findFirst({ where: { organizationId, eventType: AUDIT_EVENTS.GOVERNED_OPERATING_EVENT_RECORDED, resourceType: RESOURCE_TYPE, resourceId: eventId }, orderBy: { createdAt: 'desc' } });
  if (!record) return null;
  return validateGovernedOperatingEvent(record.metadata) ? record.metadata : null;
}

export async function listGovernedOperatingEvents(db: PrismaClient, organizationId: string, eventType?: GovernedOperatingEvent['eventType']): Promise<GovernedOperatingEvent[]> {
  const records = await db.auditEvent.findMany({ where: { organizationId, eventType: AUDIT_EVENTS.GOVERNED_OPERATING_EVENT_RECORDED, resourceType: RESOURCE_TYPE }, orderBy: { createdAt: 'desc' } });
  return records.map((record) => record.metadata).filter(validateGovernedOperatingEvent).filter((event) => eventType === undefined || event.eventType === eventType);
}
