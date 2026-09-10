export type ExecutionDecision = 'ALLOW' | 'DENY' | 'REQUIRES_APPROVAL';
export type ExecutionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface WorkerCapabilitySet { capabilities: readonly string[]; }
export interface ExecutionIntent {
  organizationId: string;
  workerId: string;
  action: string;
  target: string;
  risk: ExecutionRisk;
  parameters?: Record<string, unknown>;
  environment?: 'development' | 'staging' | 'production';
}

export const EXECUTION_RISK_POLICY = {
  LOW: 'ALLOW',
  MEDIUM: 'ALLOW',
  HIGH: 'REQUIRES_APPROVAL',
  CRITICAL: 'DENY',
} as const satisfies Record<ExecutionRisk, ExecutionDecision>;

export function classifyExecutionRisk(risk: ExecutionRisk): ExecutionRisk { return risk; }
export function hasWorkerCapability(worker: WorkerCapabilitySet, capability: string): boolean {
  return worker.capabilities.includes(capability);
}
export function decideExecution(risk: ExecutionRisk, capabilityAllowed: boolean, approvalValid = false): ExecutionDecision {
  if (!capabilityAllowed || risk === 'CRITICAL') return 'DENY';
  if (risk === 'HIGH' && !approvalValid) return 'REQUIRES_APPROVAL';
  return EXECUTION_RISK_POLICY[risk];
}
