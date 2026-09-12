export const V507_VERSION='5.07';
export interface AgentBounds{maxSteps:number;maxDepth:number;maxCost:number;allowedCapabilities:string[];requiresApprovalForSideEffects:boolean;}
export interface AgentProposal{agentId:string;objectiveId:string;steps:string[];capabilities:string[];bounds:AgentBounds;}
export function validateAgentProposal(p:AgentProposal):void{if(!p.agentId||!p.objectiveId||p.steps.length>p.bounds.maxSteps||p.steps.length===0||p.bounds.maxDepth<1||p.bounds.maxCost<0)throw new Error('agent bounds violation');if(p.capabilities.some(c=>!p.bounds.allowedCapabilities.includes(c)))throw new Error('capability denied');}
export function authorizeAgentStep(p:AgentProposal,index:number):boolean{validateAgentProposal(p);return index>=0&&index<p.steps.length;}
