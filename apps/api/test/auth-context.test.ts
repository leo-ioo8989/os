import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMembership } from '../src/auth-context.js';
import { hasPermission } from '@founder-os/core';

test('organization selector cannot choose an organization without membership', () => {
  const memberships = [{ organizationId: 'org-a', role: 'FOUNDER' as const }];
  assert.equal(selectMembership(memberships, 'org-b'), undefined);
});
test('single membership is selected without trusting a client organization id', () => {
  const memberships = [{ organizationId: 'org-a', role: 'OPERATOR' as const }];
  assert.deepEqual(selectMembership(memberships), memberships[0]);
});
test('multiple memberships require an explicit member organization', () => {
  const memberships = [{ organizationId: 'org-a', role: 'FOUNDER' as const }, { organizationId: 'org-b', role: 'VIEWER' as const }];
  assert.equal(selectMembership(memberships), undefined);
  assert.deepEqual(selectMembership(memberships, 'org-b'), memberships[1]);
});
test('RBAC matrix is enforced by the shared core primitive', () => {
  assert.equal(hasPermission('FOUNDER', 'founder:control'), true);
  assert.equal(hasPermission('ADMIN', 'founder:control'), false);
  assert.equal(hasPermission('OPERATOR', 'objective:write'), true);
  assert.equal(hasPermission('VIEWER', 'objective:write'), false);
});
