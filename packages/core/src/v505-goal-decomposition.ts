export const V505_VERSION = '5.05';
export interface Goal { organizationId: string; objectiveId: string; description: string; maxDepth: number; maxTasks: number; }
export interface DecomposedGoalTask { id: string; parentObjectiveId: string; description: string; depth: number; }
export function decomposeGoal(g: Goal): DecomposedGoalTask[] {
  if (g.maxDepth < 1 || g.maxTasks < 1 || !g.organizationId || !g.objectiveId) throw new Error('invalid bounds');
  const n = Math.min(g.maxTasks, Math.max(1, g.description.split(/\s+/).length));
  return Array.from({ length: n }, (_, i) => ({ id: `${g.objectiveId}:p${i + 1}`, parentObjectiveId: g.objectiveId, description: `Investigate/advance: ${g.description}`, depth: 1 }));
}
