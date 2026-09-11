import type { EmploymentType, WorkforceCapability, WorkforceContextScope, WorkforceRisk, WorkforceStatus } from './workforce.js';

export const WORKFORCE_LIFECYCLE_AUTHORITY = 'PROPOSAL_ONLY' as const;
export const WORKFORCE_LIFECYCLE_VERSION = 'deterministic-v1' as const;
export const WORKFORCE_LIFECYCLE_ACTIONS = ['CREATE_ROLE','ACTIVATE','SUSPEND','DEACTIVATE','UPDATE_SCOPE','RETIRE'] as const;
export type WorkforceLifecycleAction = (typeof WORKFORCE_LIFECYCLE_ACTIONS)[number];

export interface WorkforceLifecycleTarget {
  organizationId: string;
  roleId?: string;
  employeeId?: string;
  projectId?: string;
}

export interface WorkforceLifecycleProposal {
  proposalId: string;
  organizationId: string;
  target: WorkforceLifecycleTarget;
  action: WorkforceLifecycleAction;
  reason: string;
  risk: WorkforceRisk;
  currentStatus?: WorkforceStatus;
  proposedStatus?: WorkforceStatus;
  roleSnapshot?: {
    roleId: string;
    name: string;
    category: string;
    description: string;
    responsibilities: readonly string[];
    employmentType: EmploymentType;
    capabilityRequirements: readonly WorkforceCapability[];
    contextScope: WorkforceContextScope;
    expiresAt?: string;
  };
  authority: typeof WORKFORCE_LIFECYCLE_AUTHORITY;
  approvalRequired: boolean;
  provenance: { lifecycleVersion: typeof WORKFORCE_LIFECYCLE_VERSION; correlationId?: string };
}

const ACTIONS = new Set<string>(WORKFORCE_LIFECYCLE_ACTIONS);
const STATUSES = new Set<string>(['ACTIVE','INACTIVE','SUSPENDED','TEMPORARY','DEACTIVATED']);
const RISKS = new Set<string>(['LOW','MEDIUM','HIGH','CRITICAL']);

function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

export function validateWorkforceLifecycleProposal(value: unknown): asserts value is WorkforceLifecycleProposal {
  if (!value || typeof value !== 'object') throw new Error('Workforce lifecycle proposal is required.');
  const proposal = value as Record<string, unknown>;
  if (!nonEmpty(proposal.proposalId) || !nonEmpty(proposal.organizationId) || !nonEmpty(proposal.reason)) throw new Error('Workforce lifecycle identity and reason are required.');
  if (!ACTIONS.has(String(proposal.action))) throw new Error('Invalid workforce lifecycle action.');
  if (!RISKS.has(String(proposal.risk))) throw new Error('Invalid workforce lifecycle risk.');
  if (proposal.authority !== WORKFORCE_LIFECYCLE_AUTHORITY) throw new Error('Workforce lifecycle proposals must remain proposal-only.');
  if (typeof proposal.approvalRequired !== 'boolean') throw new Error('Workforce lifecycle approval semantics are required.');
  if (!proposal.target || typeof proposal.target !== 'object') throw new Error('Workforce lifecycle target is required.');
  const target = proposal.target as Record<string, unknown>;
  if (target.organizationId !== proposal.organizationId || (!nonEmpty(target.roleId) && !nonEmpty(target.employeeId))) throw new Error('Workforce lifecycle target must be organization-bound and identify a role or employee.');
  if (proposal.currentStatus !== undefined && !STATUSES.has(String(proposal.currentStatus))) throw new Error('Invalid current workforce status.');
  if (proposal.proposedStatus !== undefined && !STATUSES.has(String(proposal.proposedStatus))) throw new Error('Invalid proposed workforce status.');
  if (!proposal.provenance || typeof proposal.provenance !== 'object') throw new Error('Workforce lifecycle provenance is required.');
  const provenance = proposal.provenance as Record<string, unknown>;
  if (provenance.lifecycleVersion !== WORKFORCE_LIFECYCLE_VERSION || (provenance.correlationId !== undefined && !nonEmpty(provenance.correlationId))) throw new Error('Invalid workforce lifecycle provenance.');
  for (const key of ['grantedPermissions','grantedCapabilities','approvalGranted','workerId','credentialId','execute','dispatch','externalAction','permissionGrant','capabilityGrant','authorization','spend','delete']) {
    if (JSON.stringify(value).includes(`\"${key}\"`)) throw new Error(`Workforce lifecycle proposal contains forbidden authority field: ${key}`);
  }
}

export function buildWorkforceLifecycleProposal(input: Omit<WorkforceLifecycleProposal, 'authority' | 'provenance'> & { correlationId?: string }): WorkforceLifecycleProposal {
  const proposal: WorkforceLifecycleProposal = {
    ...input,
    authority: WORKFORCE_LIFECYCLE_AUTHORITY,
    provenance: { lifecycleVersion: WORKFORCE_LIFECYCLE_VERSION, ...(input.correlationId ? { correlationId: input.correlationId } : {}) },
  };
  validateWorkforceLifecycleProposal(proposal);
  return proposal;
}
