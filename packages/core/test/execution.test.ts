import test from 'node:test';
import assert from 'node:assert/strict';
import { decideExecution, hasWorkerCapability } from '../src/execution.js';
test('execution risk policy is deterministic',()=>{assert.equal(decideExecution('LOW',true),'ALLOW');assert.equal(decideExecution('MEDIUM',true),'ALLOW');assert.equal(decideExecution('HIGH',true),'REQUIRES_APPROVAL');assert.equal(decideExecution('HIGH',true,true),'ALLOW');assert.equal(decideExecution('CRITICAL',true,true),'DENY');assert.equal(decideExecution('LOW',false),'DENY');});
test('worker capabilities are explicit',()=>{assert.equal(hasWorkerCapability({capabilities:['research']},'research'),true);assert.equal(hasWorkerCapability({capabilities:['research']},'deploy'),false);});
