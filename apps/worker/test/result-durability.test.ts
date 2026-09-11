import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, WorkerRepository, JobRepository } from '@founder-os/db';
import { WorkerRuntime, type WorkerRuntimeOptions } from '../src/worker-runtime.js';
import { JobService } from '../src/job-service.js';
import { ExecutionHandlerRegistry, type ExecutionHandler } from '../src/execution-handlers.js';

const db = new PrismaClient();
const marker = `result-durability-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function cleanup(organizationId:string){
  await db.auditEvent.deleteMany({where:{organizationId}});
  await db.approval.deleteMany({where:{organizationId}});
  await db.checkpoint.deleteMany({where:{organizationId}});
  await db.job.deleteMany({where:{organizationId}});
  await db.workflow.deleteMany({where:{organizationId}});
  await db.taskDependency.deleteMany({where:{task:{objective:{organizationId}}}});
  await db.task.deleteMany({where:{objective:{organizationId}}});
  await db.objective.deleteMany({where:{organizationId}});
  await db.workerCredential.deleteMany({where:{worker:{organizationId}}});
  await db.worker.deleteMany({where:{organizationId}});
  await db.organization.delete({where:{id:organizationId}});
}

test.after(async()=>{await db.$disconnect()});

async function setup(handlerId:string,parameters:Record<string,unknown>={},maxAttempts=3){
  const organization=await db.organization.create({data:{name:marker}});
  const worker=await new WorkerRepository(db).create({organizationId:organization.id,name:'result-worker',type:'test',capabilities:['internal.execute','internal.calculate','internal.checkpoint'],credential:'result-worker-credential-123456'}, {organizationId:organization.id,actorType:'SYSTEM',eventType:'worker.created',action:'worker_created',result:'SUCCESS'});
  const objective=await db.objective.create({data:{organizationId:organization.id,title:'Result durability',description:'verification',createdBy:organization.id,priority:'HIGH',status:'READY',riskLevel:'GREEN',successCriteria:{},metadata:{}}});
  const task=await db.task.create({data:{objectiveId:objective.id,title:'execution',description:'execution',status:'PENDING',metadata:{handlerId,capability:handlerId==='internal.calculate'?'internal.calculate':'internal.execute',action:'execute',target:'internal',risk:'LOW',parameters}}});
  const workflow=await db.workflow.create({data:{organizationId:organization.id,objectiveId:objective.id,currentState:'RUNNING',status:'RUNNING',resumableState:{},metadata:{},currentTaskId:task.id}});
  const job=await db.job.create({data:{organizationId:organization.id,objectiveId:objective.id,taskId:task.id,workflowId:workflow.id,maxAttempts,resumableState:{},metadata:{}}});
  return {organization,worker,objective,task,workflow,job};
}

function options():WorkerRuntimeOptions{
  return {authorizeExecution:async()=>({decision:'ALLOW' as const})};
}

test('durable result: successful validated handler output is persisted on the real runtime path',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const x=await setup('internal.calculate',{a:2,b:3,operation:'add'});
  try{
    const run=await new WorkerRuntime(db,options()).run(x.organization.id,x.job.id,x.worker.worker.id,'result-worker-credential-123456');
    assert.equal(run.kind,'succeeded');
    const result=await db.executionResult.findUnique({where:{jobId:x.job.id}});
    assert.equal(result?.status,'SUCCEEDED');
    assert.deepEqual(result?.output,{result:5});
    assert.equal(result?.failure,null);
    assert.equal(result?.handlerId,'internal.calculate');
    assert.ok(result?.validatedAt);
    assert.equal((await db.job.findUnique({where:{id:x.job.id}}))?.status,'SUCCEEDED');
  }finally{await cleanup(x.organization.id)}
});

test('durable result: invalid handler result is never persisted as validated',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const invalidHandler:ExecutionHandler={id:'test.invalid-result',description:'invalid result test',requiredCapability:'internal.execute',risk:'LOW',deterministic:true,testSafe:true,validateInput:()=>true,validateOutput:()=>true,execute:async()=>({status:'SUCCEEDED'})};
  class InvalidRegistry extends ExecutionHandlerRegistry { override get(id:string){return id===invalidHandler.id?invalidHandler:super.get(id)} }
  const x=await setup(invalidHandler.id,{});
  try{
    const run=await new WorkerRuntime(db,{...options(),registry:new InvalidRegistry()}).run(x.organization.id,x.job.id,x.worker.worker.id,'result-worker-credential-123456');
    assert.equal(run.kind,'failed');
    assert.equal((await db.executionResult.count({where:{jobId:x.job.id}})),0);
    assert.equal((await db.job.findUnique({where:{id:x.job.id}}))?.failureCode,'INVALID_RESULT');
  }finally{await cleanup(x.organization.id)}
});

test('durable result: terminal structured failure is persisted without replacing Job failure fields',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const x=await setup('internal.fail',{code:'TEST_FAILURE',message:'deterministic failure',retryable:false});
  try{
    const run=await new WorkerRuntime(db,options()).run(x.organization.id,x.job.id,x.worker.worker.id,'result-worker-credential-123456');
    assert.equal(run.kind,'failed');
    const result=await db.executionResult.findUnique({where:{jobId:x.job.id}});
    assert.equal(result?.status,'FAILED');
    assert.deepEqual(result?.failure,{code:'TEST_FAILURE',message:'deterministic failure',retryable:false});
    assert.equal(result?.output,null);
    const job=await db.job.findUnique({where:{id:x.job.id}});
    assert.equal(job?.status,'FAILED');
    assert.equal(job?.failureCode,'TEST_FAILURE');
    assert.equal(job?.failureMessage,'deterministic failure');
    assert.equal(job?.failureRetryable,false);
  }finally{await cleanup(x.organization.id)}
});

test('durable result: retryable validated failure remains non-terminal and creates no terminal result',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const x=await setup('internal.fail',{code:'RETRY_ME',message:'retry me',retryable:true});
  try{
    const run=await new WorkerRuntime(db,options()).run(x.organization.id,x.job.id,x.worker.worker.id,'result-worker-credential-123456');
    assert.equal(run.kind,'failed');
    assert.equal((await db.job.findUnique({where:{id:x.job.id}}))?.status,'RETRY_QUEUED');
    assert.equal(await db.executionResult.count({where:{jobId:x.job.id}}),0);
  }finally{await cleanup(x.organization.id)}
});

test('durable result: duplicate and concurrent terminal completion cannot create duplicate results',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const x=await setup('internal.noop');
  try{
    const jobs=new JobRepository(db);
    const now=new Date(Date.now()+60000);
    const claimed=await jobs.claim(x.organization.id,x.job.id,x.worker.worker.id,120000,undefined,new Date());
    assert.equal(claimed.kind,'claimed');
    const started=await jobs.transition(x.organization.id,x.job.id,'CLAIMED','RUNNING',x.worker.worker.id,{organizationId:x.organization.id,actorType:'SYSTEM',eventType:'job.started',action:'start',result:'SUCCESS'},new Date());
    assert.equal(started.kind,'updated');
    const service=new JobService(db);
    const result={status:'SUCCEEDED' as const,output:{executed:true}};
    const attempts=await Promise.all([
      service.succeedWithResult(x.organization.id,x.job.id,x.worker.worker.id,result,'internal.noop'),
      service.succeedWithResult(x.organization.id,x.job.id,x.worker.worker.id,result,'internal.noop'),
    ]);
    assert.equal(attempts.filter(r=>r.kind==='updated').length,1);
    assert.equal(attempts.filter(r=>r.kind==='conflict').length,1);
    assert.equal(await db.executionResult.count({where:{jobId:x.job.id}}),1);
    assert.equal((await db.job.findUnique({where:{id:x.job.id}}))?.status,'SUCCEEDED');
    const duplicate=await service.succeedWithResult(x.organization.id,x.job.id,x.worker.worker.id,result,'internal.noop');
    assert.equal(duplicate.kind,'conflict');
    assert.equal(await db.executionResult.count({where:{jobId:x.job.id}}),1);
    void now;
  }finally{await cleanup(x.organization.id)}
});

test('durable result: organization-scoped Job access does not cross tenant boundaries',async(t)=>{
  if(!process.env.DATABASE_URL){t.skip('DATABASE_URL is required');return;}
  const x=await setup('internal.noop');
  const other=await db.organization.create({data:{name:`${marker}-other`}});
  try{
    const result=await db.executionResult.create({data:{jobId:x.job.id,status:'SUCCEEDED',output:{executed:true},handlerId:'internal.noop',validatedAt:new Date()}});
    assert.equal(result.jobId,x.job.id);
    assert.equal(await new JobRepository(db).get(other.id,x.job.id),null);
    assert.equal((await db.job.findFirst({where:{organizationId:other.id,id:x.job.id}})),null);
  }finally{await cleanup(x.organization.id);await db.organization.delete({where:{id:other.id}})}
});
