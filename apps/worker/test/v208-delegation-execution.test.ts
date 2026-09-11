import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, WorkerRepository } from '@founder-os/db';
import {
  buildDelegationProposal,
  buildWorkforceSelectionProposal,
  WorkforceRegistry,
  type CapabilityDefinition,
  type ProviderDefinition,
  type WorkforceModelDefinition,
  type WorkforceRole,
  type WorkforceTaskRequirement,
  type ControlPlaneWorkerBinding,
} from '@founder-os/core';
import { executeDelegationFromControlPlane } from '../src/delegation-entrypoint.js';
import { authorizeExecution } from '../../api/src/execution-gateway.js';

const db = new PrismaClient();
const marker = `v208-delegation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const scope = { organization: true as const, projectId: 'project-a' };

const audit = (action: string, organizationId: string) => ({
  organizationId,
  actorType: 'SYSTEM' as const,
  eventType: 'worker.created' as const,
  action,
  result: 'SUCCESS' as const,
});

function role(organizationId: string): WorkforceRole {
  return {
    roleId: 'engineer', organizationId, name: 'Engineer', category: 'engineering', description: 'bounded engineer',
    responsibilities: ['implement'], status: 'ACTIVE', employmentType: 'PERMANENT',
    capabilityRequirements: ['SOFTWARE_ENGINEERING'], contextScope: scope,
    qaResponsibility: { required: true, independent: true, qualityCriteria: ['output is valid'] },
    escalationPolicy: { reasons: ['QUALITY_FAILURE'], target: 'LEO' },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function capability(): CapabilityDefinition {
  return { capabilityId: 'SOFTWARE_ENGINEERING', description: 'software engineering', contract: {
    capabilityId: 'SOFTWARE_ENGINEERING', requiredInputs: ['task'], expectedOutputs: ['result'], qualityCriteria: ['output is valid'],
    risk: 'LOW', requiredContextScopes: ['PROJECT'], qa: { required: true, independent: true, qualityCriteria: ['output is valid'] },
    escalation: { reasons: ['QUALITY_FAILURE'], target: 'LEO' }, modelRequirements: ['coding'], compatibleProviderCharacteristics: ['deterministic'],
  }};
}

function provider(): ProviderDefinition {
  return { providerId: 'provider-test', providerName: 'Deterministic Provider', providerType: 'TEST', availability: 'AVAILABLE', costClass: 'FREE',
    supportedCapabilities: ['SOFTWARE_ENGINEERING'], routingEligible: true, provenance: 'test' };
}

function model(): WorkforceModelDefinition {
  return { modelId: 'model-test', providerId: 'provider-test', modelName: 'Deterministic Model', capabilities: ['SOFTWARE_ENGINEERING'], contextLimit: 10000,
    qualityTier: 'STANDARD', expectedLatencyMs: 10, costClass: 'FREE', availability: 'AVAILABLE', routingEligible: true, provenance: 'test' };
}

function makeTask(organizationId: string, taskId: string): WorkforceTaskRequirement {
  return { taskId, organizationId, requiredCapabilities: ['SOFTWARE_ENGINEERING'], risk: 'LOW', requiredContext: scope, freeFirst: true };
}

function makeProposal(organizationId: string, task: WorkforceTaskRequirement) {
  const registry = new WorkforceRegistry();
  registry.registerCapability(capability()); registry.registerRole(role(organizationId)); registry.registerProvider(provider()); registry.registerModel(model());
  const selection = buildWorkforceSelectionProposal(organizationId, 'corr-1', [task], [role(organizationId)], registry, {
    organizationId, freeFirst: true, requireFreeOption: true, requireProjectContext: true, maxLatencyMs: 1000,
  });
  return buildDelegationProposal(organizationId, organizationId, 'corr-1', selection, task, role(organizationId), capability().contract);
}

async function cleanup(organizationId: string) {
  await db.auditEvent.deleteMany({ where: { organizationId } }); await db.approval.deleteMany({ where: { organizationId } });
  await db.checkpoint.deleteMany({ where: { organizationId } }); await db.job.deleteMany({ where: { organizationId } });
  await db.workflow.deleteMany({ where: { organizationId } }); await db.taskDependency.deleteMany({ where: { task: { objective: { organizationId } } } });
  await db.task.deleteMany({ where: { objective: { organizationId } } }); await db.objective.deleteMany({ where: { organizationId } });
  await db.workerCredential.deleteMany({ where: { worker: { organizationId } } }); await db.worker.deleteMany({ where: { organizationId } });
  await db.organization.delete({ where: { id: organizationId } });
}

test.after(async () => { await db.$disconnect(); });

// WorkerRuntime speaks the core ExecutionRisk vocabulary (LOW/MEDIUM/HIGH/CRITICAL),
// while the existing Phase 1 HTTP gateway accepts its persisted RiskLevel vocabulary.
// Keep the conversion at this existing adapter/test boundary; never weaken gateway policy.
const gateway = (request: Parameters<typeof authorizeExecution>[1]) => authorizeExecution(db, request);
const executionGateway = (request: Parameters<typeof gateway>[0]) => gateway({
  ...request,
  risk: request.risk === 'LOW' ? 'GREEN' : request.risk === 'MEDIUM' ? 'YELLOW' : request.risk === 'HIGH' ? 'HIGH' : 'CRITICAL',
});
const executionCapabilities = ['SOFTWARE_ENGINEERING', 'internal.execute'];

async function createFixture() {
  const organization = await db.organization.create({ data: { name: marker } });
  const credential = 'v208-delegation-worker-credential-123456';
  const worker = await new WorkerRepository(db).create({ organizationId: organization.id, name: 'delegation-worker', type: 'test', capabilities: executionCapabilities, credential }, audit('worker_created', organization.id));
  const objective = await db.objective.create({ data: { organizationId: organization.id, title: 'Slice 8 delegation', description: 'durable delegation verification', createdBy: organization.id, priority: 'HIGH', status: 'READY', riskLevel: 'GREEN', successCriteria: {}, metadata: {} } });
  const task = await db.task.create({ data: { objectiveId: objective.id, title: 'delegated noop', description: 'delegated deterministic noop', status: 'PENDING', metadata: { handlerId: 'internal.noop', capability: 'internal.execute', action: 'execute', target: 'internal', risk: 'LOW', parameters: {} } } });
  const workflow = await db.workflow.create({ data: { organizationId: organization.id, objectiveId: objective.id, currentState: 'RUNNING', status: 'RUNNING', resumableState: {}, metadata: {}, currentTaskId: task.id } });
  const proposal = makeProposal(organization.id, makeTask(organization.id, task.id));
  const binding: ControlPlaneWorkerBinding = { workerId: worker.worker.id, organizationId: organization.id, taskId: task.id, delegationId: proposal.proposalId, roleId: 'engineer', capabilities: executionCapabilities, context: scope, providerId: 'provider-test', modelId: 'model-test', risk: 'LOW', workflowId: workflow.id };
  return { organization, credential, worker, objective, task, workflow, proposal, binding };
}

test('Slice 8 delegation reaches the durable Phase 1 path through the production control-plane bridge', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  const fixture = await createFixture();
  try {
    const result = await executeDelegationFromControlPlane(db, fixture.proposal, fixture.binding, fixture.credential, { authorizeExecution: executionGateway });
    assert.equal(result.job.kind, 'created'); assert.equal(result.run?.kind, 'succeeded');
    assert.equal((await db.job.findUnique({ where: { id: result.job.jobId } }))?.status, 'SUCCEEDED');
    assert.equal((await db.task.findUnique({ where: { id: fixture.task.id } }))?.status, 'COMPLETED');
    assert.equal((await db.workflow.findUnique({ where: { id: fixture.workflow.id } }))?.status, 'COMPLETED');
  } finally { await cleanup(fixture.organization.id); }
});

test('duplicate Slice 8 delegation reuses durable Job idempotency', async (t) => {
  if (!process.env.DATABASE_URL) { t.skip('DATABASE_URL is required'); return; }
  const fixture = await createFixture();
  try {
    const { DelegationJobAdapter } = await import('../src/delegation-job-adapter.js');
    const adapter = new DelegationJobAdapter(db, { authorizeExecution: executionGateway });
    const first = await adapter.enqueue(fixture.proposal, fixture.binding); const second = await adapter.enqueue(fixture.proposal, fixture.binding);
    assert.equal(first.jobId, second.jobId); assert.equal(await db.job.count({ where: { organizationId: fixture.organization.id } }), 1);
  } finally { await cleanup(fixture.organization.id); }
});
