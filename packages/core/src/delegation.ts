import type { ExecutionRisk } from './execution.js';
import type {
  WorkforceCapability,
  WorkforceContextScope,
  WorkforceRole,
  WorkforceSelectionProposal,
  WorkforceTaskRequirement,
  CapabilityContract,
  EligibleProviderModel,
} from './workforce.js';
import { assertWorkforceProposalHasNoAuthority, validateCapabilityMatch } from './workforce.js';

export const DELEGATION_STATUSES = ['PROPOSED','QUEUED','CANCELLED','EXPIRED'] as const;
export type DelegationStatus = typeof DELEGATION_STATUSES[number];
export const QA_DECISIONS = ['PASS','REWORK','ESCALATE'] as const;
export type QADecision = typeof QA_DECISIONS[number];

export interface DelegationProposal {
  proposalId: string;
  organizationId: string;
  ownerUserId: string;
  task: WorkforceTaskRequirement;
  roleId: string;
  roleName: string;
  requiredCapabilities: readonly WorkforceCapability[];
  capabilityContract: CapabilityContract;
  selectedProviderModel: EligibleProviderModel;
  risk: ExecutionRisk;
  approvalRequired: boolean;
  requestedContext: WorkforceContextScope;
  correlationId: string;
  idempotencyKey: string;
  authority: 'PROPOSAL_ONLY';
  provenance: string;
}

/** Data supplied by the authoritative control-plane worker identity boundary. */
export interface ControlPlaneWorkerBinding {
  workerId: string;
  organizationId: string;
  taskId: string;
  delegationId: string;
  roleId: string;
  capabilities: readonly WorkforceCapability[];
  context: WorkforceContextScope;
  providerId: string;
  modelId: string;
  risk: ExecutionRisk;
  workflowId?: string;
}

export interface AuthorizedDelegationJobInput {
  organizationId: string;
  taskId: string;
  workflowId?: string;
  workerIdentityId: string;
  idempotencyKey: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface WorkerResultFailure { code: string; message: string; retryable: boolean; }
export interface WorkerResult<TOutput = unknown> {
  workerId: string;
  organizationId: string;
  taskId: string;
  delegationId: string;
  status: 'SUCCEEDED' | 'FAILED';
  output?: TOutput;
  failure?: WorkerResultFailure;
  provenance: { workerId: string; organizationId: string; taskId: string; delegationId: string; providerId: string; modelId: string };
  startedAt: string;
  completedAt: string;
}
export interface QAResult { decision: QADecision; reason: string; qualityCriteria: readonly string[]; }

function timestampValid(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function sameScope(a: WorkforceContextScope, b: WorkforceContextScope): boolean {
  return a.organization === b.organization && a.businessId === b.businessId && a.projectId === b.projectId && a.departmentId === b.departmentId && a.workingContext === b.workingContext;
}

export function buildDelegationProposal(organizationId: string, ownerUserId: string, correlationId: string, selection: WorkforceSelectionProposal, task: WorkforceTaskRequirement, role: WorkforceRole, capabilityContract: CapabilityContract): DelegationProposal {
  if (selection.authority !== 'PROPOSAL_ONLY') throw new Error('Workforce selection must remain proposal-only');
  assertWorkforceProposalHasNoAuthority(selection);
  if (selection.organizationId !== organizationId || task.organizationId !== organizationId || role.organizationId !== organizationId) throw new Error('Delegation organization boundary violated');
  if (!selection.sourceTaskIds.includes(task.taskId)) throw new Error('Delegation task is not part of workforce selection');
  const candidate = selection.candidates.find((c) => c.roleId === role.roleId);
  if (!candidate) throw new Error('Selected workforce role is not present in the selection proposal');
  validateCapabilityMatch(task.requiredCapabilities, role.capabilityRequirements);
  validateCapabilityMatch(task.requiredCapabilities, candidate.requiredCapabilities);
  if (!sameScope(task.requiredContext, candidate.contextScope)) throw new Error('Requested execution context does not match selected workforce scope');
  const selected = candidate.eligibleProviderModels[0];
  if (!selected) throw new Error('No eligible provider/model exists for delegation');
  const approvalRequired = task.risk === 'HIGH' || task.risk === 'CRITICAL' || selection.approvalRequired;
  const proposal: DelegationProposal = {
    proposalId: `${organizationId}:delegation:${task.taskId}:${correlationId}`,
    organizationId,
    ownerUserId,
    task,
    roleId: role.roleId,
    roleName: role.name,
    requiredCapabilities: [...task.requiredCapabilities],
    capabilityContract,
    selectedProviderModel: selected,
    risk: task.risk,
    approvalRequired,
    requestedContext: task.requiredContext,
    correlationId,
    idempotencyKey: `delegation:${organizationId}:${task.taskId}:${correlationId}`,
    authority: 'PROPOSAL_ONLY',
    provenance: 'governed-delegation-slice-8',
  };
  assertDelegationProposalHasNoAuthority(proposal);
  return proposal;
}

export function assertDelegationProposalHasNoAuthority(proposal: DelegationProposal): void {
  if (proposal.authority !== 'PROPOSAL_ONLY') throw new Error('Delegation proposal must remain proposal-only');
  const serialized = JSON.stringify(proposal);
  for (const field of ['approvalGranted','grantedPermissions','grantedCapabilities','credentialId','workerId','execute','dispatch','externalAction','permissionGrant','capabilityGrant','authorization']) {
    if (serialized.includes(`\"${field}\"`)) throw new Error(`Delegation proposal contains forbidden authority field: ${field}`);
  }
}

/** Builds a durable Job payload from an already-authoritative control-plane worker binding. */
export function buildDelegationJobInput(proposal: DelegationProposal, worker: ControlPlaneWorkerBinding): AuthorizedDelegationJobInput {
  assertDelegationProposalHasNoAuthority(proposal);
  if (!worker.workerId.trim()) throw new Error('An existing control-plane worker identity is required');
  if (worker.organizationId !== proposal.organizationId || worker.taskId !== proposal.task.taskId || worker.delegationId !== proposal.proposalId) throw new Error('Control-plane worker binding does not match delegation proposal');
  if (worker.roleId !== proposal.roleId) throw new Error('Control-plane worker role does not match delegation proposal');
  if (!sameScope(worker.context, proposal.requestedContext)) throw new Error('Control-plane worker context exceeds delegation context');
  validateCapabilityMatch(proposal.requiredCapabilities, worker.capabilities);
  if (worker.providerId !== proposal.selectedProviderModel.providerId || worker.modelId !== proposal.selectedProviderModel.modelId) throw new Error('Control-plane worker provider/model mismatch');
  if (worker.risk !== proposal.risk) throw new Error('Delegation risk cannot be downgraded');
  return {
    organizationId: proposal.organizationId,
    taskId: proposal.task.taskId,
    workflowId: worker.workflowId,
    workerIdentityId: worker.workerId,
    idempotencyKey: proposal.idempotencyKey,
    metadata: {
      delegationId: proposal.proposalId,
      ownerUserId: proposal.ownerUserId,
      roleId: proposal.roleId,
      providerId: worker.providerId,
      modelId: worker.modelId,
      requiredCapabilities: [...proposal.requiredCapabilities],
      risk: proposal.risk,
      authorizedContext: { ...worker.context },
      approvalRequired: proposal.approvalRequired,
      provenance: 'governed-delegation-slice-8',
    },
  };
}

export function validateWorkerResult<TOutput>(worker: ControlPlaneWorkerBinding, result: WorkerResult<TOutput>): void {
  if (result.workerId !== worker.workerId || result.organizationId !== worker.organizationId || result.taskId !== worker.taskId || result.delegationId !== worker.delegationId) throw new Error('Worker result binding mismatch');
  if (result.provenance.workerId !== worker.workerId || result.provenance.organizationId !== worker.organizationId || result.provenance.taskId !== worker.taskId || result.provenance.delegationId !== worker.delegationId || result.provenance.providerId !== worker.providerId || result.provenance.modelId !== worker.modelId) throw new Error('Worker result provenance mismatch');
  if (!timestampValid(result.startedAt) || !timestampValid(result.completedAt)) throw new Error('Worker result timestamps must be valid');
  if (result.status === 'SUCCEEDED' && result.failure) throw new Error('Successful worker result cannot contain failure metadata');
  if (result.status === 'FAILED' && (!result.failure || !result.failure.code)) throw new Error('Failed worker result requires failure metadata');
}

export function validateQA(result: WorkerResult, qualityCriteria: readonly string[], decision: QADecision, reason: string): QAResult {
  if (!result || !reason.trim()) throw new Error('QA result requires a worker result and reason');
  if (!qualityCriteria.length) throw new Error('QA requires quality criteria');
  if (!QA_DECISIONS.includes(decision)) throw new Error('Invalid QA decision');
  return { decision, reason, qualityCriteria: [...qualityCriteria] };
}

/** Test-only result fixture; it is not a production execution boundary. */
export interface DeterministicTestWorkerBehavior<TOutput = unknown> { execute(input: { worker: ControlPlaneWorkerBinding; context: WorkforceContextScope }): WorkerResult<TOutput>; }
export class DeterministicTestWorker<TOutput = unknown> implements DeterministicTestWorkerBehavior<TOutput> {
  constructor(private readonly mode: 'SUCCESS' | 'VALIDATION_FAILURE' | 'WORKER_FAILURE' | 'MALFORMED_RESULT', private readonly output?: TOutput) {}
  execute(input: { worker: ControlPlaneWorkerBinding; context: WorkforceContextScope }): WorkerResult<TOutput> {
    if (!input.worker.workerId) throw new Error('Deterministic test worker requires an existing worker identity');
    if (!sameScope(input.context, input.worker.context)) throw new Error('Worker context exceeds authorization');
    const startedAt = new Date(0).toISOString(); const completedAt = new Date(1).toISOString();
    const base = { workerId: input.worker.workerId, organizationId: input.worker.organizationId, taskId: input.worker.taskId, delegationId: input.worker.delegationId, provenance: { workerId: input.worker.workerId, organizationId: input.worker.organizationId, taskId: input.worker.taskId, delegationId: input.worker.delegationId, providerId: input.worker.providerId, modelId: input.worker.modelId }, startedAt, completedAt };
    if (this.mode === 'SUCCESS') return { ...base, status: 'SUCCEEDED', output: this.output };
    if (this.mode === 'VALIDATION_FAILURE') return { ...base, status: 'SUCCEEDED', output: this.output };
    if (this.mode === 'MALFORMED_RESULT') return { ...base, status: 'SUCCEEDED', provenance: { ...base.provenance, organizationId: 'unauthorized-org' } };
    return { ...base, status: 'FAILED', failure: { code: 'DETERMINISTIC_WORKER_FAILURE', message: 'Deterministic worker failure requested by test fixture.', retryable: true } };
  }
}
