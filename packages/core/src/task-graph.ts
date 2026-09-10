export const TASK_STATUSES = [
  'PENDING',
  'READY',
  'RUNNING',
  'WAITING_APPROVAL',
  'BLOCKED',
  'FAILED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskRisk = 'GREEN' | 'YELLOW' | 'RED';

export interface TaskNode {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  assignedAgentId?: string;
  riskLevel: TaskRisk;
  estimatedCost?: number;
  actualCost: number;
  retryCount: number;
  retryLimit: number;
  metadata: Record<string, unknown>;
}

export interface TaskGraph {
  tasks: TaskNode[];
}

export interface GraphAnalysis {
  ready: TaskNode[];
  blocked: TaskNode[];
  waiting: TaskNode[];
  running: TaskNode[];
  completed: TaskNode[];
  terminal: TaskNode[];
}

export class TaskGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskGraphError';
  }
}

function indexTasks(tasks: TaskNode[]): Map<string, TaskNode> {
  const index = new Map<string, TaskNode>();
  for (const task of tasks) {
    if (index.has(task.id)) throw new TaskGraphError(`Duplicate task id: ${task.id}`);
    index.set(task.id, task);
  }
  return index;
}

/** Validates references, self-dependencies, duplicate edges, and dependency cycles. */
export function validateTaskGraph(graph: TaskGraph): void {
  const index = indexTasks(graph.tasks);

  for (const task of graph.tasks) {
    const seen = new Set<string>();
    for (const dependencyId of task.dependencies) {
      if (!index.has(dependencyId)) {
        throw new TaskGraphError(`Task ${task.id} depends on missing task ${dependencyId}`);
      }
      if (dependencyId === task.id) {
        throw new TaskGraphError(`Task ${task.id} cannot depend on itself`);
      }
      if (seen.has(dependencyId)) {
        throw new TaskGraphError(`Task ${task.id} contains duplicate dependency ${dependencyId}`);
      }
      seen.add(dependencyId);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (taskId: string): void => {
    if (visiting.has(taskId)) throw new TaskGraphError(`Dependency cycle detected at task ${taskId}`);
    if (visited.has(taskId)) return;

    visiting.add(taskId);
    const task = index.get(taskId);
    if (!task) throw new TaskGraphError(`Unknown task ${taskId}`);
    for (const dependencyId of task.dependencies) visit(dependencyId);
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const task of graph.tasks) visit(task.id);
}

function isFailedDependency(status: TaskStatus): boolean {
  return status === 'FAILED' || status === 'CANCELLED' || status === 'BLOCKED';
}

/** Returns tasks that can execute now without violating dependency ordering. */
export function getReadyTasks(graph: TaskGraph): TaskNode[] {
  validateTaskGraph(graph);
  const index = indexTasks(graph.tasks);

  return graph.tasks.filter((task) => {
    if (task.status !== 'PENDING' && task.status !== 'READY') return false;
    return task.dependencies.every((dependencyId) => index.get(dependencyId)?.status === 'COMPLETED');
  });
}

/** A task is blocked when at least one dependency can no longer complete successfully. */
export function getBlockedTasks(graph: TaskGraph): TaskNode[] {
  validateTaskGraph(graph);
  const index = indexTasks(graph.tasks);

  return graph.tasks.filter((task) => {
    if (['COMPLETED', 'CANCELLED', 'FAILED', 'BLOCKED', 'RUNNING', 'WAITING_APPROVAL'].includes(task.status)) {
      return false;
    }
    return task.dependencies.some((dependencyId) => isFailedDependency(index.get(dependencyId)?.status ?? 'BLOCKED'));
  });
}

export function analyzeTaskGraph(graph: TaskGraph): GraphAnalysis {
  const ready = getReadyTasks(graph);
  const blocked = getBlockedTasks(graph);
  const readyIds = new Set(ready.map((task) => task.id));
  const blockedIds = new Set(blocked.map((task) => task.id));

  const waiting = graph.tasks.filter((task) => task.status === 'WAITING_APPROVAL');
  const running = graph.tasks.filter((task) => task.status === 'RUNNING');
  const completed = graph.tasks.filter((task) => task.status === 'COMPLETED');
  const terminal = graph.tasks.filter((task) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status));

  return {
    ready: ready.filter((task) => !blockedIds.has(task.id)),
    blocked,
    waiting,
    running,
    completed,
    terminal,
  };
}

/** Returns a deterministic execution wave; tasks in a wave have no unmet dependencies. */
export function getExecutionWaves(graph: TaskGraph): TaskNode[][] {
  validateTaskGraph(graph);
  const remaining = new Map(graph.tasks.map((task) => [task.id, task]));
  const completed = new Set<string>(graph.tasks.filter((task) => task.status === 'COMPLETED').map((task) => task.id));
  const waves: TaskNode[][] = [];

  while (remaining.size > 0) {
    const wave = [...remaining.values()].filter(
      (task) => task.status === 'PENDING' || task.status === 'READY',
    ).filter((task) => task.dependencies.every((dependencyId) => completed.has(dependencyId)));

    if (wave.length === 0) break;

    waves.push(wave);
    for (const task of wave) {
      completed.add(task.id);
      remaining.delete(task.id);
    }
  }

  return waves;
}
