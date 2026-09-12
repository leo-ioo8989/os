import type { ExecutionRisk } from './execution.js';
import { decideExecution, hasWorkerCapability } from './execution.js';
import type { ControlPlaneWorkerBinding } from './delegation.js';
import type { CredentialBroker, CredentialLease, CredentialReference } from './provider-credential-foundation.js';
import type { ToolGateway, ToolInvocationRequest, ToolResult } from './tool-adapters.js';
import { validateExternalActionProposal, type ExternalActionProposal } from './external-action-governance.js';

export const V3_06_VERSION = 'v3.06' as const;
export const WORKSPACE_ACTION_AUTHORITY = 'PROPOSAL_ONLY' as const;
export const WORKSPACE_CAPABILITIES = ['WORKSPACE_READ','WORKSPACE_WRITE','WORKSPACE_SEND','WORKSPACE_DELETE'] as const;
export type WorkspaceCapability = typeof WORKSPACE_CAPABILITIES[number];
export type WorkspaceProvider = 'GMAIL'|'GOOGLE_DRIVE'|'GOOGLE_CALENDAR'|'SLACK';
export type WorkspaceResource = 'MESSAGE'|'EMAIL'|'FILE'|'CALENDAR_EVENT'|'CHANNEL';
export type WorkspaceOperation = 'READ'|'CREATE'|'UPDATE'|'SEND'|'DELETE';
export type WorkspaceFailureCode = 'ACCOUNT_NOT_FOUND'|'ORG_MISMATCH'|'CREDENTIAL_INVALID'|'CAPABILITY_MISSING'|'MALFORMED_INPUT'|'AUTHORIZATION_DENIED'|'APPROVAL_REQUIRED'|'APPROVAL_INVALID'|'DUPLICATE_OPERATION'|'RECIPIENT_INVALID'|'POLICY_DENIED'|'PROMPT_INJECTION'|'RATE_LIMITED'|'TIMEOUT'|'EXTERNAL_FAILURE'|'RESULT_INVALID';

export interface WorkspaceAccountBinding { accountId:string; organizationId:string; provider:WorkspaceProvider; credential:CredentialReference; status:'ACTIVE'|'DISABLED'; allowedScopes:readonly string[]; }
export interface WorkspaceTarget { resource:WorkspaceResource; provider:WorkspaceProvider; accountId:string; resourceId?:string; }
export interface WorkspacePayload { subject?:string; body?:string; recipients?:readonly string[]; fileName?:string; content?:string; eventStart?:string; eventEnd?:string; channelId?:string; }
export interface WorkspaceOperationRequest { account:WorkspaceAccountBinding; target:WorkspaceTarget; operation:WorkspaceOperation; capability:WorkspaceCapability; payload?:WorkspacePayload; correlationId:string; idempotencyKey:string; risk:ExecutionRisk; approvalRequired:boolean; }
export interface WorkspaceOperationProposal extends ExternalActionProposal { action:'SEND_MESSAGE'|'CREATE_RESOURCE'|'UPDATE_RESOURCE'|'DELETE_RESOURCE'; target:string; provider:WorkspaceProvider; operation:WorkspaceOperation; accountId:string; resource:WorkspaceResource; authority:'PROPOSAL_ONLY'; }
export interface WorkspaceOperationResult { operationId:string; provider:WorkspaceProvider; accountId:string; resource:WorkspaceResource; operation:WorkspaceOperation; resourceId?:string; organizationId:string; verified:boolean; provenance:string; }
export interface WorkspaceApiTransport { execute(input:{accountId:string; target:WorkspaceTarget; operation:WorkspaceOperation; payload?:WorkspacePayload; credential:CredentialLease}): { resourceId?:string; verified:boolean }; }

const forbidden=['accessToken','apiKey','secret','credentialSecret','credentialId','approvalGranted','workerId','execute','dispatch','permissionGrant','capabilityGrant'];
function safe(value:unknown):void { const text=JSON.stringify(value); for(const field of forbidden) if(text.includes(`\"${field}\"`)) throw new Error(`Forbidden authority field: ${field}`); }
function validateIdentity(value:string,name:string):void { if(!value.trim()) throw new Error(`${name} is required`); }

export function validateWorkspacePayload(payload:WorkspacePayload|undefined, operation:WorkspaceOperation, provider:WorkspaceProvider):void {
  if(operation==='SEND') { if(!payload?.recipients?.length) throw new Error('Recipients are required'); if(payload.recipients.some(r=>!r.trim()||r.includes('\n')||r.includes('\r'))) throw new Error('Recipient is invalid'); if(!payload.body?.trim()) throw new Error('Message body is required'); }
  if(provider==='GMAIL' && operation==='SEND' && payload?.subject && payload.subject.length>500) throw new Error('Email subject is too long');
  if(operation==='CREATE' && provider==='GOOGLE_DRIVE' && !payload?.fileName?.trim()) throw new Error('Drive file name is required');
  if(provider==='GOOGLE_CALENDAR' && (operation==='CREATE'||operation==='UPDATE') && (!payload?.eventStart||!payload?.eventEnd)) throw new Error('Calendar start and end are required');
}

export function classifyWorkspaceRisk(operation:WorkspaceOperation, provider:WorkspaceProvider, destructive=false):ExecutionRisk { if(destructive||operation==='DELETE') return 'HIGH'; if(operation==='SEND'||(operation==='CREATE'&&provider==='GOOGLE_CALENDAR')) return 'HIGH'; if(operation==='UPDATE') return 'MEDIUM'; return 'LOW'; }

export function buildWorkspaceProposal(input:WorkspaceOperationRequest, ownerUserId:string):WorkspaceOperationProposal {
  validateIdentity(ownerUserId,'ownerUserId'); validateIdentity(input.account.accountId,'accountId'); validateIdentity(input.account.organizationId,'organizationId');
  if(input.account.organizationId!==input.target.accountId && input.account.accountId!==input.target.accountId) throw new Error('Target account mismatch');
  if(input.account.status!=='ACTIVE') throw new Error('Workspace account is not active');
  if(input.target.provider!==input.account.provider) throw new Error('Provider mismatch');
  validateWorkspacePayload(input.payload,input.operation,input.target.provider);
  const action:WorkspaceOperationProposal['action']=input.operation==='SEND'?'SEND_MESSAGE':input.operation==='DELETE'?'DELETE_RESOURCE':input.operation==='READ'?'CREATE_RESOURCE':input.operation==='CREATE'?'CREATE_RESOURCE':'UPDATE_RESOURCE';
  if(input.operation==='READ') throw new Error('Read operations are not external-action side effects');
  const proposal:WorkspaceOperationProposal={proposalId:`${input.account.organizationId}:workspace:${input.idempotencyKey}`,organizationId:input.account.organizationId,ownerUserId,action,target:`${input.target.provider.toLowerCase()}:${input.target.resource.toLowerCase()}:${input.target.resourceId??input.target.accountId}`,purpose:`${input.operation} ${input.target.resource} through governed workspace adapter`,risk:input.risk,approvalRequired:input.approvalRequired||input.risk==='HIGH'||input.risk==='CRITICAL',authority:'PROPOSAL_ONLY',provenance:'workspace-operations-v3.06',provider:input.target.provider,operation:input.operation,accountId:input.account.accountId,resource:input.target.resource};
  validateExternalActionProposal(proposal); safe(proposal); return proposal;
}

export function createWorkspaceToolRequest(input:WorkspaceOperationRequest, worker:ControlPlaneWorkerBinding, proposal:WorkspaceOperationProposal):ToolInvocationRequest {
  if(worker.organizationId!==input.account.organizationId||worker.taskId!==input.target.resourceId && input.target.resourceId!==undefined||!hasWorkerCapability(worker,input.capability)) throw new Error('Worker is not authorized for workspace operation');
  if(proposal.organizationId!==worker.organizationId||proposal.accountId!==input.account.accountId||proposal.operation!==input.operation) throw new Error('Workspace proposal is not bound to worker context');
  return {toolId:`workspace.${input.target.provider.toLowerCase()}.${input.operation.toLowerCase()}`,organizationId:worker.organizationId,taskId:worker.taskId,workerId:worker.workerId,capability:input.capability,input:{accountId:input.account.accountId,target:input.target,operation:input.operation,payload:input.payload},correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,approvalValid:!proposal.approvalRequired};
}

export class WorkspaceProviderAdapter {
  readonly toolId:string;
  constructor(readonly account:WorkspaceAccountBinding, private readonly broker:CredentialBroker, private readonly transport:WorkspaceApiTransport, operation:WorkspaceOperation) { this.toolId=`workspace.${account.provider.toLowerCase()}.${operation.toLowerCase()}`; }
  invoke(input:unknown, request:ToolInvocationRequest):ToolResult|{status:'FAILURE';code:'MALFORMED_INPUT'|'EXTERNAL_FAILURE'|'OUTPUT_INVALID';message:string;retryable:boolean} {
    const value=input as {accountId?:string;target?:WorkspaceTarget;operation?:WorkspaceOperation;payload?:WorkspacePayload};
    if(value.accountId!==this.account.accountId||!value.target||value.operation===undefined) return {status:'FAILURE',code:'MALFORMED_INPUT',message:'Workspace invocation input is incomplete',retryable:false};
    try { validateWorkspacePayload(value.payload,value.operation,value.target.provider); const response=this.broker.withCredential(this.account.credential,{organizationId:request.organizationId,providerId:this.account.credential.providerId,modelId:'workspace-api',credentialId:this.account.credential.credentialId,correlationId:request.correlationId,authorization:'AUTHORIZED_WORKER'},credential=>this.transport.execute({accountId:this.account.accountId,target:value.target!,operation:value.operation!,payload:value.payload,credential})); if(!response.verified) return {status:'FAILURE',code:'OUTPUT_INVALID',message:'Workspace provider result was not verified',retryable:false}; const result={status:'SUCCESS' as const,toolId:this.toolId,organizationId:request.organizationId,taskId:request.taskId,workerId:request.workerId,correlationId:request.correlationId,idempotencyKey:request.idempotencyKey,output:{operationId:request.idempotencyKey,provider:this.account.provider,accountId:this.account.accountId,resource:value.target.resource,operation:value.operation,resourceId:response.resourceId,organizationId:request.organizationId,verified:true,provenance:'workspace-provider-adapter-v3.06'},provenance:'workspace-provider-adapter-v3.06'}; safe(result.output); return result; } catch(error) { return {status:'FAILURE',code:'EXTERNAL_FAILURE',message:error instanceof Error?error.message:String(error),retryable:true}; }
  }
}

export class DeterministicWorkspaceTransport implements WorkspaceApiTransport { execute(input:{accountId:string;target:WorkspaceTarget;operation:WorkspaceOperation;payload?:WorkspacePayload;credential:CredentialLease}):{resourceId?:string;verified:boolean} { if(!input.credential.secret) throw new Error('Credential unavailable'); return {resourceId:`${input.accountId}:${input.target.resource.toLowerCase()}:${input.operation.toLowerCase()}`,verified:true}; } }

export interface WorkspaceOperationContext { worker:ControlPlaneWorkerBinding; toolGateway:ToolGateway; proposal:WorkspaceOperationProposal; request:WorkspaceOperationRequest; }
export function executeWorkspaceOperation(ctx:WorkspaceOperationContext):unknown { const decision=decideExecution(ctx.request.risk,true,!ctx.proposal.approvalRequired); if(decision==='DENY') return {status:'FAILURE',code:'POLICY_DENIED',message:'Workspace operation denied by execution policy',retryable:false}; if(decision==='REQUIRES_APPROVAL') return {status:'FAILURE',code:'APPROVAL_REQUIRED',message:'Valid independent approval is required',retryable:false}; return ctx.toolGateway.invoke(createWorkspaceToolRequest(ctx.request,ctx.worker,ctx.proposal),{worker:ctx.worker,approvalValid:true}); }

export function validateWorkspaceResult(result:WorkspaceOperationResult, request:WorkspaceOperationRequest):void { if(!result.verified||result.organizationId!==request.account.organizationId||result.accountId!==request.account.accountId||result.provider!==request.account.provider||result.operation!==request.operation) throw new Error('Workspace result failed authoritative validation'); safe(result); }
