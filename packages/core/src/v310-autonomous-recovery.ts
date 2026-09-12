import type { AutonomyState, AutonomyStepProposal } from './v309-bounded-autonomy.js';

export const V310_VERSION = '3.10.0';
export const V310_POLICY_VERSION = 'v3.10-autonomous-recovery-1';
export const RECOVERY_AUTHORITY = 'RECOVER_WITHIN_EXISTING_CONTROL_PLANE' as const;

export type RecoveryDecision = 'RESUME' | 'STOP' | 'APPROVAL_REQUIRED';
export type RecoveryReason =
  | 'STATE_VALID'
  | 'CHECKPOINT_MISMATCH'
  | 'PROVENANCE_MISMATCH'
  | 'NON_TERMINAL_STATE'
  | 'RETRY_LIMIT_REACHED'
  | 'RISK_REQUIRES_APPROVAL'
  | 'OBJECTIVE_COMPLETED'
  | 'OBJECTIVE_CANCELLED';

export interface RecoveryCheckpoint {
  organizationId: string;
  objectiveId: string;
  taskId: string;
  correlationId: string;
  stepId: string;
  stepsExecuted: number;
  failures: number;
  spentBudget: number;
  stateStatus: AutonomyState['status'];
  recordedAt: string;
}

export interface RecoveryRequest {
  state: AutonomyState;
  checkpoint: RecoveryCheckpoint;
  proposal: AutonomyStepProposal;
  maxRetries: number;
  nowMs: number;
}

export interface RecoveryResult {
  authority: typeof RECOVERY_AUTHORITY;
  decision: RecoveryDecision;
  reason: RecoveryReason;
  nextStep: number;
  checkpoint: RecoveryCheckpoint;
}

function validText(...values: string[]): boolean {
  return values.every((value) => value.trim().length > 0);
}

export function validateRecoveryCheckpoint(checkpoint: RecoveryCheckpoint): void {
  if (!validText(checkpoint.organizationId, checkpoint.objectiveId, checkpoint.taskId, checkpoint.correlationId, checkpoint.stepId, checkpoint.recordedAt)) {
    throw new Error('V310_PROVENANCE_REQUIRED');
  }
  if (!Number.isInteger(checkpoint.stepsExecuted) || checkpoint.stepsExecuted < 0) throw new Error('V310_INVALID_STEP_COUNT');
  if (!Number.isInteger(checkpoint.failures) || checkpoint.failures < 0) throw new Error('V310_INVALID_FAILURE_COUNT');
  if (!Number.isFinite(checkpoint.spentBudget) || checkpoint.spentBudget < 0) throw new Error('V310_INVALID_SPEND');
}

export function evaluateRecovery(request: RecoveryRequest): RecoveryResult {
  const { state, checkpoint, proposal } = request;
  validateRecoveryCheckpoint(checkpoint);
  if (!Number.isInteger(request.maxRetries) || request.maxRetries < 0 || request.maxRetries > 20) throw new Error('V310_INVALID_RETRY_LIMIT');
  if (!Number.isFinite(request.nowMs)) throw new Error('V310_INVALID_TIME');

  const bindingsMatch =
    state.organizationId === checkpoint.organizationId &&
    state.objectiveId === checkpoint.objectiveId &&
    state.taskId === checkpoint.taskId &&
    state.correlationId === checkpoint.correlationId &&
    proposal.organizationId === checkpoint.organizationId &&
    proposal.objectiveId === checkpoint.objectiveId &&
    proposal.taskId === checkpoint.taskId &&
    proposal.correlationId === checkpoint.correlationId &&
    proposal.stepId === checkpoint.stepId;

  if (!bindingsMatch) return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'PROVENANCE_MISMATCH', nextStep: state.stepsExecuted, checkpoint };
  if (state.status === 'COMPLETED') return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'OBJECTIVE_COMPLETED', nextStep: state.stepsExecuted, checkpoint };
  if (state.status === 'CANCELLED') return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'OBJECTIVE_CANCELLED', nextStep: state.stepsExecuted, checkpoint };
  if (state.stepsExecuted !== checkpoint.stepsExecuted || state.failures !== checkpoint.failures || state.spentBudget !== checkpoint.spentBudget) {
    return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'CHECKPOINT_MISMATCH', nextStep: state.stepsExecuted, checkpoint };
  }
  if (state.failures > request.maxRetries) return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'RETRY_LIMIT_REACHED', nextStep: state.stepsExecuted, checkpoint };
  if (proposal.risk === 'CRITICAL') return { authority: RECOVERY_AUTHORITY, decision: 'APPROVAL_REQUIRED', reason: 'RISK_REQUIRES_APPROVAL', nextStep: state.stepsExecuted, checkpoint };
  if (state.status !== 'ACTIVE') return { authority: RECOVERY_AUTHORITY, decision: 'STOP', reason: 'NON_TERMINAL_STATE', nextStep: state.stepsExecuted, checkpoint };
  return { authority: RECOVERY_AUTHORITY, decision: 'RESUME', reason: 'STATE_VALID', nextStep: state.stepsExecuted, checkpoint };
}

export function applyRecovery(state: AutonomyState, result: RecoveryResult): AutonomyState {
  if (result.decision !== 'RESUME') return { ...state, status: 'STOPPED' };
  return { ...state };
}
