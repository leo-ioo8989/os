import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditEventInput } from './audit.js';

export type DbExecutor = PrismaClient | Prisma.TransactionClient;

export class ControlPlaneRepository {
  constructor(private readonly db: PrismaClient) {}

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn, { isolationLevel: 'Serializable' });
  }

  async listObjectives(organizationId: string) {
    return this.db.objective.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }
  async getObjective(organizationId: string, id: string) {
    return this.db.objective.findFirst({ where: { id, organizationId }, include: { tasks: true } });
  }
  async createObjective(data: Prisma.ObjectiveCreateInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const item = await tx.objective.create({ data });
      await tx.auditEvent.create({ data: auditForResource(audit, item.id) });
      return item;
    });
  }
  async updateObjective(organizationId: string, id: string, data: Prisma.ObjectiveUpdateManyMutationInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.objective.updateMany({ where: { id, organizationId }, data });
      if (result.count !== 1) return null;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return tx.objective.findFirst({ where: { id, organizationId }, include: { tasks: true } });
    });
  }
  async changeObjectiveStatus(organizationId: string, id: string, status: Prisma.ObjectiveUpdateInput['status'], timestamps: Prisma.ObjectiveUpdateInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.objective.updateMany({ where: { id, organizationId }, data: { status: status as never, startedAt: timestamps.startedAt as never, completedAt: timestamps.completedAt as never } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return true;
    });
  }
  async deleteObjective(organizationId: string, id: string, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.objective.deleteMany({ where: { id, organizationId } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return true;
    });
  }

  async objectiveExists(organizationId: string, objectiveId: string) {
    return this.db.objective.findFirst({ where: { id: objectiveId, organizationId }, select: { id: true } });
  }
  async listTasks(organizationId: string, objectiveId: string) {
    return this.db.task.findMany({ where: { objectiveId, objective: { organizationId } }, include: { dependencies: true }, orderBy: { createdAt: 'asc' } });
  }
  async getTask(organizationId: string, id: string) {
    return this.db.task.findFirst({ where: { id, objective: { organizationId } }, include: { dependencies: true, objective: { select: { id: true } } } });
  }
  async createTask(organizationId: string, objectiveId: string, data: Prisma.TaskCreateWithoutObjectiveInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const parent = await tx.objective.findFirst({ where: { id: objectiveId, organizationId }, select: { id: true } });
      if (!parent) return null;
      const item = await tx.task.create({ data: { ...data, objective: { connect: { id: objectiveId } } } });
      await tx.auditEvent.create({ data: auditForResource(audit, item.id) });
      return item;
    });
  }
  async updateTask(organizationId: string, id: string, data: Prisma.TaskUpdateManyMutationInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.task.updateMany({ where: { id, objective: { organizationId } }, data });
      if (result.count !== 1) return null;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return tx.task.findFirst({ where: { id, objective: { organizationId } }, include: { dependencies: true, objective: { select: { id: true } } } });
    });
  }
  async changeTaskStatus(organizationId: string, id: string, status: Prisma.TaskUpdateInput['status'], timestamps: Prisma.TaskUpdateInput, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.task.updateMany({ where: { id, objective: { organizationId } }, data: { status: status as never, startedAt: timestamps.startedAt as never, completedAt: timestamps.completedAt as never } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return true;
    });
  }
  async deleteTask(organizationId: string, id: string, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const result = await tx.task.deleteMany({ where: { id, objective: { organizationId } } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: auditForResource(audit, id) });
      return true;
    });
  }

  async addDependencyAtomic(organizationId: string, taskId: string, dependencyId: string, validate: (tasks: DependencyTask[]) => void, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const tasks = await tx.task.findMany({ where: { id: { in: [taskId, dependencyId] }, objective: { organizationId } }, select: dependencySelect });
      if (tasks.length !== 2 || !tasks.every((t) => t.objectiveId === tasks[0]?.objectiveId)) return { kind: 'missing' as const };
      const existing = await tx.taskDependency.findUnique({ where: { taskId_dependencyId: { taskId, dependencyId } } });
      if (existing) return { kind: 'duplicate' as const };
      validate(tasks);
      const relation = await tx.taskDependency.create({ data: { taskId, dependencyId } });
      await tx.auditEvent.create({ data: auditForResource(audit, taskId) });
      return { kind: 'created' as const, relation };
    });
  }
  async removeDependency(organizationId: string, taskId: string, dependencyId: string, audit: AuditEventInput) {
    return this.transaction(async (tx) => {
      const relation = await tx.taskDependency.findFirst({ where: { taskId, dependencyId, task: { objective: { organizationId } } } });
      if (!relation) return false;
      await tx.taskDependency.delete({ where: { taskId_dependencyId: { taskId, dependencyId } } });
      await tx.auditEvent.create({ data: auditForResource(audit, taskId) });
      return true;
    });
  }
}

export type DependencyTask = Prisma.TaskGetPayload<{ select: typeof dependencySelect }>;
const dependencySelect = {
  id: true, objectiveId: true, title: true, description: true, status: true, assignedAgentId: true,
  riskLevel: true, estimatedCost: true, actualCost: true, retryCount: true, retryLimit: true, metadata: true,
  dependencies: { select: { dependencyId: true } },
} satisfies Prisma.TaskSelect;

function auditForResource(input: AuditEventInput, resourceId: string): Prisma.AuditEventCreateInput {
  return { organization: { connect: { id: input.organizationId } }, actor: input.actorId ? { connect: { id: input.actorId } } : undefined, actorType: input.actorType, eventType: input.eventType, resourceType: input.resourceType, resourceId, action: input.action, result: input.result, metadata: input.metadata ?? {} };
}
