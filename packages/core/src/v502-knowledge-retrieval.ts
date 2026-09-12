export const V502_VERSION='5.02';
export interface KnowledgeItem{id:string;organizationId:string;content:string;classification:'PUBLIC_INTERNAL'|'CONFIDENTIAL'|'RESTRICTED';sourceId:string;version:number;}
export interface RetrievalQuery{organizationId:string;actorId:string;query:string;allowedClassifications:KnowledgeItem['classification'][];}
export function retrieveKnowledge(items:KnowledgeItem[],q:RetrievalQuery):KnowledgeItem[]{if(!q.organizationId||!q.actorId||!q.query.trim())throw new Error('invalid retrieval context');return items.filter(i=>i.organizationId===q.organizationId&&q.allowedClassifications.includes(i.classification)&&i.content.toLowerCase().includes(q.query.toLowerCase())).map(i=>structuredClone(i));}
