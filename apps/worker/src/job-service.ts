import type { PrismaClient } from '@founder-os/db';
import { AUDIT_EVENTS, JobRepository } from '@founder-os/db';
import type { JobStatus } from '@founder-os/core';

export class JobService {
  private readonly repository: JobRepository;
  constructor(private readonly db: PrismaClient) { this.repository = new JobRepository(db); }
  list(organizationId:string){return this.repository.list(organizationId);}
  get(organizationId:string,id:string){return this.repository.get(organizationId,id);}
  create(input:Parameters<JobRepository['create']>[0], actorId?:string){return this.repository.create(input,{organizationId:input.organizationId,actorId,actorType:actorId?'USER':'SYSTEM',eventType:AUDIT_EVENTS.JOB_CREATED,action:'create',result:'SUCCESS'});}
  claim(organizationId:string,id:string,workerId:string,leaseMs=30000){return this.repository.claim(organizationId,id,workerId,leaseMs,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_CLAIMED,action:'claim',result:'SUCCESS'});}
  start(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'CLAIMED','RUNNING',workerId,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_STARTED,action:'start',result:'SUCCESS'});}
  heartbeat(organizationId:string,id:string,workerId:string,leaseMs=30000){return this.repository.heartbeat(organizationId,id,workerId,leaseMs);}
  succeed(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'RUNNING','SUCCEEDED',workerId,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_SUCCEEDED,action:'succeed',result:'SUCCESS'});}
  fail(organizationId:string,id:string,workerId:string,code:string,message:string,retryable:boolean){return this.repository.fail(organizationId,id,workerId,{code,message,retryable},{organizationId,actorType:'SYSTEM',eventType:retryable?AUDIT_EVENTS.JOB_RETRY_SCHEDULED:AUDIT_EVENTS.JOB_FAILED,action:'fail',result:'FAILURE'});}
  cancel(organizationId:string,id:string,workerId:string){return this.repository.transition(organizationId,id,'RUNNING','CANCELLED',workerId,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_CANCELLED,action:'cancel',result:'SUCCESS'});}
  recoverStale(organizationId:string,id:string){return this.repository.recoverStale(organizationId,id,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_STALE_LEASE_RECOVERED,action:'recover_stale',result:'SUCCESS'});}
  checkpoint(organizationId:string,id:string,workerId:string,state:Record<string,unknown>){return this.repository.checkpoint(organizationId,id,state,workerId,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_CHECKPOINT_CREATED,action:'checkpoint',result:'SUCCESS'});}
  async resumeCandidate(organizationId:string,id:string){const job=await this.repository.get(organizationId,id); if(!job)return null; if(job.status==='RETRY_QUEUED')return job; if(job.status==='CLAIMED'||job.status==='RUNNING')return job.leaseExpiresAt&&job.leaseExpiresAt<=new Date()?this.repository.recoverStale(organizationId,id,{organizationId,actorType:'SYSTEM',eventType:AUDIT_EVENTS.JOB_STALE_LEASE_RECOVERED,action:'recover_stale',result:'SUCCESS'}):job; return null;}
}
export type { JobStatus };
