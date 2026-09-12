export const V510_VERSION='5.10';
export interface Evaluation{runId:string;organizationId:string;targetId:string;metrics:Record<string,number>;passed:boolean;provenance:{evaluator:string;createdAt:string};}
export interface OptimizationProposal{targetId:string;changes:Record<string,string|number|boolean>;expectedImpact:number;requiresApproval:boolean;}
export function evaluate(runId:string,organizationId:string,targetId:string,metrics:Record<string,number>,thresholds:Record<string,number>):Evaluation{const passed=Object.entries(thresholds).every(([k,v])=>metrics[k]!==undefined&&metrics[k]>=v);return {runId,organizationId,targetId,metrics:{...metrics},passed,provenance:{evaluator:'leo-os-v510',createdAt:new Date().toISOString()}};}
export function proposeOptimization(p:OptimizationProposal):OptimizationProposal{if(!p.targetId||!Number.isFinite(p.expectedImpact))throw new Error('invalid optimization');return structuredClone({...p,requiresApproval:true});}
