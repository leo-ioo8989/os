import type { PrismaClient, ObjectiveStatus, Priority, RiskLevel, TaskStatus } from '@prisma/client';
import { INITIAL_AGENTS, analyzeTaskGraph, type TaskGraph, type TaskNode } from '@founder-os/core';
import { ApiError } from './errors.js';

const OBJECTIVE_TRANSITIONS: Record<ObjectiveStatus, readonly ObjectiveStatus[]> = {
  DRAFT: ['PLANNING', 'CANCELLED'], PLANNING: ['READY', 'BLOCKED', 'CANCELLED'], READY: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['WAITING_APPROVAL', 'BLOCKED', 'PAUSED', 'COMPLETED', 'FAILED'], WAITING_APPROVAL: ['RUNNING', 'PAUSED', 'FAILED'],
  BLOCKED: ['PLANNING', 'PAUSED', 'CANCELLED'], PAUSED: ['PLANNING', 'READY', 'RUNNING', 'CANCELLED'],
  COMPLETED: [], FAILED: ['PLANNING', 'CANCELLED'], CANCELLED: [],
};
const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ['READY', 'BLOCKED', 'CANCELLED'], READY: ['RUNNING', 'PAUSED' as TaskStatus, 'CANCELLED'], RUNNING: ['WAITING_APPROVAL', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING_APPROVAL: ['RUNNING', 'FAILED', 'CANCELLED'], BLOCKED: ['PENDING', 'CANCELLED'], FAILED: ['PENDING', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) throw new ApiError(422, 'VALIDATION_ERROR', `${field} must be a non-empty string.`);
  return value.trim();
}
function optionalString(value: unknown, field: string, max = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) throw new ApiError(422, 'VALIDATION_ERROR', `${field} is invalid.`);
  return value;
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new ApiError(422, 'VALIDATION_ERROR', `${field} is invalid.`);
  return value as T;
}
function numberValue(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ApiError(422, 'VALIDATION_ERROR', `${field} must be a non-negative number.`);
  return value;
}

export async function listObjectives(db: PrismaClient, organizationId: string) {
  return db.objective.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}
export async function getObjective(db: PrismaClient, organizationId: string, id: string) {
  const item = await db.objective.findFirst({ where: { id, organizationId }, include: { tasks: true } });
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
  return item;
}
export async function createObjective(db: PrismaClient, organizationId: string, userId: string, body: Record<string, unknown>) {
  const title = nonEmptyString(body.title, 'title');
  const description = nonEmptyString(body.description, 'description');
  const successCriteria = body.successCriteria;
  if (!Array.isArray(successCriteria) || !successCriteria.every((x) => typeof x === 'string' && x.length <= 1000)) throw new ApiError(422, 'VALIDATION_ERROR', 'successCriteria must be an array of strings.');
  const budget = numberValue(body.budget, 'budget');
  const estimatedCost = numberValue(body.estimatedCost, 'estimatedCost');
  const priority = enumValue(body.priority ?? 'MEDIUM', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const, 'priority');
  const riskLevel = enumValue(body.riskLevel ?? 'GREEN', ['GREEN', 'YELLOW', 'RED'] as const, 'riskLevel');
  const deadline = body.deadline === undefined || body.deadline === null ? undefined : new Date(String(body.deadline));
  if (deadline && Number.isNaN(deadline.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'deadline is invalid.');
  return db.objective.create({ data: { organizationId, createdBy: userId, title, description, projectId: optionalString(body.projectId, 'projectId', 200), priority: priority as Priority, riskLevel: riskLevel as RiskLevel, budget, estimatedCost, successCriteria, deadline, metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {} } });
}
export async function updateObjective(db: PrismaClient, organizationId: string, id: string, body: Record<string, unknown>) {
  const current = await db.objective.findFirst({ where: { id, organizationId } });
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = nonEmptyString(body.title, 'title');
  if (body.description !== undefined) data.description = nonEmptyString(body.description, 'description');
  if (body.projectId !== undefined) data.projectId = optionalString(body.projectId, 'projectId', 200) ?? null;
  if (body.priority !== undefined) data.priority = enumValue(body.priority, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const, 'priority');
  if (body.riskLevel !== undefined) data.riskLevel = enumValue(body.riskLevel, ['GREEN', 'YELLOW', 'RED'] as const, 'riskLevel');
  if (body.budget !== undefined) data.budget = numberValue(body.budget, 'budget');
  if (body.estimatedCost !== undefined) data.estimatedCost = numberValue(body.estimatedCost, 'estimatedCost');
  if (body.successCriteria !== undefined) { if (!Array.isArray(body.successCriteria) || !body.successCriteria.every((x) => typeof x === 'string')) throw new ApiError(422, 'VALIDATION_ERROR', 'successCriteria is invalid.'); data.successCriteria = body.successCriteria; }
  const result = await db.objective.updateMany({ where: { id, organizationId }, data: data as never });
  if (result.count !== 1) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
  return getObjective(db, organizationId, id);
}
export async function changeObjectiveStatus(db: PrismaClient, organizationId: string, id: string, status: ObjectiveStatus) {
  const current = await db.objective.findFirst({ where: { id, organizationId }, select: { status: true } });
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
  if (!OBJECTIVE_TRANSITIONS[current.status].includes(status)) throw new ApiError(409, 'CONFLICT', `Cannot change objective status from ${current.status} to ${status}.`);
  return db.objective.updateMany({ where: { id, organizationId }, data: { status, startedAt: status === 'RUNNING' ? new Date() : undefined, completedAt: status === 'COMPLETED' ? new Date() : undefined } });
}
export async function deleteObjective(db: PrismaClient, organizationId: string, id: string) {
  const result = await db.objective.deleteMany({ where: { id, organizationId } });
  if (result.count !== 1) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
}

async function objectiveExists(db: PrismaClient, organizationId: string, objectiveId: string) {
  const item = await db.objective.findFirst({ where: { id: objectiveId, organizationId }, select: { id: true } });
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Objective not found.');
}
export async function listTasks(db: PrismaClient, organizationId: string, objectiveId: string) {
  await objectiveExists(db, organizationId, objectiveId);
  return db.task.findMany({ where: { objectiveId, objective: { organizationId } }, include: { dependencies: true }, orderBy: { createdAt: 'asc' } });
}
export async function getTask(db: PrismaClient, organizationId: string, id: string) {
  const item = await db.task.findFirst({ where: { id, objective: { organizationId } }, include: { dependencies: true, objective: { select: { id: true } } } });
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  return item;
}
export async function createTask(db: PrismaClient, organizationId: string, objectiveId: string, body: Record<string, unknown>) {
  await objectiveExists(db, organizationId, objectiveId);
  const title = nonEmptyString(body.title, 'title');
  const description = nonEmptyString(body.description, 'description');
  const assignedAgentId = body.assignedAgentId === undefined || body.assignedAgentId === null ? undefined : nonEmptyString(body.assignedAgentId, 'assignedAgentId');
  if (assignedAgentId && !INITIAL_AGENTS.some((a) => a.id === assignedAgentId)) throw new ApiError(422, 'VALIDATION_ERROR', 'assignedAgentId is not a registered agent.');
  return db.task.create({ data: { objectiveId, title, description, assignedAgentId, riskLevel: enumValue(body.riskLevel ?? 'GREEN', ['GREEN', 'YELLOW', 'RED'] as const, 'riskLevel') as RiskLevel, estimatedCost: numberValue(body.estimatedCost, 'estimatedCost'), metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {} } });
}
export async function updateTask(db: PrismaClient, organizationId: string, id: string, body: Record<string, unknown>) {
  await getTask(db, organizationId, id);
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = nonEmptyString(body.title, 'title');
  if (body.description !== undefined) data.description = nonEmptyString(body.description, 'description');
  if (body.assignedAgentId !== undefined) { const agent = body.assignedAgentId === null ? undefined : nonEmptyString(body.assignedAgentId, 'assignedAgentId'); if (agent && !INITIAL_AGENTS.some((a) => a.id === agent)) throw new ApiError(422, 'VALIDATION_ERROR', 'assignedAgentId is not a registered agent.'); data.assignedAgentId = agent ?? null; }
  if (body.riskLevel !== undefined) data.riskLevel = enumValue(body.riskLevel, ['GREEN', 'YELLOW', 'RED'] as const, 'riskLevel');
  if (body.estimatedCost !== undefined) data.estimatedCost = numberValue(body.estimatedCost, 'estimatedCost');
  const result = await db.task.updateMany({ where: { id, objective: { organizationId } }, data: data as never });
  if (result.count !== 1) throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  return getTask(db, organizationId, id);
}
export async function changeTaskStatus(db: PrismaClient, organizationId: string, id: string, status: TaskStatus) {
  const current = await db.task.findFirst({ where: { id, objective: { organizationId } }, select: { status: true } });
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  if (!TASK_TRANSITIONS[current.status].includes(status)) throw new ApiError(409, 'CONFLICT', `Cannot change task status from ${current.status} to ${status}.`);
  return db.task.updateMany({ where: { id, objective: { organizationId } }, data: { status, startedAt: status === 'RUNNING' ? new Date() : undefined, completedAt: status === 'COMPLETED' ? new Date() : undefined } });
}
export async function deleteTask(db: PrismaClient, organizationId: string, id: string) {
  const result = await db.task.deleteMany({ where: { id, objective: { organizationId } } });
  if (result.count !== 1) throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
}

async function validateGraph(db: PrismaClient, organizationId: string, objectiveId: string) {
  const tasks = await db.task.findMany({ where: { objectiveId, objective: { organizationId } }, select: { id: true, objectiveId: true, title: true, description: true, status: true, assignedAgentId: true, riskLevel: true, estimatedCost: true, actualCost: true, retryCount: true, retryLimit: true, metadata: true, dependencies: { select: { dependencyId: true } } } });
  const graph: TaskGraph = { tasks: tasks.map((t) => ({ ...t, dependencies: t.dependencies.map((d) => d.dependencyId), estimatedCost: t.estimatedCost ? Number(t.estimatedCost) : undefined, actualCost: Number(t.actualCost), riskLevel: t.riskLevel, metadata: (t.metadata ?? {}) as Record<string, unknown> })) as unknown as TaskNode[] };
  try { analyzeTaskGraph(graph); } catch (error) { throw new ApiError(409, 'CONFLICT', error instanceof Error ? error.message : 'Invalid task dependency graph.'); }
}
export async function addDependency(db: PrismaClient, organizationId: string, taskId: string, dependencyId: string) {
  const tasks = await db.task.findMany({ where: { id: { in: [taskId, dependencyId] }, objective: { organizationId } }, select: { id: true, objectiveId: true } });
  if (tasks.length !== 2 || !tasks.every((t) => t.objectiveId === tasks[0]?.objectiveId)) throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  if (taskId === dependencyId) throw new ApiError(422, 'VALIDATION_ERROR', 'A task cannot depend on itself.');
  const existing = await db.taskDependency.findUnique({ where: { taskId_dependencyId: { taskId, dependencyId } } });
  if (existing) throw new ApiError(409, 'CONFLICT', 'Dependency already exists.');
  const objectiveId = tasks[0]!.objectiveId;
  const current = await db.task.findMany({ where: { objectiveId }, select: { id: true, objectiveId: true, title: true, description: true, status: true, assignedAgentId: true, riskLevel: true, estimatedCost: true, actualCost: true, retryCount: true, retryLimit: true, metadata: true, dependencies: { select: { dependencyId: true } } } });
  const graph: TaskGraph = { tasks: current.map((t) => ({ ...t, dependencies: t.dependencies.map((d) => d.dependencyId), estimatedCost: t.estimatedCost ? Number(t.estimatedCost) : undefined, actualCost: Number(t.actualCost), metadata: (t.metadata ?? {}) as Record<string, unknown> })) as unknown as TaskNode[] };
  graph.tasks.find((t) => t.id === taskId)!.dependencies.push(dependencyId);
  try { analyzeTaskGraph(graph); } catch (error) { throw new ApiError(409, 'CONFLICT', error instanceof Error ? error.message : 'Invalid task dependency graph.'); }
  return db.taskDependency.create({ data: { taskId, dependencyId } });
}
export async function removeDependency(db: PrismaClient, organizationId: string, taskId: string, dependencyId: string) {
  const relation = await db.taskDependency.findFirst({ where: { taskId, dependencyId, task: { objective: { organizationId } } } });
  if (!relation) throw new ApiError(404, 'NOT_FOUND', 'Dependency not found.');
  await db.taskDependency.delete({ where: { taskId_dependencyId: { taskId, dependencyId } } });
}
