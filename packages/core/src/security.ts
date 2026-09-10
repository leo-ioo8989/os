export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export type PermissionDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

export interface ActionIntent {
  organizationId: string;
  actorId: string;
  agentId: string;
  toolId: string;
  action: string;
  target: string;
  risk: RiskLevel;
  environment: 'development' | 'staging' | 'production';
  approvalId?: string;
}

/**
 * Baseline safety invariant. This is deliberately small and deterministic;
 * richer policy evaluation will be added in Phase 4.
 */
export function baselinePermission(intent: ActionIntent): PermissionDecision {
  if (intent.risk === 'RED') return 'DENY';
  if (intent.risk === 'YELLOW' && !intent.approvalId) return 'REQUIRE_APPROVAL';
  return 'ALLOW';
}
