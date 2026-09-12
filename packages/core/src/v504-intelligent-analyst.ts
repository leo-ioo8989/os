export const V504_VERSION='5.04';
import type {KnowledgeItem} from './v502-knowledge-retrieval.js';
export interface Analysis{question:string;findings:string[];evidenceIds:string[];uncertainties:string[];provenance:{organizationId:string;actorId:string;createdAt:string};}
export function analyze(question:string,evidence:KnowledgeItem[],organizationId:string,actorId:string):Analysis{if(!question.trim()||!organizationId||!actorId)throw new Error('invalid analysis context');const scoped=evidence.filter(x=>x.organizationId===organizationId);return {question,findings:scoped.map(x=>x.content),evidenceIds:scoped.map(x=>x.id),uncertainties:scoped.length?'[]':['insufficient evidence'],provenance:{organizationId,actorId,createdAt:new Date().toISOString()}};}
