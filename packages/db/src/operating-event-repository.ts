import {
  buildGovernedOperatingEvent,
  validateGovernedOperatingEvent,
  type GovernedOperatingEvent,
} from '@founder-os/core';
import { prisma } from './client.js';
import { AuditEventType } from './audit.js';

export async function recordGovernedOperatingEvent(event: GovernedOperatingEvent): Promise<GovernedOperatingEvent> {
  if (!validateGovernedOperatingEvent(event)) {
    throw new Error('Invalid governed operating event');
  }
  const existing = await prisma.auditEvent.findFirst({
    where: {
      organizationId: event.organizationId,
      eventType: AuditEventType.GOVERNED_OPERATING_EVENT_RECORDED,
      resourceType: event.sourceResourceType,
      resourceId: event.eventId,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    const candidate = existing.metadata;
    return validateGovernedOperatingEvent(candidate) ? candidate : (() => { throw new Error('Malformed persisted governed operating event'); })();
  }
  await prisma.auditEvent.create({
    data: {
      organizationId: event.organizationId,
      actorType: 'AGENT',
      actorId: event.ownerUserId,
      eventType: AuditEventType.GOVERNED_OPERATING_EVENT_RECORDED,
      resourceType: event.sourceResourceType,
      resourceId: event.eventId,
      metadata: event,
    },
  });
  return event;
}

export async function getGovernedOperatingEvent(
  organizationId: string,
  eventId: string,
): Promise<GovernedOperatingEvent | null> {
  const existing = await prisma.auditEvent.findFirst({
    where: {
      organizationId,
      eventType: AuditEventType.GOVERNED_OPERATING_EVENT_RECORDED,
      resourceId: eventId,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) return null;
  return validateGovernedOperatingEvent(existing.metadata) ? existing.metadata : null;
}

export async function listGovernedOperatingEvents(
  organizationId: string,
  eventType?: GovernedOperatingEvent['eventType'],
): Promise<GovernedOperatingEvent[]> {
  const events = await prisma.auditEvent.findMany({
    where: {
      organizationId,
      eventType: AuditEventType.GOVERNED_OPERATING_EVENT_RECORDED,
    },
    orderBy: { createdAt: 'asc' },
  });
  return events
    .map((record) => record.metadata)
    .filter(validateGovernedOperatingEvent)
    .filter((event) => eventType === undefined || event.eventType === eventType);
}

export { buildGovernedOperatingEvent };
