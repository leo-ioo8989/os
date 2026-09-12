import type { OperationalJobStatus } from './v409-execution-operations.js';
export const V410_VERSION='4.10.0';
export type IncidentSeverity='INFO'|'WARNING'|'CRITICAL';
export interface Incident { id:string; severity:IncidentSeverity; code:string; detectedAt:string; status:'OPEN'|'MITIGATED'|'CLOSED'; correlationId:string; evidence:string[]; }
export function classifyFailure(error:string):IncidentSeverity { if(/auth|provenance|security|credential/i.test(error))return 'CRITICAL';if(/timeout|database|queue/i.test(error))return 'WARNING';return 'INFO'; }
export function recoverable(status:OperationalJobStatus):boolean{return status==='FAILED'||status==='DEAD_LETTER';}
export function safeShutdown(active:boolean):'DRAIN'|'STOP' { return active?'DRAIN':'STOP'; }
export function createIncident(i:Omit<Incident,'status'>):Incident{if(!i.id||!i.code||!i.correlationId||i.evidence.length===0)throw new Error('V410_INCIDENT_EVIDENCE_REQUIRED');return {...structuredClone(i),status:'OPEN'};}
