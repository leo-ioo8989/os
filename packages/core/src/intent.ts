export interface OwnerIntent {
  intentId: string;
  organizationId: string;
  ownerUserId: string;
  businessContext?: string;
  projectContext?: string;
  requestedOutcome: string;
  context?: Record<string, unknown>;
  constraints: readonly string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requestedDeadline?: string;
  requestedBudget?: number;
  riskRequirements: readonly string[];
  createdAt: string;
  correlationId: string;
}

export function createOwnerIntent(input: OwnerIntent): OwnerIntent {
  if (!input.intentId || !input.organizationId || !input.ownerUserId || !input.requestedOutcome || !input.createdAt || !input.correlationId) {
    throw new Error('Owner intent is missing required identity or outcome fields');
  }
  if (!Number.isFinite(input.requestedBudget ?? 0) || (input.requestedBudget ?? 0) < 0) {
    throw new Error('Owner intent budget must be a non-negative finite number');
  }
  return {
    ...input,
    constraints: [...input.constraints],
    riskRequirements: [...input.riskRequirements],
    context: input.context ? { ...input.context } : undefined,
  };
}
