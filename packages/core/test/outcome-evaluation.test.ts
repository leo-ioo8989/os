import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOutcome,
  isOutcomeEvaluationFailure,
  type OutcomeEvaluationContext,
} from '../src/outcome-evaluation.js';

const baseCriteria = [
  { id: 'result', kind: 'FIELD_EQUALS', path: 'result', expected: 5 },
  { id: 'state', kind: 'FIELD_EQUALS', path: 'state', expected: 'done' },
] as const;

function context(overrides: Partial<OutcomeEvaluationContext> = {}): OutcomeEvaluationContext {
  return {
    organizationId: 'org-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', jobId: 'job-1',
    objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: baseCriteria },
    workflow: { id: 'workflow-1', organizationId: 'org-1', objectiveId: 'objective-1' },
    task: { id: 'task-1', organizationId: 'org-1', objectiveId: 'objective-1' },
    job: { id: 'job-1', organizationId: 'org-1', objectiveId: 'objective-1', workflowId: 'workflow-1', taskId: 'task-1', status: 'SUCCEEDED', workerIdentityId: 'worker-1' },
    worker: { id: 'worker-1', organizationId: 'org-1' },
    executionResult: { jobId: 'job-1', status: 'SUCCEEDED', output: { result: 5, state: 'done' }, handlerId: 'internal.calculate', validatedAt: '2026-09-11T00:00:00.000Z' },
    correlationId: 'corr-1',
    ...overrides,
  };
}

function evaluate(overrides: Partial<OutcomeEvaluationContext> = {}) {
  const result = evaluateOutcome(context(overrides), new Date('2026-09-11T01:00:00.000Z'));
  assert.equal(isOutcomeEvaluationFailure(result), false);
  if (isOutcomeEvaluationFailure(result)) throw new Error(result.reason);
  return result;
}

test('valid authoritative input produces proposal-only evaluation', () => {
  const result = evaluate();
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.qaDecision, 'PASS');
  assert.equal(result.authority, 'PROPOSAL_ONLY');
  assert.equal(result.evaluatorProvenance.resultJobId, 'job-1');
});

test('organization integrity is enforced across authoritative relationships', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-2', successCriteria: baseCriteria } });
  assert.deepEqual(result, { kind: 'CROSS_ORGANIZATION', reason: 'Authoritative organization relationships are inconsistent.' });
});

test('objective, task, workflow and job relationships are authoritative and fail closed', () => {
  const result = evaluate({ task: { id: 'task-2', organizationId: 'org-1', objectiveId: 'objective-1' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('satisfied deterministic criteria produce SATISFIED and ACHIEVED', () => {
  const result = evaluate();
  assert.deepEqual(result.evidence.map(item => item.state), ['SATISFIED', 'SATISFIED']);
  assert.deepEqual(result.unmetCriteria, []);
});

test('unsatisfied deterministic criteria produce UNSATISFIED and NOT_ACHIEVED', () => {
  const result = evaluate({ executionResult: { ...context().executionResult, output: { result: 4, state: 'done' } } });
  assert.equal(result.outcome, 'NOT_ACHIEVED');
  assert.equal(result.qaDecision, 'REWORK');
  assert.equal(result.evidence[0]?.state, 'UNSATISFIED');
});

test('missing evidence produces UNDETERMINED and INCONCLUSIVE', () => {
  const result = evaluate({ executionResult: { ...context().executionResult, output: { result: 5 } } });
  assert.equal(result.outcome, 'INCONCLUSIVE');
  assert.equal(result.qaDecision, 'ESCALATE');
  assert.equal(result.evidence[1]?.state, 'UNDETERMINED');
});

test('criterion state STATUS_EQUALS is deterministic', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'SUCCEEDED' }] } });
  assert.equal(result.evidence[0]?.state, 'SATISFIED');
  assert.equal(result.outcome, 'ACHIEVED');
});

test('numeric criterion supports deterministic comparison', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'NUMBER_COMPARE', path: 'score', operator: 'GTE', value: 80 }] }, executionResult: { ...context().executionResult, output: { score: 90 } } });
  assert.equal(result.outcome, 'ACHIEVED');
});

test('contradictory evidence produces INCONCLUSIVE rather than success', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ id: 'yes', kind: 'FIELD_EQUALS', path: 'state', expected: 'done' }, { id: 'no', kind: 'FIELD_EQUALS', path: 'state', expected: 'blocked' }] } });
  assert.equal(result.outcome, 'INCONCLUSIVE');
  assert.equal(result.qaDecision, 'ESCALATE');
});

test('unsupported or malformed criteria never become success', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: ['human-readable criterion'] } });
  assert.equal(result.outcome, 'INCONCLUSIVE');
  assert.equal(result.qaDecision, 'ESCALATE');
});

test('malformed authoritative input fails closed', () => {
  const result = evaluate({ executionResult: { ...context().executionResult, jobId: 'other-job' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('cross-organization worker relationship fails closed', () => {
  const result = evaluate({ worker: { id: 'worker-1', organizationId: 'org-2' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'CROSS_ORGANIZATION');
});

test('successful durable result requires terminal successful Job', () => {
  const result = evaluate({ job: { ...context().job, status: 'RUNNING' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.match(result.reason, /terminal successful Job/);
});

test('failed durable result requires terminal failed Job', () => {
  const result = evaluate({ job: { ...context().job, status: 'FAILED' }, executionResult: { ...context().executionResult, status: 'FAILED', output: undefined, failure: { code: 'X', message: 'failed', retryable: false } } });
  assert.equal(result.outcome, 'INCONCLUSIVE');
});

test('model suggestion cannot carry authority-bearing fields', () => {
  const result = evaluate({ modelSuggestion: { reasoning: 'x', workerId: 'worker-2' } });
  assert.deepEqual(result, { kind: 'AUTHORITY_VIOLATION', reason: 'Model suggestions cannot carry authority-bearing fields.' });
});

test('model suggestion without authority is inert data', () => {
  const result = evaluate({ modelSuggestion: { reasoning: 'evidence summary only' } });
  assert.equal(result.authority, 'PROPOSAL_ONLY');
});

test('evaluation does not expose execution or authorization commands', () => {
  const result = evaluate();
  assert.equal('execute' in result, false);
  assert.equal('dispatch' in result, false);
  assert.equal('retry' in result, false);
  assert.equal('reassign' in result, false);
  assert.equal('approvalGranted' in result, false);
  assert.equal('workerId' in result, false);
  assert.equal('credentialId' in result, false);
});

test('evaluation does not mutate Job/Task/Workflow/Objective state', () => {
  const input = context();
  const before = JSON.stringify(input);
  evaluate(input);
  assert.equal(JSON.stringify(input), before);
});

test('evaluation is deterministic for unchanged authoritative context', () => {
  const first = evaluate();
  const second = evaluate();
  assert.deepEqual(second, first);
});

test('provenance binds evaluator version, result identity and validation time', () => {
  const result = evaluate();
  assert.equal(result.evaluatorProvenance.evaluator, 'LEO_OS_OUTCOME_EVALUATOR');
  assert.equal(result.evaluatorProvenance.evaluatorVersion, 'deterministic-v1');
  assert.equal(result.evaluatorProvenance.resultValidatedAt, '2026-09-11T00:00:00.000Z');
  assert.equal(result.evaluatorProvenance.correlationId, 'corr-1');
});

test('evaluation timestamp does not change outcome semantics', () => {
  const a = evaluate();
  const b = evaluate();
  assert.equal(a.outcome, b.outcome);
  assert.equal(a.qaDecision, b.qaDecision);
});

test('authority is always PROPOSAL_ONLY', () => {
  for (const output of [evaluate(), evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'FIELD_EQUALS', path: 'result', expected: 99 }] } }), evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [] } })]) {
    assert.equal(output.authority, 'PROPOSAL_ONLY');
  }
});

test('missing criteria cannot become PASS', () => {
  const result = evaluate({ objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [] } });
  assert.notEqual(result.qaDecision, 'PASS');
  assert.equal(result.outcome, 'INCONCLUSIVE');
});

test('unknown fields in result output are ignored rather than treated as authority', () => {
  const result = evaluate({ executionResult: { ...context().executionResult, output: { result: 5, state: 'done', workerId: 'untrusted', execute: true } } });
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.authority, 'PROPOSAL_ONLY');
});

test('failed execution does not become success when success criteria require success status', () => {
  const result = evaluate({ job: { ...context().job, status: 'FAILED' }, objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'SUCCEEDED' }] }, executionResult: { ...context().executionResult, status: 'FAILED', output: undefined, failure: { code: 'FAILED', message: 'failed', retryable: false } } });
  assert.equal(result.outcome, 'NOT_ACHIEVED');
  assert.equal(result.qaDecision, 'REWORK');
});

test('failed execution can only be achieved when authoritative criteria explicitly expect failure', () => {
  const result = evaluate({ job: { ...context().job, status: 'FAILED' }, objective: { id: 'objective-1', organizationId: 'org-1', successCriteria: [{ kind: 'STATUS_EQUALS', expected: 'FAILED' }] }, executionResult: { ...context().executionResult, status: 'FAILED', output: undefined, failure: { code: 'EXPECTED', message: 'expected', retryable: false } } });
  assert.equal(result.outcome, 'ACHIEVED');
  assert.equal(result.qaDecision, 'PASS');
});

test('workflow/objective mismatch fails closed', () => {
  const result = evaluate({ workflow: { id: 'workflow-1', organizationId: 'org-1', objectiveId: 'objective-2' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('job/task/workflow mismatch fails closed', () => {
  const result = evaluate({ job: { ...context().job, taskId: 'task-2' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('worker identity mismatch fails closed', () => {
  const result = evaluate({ worker: { id: 'worker-2', organizationId: 'org-1' } });
  assert.equal(isOutcomeEvaluationFailure(result), true);
  assert.equal(result.kind, 'INVALID_INPUT');
});

test('retry and approval state are observed but cannot change authority', () => {
  const result = evaluate({ retryState: { attemptNumber: 3, maxAttempts: 3, retryable: true }, approvalState: { status: 'PENDING' } });
  assert.equal(result.authority, 'PROPOSAL_ONLY');
  assert.equal(result.qaDecision, 'PASS');
});

test('no second executor or worker runtime is represented by the evaluator API', () => {
  const result = evaluate();
  assert.equal(typeof evaluateOutcome, 'function');
  assert.equal('run' in result, false);
  assert.equal('execute' in result, false);
  assert.equal('dispatch' in result, false);
});

test('no authorization system is represented by the evaluator API', () => {
  const result = evaluate();
  assert.equal('authorize' in result, false);
  assert.equal('grant' in result, false);
  assert.equal('permission' in result, false);
});

test('no parallel audit system is represented by the evaluator API', () => {
  const result = evaluate();
  assert.equal('auditEvent' in result, false);
  assert.equal('auditLog' in result, false);
  assert.equal(result.evaluatorProvenance.evaluator, 'LEO_OS_OUTCOME_EVALUATOR');
});

test('durable-result compatibility consumes only the validated result contract', () => {
  const result = evaluate({ executionResult: { jobId: 'job-1', status: 'SUCCEEDED', output: { result: 5, state: 'done' }, handlerId: 'internal.calculate', validatedAt: new Date('2026-09-11T00:00:00.000Z') } });
  assert.equal(result.outcome, 'ACHIEVED');
});
