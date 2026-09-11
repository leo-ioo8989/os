import type { PrismaClient } from '@founder-os/db';
import { JobService } from './job-service.js';
import { JobDispatcher } from './job-dispatcher.js';
import { WorkerRuntime, type ExecutionAuthorizer, type ApprovalConsumer, type WorkerRunResult } from './worker-runtime.js';
import { buildDelegationJobInput, type ControlPlaneWorkerBinding, type DelegationProposal } from '@founder-os/core';

export interface DelegationJobAdapterResult { kind: 'created' | 'existing' | 'not_dispatchable'; jobId: string; workerId: string; }
export interface DelegationExecutionResult { job: DelegationJobAdapterResult; run: WorkerRunResult | null; }

/** Thin Slice #8 bridge into the existing Phase 1 durable execution architecture. */
export class DelegationJobAdapter {
  private readonly jobs: JobService;
  private readonly dispatcher: JobDispatcher;
  private readonly runtime: WorkerRuntime;

  constructor(private readonly db: PrismaClient, options: { authorizeExecution: ExecutionAuthorizer; consumeExecutionApproval?: ApprovalConsumer }) {
    this.jobs = new JobService(db);
    this.dispatcher = new JobDispatcher(db);
    this.runtime = new WorkerRuntime(db, { authorizeExecution: options.authorizeExecution, consumeExecutionApproval: options.consumeExecutionApproval });
  }

  async enqueue(proposal: DelegationProposal, worker: ControlPlaneWorkerBinding): Promise<DelegationJobAdapterResult> {
    const input = buildDelegationJobInput(proposal, worker);
    const job = await this.jobs.create({ organizationId: input.organizationId, taskId: input.taskId, workflowId: input.workflowId, workerIdentityId: input.workerIdentityId, idempotencyKey: input.idempotencyKey, metadata: input.metadata as Record<string, unknown> });
    if (!job) throw new Error('Delegation could not create a same-organization durable job');
    return { kind: 'created', jobId: job.id, workerId: worker.workerId };
  }

  async dispatch(organizationId: string, jobId: string, workerId: string, workflowId?: string): Promise<DelegationJobAdapterResult> {
    const result = await this.dispatcher.dispatchNext(organizationId, workflowId);
    if (result.kind !== 'dispatched' || result.jobId !== jobId || result.workerId !== workerId) return { kind: 'not_dispatchable', jobId, workerId };
    return { kind: 'created', jobId, workerId };
  }

  async run(organizationId: string, jobId: string, workerId: string, credential: string, approvalId?: string): Promise<WorkerRunResult> {
    return this.runtime.run(organizationId, jobId, workerId, credential, approvalId);
  }

  /** Production Slice #8 entry point; every execution step delegates to Phase 1 services. */
  async executeDelegation(proposal: DelegationProposal, worker: ControlPlaneWorkerBinding, credential: string, approvalId?: string): Promise<DelegationExecutionResult> {
    const job = await this.enqueue(proposal, worker);
    const dispatched = await this.dispatch(worker.organizationId, job.jobId, worker.workerId, worker.workflowId);
    if (dispatched.kind !== 'created') return { job: dispatched, run: null };
    const run = await this.run(worker.organizationId, dispatched.jobId, dispatched.workerId, credential, approvalId);
    return { job: dispatched, run };
  }
}
