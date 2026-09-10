-- V1.07 additive migration. No existing tables/compatibility identifiers are renamed or dropped.
ALTER TYPE "WorkflowStatus" ADD VALUE 'BLOCKED';
ALTER TABLE "Workflow" ADD COLUMN "currentJobId" TEXT;
ALTER TABLE "Job" ADD COLUMN "idempotencyKey" TEXT;
CREATE INDEX "Workflow_currentJobId_idx" ON "Workflow"("currentJobId");
CREATE UNIQUE INDEX "Job_organizationId_idempotencyKey_key" ON "Job"("organizationId","idempotencyKey");
