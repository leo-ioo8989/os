import type { Provenance } from './phase4-operationalization.js';
export const V408_VERSION='4.08.0';
export interface AdapterCapability { name:string; risk:'GREEN'|'YELLOW'|'RED'|'CRITICAL'; sideEffects:boolean; requiredScope:string; }
export interface AdapterRequest<T=unknown>{requestId:string;provenance:Provenance;capability:string;input:T;timeoutMs:number;idempotencyKey:string;}
export interface AdapterResult<T=unknown>{requestId:string;ok:boolean;output?:T;error?:string;}
export interface IntegrationAdapter<T=unknown,R=unknown>{id:string;capabilities:readonly AdapterCapability[];execute(request:AdapterRequest<T>):Promise<AdapterResult<R>>;health():Promise<boolean>;}
export function validateAdapterRequest<T>(r:AdapterRequest<T>):AdapterRequest<T>{if(!r.requestId||!r.provenance.organizationId||!r.provenance.correlationId||!r.capability||r.timeoutMs<=0||!r.idempotencyKey)throw new Error('V408_REQUEST_INVALID');return structuredClone(r);}
