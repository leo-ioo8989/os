import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAutonomyStep, evaluateAutonomyStep, validateAutonomyLimits, type AutonomyState, type AutonomyStepProposal } from '../src/v309-bounded-autonomy.js';

const state = (overrides: Partial<AutonomyState> = {}): AutonomyState => ({ organizationId:'org-a', objectiveId:'obj-1', taskId:'task-1', correlationId:'corr-1', startedAt:'2026-09-12T00:00:00.000Z', stepsExecuted:0, failures:0, spentBudget:0, status:'ACTIVE', ...overrides });
const proposal = (overrides: Partial<AutonomyStepProposal> = {}): AutonomyStepProposal => ({ stepId:'step-1', organizationId:'org-a', objectiveId:'obj-1', taskId:'task-1', correlationId:'corr-1', risk:'LOW', resource:{ event:{ eventId:'evt-1', occurredAt:'2026-09-12T00:00:00.000Z', kind:'tool', estimatedCost:0.1, currency:'USD', provenance:{ organizationId:'org-a', correlationId:'corr-1' } }, policy:{ currency:'USD', budgetLimit:10 }, snapshot:{ quotaUsed:0, budgetUsed:0, concurrencyUsed:0, maxObservedLatencyMs:0 }, accountingEvidencePresent:true, identityEvidencePresent:true }, ...overrides });
const limits = { maxSteps:3, maxDurationMs:60_000, maxBudget:1, maxConsecutiveFailures:3, allowHighRisk:false };

test('validates bounded autonomy limits', () => {
  validateAutonomyLimits(limits);
  assert.throws(() => validateAutonomyLimits({ ...limits, maxSteps:0 }), /V309_INVALID_MAX_STEPS/);
});

test('continues only when resource governance allows the step', () => {
  const result = evaluateAutonomyStep(state(), limits, proposal(), 10_000, 0);
  assert.equal(result.decision, 'CONTINUE');
  assert.equal(result.nextStep, 1);
  assert.equal(applyAutonomyStep(state(), result).stepsExecuted, 1);
});

test('stops at the step boundary', () => {
  const result = evaluateAutonomyStep(state({ stepsExecuted:3 }), limits, proposal(), 10_000, 0);
  assert.equal(result.decision, 'STOP');
  assert.equal(result.reason, 'MAX_STEPS_REACHED');
});

test('stops when the autonomy time budget is exhausted', () => {
  const result = evaluateAutonomyStep(state(), limits, proposal(), 60_001, 0);
  assert.equal(result.decision, 'STOP');
  assert.equal(result.reason, 'MAX_DURATION_REACHED');
});

test('requires approval for high-risk autonomy', () => {
  const result = evaluateAutonomyStep(state(), limits, proposal({ risk:'HIGH' }), 1_000, 0);
  assert.equal(result.decision, 'APPROVAL_REQUIRED');
  assert.equal(result.reason, 'RISK_REQUIRES_APPROVAL');
});

test('fails closed on organization, objective, task or correlation rebinding', () => {
  assert.throws(() => evaluateAutonomyStep(state(), limits, proposal({ organizationId:'org-b' }), 1_000, 0), /V309_BINDING_MISMATCH/);
});

test('stops when V3.08 resource governance denies the next step', () => {
  const denied = proposal({ resource:{ ...proposal().resource, accountingEvidencePresent:false } });
  const result = evaluateAutonomyStep(state(), limits, denied, 1_000, 0);
  assert.equal(result.decision, 'STOP');
  assert.equal(result.reason, 'RESOURCE_DENIED');
});

test('does not advance state for approval or stop decisions', () => {
  const result = evaluateAutonomyStep(state(), limits, proposal({ risk:'CRITICAL' }), 1_000, 0);
  const after = applyAutonomyStep(state(), result);
  assert.equal(after.stepsExecuted, 0);
  assert.equal(after.status, 'STOPPED');
});
