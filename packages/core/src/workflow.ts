export const WORKFLOW_STATUSES = ['PENDING','RUNNING','WAITING_APPROVAL','PAUSED','BLOCKED','COMPLETED','FAILED','CANCELLED'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  PENDING: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING_APPROVAL', 'PAUSED', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING_APPROVAL: ['RUNNING', 'PAUSED', 'FAILED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  BLOCKED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['RUNNING', 'CANCELLED'],
  CANCELLED: [],
};

export function canTransitionWorkflow(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

export interface DeterministicTaskCandidate {
  id: string;
  dependencies: string[];
  status: string;
}

/** Stable policy: only dependency-ready tasks participate; ties are resolved by task id. */
export function selectNextTask<T extends DeterministicTaskCandidate>(tasks: readonly T[]): T | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ready = tasks.filter((task) => {
    if (task.status !== 'PENDING' && task.status !== 'READY') return false;
    return task.dependencies.every((dependencyId) => byId.get(dependencyId)?.status === 'COMPLETED');
  });
  ready.sort((a, b) => a.id.localeCompare(b.id));
  return ready[0] ?? null;
}
