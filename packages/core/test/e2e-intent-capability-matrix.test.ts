import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerIntent, DeterministicPlanGenerator, inferWorkforceCapabilities, validatePlanProposal } from '../src/index.js';

const cases: Array<{name:string; text:string; expected:string[]}> = [
  {name:'website', text:'Make a website for my company', expected:['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN','VISUAL_DESIGN']},
  {name:'web app', text:'Build a web app for customers', expected:['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN','VISUAL_DESIGN']},
  {name:'api', text:'Build a backend API service', expected:['SOFTWARE_ENGINEERING','BACKEND_DEVELOPMENT']},
  {name:'mobile', text:'Create an Android mobile app', expected:['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN']},
  {name:'debug', text:'Debug the broken application', expected:['SOFTWARE_ENGINEERING','DEBUGGING']},
  {name:'review', text:'Review this code and pull request', expected:['SOFTWARE_ENGINEERING','CODE_REVIEW']},
  {name:'architecture', text:'Design the system architecture', expected:['ARCHITECTURE','SOFTWARE_ENGINEERING']},
  {name:'research', text:'Research this topic and find sources', expected:['WEB_RESEARCH','SOURCE_DISCOVERY']},
  {name:'market', text:'Do market research and competitor analysis', expected:['WEB_RESEARCH','MARKET_ANALYSIS','PRODUCT_ANALYSIS']},
  {name:'data', text:'Analyze this dataset and metrics', expected:['DATA_ANALYSIS']},
  {name:'security', text:'Perform a security audit', expected:['SECURITY_REVIEW']},
  {name:'copy', text:'Write a blog article and newsletter', expected:['COPYWRITING']},
  {name:'seo', text:'Improve SEO with keyword research', expected:['SEO','COPYWRITING']},
  {name:'social', text:'Create an Instagram social media campaign', expected:['SOCIAL_MEDIA','COPYWRITING','GROWTH_ANALYSIS']},
  {name:'growth', text:'Improve conversion and acquisition growth', expected:['GROWTH_ANALYSIS']},
  {name:'video', text:'Edit a product video and reel', expected:['VIDEO_EDITING']},
  {name:'audio', text:'Create a podcast voice track', expected:['AUDIO_GENERATION']},
  {name:'presentation', text:'Make a pitch deck presentation', expected:['PRESENTATION_DESIGN']},
  {name:'qa', text:'Run technical testing and validation', expected:['TECHNICAL_QA']},
  {name:'content qa', text:'Proofread and fact check the content', expected:['CONTENT_QA']},
];

const prompts = Array.from({length:1200}, (_, i) => {
  const base = cases[i % cases.length]!;
  const variant = i % 60;
  return { ...base, text: `${base.text}; variant ${variant}; business context ${i % 7}; project context ${i % 11}` };
});

test('1200 owner prompts classify known capability domains without authority leakage', () => {
  const planner = new DeterministicPlanGenerator();
  for (let i = 0; i < prompts.length; i += 1) {
    const p = prompts[i]!;
    const intent = createOwnerIntent({
      intentId: `matrix-${i}`,
      organizationId: `org-${i % 13}`,
      ownerUserId: `owner-${i % 17}`,
      requestedOutcome: p.text,
      businessContext: `business-${i % 7}`,
      projectContext: `project-${i % 11}`,
      context: { channel: i % 2 ? 'mobile' : 'web', locale: i % 3 ? 'en-IN' : 'en-US', variant: i },
      constraints: i % 5 === 0 ? ['No external communication'] : [],
      priority: i % 29 === 0 ? 'CRITICAL' : i % 13 === 0 ? 'HIGH' : 'MEDIUM',
      requestedBudget: i % 17 === 0 ? 0 : undefined,
      riskRequirements: i % 19 === 0 ? ['security-sensitive'] : [],
      createdAt: '2026-09-12T00:00:00.000Z',
      correlationId: `matrix-correlation-${i}`,
    });
    const inferred = [...inferWorkforceCapabilities(intent)];
    for (const capability of p.expected) assert.ok(inferred.includes(capability), `prompt ${i} (${p.name}) missing ${capability}`);
    const proposal = planner.propose(intent);
    validatePlanProposal(proposal);
    assert.deepEqual(proposal.requiredCapabilities, inferred);
    assert.equal(proposal.authority, 'PROPOSAL_ONLY');
    assert.equal(proposal.organizationId, intent.organizationId);
    assert.equal(proposal.tasks[0]?.targetOrganizationId, intent.organizationId);
    const serialized = JSON.stringify(proposal);
    for (const forbidden of ['approvalGranted','workerId','credentialId','execute','dispatch','externalAction','grantedPermissions','grantedCapabilities']) {
      assert.equal(serialized.includes(`\"${forbidden}\"`), false, `prompt ${i} leaked ${forbidden}`);
    }
  }
});

test('website command maps to governed workforce requirements', () => {
  const intent = createOwnerIntent({
    intentId: 'website-e2e', organizationId: 'org-web', ownerUserId: 'owner-web',
    requestedOutcome: 'Make a beautiful ecommerce website for me', constraints: [], priority: 'HIGH',
    riskRequirements: [], createdAt: '2026-09-12T00:00:00.000Z', correlationId: 'website-e2e-correlation',
  });
  const proposal = new DeterministicPlanGenerator().propose(intent);
  assert.deepEqual(proposal.requiredCapabilities, ['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN','VISUAL_DESIGN','GROWTH_ANALYSIS']);
  assert.equal(proposal.tasks[0]?.proposedWorkerRole, 'frontend-engineer');
  assert.equal(proposal.authority, 'PROPOSAL_ONLY');
});
