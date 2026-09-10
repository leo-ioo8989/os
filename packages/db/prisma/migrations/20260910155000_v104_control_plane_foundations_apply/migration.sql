-- V1.04 control-plane foundations, applied after the initial control-plane
-- and auth/RBAC migrations so all referenced base tables already exist.
-- The guard preserves compatibility with any environment where the legacy
-- V1.04 migration was already applied before this migration was introduced.
DO $$
BEGIN
  IF to_regclass('"AuditEvent"') IS NULL THEN
    CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');
    CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
    CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

    CREATE TABLE "AuditEvent" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "actorId" TEXT,
      "actorType" "ActorType" NOT NULL,
      "eventType" TEXT NOT NULL,
      "resourceType" TEXT,
      "resourceId" TEXT,
      "action" TEXT NOT NULL,
      "result" "AuditResult" NOT NULL,
      "metadata" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
    CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
    CREATE INDEX "AuditEvent_organizationId_resourceType_resourceId_createdAt_idx" ON "AuditEvent"("organizationId", "resourceType", "resourceId", "createdAt");
    CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
    CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

    CREATE TABLE "Approval" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "requesterId" TEXT,
      "requesterAgentId" TEXT,
      "targetResourceType" TEXT,
      "targetResourceId" TEXT,
      "action" TEXT NOT NULL,
      "riskLevel" "RiskLevel" NOT NULL,
      "reason" TEXT NOT NULL,
      "evidence" JSONB NOT NULL,
      "estimatedCost" DECIMAL(18,6),
      "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3),
      "decidedAt" TIMESTAMP(3),
      "decidedBy" TEXT,
      CONSTRAINT "Approval_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Approval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Approval_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Approval_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
    CREATE INDEX "Approval_organizationId_status_createdAt_idx" ON "Approval"("organizationId", "status", "createdAt");
    CREATE INDEX "Approval_organizationId_targetResourceType_targetResourceId_idx" ON "Approval"("organizationId", "targetResourceType", "targetResourceId");

    CREATE TABLE "Workflow" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "objectiveId" TEXT,
      "currentState" TEXT NOT NULL,
      "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
      "currentTaskId" TEXT,
      "startedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "failureCode" TEXT,
      "failureMessage" TEXT,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "resumableState" JSONB NOT NULL,
      "metadata" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE INDEX "Workflow_organizationId_status_updatedAt_idx" ON "Workflow"("organizationId", "status", "updatedAt");
    CREATE INDEX "Workflow_organizationId_objectiveId_idx" ON "Workflow"("organizationId", "objectiveId");
    CREATE INDEX "Workflow_currentTaskId_idx" ON "Workflow"("currentTaskId");
  END IF;
END $$;
