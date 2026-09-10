import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerIntent, DeterministicPlanGenerator, type OwnerIntent } from '../src/index.js';

const intent = (overrides: Partial<OwnerIntent> = {}): OwnerIntent => createOwnerIntent({
  intentId: 'intent-1',
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  requestedOutcome: 'Prepare the weekly company report',
  constraints: ['No external communication'],
  priority: 'MEDIUM',
  riskRequirements: [],
  createdAt: '2026-09-10T12:00:00.000Z',
  correlationId: 'trace-1',
  ...overrides,
});

test('owner intent preserves identity and can be represented', () => {
  const value = intent({ businessContext: 'LEO OS', projectContext: 'weekly-report' });
  assert.equal(value.organizationId, 'org-a');
  assert.equal(value.ownerUserId, 'owner-1');
  assert.equal(value.requestedOutcome, 'Prepare the weekly company report');
});

test('deterministic planner produces a proposal without execution authority', () => {
  const proposal = new DeterministicPlanGenerator().propose(intent());
  assert.equal(proposal.sourceIntentId, 'intent-1');
  assert.equal(proposal.organizationId, 'org-a');
  assert.equal(proposal.tasks.length, 1);
  assert.equal(proposal.tasks[0]?.taskId, 'intent-1:task:1');
  assert.deepEqual(proposal.tasks[0]?.dependencies, []);
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
  assert.equal(proposal.approvalRequired, false);
  assert.equal(proposal.requiredCapabilities.length, 0);
});

test('proposal records approval as a requirement, not an approval', () => {
  const proposal = new DeterministicPlanGenerator().propose(intent({ priority: 'CRITICAL' }));
  assert.equal(proposal.approvalRequired, true);
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
});

test('planner is deterministic for the same intent values', () => {
  const planner = new DeterministicPlanGenerator();
  const first = planner.propose(intent());
  const second = planner.propose(intent());
  assert.deepEqual({ ...first, createdAt: 'fixed' }, { ...second, createdAt: 'fixed' });
});
