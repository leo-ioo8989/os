export const V509_VERSION='5.09';
export interface AutonomousWorkflow{workflowId:string;organizationId:string;trigger:string;steps:string[];maxConcurrent:number;requiresApproval:boolean;enabled:boolean;}
export function validateAutonomousWorkflow(w:AutonomousWorkflow){if(!w.workflowId||!w.organizationId||!w.trigger||!w.steps.length||w.maxConcurrent<1)throw new Error('invalid autonomous workflow');if(w.steps.length>100)throw new Error('workflow bound exceeded');}
export function shouldStart(w:AutonomousWorkflow,authorized:boolean){validateAutonomousWorkflow(w);return w.enabled&&authorized;}
