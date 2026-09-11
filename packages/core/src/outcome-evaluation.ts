export const OUTCOME_EVALUATOR_VERSION = 'deterministic-v1' as const;
export const OUTCOME_EVALUATION_AUTHORITY = 'PROPOSAL_ONLY' as const;

export const OUTCOMES = ['ACHIEVED', 'NOT_ACHIEVED', 'INCONCLUSIVE'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const CRITERION_STATES = ['SATISFIED', 'UNSATISFIED', 'UNDETERMINED'] as const;
export type CriterionState = (typeof CRITERION_STATES)[number];

export const QA_DECISIONS = ['PASS', 'REWORK', 'ESCALATE'] as const;
export type QADecision = (typeof QA_DECISIONS)[number];

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue };

/**
 * A deliberately small evaluator-supported view over the existing JSON
 * Objective.successCriteria field. Unsupported criterion shapes remain
 * UNDETERMINED; they are never interpreted as success.
 */
export type SupportedOutcomeCriterion =
  | { id?: string; kind: 'FIELD_EQUALS'; path: string; expected: JSONPrimitive }
  | { id?: string; kind: 'FIELD_EXISTS'; path: string }
  | { id?: string; kind: 'NUMBER_COMPARE'; path: string; operator: 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE'; value: number }
  | { id?: string; kind: 'STATUS_EQUALS'; expected: 'SUCCEEDED' | 'FAILED' };

export interface AuthoritativeExecutionResult {
  jobId: string;
  status: 'SUCCEEDED' | 'FAILED';
  output?: Record<string, unknown>;
  failure?: { code: string; message: string; retryable: boolean };
  handlerId: string;
  validatedAt: string | Date;
}

export interface OutcomeEvaluationContext {
  organizationId: string;
  objectiveId: string;
  workflowId?: string;
  taskId?: string;
  jobId: string;
  objective: {
    id: string;
    organizationId: string;
    successCriteria: unknown;
  };
  workflow?: { id: string; organizationId: string; objectiveId?: string };
  task?: { id: string; organizationId: string; objectiveId: string };
  job: {
    id: string;
    organizationId: string;
    objectiveId?: string;
    workflowId?: string;
    taskId?: string;
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'QUEUED' | 'CLAIMED' | 'RUNNING' | 'WAITING_APPROVAL' | 'RETRY_QUEUED';
    workerIdentityId?: string;
  };
  executionResult: AuthoritativeExecutionResult;
  worker?: { id: string; organizationId: string };
  retryState?: { attemptNumber: number; maxAttempts: number; retryable?: boolean };
  approvalState?: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' };
  correlationId?: string;
  modelSuggestion?: unknown;
}

export interface CriterionEvaluation {
  criterionId: string;
  state: CriterionState;
  evidence: string;
}

export interface EvaluatorProvenance {
  evaluator: 'LEO_OS_OUTCOME_EVALUATOR';
  evaluatorVersion: typeof OUTCOME_EVALUATOR_VERSION;
  resultJobId: string;
  resultValidatedAt: string;
  correlationId?: string;
}

export interface OutcomeEvaluation {
  organizationId: string;
  objectiveId: string;
  workflowId?: string;
  taskId?: string;
  jobId: string;
  evaluationId: string;
  outcome: Outcome;
  qaDecision: QADecision;
  confidence?: number;
  evidence: readonly CriterionEvaluation[];
  unmetCriteria: readonly string[];
  reasoningSummary?: string;
  evaluatorProvenance: EvaluatorProvenance;
  evaluatedAt: string;
  authority: typeof OUTCOME_EVALUATION_AUTHORITY;
}

export type OutcomeEvaluationFailure = {
  kind: 'INVALID_INPUT' | 'CROSS_ORGANIZATION' | 'AUTHORITY_VIOLATION';
  reason: string;
};

const AUTHORITY_KEYS = new Set([
  'organizationId', 'ownerId', 'ownerUserId', 'permission', 'permissions', 'capability',
  'capabilities', 'approvalGranted', 'workerId', 'credentialId', 'execute', 'dispatch',
  'retry', 'reassign', 'escalate',
]);

function hasAuthorityField(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some(item => hasAuthorityField(item, seen));
  return Object.entries(value).some(([key, item]) => AUTHORITY_KEYS.has(key) || hasAuthorityField(item, seen));
}

function isPrimitive(value: unknown): value is JSONPrimitive {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function getPath(value: unknown, path: string): { exists: boolean; value: unknown } {
  if (!path.trim()) return { exists: false, value: undefined };
  const parts = path.split('.').filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) return { exists: false, value: undefined };
    current = (current as Record<string, unknown>)[part];
  }
  return { exists: true, value: current };
}

function criterionId(criterion: SupportedOutcomeCriterion, index: number): string {
  return criterion.id?.trim() || `criterion-${index + 1}`;
}

function evaluateCriterion(criterion: SupportedOutcomeCriterion, index: number, result: AuthoritativeExecutionResult): CriterionEvaluation {
  const id = criterionId(criterion, index);
  const output = result.output ?? {};
  if (criterion.kind === 'STATUS_EQUALS') {
    return {
      criterionId: id,
      state: result.status === criterion.expected ? 'SATISFIED' : 'UNSATISFIED',
      evidence: `execution status is ${result.status}; expected ${criterion.expected}`,
    };
  }
  const located = getPath(output, criterion.path);
  if (criterion.kind === 'FIELD_EXISTS') {
    return { criterionId: id, state: located.exists ? 'SATISFIED' : 'UNDETERMINED', evidence: located.exists ? `field ${criterion.path} exists` : `field ${criterion.path} is missing` };
  }
  if (!located.exists) return { criterionId: id, state: 'UNDETERMINED', evidence: `field ${criterion.path} is missing` };
  if (criterion.kind === 'FIELD_EQUALS') {
    const equal = isPrimitive(located.value) && Object.is(located.value, criterion.expected);
    return { criterionId: id, state: equal ? 'SATISFIED' : 'UNSATISFIED', evidence: equal ? `field ${criterion.path} matches expected value` : `field ${criterion.path} does not match expected value` };
  }
  if (typeof located.value !== 'number' || !Number.isFinite(located.value)) {
    return { criterionId: id, state: 'UNDETERMINED', evidence: `field ${criterion.path} is not a finite number` };
  }
  const actual = located.value;
  const expected = criterion.value;
  const satisfied = criterion.operator === 'EQ' ? actual === expected : criterion.operator === 'GT' ? actual > expected : criterion.operator === 'GTE' ? actual >= expected : criterion.operator === 'LT' ? actual < expected : actual <= expected;
  return { criterionId: id, state: satisfied ? 'SATISFIED' : 'UNSATISFIED', evidence: `field ${criterion.path}=${actual}; expected ${criterion.operator} ${expected}` };
}

function parseCriteria(value: unknown): { criteria?: SupportedOutcomeCriterion[]; unsupported: boolean } {
  if (!Array.isArray(value)) return { unsupported: true };
  const criteria: SupportedOutcomeCriterion[] = [];
  let unsupported = false;
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { unsupported = true; continue; }
    const candidate = item as Record<string, unknown>;
    if (candidate.kind === 'FIELD_EQUALS' && typeof candidate.path === 'string' && isPrimitive(candidate.expected)) criteria.push(candidate as SupportedOutcomeCriterion);
    else if (candidate.kind === 'FIELD_EXISTS' && typeof candidate.path === 'string') criteria.push(candidate as SupportedOutcomeCriterion);
    else if (candidate.kind === 'NUMBER_COMPARE' && typeof candidate.path === 'string' && ['EQ', 'GT', 'GTE', 'LT', 'LTE'].includes(String(candidate.operator)) && typeof candidate.value === 'number' && Number.isFinite(candidate.value)) criteria.push(candidate as SupportedOutcomeCriterion);
    else if (candidate.kind === 'STATUS_EQUALS' && (candidate.expected === 'SUCCEEDED' || candidate.expected === 'FAILED')) criteria.push(candidate as SupportedOutcomeCriterion);
    else unsupported = true;
  }
  return { criteria, unsupported };
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

function deterministicEvaluationId(context: OutcomeEvaluationContext, evaluatedAt: string): string {
  return `outcome:${context.jobId}:${context.executionResult.validatedAt instanceof Date ? context.executionResult.validatedAt.toISOString() : context.executionResult.validatedAt}:${OUTCOME_EVALUATOR_VERSION}:${stable(context.objective.successCriteria)}:${evaluatedAt}`;
}

function validateContext(context: OutcomeEvaluationContext): OutcomeEvaluationFailure | null {
  if (!context || typeof context !== 'object') return { kind: 'INVALID_INPUT', reason: 'Evaluation context is required.' };
  if (![context.organizationId, context.objectiveId, context.jobId, context.objective?.id, context.objective?.organizationId, context.job?.id, context.job?.organizationId, context.executionResult?.jobId, context.executionResult?.handlerId].every(value => typeof value === 'string' && value.length > 0)) return { kind: 'INVALID_INPUT', reason: 'Authoritative identity fields are required.' };
  if (context.objective.id !== context.objectiveId || context.job.id !== context.jobId || context.executionResult.jobId !== context.jobId) return { kind: 'INVALID_INPUT', reason: 'Authoritative identifiers are inconsistent.' };
  const orgs = [context.organizationId, context.objective.organizationId, context.job.organizationId, context.workflow?.organizationId, context.task?.organizationId, context.worker?.organizationId].filter(Boolean);
  if (orgs.some(org => org !== context.organizationId)) return { kind: 'CROSS_ORGANIZATION', reason: 'Authoritative organization relationships are inconsistent.' };
  if (context.workflow && (context.workflow.id !== context.workflowId || (context.workflow.objectiveId && context.workflow.objectiveId !== context.objectiveId))) return { kind: 'INVALID_INPUT', reason: 'Workflow relationship is inconsistent.' };
  if (context.task && (context.task.id !== context.taskId || context.task.objectiveId !== context.objectiveId)) return { kind: 'INVALID_INPUT', reason: 'Task relationship is inconsistent.' };
  if (context.job.objectiveId && context.job.objectiveId !== context.objectiveId) return { kind: 'INVALID_INPUT', reason: 'Job/objective relationship is inconsistent.' };
  if (context.job.workflowId !== context.workflowId || context.job.taskId !== context.taskId) return { kind: 'INVALID_INPUT', reason: 'Job/task/workflow relationship is inconsistent.' };
  if (context.worker && context.job.workerIdentityId && context.worker.id !== context.job.workerIdentityId) return { kind: 'INVALID_INPUT', reason: 'Worker identity relationship is inconsistent.' };
  if (context.executionResult.status === 'SUCCEEDED' && context.job.status !== 'SUCCEEDED') return { kind: 'INVALID_INPUT', reason: 'A successful durable result requires a terminal successful Job.' };
  if (context.executionResult.status === 'FAILED' && context.job.status !== 'FAILED') return { kind: 'INVALID_INPUT', reason: 'A failed durable result requires a terminal failed Job.' };
  if (context.modelSuggestion !== undefined && hasAuthorityField(context.modelSuggestion)) return { kind: 'AUTHORITY_VIOLATION', reason: 'Model suggestions cannot carry authority-bearing fields.' };
  return null;
}

export function evaluateOutcome(context: OutcomeEvaluationContext, evaluatedAt = new Date()): OutcomeEvaluation | OutcomeEvaluationFailure {
  const validation = validateContext(context);
  if (validation) return validation;
  const timestamp = evaluatedAt instanceof Date ? evaluatedAt.toISOString() : String(evaluatedAt);
  const validatedAt = context.executionResult.validatedAt instanceof Date ? context.executionResult.validatedAt.toISOString() : context.executionResult.validatedAt;
  const parsed = parseCriteria(context.objective.successCriteria);
  if (!parsed.criteria?.length) {
    return {
      organizationId: context.organizationId,
      objectiveId: context.objectiveId,
      workflowId: context.workflowId,
      taskId: context.taskId,
      jobId: context.jobId,
      evaluationId: deterministicEvaluationId(context, timestamp),
      outcome: 'INCONCLUSIVE',
      qaDecision: 'ESCALATE',
      evidence: [],
      unmetCriteria: [],
      reasoningSummary: parsed.unsupported ? 'Success criteria are missing or outside the deterministic evaluator-supported subset.' : 'No applicable success criteria were supplied.',
      evaluatorProvenance: { evaluator: 'LEO_OS_OUTCOME_EVALUATOR', evaluatorVersion: OUTCOME_EVALUATOR_VERSION, resultJobId: context.executionResult.jobId, resultValidatedAt: validatedAt, correlationId: context.correlationId },
      evaluatedAt: timestamp,
      authority: OUTCOME_EVALUATION_AUTHORITY,
    };
  }

  const evidence = parsed.criteria.map((criterion, index) => evaluateCriterion(criterion, index, context.executionResult));
  const hasSatisfied = evidence.some(item => item.state === 'SATISFIED');
  const hasUnsatisfied = evidence.some(item => item.state === 'UNSATISFIED');
  const hasUndetermined = evidence.some(item => item.state === 'UNDETERMINED');
  const contradictory = hasSatisfied && hasUnsatisfied;
  const outcome: Outcome = contradictory || hasUndetermined ? 'INCONCLUSIVE' : hasUnsatisfied ? 'NOT_ACHIEVED' : 'ACHIEVED';
  const qaDecision: QADecision = outcome === 'ACHIEVED' ? 'PASS' : outcome === 'NOT_ACHIEVED' ? 'REWORK' : 'ESCALATE';
  const confidence = outcome === 'ACHIEVED' || outcome === 'NOT_ACHIEVED' ? 1 : 0;
  const unmetCriteria = evidence.filter(item => item.state !== 'SATISFIED').map(item => item.criterionId);
  const reasoningSummary = contradictory ? 'Criteria produced contradictory evidence; outcome is inconclusive.' : hasUndetermined ? 'At least one criterion lacks sufficient authoritative evidence; outcome is inconclusive.' : outcome === 'ACHIEVED' ? 'All supported criteria are satisfied by the validated durable result.' : 'At least one supported criterion is unsatisfied.';

  return {
    organizationId: context.organizationId,
    objectiveId: context.objectiveId,
    workflowId: context.workflowId,
    taskId: context.taskId,
    jobId: context.jobId,
    evaluationId: deterministicEvaluationId(context, timestamp),
    outcome,
    qaDecision,
    confidence,
    evidence,
    unmetCriteria,
    reasoningSummary,
    evaluatorProvenance: { evaluator: 'LEO_OS_OUTCOME_EVALUATOR', evaluatorVersion: OUTCOME_EVALUATOR_VERSION, resultJobId: context.executionResult.jobId, resultValidatedAt: validatedAt, correlationId: context.correlationId },
    evaluatedAt: timestamp,
    authority: OUTCOME_EVALUATION_AUTHORITY,
  };
}

export function isOutcomeEvaluationFailure(value: OutcomeEvaluation | OutcomeEvaluationFailure): value is OutcomeEvaluationFailure {
  return 'kind' in value;
}
