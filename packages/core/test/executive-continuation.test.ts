import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerIntent, type OwnerIntent } from '../src/intent.js';
import { continueExecutive, isExecutiveContinuationFailure, type ExecutiveContinuationContext } from '../src/executive-continuation.js';
import type { OutcomeEvaluation } from '../src/outcome-evaluation.js';

const intent: OwnerIntent = createOwnerIntent({
  intentId: 'intent-1', organizationId: 'org-1', ownerUserId: 'owner-1', requestedOutcome: 'Complete the objective',
  constraints: [], priority: 'LOW', riskRequirements: [], createdAt: '2026-09-11T00:00:00.000Z', correlationId: 'corr-1',
});

function evaluation(outcome: OutcomeEvaluation['outcome']): OutcomeEvaluation {
  return {
    organizationId: 'org-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', jobId: 'job-1',
    evaluationId: `evaluation-${outcome.toLowerCase()}`, outcome,
    qaDecision: outcome === 'ACHIEVED' ? 'PASS' : outcome === 'NOT_ACHIEVED' ? 'REWORK' : 'ESCALATE',
    confidence: outcome === 'INCONCLUSIVE' ? 0 : 1,
    evidence: [], unmetCriteria: outcome === 'ACHIEVED' ? [] : ['criterion-1'],
    reasoningSummary: 'deterministic test evaluation',
    evaluatorProvenance: { evaluator: 'LEO_OS_OUTCOME_EVALUATOR', evaluatorVersion: 'deterministic-v1', resultJobId: 'job-1', resultValidatedAt: '2026-09-11T01:00:00.000Z', correlationId: 'corr-1' },
    evaluatedAt: '2026-09-11T02:00:00.000Z', authority: 'PROPOSAL_ONLY',
  };
}

function context(outcome: OutcomeEvaluation['outcome'] = 'ACHIEVED'): ExecutiveContinuationContext {
  return {
    organizationId: 'org-1', ownerUserId: 'owner-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', jobId: 'job-1',
    originalIntent: intent, outcomeEvaluation: evaluation(outcome), correlationId: 'corr-1',
  };
}

test('ACHIEVED produces COMPLETE and no next execution proposal', () => {
  const result = continueExecutive(context());
  assert.equal(isExecutiveContinuationFailure(result), false);
  if (isExecutiveContinuationFailure(result)) return;
  assert.equal(result.disposition, 'COMPLETE');
  assert.equal(result.nextProposal, undefined);
  assert.equal(result.authority, 'PROPOSAL_ONLY');
});

test('NOT_ACHIEVED produces REWORK and a validated proposal-only plan', () => {
  const result = continueExecutive(context('NOT_ACHIEVED'));
  assert.equal(isExecutiveContinuationFailure(result), false);
  if (isExecutiveContinuationFailure(result)) return;
  assert.equal(result.disposition, 'REWORK');
  assert.ok(result.nextProposal);
  assert.equal(result.nextProposal?.authority, 'PROPOSAL_ONLY');
  assert.equal(result.nextProposal?.organizationId, 'org-1');
  assert.match(result.nextProposal?.rationale ?? '', /proposal-only continuation/);
});

test('INCONCLUSIVE produces ESCALATE and does not guess or execute', () => {
  const result = continueExecutive(context('INCONCLUSIVE'));
  assert.equal(isExecutiveContinuationFailure(result), false);
  if (isExecutiveContinuationFailure(result)) return;
  assert.equal(result.disposition, 'ESCALATE');
  assert.equal(result.nextProposal, undefined);
});

test('organization mismatch fails closed', () => {
  const result = continueExecutive({ ...context(), organizationId: 'org-2' });
  assert.equal(isExecutiveContinuationFailure(result), true);
  if (!isExecutiveContinuationFailure(result)) return;
  assert.equal(result.kind, 'CROSS_ORGANIZATION');
});

test('owner mismatch fails closed', () => {
  const result = continueExecutive({ ...context(), ownerUserId: 'owner-2' });
  assert.equal(isExecutiveContinuationFailure(result), true);
  if (!isExecutiveContinuationFailure(result)) return;
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('outcome identity mismatch fails closed', () => {
  const result = continueExecutive({ ...context(), jobId: 'job-2' });
  assert.equal(isExecutiveContinuationFailure(result), true);
  if (!isExecutiveContinuationFailure(result)) return;
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('unexpected outcome authority fails closed', () => {
  const result = continueExecutive({ ...context(), outcomeEvaluation: { ...evaluation('ACHIEVED'), authority: 'NOT_AUTHORIZED' as never } });
  assert.equal(isExecutiveContinuationFailure(result), true);
  if (!isExecutiveContinuationFailure(result)) return;
  assert.equal(result.kind, 'AUTHORITY_VIOLATION');
});

test('continuation decision has no execution or authorization commands', () => {
  const result = continueExecutive(context('NOT_ACHIEVED'));
  assert.equal(isExecutiveContinuationFailure(result), false);
  if (isExecutiveContinuationFailure(result)) return;
  const record = result as unknown as Record<string, unknown>;
  for (const key of ['execute', 'dispatch', 'authorize', 'approve', 'approvalGranted', 'workerId', 'credentialId', 'retry', 'reassign']) {
    assert.equal(key in record, false, `unexpected authority field: ${key}`);
  }
  for (const key of ['execute', 'dispatch', 'authorize', 'approve', 'approvalGranted', 'workerId', 'credentialId']) {
    assert.equal(key in (result.nextProposal ?? {}), false, `unexpected proposal authority field: ${key}`);
  }
});

test('same authoritative input produces the same continuation decision', () => {
  const a = continueExecutive(context('NOT_ACHIEVED'));
  const b = continueExecutive(context('NOT_ACHIEVED'));
  assert.deepEqual(a, b);
});

test('continuation does not mutate the supplied context', () => {
  const input = context('NOT_ACHIEVED');
  const before = JSON.stringify(input);
  continueExecutive(input);
  assert.equal(JSON.stringify(input), before);
});

test('continuation proposal reuses existing plan validation semantics', () => {
  const result = continueExecutive(context('NOT_ACHIEVED'));
  assert.equal(isExecutiveContinuationFailure(result), false);
  if (isExecutiveContinuationFailure(result)) return;
  assert.equal(result.nextProposal?.tasks.length, 1);
  assert.equal(result.nextProposal?.tasks[0]?.targetOrganizationId, 'org-1');
  assert.equal(result.nextProposal?.tasks[0]?.taskId.startsWith('intent-1:continuation:'), true);
});
