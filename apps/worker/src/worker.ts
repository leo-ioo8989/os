import { db } from '@founder-os/db';
import { JobService } from './job-service.js';
import { WorkerRuntime, type ExecutionAuthorizer } from './worker-runtime.js';
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const service = new JobService(db);
export async function recoverJob(organizationId: string, jobId: string) { return service.resumeCandidate(organizationId, jobId); }
export async function runJob(organizationId: string, jobId: string, credential: string, authorizeExecution: ExecutionAuthorizer, approvalId?: string) { return new WorkerRuntime(db,{authorizeExecution}).run(organizationId,jobId,workerId,credential,approvalId); }
if (process.env.LEO_OS_WORKER_RUN === 'true' || process.env.FOUNDER_OS_WORKER_RUN === 'true') console.log(`LEO OS durable worker boundary ready: ${workerId}`);
