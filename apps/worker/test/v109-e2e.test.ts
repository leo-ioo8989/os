import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@founder-os/db';
import { WorkerRepository } from '@founder-os/db';
import { Orchestrator } from '../src/orchestrator.js';
import { authorizeExecution, consumeExecutionApproval } from '../../api/src/execution-gateway.js';

const db = new PrismaClient();
const marker = `v109-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const audit = (action:string) => ({ organizationId: '', actorType: 'SYSTEM' as const, eventType: 'workflow.updated', action, result: 'SUCCESS' as const });

async function cleanup(organizationId:string) {
  await db.auditEvent.deleteMany({ where: { organizationId } });
  await db.approval.deleteMany({ where: { organizationId } });
  await db.checkpoint.deleteMany({ where: { organizationId } });
  await db.job.deleteMany({ where: { organizationId } });
  await db.workflow.deleteMany({ where: { organizationId } });
  await db.taskDependency.deleteMany({ where: { task: { objective: { organizationId } } } });
  await db.task.deleteMany({ where: { objective: { organizationId } } });
  await db.objective.deleteMany({ where: { organizationId } });
  await db.workerCredential.deleteMany({ where: { worker: { organizationId } } });
  await db.worker.deleteMany({ where: { organizationId } });
  await db.organization.delete({ where: { id: organizationId } });
}

test.after(async () => db.$disconnect());

test('V1.09 complete real orchestrator-to-handler workflow execution path completes deterministically', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  const organization = await db.organization.create({ data: { name: marker } });
  try {
    const workerRepo = new WorkerRepository(db);
    const credential = 'v109-e2e-worker-credential-123456789';
    const worker = await workerRepo.create({ organizationId: organization.id, name: 'e2e-worker', type: 'test', capabilities: ['internal.execute', 'internal.calculate'], credential }, { ...audit('worker_created'), organizationId: organization.id });
    const objective = await db.objective.create({ data: { organizationId: organization.id, title: 'V1.09 E2E', description: 'verification', createdBy: organization.id, priority: 'HIGH', status: 'READY', riskLevel: 'GREEN', successCriteria: {}, metadata: {} } });
    const first = await db.task.create({ data: { objectiveId: objective.id, title: 'first', description: 'first', status: 'PENDING', metadata: { handlerId: 'internal.calculate', capability: 'internal.calculate', action: 'calculate', target: 'internal', risk: 'LOW', parameters: { a: 2, b: 3, operation: 'add' } } } });
    const second = await db.task.create({ data: { objectiveId: objective.id, title: 'second', description: 'second', status: 'PENDING', metadata: { handlerId: 'internal.noop', capability: 'internal.execute', action: 'noop', target: 'internal', risk: 'LOW', parameters: {} } } });
    await db.taskDependency.create({ data: { taskId: second.id, dependencyId: first.id } });
    const workflow = await db.workflow.create({ data: { organizationId: organization.id, objectiveId: objective.id, currentState: 'PENDING', status: 'PENDING', resumableState: {}, metadata: {} } });
    const orchestrator = new Orchestrator(db, {
      resolveCredential: async (organizationId, workerId) => workerId === worker.worker.id && organizationId === organization.id ? credential : null,
      authorizeExecution: (request) => authorizeExecution(db, { ...request, risk: request.risk === 'LOW' ? 'GREEN' : request.risk === 'MEDIUM' ? 'YELLOW' : request.risk === 'HIGH' ? 'HIGH' : 'CRITICAL' }),
      consumeExecutionApproval: (organizationId, workerId, approvalId, request) => consumeExecutionApproval(db, organizationId, workerId, approvalId, { ...request, risk: request.risk === 'LOW' ? 'GREEN' : request.risk === 'MEDIUM' ? 'YELLOW' : request.risk === 'HIGH' ? 'HIGH' : 'CRITICAL' }),
    });
    const firstCycle = await orchestrator.orchestrate(organization.id, workflow.id);
    assert.equal(firstCycle.jobsDispatched, 1);
    assert.equal((await db.task.findUnique({ where: { id: first.id } }))?.status, 'COMPLETED');
    assert.equal((await db.workflow.findUnique({ where: { id: workflow.id } }))?.status, 'RUNNING');
    const secondCycle = await orchestrator.orchestrate(organization.id, workflow.id);
    assert.equal(secondCycle.jobsDispatched, 1);
    assert.equal((await db.task.findUnique({ where: { id: second.id } }))?.status, 'COMPLETED');
    assert.equal((await db.workflow.findUnique({ where: { id: workflow.id } }))?.status, 'COMPLETED');
    const thirdCycle = await orchestrator.orchestrate(organization.id, workflow.id);
    assert.equal(thirdCycle.stoppedReason, 'TERMINAL');
    const jobs = await db.job.findMany({ where: { organizationId: organization.id, workflowId: workflow.id }, orderBy: { createdAt: 'asc' } });
    assert.equal(jobs.length, 2);
    assert.deepEqual(jobs.map(job => job.status), ['SUCCEEDED', 'SUCCEEDED']);
    assert.equal((await db.task.count({ where: { objectiveId: objective.id, status: 'COMPLETED' } })), 2);
  } finally {
    await cleanup(organization.id);
  }
});
