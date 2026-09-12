import { validateProvenance, type Provenance } from './phase4-operationalization.js';
export const V405_VERSION='4.05.0';
export interface DomainEvent<T=unknown>{eventId:string;type:string;version:number;occurredAt:string;provenance:Provenance;causationId?:string;correlationId:string;idempotencyKey:string;payload:T;}
export function validateEvent<T>(e:DomainEvent<T>):DomainEvent<T>{if(!e.eventId||!e.type||e.version<1||!e.occurredAt||!e.idempotencyKey||e.correlationId!==e.provenance.correlationId)throw new Error('V405_EVENT_INVALID');validateProvenance(e.provenance);return structuredClone(e);}
export function eventKey(e:DomainEvent):string{return `${e.provenance.organizationId}:${e.idempotencyKey}`;}
export function deduplicateEvents<T>(events:DomainEvent<T>[]):DomainEvent<T>[]{const seen=new Set<string>();return events.filter(e=>{validateEvent(e);const k=eventKey(e);if(seen.has(k))return false;seen.add(k);return true;}).map(e=>structuredClone(e));}
