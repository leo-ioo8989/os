import { db } from '@founder-os/db';
import { JobService } from './job-service.js';
import { WorkerRuntime, type ExecutionAuthorizer, type ApprovalConsumer } from './worker-runtime.js';
import { DurableWorkerLoop, type WorkerLoopOptions } from './worker-loop.js';
import { ExecutionHandlerRegistry } from './execution-handlers.js';
import { createIntegrationHandlers } from './integration-handlers.js';
const workerId=process.env.WORKER_ID??`worker-${process.pid}`;
const service=new JobService(db);
const registry=new ExecutionHandlerRegistry(createIntegrationHandlers(db));
export async function recoverJob(organizationId:string,jobId:string){return service.resumeCandidate(organizationId,jobId)}
export async function runJob(organizationId:string,jobId:string,credential:string,authorizeExecution:ExecutionAuthorizer,approvalId?:string,consumeExecutionApproval?:ApprovalConsumer){return new WorkerRuntime(db,{authorizeExecution,consumeExecutionApproval,registry}).run(organizationId,jobId,workerId,credential,approvalId)}
export function createWorkerLoop(options:Omit<WorkerLoopOptions,'workerId'>&{workerId?:string}){return new DurableWorkerLoop(db,{...options,workerId:options.workerId??workerId,registry})}
if(process.env.LEO_OS_WORKER_RUN==='true'||process.env.FOUNDER_OS_WORKER_RUN==='true')console.log(`LEO OS durable worker boundary ready: ${workerId}`);
