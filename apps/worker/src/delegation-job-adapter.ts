import type { PrismaClient } from '@founder-os/db';
import { JobService } from './job-service.js';
import { JobDispatcher } from './job-dispatcher.js';
import { WorkerRuntime, type ExecutionAuthorizer, type ApprovalConsumer, type WorkerRunResult } from './worker-runtime.js';
import { buildAuthorizedDelegationJobInput, type AuthorizedWorker, type DelegationProposal } from '@founder-os/core';

export interface DelegationJobAdapterResult {
  kind: 'created' | 'existing' | 'not_dispatchable';
  jobId: string;
  workerId: string;
}

/** Thin Slice #8 adapter: creates only the existing Phase 1 durable Job. */
export class DelegationJobAdapter {
  private readonly jobs: JobService;
  private readonly dispatcher: JobDispatcher;
  private readonly runtime: WorkerRuntime;

  constructor(private readonly db: PrismaClient, options: { authorizeExecution: ExecutionAuthorizer; consumeExecutionApproval?: ApprovalConsumer }) {
    this.jobs = new JobService(db);
    this.dispatcher = new JobDispatcher(db);
    this.runtime = new WorkerRuntime(db, { authorizeExecution: options.authorizeExecution, consumeExecutionApproval: options.consumeExecutionApproval });
  }

  async enqueue(proposal: DelegationProposal, worker: AuthorizedWorker): Promise<DelegationJobAdapterResult> {
    const input = buildAuthorizedDelegationJobInput(proposal, worker);
    const job = await this.jobs.create({ organizationId: input.organizationId, taskId: input.taskId, workerIdentityId: input.workerIdentityId, idempotencyKey: input.idempotencyKey, metadata: input.metadata as Record<string, unknown> });
    if (!job) throw new Error('Authorized delegation could not create a same-organization durable job');
    return { kind: job.idempotencyKey === input.idempotencyKey ? 'created' : 'existing', jobId: job.id, workerId: worker.workerId };
  }

  async dispatch(organizationId: string, jobId: string, workerId: string): Promise<DelegationJobAdapterResult> {
    const result = await this.dispatcher.dispatchNext(organizationId);
    if (result.kind !== 'dispatched' || result.jobId !== jobId || result.workerId !== workerId) return { kind: 'not_dispatchable', jobId, workerId };
    return { kind: 'created', jobId, workerId };
  }

  async run(organizationId: string, jobId: string, workerId: string, credential: string, approvalId?: string): Promise<WorkerRunResult> {
    return this.runtime.run(organizationId, jobId, workerId, credential, approvalId);
  }
}
