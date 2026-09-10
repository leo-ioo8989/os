import type { ActorType, AuditResult, Prisma, PrismaClient } from '@prisma/client';

export const AUDIT_EVENTS = {
  AUTHENTICATION_SUCCEEDED: 'authentication.succeeded', AUTHENTICATION_FAILED: 'authentication.failed', AUTHORIZATION_DENIED: 'authorization.denied',
  OBJECTIVE_CREATED: 'objective.created', OBJECTIVE_UPDATED: 'objective.updated', OBJECTIVE_STATUS_CHANGED: 'objective.status_changed', OBJECTIVE_DELETED: 'objective.deleted',
  TASK_CREATED: 'task.created', TASK_UPDATED: 'task.updated', TASK_STATUS_CHANGED: 'task.status_changed', TASK_DELETED: 'task.deleted', TASK_DEPENDENCY_ADDED: 'task.dependency_added', TASK_DEPENDENCY_REMOVED: 'task.dependency_removed',
  APPROVAL_CREATED: 'approval.created', APPROVAL_APPROVED: 'approval.approved', APPROVAL_REJECTED: 'approval.rejected', APPROVAL_CANCELLED: 'approval.cancelled', APPROVAL_EXPIRED: 'approval.expired', WORKFLOW_CREATED: 'workflow.created', WORKFLOW_UPDATED: 'workflow.updated',
  JOB_CREATED: 'job.created', JOB_CLAIMED: 'job.claimed', JOB_STARTED: 'job.started', JOB_CHECKPOINT_CREATED: 'job.checkpoint.created', JOB_FAILED: 'job.failed', JOB_RETRY_SCHEDULED: 'job.retry_scheduled', JOB_RESUMED: 'job.resumed', JOB_SUCCEEDED: 'job.succeeded', JOB_CANCELLED: 'job.cancelled', JOB_STALE_LEASE_RECOVERED: 'job.stale_lease_recovered',
} as const;
export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];
const SENSITIVE_KEY = /(?:password|passphrase|token|secret|api[_-]?key|credential|authorization|cookie|private[_-]?key|access[_-]?key|refresh[_-]?token)/i;
export function sanitizeAuditMetadata(value: unknown): unknown { if(Array.isArray(value))return value.map(sanitizeAuditMetadata); if(!value||typeof value!=='object')return value; const out:Record<string,unknown>={}; for(const [key,item] of Object.entries(value))out[key]=SENSITIVE_KEY.test(key)?'[REDACTED]':sanitizeAuditMetadata(item); return out; }
export interface AuditEventInput { organizationId:string; actorId?:string; actorType:ActorType; eventType:AuditEventType; resourceType?:string; resourceId?:string; action:string; result:AuditResult; metadata?:Prisma.InputJsonValue; }
export async function recordAuditEvent(db:PrismaClient,input:AuditEventInput){return db.auditEvent.create({data:{organization:{connect:{id:input.organizationId}},actor:input.actorId?{connect:{id:input.actorId}}:undefined,actorType:input.actorType,eventType:input.eventType,resourceType:input.resourceType,resourceId:input.resourceId,action:input.action,result:input.result,metadata:sanitizeAuditMetadata(input.metadata??{}) as Prisma.InputJsonValue}});}
