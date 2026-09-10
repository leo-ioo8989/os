import type { PrismaClient } from '@founder-os/db';
import { WorkerRepository } from '@founder-os/db';
import { JobService } from './job-service.js';

export interface DispatchResult {
  kind: 'dispatched' | 'no_worker' | 'not_ready';
  jobId: string;
  workerId?: string;
  reason?: string;
}

export class JobDispatcher {
  private readonly jobs: JobService;
  private readonly workers: WorkerRepository;

  constructor(private readonly db: PrismaClient, private readonly leaseMs = 30000) {
    this.jobs = new JobService(db);
    this.workers = new WorkerRepository(db);
  }

  async dispatchNext(organizationId: string, workflowId?: string): Promise<DispatchResult> {
    const jobs = await this.db.job.findMany({
      where: { organizationId, workflowId, status: { in: ['QUEUED', 'RETRY_QUEUED'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    const firstJob = jobs[0];
    if (!firstJob) return { kind: 'not_ready', jobId: '', reason: 'No queued jobs.' };

    const workers = (await this.workers.list(organizationId))
      .filter((w) => w.status === 'ACTIVE')
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const job of jobs) {
      const task = job.taskId ? await this.db.task.findFirst({ where: { id: job.taskId, objective: { organizationId } } }) : null;
      if (!task) continue;
      const metadata = task.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata) ? (task.metadata as Record<string, unknown>) : {};
      const required = typeof metadata.capability === 'string' ? metadata.capability : null;
      if (!required) continue;
      for (const worker of workers) {
        const capabilities = Array.isArray(worker.capabilities) ? worker.capabilities.filter((v): v is string => typeof v === 'string') : [];
        if (!capabilities.includes(required)) continue;
        const claim = await this.jobs.claim(organizationId, job.id, worker.id, this.leaseMs);
        if (claim.kind === 'claimed') return { kind: 'dispatched', jobId: job.id, workerId: worker.id };
      }
    }
    return { kind: 'no_worker', jobId: firstJob.id, reason: 'No active same-organization worker has the required capability.' };
  }
}
