import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const marker = `v107-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;

try {
  await db.$queryRaw`SELECT 1`;
  const organization = await db.organization.create({ data: { name: marker } });
  const readBack = await db.organization.findUnique({ where: { id: organization.id } });
  assert.equal(readBack?.name, marker);
  await db.organization.delete({ where: { id: organization.id } });
  console.log('V1.07 PostgreSQL smoke test passed.');
} finally {
  await db.$disconnect();
}
