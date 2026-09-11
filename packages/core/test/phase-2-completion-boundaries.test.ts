import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExternalActionProposal } from '../src/external-action-governance.js';
import { validateProactiveWorkProposal } from '../src/proactive-intelligence.js';
import { validateSpendProposal } from '../src/financial-governance.js';
import { getPhase2CompletionContract } from '../src/phase-2-completion-contract.js';

test('Phase 2 external action boundary remains proposal-only', () => {
  const p = { proposalId:'ext-1', organizationId:'org-1', ownerUserId:'owner-1', action:'PUBLISH_CONTENT' as const, target:'company-site', purpose:'publish approved content', risk:'HIGH' as const, approvalRequired:true, authority:'PROPOSAL_ONLY' as const, provenance:'deterministic-v1' };
  validateExternalActionProposal(p);
  assert.throws(() => validateExternalActionProposal({ ...p, authority:'APPROVED' as never }));
  assert.throws(() => validateExternalActionProposal({ ...p, approvalRequired:false }));
});

test('Phase 2 proactive intelligence observes and recommends without executing', () => {
  const p = { proposalId:'pro-1', organizationId:'org-1', trigger:'DEADLINE_APPROACHING' as const, observation:'deadline is near', recommendedOutcome:'prepare a proposal', priority:'HIGH' as const, approvalRequired:true, authority:'PROPOSAL_ONLY' as const, provenance:'deterministic-v1' };
  validateProactiveWorkProposal(p);
  assert.throws(() => validateProactiveWorkProposal({ ...p, authority:'APPROVED' as never }));
});

test('Phase 2 financial governance never converts spend into approval', () => {
  const p = { proposalId:'spend-1', organizationId:'org-1', ownerUserId:'owner-1', amount:100, currency:'INR', category:'software', purpose:'buy a required service', risk:'HIGH' as const, approvalRequired:true, authority:'PROPOSAL_ONLY' as const, provenance:'deterministic-v1' };
  validateSpendProposal(p);
  assert.throws(() => validateSpendProposal({ ...p, amount:-1 }));
  assert.throws(() => validateSpendProposal({ ...p, approvalRequired:false }));
});

test('Phase 2 completion contract closes the governed operating loop without a second control plane', () => {
  const c = getPhase2CompletionContract();
  assert.equal(c.authority, 'PROPOSAL_ONLY');
  assert.equal(c.noSecondExecutor, true);
  assert.equal(c.noSecondControlPlane, true);
  assert.equal(c.durableHistoryUsesExistingAudit, true);
  assert.equal(c.modelOutputUntrusted, true);
  assert.equal(c.approvalRequiredIsNotApprovalGranted, true);
  assert.ok(c.chain.includes('EXTERNAL_ACTION_PROPOSAL'));
  assert.ok(c.chain.includes('PROACTIVE_WORK_PROPOSAL'));
  assert.ok(c.chain.includes('SPEND_PROPOSAL'));
});
