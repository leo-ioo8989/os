import assert from 'node:assert/strict';
import test from 'node:test';
import { getExecutiveContinuation, listExecutiveContinuations, recordExecutiveContinuation } from '../src/executive-decision-repository.js';

const decision = {
  continuationId: 'continuation:evaluation-1:deterministic-v1',
  organizationId: 'org-1', ownerUserId: 'owner-1', objectiveId: 'objective-1', jobId: 'job-1',
  disposition: 'REWORK' as const,
  rationale: 'Outcome was not achieved.', risks: ['criterion-1'], authority: 'PROPOSAL_ONLY' as const,
  provenance: { continuationVersion: 'deterministic-v1' as const, sourceEvaluationId: 'evaluation-1', sourceJobId: 'job-1' },
};

function fakeDb(events: Array<{ metadata: unknown; createdAt: Date; organizationId: string; eventType: string; resourceType: string; resourceId: string }>) {
  return {
    auditEvent: {
      create: async ({ data }: any) => {
        const event = { metadata: data.metadata, createdAt: new Date(), organizationId: data.organization.connect.id, eventType: data.eventType, resourceType: data.resourceType, resourceId: data.resourceId };
        events.push(event);
        return event;
      },
      findFirst: async ({ where }: any) => events.find((event) => event.organizationId === where.organizationId && event.eventType === where.eventType && event.resourceType === where.resourceType && event.resourceId === where.resourceId) ?? null,
      findMany: async ({ where }: any) => events.filter((event) => event.organizationId === where.organizationId && event.eventType === where.eventType && event.resourceType === where.resourceType),
    },
  } as any;
}

test('records and reconstructs a proposal-only executive continuation durably', async () => {
  const events: any[] = [];
  const db = fakeDb(events);
  const recorded = await recordExecutiveContinuation(db, decision);
  assert.equal(recorded.continuationId, decision.continuationId);
  assert.equal(recorded.authority, 'PROPOSAL_ONLY');
  assert.equal(events.length, 1);
  const loaded = await getExecutiveContinuation(db, 'org-1', decision.continuationId);
  assert.deepEqual(loaded, recorded);
});

test('reuses an existing decision instead of appending duplicate history', async () => {
  const events: any[] = [];
  const db = fakeDb(events);
  const first = await recordExecutiveContinuation(db, decision);
  const second = await recordExecutiveContinuation(db, decision);
  assert.deepEqual(second, first);
  assert.equal(events.length, 1);
});

test('organization isolation prevents cross-organization lookup', async () => {
  const events: any[] = [];
  const db = fakeDb(events);
  await recordExecutiveContinuation(db, decision);
  assert.equal(await getExecutiveContinuation(db, 'org-2', decision.continuationId), null);
  assert.deepEqual(await listExecutiveContinuations(db, 'org-2'), []);
});

test('rejects any non proposal-only decision', async () => {
  const events: any[] = [];
  const db = fakeDb(events);
  await assert.rejects(() => recordExecutiveContinuation(db, { ...decision, authority: 'EXECUTE' as any }), /proposal-only/);
  assert.equal(events.length, 0);
});
