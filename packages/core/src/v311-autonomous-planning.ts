import type { TaskRisk } from './task-graph.js';

export const V311_VERSION = '3.11.0';
export const V311_POLICY_VERSION = 'v3.11-autonomous-planning-1';
export const PLANNING_AUTHORITY = 'PROPOSE_WITHIN_EXISTING_CONTROL_PLANE' as const;

export type PlanningDecision = 'PLAN' | 'STOP' | 'APPROVAL_REQUIRED';
export type PlanningReason =
  | 'NEXT_STEP_SELECTED'
  | 'NO_ELIGIBLE_STEP'
  | 'OBJECTIVE_COMPLETED'
  | 'OBJECTIVE_CANCELLED'
  | 'PROVENANCE_MISMATCH'
  | 'DEPENDENCY_UNSATISFIED'
  | 'DUPLICATE_STEP'
  | 'RISK_REQUIRES_APPROVAL';

export interface PlanningCandidate {
  stepId: string;
  organizationId: string;
  objectiveId: string;
  taskId: string;
  correlationId: string;
  risk: TaskRisk | 'CRITICAL';
  dependencies: string[];
  priority: number;
}

export interface PlanningState {
  organizationId: string;
  objectiveId: string;
  taskId: string;
  correlationId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  completedStepIds: string[];
}

export interface AutonomousPlanProposal {
  authority: typeof PLANNING_AUTHORITY;
  policyVersion: typeof V311_POLICY_VERSION;
  decision: PlanningDecision;
  reason: PlanningReason;
  selectedStepId?: string;
  orderedEligibleStepIds: string[];
}

function fail(reason: PlanningReason, orderedEligibleStepIds: string[] = []): AutonomousPlanProposal {
  const decision: PlanningDecision = reason === 'RISK_REQUIRES_APPROVAL' ? 'APPROVAL_REQUIRED' : 'STOP';
  return { authority: PLANNING_AUTHORITY, policyVersion: V311_POLICY_VERSION, decision, reason, orderedEligibleStepIds };
}

export function validatePlanningProvenance(state: PlanningState, candidate: PlanningCandidate): void {
  if (candidate.organizationId !== state.organizationId || candidate.objectiveId !== state.objectiveId || candidate.taskId !== state.taskId || candidate.correlationId !== state.correlationId) {
    throw new Error('Planning provenance mismatch');
  }
}

/** Proposes one deterministic next step; it never executes or authorizes work. */
export function planNextStep(state: PlanningState, candidates: PlanningCandidate[]): AutonomousPlanProposal {
  if (!state.organizationId || !state.objectiveId || !state.taskId || !state.correlationId) return fail('PROVENANCE_MISMATCH');
  if (state.status === 'COMPLETED') return fail('OBJECTIVE_COMPLETED');
  if (state.status === 'CANCELLED') return fail('OBJECTIVE_CANCELLED');

  const completed = new Set(state.completedStepIds);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.stepId)) return fail('DUPLICATE_STEP');
    seen.add(candidate.stepId);
    try { validatePlanningProvenance(state, candidate); } catch { return fail('PROVENANCE_MISMATCH'); }
    if (!completed.has(candidate.stepId) && candidate.dependencies.includes(candidate.stepId)) return fail('DEPENDENCY_UNSATISFIED');
  }

  const eligible = candidates.filter((candidate) => !completed.has(candidate.stepId) && candidate.dependencies.every((dependencyId) => completed.has(dependencyId)));
  const ordered = [...eligible].sort((a, b) => b.priority - a.priority || a.stepId.localeCompare(b.stepId));
  const orderedIds = ordered.map((candidate) => candidate.stepId);
  if (ordered.length === 0) return fail('NO_ELIGIBLE_STEP');

  const selected = ordered[0]!;
  if (selected.risk === 'CRITICAL' || selected.risk === 'RED') {
    return { authority: PLANNING_AUTHORITY, policyVersion: V311_POLICY_VERSION, decision: 'APPROVAL_REQUIRED', reason: 'RISK_REQUIRES_APPROVAL', orderedEligibleStepIds: orderedIds };
  }
  return { authority: PLANNING_AUTHORITY, policyVersion: V311_POLICY_VERSION, decision: 'PLAN', reason: 'NEXT_STEP_SELECTED', selectedStepId: selected.stepId, orderedEligibleStepIds: orderedIds };
}
