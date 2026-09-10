import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicPlanGenerator, TaskGraphError, validatePlanProposal, type OwnerIntent, type PlanProposal } from '../src/index.js';

const baseIntent: OwnerIntent = {
  intentId: 'intent-1',
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  requestedOutcome: 'Complete a controlled internal task',
  constraints: [],
  priority: 'MEDIUM',
  riskRequirements: [],
  createdAt: '2026-09-10T12:00:00.000Z',
  correlationId: 'trace-1',
};
const base = (): PlanProposal => new DeterministicPlanGenerator().propose(baseIntent);

function withTasks(proposal: PlanProposal, tasks: PlanProposal['tasks']): PlanProposal {
  return { ...proposal, tasks };
}
function task(proposal: PlanProposal, id: string, dependencies: string[] = []): NonNullable<PlanProposal['tasks'][number]> {
  return { ...proposal.tasks[0]!, taskId: id, dependencies, targetOrganizationId: proposal.organizationId, order: 1 };
}

test('valid proposal graph is accepted through the existing task graph validator', () => assert.doesNotThrow(() => validatePlanProposal(base())));
test('duplicate task IDs are rejected by the authoritative graph validator', () => {
  const proposal = base();
  assert.throws(() => validatePlanProposal(withTasks(proposal, [task(proposal, 'same'), task(proposal, 'same') as never])), TaskGraphError);
});
test('missing dependencies are rejected', () => {
  const proposal = base();
  assert.throws(() => validatePlanProposal(withTasks(proposal, [task(proposal, 'a', ['missing'])])), TaskGraphError);
});
test('self dependencies are rejected', () => {
  const proposal = base();
  assert.throws(() => validatePlanProposal(withTasks(proposal, [task(proposal, 'a', ['a'])])), TaskGraphError);
});
test('cycles are rejected', () => {
  const proposal = base();
  assert.throws(() => validatePlanProposal(withTasks(proposal, [
    { ...task(proposal, 'a', ['b']), order: 1 },
    { ...task(proposal, 'b', ['a']), order: 2 },
  ])), TaskGraphError);
});
test('cross-organization targeting is rejected before graph acceptance', () => {
  const proposal = base();
  assert.throws(() => validatePlanProposal(withTasks(proposal, [{ ...task(proposal, 'a'), targetOrganizationId: 'org-b' }])), TaskGraphError);
});
test('required capabilities, permissions and risk remain proposal metadata', () => {
  const proposal = base();
  const enriched = withTasks({ ...proposal, requiredCapabilities: ['report:read'] }, [{
    ...task(proposal, 'a'),
    requiredCapabilities: ['report:read'],
    requiredPermissions: ['task:read'],
    risk: 'HIGH',
    approvalRequired: true,
  }]);
  assert.doesNotThrow(() => validatePlanProposal(enriched));
  assert.deepEqual(enriched.tasks[0]?.requiredCapabilities, ['report:read']);
  assert.equal(enriched.tasks[0]?.risk, 'HIGH');
  assert.equal(enriched.tasks[0]?.approvalRequired, true);
  assert.equal(enriched.authority, 'PROPOSAL_ONLY');
});
test('proposal validation has no execution dependencies or side effects', () => {
  const proposal = base();
  assert.doesNotThrow(() => validatePlanProposal(proposal));
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
});
