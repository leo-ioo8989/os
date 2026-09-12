import type { IdentityContext } from './v402-identity-admin.js';
export const V411_VERSION='4.11.0';
export type DataClass='PUBLIC'|'INTERNAL'|'CONFIDENTIAL'|'RESTRICTED';
export function classifyData(value:unknown):DataClass{const text=JSON.stringify(value)??'';if(/password|secret|private.?key|api.?key|credential/i.test(text))return 'RESTRICTED';if(/financial|contract|customer/i.test(text))return 'CONFIDENTIAL';return 'INTERNAL';}
export function enforceSecurityBoundary(identity:IdentityContext,requiredScope:string):boolean{if(!identity.userId||!identity.organizationId||!identity.sessionId)return false;return identity.scopes.includes(requiredScope);}
export function sanitizeSecret(value:string):string{return value.length<8?'[REDACTED]':`${value.slice(0,2)}…${value.slice(-2)}`;}
export interface SecurityEvent{id:string;type:'ACCESS_DENIED'|'PRIVILEGE_CHANGE'|'SECRET_BOUNDARY'|'SECURITY_ALERT';organizationId:string;actorId:string;timestamp:string;reason:string;}
export function validateSecurityEvent(e:SecurityEvent):SecurityEvent{if(!e.id||!e.organizationId||!e.actorId||!e.reason)throw new Error('V411_SECURITY_EVENT_INVALID');return structuredClone(e);}
