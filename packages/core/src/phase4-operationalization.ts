export const PHASE4_VERSION = '4.0';
export const PHASE4_POLICY_VERSION = 'phase4-operationalization-1';
export type OperationalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type Risk = 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';

export interface Provenance { organizationId: string; actorId?: string; objectiveId?: string; taskId?: string; jobId?: string; correlationId: string; causationId?: string; }
export interface Authority { authorityId: string; policyVersion: string; scope: string[]; privileged: boolean; }
export interface OperationalContext { provenance: Provenance; authority: Authority; now: string; }
export interface Decision { decisionId: string; decision: 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED'; reason: string; authority: Authority; provenance: Provenance; }

export function validateProvenance(p: Provenance): Provenance {
  if (!p.organizationId || !p.correlationId) throw new Error('V4_PROVENANCE_REQUIRED');
  for (const [k, v] of Object.entries(p)) if (v !== undefined && typeof v !== 'string') throw new Error(`V4_INVALID_PROVENANCE_${k.toUpperCase()}`);
  return structuredClone(p);
}
export function validateAuthority(a: Authority): Authority {
  if (!a.authorityId || !a.policyVersion || !Array.isArray(a.scope)) throw new Error('V4_AUTHORITY_REQUIRED');
  if (a.scope.some((s) => !s || typeof s !== 'string')) throw new Error('V4_INVALID_AUTHORITY_SCOPE');
  return structuredClone(a);
}
export function authorize(ctx: OperationalContext, requiredScope: string, risk: Risk = 'GREEN'): Decision {
  const provenance = validateProvenance(ctx.provenance); const authority = validateAuthority(ctx.authority);
  if (!authority.scope.includes(requiredScope)) return { decisionId: `${provenance.correlationId}:deny`, decision: 'DENY', reason: 'SCOPE_NOT_GRANTED', authority, provenance };
  if ((risk === 'RED' || risk === 'CRITICAL') && !authority.privileged) return { decisionId: `${provenance.correlationId}:approval`, decision: 'APPROVAL_REQUIRED', reason: 'RISK_REQUIRES_APPROVAL', authority, provenance };
  return { decisionId: `${provenance.correlationId}:allow`, decision: 'ALLOW', reason: 'AUTHORIZED', authority, provenance };
}

export interface VersionHealth { version: string; status: OperationalStatus; checks: string[]; }
export function certifyVersion(version: string, checks: string[]): VersionHealth {
  if (!version || checks.length === 0 || checks.some((c) => !c.trim())) throw new Error('V4_CERTIFICATION_EVIDENCE_REQUIRED');
  return { version, status: 'COMPLETED', checks: [...checks] };
}
