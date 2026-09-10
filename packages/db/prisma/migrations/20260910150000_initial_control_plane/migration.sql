CREATE TYPE "ObjectiveStatus" AS ENUM ('DRAFT', 'PLANNING', 'READY', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'READY', 'RUNNING', 'WAITING_APPROVAL', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Objective" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "projectId" TEXT,
  "createdBy" TEXT NOT NULL,
  "priority" "Priority" NOT NULL,
  "status" "ObjectiveStatus" NOT NULL DEFAULT 'DRAFT',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'GREEN',
  "budget" DECIMAL(18,6),
  "estimatedCost" DECIMAL(18,6),
  "actualCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "successCriteria" JSONB NOT NULL,
  "deadline" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "currentPhase" TEXT,
  "metadata" JSONB NOT NULL,
  CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "objectiveId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignedAgentId" TEXT,
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'GREEN',
  "estimatedCost" DECIMAL(18,6),
  "actualCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "retryLimit" INTEGER NOT NULL DEFAULT 3,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDependency" (
  "taskId" TEXT NOT NULL,
  "dependencyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("taskId", "dependencyId")
);

CREATE INDEX "Objective_organizationId_status_idx" ON "Objective"("organizationId", "status");
CREATE INDEX "Objective_organizationId_priority_idx" ON "Objective"("organizationId", "priority");
CREATE INDEX "Objective_deadline_idx" ON "Objective"("deadline");
CREATE INDEX "Task_objectiveId_status_idx" ON "Task"("objectiveId", "status");
CREATE INDEX "Task_assignedAgentId_status_idx" ON "Task"("assignedAgentId", "status");
CREATE INDEX "TaskDependency_dependencyId_idx" ON "TaskDependency"("dependencyId");

ALTER TABLE "Objective" ADD CONSTRAINT "Objective_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
