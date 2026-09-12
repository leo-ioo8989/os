export const V308_VERSION = '3.08.0';
export const V308_POLICY_VERSION = 'v3.08-resource-policy-1';

export type ResourceKind = 'model' | 'tool' | 'execution';
export type ResourceDecision = 'ALLOW' | 'APPROVAL_REQUIRED' | 'DENY';
export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ResourceProvenance {
  organizationId: string;
  businessId?: string;
  projectId?: string;
  objectiveId?: string;
  taskId?: string;
  jobId?: string;
  workerId?: string;
  correlationId: string;
}

export interface UsageEvent {
  eventId: string;
  occurredAt: string;
  kind: ResourceKind;
  provider?: string;
  model?: string;
  tool?: string;
  inputUnits?: number;
  outputUnits?: number;
  durationMs?: number;
  estimatedCost: number;
  currency: string;
  provenance: ResourceProvenance;
  metadata?: Record<string, string | number | boolean>;
}

export interface ResourcePolicy {
  policyVersion?: string;
  currency: string;
  quotaUnits?: number;
  budgetLimit?: number;
  concurrencyLimit?: number;
  latencyLimitMs?: number;
  maxEstimatedCostPerAction?: number;
  requireApprovalAboveCost?: number;
  freeFirst?: boolean;
  allowedProviders?: string[];
  allowedModels?: string[];
  allowedTools?: string[];
}

export interface ResourceSnapshot {
  quotaUsed: number;
  budgetUsed: number;
  concurrencyUsed: number;
  maxObservedLatencyMs: number;
}

export interface ResourceDecisionInput {
  event: UsageEvent;
  policy: ResourcePolicy;
  snapshot: ResourceSnapshot;
  proposedProvider?: string;
  proposedModel?: string;
  proposedTool?: string;
  isHighRisk?: boolean;
  accountingEvidencePresent?: boolean;
  identityEvidencePresent?: boolean;
}

export interface ResourceDecisionResult {
  decision: ResourceDecision;
  policyVersion: string;
  reasons: string[];
  estimatedCost: number;
  projectedQuotaUsed: number;
  projectedBudgetUsed: number;
}

export interface UsageAnomalySignal {
  signalId: string;
  severity: AnomalySeverity;
  code: 'COST_SPIKE' | 'QUOTA_ACCELERATION' | 'LATENCY_SPIKE' | 'CROSS_ORG_ATTRIBUTION' | 'FORGED_USAGE';
  message: string;
  provenance: ResourceProvenance;
}

const finiteNonNegative = (value: number | undefined, field: string): void => {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`V308_INVALID_${field.toUpperCase()}`);
  }
};

export function validateUsageEvent(event: UsageEvent): UsageEvent {
  if (!event.eventId || !event.occurredAt || !event.provenance.organizationId || !event.provenance.correlationId) {
    throw new Error('V308_USAGE_PROVENANCE_REQUIRED');
  }
  if (!Number.isFinite(event.estimatedCost) || event.estimatedCost < 0) {
    throw new Error('V308_INVALID_ESTIMATED_COST');
  }
  if (!event.currency || event.currency.length !== 3) throw new Error('V308_INVALID_CURRENCY');
  finiteNonNegative(event.inputUnits, 'input_units');
  finiteNonNegative(event.outputUnits, 'output_units');
  finiteNonNegative(event.durationMs, 'duration_ms');
  return structuredClone(event);
}

function includesAllowed(value: string | undefined, allowed: string[] | undefined): boolean {
  return !value || !allowed || allowed.includes(value);
}

export function decideResourceUse(input: ResourceDecisionInput): ResourceDecisionResult {
  const event = validateUsageEvent(input.event);
  const policyVersion = input.policy.policyVersion ?? V308_POLICY_VERSION;
  const policy = input.policy;
  const snapshot = input.snapshot;
  const reasons: string[] = [];

  if (!input.identityEvidencePresent || !input.accountingEvidencePresent) {
    return {
      decision: 'DENY', policyVersion, reasons: ['MISSING_IDENTITY_OR_ACCOUNTING_EVIDENCE'],
      estimatedCost: event.estimatedCost,
      projectedQuotaUsed: snapshot.quotaUsed,
      projectedBudgetUsed: snapshot.budgetUsed,
    };
  }

  if (event.provenance.organizationId !== input.event.provenance.organizationId) {
    return {
      decision: 'DENY', policyVersion, reasons: ['ORGANIZATION_ATTRIBUTION_MISMATCH'],
      estimatedCost: event.estimatedCost,
      projectedQuotaUsed: snapshot.quotaUsed,
      projectedBudgetUsed: snapshot.budgetUsed,
    };
  }

  if (!includesAllowed(input.proposedProvider, policy.allowedProviders)) reasons.push('PROVIDER_NOT_ALLOWED');
  if (!includesAllowed(input.proposedModel, policy.allowedModels)) reasons.push('MODEL_NOT_ALLOWED');
  if (!includesAllowed(input.proposedTool, policy.allowedTools)) reasons.push('TOOL_NOT_ALLOWED');

  const projectedQuotaUsed = snapshot.quotaUsed + 1;
  const projectedBudgetUsed = snapshot.budgetUsed + event.estimatedCost;

  if (policy.quotaUnits !== undefined && projectedQuotaUsed > policy.quotaUnits) reasons.push('QUOTA_EXCEEDED');
  if (policy.budgetLimit !== undefined && projectedBudgetUsed > policy.budgetLimit) reasons.push('BUDGET_EXCEEDED');
  if (policy.concurrencyLimit !== undefined && snapshot.concurrencyUsed >= policy.concurrencyLimit) reasons.push('CONCURRENCY_LIMIT_REACHED');
  if (policy.latencyLimitMs !== undefined && (event.durationMs ?? 0) > policy.latencyLimitMs) reasons.push('LATENCY_LIMIT_EXCEEDED');
  if (policy.maxEstimatedCostPerAction !== undefined && event.estimatedCost > policy.maxEstimatedCostPerAction) reasons.push('ACTION_COST_LIMIT_EXCEEDED');

  if (reasons.length > 0) {
    return {
      decision: 'DENY', policyVersion, reasons, estimatedCost: event.estimatedCost,
      projectedQuotaUsed, projectedBudgetUsed,
    };
  }

  if (input.isHighRisk || (policy.requireApprovalAboveCost !== undefined && event.estimatedCost > policy.requireApprovalAboveCost)) {
    return {
      decision: 'APPROVAL_REQUIRED', policyVersion,
      reasons: [input.isHighRisk ? 'HIGH_RISK_REQUIRES_APPROVAL' : 'COST_THRESHOLD_REQUIRES_APPROVAL'],
      estimatedCost: event.estimatedCost, projectedQuotaUsed, projectedBudgetUsed,
    };
  }

  return {
    decision: 'ALLOW', policyVersion, reasons: ['RESOURCE_POLICY_SATISFIED'],
    estimatedCost: event.estimatedCost, projectedQuotaUsed, projectedBudgetUsed,
  };
}

export function detectUsageAnomalies(
  current: UsageEvent,
  previous: UsageEvent[],
): UsageAnomalySignal[] {
  validateUsageEvent(current);
  const signals: UsageAnomalySignal[] = [];
  const sameOrg = previous.filter((item) => item.provenance.organizationId === current.provenance.organizationId);
  const foreignOrg = previous.some((item) => item.provenance.correlationId === current.provenance.correlationId && item.provenance.organizationId !== current.provenance.organizationId);

  if (foreignOrg) signals.push({ signalId: `${current.eventId}:cross-org`, severity: 'CRITICAL', code: 'CROSS_ORG_ATTRIBUTION', message: 'Correlation identity was observed across organizations.', provenance: current.provenance });
  if (current.estimatedCost > 0 && sameOrg.length > 0) {
    const average = sameOrg.reduce((sum, item) => sum + item.estimatedCost, 0) / sameOrg.length;
    if (average > 0 && current.estimatedCost >= average * 5) {
      signals.push({ signalId: `${current.eventId}:cost-spike`, severity: 'WARNING', code: 'COST_SPIKE', message: 'Current estimated cost is at least 5x the recent organization average.', provenance: current.provenance });
    }
  }
  if (current.durationMs !== undefined && previous.length > 0) {
    const durations = previous.map((item) => item.durationMs).filter((value): value is number => value !== undefined);
    if (durations.length > 0) {
      const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
      if (average > 0 && current.durationMs >= average * 5) {
        signals.push({ signalId: `${current.eventId}:latency-spike`, severity: 'WARNING', code: 'LATENCY_SPIKE', message: 'Current duration is at least 5x the recent average.', provenance: current.provenance });
      }
    }
  }
  return signals;
}

export function sanitizeUsageMetadata(metadata: Record<string, unknown> | undefined): Record<string, string | number | boolean> | undefined {
  if (!metadata) return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|password|credential|authorization|api[-_]?key/i.test(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') result[key] = value;
  }
  return result;
}
