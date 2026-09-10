import type { Prisma, PrismaClient } from '@prisma/client';
import { canTransitionWorkflow, selectNextTask } from '@founder-os/core';
import { AUDIT_EVENTS, sanitizeAuditMetadata, type AuditEventInput } from './audit.js';
type Tx = Prisma.TransactionClient;
type AuditBase = Omit<AuditEventInput, 'eventType' | 'resourceType' | 'resourceId'>;
const json = (v: unknown) => sanitizeAuditMetadata(v) as Prisma.InputJsonValue;
function writeAudit(tx: Tx, input: AuditBase, eventType: AuditEventInput['eventType'], resourceType: string, resourceId: string, action: string, metadata: Record<string, unknown> = {}) {
  return tx.auditEvent.create({ data: { organization: { connect: { id: input.organizationId } }, actor: input.actorId ? { connect: { id: input.actorId } } : undefined, actorType: input.actorType, eventType, resourceType, resourceId, action, result: input.result, metadata: json(metadata) } });
}
async function nextJob(tx: Tx, organizationId: string, workflowId: string, objectiveId: string | null, taskId: string) {
  const idempotencyKey = `workflow:${workflowId}:task:${taskId}`;
  return tx.job.upsert({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } }, create: { organization: { connect: { id: organizationId } }, objective: objectiveId ? { connect: { id: objectiveId } } : undefined, task: { connect: { id: taskId } }, workflow: { connect: { id: workflowId } }, idempotencyKey, status: 'QUEUED', maxAttempts: 3, resumableState: {}, metadata: {} }, update: {} });
}
async function taskGraph(tx: Tx, objectiveId: string) {
  return tx.task.findMany({ where: { objectiveId }, include: { dependencies: { select: { dependencyId: true } } } });
}
export async function advanceWorkflowAfterJobSuccess(tx: Tx, organizationId: string, workflowId: string, jobId: string, input: AuditBase) {
  const job = await tx.job.findFirst({ where: { id: jobId, organizationId, workflowId } });
  const workflow = await tx.workflow.findFirst({ where: { id: workflowId, organizationId } });
  if (!job || !workflow) return { kind: 'missing' as const };
  if (job.status !== 'SUCCEEDED') return { kind: 'job_not_succeeded' as const, status: job.status };
  if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') return { kind: 'terminal_workflow' as const, status: workflow.status };
  if (!job.taskId) return { kind: 'ambiguous' as const, reason: 'Succeeded job has no task.' };
  if (workflow.currentJobId && workflow.currentJobId !== jobId) return { kind: 'ambiguous' as const, reason: 'Workflow points to a different current job.' };
  const task = await tx.task.findFirst({ where: { id: job.taskId, objective: { organizationId } } });
  if (!task) return { kind: 'ambiguous' as const, reason: 'Job task is missing.' };
  if (workflow.currentTaskId && workflow.currentTaskId !== task.id) return { kind: 'ambiguous' as const, reason: 'Workflow points to a different current task.' };
  if (task.status !== 'COMPLETED') {
    await tx.task.update({ where: { id: task.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_TASK_COMPLETED, 'Task', task.id, 'completed', { workflowId, jobId });
  }
  const tasks = await taskGraph(tx, task.objectiveId);
  if (tasks.some(t => t.status === 'FAILED')) {
    if (!canTransitionWorkflow(workflow.status, 'FAILED')) return { kind: 'ambiguous' as const, reason: 'Workflow cannot transition to FAILED.' };
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'FAILED', currentState: 'FAILED', currentTaskId: task.id, currentJobId: null, failureCode: 'TASK_FAILED', failureMessage: 'A workflow task failed.', completedAt: new Date() } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_FAILED, 'Workflow', workflowId, 'failed', { taskId: task.id });
    return { kind: 'failed' as const };
  }
  if (tasks.some(t => t.status === 'BLOCKED' || t.status === 'CANCELLED')) {
    if (!canTransitionWorkflow(workflow.status, 'BLOCKED')) return { kind: 'ambiguous' as const, reason: 'Workflow cannot transition to BLOCKED.' };
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'BLOCKED', currentState: 'BLOCKED', currentJobId: null, failureCode: 'TASK_BLOCKED', failureMessage: 'A workflow task cannot proceed.' } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_BLOCKED, 'Workflow', workflowId, 'blocked');
    return { kind: 'blocked' as const };
  }
  if (tasks.every(t => t.status === 'COMPLETED')) {
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'COMPLETED', currentState: 'COMPLETED', currentTaskId: null, currentJobId: null, completedAt: new Date(), failureCode: null, failureMessage: null } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_COMPLETED, 'Workflow', workflowId, 'completed', { jobId });
    return { kind: 'completed' as const };
  }
  const candidates = tasks.map(t => ({ id: t.id, status: t.status, dependencies: t.dependencies.map(d => d.dependencyId) }));
  const waitingJobs = await tx.job.findMany({ where: { organizationId, workflowId, status: 'WAITING_APPROVAL' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 });
  const waiting = waitingJobs[0];
  if (waiting) {
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'WAITING_APPROVAL', currentState: 'WAITING_APPROVAL', currentTaskId: waiting.taskId, currentJobId: waiting.id } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_APPROVAL_BLOCKED, 'Workflow', workflowId, 'approval_blocked', { jobId: waiting.id, taskId: waiting.taskId });
    return { kind: 'waiting_approval' as const, jobId: waiting.id };
  }
  const runningJobs = await tx.job.findMany({ where: { organizationId, workflowId, status: { in: ['CLAIMED', 'RUNNING'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 });
  const running = runningJobs[0];
  if (running) {
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'RUNNING', currentState: 'RUNNING', currentTaskId: running.taskId, currentJobId: running.id } });
    return { kind: 'waiting_other_jobs' as const, jobId: running.id };
  }
  const selected = selectNextTask(candidates);
  if (!selected) {
    if (!canTransitionWorkflow(workflow.status, 'BLOCKED')) return { kind: 'ambiguous' as const, reason: 'No ready task and workflow cannot transition to BLOCKED.' };
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'BLOCKED', currentState: 'BLOCKED', currentJobId: null, failureCode: 'NO_READY_TASK', failureMessage: 'No dependency-ready task exists.' } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_BLOCKED, 'Workflow', workflowId, 'blocked', { reason: 'NO_READY_TASK' });
    return { kind: 'blocked' as const };
  }
  const active = await tx.job.count({ where: { organizationId, workflowId, id: { not: jobId }, status: { in: ['QUEUED', 'RETRY_QUEUED'] } } });
  if (active > 0) return { kind: 'waiting_other_jobs' as const };
  const queued = await nextJob(tx, organizationId, workflowId, task.objectiveId, selected.id);
  await tx.task.update({ where: { id: selected.id }, data: { status: 'READY' } });
  await tx.workflow.update({ where: { id: workflowId }, data: { status: 'RUNNING', currentState: 'RUNNING', currentTaskId: selected.id, currentJobId: queued.id, resumableState: json({ taskId: selected.id, jobId: queued.id }), failureCode: null, failureMessage: null, completedAt: null } });
  await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_TASK_SELECTED, 'Workflow', workflowId, 'task_selected', { taskId: selected.id, jobId: queued.id, selection: 'stable-task-id' });
  await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_RESUMED, 'Workflow', workflowId, 'resumed', { taskId: selected.id, jobId: queued.id });
  return { kind: 'advanced' as const, taskId: selected.id, jobId: queued.id };
}
export async function reconcileWorkflow(db: PrismaClient, organizationId: string, workflowId: string, input: AuditBase) {
  return db.$transaction(async tx => {
    const workflow = await tx.workflow.findFirst({ where: { id: workflowId, organizationId } });
    if (!workflow) return { kind: 'missing' as const };
    const jobs = await tx.job.findMany({ where: { organizationId, workflowId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') {
      const active = jobs.filter(j => ['QUEUED', 'CLAIMED', 'RUNNING', 'WAITING_APPROVAL', 'RETRY_QUEUED'].includes(j.status));
      if (!active.length) return { kind: 'consistent' as const };
      await tx.job.updateMany({ where: { organizationId, workflowId, status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'WAITING_APPROVAL', 'RETRY_QUEUED'] } }, data: { status: 'CANCELLED', workerId: null, leaseExpiresAt: null, completedAt: new Date(), failureCode: 'WORKFLOW_TERMINAL' } });
      await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_RECONCILED, 'Workflow', workflowId, 'reconciled', { cancelledActiveJobs: active.map(j => j.id) });
      return { kind: 'reconciled' as const, action: 'cancelled_active_jobs' };
    }
    if (workflow.currentJobId) {
      const current = jobs.find(j => j.id === workflow.currentJobId);
      if (!current) return { kind: 'ambiguous' as const, reason: 'Current job pointer does not resolve.' };
      if (current.status === 'SUCCEEDED') {
        const result = await advanceWorkflowAfterJobSuccess(tx, organizationId, workflowId, current.id, input);
        if (['advanced', 'completed', 'blocked', 'failed', 'waiting_approval'].includes(result.kind)) await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_RECONCILED, 'Workflow', workflowId, 'reconciled', { source: 'job_succeeded', jobId: current.id });
        return result;
      }
      if (current.status === 'WAITING_APPROVAL') {
        const approval = await tx.approval.findFirst({ where: { organizationId, targetResourceId: current.id, status: 'APPROVED', consumedAt: { not: null } } });
        if (!approval) return { kind: 'consistent' as const };
        await tx.job.update({ where: { id: current.id }, data: { status: 'RETRY_QUEUED', nextRetryAt: new Date(), workerId: null } });
        if (workflow.status === 'WAITING_APPROVAL') await tx.workflow.update({ where: { id: workflowId }, data: { status: 'RUNNING', currentState: 'RUNNING' } });
        await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_RECONCILED, 'Workflow', workflowId, 'reconciled', { source: 'consumed_approval', jobId: current.id });
        return { kind: 'reconciled' as const, action: 'resume_approved_job' };
      }
      return { kind: 'consistent' as const };
    }
    if (workflow.currentTaskId && workflow.status === 'RUNNING') {
      const matches = jobs.filter(j => j.taskId === workflow.currentTaskId);
      if (matches.length !== 1) return { kind: 'ambiguous' as const, reason: matches.length ? 'Multiple jobs exist for the current task.' : 'Current task has no job.' };
      await tx.workflow.update({ where: { id: workflowId }, data: { currentJobId: matches[0].id } });
      await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_RECONCILED, 'Workflow', workflowId, 'reconciled', { source: 'missing_current_job_pointer', jobId: matches[0].id });
      return { kind: 'reconciled' as const, action: 'restore_current_job_pointer' };
    }
    return { kind: 'consistent' as const };
  }, { isolationLevel: 'Serializable' });
}
export async function cancelWorkflow(db: PrismaClient, organizationId: string, workflowId: string, input: AuditBase) {
  return db.$transaction(async tx => {
    const workflow = await tx.workflow.findFirst({ where: { organizationId, id: workflowId } });
    if (!workflow || workflow.status === 'CANCELLED') return workflow;
    if (!canTransitionWorkflow(workflow.status, 'CANCELLED')) return null;
    await tx.job.updateMany({ where: { organizationId, workflowId, status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'WAITING_APPROVAL', 'RETRY_QUEUED'] } }, data: { status: 'CANCELLED', workerId: null, leaseExpiresAt: null, completedAt: new Date(), failureCode: 'WORKFLOW_CANCELLED' } });
    if (workflow.objectiveId) await tx.task.updateMany({ where: { objectiveId: workflow.objectiveId, status: { in: ['PENDING', 'READY', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED'] } }, data: { status: 'CANCELLED', completedAt: new Date() } });
    const updated = await tx.workflow.update({ where: { id: workflowId }, data: { status: 'CANCELLED', currentState: 'CANCELLED', currentTaskId: null, currentJobId: null, completedAt: new Date() } });
    await writeAudit(tx, input, AUDIT_EVENTS.WORKFLOW_UPDATED, 'Workflow', workflowId, 'cancelled');
    return updated;
  }, { isolationLevel: 'Serializable' });
}
