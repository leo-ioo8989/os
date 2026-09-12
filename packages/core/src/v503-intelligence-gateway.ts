export const V503_VERSION='5.03';
export interface IntelligenceRequest{organizationId:string;actorId:string;objectiveId?:string;correlationId:string;prompt:string;maxTokens:number;providerHint?:string;}
export interface IntelligenceProposal{proposalId:string;provider:string;content:string;confidence:number;correlationId:string;provenance:{requestId:string;policyVersion:string;createdAt:string};}
export interface IntelligenceProvider{readonly name:string;propose(r:IntelligenceRequest):Promise<IntelligenceProposal>;}
export function validateIntelligenceRequest(r:IntelligenceRequest):void{if(!r.organizationId||!r.actorId||!r.correlationId||!r.prompt.trim()||r.maxTokens<1)throw new Error('invalid intelligence request');}
export async function requestIntelligence(p:IntelligenceProvider,r:IntelligenceRequest):Promise<IntelligenceProposal>{validateIntelligenceRequest(r);const x=await p.propose(r);if(x.correlationId!==r.correlationId||!x.provenance?.requestId)throw new Error('invalid intelligence provenance');return Object.freeze(structuredClone(x));}
