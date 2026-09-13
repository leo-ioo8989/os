import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, authenticateSession } from '../src/auth.js';

test('password hashing rejects short passwords and verifies valid passwords', async () => {
  await assert.rejects(() => hashPassword('short'), /at least 12/);
  const encoded = await hashPassword('a-strong-password');
  assert.equal(await verifyPassword('a-strong-password', encoded), true);
  assert.equal(await verifyPassword('wrong-password', encoded), false);
});

test('expired sessions are rejected and deleted', async () => {
  const expired = { id: 'session-1', tokenHash: '', expiresAt: new Date(Date.now() - 1000), user: { id: 'user-1' } };
  let deleted = false;
  const db = {
    session: {
      findUnique: async () => expired,
      deleteMany: async () => { deleted = true; return { count: 1 }; },
      update: async () => { throw new Error('expired session must not be updated'); },
    },
  } as any;
  assert.equal(await authenticateSession(db, 'expired-token'), null);
  assert.equal(deleted, true);
});

test('missing sessions are rejected without mutation', async () => {
  let deleted = false;
  const db = {
    session: {
      findUnique: async () => null,
      deleteMany: async () => { deleted = true; return { count: 0 }; },
      update: async () => { throw new Error('missing session must not be updated'); },
    },
  } as any;
  assert.equal(await authenticateSession(db, 'missing-token'), null);
  assert.equal(deleted, false);
});
