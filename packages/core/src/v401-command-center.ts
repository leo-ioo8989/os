import { validateProvenance, type Provenance, type OperationalStatus } from './phase4-operationalization.js';
export const V401_VERSION='4.01.0';
export interface CommandCenterSnapshot { provenance: Provenance; activeObjectives:number; activeTasks:number; approvalsPending:number; alerts:number; executions:number; health:'HEALTHY'|'DEGRADED'|'UNAVAILABLE'; auditAvailable:boolean; }
export function buildCommandCenterSnapshot(input: CommandCenterSnapshot): CommandCenterSnapshot { validateProvenance(input.provenance); if(input.activeObjectives<0||input.activeTasks<0||input.approvalsPending<0||input.alerts<0||input.executions<0) throw new Error('V401_INVALID_COUNTS'); return structuredClone(input); }
export function canDisplay(snapshot: CommandCenterSnapshot): boolean { return snapshot.auditAvailable && snapshot.health !== 'UNAVAILABLE'; }
export type CommandCenterStatus=OperationalStatus;
