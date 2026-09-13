import type { PrismaClient } from '@founder-os/db';
import { JobService } from './job-service.js';
import { WorkerRuntime, type ExecutionAuthorizer, type ApprovalConsumer } from './worker-runtime.js';
import { ExecutionHandlerRegistry } from './execution-handlers.js';
import { createIntegrationHandlers } from './integration-handlers.js';

export type WorkerLoopOptions = {
  organizationId: string;
  workerId: string;
  credential: string;
  authorizeExecution: ExecutionAuthorizer;
  consumeExecutionApproval?: ApprovalConsumer;
  pollMs?: number;
  concurrency?: number;
  registry?: ExecutionHandlerRegistry;
  signal?: AbortSignal;
};

export class DurableWorkerLoop {
  private readonly jobs: JobService;
  private readonly runtime: WorkerRuntime;
  private running = false;
  private stopRequested = false;
  private readonly pollMs: number;
  private readonly concurrency: number;
  private active = new Set<Promise<unknown>>();

  constructor(private readonly db: PrismaClient, private readonly options: WorkerLoopOptions) {
    this.jobs = new JobService(db);
    this.runtime = new WorkerRuntime(db, {
      registry: options.registry ?? new ExecutionHandlerRegistry(createIntegrationHandlers(db)),
      authorizeExecution: options.authorizeExecution,
      consumeExecutionApproval: options.consumeExecutionApproval,
    });
    this.pollMs = Math.max(100, options.pollMs ?? 1000);
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 16));
  }

  async run(): Promise<void> {
    if (this.running) throw new Error('Worker loop is already running.');
    this.running = true;
    this.stopRequested = false;
    try {
      while (!this.stopRequested && !this.options.signal?.aborted) {
        await this.recoverAndDispatch();
        if (!this.active.size) await new Promise(resolve => setTimeout(resolve, this.pollMs));
        else await Promise.race([...this.active]);
      }
      await Promise.allSettled([...this.active]);
    } finally { this.running = false; this.stopRequested = false; }
  }

  stop(): void { this.stopRequested = true; }

  private async recoverAndDispatch(): Promise<void> {
    const jobs = await this.jobs.listRunnable(this.options.organizationId, new Date(), Math.max(50, this.concurrency * 4));
    for (const listedJob of jobs) {
      if (this.stopRequested || this.options.signal?.aborted || this.active.size >= this.concurrency) break;
      const job = (listedJob.status === 'CLAIMED' || listedJob.status === 'RUNNING')
        ? await this.jobs.resumeCandidate(this.options.organizationId, listedJob.id)
        : listedJob;
      if (!job || (job.status !== 'QUEUED' && job.status !== 'RETRY_QUEUED' && job.status !== 'CLAIMED')) continue;
      const task = job.taskId ? await this.db.task.findFirst({ where: { id: job.taskId, objective: { organizationId: this.options.organizationId } } }) : null;
      if (!task) continue;
      const metadata = task.metadata as Record<string, unknown> | null;
      if (!metadata?.handlerId || !metadata?.capability || !metadata?.risk) continue;
      const promise = this.runtime.run(this.options.organizationId, job.id, this.options.workerId, this.options.credential)
        .catch(() => undefined)
        .finally(() => this.active.delete(promise));
      this.active.add(promise);
    }
  }
}