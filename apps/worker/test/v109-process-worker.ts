import { PrismaClient, JobRepository } from '@founder-os/db';

const [organizationId, jobId, workerId] = process.argv.slice(2);
const db = new PrismaClient();
const repository = new JobRepository(db);

if (!organizationId || !jobId || !workerId) {
  process.exitCode = 2;
} else {
  const result = await repository.claim(organizationId, jobId, workerId, 60000, {
    organizationId,
    actorType: 'SYSTEM',
    eventType: 'job.claimed',
    action: 'process_fixture_claim',
    result: 'SUCCESS',
  });
  if (result.kind !== 'claimed') {
    console.error(`CLAIM_FAILED:${result.kind}`);
    process.exitCode = 3;
  } else {
    console.log('CLAIMED');
    setInterval(() => undefined, 1000);
  }
}

process.on('SIGTERM', async () => {
  await db.$disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await db.$disconnect();
  process.exit(0);
});
