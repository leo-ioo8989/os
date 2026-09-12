import type { ResourceDecisionInput, ResourceDecisionResult } from './v308-resource-governance.js';
import { decideResourceUse } from './v308-resource-governance.js';

export const V309_VERSION = '3.09.0';
export const V309_POLICY_VERSION = 'v3.09-bounded-autonomy-1';
export const AUTONOMY_AUTHORITY = 'PROPOSAL_TO_EXISTING_CONTROL_PLANE' as const;

export type AutonomyDecision = 'CONTINUE' | 'STOP' | 'APPROVAL_REQUIRED';
export type AutonomyStopReason =
  | 'MAX_STEPS_REACHED' | 'MAX_DURATION_REACHED' | 'BUDGET_EXHAUSTED'
  | 'QUOTA_EXHAUSTED' | 'RISK_REQUIRES_APPROVAL' | 'RESOURCE_DENIED'
  | 'OBJECTIVE_COMPLETED' | 'OBJECTIVE_CANCELLED' | 'MISSING_PROVENANCE';

export interface AutonomyLimits {
  maxSteps: number;
  maxDurationMs: number;
  maxBudget: number;
  maxConsecutiveFailures: number;
  allowHighRisk: boolean;
}

export interface AutonomyState {
  organizationId: string;
  objectiveId: string;
  taskId: string;
  correlationId: string;
  startedAt: string;
  stepsExecuted: number;
  failures: number;
  spentBudget: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'STOPPED';
}

export interface AutonomyStepProposal {
  stepId: string;
  organizationId: string;
  objectiveId: string;
  taskId: string;
  correlationId: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resource: ResourceDecisionInput;
}

export interface AutonomyDecisionResult {
  authority: typeof AUTONOMY_AUTHORITY;
  decision: AutonomyDecision;
  reason: AutonomyStopReason | 'RESOURCE_POLICY_SATISFIED';
  resource: ResourceDecisionResult;
  nextStep: number;
}

const fail = (reason: AutonomyStopReason, resource: ResourceDecisionResult, steps: number): AutonomyDecisionResult => ({
  authority: AUTONOMY_AUTHORITY, decision: 'STOP', reason, resource, nextStep: steps,
});

export function validateAutonomyLimits(limits: AutonomyLimits): void {
  if (!Number.isInteger(limits.maxSteps) || limits.maxSteps < 1 || limits.maxSteps > 1000) throw new Error('V309_INVALID_MAX_STEPS');
  if (!Number.isFinite(limits.maxDurationMs) || limits.maxDurationMs < 1 || limits.maxDurationMs > 86_400_000) throw new Error('V309_INVALID_MAX_DURATION');
  if (!Number.isFinite(limits.maxBudget) || limits.maxBudget < 0) throw new Error('V309_INVALID_MAX_BUDGET');
  if (!Number.isInteger(limits.maxConsecutiveFailures) || limits.maxConsecutiveFailures < 1 || limits.maxConsecutiveFailures > 20) throw new Error('V309_INVALID_FAILURE_LIMIT');
}

export function validateAutonomyState(state: AutonomyState): void {
  if (!state.organizationId.trim() || !state.objectiveId.trim() || !state.taskId.trim() || !state.correlationId.trim() || !state.startedAt.trim()) throw new Error('V309_PROVENANCE_REQUIRED');
  if (!Number.isInteger(state.stepsExecuted) || state.stepsExecuted < 0) throw new Error('V309_INVALID_STEP_COUNT');
  if (!Number.isInteger(state.failures) || state.failures < 0) throw new Error('V309_INVALID_FAILURE_COUNT');
  if (!Number.isFinite(state.spentBudget) || state.spentBudget < 0) throw new Error('V309_INVALID_SPEND');
}

export function evaluateAutonomyStep(
  state: AutonomyState,
  limits: AutonomyLimits,
  proposal: AutonomyStepProposal,
  nowMs: number,
  startMs: number,
): AutonomyDecisionResult {
  validateAutonomyLimits(limits);
  validateAutonomyState(state);
  if (!proposal.stepId.trim() || !proposal.organizationId.trim() || !proposal.objectiveId.trim() || !proposal.taskId.trim() || !proposal.correlationId.trim()) throw new Error('V309_STEP_PROVENANCE_REQUIRED');
  if (proposal.organizationId !== state.organizationId || proposal.objectiveId !== state.objectiveId || proposal.taskId !== state.taskId || proposal.correlationId !== state.correlationId) throw new Error('V309_BINDING_MISMATCH');
  if (state.status !== 'ACTIVE') return fail(state.status === 'COMPLETED' ? 'OBJECTIVE_COMPLETED' : 'OBJECTIVE_CANCELLED', proposal.resource as unknown as ResourceDecisionResult, state.stepsExecuted);
  if (state.stepsExecuted >= limits.maxSteps) return fail('MAX_STEPS_REACHED', proposal.resource as unknown as ResourceDecisionResult, state.stepsExecuted);
  if (!Number.isFinite(nowMs) || !Number.isFinite(startMs) || nowMs < startMs || nowMs - startMs > limits.maxDurationMs) return fail('MAX_DURATION_REACHED', proposal.resource as unknown as ResourceDecisionResult, state.stepsExecuted);
  if (state.spentBudget >= limits.maxBudget) return fail('BUDGET_EXHAUSTED', proposal.resource as unknown as ResourceDecisionResult, state.stepsExecuted);
  if (state.failures >= limits.maxConsecutiveFailures) return fail('MAX_STEPS_REACHED', proposal.resource as unknown as ResourceDecisionResult, state.stepsExecuted);
  if ((proposal.risk === 'HIGH' || proposal.risk === 'CRITICAL') && !limits.allowHighRisk) return {
    authority: AUTONOMY_AUTHORITY, decision: 'APPROVAL_REQUIRED', reason: 'RISK_REQUIRES_APPROVAL', resource: { decision: 'APPROVAL_REQUIRED', policyVersion: V309_POLICY_VERSION, reasons: ['AUTONOMY_HIGH_RISK_BOUNDARY'], estimatedCost: proposal.resource.event.estimatedCost, projectedQuotaUsed: proposal.resource.snapshot.quotaUsed, projectedBudgetUsed: proposal.resource.snapshot.budgetUsed }, nextStep: state.stepsExecuted,
  };
  const resource = decideResourceUse(proposal.resource);
  if (resource.decision === 'DENY') return fail('RESOURCE_DENIED', resource, state.stepsExecuted);
  if (resource.decision === 'APPROVAL_REQUIRED') return { authority: AUTONOMY_AUTHORITY, decision: 'APPROVAL_REQUIRED', reason: 'RISK_REQUIRES_APPROVAL', resource, nextStep: state.stepsExecuted };
  return { authority: AUTONOMY_AUTHORITY, decision: 'CONTINUE', reason: 'RESOURCE_POLICY_SATISFIED', resource, nextStep: state.stepsExecuted + 1 };
}

export function applyAutonomyStep(state: AutonomyState, decision: AutonomyDecisionResult): AutonomyState {
  validateAutonomyState(state);
  if (decision.decision !== 'CONTINUE') return { ...state, status: 'STOPPED' };
  return { ...state, stepsExecuted: state.stepsExecuted + 1, spentBudget: state.spentBudget + decision.resource.estimatedCost };
}
