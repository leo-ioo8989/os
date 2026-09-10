import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicTestModel, ModelRegistry, ModelRuntime, routeModel, type ModelDefinition, type ModelProvider, type ModelRequest, type ModelResponse } from '../src/index.js';

const def = (o: Partial<ModelDefinition> = {}): ModelDefinition => ({
  providerId: 'p', modelId: 'm', capabilities: ['reasoning', 'structured_output'], qualityTier: 'STANDARD',
  cost: { costPerInputUnit: 0.1, costPerOutputUnit: 0.2, currency: 'TEST' }, latency: { expectedLatencyMs: 1000 },
  availability: 'AVAILABLE', context: { maxInputUnits: 10000 }, version: '1', provenance: 'test', ...o,
});
const req = (o: Record<string, unknown> = {}) => ({
  requestId: 'r1', organizationId: 'org-a', ownerUserId: 'owner-1', purpose: 'test',
  requiredCapabilities: ['reasoning'] as const, preferredCapabilities: [] as const, minimumQualityTier: 'BASIC' as const,
  latencySensitive: false, maxCost: 1, allowFallback: true, timestamp: '2026-09-10T12:00:00.000Z',
  correlationId: 'c1', input: { objective: 'test' }, ...o,
});
const pol = (o: Partial<Parameters<typeof routeModel>[2]> = {}) => ({ policyVersion: 'routing-v1', allowFallback: true, requireOrganizationMatch: true, ...o });
function deterministic(providerId: string, modelId: string): ModelProvider {
  const model = new DeterministicTestModel();
  return { providerId, modelId, generate(input) { return model.generate({ ...input, providerId, modelId }); } };
}
function failure(providerId: string, modelId: string, code: 'PROVIDER_UNAVAILABLE' | 'TIMEOUT' | 'PROVIDER_FAILURE'): ModelProvider {
  return { providerId, modelId, generate(input): ModelResponse {
    return { responseId: `${input.requestId}:failure`, requestId: input.requestId, providerId, modelId, status: 'FAILURE', failure: { code, message: code, retryable: true }, timestamp: input.timestamp, correlationId: input.correlationId, provenance: { providerId, modelId, requestId: input.requestId, correlationId: input.correlationId, deterministic: true } };
  } };
}
function success(providerId: string, modelId: string): ModelProvider {
  return { providerId, modelId, generate(input: ModelRequest): ModelResponse {
    return { responseId: `${input.requestId}:${providerId}:${modelId}:response`, requestId: input.requestId, providerId, modelId, status: 'SUCCESS', output: { kind: 'test-output', input: input.input }, timestamp: input.timestamp, correlationId: input.correlationId, provenance: { providerId, modelId, requestId: input.requestId, correlationId: input.correlationId, deterministic: true } };
  } };
}

test('required capabilities match and missing capabilities fail closed', () => {
  const d = def(); const r = new ModelRegistry([d], [deterministic('p', 'm')]);
  assert.equal(routeModel(req(), r, pol()).selectedModelId, 'm');
  assert.throws(() => routeModel(req({ requiredCapabilities: ['vision'] }), r, pol()), /NO_ELIGIBLE_MODEL/);
});

test('preferred capabilities rank before quality, with latency and cost deterministic', () => {
  const models = [
    def({ providerId: 'a', modelId: 'slow-premium', qualityTier: 'PREMIUM', latency: { expectedLatencyMs: 3000 }, capabilities: ['reasoning'] }),
    def({ providerId: 'b', modelId: 'fast-vision', capabilities: ['reasoning', 'vision'], latency: { expectedLatencyMs: 100 } }),
    def({ providerId: 'c', modelId: 'expensive-vision', capabilities: ['reasoning', 'vision'], qualityTier: 'PREMIUM', cost: { costPerInputUnit: 2, costPerOutputUnit: 2, currency: 'TEST' } }),
  ];
  const r = new ModelRegistry(models, models.map((m) => deterministic(m.providerId, m.modelId)));
  const x = routeModel(req({ preferredCapabilities: ['vision'], latencySensitive: true, maxCost: 0.5 }), r, pol());
  assert.equal(x.selectedModelId, 'fast-vision');
  assert.deepEqual(x, routeModel(req({ preferredCapabilities: ['vision'], latencySensitive: true, maxCost: 0.5 }), r, pol()));
});

test('quality, provider/model allowlists and availability constrain eligibility', () => {
  const a = def({ providerId: 'a', modelId: 'a', qualityTier: 'BASIC' }); const b = def({ providerId: 'b', modelId: 'b', qualityTier: 'PREMIUM' });
  const r = new ModelRegistry([a, b], [deterministic('a', 'a'), deterministic('b', 'b')]);
  assert.equal(routeModel(req({ minimumQualityTier: 'PREMIUM' }), r, pol()).selectedModelId, 'b');
  assert.equal(routeModel(req(), r, pol({ allowedProviderIds: ['a'], allowedModelIds: ['a'] })).selectedModelId, 'a');
  assert.throws(() => routeModel(req(), new ModelRegistry([def({ availability: 'UNAVAILABLE' })], []), pol()), /NO_ELIGIBLE_MODEL/);
});

test('organization-owned model definitions never cross organization boundaries', () => {
  const d = def({ providerId: 'b', modelId: 'b', organizationId: 'org-b' });
  const result = new ModelRuntime(new ModelRegistry([d], [deterministic('b', 'b')])).run(req({ organizationId: 'org-a' }), pol());
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'NO_ELIGIBLE_MODEL');
});

test('routing policy requires authoritative organization identity', () => {
  const r = new ModelRuntime(new ModelRegistry([def()], [deterministic('p', 'm')]));
  const result = r.run(req({ organizationId: undefined }), pol());
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'ROUTING_POLICY_REJECTED');
});

test('provider failure and timeout remain structured failures', () => {
  for (const code of ['PROVIDER_FAILURE', 'TIMEOUT'] as const) {
    const d = def(); const result = new ModelRuntime(new ModelRegistry([d], [failure('p', 'm', code)])).run(req({ allowFallback: false }), pol({ allowFallback: false }));
    assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, code);
  }
});

test('fallback succeeds only through the routed eligible set', () => {
  const a = def({ providerId: 'a', modelId: 'a', qualityTier: 'PREMIUM' }); const b = def({ providerId: 'b', modelId: 'b' });
  const result = new ModelRuntime(new ModelRegistry([a, b], [failure('a', 'a', 'PROVIDER_UNAVAILABLE'), success('b', 'b')])).run(req(), pol());
  assert.equal(result.status, 'SUCCESS'); assert.equal(result.response.modelId, 'b'); assert.deepEqual(result.attemptedModels.map((x) => x.modelId), ['a', 'b']);
});

test('fallback exhaustion fails closed and never bypasses policy', () => {
  const a = def({ providerId: 'a', modelId: 'a', qualityTier: 'PREMIUM' }); const b = def({ providerId: 'b', modelId: 'b' });
  const registry = new ModelRegistry([a, b], [failure('a', 'a', 'PROVIDER_FAILURE'), success('b', 'b')]);
  const result = new ModelRuntime(registry).run(req(), pol({ allowedProviderIds: ['a'] }));
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'FALLBACK_EXHAUSTED'); assert.equal(result.attemptedModels.length, 1);
});

test('fallback is disabled when the request disallows it', () => {
  const d = def(); const result = new ModelRuntime(new ModelRegistry([d], [failure('p', 'm', 'PROVIDER_FAILURE')])).run(req({ allowFallback: false }), pol());
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'PROVIDER_FAILURE');
});

test('provenance is preserved across routing and provider response', () => {
  const d = def(); const result = new ModelRuntime(new ModelRegistry([d], [deterministic('p', 'm')])).run(req({ requestId: 'rp', correlationId: 'cp' }), pol());
  assert.equal(result.status, 'SUCCESS'); assert.equal(result.routing.provenance.requestId, 'rp'); assert.equal(result.response.requestId, 'rp'); assert.equal(result.response.correlationId, 'cp');
});

test('provenance mismatch fails closed', () => {
  const d = def(); const provider: ModelProvider = { providerId: 'p', modelId: 'm', generate(input) { return { ...new DeterministicTestModel().generate(input), providerId: 'wrong' }; } };
  const result = new ModelRuntime(new ModelRegistry([d], [provider])).run(req(), pol());
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'PROVENANCE_MISMATCH');
});

test('invalid definitions and requests fail closed', () => {
  assert.throws(() => new ModelRegistry([def({ context: { maxInputUnits: 0 } })], []), /maxInputUnits/);
  const r = new ModelRuntime(new ModelRegistry([def()], [deterministic('p', 'm')]));
  const result = r.run(req({ requestId: '' }), pol()); assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'INVALID_REQUEST');
});

test('routing result has no authorization or execution authority', () => {
  const d = def(); const result = routeModel(req(), new ModelRegistry([d], [deterministic('p', 'm')]), pol());
  for (const key of ['grantedPermissions', 'grantedCapabilities', 'approvalGranted', 'workerId', 'credentialId', 'execute', 'dispatch', 'jobId']) assert.equal(key in result, false);
});

test('runtime has no credential, execution, or dispatch operation and model output remains data', () => {
  const d = def(); const runtime = new ModelRuntime(new ModelRegistry([d], [success('p', 'm')]));
  assert.equal('getCredential' in runtime, false); assert.equal('execute' in runtime, false); assert.equal('dispatch' in runtime, false);
  const result = runtime.run(req(), pol()); assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(result.response.output, { kind: 'test-output', input: { objective: 'test' } });
});

test('unregistered eligible provider is unavailable rather than invented', () => {
  const d = def(); const result = new ModelRuntime(new ModelRegistry([d], [])).run(req({ allowFallback: false }), pol({ allowFallback: false }));
  assert.equal(result.status, 'FAILURE'); assert.equal(result.failure.code, 'MODEL_UNAVAILABLE');
});
