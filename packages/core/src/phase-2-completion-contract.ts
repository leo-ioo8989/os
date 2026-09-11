export const PHASE_2_COMPLETION_VERSION='phase-2-governed-operating-loop-v1';
export const PHASE_2_BOUNDARY='PROPOSAL_ONLY';
export const PHASE_2_CHAIN=['OWNER_INTENT','LEO_EXECUTIVE','PLAN_PROPOSAL','WORKFORCE_SELECTION','DELEGATION','DURABLE_EXECUTION','OUTCOME_EVALUATION','EXECUTIVE_CONTINUATION','DURABLE_EXECUTIVE_HISTORY','OPERATING_EVENT','EXTERNAL_ACTION_PROPOSAL','PROACTIVE_WORK_PROPOSAL','SPEND_PROPOSAL','EXISTING_CONTROL_PLANE'] as const;
export type Phase2BoundaryNode=(typeof PHASE_2_CHAIN)[number];
export interface Phase2CompletionContract{version:string;authority:'PROPOSAL_ONLY';chain:readonly Phase2BoundaryNode[];noSecondExecutor:boolean;noSecondControlPlane:boolean;durableHistoryUsesExistingAudit:boolean;modelOutputUntrusted:boolean;approvalRequiredIsNotApprovalGranted:boolean;orgIsolationRequired:boolean;}
export function getPhase2CompletionContract():Phase2CompletionContract{return{version:PHASE_2_COMPLETION_VERSION,authority:'PROPOSAL_ONLY',chain:PHASE_2_CHAIN,noSecondExecutor:true,noSecondControlPlane:true,durableHistoryUsesExistingAudit:true,modelOutputUntrusted:true,approvalRequiredIsNotApprovalGranted:true,orgIsolationRequired:true}}
