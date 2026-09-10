import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CEOReasoningEngine,
  DeterministicTestModel,
  type CEOReasoningModelOutput,
  type CEOReasoningRequest,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  createOwnerIntent,
} from '../src/index.js';

const intent = () => createOwnerIntent({
  intentId: 'intent-ceo-1',
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  requestedOutcome: 'Prepare the weekly company report',
  constraints: ['Use current company data'],
  priority: 'HIGH',
  riskRequirements: ['owner review'],
  createdAt: '2026-09-10T12:00:00.000Z',
  correlationId: 'trace-ceo-1',
});

const plan = () => ({
  objective: 'Prepare the weekly company report',
  tasks: [{
    taskId: 'ceo-task-1',
    title: 'Prepare report',
    description: 'Draft the weekly company report',
    order: 1,
    dependencies: [],
    requiredCapabilities: ['reporting'],
    requiredPermissions: ['task:read'] as const,
    risk: 'HIGH' as const,
    approvalRequired: true,
    proposedWorkerRole: 'analyst',
  }],
  requiredCapabilities: ['reporting'],
  requiredPermissions: ['task:read'] as const,
  risk: 'HIGH' as const,
  approvalRequired: true,
  rationale: 'Bounded decision proposal for owner review.',
});

const output = (overrides: Partial<CEOReasoningModelOutput> = {}): CEOReasoningModelOutput => ({
  strategy: 'Prepare the report using the available company context.',
  priorities: ['accuracy', 'timeliness'],
  risks: ['stale data'],
  rationale: 'The outcome is useful but should remain subject to existing governance.',
  clarificationRequired: false,
  approvalRecommended: true,
  plan: plan(),
  ...overrides,
});

function deterministicReasoningProvider(modelOutput: CEOReasoningModelOutput): ModelProvider {
  const deterministic = new DeterministicTestModel();
  return {
    providerId: deterministic.providerId,
    modelId: deterministic.modelId,
    generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>): ModelResponse<TOutput> {
      const envelope = deterministic.generate<TInput, unknown>(request);
      return { ...envelope, output: modelOutput as TOutput };
    },
  };
}

const request = (): CEOReasoningRequest => ({
  requestId: 'ceo-request-1',
  intent: intent(),
  context: {
    businessContext: 'Internal reporting',
    projectContext: 'Weekly operations',
    relevantFacts: ['The report is due today'],
  },
  timestamp: '2026-09-10T12:01:00.000Z',
  correlationId: 'trace-ceo-1',
});

test('CEO reasoning request construction preserves authoritative OwnerIntent identity', () => {
  const req = request();
  assert.equal(req.intent.organizationId, 'org-a');
  assert.equal(req.intent.ownerUserId, 'owner-1');
  assert.equal(req.context?.projectContext, 'Weekly operations');
});

test('CEO reasoning response construction produces a proposal-only decision', () => {
  const decision = new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(output()));
  assert.equal(decision.organizationId, 'org-a');
  assert.equal(decision.sourceIntentId, 'intent-ceo-1');
  assert.equal(decision.authority, 'PROPOSAL_ONLY');
  assert.equal(decision.plan.authority, 'PROPOSAL_ONLY');
});

test('deterministic reasoning is repeatable for the same request and output', () => {
  const engine = new CEOReasoningEngine();
  const first = engine.reason(request(), deterministicReasoningProvider(output()));
  const second = engine.reason(request(), deterministicReasoningProvider(output()));
  assert.deepEqual(first, second);
});

test('valid reasoning proposal reaches the existing governed PlanProposal boundary', () => {
  const decision = new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(output()));
  assert.equal(decision.plan.tasks[0]?.requiredCapabilities[0], 'reporting');
  assert.equal(decision.plan.tasks[0]?.proposedWorkerRole, 'analyst');
  assert.equal(decision.plan.approvalRequired, true);
});

test('malformed reasoning output fails closed', () => {
  const malformed = { ...output(), priorities: ['valid', 123] as never };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malformed)), /priorities/);
});

test('model output cannot change organization identity', () => {
  const malicious = { ...output(), organizationId: 'org-attacker' };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /forbidden authority field: organizationId/);
});

test('reasoning cannot grant permissions or capabilities', () => {
  const malicious = { ...output(), grantedPermissions: ['admin:*'], grantedCapabilities: ['unrestricted-execution'] };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /forbidden authority field/);
});

test('reasoning cannot approve itself', () => {
  const malicious = { ...output(), approvalGranted: true };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /approvalGranted/);
});

test('reasoning cannot select or authorize an execution worker', () => {
  const malicious = { ...output(), workerId: 'worker-1' };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /workerId/);
});

test('reasoning cannot execute or dispatch a job', () => {
  const malicious = { ...output(), execute: true, dispatch: true };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /execute/);
  const engine = new CEOReasoningEngine();
  assert.equal('execute' in engine, false);
  assert.equal('dispatch' in engine, false);
});

test('reasoning cannot access credentials', () => {
  const malicious = { ...output(), credentialId: 'credential-1' };
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(malicious)), /credentialId/);
  const engine = new CEOReasoningEngine();
  assert.equal('credential' in engine, false);
});

test('reasoning cannot create an external side effect', () => {
  let calls = 0;
  const provider = deterministicReasoningProvider(output());
  const wrapped: ModelProvider = {
    ...provider,
    generate(requestArg) {
      calls += 1;
      assert.equal(requestArg.purpose, 'ceo-reasoning-decision-proposal');
      return provider.generate(requestArg);
    },
  };
  new CEOReasoningEngine().reason(request(), wrapped);
  assert.equal(calls, 1);
});

test('proposal validation remains authoritative for invalid task graphs', () => {
  const invalid = output({
    plan: { ...plan(), tasks: [{ ...plan().tasks[0], dependencies: ['missing-task'] }] },
  });
  assert.throws(() => new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(invalid)), /depends on missing task/i);
});

test('reasoning failure cannot become a decision proposal', () => {
  const deterministic = new DeterministicTestModel({ failure: { code: 'PROVIDER_FAILURE', message: 'test failure' } });
  const provider: ModelProvider = deterministic;
  assert.throws(() => new CEOReasoningEngine().reason(request(), provider), /failed model response/);
});

test('decision output has no worker, credential, job, dispatch, or approval authority fields', () => {
  const decision = new CEOReasoningEngine().reason(request(), deterministicReasoningProvider(output()));
  assert.equal('workerId' in decision, false);
  assert.equal('credentialId' in decision, false);
  assert.equal('jobId' in decision, false);
  assert.equal('dispatch' in decision, false);
  assert.equal('approvalId' in decision, false);
  assert.equal(decision.authority, 'PROPOSAL_ONLY');
});
