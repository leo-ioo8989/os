-- Durable validated terminal execution results.
CREATE TYPE "ExecutionResultStatus" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "ExecutionResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ExecutionResultStatus" NOT NULL,
    "output" JSONB,
    "failure" JSONB,
    "handlerId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutionResult_jobId_key" ON "ExecutionResult"("jobId");

ALTER TABLE "ExecutionResult" ADD CONSTRAINT "ExecutionResult_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
