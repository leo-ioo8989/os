import type { OwnerIntent } from './intent.js';
import type { Permission } from './rbac.js';
import type { ExecutionRisk } from './execution.js';

export interface ProposedTask {
  taskId: string;
  title: string;
  description: string;
  order: number;
  dependencies: readonly string[];
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly Permission[];
  risk: ExecutionRisk;
  approvalRequired: boolean;
  estimatedCost?: number;
  proposedWorkerRole?: string;
  targetOrganizationId: string;
}

export interface PlanProposal {
  proposalId: string;
  sourceIntentId: string;
  organizationId: string;
  objective: string;
  tasks: readonly ProposedTask[];
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly Permission[];
  risk: ExecutionRisk;
  approvalRequired: boolean;
  estimatedCost?: number;
  rationale: string;
  decisionMetadata: Readonly<Record<string, unknown>>;
  proposalVersion: number;
  createdAt: string;
  /** A proposal records requirements; it never grants execution authority. */
  authority: 'PROPOSAL_ONLY';
}

export interface DeterministicPlanner {
  propose(intent: OwnerIntent): PlanProposal;
}

export class DeterministicPlanGenerator implements DeterministicPlanner {
  propose(intent: OwnerIntent): PlanProposal {
    const taskId = `${intent.intentId}:task:1`;
    const approvalRequired = intent.riskRequirements.length > 0 || intent.priority === 'CRITICAL';
    const risk: ExecutionRisk = intent.priority === 'CRITICAL' ? 'CRITICAL' : intent.priority === 'HIGH' ? 'HIGH' : 'LOW';
    const permissions: readonly Permission[] = ['objective:read', 'task:read'];

    return {
      proposalId: `${intent.intentId}:proposal:1`,
      sourceIntentId: intent.intentId,
      organizationId: intent.organizationId,
      objective: intent.requestedOutcome,
      tasks: [{
        taskId,
        title: intent.requestedOutcome,
        description: intent.context ? `${intent.requestedOutcome} (context supplied)` : intent.requestedOutcome,
        order: 1,
        dependencies: [],
        requiredCapabilities: [],
        requiredPermissions: permissions,
        risk,
        approvalRequired,
        ...(intent.requestedBudget !== undefined ? { estimatedCost: intent.requestedBudget } : {}),
        proposedWorkerRole: 'general',
        targetOrganizationId: intent.organizationId,
      }],
      requiredCapabilities: [],
      requiredPermissions: permissions,
      risk,
      approvalRequired,
      ...(intent.requestedBudget !== undefined ? { estimatedCost: intent.requestedBudget } : {}),
      rationale: 'Deterministic Phase 2 Slice #1 planner; no model or execution authority is used.',
      decisionMetadata: { planner: 'deterministic-v1', sourceCorrelationId: intent.correlationId },
      proposalVersion: 1,
      createdAt: new Date().toISOString(),
      authority: 'PROPOSAL_ONLY',
    };
  }
}
