import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { advanceWorkflowAfterJobSuccess } from '../src/workflow-execution-repository.js';

const db = new PrismaClient();
const marker = `v107-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;

test.after(async () => {
  await db.$disconnect();
});

test('V1.07 PostgreSQL schema and organization-scoped idempotency', async () => {
  const orgA = await db.organization.create({ data: { name: `${marker}-a` } });
  const orgB = await db.organization.create({ data: { name: `${marker}-b` } });
  try {
    const first = await db.job.create({
      data: {
        organizationId: orgA.id,
        idempotencyKey: `${marker}-same-key`,
        status: 'QUEUED',
        resumableState: {},
        metadata: {},
      },
    });
    const repeated = await db.job.upsert({
      where: { organizationId_idempotencyKey: { organizationId: orgA.id, idempotencyKey: `${marker}-same-key` } },
      create: { organizationId: orgA.id, idempotencyKey: `${marker}-same-key`, status: 'QUEUED', resumableState: {}, metadata: {} },
      update: {},
    });
    const otherOrg = await db.job.create({
      data: { organizationId: orgB.id, idempotencyKey: `${marker}-same-key`, status: 'QUEUED', resumableState: {}, metadata: {} },
    });

    assert.equal(repeated.id, first.id);
    assert.notEqual(otherOrg.id, first.id);

    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Workflow' AND column_name = 'currentJobId'
    `;
    assert.equal(columns.length, 1);

    const jobColumns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Job' AND column_name = 'idempotencyKey'
    `;
    assert.equal(jobColumns.length, 1);

    const blockedEnum = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'WorkflowStatus' AND e.enumlabel = 'BLOCKED'
      ) AS exists
    `;
    assert.equal(blockedEnum[0]?.exists, true);
  } finally {
    await db.auditEvent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
});

test('workflow advancement creates a durable non-null idempotency key', async () => {
  const organization = await db.organization.create({ data: { name: marker } });
  let objectiveId: string | undefined;
  try {
    const objective = await db.objective.create({
      data: {
        organizationId: organization.id,
        title: marker,
        description: 'V1.07 runtime verification fixture',
        createdBy: 'v107-test',
        priority: 'MEDIUM',
        status: 'READY',
        riskLevel: 'GREEN',
        successCriteria: { ok: true },
        metadata: {},
      },
    });
    objectiveId = objective.id;
    const firstTask = await db.task.create({
      data: { objectiveId: objective.id, title: `${marker}-1`, description: '', status: 'RUNNING', metadata: {} },
    });
    const secondTask = await db.task.create({
      data: { objectiveId: objective.id, title: `${marker}-2`, description: '', status: 'PENDING', metadata: {} },
    });
    await db.taskDependency.create({ data: { taskId: secondTask.id, dependencyId: firstTask.id } });

    const workflow = await db.workflow.create({
      data: {
        organizationId: organization.id,
        objectiveId: objective.id,
        currentState: 'RUNNING',
        status: 'RUNNING',
        currentTaskId: firstTask.id,
        metadata: {},
        resumableState: {},
      },
    });
    const job = await db.job.create({
      data: {
        organizationId: organization.id,
        objectiveId: objective.id,
        taskId: firstTask.id,
        workflowId: workflow.id,
        idempotencyKey: `workflow:${workflow.id}:task:${firstTask.id}`,
        status: 'SUCCEEDED',
        attemptNumber: 1,
        resumableState: {},
        metadata: {},
      },
    });
    await db.workflow.update({ where: { id: workflow.id }, data: { currentJobId: job.id } });

    const result = await db.$transaction(async (tx) =>
      advanceWorkflowAfterJobSuccess(tx, organization.id, workflow.id, job.id, {
        organizationId: organization.id,
        actorType: 'SYSTEM',
        result: 'SUCCESS',
      }),
      { isolationLevel: 'Serializable' },
    );

    assert.equal(result.kind, 'advanced');
    if (result.kind !== 'advanced') return;
    const nextJob = await db.job.findUnique({ where: { id: result.jobId } });
    assert.equal(nextJob?.idempotencyKey, `workflow:${workflow.id}:task:${secondTask.id}`);
    assert.ok(nextJob?.idempotencyKey);
  } finally {
    await db.auditEvent.deleteMany({ where: { organizationId: organization.id } });
    if (objectiveId) await db.objective.delete({ where: { id: objectiveId } });
    await db.organization.delete({ where: { id: organization.id } });
  }
});
