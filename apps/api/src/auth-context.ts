import type { IncomingHttpHeaders } from 'node:http';
import type { PrismaClient, Role } from '@prisma/client';
import type { Permission } from '@founder-os/core';
import { hasPermission } from '@founder-os/core';
import { authenticateSession } from '@founder-os/db';
import { ApiError } from './errors.js';

export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  role: Role;
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sessionToken(headers: IncomingHttpHeaders): string | undefined {
  const authorization = header(headers, 'authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim() || undefined;
  const cookie = header(headers, 'cookie');
  const match = cookie?.match(/(?:^|;\\s*)founder_os_session=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function authenticateRequest(db: PrismaClient, headers: IncomingHttpHeaders): Promise<{ userId: string; email: string }> {
  const token = sessionToken(headers);
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const user = await authenticateSession(db, token);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return { userId: user.id, email: user.email };
}

export async function requireOrganization(
  db: PrismaClient,
  headers: IncomingHttpHeaders,
  permission: Permission,
): Promise<AuthContext> {
  const user = await authenticateRequest(db, headers);
  const memberships = await db.membership.findMany({
    where: { userId: user.userId },
    select: { organizationId: true, role: true },
  });
  if (memberships.length === 0) throw new ApiError(403, 'UNAUTHORIZED', 'No organization membership is active.');

  const requested = header(headers, 'x-organization-id');
  const membership = requested
    ? memberships.find((item) => item.organizationId === requested)
    : memberships.length === 1 ? memberships[0] : undefined;
  if (!membership) throw new ApiError(403, 'UNAUTHORIZED', 'Organization access is not authorized.');
  if (!hasPermission(membership.role, permission)) throw new ApiError(403, 'UNAUTHORIZED', 'This action is not authorized.');

  return { userId: user.userId, email: user.email, organizationId: membership.organizationId, role: membership.role };
}
