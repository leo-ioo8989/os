import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { founderOsPrisma?: PrismaClient };

export const db = globalForPrisma.founderOsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.founderOsPrisma = db;
}
