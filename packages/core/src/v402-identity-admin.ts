import { validateProvenance, type Authority, type Provenance } from './phase4-operationalization.js';
export const V402_VERSION='4.02.0';
export type AdminRole='OWNER'|'ADMIN'|'OPERATOR'|'VIEWER';
export interface RoleBinding { userId:string; organizationId:string; role:AdminRole; scopes:string[]; }
export interface IdentityContext { userId:string; organizationId:string; roles:AdminRole[]; scopes:string[]; sessionId:string; }
export function validateIdentity(i:IdentityContext):IdentityContext { if(!i.userId||!i.organizationId||!i.sessionId||i.roles.length===0) throw new Error('V402_IDENTITY_REQUIRED'); if(i.roles.includes('OWNER')&&i.scopes.length===0) throw new Error('V402_OWNER_SCOPE_REQUIRED'); return structuredClone(i); }
export function hasScope(i:IdentityContext,scope:string):boolean { validateIdentity(i); return i.scopes.includes(scope); }
export function adminAuthority(i:IdentityContext, provenance:Provenance):Authority { validateIdentity(i); validateProvenance(provenance); if(!i.roles.some(r=>r==='OWNER'||r==='ADMIN')) throw new Error('V402_ADMIN_REQUIRED'); return {authorityId:`admin:${i.userId}:${i.sessionId}`,policyVersion:'v4.02-identity-1',scope:[...i.scopes],privileged:true}; }
