import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionHandlerRegistry, validateHandlerResult } from '../src/execution-handlers.js';

test('V1.08 handler registry is deterministic and test-safe', () => {
 const registry = new ExecutionHandlerRegistry();
 assert.deepEqual(registry.list().map(h=>h.id), ['internal.calculate','internal.checkpoint','internal.fail','internal.noop']);
 assert.equal(registry.get('unknown.handler'), undefined);
 for(const h of registry.list()){assert.equal(h.deterministic,true);assert.equal(h.testSafe,true)}
});

test('result validation rejects malformed success and failure', () => {
 const h=new ExecutionHandlerRegistry().get('internal.noop')!;
 assert.equal(validateHandlerResult(h,{status:'SUCCEEDED',output:{executed:true}}).valid,true);
 assert.equal(validateHandlerResult(h,{status:'SUCCEEDED',output:[] as unknown as Record<string,unknown>}).valid,false);
 assert.equal(validateHandlerResult(h,{status:'FAILED'}).valid,false);
});

test('calculation handler is deterministic', async () => {
 const h=new ExecutionHandlerRegistry().get('internal.calculate')!;
 assert.equal(h.validateInput({a:2,b:3,operation:'add'}),true);
 assert.equal(h.validateInput({a:2,b:3,operation:'divide'}),false);
 const r=await h.execute({organizationId:'o',workflowId:'w',jobId:'j',taskId:'t',workerId:'worker',parameters:{a:2,b:3,operation:'add'},checkpoint:async()=>undefined});
 assert.deepEqual(r,{status:'SUCCEEDED',output:{result:5}});
});
