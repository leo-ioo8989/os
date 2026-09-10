import { decideExecution, type ExecutionRisk } from './execution.js';
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

export const DELEGATION_STATUSES = ['PROPOSED','AUTHORIZED','RUNNING','SUCCEEDED','FAILED','RETRYING','REASSIGNED','ESCALATED','CANCELLED','EXPIRED'] as const;
export type DelegationStatus = typeof DELEGATION_STATUSES[number];
export const WORKER_STATUSES = ['CREATED','AUTHORIZED','RUNNING','SUCCEEDED','FAILED','RETRYING','REASSIGNED','ESCALATED','CANCELLED','EXPIRED'] as const;
export type AuthorizedWorkerStatus = typeof WORKER_STATUSES[number];
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

export interface DelegationAuthorization {
  organizationId: string;
  delegationId: string;
  workerId: string;
  approvalGranted: boolean;
  authorizedCapabilities: readonly WorkforceCapability[];
  authorizedContext: WorkforceContextScope;
  providerId: string;
  modelId: string;
  risk: ExecutionRisk;
  authorizedAt: string;
  provenance: string;
}

export interface AuthorizedWorker {
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
  status: AuthorizedWorkerStatus;
  createdAt: string;
}

export interface WorkerResultFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface WorkerResult<TOutput = unknown> {
  workerId: string;
  organizationId: string;
  taskId: string;
  delegationId: string;
  status: 'SUCCEEDED' | 'FAILED';
  output?: TOutput;
  failure?: WorkerResultFailure;
  provenance: {
    workerId: string;
    organizationId: string;
    taskId: string;
    delegationId: string;
    providerId: string;
    modelId: string;
  };
  startedAt: string;
  completedAt: string;
}

export interface QAResult {
  decision: QADecision;
  reason: string;
  qualityCriteria: readonly string[];
}

export interface DelegationExecutionPolicy {
  maxAttempts: number;
  allowReassignment: boolean;
  allowEscalation: boolean;
}

export interface DelegationExecutionOutcome<TOutput = unknown> {
  status: 'SUCCEEDED' | 'REWORK' | 'REASSIGNED' | 'ESCALATED' | 'FAILED';
  worker: AuthorizedWorker;
  result: WorkerResult<TOutput>;
  qa: QAResult;
  attempts: number;
}

export interface DeterministicWorkerBehavior<TOutput = unknown> {
  execute(input: { worker: AuthorizedWorker; context: WorkforceContextScope }): WorkerResult<TOutput>;
}

function timestampValid(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function sameScope(a: WorkforceContextScope, b: WorkforceContextScope): boolean {
  return a.organization === b.organization && a.businessId === b.businessId && a.projectId === b.projectId && a.departmentId === b.departmentId && a.workingContext === b.workingContext;
}

export function buildDelegationProposal(
  organizationId: string,
  ownerUserId: string,
  correlationId: string,
  selection: WorkforceSelectionProposal,
  task: WorkforceTaskRequirement,
  role: WorkforceRole,
  capabilityContract: CapabilityContract,
): DelegationProposal {
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

export function authorizeDelegation(
  proposal: DelegationProposal,
  role: WorkforceRole,
  providerModel: EligibleProviderModel,
  approvalGranted: boolean,
  now = new Date().toISOString(),
): DelegationAuthorization {
  assertDelegationProposalHasNoAuthority(proposal);
  if (!timestampValid(now)) throw new Error('Authorization timestamp must be valid');
  if (proposal.organizationId !== role.organizationId) throw new Error('Delegation role organization mismatch');
  if (proposal.roleId !== role.roleId) throw new Error('Delegation role binding mismatch');
  if (proposal.selectedProviderModel.providerId !== providerModel.providerId || proposal.selectedProviderModel.modelId !== providerModel.modelId) throw new Error('Provider/model is not the selected eligible delegation target');
  validateCapabilityMatch(proposal.requiredCapabilities, role.capabilityRequirements);
  if (!sameScope(proposal.requestedContext, role.contextScope)) throw new Error('Delegation context exceeds role scope');
  if (proposal.approvalRequired && !approvalGranted) throw new Error('Approval is required before delegation authorization');
  const decision = decideExecution(proposal.risk, true, approvalGranted);
  if (decision !== 'ALLOW') throw new Error(`Execution authorization denied: ${decision}`);
  const workerId = `${proposal.proposalId}:worker:1`;
  return {
    organizationId: proposal.organizationId,
    delegationId: proposal.proposalId,
    workerId,
    approvalGranted,
    authorizedCapabilities: [...proposal.requiredCapabilities],
    authorizedContext: { ...proposal.requestedContext },
    providerId: providerModel.providerId,
    modelId: providerModel.modelId,
    risk: proposal.risk,
    authorizedAt: now,
    provenance: 'control-plane-authorization-required-slice-8',
  };
}

export function createAuthorizedWorker(auth: DelegationAuthorization, taskId: string, roleId: string, now = new Date().toISOString()): AuthorizedWorker {
  if (!auth.organizationId || !auth.workerId || !auth.delegationId || !taskId || !roleId) throw new Error('Authorized worker is missing binding identity');
  if (!timestampValid(now)) throw new Error('Worker creation timestamp must be valid');
  return { workerId: auth.workerId, organizationId: auth.organizationId, taskId, delegationId: auth.delegationId, roleId, capabilities: [...auth.authorizedCapabilities], context: { ...auth.authorizedContext }, providerId: auth.providerId, modelId: auth.modelId, risk: auth.risk, status: 'AUTHORIZED', createdAt: now };
}

export function validateWorkerResult<TOutput>(worker: AuthorizedWorker, result: WorkerResult<TOutput>): void {
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

export class DeterministicTestWorker<TOutput = unknown> implements DeterministicWorkerBehavior<TOutput> {
  constructor(private readonly mode: 'SUCCESS' | 'VALIDATION_FAILURE' | 'WORKER_FAILURE' | 'MALFORMED_RESULT', private readonly output?: TOutput) {}
  execute(input: { worker: AuthorizedWorker; context: WorkforceContextScope }): WorkerResult<TOutput> {
    if (!sameScope(input.context, input.worker.context)) throw new Error('Worker context exceeds authorization');
    const startedAt = new Date(0).toISOString();
    const completedAt = new Date(1).toISOString();
    const base = { workerId: input.worker.workerId, organizationId: input.worker.organizationId, taskId: input.worker.taskId, delegationId: input.worker.delegationId, provenance: { workerId: input.worker.workerId, organizationId: input.worker.organizationId, taskId: input.worker.taskId, delegationId: input.worker.delegationId, providerId: input.worker.providerId, modelId: input.worker.modelId }, startedAt, completedAt };
    if (this.mode === 'SUCCESS') return { ...base, status: 'SUCCEEDED', output: this.output };
    if (this.mode === 'VALIDATION_FAILURE') return { ...base, status: 'SUCCEEDED', output: this.output };
    if (this.mode === 'MALFORMED_RESULT') return { ...base, status: 'SUCCEEDED', provenance: { ...base.provenance, organizationId: 'unauthorized-org' } };
    return { ...base, status: 'FAILED', failure: { code: 'DETERMINISTIC_WORKER_FAILURE', message: 'Deterministic worker failure requested by test fixture.', retryable: true } };
  }
}

export class GovernedDelegationExecutor<TOutput = unknown> {
  private readonly idempotency = new Map<string, DelegationExecutionOutcome<TOutput>>();
  constructor(private readonly policy: DelegationExecutionPolicy) {
    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) throw new Error('maxAttempts must be a positive integer');
  }
  execute(proposal: DelegationProposal, authorization: DelegationAuthorization, worker: AuthorizedWorker, behavior: DeterministicWorkerBehavior<TOutput>, qaDecision: QADecision = 'PASS'): DelegationExecutionOutcome<TOutput> {
    assertDelegationProposalHasNoAuthority(proposal);
    if (authorization.workerId !== worker.workerId || authorization.organizationId !== worker.organizationId || authorization.delegationId !== worker.delegationId) throw new Error('Authorization/worker binding mismatch');
    if (proposal.organizationId !== worker.organizationId || proposal.task.taskId !== worker.taskId) throw new Error('Execution organization/task boundary violated');
    if (worker.status !== 'AUTHORIZED' && worker.status !== 'RETRYING') throw new Error(`Worker is not executable from status ${worker.status}`);
    const existing = this.idempotency.get(proposal.idempotencyKey);
    if (existing) return existing;
    let current = { ...worker, status: 'RUNNING' as const };
    let lastResult: WorkerResult<TOutput> | undefined;
    let attempts = 0;
    while (attempts < this.policy.maxAttempts) {
      attempts += 1;
      lastResult = behavior.execute({ worker: current, context: current.context });
      try { validateWorkerResult(current, lastResult); } catch {
        const qa = validateQA(lastResult, proposal.capabilityContract.qualityCriteria, 'ESCALATE', 'Malformed or unauthorized result failed closed.');
        current = { ...current, status: 'ESCALATED' };
        const outcome = { status: 'ESCALATED' as const, worker: current, result: lastResult, qa, attempts };
        this.idempotency.set(proposal.idempotencyKey, outcome); return outcome;
      }
      if (lastResult.status === 'SUCCEEDED') {
        const qa = validateQA(lastResult, proposal.capabilityContract.qualityCriteria, qaDecision, qaDecision === 'PASS' ? 'Deterministic QA passed the result.' : qaDecision === 'REWORK' ? 'Deterministic QA requires rework.' : 'Deterministic QA escalated the result.');
        if (qa.decision === 'PASS') { current = { ...current, status: 'SUCCEEDED' }; const outcome = { status: 'SUCCEEDED' as const, worker: current, result: lastResult, qa, attempts }; this.idempotency.set(proposal.idempotencyKey, outcome); return outcome; }
        if (qa.decision === 'REWORK' && attempts < this.policy.maxAttempts) { current = { ...current, status: 'RETRYING' }; continue; }
        current = { ...current, status: qa.decision === 'ESCALATE' ? 'ESCALATED' : 'FAILED' };
        const outcome = { status: qa.decision === 'ESCALATE' ? 'ESCALATED' as const : 'REWORK' as const, worker: current, result: lastResult, qa, attempts }; this.idempotency.set(proposal.idempotencyKey, outcome); return outcome;
      }
      if (!lastResult.failure?.retryable || attempts >= this.policy.maxAttempts) break;
      current = { ...current, status: 'RETRYING' };
    }
    if (this.policy.allowReassignment) { current = { ...current, status: 'REASSIGNED' }; const qa = validateQA(lastResult!, proposal.capabilityContract.qualityCriteria, 'REWORK', 'Retry budget exhausted; reassignment is permitted.'); const outcome = { status: 'REASSIGNED' as const, worker: current, result: lastResult!, qa, attempts }; this.idempotency.set(proposal.idempotencyKey, outcome); return outcome; }
    current = { ...current, status: this.policy.allowEscalation ? 'ESCALATED' : 'FAILED' };
    const qa = validateQA(lastResult!, proposal.capabilityContract.qualityCriteria, this.policy.allowEscalation ? 'ESCALATE' : 'REWORK', 'Retry budget exhausted.');
    const outcome = { status: this.policy.allowEscalation ? 'ESCALATED' as const : 'FAILED' as const, worker: current, result: lastResult!, qa, attempts };
    this.idempotency.set(proposal.idempotencyKey, outcome); return outcome;
  }
}
