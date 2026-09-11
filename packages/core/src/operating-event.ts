import type { OutcomeEvaluation } from './outcome-evaluation.js';

export const GOVERNED_OPERATING_EVENT_AUTHORITY = 'PROPOSAL_ONLY' as const;
export const GOVERNED_OPERATING_EVENT_VERSION = 'deterministic-v1' as const;

export type GovernedOperatingEventType =
  | 'OUTCOME_EVALUATED'
  | 'EXECUTIVE_CONTINUATION_RECORDED'
  | 'WORKFORCE_LIFECYCLE_PROPOSED'
  | 'EXECUTION_COMPLETED';

export interface GovernedOperatingEvent {
  eventId: string;
  eventType: GovernedOperatingEventType;
  organizationId: string;
  ownerUserId: string;
  objectiveId?: string;
  workflowId?: string;
  taskId?: string;
  jobId?: string;
  sourceResourceType: string;
  sourceResourceId: string;
  sourceVersion: string;
  correlationId?: string;
  occurredAt: string;
  provenance: {
    version: typeof GOVERNED_OPERATING_EVENT_VERSION;
    sourceResourceType: string;
    sourceResourceId: string;
  };
  authority: typeof GOVERNED_OPERATING_EVENT_AUTHORITY;
}

const FORBIDDEN_KEYS = [
  'grantedPermissions',
  'grantedCapabilities',
  'approvalGranted',
  'workerId',
  'credentialId',
  'execute',
  'dispatch',
  'externalAction',
  'permissionGrant',
  'capabilityGrant',
  'authorization',
  'spend',
  'delete',
  'retry',
  'reassign',
] as const;

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const serialized = JSON.stringify(value);
  return FORBIDDEN_KEYS.some((key) => serialized.includes(`"${key}"`));
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function validateGovernedOperatingEvent(value: unknown): value is GovernedOperatingEvent {
  if (!value || typeof value !== 'object' || containsForbiddenKey(value)) return false;
  const event = value as Record<string, unknown>;
  if (!isString(event.eventId) || !isString(event.eventType)) return false;
  if (!isString(event.organizationId) || !isString(event.ownerUserId)) return false;
  if (!isString(event.sourceResourceType) || !isString(event.sourceResourceId)) return false;
  if (!isString(event.sourceVersion) || !isString(event.occurredAt)) return false;
  if (event.authority !== GOVERNED_OPERATING_EVENT_AUTHORITY) return false;
  if (!event.provenance || typeof event.provenance !== 'object') return false;
  const provenance = event.provenance as Record<string, unknown>;
  if (provenance.version !== GOVERNED_OPERATING_EVENT_VERSION) return false;
  if (provenance.sourceResourceType !== event.sourceResourceType) return false;
  if (provenance.sourceResourceId !== event.sourceResourceId) return false;
  for (const key of ['objectiveId', 'workflowId', 'taskId', 'jobId', 'correlationId']) {
    if (event[key] !== undefined && !isString(event[key])) return false;
  }
  return true;
}

export function buildGovernedOperatingEvent(input: Omit<GovernedOperatingEvent, 'authority' | 'eventId' | 'provenance'> & { eventId?: string }): GovernedOperatingEvent {
  if (containsForbiddenKey(input)) throw new Error('Operating event contains forbidden authority-bearing data');
  if (input.organizationId !== input.provenance?.sourceResourceId && false) throw new Error('unreachable');
  const event: GovernedOperatingEvent = {
    ...input,
    eventId: input.eventId ?? `${input.eventType}:${input.sourceResourceType}:${input.sourceResourceId}:${input.sourceVersion}`,
    authority: GOVERNED_OPERATING_EVENT_AUTHORITY,
    provenance: {
      version: GOVERNED_OPERATING_EVENT_VERSION,
      sourceResourceType: input.sourceResourceType,
      sourceResourceId: input.sourceResourceId,
    },
  };
  if (!validateGovernedOperatingEvent(event)) throw new Error('Invalid governed operating event');
  return event;
}

export function eventFromOutcomeEvaluation(evaluation: OutcomeEvaluation): GovernedOperatingEvent {
  const sourceResourceType = 'OUTCOME_EVALUATION';
  return buildGovernedOperatingEvent({
    eventType: 'OUTCOME_EVALUATED',
    organizationId: evaluation.organizationId,
    ownerUserId: evaluation.ownerUserId,
    objectiveId: evaluation.objectiveId,
    workflowId: evaluation.workflowId,
    taskId: evaluation.taskId,
    jobId: evaluation.jobId,
    sourceResourceType,
    sourceResourceId: evaluation.evaluationId,
    sourceVersion: evaluation.evaluationVersion,
    correlationId: evaluation.auditCorrelation,
    occurredAt: evaluation.evaluatedAt,
  });
}
