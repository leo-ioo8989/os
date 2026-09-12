import { validateProvenance, type Provenance } from './phase4-operationalization.js';
export const V404_VERSION='4.04.0';
export type WorkflowState='PENDING'|'RUNNING'|'WAITING_APPROVAL'|'COMPLETED'|'FAILED'|'CANCELLED';
export interface WorkflowStep { id:string; dependsOn:string[]; requiredScope:string; }
export interface WorkflowInstance { id:string; provenance:Provenance; state:WorkflowState; completed:string[]; currentStep?:string; }
export function nextWorkflowStep(w:WorkflowInstance,steps:WorkflowStep[]):WorkflowStep|undefined { validateProvenance(w.provenance); const done=new Set(w.completed); const eligible=steps.filter(s=>!done.has(s.id)&&s.dependsOn.every(d=>done.has(d))).sort((a,b)=>a.id.localeCompare(b.id)); return eligible[0]; }
export function transitionWorkflow(w:WorkflowInstance,to:WorkflowState):WorkflowInstance { const allowed:Record<WorkflowState,WorkflowState[]>={PENDING:['RUNNING','CANCELLED'],RUNNING:['WAITING_APPROVAL','COMPLETED','FAILED','CANCELLED'],WAITING_APPROVAL:['RUNNING','CANCELLED'],COMPLETED:[],FAILED:['RUNNING','CANCELLED'],CANCELLED:[]}; if(!allowed[w.state].includes(to)) throw new Error('V404_INVALID_TRANSITION'); return {...w,state:to,completed:[...w.completed]}; }
