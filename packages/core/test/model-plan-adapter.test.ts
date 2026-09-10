import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOwnerIntent,
  modelResponseToPlanProposal,
  type ModelPlanOutput,
  type ModelResponse,
  type OwnerIntent,
} from '../src/index.js';

const intent = (): OwnerIntent => createOwnerIntent({
  intentId: 'intent-model-1',
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  requestedOutcome: 'Prepare the weekly company report',
  constraints: [],
  priority: 'HIGH',
  riskRequirements: ['owner review'],
  createdAt: '2026-09-10T12:00:00.000Z',
  correlationId: 'trace-intent-model-1',
});

const output = (overrides: Partial<ModelPlanOutput> = {}): ModelPlanOutput => ({
  objective: 'Prepare the weekly company report',
  tasks: [{
    taskId: 'model-task-1',
    title: 'Prepare report',
    description: 'Draft the weekly company report',
    order: 1,
    dependencies: [],
    requiredCapabilities: ['reporting'],
    requiredPermissions: ['task:read'],
    risk: 'HIGH',
    approvalRequired: true,
    proposedWorkerRole: 'analyst',
  }],
  requiredCapabilities: ['reporting'],
  requiredPermissions: ['task:read'],
  risk: 'HIGH',
  approvalRequired: true,
  rationale: 'Model proposed a report plan for owner review.',
  ...overrides,
});

const response = (modelOutput: ModelPlanOutput): ModelResponse<ModelPlanOutput> => ({
  responseId: 'response-model-1',
  requestId: 'model-request-1',
  providerId: 'deterministic-test-provider',
  modelId: 'deterministic-test-model-v1',
  output: modelOutput,
  status: 'SUCCESS',
  timestamp: '2026-09-10T12:01:00.000Z',
  correlationId: 'trace-model-1',
  provenance: {
    providerId: 'deterministic-test-provider',
    modelId: 'deterministic-test-model-v1',
    requestId: 'model-request-1',
    correlationId: 'trace-model-1',
    deterministic: true,
    testProvenance: 'deterministic-test-model-v1',
  },
});

test('successful model output integrates only through PlanProposal', () => {
  const proposal = modelResponseToPlanProposal(intent(), response(output()));
  assert.equal(proposal.organizationId, 'org-a');
  assert.equal(proposal.sourceIntentId, 'intent-model-1');
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
  assert.equal(proposal.tasks[0]?.requiredCapabilities[0], 'reporting');
  assert.equal(proposal.tasks[0]?.proposedWorkerRole, 'analyst');
  assert.equal(proposal.approvalRequired, true);
});

test('model output cannot change authoritative organization identity', () => {
  const malicious = { ...output(), organizationId: 'org-attacker', ownerUserId: 'attacker' } as ModelPlanOutput & Record<string, unknown>;
  const proposal = modelResponseToPlanProposal(intent(), response(malicious));
  assert.equal(proposal.organizationId, 'org-a');
  assert.equal(proposal.tasks[0]?.targetOrganizationId, 'org-a');
});

test('model output cannot grant permissions or capabilities', () => {
  const proposal = modelResponseToPlanProposal(intent(), response(output({
    requiredCapabilities: ['tool:execute'],
    requiredPermissions: ['workflow:run'],
  })));
  assert.deepEqual(proposal.requiredCapabilities, ['tool:execute']);
  assert.deepEqual(proposal.requiredPermissions, ['workflow:run']);
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
  assert.deepEqual(proposal.tasks[0]?.requiredCapabilities, ['reporting']);
  assert.deepEqual(proposal.tasks[0]?.requiredPermissions, ['task:read']);
});

test('approval-required model output is not an approval grant', () => {
  const proposal = modelResponseToPlanProposal(intent(), response(output({ approvalRequired: true })));
  assert.equal(proposal.approvalRequired, true);
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
  assert.equal('approvalId' in proposal, false);
  assert.equal('consumedAt' in proposal, false);
});

test('model cannot execute anything through the proposal adapter', () => {
  const proposal = modelResponseToPlanProposal(intent(), response(output()));
  assert.equal(typeof proposal, 'object');
  assert.equal('execute' in proposal, false);
  assert.equal('dispatch' in proposal, false);
  assert.equal('workerId' in proposal, false);
  assert.equal('credential' in proposal, false);
  assert.equal('credentialId' in proposal, false);
  assert.equal('jobId' in proposal, false);
});

test('malformed model output fails closed before proposal creation', () => {
  const malformed = { ...output(), tasks: [{ ...output().tasks[0], requiredPermissions: ['not-a-permission'] as never }] };
  assert.throws(() => modelResponseToPlanProposal(intent(), response(malformed)), /unsupported permission/);
});

test('model failure cannot become a plan proposal', () => {
  const failed: ModelResponse<ModelPlanOutput> = {
    ...response(output()),
    status: 'FAILURE',
    output: undefined,
    failure: { code: 'PROVIDER_FAILURE', message: 'test failure' },
  };
  assert.throws(() => modelResponseToPlanProposal(intent(), failed), /failed model response/);
});

test('provenance mismatch fails closed', () => {
  const mismatched = response(output());
  mismatched.provenance = { ...mismatched.provenance, requestId: 'different-request' };
  assert.throws(() => modelResponseToPlanProposal(intent(), mismatched), /provenance/);
});
