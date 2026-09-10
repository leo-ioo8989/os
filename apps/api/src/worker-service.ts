import type { PrismaClient, WorkerStatus } from '@prisma/client';
import { WorkerRepository, type CreateWorkerInput } from '@founder-os/db';
import { ApiError } from './errors.js';

export async function createWorker(db:PrismaClient,input:CreateWorkerInput,actorId?:string){return new WorkerRepository(db).create(input,{organizationId:input.organizationId,actorId,actorType:actorId?'USER':'SYSTEM',action:'create',result:'SUCCESS'});}
export async function authenticateWorker(db:PrismaClient,organizationId:string,workerId:string,credential:string){const worker=await new WorkerRepository(db).authenticate(organizationId,workerId,credential,{organizationId,actorType:'SYSTEM',action:'authenticate',result:'SUCCESS'});if(!worker)throw new ApiError(401,'UNAUTHENTICATED','Worker authentication failed.');return worker;}
export async function setWorkerStatus(db:PrismaClient,organizationId:string,workerId:string,status:WorkerStatus,actorId:string){const item=await new WorkerRepository(db).setStatus(organizationId,workerId,status,{organizationId,actorId,actorType:'USER',action:status.toLowerCase(),result:'SUCCESS'});if(!item)throw new ApiError(404,'NOT_FOUND','Worker not found.');return item;}
