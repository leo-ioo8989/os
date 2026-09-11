import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkforceLifecycleProposal, validateWorkforceLifecycleProposal } from '../src/workforce-lifecycle.js';

test('builds proposal-only activation decision', () => {
  const proposal = buildWorkforceLifecycleProposal({
    proposalId: 'wf-proposal-1',
    organizationId: 'org-1',
    target: { organizationId: 'org-1', employeeId: 'employee-1' },
    action: 'ACTIVATE',
    reason: 'Bounded project work requires the role.',
    risk: 'MEDIUM',
    currentStatus: 'INACTIVE',
    proposedStatus: 'ACTIVE',
    approvalRequired: false,
    correlationId: 'corr-1',
  });
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
  assert.equal(proposal.provenance.lifecycleVersion, 'deterministic-v1');
});

test('rejects cross-organization lifecycle targets', () => {
  assert.throws(() => buildWorkforceLifecycleProposal({
    proposalId: 'wf-proposal-2', organizationId: 'org-1',
    target: { organizationId: 'org-2', roleId: 'role-1' }, action: 'SUSPEND',
    reason: 'policy review', risk: 'HIGH', approvalRequired: true,
  }));
});

test('rejects authority-bearing lifecycle payloads', () => {
  const proposal = {
    proposalId: 'wf-proposal-3', organizationId: 'org-1',
    target: { organizationId: 'org-1', employeeId: 'employee-1' }, action: 'DEACTIVATE',
    reason: 'project ended', risk: 'MEDIUM', approvalRequired: false,
    authority: 'PROPOSAL_ONLY', provenance: { lifecycleVersion: 'deterministic-v1' },
    workerId: 'worker-1',
  };
  assert.throws(() => validateWorkforceLifecycleProposal(proposal));
});

test('requires explicit proposal-only authority and valid action', () => {
  assert.throws(() => validateWorkforceLifecycleProposal({
    proposalId: 'x', organizationId: 'org-1', target: { organizationId: 'org-1', roleId: 'r' },
    action: 'EXECUTE', reason: 'x', risk: 'LOW', approvalRequired: false,
    authority: 'PROPOSAL_ONLY', provenance: { lifecycleVersion: 'deterministic-v1' },
  }));
  assert.throws(() => validateWorkforceLifecycleProposal({
    proposalId: 'x', organizationId: 'org-1', target: { organizationId: 'org-1', roleId: 'r' },
    action: 'ACTIVATE', reason: 'x', risk: 'LOW', approvalRequired: false,
    authority: 'AUTHORIZED', provenance: { lifecycleVersion: 'deterministic-v1' },
  }));
});
