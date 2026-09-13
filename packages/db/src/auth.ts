import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PrismaClient } from '@prisma/client';
import type { Permission, Role } from '@founder-os/core';
import { hasPermission } from '@founder-os/core';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Password must contain at least 12 characters');
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, encodedKey] = encoded.split(':');
  if (scheme !== 'scrypt' || !salt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, 'base64url');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(db: PrismaClient, userId: string, ttlMs = 1000 * 60 * 60 * 24 * 7) {
  const token = randomBytes(32).toString('base64url');
  await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export async function authenticateSession(db: PrismaClient, token: string) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.deleteMany({ where: { id: session.id, expiresAt: { lte: new Date() } } });
    return null;
  }
  await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return session.user;
}

export async function authorizeOrganization(
  db: PrismaClient,
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<{ allowed: boolean; role?: Role }> {
  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
  if (!membership) return { allowed: false };
  return { allowed: hasPermission(membership.role, permission), role: membership.role };
}
