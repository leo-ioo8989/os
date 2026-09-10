import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ApprovalRepository, JobRepository, WorkerRepository, ensureWorkflowJob } from '../src/index.js';

const db = new PrismaClient();
const marker = `v109-repeat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const audit = (organizationId: string, eventType: 'job.created' | 'approval.created' | 'worker.created' = 'job.created') => ({ organizationId, actorType: 'SYSTEM' as const, eventType, action: 'repeat-race', result: 'SUCCESS' as const });

async function cleanup(organizationId: string) {
  await db.auditEvent.deleteMany({ where: { organizationId } });
  await db.approval.deleteMany({ where: { organizationId } });
  await db.job.deleteMany({ where: { organizationId } });
  await db.workflow.deleteMany({ where: { organizationId } });
  await db.task.deleteMany({ where: { objective: { organizationId } } });
  await db.objective.deleteMany({ where: { organizationId } });
  await db.workerCredential.deleteMany({ where: { worker: { organizationId } } });
  await db.worker.deleteMany({ where: { organizationId } });
  await db.organization.delete({ where: { id: organizationId } });
}

test.after(async () => db.$disconnect());

test('V1.09 repeated worker claim race has one winner across 10 iterations', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  for (let i = 0; i < 10; i += 1) {
    const org = await db.organization.create({ data: { name: `${marker}-claim-${i}` } });
    try {
      const wr = new WorkerRepository(db);
      const w1 = await wr.create({ organizationId: org.id, name: 'w1', type: 'test', capabilities: ['internal.execute'], credential: `claim-one-${marker}-${i}-123456789` }, audit(org.id, 'worker.created'));
      const w2 = await wr.create({ organizationId: org.id, name: 'w2', type: 'test', capabilities: ['internal.execute'], credential: `claim-two-${marker}-${i}-123456789` }, audit(org.id, 'worker.created'));
      const job = await db.job.create({ data: { organizationId: org.id, status: 'QUEUED', resumableState: {}, metadata: {} } });
      const repo = new JobRepository(db);
      const results = await Promise.all([
        repo.claim(org.id, job.id, w1.worker.id, 30000, audit(org.id)),
        repo.claim(org.id, job.id, w2.worker.id, 30000, audit(org.id)),
      ]);
      assert.equal(results.filter((result) => result.kind === 'claimed').length, 1);
    } finally {
      await cleanup(org.id);
    }
  }
});

test('V1.09 repeated workflow bootstrap race remains idempotent across 10 iterations', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  for (let i = 0; i < 10; i += 1) {
    const org = await db.organization.create({ data: { name: `${marker}-bootstrap-${i}` } });
    try {
      const objective = await db.objective.create({ data: { organizationId: org.id, title: marker, description: 'repeat', createdBy: 'test', priority: 'MEDIUM', status: 'READY', riskLevel: 'GREEN', successCriteria: {}, metadata: {} } });
      const task = await db.task.create({ data: { objectiveId: objective.id, title: 'task', description: '', status: 'PENDING', metadata: { handlerId: 'internal.noop', capability: 'internal.execute', risk: 'LOW', parameters: {} } } });
      const workflow = await db.workflow.create({ data: { organizationId: org.id, objectiveId: objective.id, currentState: 'PENDING', status: 'PENDING', metadata: {}, resumableState: {} } });
      const results = await Promise.all([
        ensureWorkflowJob(db, org.id, workflow.id, audit(org.id)),
        ensureWorkflowJob(db, org.id, workflow.id, audit(org.id)),
      ]);
      assert.equal((await db.job.count({ where: { organizationId: org.id, workflowId: workflow.id } })), 1);
      assert.equal(results.filter((result) => result.kind === 'created').length, 1);
      assert.ok(results.every((result) => result.kind === 'created' || result.kind === 'existing'));
      assert.equal((await db.job.findFirst({ where: { organizationId: org.id, workflowId: workflow.id } }))?.idempotencyKey, `workflow:${workflow.id}:task:${task.id}`);
    } finally {
      await cleanup(org.id);
    }
  }
});

test('V1.09 repeated approval decision race has one winner across 10 iterations', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  for (let i = 0; i < 10; i += 1) {
    const org = await db.organization.create({ data: { name: `${marker}-decision-${i}` } });
    try {
      const requester = await db.user.create({ data: { email: `${marker}-requester-${i}@example.test` } });
      const one = await db.user.create({ data: { email: `${marker}-one-${i}@example.test` } });
      const two = await db.user.create({ data: { email: `${marker}-two-${i}@example.test` } });
      const repo = new ApprovalRepository(db);
      const approval = await repo.create({ organizationId: org.id, requesterId: requester.id, action: 'repeat', actionFingerprint: `fp-${i}`, policyVersion: 'v1', riskLevel: 'HIGH', reason: 'repeat', evidence: {} }, audit(org.id, 'approval.created'));
      assert.ok(approval);
      const results = await Promise.all([
        repo.decide(org.id, approval!.id, 'APPROVED', one.id, audit(org.id, 'approval.created')),
        repo.decide(org.id, approval!.id, 'REJECTED', two.id, audit(org.id, 'approval.created')),
      ]);
      assert.equal(results.filter((result) => result.kind === 'updated').length, 1);
      assert.equal(results.filter((result) => result.kind === 'conflict').length, 1);
    } finally {
      await cleanup(org.id);
    }
  }
});

test('V1.09 repeated approval consumption race is single-use across 10 iterations', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  for (let i = 0; i < 10; i += 1) {
    const org = await db.organization.create({ data: { name: `${marker}-consume-${i}` } });
    try {
      const worker = await new WorkerRepository(db).create({ organizationId: org.id, name: 'worker', type: 'test', capabilities: ['internal.execute'], credential: `consume-${marker}-${i}-123456789` }, audit(org.id, 'worker.created'));
      const repo = new ApprovalRepository(db);
      const approval = await repo.create({ organizationId: org.id, requesterAgentId: worker.worker.id, action: 'consume', actionFingerprint: `consume-fp-${i}`, policyVersion: 'v1', riskLevel: 'HIGH', reason: 'repeat', evidence: {} }, audit(org.id, 'approval.created'));
      assert.ok(approval);
      await db.approval.update({ where: { id: approval!.id }, data: { status: 'APPROVED' } });
      const results = await Promise.all([
        repo.consume(org.id, approval!.id, `consume-fp-${i}`, worker.worker.id, audit(org.id, 'approval.created')),
        repo.consume(org.id, approval!.id, `consume-fp-${i}`, worker.worker.id, audit(org.id, 'approval.created')),
      ]);
      assert.equal(results.filter((result) => result.kind === 'consumed').length, 1);
      assert.equal(results.filter((result) => result.kind === 'conflict').length, 1);
    } finally {
      await cleanup(org.id);
    }
  }
});
