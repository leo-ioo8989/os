import { TaskGraphError, validateTaskGraph, type TaskGraph } from './task-graph.js';
import type { PlanProposal } from './plan-proposal.js';

export function proposalToTaskGraph(proposal: PlanProposal): TaskGraph {
  if (proposal.authority !== 'PROPOSAL_ONLY') {
    throw new TaskGraphError('Plan proposal authority must be PROPOSAL_ONLY');
  }
  if (!proposal.organizationId || !proposal.sourceIntentId || !proposal.objective) {
    throw new TaskGraphError('Plan proposal is missing required identity or objective fields');
  }

  const seenOrders = new Set<number>();
  for (const task of proposal.tasks) {
    if (task.targetOrganizationId !== proposal.organizationId) {
      throw new TaskGraphError(`Task ${task.taskId} targets a different organization`);
    }
    if (!Number.isInteger(task.order) || task.order < 1 || seenOrders.has(task.order)) {
      throw new TaskGraphError(`Task ${task.taskId} has an invalid or duplicate order`);
    }
    seenOrders.add(task.order);
    if (task.approvalRequired && proposal.authority !== 'PROPOSAL_ONLY') {
      throw new TaskGraphError(`Task ${task.taskId} contains invalid approval authority`);
    }
  }

  return {
    tasks: proposal.tasks.map((task) => ({
      id: task.taskId,
      objectiveId: proposal.sourceIntentId,
      title: task.title,
      description: task.description,
      status: 'PENDING',
      dependencies: [...task.dependencies],
      riskLevel: task.risk === 'LOW' ? 'GREEN' : task.risk === 'MEDIUM' ? 'YELLOW' : 'RED',
      estimatedCost: task.estimatedCost,
      actualCost: 0,
      retryCount: 0,
      retryLimit: 0,
      metadata: {
        proposalId: proposal.proposalId,
        requiredCapabilities: [...task.requiredCapabilities],
        requiredPermissions: [...task.requiredPermissions],
        approvalRequired: task.approvalRequired,
        proposedWorkerRole: task.proposedWorkerRole,
      },
    })),
  };
}

export function validatePlanProposal(proposal: PlanProposal): void {
  if (proposal.proposalVersion < 1 || !Number.isInteger(proposal.proposalVersion)) {
    throw new TaskGraphError('Plan proposal version must be a positive integer');
  }
  if (proposal.requiredCapabilities.some((capability) => !capability.trim())) {
    throw new TaskGraphError('Plan proposal contains an empty required capability');
  }
  validateTaskGraph(proposalToTaskGraph(proposal));
}
