export const OBJECTIVE_STATUSES = [
  'DRAFT',
  'PLANNING',
  'READY',
  'RUNNING',
  'WAITING_APPROVAL',
  'BLOCKED',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface Objective {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  createdBy: string;
  priority: Priority;
  status: ObjectiveStatus;
  riskLevel: RiskLevel;
  budget?: number;
  estimatedCost?: number;
  actualCost: number;
  successCriteria: string[];
  deadline?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  currentPhase?: string;
  metadata: Record<string, unknown>;
}

export function canStartObjective(objective: Objective): boolean {
  return objective.status === 'READY' && (objective.budget === undefined || objective.budget >= 0);
}

export function isTerminalObjectiveStatus(status: ObjectiveStatus): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
}
