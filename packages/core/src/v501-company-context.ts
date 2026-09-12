export const V501_VERSION='5.01';
export type ContextNodeType='ORG'|'PERSON'|'TEAM'|'PROJECT'|'OBJECTIVE'|'TASK'|'DOCUMENT'|'SYSTEM'|'DECISION';
export interface ContextNode{id:string;organizationId:string;type:ContextNodeType;label:string;provenance:{source:string;actorId?:string;timestamp:string};}
export interface ContextEdge{from:string;to:string;type:string;organizationId:string;provenance:{source:string;timestamp:string};}
export interface CompanyContextGraph{organizationId:string;nodes:ContextNode[];edges:ContextEdge[];version:number;}
export function validateContextGraph(g:CompanyContextGraph):void{if(!g.organizationId||g.version<1)throw new Error('invalid graph');const ids=new Set(g.nodes.map(n=>n.id));if(ids.size!==g.nodes.length)throw new Error('duplicate node');for(const n of g.nodes)if(n.organizationId!==g.organizationId)throw new Error('organization mismatch');for(const e of g.edges)if(e.organizationId!==g.organizationId||!ids.has(e.from)||!ids.has(e.to))throw new Error('invalid edge');}
export function upsertContextNode(g:CompanyContextGraph,n:ContextNode):CompanyContextGraph{validateContextGraph(g);if(n.organizationId!==g.organizationId)throw new Error('organization mismatch');const nodes=g.nodes.filter(x=>x.id!==n.id);return {...g,nodes:[...nodes,structuredClone(n)],version:g.version+1};}
