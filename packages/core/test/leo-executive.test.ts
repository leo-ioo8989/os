import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CEOOperatingLoop,
  DeterministicTestModel,
  ModelRegistry,
  ModelRuntime,
  createLEOExecutiveIdentity,
  createOwnerIntent,
  type CEOReasoningModelOutput,
  type ModelDefinition,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
} from '../src/index.js';

const timestamp = '2026-09-10T18:00:00.000Z';

function intent(overrides: Partial<Parameters<typeof createOwnerIntent>[0]> = {}) {
  return createOwnerIntent({
    intentId: 'intent-s6-1',
    organizationId: 'org-s6',
    ownerUserId: 'owner-s6',
    requestedOutcome: 'Prepare the weekly company operating report',
    constraints: ['Use current company context'],
    priority: 'HIGH',
    riskRequirements: ['owner review'],
    createdAt: timestamp,
    correlationId: 'corr-s6-1',
    ...overrides,
  });
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    objective: 'Prepare the weekly company operating report',
    tasks: [{
      taskId: 's6-task-1',
      title: 'Prepare operating report',
      description: 'Prepare the report from governed context',
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
    rationale: 'Governed executive proposal for owner review.',
    ...overrides,
  };
}

function output(overrides: Partial<CEOReasoningModelOutput> = {}): CEOReasoningModelOutput {
  return {
    strategy: 'Use governed company context and prepare the report for owner review.',
    priorities: ['accuracy', 'timeliness'],
    risks: ['stale data'],
    rationale: 'The outcome can be proposed without creating execution authority.',
    clarificationRequired: false,
    approvalRecommended: true,
    plan: plan(),
    ...overrides,
  };
}

function provider(modelOutput: CEOReasoningModelOutput, options: { failure?: ModelResponse['failure'] } = {}): ModelProvider {
  const deterministic = new DeterministicTestModel(options);
  return {
    providerId: deterministic.providerId,
    modelId: deterministic.modelId,
    generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>): ModelResponse<TOutput> {
      const response = deterministic.generate<TInput, unknown>(request);
      return { ...response, output: options.failure ? undefined : modelOutput as TOutput };
    },
  };
}

function runtimeFor(modelOutput: CEOReasoningModelOutput, options: { failure?: ModelResponse['failure'] } = {}) {
  const model = provider(modelOutput, options);
  const definition: ModelDefinition = {
    providerId: model.providerId,
    modelId: model.modelId,
    capabilities: ['reasoning', 'structured_output'],
    qualityTier: 'STANDARD',
    cost: { costPerInputUnit: 0, costPerOutputUnit: 0, currency: 'TEST' },
    latency: { expectedLatencyMs: 1 },
    availability: 'AVAILABLE',
    context: { maxInputUnits: 10000 },
    version: '1',
    provenance: 'slice-6-test',
  };
  return new ModelRuntime(new ModelRegistry([definition], [model]));
}

function policy() {
  return {
    policyVersion: 's6-test-v1',
    allowFallback: true,
    requireOrganizationMatch: true,
  } as const;
}

function makeLoop(modelOutput = output()) {
  const leo = createLEOExecutiveIdentity({ organizationId: 'org-s6', ownerUserId: 'owner-s6', createdAt: timestamp });
  return { leo, loop: new CEOOperatingLoop(leo, runtimeFor(modelOutput), policy()) };
}

test('LEO identity is stable and independent of model identity', () => {
  const first = createLEOExecutiveIdentity({ organizationId: 'org-s6', ownerUserId: 'owner-s6', createdAt: timestamp });
  const second = createLEOExecutiveIdentity({ organizationId: 'org-s6', ownerUserId: 'owner-s6', createdAt: timestamp });
  assert.equal(first.leoId, 'org-s6:leo');
  assert.deepEqual(first, second);
  assert.equal(first.role, 'CEO');
  assert.equal(first.authority, 'GOVERNED_BY_LEO_OS');
  assert.equal('modelId' in first, false);
  assert.equal('workerId' in first, false);
  assert.equal('credentialId' in first, false);
});

test('OwnerIntent identity is preserved and cannot cross the LEO organization', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent(), currentState: ['Report is due today'] });
  assert.equal(result.status, 'PROPOSAL_READY');
  assert.equal(result.intent.organizationId, 'org-s6');
  assert.equal(result.intent.ownerUserId, 'owner-s6');
  assert.equal(result.decision.organizationId, 'org-s6');
  assert.throws(() => loop.run({ intent: intent({ organizationId: 'org-other' }) }), /organization/);
});

test('governed context integrates memory facts without authority fields', () => {
  const { loop } = makeLoop();
  const result = loop.run({
    intent: intent(),
    memoryContext: { organizationId: 'org-s6', memoryIds: ['mem-1'], facts: ['Launch is planned for Q4.'] },
    currentState: ['One report is pending'],
  });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.deepEqual(result.context.relevantFacts, ['Launch is planned for Q4.']);
  assert.deepEqual(result.context.memoryIds, ['mem-1']);
  assert.deepEqual(result.context.currentState, ['One report is pending']);
  assert.equal('grantedPermissions' in result.context, false);
  assert.equal('grantedCapabilities' in result.context, false);
});

test('memory context organization mismatch fails closed', () => {
  const { loop } = makeLoop();
  assert.throws(() => loop.run({ intent: intent(), memoryContext: { organizationId: 'org-other', memoryIds: [], facts: [] } }), /organization/);
});

test('CEO reasoning runs through the Slice 5 model runtime and produces a proposal-only decision', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.equal(result.decision.authority, 'PROPOSAL_ONLY');
  assert.equal(result.plan.authority, 'PROPOSAL_ONLY');
  assert.equal(result.validation, 'VALIDATED');
  assert.equal(result.analysis.recommendedStrategy, 'Use governed company context and prepare the report for owner review.');
  assert.match(result.decision.provenance.modelProviderId, /deterministic-test-provider/);
});

test('plan reaches existing PlanProposal and TaskGraph validation boundaries', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.equal(result.plan.tasks[0]?.order, 1);
  assert.equal(result.plan.tasks[0]?.targetOrganizationId, 'org-s6');
  assert.equal(result.plan.tasks[0]?.approvalRequired, true);
});

test('clarification-required path does not create a decision or plan', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent({ requestedOutcome: 'Do it' }) });
  assert.equal(result.status, 'CLARIFICATION_REQUIRED');
  if (result.status !== 'CLARIFICATION_REQUIRED') return;
  assert.equal(result.decision, undefined);
  assert.equal(result.plan, undefined);
  assert.ok(result.clarification.length > 0);
});

test('CEO reasoning clarification is surfaced without execution', () => {
  const { loop } = makeLoop(output({ clarificationRequired: true }));
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'CLARIFICATION_REQUIRED');
  assert.equal('decision' in result, false);
});

test('risk floor cannot be downgraded and approval requirement cannot be removed', () => {
  const lowRisk = output({ plan: plan({ risk: 'LOW', approvalRequired: true }) });
  assert.throws(() => makeLoop(lowRisk).loop.run({ intent: intent() }), /downgrade risk/i);
  const noApproval = output({ plan: plan({ approvalRequired: false }) });
  assert.throws(() => makeLoop(noApproval).loop.run({ intent: intent() }), /approval requirement/i);
});

test('approval recommendation is not approval grant', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.equal(result.approvalRecommendation, 'RECOMMENDED');
  assert.equal(result.plan.approvalRequired, true);
  assert.equal('approvalGranted' in result.decision, false);
  assert.equal('approvalId' in result.decision, false);
});

test('strategy adaptation is represented as a proposal only', () => {
  const { loop } = makeLoop(output({ strategy: 'Change strategy because the dependency is unavailable.' }));
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.match(result.analysis.recommendedStrategy, /Change strategy/);
  assert.equal(result.decision.authority, 'PROPOSAL_ONLY');
});

test('delegation recommendation is data only and never creates a worker', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.match(result.decision.delegationRecommendations[0] ?? '', /Expertise may be required/);
  assert.equal('workerId' in result.decision, false);
  assert.equal('workerRegistry' in result.decision, false);
});

test('authority-bearing model output is rejected, including nested fields', () => {
  const malicious = output({ plan: { ...plan(), tasks: [{ ...plan().tasks[0], execute: true }] } as never });
  assert.throws(() => makeLoop(malicious).loop.run({ intent: intent() }), /authority-bearing model field.*execute/);
});

test('model failure propagates and cannot become a CEO proposal', () => {
  const { leo } = makeLoop();
  const runtime = runtimeFor(output(), { failure: { code: 'PROVIDER_FAILURE', message: 'test failure' } });
  const operatingLoop = new CEOOperatingLoop(leo, runtime, policy());
  assert.throws(() => operatingLoop.run({ intent: intent() }), /model runtime failed/);
});

test('model provenance remains attached to the decision proposal', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.equal(result.decision.provenance.intentId, 'intent-s6-1');
  assert.equal(result.decision.provenance.correlationId, 'corr-s6-1');
  assert.equal(result.decision.provenance.requestId, 'intent-s6-1:ceo-loop:1');
});

test('LEO has no execution, dispatch, credential, spending, permission, or capability APIs', () => {
  const { leo, loop } = makeLoop();
  assert.equal('execute' in leo, false);
  assert.equal('dispatch' in leo, false);
  assert.equal('credential' in leo, false);
  assert.equal('spend' in leo, false);
  assert.equal('grantPermission' in loop, false);
  assert.equal('grantCapability' in loop, false);
  assert.equal('dispatchJob' in loop, false);
  assert.equal('executeTask' in loop, false);
});

test('LEO remains the same identity when the model engine changes', () => {
  const leo = createLEOExecutiveIdentity({ organizationId: 'org-s6', ownerUserId: 'owner-s6', createdAt: timestamp });
  const first = new CEOOperatingLoop(leo, runtimeFor(output()), policy());
  const second = new CEOOperatingLoop(leo, runtimeFor(output({ strategy: 'A different model can recommend another strategy.' })), policy());
  const firstResult = first.run({ intent: intent() });
  const secondResult = second.run({ intent: intent({ intentId: 'intent-s6-2', correlationId: 'corr-s6-2' }) });
  assert.equal(firstResult.leo.leoId, secondResult.leo.leoId);
  assert.equal(firstResult.leo.role, 'CEO');
  assert.equal(firstResult.leo.organizationId, 'org-s6');
});

test('CEO output has no execution side effects', () => {
  const { loop } = makeLoop();
  const result = loop.run({ intent: intent() });
  assert.equal(result.status, 'PROPOSAL_READY');
  if (result.status !== 'PROPOSAL_READY') return;
  assert.equal('jobId' in result.decision, false);
  assert.equal('dispatch' in result.decision, false);
  assert.equal('externalAction' in result.decision, false);
  assert.equal('credentialId' in result.decision, false);
});
