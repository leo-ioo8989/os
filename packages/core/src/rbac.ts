export const ROLES = ['FOUNDER', 'ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'objective:read',
  'objective:write',
  'task:read',
  'task:write',
  'workflow:run',
  'approval:decide',
  'integration:use',
  'integration:manage',
  'tool:execute',
  'production:deploy',
  'audit:read',
  'security:manage',
  'founder:control',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  FOUNDER: PERMISSIONS,
  ADMIN: [
    'objective:read', 'objective:write', 'task:read', 'task:write',
    'workflow:run', 'approval:decide', 'integration:use', 'integration:manage', 'tool:execute',
    'audit:read', 'security:manage',
  ],
  OPERATOR: [
    'objective:read', 'objective:write', 'task:read', 'task:write',
    'workflow:run', 'integration:use', 'tool:execute', 'audit:read',
  ],
  VIEWER: ['objective:read', 'task:read', 'audit:read'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
