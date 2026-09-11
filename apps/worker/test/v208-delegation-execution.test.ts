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
    roleId: 'engineer',
    organizationId,
    name: 'Engineer',
    category: 'engineering',
    description: 'bounded engineer',
    responsibilities: ['implement'],
    status: 'ACTIVE',
    employmentType: 'PERMANENT',
    capabilityRequirements: ['SOFTWARE_ENGINEERING'],
    contextScope: scope,
    qaResponsibility: { required: true, independent: true, qualityCriteria: ['output is valid'] },
    escalationPolicy: { reasons: ['QUALITY_FAILURE'], target: 'LEO' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function capability(): CapabilityDefinition {
  return {
    capabilityId: 'SOFTWARE_ENGINEERING',
    description: 'software engineering',
    contract: {
      capabilityId: 'SOFTWARE_ENGINEERING',
      requiredInputs: ['task'],
      expectedOutputs: ['result'],
      qualityCriteria: ['output is valid'],
      risk: 'LOW',
      requiredContextScopes: ['PROJECT'],
      qa: { required: true, independent: true, qualityCriteria: ['output is valid'] },
      escalation: { reasons: ['QUALITY_FAILURE'], target: 'LEO' },
      modelRequirements: ['coding'],
      compatibleProviderCharacteristics: ['deterministic'],
    },
  };
}

function provider(): ProviderDefinition {
  return {
    providerId: 'provider-test',
    providerName: 'Deterministic Provider',
    providerType: 'TEST',
    availability: 'AVAILABLE',
    costClass: 'FREE',
    supportedCapabilities: ['SOFTWARE_ENGINEERING'],
    routingEligible: true,
    provenance: 'test',
  };
}

function model(): WorkforceModelDefinition {
  return {
    modelId: 'model-test',
    providerId: 'provider-test',
    modelName: 'Deterministic Model',
    capabilities: ['SOFTWARE_ENGINEERING'],
    contextLimit: 10000,
    qualityTier: 'STANDARD',
    expectedLatencyMs: 10,
    costClass: 'FREE',
    availability: 'AVAILABLE',
    routingEligible: true,
    provenance: 'test',
  };
}

function makeTask(organizationId: string, taskId: string): WorkforceTaskRequirement {
  return {
    taskId,
    organizationId,
    requiredCapabilities: ['SOFTWARE_ENGINEERING'],
    risk: 'LOW',
    requiredContext: scope,
    freeFirst: true,
  };
}

function makeProposal(organizationId: string, task: WorkforceTaskRequirement) {
  const registry = new WorkforceRegistry();
  registry.registerCapability(capability());
  registry.registerRole(role(organizationId));
  registry.registerProvider(provider());
  registry.registerModel(model());
  const policy = {
    organizationId,
    freeFirst: true,
    requireFreeOption: true,
    requireProjectContext: true,
    maxLatencyMs: 1000,
  };
  const selection = buildWorkforceSelectionProposal(
    organizationId,
    'corr-1',
    [task],
    [role(organizationId)],
    registry,
    policy,
  );
  return buildDelegationProposal(
    organizationId,
    organizationId,
    'corr-1',
    selection,
    task,
    role(organizationId),
    capability().contract,
  );
}

async function cleanup(organizationId: string) {
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

test.after(async () => {
  await db.$disconnect();
});

const gateway = (request: Parameters<typeof authorizeExecution>[1]) => authorizeExecution(db, request);

// The task is governed by SOFTWARE_ENGINEERING, while the concrete Phase 1
// handler requires its own internal.calculate execution capability. The
// fixture must represent both facts so the real Execution Gateway can perform
// its authoritative capability check without being weakened.
const executionCapabilities = ['SOFTWARE_ENGINEERING', 'internal.calculate'];

test('Slice 8 delegation reaches the durable Phase 1 path through the production control-plane bridge', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is required');
    return;
  }

  const organization = await db.organization.create({ data: { name: marker } });
  try {
    const persisted = await new WorkerRepository(db).create({
      organizationId: organization.id,
      name: 'delegation-worker',
      type: 'test',
      capabilities: executionCapabilities,
      credential: 'v208-delegation-worker-credential-123456',
    }, audit('worker_created', organization.id));
    const objective = await db.objective.create({
      data: {
        organizationId: organization.id,
        title: 'Slice 8 delegation',
        description: 'durable delegation verification',
        createdBy: organization.id,
        priority: 'HIGH',
        status: 'READY',
        riskLevel: 'GREEN',
        successCriteria: {},
        metadata: {},
      },
    });
    const task = await db.task.create({
      data: {
        objectiveId: objective.id,
        title: 'delegated calculation',
        description: 'delegated calculation',
        status: 'PENDING',
        metadata: {
          handlerId: 'internal.calculate',
          capability: 'internal.calculate',
          action: 'calculate',
          target: 'internal',
          risk: 'LOW',
          parameters: { a: 2, b: 3, operation: 'add' },
        },
      },
    });
    const workflow = await db.workflow.create({
      data: {
        organizationId: organization.id,
        objectiveId: objective.id,
        currentState: 'RUNNING',
        status: 'RUNNING',
        resumableState: {},
        metadata: {},
        currentTaskId: task.id,
      },
    });
    const proposal = makeProposal(organization.id, makeTask(organization.id, task.id));
    const binding: ControlPlaneWorkerBinding = {
      workerId: persisted.worker.id,
      organizationId: organization.id,
      taskId: task.id,
      delegationId: proposal.proposalId,
      roleId: 'engineer',
      capabilities: executionCapabilities,
      context: scope,
      providerId: 'provider-test',
      modelId: 'model-test',
      risk: 'LOW',
      workflowId: workflow.id,
    };
    const result = await executeDelegationFromControlPlane(
      db,
      proposal,
      binding,
      'v208-delegation-worker-credential-123456',
      { authorizeExecution: gateway },
    );
    assert.equal(result.job.kind, 'created');
    assert.equal(result.run?.kind, 'succeeded');
    assert.equal((await db.job.findUnique({ where: { id: result.job.jobId } }))?.status, 'SUCCEEDED');
    assert.equal((await db.task.findUnique({ where: { id: task.id } }))?.status, 'COMPLETED');
    assert.equal((await db.workflow.findUnique({ where: { id: workflow.id } }))?.status, 'COMPLETED');
  } finally {
    await cleanup(organization.id);
  }
});

test('duplicate Slice 8 delegation reuses durable Job idempotency', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is required');
    return;
  }

  const organization = await db.organization.create({ data: { name: `${marker}-duplicate` } });
  try {
    const persisted = await new WorkerRepository(db).create({
      organizationId: organization.id,
      name: 'delegation-worker',
      type: 'test',
      capabilities: executionCapabilities,
      credential: 'v208-duplicate-worker-credential-123456',
    }, audit('worker_created', organization.id));
    const objective = await db.objective.create({
      data: {
        organizationId: organization.id,
        title: 'Slice 8 duplicate',
        description: 'durable idempotency verification',
        createdBy: organization.id,
        priority: 'HIGH',
        status: 'READY',
        riskLevel: 'GREEN',
        successCriteria: {},
        metadata: {},
      },
    });
    const task = await db.task.create({
      data: {
        objectiveId: objective.id,
        title: 'delegated calculation',
        description: 'delegated calculation',
        status: 'PENDING',
        metadata: {
          handlerId: 'internal.calculate',
          capability: 'internal.calculate',
          action: 'calculate',
          target: 'internal',
          risk: 'LOW',
          parameters: { a: 4, b: 5, operation: 'add' },
        },
      },
    });
    const proposal = makeProposal(organization.id, makeTask(organization.id, task.id));
    const binding: ControlPlaneWorkerBinding = {
      workerId: persisted.worker.id,
      organizationId: organization.id,
      taskId: task.id,
      delegationId: proposal.proposalId,
      roleId: 'engineer',
      capabilities: executionCapabilities,
      context: scope,
      providerId: 'provider-test',
      modelId: 'model-test',
      risk: 'LOW',
    };
    const { DelegationJobAdapter } = await import('../src/delegation-job-adapter.js');
    const adapter = new DelegationJobAdapter(db, { authorizeExecution: gateway });
    const first = await adapter.enqueue(proposal, binding);
    const second = await adapter.enqueue(proposal, binding);
    assert.equal(first.jobId, second.jobId);
    assert.equal(await db.job.count({ where: { organizationId: organization.id } }), 1);
  } finally {
    await cleanup(organization.id);
  }
});
