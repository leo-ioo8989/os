import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRecovery, evaluateRecovery, validateRecoveryCheckpoint } from '../src/v310-autonomous-recovery.js';
import type { AutonomyState, AutonomyStepProposal } from '../src/v309-bounded-autonomy.js';

const state: AutonomyState = { organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-1', correlationId: 'corr-1', startedAt: new Date(0).toISOString(), stepsExecuted: 3, failures: 1, spentBudget: 2, status: 'ACTIVE' };
const proposal: AutonomyStepProposal = { stepId: 'step-4', organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-1', correlationId: 'corr-1', risk: 'LOW', resource: { event: { organizationId: 'org-1', projectId: 'p', taskId: 'task-1', jobId: 'job-1', workerId: 'w', correlationId: 'corr-1', provider: 'test', model: 'test', tool: 'test', estimatedCost: 0, currency: 'USD', latencyMs: 1 }, snapshot: { quotaUsed: 0, quotaLimit: 10, budgetUsed: 2, budgetLimit: 10, concurrentActions: 0, concurrencyLimit: 2 }, policy: { allowedProviders: ['test'], allowedModels: ['test'], allowedTools: ['test'], maxActionCost: 1, maxLatencyMs: 100 } } };
const checkpoint = { ...state, stepId: 'step-4', recordedAt: new Date(1000).toISOString() };

const recovery = (overrides: Partial<Parameters<typeof evaluateRecovery>[0]> = {}) => evaluateRecovery({ state, checkpoint, proposal, maxRetries: 3, nowMs: 2000, ...overrides });

describe('V3.10 autonomous recovery', () => {
  it('validates checkpoints', () => assert.doesNotThrow(() => validateRecoveryCheckpoint(checkpoint)));
  it('resumes an exact active checkpoint', () => assert.equal(recovery().decision, 'RESUME'));
  it('fails closed on checkpoint mismatch', () => assert.equal(recovery({ state: { ...state, spentBudget: 9 } }).reason, 'CHECKPOINT_MISMATCH'));
  it('fails closed on provenance rebinding', () => assert.equal(recovery({ proposal: { ...proposal, taskId: 'other' } }).reason, 'PROVENANCE_MISMATCH'));
  it('stops after retry limit', () => assert.equal(recovery({ state: { ...state, failures: 4 }, checkpoint: { ...checkpoint, failures: 4 } }).reason, 'RETRY_LIMIT_REACHED'));
  it('requires approval for critical-risk recovery', () => assert.equal(recovery({ proposal: { ...proposal, risk: 'CRITICAL' } }).decision, 'APPROVAL_REQUIRED'));
  it('does not mutate progress on resume', () => assert.deepEqual(applyRecovery(state, recovery()), state));
  it('stops completed objectives', () => assert.equal(recovery({ state: { ...state, status: 'COMPLETED' } }).decision, 'STOP'));
});
