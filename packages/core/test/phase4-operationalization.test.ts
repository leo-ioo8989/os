import {describe,it} from 'node:test'; import assert from 'node:assert/strict';
import {authorize} from '../src/phase4-operationalization.js'; import {createApproval,decideApproval} from '../src/v403-approval.js'; import {nextWorkflowStep} from '../src/v404-workflow.js'; import {deduplicateEvents} from '../src/v405-event-fabric.js'; import {reconstructAudit} from '../src/v406-audit.js'; import {reserveBudget,consumeQuota} from '../src/v407-resource-operations.js'; import {validateAdapterRequest} from '../src/v408-adapter.js'; import {leaseJob,heartbeat,completeJob} from '../src/v409-execution-operations.js'; import {classifyFailure} from '../src/v410-reliability.js'; import {classifyData,enforceSecurityBoundary} from '../src/v411-security-governance.js'; import {certifyPhase4} from '../src/v412-phase4-certification.js';
const p={organizationId:'o',actorId:'u',objectiveId:'obj',taskId:'t',correlationId:'c'}; const a={authorityId:'a',policyVersion:'p1',scope:['run'],privileged:false};
describe('LEO OS Phase 4',()=>{
it('fails closed without scope',()=>assert.equal(authorize({provenance:p,authority:a,now:'x'},'admin').decision,'DENY'));
it('requires approval for high risk',()=>assert.equal(authorize({provenance:p,authority:a,now:'x'},'run','RED').decision,'APPROVAL_REQUIRED'));
it('approval is durable state machine',()=>{const r=createApproval({id:'a1',provenance:p,requestedBy:'u',requiredScope:'run',risk:'RED',expiresAt:new Date(Date.now()+60000).toISOString(),evidence:['x']});assert.equal(decideApproval(r,true,'admin').status,'APPROVED')});
it('workflow respects dependencies',()=>assert.equal(nextWorkflowStep({id:'w',provenance:p,state:'RUNNING',completed:['a']},[{id:'b',dependsOn:['a'],requiredScope:'run'}])?.id,'b'));
it('event fabric deduplicates by org/idempotency',()=>{const e={eventId:'1',type:'x',version:1,occurredAt:'2026-01-01',provenance:p,correlationId:'c',idempotencyKey:'k',payload:{}};assert.equal(deduplicateEvents([e,e]).length,1)});
it('audit reconstructs correlation',()=>assert.equal(reconstructAudit([{id:'1',timestamp:'1',actorId:'u',authority:a,provenance:p,action:'x',decision:'ALLOW',reason:'ok'}],'c').length,1));
it('resource limits fail closed',()=>assert.throws(()=>reserveBudget({id:'b',organizationId:'o',limit:1,used:1,currency:'INR'},1)));
it('quota and adapter boundaries validate',()=>{assert.throws(()=>consumeQuota({id:'q',organizationId:'o',limit:1,used:1},1));assert.throws(()=>validateAdapterRequest({requestId:'',provenance:p,capability:'x',input:{},timeoutMs:1,idempotencyKey:'k'}))});
it('worker lease and completion are bounded',()=>{const j={id:'j',provenance:p,status:'QUEUED' as const,attempts:0,maxAttempts:2};const l=leaseJob(j,'w',new Date(Date.now()+60000).toISOString());assert.equal(heartbeat(l,'w',new Date(Date.now()+120000).toISOString()).status,'RUNNING');assert.equal(completeJob(l,false).status,'FAILED')});
it('reliability classifies security failures',()=>assert.equal(classifyFailure('provenance denied'),'CRITICAL'));
it('security boundary and classification are restrictive',()=>{assert.equal(classifyData({apiKey:'secret'}),'RESTRICTED');assert.equal(enforceSecurityBoundary({userId:'u',organizationId:'o',roles:['VIEWER'],scopes:['read'],sessionId:'s'},'write'),false)});
it('phase certification blocks missing evidence',()=>assert.equal(certifyPhase4([]).status,'BLOCKED'));
});
