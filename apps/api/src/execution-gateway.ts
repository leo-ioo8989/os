import type { PrismaClient, RiskLevel } from '@prisma/client';
import { decideExecution, hasWorkerCapability, type ExecutionIntent } from '@founder-os/core';
import { ApprovalRepository, AUDIT_EVENTS, WorkerRepository, executionFingerprint } from '@founder-os/db';
import { ApiError } from './errors.js';
const POLICY_VERSION='v1';
export interface GatewayRequest extends Omit<ExecutionIntent,'risk'> { capability:string; risk:RiskLevel; credential:string; approvalId?:string; expiresAt?:Date; reason?:string; }
export async function authorizeExecution(db:PrismaClient,request:GatewayRequest){
 const worker=await new WorkerRepository(db).authenticate(request.organizationId,request.workerId,request.credential,{organizationId:request.organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.WORKER_AUTHENTICATED,action:'authenticate',result:'SUCCESS'});
 if(!worker)throw new ApiError(401,'UNAUTHENTICATED','Worker authentication failed.');
 if(worker.status!=='ACTIVE')throw new ApiError(403,'UNAUTHORIZED','Worker is not active.');
 const fingerprint=executionFingerprint(request); let approvalValid=false;
 if(request.approvalId){const approval=await new ApprovalRepository(db).get(request.organizationId,request.approvalId);approvalValid=!!approval&&approval.status==='APPROVED'&&!approval.consumedAt&&(!approval.expiresAt||approval.expiresAt>new Date())&&approval.actionFingerprint===fingerprint&&approval.requesterAgentId===request.workerId&&approval.policyVersion===POLICY_VERSION;}
 const capabilities=Array.isArray(worker.capabilities)?worker.capabilities.filter((v):v is string=>typeof v==='string'):[];
 const decision=decideExecution(request.risk,hasWorkerCapability({capabilities},request.capability),approvalValid);
 await db.$transaction(async tx=>{await tx.auditEvent.create({data:{organization:{connect:{id:request.organizationId}},actorType:'AGENT',eventType:decision==='ALLOW'?AUDIT_EVENTS.EXECUTION_ALLOWED:decision==='DENY'?AUDIT_EVENTS.EXECUTION_DENIED:AUDIT_EVENTS.EXECUTION_APPROVAL_REQUIRED,resourceType:'Execution',resourceId:fingerprint,action:request.action,result:decision==='DENY'?'DENIED':'SUCCESS',metadata:{action:request.action,target:request.target,risk:request.risk,decision,capability:request.capability,approvalId:request.approvalId??null,fingerprint}}});},{isolationLevel:'Serializable'});
 if(decision==='REQUIRES_APPROVAL'){const approval=await new ApprovalRepository(db).create({organizationId:request.organizationId,requesterAgentId:request.workerId,targetResourceType:'Execution',targetResourceId:request.target,action:request.action,actionFingerprint:fingerprint,policyVersion:POLICY_VERSION,riskLevel:request.risk,reason:request.reason??'Privileged execution requires approval.',evidence:{capability:request.capability,target:request.target,risk:request.risk},expiresAt:request.expiresAt},{organizationId:request.organizationId,actorType:'AGENT',eventType:AUDIT_EVENTS.EXECUTION_APPROVAL_REQUIRED,action:'approval_required',result:'SUCCESS'});return{decision,approvalId:approval.id,fingerprint};}
 return{decision,fingerprint};
}
export async function consumeExecutionApproval(db:PrismaClient,organizationId:string,workerId:string,approvalId:string,intent:GatewayRequest){const fingerprint=executionFingerprint(intent);const result=await new ApprovalRepository(db).consume(organizationId,approvalId,fingerprint,workerId,{organizationId,actorType:'AGENT',eventType:AUDIT_EVENTS.EXECUTION_APPROVED,action:'consume',result:'SUCCESS'});if(result.kind==='missing')throw new ApiError(404,'NOT_FOUND','Approval not found.');if(result.kind!=='consumed')throw new ApiError(409,'CONFLICT','Approval is invalid, expired, already consumed, or does not match the requested action.');return{decision:'ALLOW' as const,fingerprint};}
