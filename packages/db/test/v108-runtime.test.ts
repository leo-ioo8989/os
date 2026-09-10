import test from 'node:test';

test('V1.08 PostgreSQL runtime suite requires DATABASE_URL', (t) => {
 if (!process.env.DATABASE_URL) t.skip('DATABASE_URL is required for PostgreSQL integration');
});
