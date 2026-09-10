import { db } from '@founder-os/db';
import { JobService } from './job-service.js';

const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const service = new JobService(db);

export async function recoverJob(organizationId: string, jobId: string) {
  return service.resumeCandidate(organizationId, jobId);
}

if (process.env.LEO_OS_WORKER_RUN === 'true' || process.env.FOUNDER_OS_WORKER_RUN === 'true') {
  console.log(`LEO OS durable worker boundary ready: ${workerId}`);
}
