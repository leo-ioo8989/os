ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Workspace_createdBy_idx" ON "Workspace"("createdBy");
