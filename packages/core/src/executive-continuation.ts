import type { OwnerIntent } from './intent.js';
import type { PlanProposal } from './plan-proposal.js';
import { DeterministicPlanGenerator } from './plan-proposal.js';
import { validatePlanProposal } from './plan-validation.js';
import type { OutcomeEvaluation } from './outcome-evaluation.js';

export const EXECUTIVE_CONTINUATION_AUTHORITY = 'PROPOSAL_ONLY' as const;
export const EXECUTIVE_CONTINUATION_VERSION = 'deterministic-v1' as const;
export const CONTINUATION_DISPOSITIONS = ['COMPLETE', 'CONTINUE', 'REWORK', 'CLARIFY', 'ESCALATE'] as const;
export type ContinuationDisposition = (typeof CONTINUATION_DISPOSITIONS)[number];

export interface ExecutiveContinuationContext {
  organizationId: string;
  ownerUserId: string;
  objectiveId: string;
  workflowId?: string;
  taskId?: string;
  jobId: string;
  originalIntent: OwnerIntent;
  outcomeEvaluation: OutcomeEvaluation;
  currentState?: readonly string[];
  correlationId?: string;
}

export interface ExecutiveContinuationDecision {
  continuationId: string;
  organizationId: string;
  ownerUserId: string;
  objectiveId: string;
  workflowId?: string;
  taskId?: string;
  jobId: string;
  disposition: ContinuationDisposition;
  rationale: string;
  nextProposal?: PlanProposal;
  risks: readonly string[];
  provenance: {
    continuationVersion: typeof EXECUTIVE_CONTINUATION_VERSION;
    sourceEvaluationId: string;
    sourceJobId: string;
    correlationId?: string;
  };
  authority: typeof EXECUTIVE_CONTINUATION_AUTHORITY;
}

export type ExecutiveContinuationFailure = {
  kind: 'INVALID_INPUT' | 'CROSS_ORGANIZATION' | 'UNVALIDATED_OUTCOME' | 'AUTHORITY_VIOLATION';
  reason: string;
};

function validateContext(context: ExecutiveContinuationContext): ExecutiveContinuationFailure | null {
  if (!context || typeof context !== 'object') return { kind: 'INVALID_INPUT', reason: 'Continuation context is required.' };
  const required = [
    context.organizationId, context.ownerUserId, context.objectiveId, context.jobId,
    context.originalIntent?.organizationId, context.originalIntent?.ownerUserId,
    context.outcomeEvaluation?.organizationId, context.outcomeEvaluation?.objectiveId,
    context.outcomeEvaluation?.jobId, context.outcomeEvaluation?.evaluationId,
    context.outcomeEvaluation?.authority,
  ];
  if (!required.every((value) => typeof value === 'string' && value.length > 0)) {
    return { kind: 'INVALID_INPUT', reason: 'Authoritative continuation identity is incomplete.' };
  }
  if (context.originalIntent.organizationId !== context.organizationId || context.outcomeEvaluation.organizationId !== context.organizationId) {
    return { kind: 'CROSS_ORGANIZATION', reason: 'Continuation identity crosses organization boundaries.' };
  }
  if (context.originalIntent.ownerUserId !== context.ownerUserId) return { kind: 'INVALID_INPUT', reason: 'Owner identity does not match the continuation context.' };
  if (context.outcomeEvaluation.objectiveId !== context.objectiveId || context.outcomeEvaluation.jobId !== context.jobId) {
    return { kind: 'INVALID_INPUT', reason: 'Outcome evaluation does not match the authoritative continuation target.' };
  }
  if (context.outcomeEvaluation.authority !== 'PROPOSAL_ONLY') return { kind: 'AUTHORITY_VIOLATION', reason: 'Outcome evaluation has an unexpected authority classification.' };
  return null;
}

function buildNextProposal(intent: OwnerIntent, disposition: 'CONTINUE' | 'REWORK', evaluation: OutcomeEvaluation): PlanProposal {
  const base = new DeterministicPlanGenerator().propose(intent);
  const prefix = disposition === 'REWORK' ? 'Rework after outcome evaluation' : 'Continue after outcome evaluation';
  const tasks = base.tasks.map((task) => ({
    ...task,
    taskId: `${intent.intentId}:continuation:${evaluation.evaluationId}:${task.taskId}`,
    title: `${prefix}: ${task.title}`,
    description: `${task.description}. Source outcome evaluation: ${evaluation.evaluationId}.`,
  }));
  const proposal: PlanProposal = {
    ...base,
    proposalId: `${intent.intentId}:continuation:${evaluation.evaluationId}`,
    tasks,
    createdAt: evaluation.evaluatedAt,
    rationale: `${prefix}; generated as a proposal-only continuation from validated outcome ${evaluation.evaluationId}.`,
    decisionMetadata: {
      ...base.decisionMetadata,
      continuationVersion: EXECUTIVE_CONTINUATION_VERSION,
      sourceEvaluationId: evaluation.evaluationId,
      sourceJobId: evaluation.jobId,
    },
  };
  validatePlanProposal(proposal);
  return proposal;
}

/** Deterministic feedback boundary: evaluate continuation, propose; never execute. */
export function continueExecutive(context: ExecutiveContinuationContext): ExecutiveContinuationDecision | ExecutiveContinuationFailure {
  const failure = validateContext(context);
  if (failure) return failure;
  const evaluation = context.outcomeEvaluation;
  const disposition: ContinuationDisposition = evaluation.outcome === 'ACHIEVED' ? 'COMPLETE' : evaluation.outcome === 'NOT_ACHIEVED' ? 'REWORK' : 'ESCALATE';
  const nextProposal = disposition === 'REWORK' ? buildNextProposal(context.originalIntent, disposition, evaluation) : undefined;
  const rationale = disposition === 'COMPLETE'
    ? 'Validated outcome achieved all supported criteria; no further execution is proposed by this continuation boundary.'
    : disposition === 'REWORK'
      ? 'Validated outcome did not satisfy at least one supported criterion; a governed rework proposal is returned to the existing control plane.'
      : 'Validated outcome is inconclusive; the continuation boundary proposes escalation rather than guessing success or initiating execution.';
  return {
    continuationId: `continuation:${evaluation.evaluationId}:${EXECUTIVE_CONTINUATION_VERSION}`,
    organizationId: context.organizationId, ownerUserId: context.ownerUserId, objectiveId: context.objectiveId,
    workflowId: context.workflowId, taskId: context.taskId, jobId: context.jobId, disposition, rationale,
    ...(nextProposal ? { nextProposal } : {}),
    risks: evaluation.outcome === 'ACHIEVED' ? [] : [...evaluation.unmetCriteria],
    provenance: { continuationVersion: EXECUTIVE_CONTINUATION_VERSION, sourceEvaluationId: evaluation.evaluationId, sourceJobId: evaluation.jobId, correlationId: context.correlationId ?? evaluation.evaluatorProvenance.correlationId },
    authority: EXECUTIVE_CONTINUATION_AUTHORITY,
  };
}

export function isExecutiveContinuationFailure(value: ExecutiveContinuationDecision | ExecutiveContinuationFailure): value is ExecutiveContinuationFailure {
  return 'kind' in value;
}
