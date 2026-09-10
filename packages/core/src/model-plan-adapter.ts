import { PERMISSIONS, type Permission } from './rbac.js';
import type { ExecutionRisk } from './execution.js';
import type { OwnerIntent } from './intent.js';
import type { ModelResponse } from './model.js';
import type { PlanProposal, ProposedTask } from './plan-proposal.js';
import { validatePlanProposal } from './plan-validation.js';

export interface ModelPlanTaskOutput {
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
}

export interface ModelPlanOutput {
  objective: string;
  tasks: readonly ModelPlanTaskOutput[];
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly Permission[];
  risk: ExecutionRisk;
  approvalRequired: boolean;
  estimatedCost?: number;
  rationale: string;
}

const EXECUTION_RISKS = new Set<ExecutionRisk>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const PERMISSION_SET = new Set<Permission>(PERMISSIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Model plan output field ${field} must be an array of strings`);
  }
  return [...value];
}

function permissions(value: unknown, field: string): Permission[] {
  const values = stringArray(value, field);
  if (values.some((permission) => !PERMISSION_SET.has(permission as Permission))) {
    throw new Error(`Model plan output field ${field} contains an unsupported permission`);
  }
  return values as Permission[];
}

function risk(value: unknown, field: string): ExecutionRisk {
  if (typeof value !== 'string' || !EXECUTION_RISKS.has(value as ExecutionRisk)) {
    throw new Error(`Model plan output field ${field} contains an unsupported risk`);
  }
  return value as ExecutionRisk;
}

function booleanField(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Model plan output field ${field} must be boolean`);
  return value;
}

function numberField(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Model plan output field ${field} must be a non-negative finite number`);
  }
  return value;
}

function parseTask(value: unknown): ModelPlanTaskOutput {
  if (!isRecord(value)) throw new Error('Model plan output contains an invalid task');
  if (typeof value.taskId !== 'string' || !value.taskId || typeof value.title !== 'string' || !value.title || typeof value.description !== 'string') {
    throw new Error('Model plan task is missing required identity or description fields');
  }
  if (typeof value.order !== 'number' || !Number.isInteger(value.order) || value.order < 1) {
    throw new Error('Model plan task order must be a positive integer');
  }

  return {
    taskId: value.taskId,
    title: value.title,
    description: value.description,
    order: value.order,
    dependencies: stringArray(value.dependencies, 'dependencies'),
    requiredCapabilities: stringArray(value.requiredCapabilities, 'requiredCapabilities'),
    requiredPermissions: permissions(value.requiredPermissions, 'requiredPermissions'),
    risk: risk(value.risk, 'risk'),
    approvalRequired: booleanField(value.approvalRequired, 'approvalRequired'),
    ...(numberField(value.estimatedCost, 'estimatedCost') !== undefined ? { estimatedCost: numberField(value.estimatedCost, 'estimatedCost') } : {}),
    ...(value.proposedWorkerRole !== undefined ? { proposedWorkerRole: String(value.proposedWorkerRole) } : {}),
  };
}

function parseModelPlanOutput(value: unknown): ModelPlanOutput {
  if (!isRecord(value)) throw new Error('Model response output is not a valid plan object');
  if (typeof value.objective !== 'string' || !value.objective || typeof value.rationale !== 'string') {
    throw new Error('Model plan output is missing objective or rationale');
  }
  if (!Array.isArray(value.tasks)) throw new Error('Model plan output tasks must be an array');

  return {
    objective: value.objective,
    tasks: value.tasks.map(parseTask),
    requiredCapabilities: stringArray(value.requiredCapabilities, 'requiredCapabilities'),
    requiredPermissions: permissions(value.requiredPermissions, 'requiredPermissions'),
    risk: risk(value.risk, 'risk'),
    approvalRequired: booleanField(value.approvalRequired, 'approvalRequired'),
    ...(numberField(value.estimatedCost, 'estimatedCost') !== undefined ? { estimatedCost: numberField(value.estimatedCost, 'estimatedCost') } : {}),
    rationale: value.rationale,
  };
}

/**
 * Converts untrusted model output into the existing governed proposal contract.
 * Authority and organization identity are supplied by the application, never by
 * model output. Validation still terminates at the authoritative task-graph gate.
 */
export function modelResponseToPlanProposal(
  intent: OwnerIntent,
  response: ModelResponse<ModelPlanOutput>,
): PlanProposal {
  if (response.status !== 'SUCCESS' || response.output === undefined) {
    throw new Error('Cannot create a plan proposal from a failed model response');
  }
  if (response.requestId !== response.provenance.requestId || response.correlationId !== response.provenance.correlationId) {
    throw new Error('Model response provenance does not match its request correlation');
  }
  if (response.providerId !== response.provenance.providerId || response.modelId !== response.provenance.modelId) {
    throw new Error('Model response provenance does not match provider/model identity');
  }

  const output = parseModelPlanOutput(response.output);
  const tasks: ProposedTask[] = output.tasks.map((task) => ({
    ...task,
    dependencies: [...task.dependencies],
    requiredCapabilities: [...task.requiredCapabilities],
    requiredPermissions: [...task.requiredPermissions],
    targetOrganizationId: intent.organizationId,
  }));

  const proposal: PlanProposal = {
    proposalId: `${intent.intentId}:model-proposal:${response.responseId}`,
    sourceIntentId: intent.intentId,
    organizationId: intent.organizationId,
    objective: output.objective,
    tasks,
    requiredCapabilities: [...output.requiredCapabilities],
    requiredPermissions: [...output.requiredPermissions],
    risk: output.risk,
    approvalRequired: output.approvalRequired,
    ...(output.estimatedCost !== undefined ? { estimatedCost: output.estimatedCost } : {}),
    rationale: output.rationale,
    decisionMetadata: {
      source: 'model-response',
      providerId: response.providerId,
      modelId: response.modelId,
      responseId: response.responseId,
      correlationId: response.correlationId,
      deterministic: response.provenance.deterministic,
    },
    proposalVersion: 1,
    createdAt: response.timestamp,
    authority: 'PROPOSAL_ONLY',
  };

  validatePlanProposal(proposal);
  return proposal;
}
