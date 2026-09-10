import type { IncomingHttpHeaders } from 'node:http';
import type { PrismaClient, Role } from '@prisma/client';
import type { Permission } from '@founder-os/core';
import { hasPermission } from '@founder-os/core';
import { authenticateSession } from '@founder-os/db';
import { ApiError } from './errors.js';
export interface AuthContext { userId: string; email: string; organizationId: string; role: Role; }
function header(headers: IncomingHttpHeaders, name: string): string | undefined { const value = headers[name]; return Array.isArray(value) ? value[0] : value; }
function sessionToken(headers: IncomingHttpHeaders): string | undefined {
  const authorization = header(headers, 'authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim() || undefined;
  const cookie = header(headers, 'cookie');
  const leoMatch = cookie?.match(/(?:^|;\s*)leo_os_session=([^;]+)/);
  if (leoMatch?.[1]) return decodeURIComponent(leoMatch[1]);
  // Compatibility: preserve existing sessions during the identity-only rename.
  const legacyMatch = cookie?.match(/(?:^|;\s*)founder_os_session=([^;]+)/);
  return legacyMatch?.[1] ? decodeURIComponent(legacyMatch[1]) : undefined;
}
export async function authenticateRequest(db: PrismaClient, headers: IncomingHttpHeaders): Promise<{ userId: string; email: string }> {
  const token = sessionToken(headers);
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const user = await authenticateSession(db, token);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return { userId: user.id, email: user.email };
}
export function selectMembership(memberships: Array<{ organizationId: string; role: Role }>, requested?: string) {
  if (!memberships.length) return undefined;
  if (requested) return memberships.find((item) => item.organizationId === requested);
  return memberships.length === 1 ? memberships[0] : undefined;
}
export async function requireOrganization(db: PrismaClient, headers: IncomingHttpHeaders, permission: Permission): Promise<AuthContext> {
  const user = await authenticateRequest(db, headers);
  const memberships = await db.membership.findMany({ where: { userId: user.userId }, select: { organizationId: true, role: true } });
  const membership = selectMembership(memberships, header(headers, 'x-organization-id'));
  if (!membership) throw new ApiError(403, 'UNAUTHORIZED', 'Organization access is not authorized.');
  if (!hasPermission(membership.role, permission)) throw new ApiError(403, 'UNAUTHORIZED', 'This action is not authorized.');
  return { userId: user.userId, email: user.email, organizationId: membership.organizationId, role: membership.role };
}
