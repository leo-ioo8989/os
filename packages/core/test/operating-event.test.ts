import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGovernedOperatingEvent, validateGovernedOperatingEvent } from '../src/operating-event.js';

test('builds deterministic proposal-only operating event', () => {
  const event = buildGovernedOperatingEvent({
    eventType: 'EXECUTION_COMPLETED',
    organizationId: 'org-1',
    ownerUserId: 'owner-1',
    taskId: 'task-1',
    jobId: 'job-1',
    sourceResourceType: 'JOB',
    sourceResourceId: 'job-1',
    sourceVersion: 'completed:v1',
    occurredAt: '2026-09-12T00:00:00.000Z',
  });
  assert.equal(event.authority, 'PROPOSAL_ONLY');
  assert.equal(event.eventId, 'EXECUTION_COMPLETED:JOB:job-1:completed:v1');
  assert.equal(validateGovernedOperatingEvent(event), true);
});

test('rejects cross-organization or malformed authority-bearing event data', () => {
  const base = {
    eventId: 'e1', eventType: 'EXECUTION_COMPLETED', organizationId: 'org-1', ownerUserId: 'owner-1',
    sourceResourceType: 'JOB', sourceResourceId: 'job-1', sourceVersion: 'v1', occurredAt: '2026-09-12T00:00:00.000Z',
    provenance: { version: 'deterministic-v1', sourceResourceType: 'JOB', sourceResourceId: 'job-1' }, authority: 'PROPOSAL_ONLY',
  } as const;
  assert.equal(validateGovernedOperatingEvent(base), true);
  assert.equal(validateGovernedOperatingEvent({ ...base, authority: 'APPROVED' }), false);
  assert.equal(validateGovernedOperatingEvent({ ...base, execute: true }), false);
  assert.equal(validateGovernedOperatingEvent({ ...base, grantedCapabilities: ['x'] }), false);
});
