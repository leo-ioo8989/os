import { validateProvenance, validateAuthority, type Authority, type Provenance } from './phase4-operationalization.js';
export const V406_VERSION='4.06.0';
export interface AuditRecord { id:string; timestamp:string; actorId:string; authority:Authority; provenance:Provenance; action:string; decision:string; reason:string; resourceUsage?:Record<string,number>; outcome?:string; parentAuditId?:string; }
export function appendAudit(r:AuditRecord):AuditRecord { if(!r.id||!r.timestamp||!r.actorId||!r.action||!r.decision||!r.reason)throw new Error('V406_AUDIT_FIELDS_REQUIRED');validateProvenance(r.provenance);validateAuthority(r.authority);return Object.freeze(structuredClone(r)); }
export function reconstructAudit(records:AuditRecord[],correlationId:string):AuditRecord[]{return records.filter(r=>r.provenance.correlationId===correlationId).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).map(appendAudit);}
