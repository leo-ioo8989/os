import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVAL_TRANSITIONS } from '../src/approval-repository.js';
import { WORKFLOW_TRANSITIONS } from '../src/workflow-repository.js';
import { AUDIT_EVENTS, sanitizeAuditMetadata } from '../src/audit.js';

test('approval lifecycle only permits decisions from pending', () => {
  assert.deepEqual(APPROVAL_TRANSITIONS.PENDING, ['APPROVED','REJECTED','EXPIRED','CANCELLED']);
  assert.deepEqual(APPROVAL_TRANSITIONS.APPROVED, []);
  assert.deepEqual(APPROVAL_TRANSITIONS.REJECTED, []);
});

test('workflow lifecycle has no terminal-state escape', () => {
  assert.ok(WORKFLOW_TRANSITIONS.PENDING.includes('RUNNING'));
  assert.deepEqual(WORKFLOW_TRANSITIONS.COMPLETED, []);
  assert.deepEqual(WORKFLOW_TRANSITIONS.CANCELLED, []);
});

test('audit metadata redacts credential-like fields recursively', () => {
  const value = sanitizeAuditMetadata({ token: 'secret', nested: { apiKey: 'secret', safe: 'ok' }, items: [{ password: 'x' }] }) as Record<string, unknown>;
  assert.equal(value.token, '[REDACTED]');
  assert.deepEqual(value.nested, { apiKey: '[REDACTED]', safe: 'ok' });
  assert.deepEqual(value.items, [{ password: '[REDACTED]' }]);
});

test('audit vocabulary is stable and extensible', () => {
  assert.equal(AUDIT_EVENTS.OBJECTIVE_CREATED, 'objective.created');
  assert.equal(AUDIT_EVENTS.APPROVAL_APPROVED, 'approval.approved');
});
