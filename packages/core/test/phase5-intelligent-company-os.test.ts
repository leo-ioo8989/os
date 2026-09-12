import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateContextGraph } from '../src/v501-company-context.js';
import { retrieveKnowledge } from '../src/v502-knowledge-retrieval.js';
import { validateIntelligenceRequest } from '../src/v503-intelligence-gateway.js';
import { decomposeGoal } from '../src/v505-goal-decomposition.js';
import { CapabilityRegistry } from '../src/v508-capability-registry.js';
import { shouldStart } from '../src/v509-autonomous-workflows.js';
import { proposeOptimization } from '../src/v510-evaluation-optimization.js';
import { certifyPhase5, PHASE5_VERSIONS } from '../src/v512-phase5-certification.js';

describe('Phase 5', () => {
  it('rejects cross-org graph state', () => {
    const g = { organizationId: 'o1', nodes: [], edges: [], version: 1 };
    assert.throws(() => validateContextGraph({ ...g, nodes: [{ id: 'x', organizationId: 'o2', type: 'PROJECT', label: 'x', provenance: { source: 't', timestamp: new Date().toISOString() } }] }));
  });
  it('preserves scoped retrieval', () => {
    const x = retrieveKnowledge([
      { id: '1', organizationId: 'o1', content: 'sales', classification: 'PUBLIC_INTERNAL', sourceId: 's', version: 1 },
      { id: '2', organizationId: 'o2', content: 'sales', classification: 'PUBLIC_INTERNAL', sourceId: 's', version: 1 },
    ], { organizationId: 'o1', actorId: 'a', query: 'sales', allowedClassifications: ['PUBLIC_INTERNAL'] });
    assert.deepEqual(x.map((i) => i.id), ['1']);
  });
  it('requires intelligence provenance context', () => {
    assert.throws(() => validateIntelligenceRequest({ organizationId: '', actorId: 'a', correlationId: 'c', prompt: 'x', maxTokens: 1 }));
  });
  it('bounds decomposition', () => assert.equal(decomposeGoal({ organizationId: 'o', objectiveId: 'g', description: 'ship product', maxDepth: 1, maxTasks: 2 }).length, 2));
  it('forces optimization approval', () => assert.equal(proposeOptimization({ targetId: 'x', changes: { a: 1 }, expectedImpact: 1, requiresApproval: false }).requiresApproval, true));
  it('denies unregistered capability', () => { const r = new CapabilityRegistry(); assert.throws(() => r.resolve('missing', 'x')); });
  it('never starts disabled workflows', () => assert.equal(shouldStart({ workflowId: 'w', organizationId: 'o', trigger: 't', steps: ['x'], maxConcurrent: 1, requiresApproval: false, enabled: false }, true), false));
  it('requires evidence for certification', () => {
    const e = Object.fromEntries(PHASE5_VERSIONS.map((v) => [v, { unit: true, adversarial: true, integration: true, architecture: true, regression: true }]));
    assert.equal(certifyPhase5(e).status, 'CERTIFIED');
  });
});
