import type { PrismaClient, WorkflowStatus } from '@prisma/client';
import { hasPermission, type Role } from '@founder-os/core';
import { WorkflowRepository, WORKFLOW_TRANSITIONS, type CreateWorkflowInput } from '@founder-os/db';
import { ApiError } from './errors.js';
function requireWorkflowPermission(role: Role) { if (!hasPermission(role, 'workflow:run')) throw new ApiError(403,'UNAUTHORIZED','You are not authorized to manage workflow state.'); }
export async function createWorkflowState(db: PrismaClient, organizationId: string, actorId: string, role: Role, input: Omit<CreateWorkflowInput,'organizationId'>) { requireWorkflowPermission(role); if (!input.currentState || input.currentState.length > 200) throw new ApiError(422,'VALIDATION_ERROR','currentState is invalid.'); const item=await new WorkflowRepository(db).create({ ...input, organizationId }, { organizationId, actorId, actorType:'USER', eventType:'workflow.created', action:'create', result:'SUCCESS' }); if(!item)throw new ApiError(409,'CONFLICT','Workflow parent references are invalid for this organization.'); return item; }
export async function getWorkflowState(db: PrismaClient, organizationId: string, id: string, role: Role) { requireWorkflowPermission(role); const item=await new WorkflowRepository(db).get(organizationId,id); if(!item)throw new ApiError(404,'NOT_FOUND','Workflow not found.'); return item; }
export async function listWorkflowStates(db: PrismaClient, organizationId: string, role: Role) { requireWorkflowPermission(role); return new WorkflowRepository(db).list(organizationId); }
export async function transitionWorkflowState(db: PrismaClient, organizationId: string, id: string, actorId: string, role: Role, next: WorkflowStatus, patch: { currentState?: string; currentTaskId?: string; currentJobId?: string; resumableState?: Record<string,unknown>; metadata?: Record<string,unknown>; failureCode?: string; failureMessage?: string; }) {
  requireWorkflowPermission(role);
  if(!Object.prototype.hasOwnProperty.call(WORKFLOW_TRANSITIONS,next)) throw new ApiError(422,'VALIDATION_ERROR','Workflow status is invalid.');
  const current=await new WorkflowRepository(db).get(organizationId,id); if(!current)throw new ApiError(404,'NOT_FOUND','Workflow not found.');
  if(!WORKFLOW_TRANSITIONS[current.status].includes(next))throw new ApiError(409,'CONFLICT',`Cannot change workflow status from ${current.status} to ${next}.`);
  if(patch.currentState!==undefined && (!patch.currentState || patch.currentState.length>200))throw new ApiError(422,'VALIDATION_ERROR','currentState is invalid.');
  const result=await new WorkflowRepository(db).transition(organizationId,id,next,{organizationId,actorId,actorType:'USER',eventType:'workflow.updated',action:'status_change',result:'SUCCESS'},new Date(),patch);
  if(result.kind==='missing')throw new ApiError(404,'NOT_FOUND','Workflow not found.');
  if(result.kind==='conflict')throw new ApiError(409,'CONFLICT',`Cannot change workflow status from ${result.status} to ${next}.`);
  return result.item;
}
