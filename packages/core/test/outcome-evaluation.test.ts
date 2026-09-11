import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOutcome, isOutcomeEvaluationFailure, type OutcomeEvaluation, type OutcomeEvaluationContext } from '../src/outcome-evaluation.js';

const criteria = [
  { id: 'result', kind: 'FIELD_EQUALS', path: 'result', expected: 5 },
  { id: 'state', kind: 'FIELD_EQUALS', path: 'state', expected: 'done' },
] as const;

function context(overrides: Partial<OutcomeEvaluationContext> = {}): OutcomeEvaluationContext {
  return {
    organizationId: 'org-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', jobId: 'job-1',
    objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: criteria },
    workflow: { id: 'workflow-1', organizationId: 'org-1', objectiveId: 'objective-1' },
    task: { id: 'task-1', organizationId: 'org-1', objectiveId: 'objective-1' },
    job: { id: 'job-1', organizationId: 'org-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', status: 'SUCCEEDED', workerIdentityId: 'worker-1' },
    worker: { id: 'worker-1', organizationId: 'org-1' },
    executionResult: { jobId: 'job-1', status: 'SUCCEEDED', output: { result: 5, state: 'done' }, handlerId: 'internal.calculate', validatedAt: '2026-09-11T00:00:00.000Z' },
    correlationId: 'corr-1',
    ...overrides,
  };
}

function evaluation(overrides: Partial<OutcomeEvaluationContext> = {}): OutcomeEvaluation {
  const result = evaluateOutcome(context(overrides), new Date('2026-09-11T01:00:00.000Z'));
  if (isOutcomeEvaluationFailure(result)) throw new Error(result.reason);
  return result;
}

function failure(overrides: Partial<OutcomeEvaluationContext> = {}) {
  const result = evaluateOutcome(context(overrides), new Date('2026-09-11T01:00:00.000Z'));
  if (!isOutcomeEvaluationFailure(result)) throw new Error(`expected failure, got ${result.outcome}`);
  return result;
}

test('valid input produces proposal-only evaluation', () => {
  const result = evaluation();
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.qaDecision, 'PASS');
  assert.equal(result.authority, 'PROPOSAL_ONLY');
});

test('organization integrity and cross-org worker relationships fail closed', () => {
  assert.equal(failure({ objective: { id: 'objective-1', organizationId: 'org-2', successCriteria: criteria } }).kind, 'CROSS_ORGANIZATION');
  assert.equal(failure({ worker: { id: 'worker-1', organizationId: 'org-2' } }).kind, 'CROSS_ORGANIZATION');
});

test('authoritative objective/task/workflow/job relationships fail closed when inconsistent', () => {
  assert.equal(failure({ task: { id: 'task-2', organizationId: 'org-1', objectiveId: 'objective-1' } }).kind, 'INVALID_INPUT');
  assert.equal(failure({ workflow: { id: 'workflow-1', organizationId: 'org-1', objectiveId: 'objective-2' } }).kind, 'INVALID_INPUT');
  assert.equal(failure({ job: { ...context().job, taskId: 'task-2' } }).kind, 'INVALID_INPUT');
});

test('satisfied criteria produce SATISFIED and ACHIEVED/PASS', () => {
  const result = evaluation();
  assert.deepEqual(result.evidence.map(item => item.state), ['SATISFIED', 'SATISFIED']);
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.qaDecision, 'PASS');
});

test('unsatisfied criteria produce UNSATISFIED and NOT_ACHIEVED/REWORK', () => {
  const result = evaluation({ executionResult: { ...context().executionResult, output: { result: 4, state: 'done' } } });
  assert.equal(result.evidence[0]?.state, 'UNSATISFIED');
  assert.equal(result.outcome, 'NOT_ACHIEVED');
  assert.equal(result.qaDecision, 'REWORK');
});

test('missing evidence produces UNDETERMINED and INCONCLUSIVE/ESCALATE', () => {
  const result = evaluation({ executionResult: { ...context().executionResult, output: { result: 5 } } });
  assert.equal(result.evidence[1]?.state, 'UNDETERMINED');
  assert.equal(result.outcome, 'INCONCLUSIVE');
  assert.equal(result.qaDecision, 'ESCALATE');
});

test('numeric and status criteria are deterministic', () => {
  assert.equal(evaluation({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'NUMBER_COMPARE', path: 'score', operator: 'GTE', value: 80 }] }, executionResult: { ...context().executionResult, output: { score: 90 } } }).outcome, 'ACHIEVED');
  assert.equal(evaluation({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'SUCCEEDED' }] } }).outcome, 'ACHIEVED');
});

test('contradictory evidence is INCONCLUSIVE, never success', () => {
  const result = evaluation({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ id: 'yes', kind: 'FIELD_EQUALS', path: 'state', expected: 'done' }, { id: 'no', kind: 'FIELD_EQUALS', path: 'state', expected: 'blocked' }] } });
  assert.equal(result.outcome, 'INCONCLUSIVE');
  assert.equal(result.qaDecision, 'ESCALATE');
});

test('missing/unsupported criteria never become success', () => {
  assert.equal(evaluation({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [] } }).outcome, 'INCONCLUSIVE');
  assert.equal(evaluation({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: ['human-readable criterion'] } }).outcome, 'INCONCLUSIVE');
});

test('malformed input and worker mismatch fail closed', () => {
  assert.equal(failure({ executionResult: { ...context().executionResult, jobId: 'other-job' } }).kind, 'INVALID_INPUT');
  assert.equal(failure({ worker: { id: 'worker-2', organizationId: 'org-1' } }).kind, 'INVALID_INPUT');
});

test('durable result and Job terminal status must agree', () => {
  const successWithRunningJob = failure({ job: { ...context().job, status: 'RUNNING' } });
  assert.equal(successWithRunningJob.kind, 'INVALID_INPUT');
});

test('model authority-bearing fields are rejected; ordinary model data is inert', () => {
  assert.equal(failure({ modelSuggestion: { reasoning: 'x', workerId: 'worker-2' } }).kind, 'AUTHORITY_VIOLATION');
  assert.equal(evaluation({ modelSuggestion: { reasoning: 'evidence only' } }).authority, 'PROPOSAL_ONLY');
});

test('result output authority-looking fields remain untrusted data', () => {
  const result = evaluation({ executionResult: { ...context().executionResult, output: { result: 5, state: 'done', workerId: 'untrusted', execute: true } } });
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.authority, 'PROPOSAL_ONLY');
});

test('evaluation exposes no execution, authorization, approval, retry or reassignment commands', () => {
  const result = evaluation() as unknown as Record<string, unknown>;
  for (const key of ['execute', 'dispatch', 'authorize', 'approve', 'approvalGranted', 'retry', 'reassign', 'workerId', 'credentialId']) assert.equal(key in result, false);
});

test('evaluation does not mutate authoritative state', () => {
  const input = context();
  const before = JSON.stringify(input);
  evaluation(input);
  assert.equal(JSON.stringify(input), before);
});

test('unchanged authoritative context is repeatable and provenance-stable', () => {
  const first = evaluation();
  const second = evaluation();
  assert.deepEqual(second, first);
  assert.equal(first.evaluatorProvenance.evaluator, 'LEO_OS_OUTCOME_EVALUATOR');
  assert.equal(first.evaluatorProvenance.evaluatorVersion, 'deterministic-v1');
  assert.equal(first.evaluatorProvenance.resultJobId, 'job-1');
  assert.equal(first.evaluatorProvenance.resultValidatedAt, '2026-09-11T00:00:00.000Z');
  assert.equal(first.evaluatorProvenance.correlationId, 'corr-1');
});

test('failed execution cannot be ACHIEVED unless authoritative criteria explicitly expect failure', () => {
  const notAchieved = evaluation({ job: { ...context().job, status: 'FAILED' }, objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'SUCCEEDED' }] }, executionResult: { ...context().executionResult, status: 'FAILED', output: undefined, failure: { code: 'FAILED', message: 'failed', retryable: false } } });
  assert.equal(notAchieved.outcome, 'NOT_ACHIEVED');
  assert.equal(notAchieved.qaDecision, 'REWORK');
  const achieved = evaluation({ job: { ...context().job, status: 'FAILED' }, objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'FAILED' }] }, executionResult: { ...context().executionResult, status: 'FAILED', output: undefined, failure: { code: 'EXPECTED', message: 'expected', retryable: false } } });
  assert.equal(achieved.outcome, 'ACHIEVED');
  assert.equal(achieved.qaDecision, 'PASS');
});

test('retry and approval state cannot change evaluation authority', () => {
  const result = evaluation({ retryState: { attemptNumber: 3, maxAttempts: 3, retryable: true }, approvalState: { status: 'PENDING' } });
  assert.equal(result.authority, 'PROPOSAL_ONLY');
  assert.equal(result.qaDecision, 'PASS');
});

test('no second executor, worker runtime, authorization system or audit system is exposed', () => {
  const result = evaluation() as unknown as Record<string, unknown>;
  for (const key of ['run', 'execute', 'dispatch', 'authorize', 'grant', 'auditEvent', 'auditLog']) assert.equal(key in result, false);
});

test('durable result compatibility consumes the existing validated result shape only', () => {
  const result = evaluation({ executionResult: { jobId: 'job-1', status: 'SUCCEEDED', output: { result: 5, state: 'done' }, handlerId: 'internal.calculate', validatedAt: new Date('2026-09-11T00:00:00.000Z') } });
  assert.equal(result.outcome, 'ACHIEVED');
});
