import type { PrismaClient } from '@founder-os/db';
import type { ControlPlaneWorkerBinding, DelegationProposal } from '@founder-os/core';
import { DelegationJobAdapter, type DelegationExecutionResult } from './delegation-job-adapter.js';
import type { ExecutionAuthorizer, ApprovalConsumer } from './worker-runtime.js';

export interface ControlPlaneDelegationExecutionOptions {
  authorizeExecution: ExecutionAuthorizer;
  consumeExecutionApproval?: ApprovalConsumer;
}

/**
 * Single production bridge from an already-authoritative control-plane
 * delegation decision into the existing durable Phase 1 executor.
 *
 * This function does not authorize a worker, grant approval, create credentials,
 * mutate policy, or implement another execution state machine. The supplied
 * binding is authoritative input and DelegationJobAdapter owns the existing
 * JobService -> Dispatcher -> WorkerRuntime -> ExecutionGateway path.
 */
export async function executeDelegationFromControlPlane(
  db: PrismaClient,
  proposal: DelegationProposal,
  worker: ControlPlaneWorkerBinding,
  credential: string,
  options: ControlPlaneDelegationExecutionOptions,
  approvalId?: string,
): Promise<DelegationExecutionResult> {
  const adapter = new DelegationJobAdapter(db, options);
  return adapter.executeDelegation(proposal, worker, credential, approvalId);
}
