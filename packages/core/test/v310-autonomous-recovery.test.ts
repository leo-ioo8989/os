import { describe, expect, it } from 'vitest';
import { applyRecovery, evaluateRecovery, validateRecoveryCheckpoint } from '../src/v310-autonomous-recovery.js';
import type { AutonomyState, AutonomyStepProposal } from '../src/v309-bounded-autonomy.js';

const state: AutonomyState = {
  organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-1', correlationId: 'corr-1',
  startedAt: new Date(0).toISOString(), stepsExecuted: 3, failures: 1, spentBudget: 2,
  status: 'ACTIVE',
};
const proposal: AutonomyStepProposal = {
  stepId: 'step-4', organizationId: 'org-1', objectiveId: 'obj-1', taskId: 'task-1', correlationId: 'corr-1', risk: 'LOW',
  resource: { event: { organizationId: 'org-1', projectId: 'p', taskId: 'task-1', jobId: 'job-1', workerId: 'w', correlationId: 'corr-1', provider: 'test', model: 'test', tool: 'test', estimatedCost: 0, currency: 'USD', latencyMs: 1 }, snapshot: { quotaUsed: 0, quotaLimit: 10, budgetUsed: 2, budgetLimit: 10, concurrentActions: 0, concurrencyLimit: 2 }, policy: { allowedProviders: ['test'], allowedModels: ['test'], allowedTools: ['test'], maxActionCost: 1, maxLatencyMs: 100 } },
};
const checkpoint = { ...state, stepId: 'step-4', recordedAt: new Date(1000).toISOString() };

describe('V3.10 autonomous recovery', () => {
  it('validates checkpoints', () => expect(() => validateRecoveryCheckpoint(checkpoint)).not.toThrow());
  it('resumes an exact active checkpoint', () => expect(evaluateRecovery({ state, checkpoint, proposal, maxRetries: 3, nowMs: 2000 }).decision).toBe('RESUME'));
  it('fails closed on checkpoint mismatch', () => expect(evaluateRecovery({ state: { ...state, spentBudget: 9 }, checkpoint, proposal, maxRetries: 3, nowMs: 2000 }).reason).toBe('CHECKPOINT_MISMATCH'));
  it('fails closed on provenance rebinding', () => expect(evaluateRecovery({ state, checkpoint, proposal: { ...proposal, taskId: 'other' }, maxRetries: 3, nowMs: 2000 }).reason).toBe('PROVENANCE_MISMATCH'));
  it('stops after retry limit', () => expect(evaluateRecovery({ state: { ...state, failures: 4 }, checkpoint: { ...checkpoint, failures: 4 }, proposal, maxRetries: 3, nowMs: 2000 }).reason).toBe('RETRY_LIMIT_REACHED'));
  it('requires approval for critical-risk recovery', () => expect(evaluateRecovery({ state, checkpoint, proposal: { ...proposal, risk: 'CRITICAL' }, maxRetries: 3, nowMs: 2000 }).decision).toBe('APPROVAL_REQUIRED'));
  it('does not mutate progress on resume', () => expect(applyRecovery(state, evaluateRecovery({ state, checkpoint, proposal, maxRetries: 3, nowMs: 2000 }))).toEqual(state));
  it('stops completed objectives', () => expect(evaluateRecovery({ state: { ...state, status: 'COMPLETED' }, checkpoint, proposal, maxRetries: 3, nowMs: 2000 }).decision).toBe('STOP'));
});
