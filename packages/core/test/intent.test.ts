import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerIntent } from '../src/index.js';

test('owner intent requires identity, outcome and correlation fields', () => {
  assert.throws(() => createOwnerIntent({
    intentId: '', organizationId: 'org-a', ownerUserId: 'owner-1', requestedOutcome: 'x',
    constraints: [], priority: 'LOW', riskRequirements: [], createdAt: 'now', correlationId: 'trace',
  }), /required/);
});

test('owner intent rejects negative or non-finite budgets', () => {
  const base = { intentId: 'i', organizationId: 'org-a', ownerUserId: 'u', requestedOutcome: 'x', constraints: [], priority: 'LOW' as const, riskRequirements: [], createdAt: 'now', correlationId: 't' };
  assert.throws(() => createOwnerIntent({ ...base, requestedBudget: -1 }), /budget/);
  assert.throws(() => createOwnerIntent({ ...base, requestedBudget: Number.NaN }), /budget/);
});
