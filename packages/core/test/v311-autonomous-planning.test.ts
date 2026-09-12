import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planNextStep, validatePlanningProvenance } from '../src/v311-autonomous-planning.js';
import type { PlanningCandidate, PlanningState } from '../src/v311-autonomous-planning.js';

const state: PlanningState = {
  organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-root', correlationId: 'corr-1',
  status: 'ACTIVE', completedStepIds: ['step-0'],
};

const candidate = (stepId: string, overrides: Partial<PlanningCandidate> = {}): PlanningCandidate => ({
  stepId, organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-root', correlationId: 'corr-1',
  risk: 'GREEN', dependencies: ['step-0'], priority: 0, ...overrides,
});

describe('V3.11 deterministic autonomous planning', () => {
  it('selects the highest priority eligible step', () => {
    const result = planNextStep(state, [candidate('step-b', { priority: 1 }), candidate('step-a', { priority: 5 })]);
    assert.equal(result.decision, 'PLAN');
    assert.equal(result.selectedStepId, 'step-a');
    assert.deepEqual(result.orderedEligibleStepIds, ['step-a', 'step-b']);
  });

  it('uses step id as a deterministic tie-breaker', () => {
    const result = planNextStep(state, [candidate('step-z'), candidate('step-a')]);
    assert.deepEqual(result.orderedEligibleStepIds, ['step-a', 'step-z']);
  });

  it('filters completed steps', () => {
    const result = planNextStep(state, [candidate('step-0'), candidate('step-1')]);
    assert.equal(result.selectedStepId, 'step-1');
  });

  it('does not select a step with unmet dependency', () => {
    const result = planNextStep(state, [candidate('step-1', { dependencies: ['step-missing'] })]);
    assert.equal(result.reason, 'NO_ELIGIBLE_STEP');
  });

  it('fails closed on provenance mismatch', () => {
    const result = planNextStep(state, [candidate('step-1', { taskId: 'other-task' })]);
    assert.equal(result.reason, 'PROVENANCE_MISMATCH');
  });

  it('rejects duplicate step proposals', () => {
    const result = planNextStep(state, [candidate('step-1'), candidate('step-1')]);
    assert.equal(result.reason, 'DUPLICATE_STEP');
  });

  it('requires approval for red and critical risk', () => {
    assert.equal(planNextStep(state, [candidate('red', { risk: 'RED' })]).decision, 'APPROVAL_REQUIRED');
    assert.equal(planNextStep(state, [candidate('critical', { risk: 'CRITICAL' })]).decision, 'APPROVAL_REQUIRED');
  });

  it('stops terminal objectives', () => {
    assert.equal(planNextStep({ ...state, status: 'COMPLETED' }, [candidate('step-1')]).reason, 'OBJECTIVE_COMPLETED');
    assert.equal(planNextStep({ ...state, status: 'CANCELLED' }, [candidate('step-1')]).reason, 'OBJECTIVE_CANCELLED');
  });

  it('validates all provenance bindings', () => {
    assert.throws(() => validatePlanningProvenance(state, candidate('step-1', { correlationId: 'other' })));
  });

  it('does not mutate planning inputs', () => {
    const input = [candidate('step-1'), candidate('step-2', { priority: 2 })];
    const before = JSON.stringify(input);
    planNextStep(state, input);
    assert.equal(JSON.stringify(input), before);
  });
});
