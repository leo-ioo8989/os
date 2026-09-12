import assert from 'node:assert/strict';
import test from 'node:test';
import { requestWithProviderSet, type IntelligenceProvider } from './v503-intelligence-gateway.js';

const provider=(name:string,content:string,fail=false):IntelligenceProvider=>({name,async propose(request){if(fail)throw new Error(`${name} unavailable`);return{proposalId:`proposal-${name}`,provider:name,content,confidence:1,correlationId:request.correlationId,provenance:{requestId:`request-${name}`,policyVersion:'test',createdAt:new Date().toISOString()}}}});
const request={organizationId:'org-1',actorId:'actor-1',correlationId:'corr-1',prompt:'Plan the next company objective.',maxTokens:256};

test('gateway enforces prompt and token policy',async()=>{await assert.rejects(()=>requestWithProviderSet([provider('openai','ok')],{...request,prompt:'x'.repeat(101)},{maxPromptChars:100}));await assert.rejects(()=>requestWithProviderSet([provider('openai','ok')],{...request,maxTokens:200},{maxTokens:128}))});
test('gateway respects provider allow-list and failover',async()=>{const result=await requestWithProviderSet([provider('openai','down',true),provider('anthropic','fallback')],request,{allowedProviders:['openai','anthropic']});assert.equal(result.provider,'anthropic');await assert.rejects(()=>requestWithProviderSet([provider('openai','ok')],request,{allowedProviders:['anthropic']}))});
test('gateway rejects invalid provider provenance',async()=>{const bad:IntelligenceProvider={name:'openai',async propose(r){return{proposalId:'x',provider:'other',content:'bad',confidence:1,correlationId:r.correlationId,provenance:{requestId:'x',policyVersion:'test',createdAt:new Date().toISOString()}}}};await assert.rejects(()=>requestWithProviderSet([bad],request))});
test('gateway consumes quota hook before provider execution',async()=>{let consumed=0;const result=await requestWithProviderSet([provider('openai','ok')],request,{consumeQuota:()=>{consumed+=1}});assert.equal(result.content,'ok');assert.equal(consumed,1)});
