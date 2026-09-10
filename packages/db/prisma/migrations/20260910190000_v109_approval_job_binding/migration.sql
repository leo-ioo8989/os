-- V1.09 additive migration. Existing compatibility identifiers and historical migrations are preserved.
ALTER TABLE "Approval" ADD COLUMN "jobId" TEXT;
CREATE INDEX "Approval_organizationId_jobId_status_idx" ON "Approval"("organizationId","jobId","status");
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
