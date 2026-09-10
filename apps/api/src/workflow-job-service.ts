import type { PrismaClient } from '@prisma/client';
import { WorkflowJobRepository } from '@founder-os/db';
import { ApiError } from './errors.js';
export async function linkWorkflowJob(db:PrismaClient,organizationId:string,workflowId:string,jobId:string,actorId?:string){const item=await new WorkflowJobRepository(db).link(organizationId,workflowId,jobId,actorId);if(!item)throw new ApiError(404,'NOT_FOUND','Workflow or job not found in this organization.');return item;}
export async function getWorkflowJobSummary(db:PrismaClient,organizationId:string,workflowId:string){const item=await new WorkflowJobRepository(db).summary(organizationId,workflowId);if(!item)throw new ApiError(404,'NOT_FOUND','Workflow not found.');return item;}
