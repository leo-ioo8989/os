import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateSession, hashSessionToken } from '../src/auth.js';

function fakeDb(session: { expiresAt: Date; user: { id: string; email: string } } | null) {
  return {
    session: {
      findUnique: async () => session ? { id: 'session-1', ...session } : null,
      update: async () => undefined,
    },
  } as never;
}
test('invalid session token is rejected', async () => {
  assert.equal(await authenticateSession(fakeDb(null), 'invalid'), null);
});
test('expired session is rejected', async () => {
  assert.equal(await authenticateSession(fakeDb({ expiresAt: new Date(Date.now() - 1000), user: { id: 'u1', email: 'u@example.com' } }), 'expired'), null);
});
test('valid persistent session is accepted and token is never stored raw', async () => {
  const user = { id: 'u1', email: 'u@example.com' };
  assert.deepEqual(await authenticateSession(fakeDb({ expiresAt: new Date(Date.now() + 60_000), user }), 'valid-token'), user);
  assert.equal(hashSessionToken('valid-token').length, 64);
});
