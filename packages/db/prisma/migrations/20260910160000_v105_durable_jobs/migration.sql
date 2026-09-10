-- V1.05 additive migration. Existing tables are intentionally untouched.
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_QUEUED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "objectiveId" TEXT,
  "taskId" TEXT,
  "workflowId" TEXT,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptNumber" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "workerId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "failureRetryable" BOOLEAN,
  "nextRetryAt" TIMESTAMP(3),
  "resumableState" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Job_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Job_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Job_organizationId_status_priority_createdAt_idx" ON "Job"("organizationId", "status", "priority", "createdAt");
CREATE INDEX "Job_organizationId_workerId_status_idx" ON "Job"("organizationId", "workerId", "status");
CREATE INDEX "Job_organizationId_leaseExpiresAt_idx" ON "Job"("organizationId", "leaseExpiresAt");
CREATE INDEX "Job_objectiveId_status_idx" ON "Job"("objectiveId", "status");
CREATE INDEX "Job_taskId_status_idx" ON "Job"("taskId", "status");
CREATE INDEX "Job_workflowId_status_idx" ON "Job"("workflowId", "status");

CREATE TABLE "Checkpoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Checkpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Checkpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Checkpoint_jobId_version_key" ON "Checkpoint"("jobId", "version");
CREATE INDEX "Checkpoint_organizationId_jobId_createdAt_idx" ON "Checkpoint"("organizationId", "jobId", "createdAt");
