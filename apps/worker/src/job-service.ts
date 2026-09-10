import type { PrismaClient } from '@founder-os/db';
import { AUDIT_EVENTS, JobRepository, WorkerRepository, recordAuditEvent, type AuditEventType } from '@founder-os/db';
import type { JobStatus } from '@founder-os/core';
export class JobService {
 private readonly repository:JobRepository; private readonly workers:WorkerRepository;
 constructor(private readonly db:PrismaClient){this.repository=new JobRepository(db);this.workers=new WorkerRepository(db);}
 list(organizationId:string){return this.repository.list(organizationId)} get(organizationId:string,id:string){return this.repository.get(organizationId,id)}
 create(input:Parameters<JobRepository['create']>[0],actorId?:string){return this.repository.create(input,{organizationId:input.organizationId,actorId,actorType:actorId?'USER':'SYSTEM',eventType:AUDIT_EVENTS.JOB_CREATED,action:'create',result:'SUCCESS'});}
 async authenticateWorker(organizationId:string,workerId:string,credential:string){const worker=await this.workers.authenticate(organizationId,workerId,credential,{organizationId,actorType:'SYSTEM',action:'authenticate',result:'SUCCESS'});if(!worker)throw new Error('Worker authentication failed.');return worker;}
 async claimAuthenticated(organizationId:string,id:string,workerId:string,credential:string,leaseMs=30000){await this.authenticateWorker(organizationId,workerId,credential);return this.repository.claim(organizationId,id,workerId,leaseMs,{organizationId,actorType:'AGENT',action:'claim',result:'SUCCESS'});}
 claim(organizationId:string,id:string,workerId:string,leaseMs=30000){return this.repository.claim(organizationId,id,workerId,leaseMs,{organizationId,actorType:'SYSTEM',action:'claim',result:'SUCCESS'});}
 start(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'CLAIMED','RUNNING',workerId,{organizationId,actorType:'SYSTEM',action:'start',result:'SUCCESS'});}
 waitForApproval(organizationId:string,id:string,workerId:string){return this.repository.setApprovalBlocked(organizationId,id,workerId,{organizationId,actorType:'AGENT',action:'approval_required',result:'SUCCESS'});}
 resolveApproval(organizationId:string,id:string,approved:boolean){return this.repository.resolveApproval(organizationId,id,approved,{organizationId,actorType:'SYSTEM',action:approved?'approval_granted':'approval_rejected',result:approved?'SUCCESS':'DENIED'});}
 heartbeat(organizationId:string,id:string,workerId:string,leaseMs=30000){return this.repository.heartbeat(organizationId,id,workerId,leaseMs)}
 succeed(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'RUNNING','SUCCEEDED',workerId,{organizationId,actorType:'SYSTEM',action:'succeed',result:'SUCCESS'})}
 fail(organizationId:string,id:string,workerId:string,code:string,message:string,retryable:boolean){return this.repository.fail(organizationId,id,workerId,{code,message,retryable},{organizationId,actorType:'SYSTEM',action:'fail',result:'FAILURE'})}
 cancel(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'RUNNING','CANCELLED',workerId,{organizationId,actorType:'SYSTEM',action:'cancel',result:'SUCCESS'})}
 recoverStale(organizationId:string,id:string){return this.repository.recoverStale(organizationId,id,{organizationId,actorType:'SYSTEM',action:'recover_stale',result:'SUCCESS'})}
 checkpoint(organizationId:string,id:string,workerId:string,state:Record<string,unknown>){return this.repository.checkpoint(organizationId,id,state,workerId,{organizationId,actorType:'SYSTEM',action:'checkpoint',result:'SUCCESS'})}
 audit(organizationId:string,eventType:AuditEventType,resourceType:string,resourceId:string,action:string,result:'SUCCESS'|'FAILURE'|'DENIED',metadata:Record<string,unknown>={}){return recordAuditEvent(this.db,{organizationId,actorType:'SYSTEM',eventType,resourceType,resourceId,action,result,metadata:metadata as never});}
 async resumeCandidate(organizationId:string,id:string){const job=await this.repository.get(organizationId,id);if(!job)return null;if(job.status==='RETRY_QUEUED')return job;if(job.status==='CLAIMED'||job.status==='RUNNING')return job.leaseExpiresAt&&job.leaseExpiresAt<=new Date()?this.repository.recoverStale(organizationId,id,{organizationId,actorType:'SYSTEM',action:'recover_stale',result:'SUCCESS'}):job;return null;}
}
export type {JobStatus};
