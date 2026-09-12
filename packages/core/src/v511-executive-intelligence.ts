export const V511_VERSION='5.11';
export interface ExecutiveBrief{organizationId:string;period:string;signals:string[];decisions:string[];risks:string[];recommendedActions:string[];provenance:{generatedAt:string;evidenceIds:string[]};}
export function buildExecutiveBrief(input:Omit<ExecutiveBrief,'provenance'>&{evidenceIds:string[]}):ExecutiveBrief{if(!input.organizationId||!input.period)throw new Error('invalid executive context');return {...input,provenance:{generatedAt:new Date().toISOString(),evidenceIds:[...input.evidenceIds]}};}
