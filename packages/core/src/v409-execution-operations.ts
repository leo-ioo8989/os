import type { Provenance } from './phase4-operationalization.js';
export const V409_VERSION='4.09.0';
export type JobStatus='QUEUED'|'LEASED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED'|'DEAD_LETTER';
export interface Job { id:string;provenance:Provenance;status:JobStatus;attempts:number;maxAttempts:number;leaseUntil?:string;workerId?:string; }
export function leaseJob(j:Job,workerId:string,leaseUntil:string):Job{if(j.status!=='QUEUED'&&j.status!=='FAILED')throw new Error('V409_NOT_LEASABLE');if(!workerId||new Date(leaseUntil).getTime()<=Date.now())throw new Error('V409_INVALID_LEASE');return {...j,status:'LEASED',workerId,leaseUntil};}
export function heartbeat(j:Job,workerId:string,leaseUntil:string):Job{if(j.status!=='LEASED'&&j.status!=='RUNNING'||j.workerId!==workerId)throw new Error('V409_HEARTBEAT_DENIED');return {...j,status:'RUNNING',leaseUntil};}
export function completeJob(j:Job,ok:boolean):Job{return {...j,status:ok?'SUCCEEDED':(j.attempts+1>=j.maxAttempts?'DEAD_LETTER':'FAILED'),attempts:j.attempts+(ok?0:1)};}
