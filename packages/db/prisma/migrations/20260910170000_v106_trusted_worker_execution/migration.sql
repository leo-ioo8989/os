-- V1.06 additive migration. No existing tables are renamed or dropped.
ALTER TYPE "JobStatus" ADD VALUE 'WAITING_APPROVAL';
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
CREATE TABLE "Worker" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL,
  "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE', "capabilities" JSONB NOT NULL, "permissionProfile" JSONB NOT NULL, "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastActivityAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Worker_pkey" PRIMARY KEY ("id"), CONSTRAINT "Worker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Worker_organizationId_status_idx" ON "Worker"("organizationId","status");
CREATE INDEX "Worker_organizationId_lastActivityAt_idx" ON "Worker"("organizationId","lastActivityAt");
CREATE TABLE "WorkerCredential" (
  "id" TEXT NOT NULL, "workerId" TEXT NOT NULL, "verifier" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), CONSTRAINT "WorkerCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerCredential_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkerCredential_workerId_revokedAt_idx" ON "WorkerCredential"("workerId","revokedAt");
CREATE INDEX "WorkerCredential_workerId_expiresAt_idx" ON "WorkerCredential"("workerId","expiresAt");
ALTER TABLE "Approval" ADD COLUMN "actionFingerprint" TEXT NOT NULL DEFAULT ''; 
ALTER TABLE "Approval" ADD COLUMN "policyVersion" TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE "Approval" ADD COLUMN "consumedAt" TIMESTAMP(3);
ALTER TABLE "Approval" ADD COLUMN "consumedFingerprint" TEXT;
CREATE INDEX "Approval_organizationId_actionFingerprint_status_idx" ON "Approval"("organizationId","actionFingerprint","status");
ALTER TABLE "Job" ADD COLUMN "workerIdentityId" TEXT;
CREATE INDEX "Job_organizationId_workerIdentityId_status_idx" ON "Job"("organizationId","workerIdentityId","status");
ALTER TABLE "Job" ADD CONSTRAINT "Job_workerIdentityId_fkey" FOREIGN KEY ("workerIdentityId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
