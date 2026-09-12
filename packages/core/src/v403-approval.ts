import type { Provenance } from './phase4-operationalization.js';
export const V403_VERSION='4.03.0';
export type ApprovalStatus='PENDING'|'APPROVED'|'REJECTED'|'EXPIRED'|'CANCELLED';
export interface ApprovalRequest { id:string; provenance:Provenance; requestedBy:string; requiredScope:string; risk:'GREEN'|'YELLOW'|'RED'|'CRITICAL'; status:ApprovalStatus; expiresAt:string; evidence:string[]; }
export function createApproval(input:Omit<ApprovalRequest,'status'>):ApprovalRequest { if(!input.id||!input.requestedBy||!input.requiredScope||input.evidence.some(e=>!e)) throw new Error('V403_INVALID_APPROVAL'); if(new Date(input.expiresAt).getTime()<=Date.now()) throw new Error('V403_EXPIRY_INVALID'); return {...structuredClone(input),status:'PENDING'}; }
export function decideApproval(a:ApprovalRequest, approved:boolean, actorId:string):ApprovalRequest { if(a.status!=='PENDING') throw new Error('V403_NOT_PENDING'); if(!actorId||actorId===a.requestedBy) throw new Error('V403_INVALID_APPROVER'); return {...a,status:approved?'APPROVED':'REJECTED',evidence:[...a.evidence,`decision:${actorId}:${approved}`]}; }
