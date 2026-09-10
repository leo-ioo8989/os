import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAuditMetadata } from '../src/audit.js';
import { canTransitionJob } from '@founder-os/core';

test('job metadata redacts credentials recursively', () => {
  const value = sanitizeAuditMetadata({ token:'abc', nested:{apiKey:'xyz', safe:'ok'}, list:[{password:'pw'}] });
  assert.deepEqual(value, { token:'[REDACTED]', nested:{apiKey:'[REDACTED]', safe:'ok'}, list:[{password:'[REDACTED]'}] });
});

test('job lifecycle rejects terminal transitions', () => {
  assert.equal(canTransitionJob('SUCCEEDED','RUNNING'), false);
  assert.equal(canTransitionJob('CANCELLED','CLAIMED'), false);
});
