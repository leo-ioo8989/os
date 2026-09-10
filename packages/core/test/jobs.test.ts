import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionJob, isTerminalJobStatus, retryDecision } from '../src/jobs.js';
test('job lifecycle accepts only deterministic transitions',()=>{assert.equal(canTransitionJob('QUEUED','CLAIMED'),true);assert.equal(canTransitionJob('RUNNING','SUCCEEDED'),true);assert.equal(canTransitionJob('RUNNING','WAITING_APPROVAL'),true);assert.equal(canTransitionJob('WAITING_APPROVAL','RETRY_QUEUED'),true);assert.equal(canTransitionJob('SUCCEEDED','RUNNING'),false);assert.equal(canTransitionJob('FAILED','RETRY_QUEUED'),false);});
test('retry policy terminates after max attempts',()=>{assert.equal(retryDecision(1,3,true).status,'RETRY_QUEUED');assert.equal(retryDecision(3,3,true).status,'FAILED');assert.equal(retryDecision(1,3,false).status,'FAILED');});
test('terminal job states cannot resume',()=>{assert.equal(isTerminalJobStatus('SUCCEEDED'),true);assert.equal(isTerminalJobStatus('FAILED'),true);assert.equal(isTerminalJobStatus('CANCELLED'),true);assert.equal(isTerminalJobStatus('WAITING_APPROVAL'),false);});
