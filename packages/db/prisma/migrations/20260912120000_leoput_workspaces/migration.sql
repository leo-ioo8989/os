CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "intent" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Workspace_organizationId_updatedAt_idx" ON "Workspace"("organizationId", "updatedAt");
CREATE INDEX "Workspace_organizationId_kind_idx" ON "Workspace"("organizationId", "kind");
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
