import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DeterministicTestModel,
  ModelRegistry,
  ModelRuntime,
  routeModel,
  type ModelDefinition,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
} from '../src/index.js';

const definition = (overrides: Partial<ModelDefinition> = {}): ModelDefinition => ({
  providerId: 'deterministic-test-provider',
  modelId: 'deterministic-test-model-v1',
  capabilities: ['reasoning', 'structured_output'],
  qualityTier: 'STANDARD',
  cost: { costPerInputUnit: 0.1, costPerOutputUnit: 0.2, currency: 'TEST' },
  latency: { expectedLatencyMs: 1000 },
  availability: 'AVAILABLE',
  context: { maxInputUnits: 10000 },
  version: '1',
  provenance: 'test-registry-v1',
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  requestId: 'runtime-request-1',
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  purpose: 'test-reasoning',
  requiredCapabilities: ['reasoning'] as const,
  preferredCapabilities: [] as const,
  minimumQualityTier: 'BASIC' as const,
  latencySensitive: false,
  maxCost: 1,
  allowFallback: true,
  timestamp: '2026-09-10T12:00:00.000Z',
  correlationId: 'runtime-trace-1',
  input: { objective: 'test' },
  ...overrides,
});

const policy = (overrides: Partial<Parameters<typeof routeModel>[2]> = {}) => ({
  policyVersion: 'routing-v1',
  allowFallback: true,
  requireOrganizationMatch: true,
  ...overrides,
});

function deterministicProvider(providerId: string, modelId: string): ModelProvider {
  const model = new DeterministicTestModel();
  return {
    providerId,
    modelId,
    generate(input: ModelRequest): ModelResponse {
      return model.generate({ ...input, providerId, modelId });
    },
  };
}

function failingProvider(providerId: string, modelId: string, code: 'PROVIDER_UNAVAILABLE' | 'TIMEOUT' | 'PROVIDER_FAILURE'): ModelProvider {
  return {
    providerId,
    modelId,
    generate(input) {
      return {
        responseId: `${input.requestId}:failure`, requestId: input.requestId, providerId, modelId,
        status: 'FAILURE', failure: { code, message: code, retryable: true }, timestamp: input.timestamp,
        correlationId: input.correlationId,
        provenance: { providerId, modelId, requestId: input.requestId, correlationId: input.correlationId, deterministic: true },
      };
    },
  };
}

test('required capabilities and invalid capabilities are enforced', () => {
  const registry = new ModelRegistry([definition()], [deterministicProvider('deterministic-test-provider', 'deterministic-test-model-v1')]);
  assert.equal(routeModel(request(), registry, policy()).selectedModelId, 'deterministic-test-model-v1');
  assert.throws(() => routeModel(request({ requiredCapabilities: ['vision'] }), registry, policy()), /NO_ELIGIBLE_MODEL/);
});

test('preferred capability, quality, latency and cost participate deterministically', () => {
  const models = [
    definition({ providerId: 'p-a', modelId: 'slow-premium', capabilities: ['reasoning'], qualityTier: 'PREMIUM', latency: { expectedLatencyMs: 3000 }, cost: { costPerInputUnit: 0.01, costPerOutputUnit: 0.01, currency: 'TEST' } }),
    definition({ providerId: 'p-b', modelId: 'fast-standard-vision', capabilities: ['reasoning', 'vision'], qualityTier: 'STANDARD', latency: { expectedLatencyMs: 100 }, cost: { costPerInputUnit: 0.02, costPerOutputUnit: 0.02, currency: 'TEST' } }),
    definition({ providerId: 'p-c', modelId: 'over-budget', capabilities: ['reasoning', 'vision'], qualityTier: 'PREMIUM', cost: { costPerInputUnit: 2, costPerOutputUnit: 2, currency: 'TEST' } }),
  ];
  const registry = new ModelRegistry(models, models.map((m) => deterministicProvider(m.providerId, m.modelId)));
  const routed = routeModel(request({ preferredCapabilities: ['vision'], latencySensitive: true, maxCost: 0.05 }), registry, policy());
  assert.equal(routed.selectedModelId, 'fast-standard-vision');
  assert.deepEqual(routed, routeModel(request({ preferredCapabilities: ['vision'], latencySensitive: true, maxCost: 0.05 }), registry, policy()));
});

test('provider and model eligibility is policy controlled', () => {
  const a = definition({ providerId: 'p-a', modelId: 'a' });
  const b = definition({ providerId: 'p-b', modelId: 'b' });
  const registry = new ModelRegistry([a, b], [deterministicProvider('p-a', 'a'), deterministicProvider('p-b', 'b')]);
  const result = routeModel(request(), registry, policy({ allowedProviderIds: ['p-b'], allowedModelIds: ['b'], allowedQualityTiers: ['STANDARD'] }));
  assert.equal(result.selectedProviderId, 'p-b');
  assert.equal(result.selectedModelId, 'b');
});

test('organization-owned models cannot cross organizations', () => {
  const orgB = definition({ providerId: 'p-b', modelId: 'b', organizationId: 'org-b' });
  const registry = new ModelRegistry([orgB], [deterministicProvider('p-b', 'b')]);
  assert.equal(new ModelRuntime(registry).run(request({ organizationId: 'org-a' }), policy()).status, 'FAILURE');
  assert.equal(new ModelRuntime(registry).run(request({ organizationId: 'org-a' }), policy()).failure.code, 'NO_ELIGIBLE_MODEL');
});

test('missing authoritative organization context is rejected by routing policy', () => {
  const registry = new ModelRegistry([definition()], [deterministicProvider('deterministic-test-provider', 'deterministic-test-model-v1')]);
  const result = new ModelRuntime(registry).run(request({ organizationId: undefined }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'ROUTING_POLICY_REJECTED');
});

test('provider failure, timeout and model unavailability fail closed', () => {
  for (const code of ['PROVIDER_FAILURE', 'TIMEOUT'] as const) {
    const d = definition();
    const result = new ModelRuntime(new ModelRegistry([d], [failingProvider(d.providerId, d.modelId, code)])).run(request({ allowFallback: false }), policy({ allowFallback: false }));
    assert.equal(result.status, 'FAILURE');
    assert.equal(result.failure.code, code);
  }
  const unavailable = definition({ availability: 'UNAVAILABLE' });
  const result = new ModelRuntime(new ModelRegistry([unavailable], [deterministicProvider(unavailable.providerId, unavailable.modelId)])).run(request(), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'NO_ELIGIBLE_MODEL');
});

test('fallback succeeds only among eligible candidates and preserves attempts', () => {
  const first = definition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = definition({ providerId: 'p-b', modelId: 'b', qualityTier: 'STANDARD' });
  const result = new ModelRuntime(new ModelRegistry([first, second], [failingProvider('p-a', 'a', 'PROVIDER_UNAVAILABLE'), deterministicProvider('p-b', 'b')])).run(request(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.response.providerId, 'p-b');
  assert.deepEqual(result.attemptedModels.map((m) => m.modelId), ['a', 'b']);
});

test('fallback exhaustion and fallback policy boundaries fail closed', () => {
  const first = definition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = definition({ providerId: 'p-b', modelId: 'b' });
  const registry = new ModelRegistry([first, second], [failingProvider('p-a', 'a', 'PROVIDER_FAILURE'), failingProvider('p-b', 'b', 'PROVIDER_FAILURE')]);
  const exhausted = new ModelRuntime(registry).run(request(), policy());
  assert.equal(exhausted.status, 'FAILURE');
  assert.equal(exhausted.failure.code, 'FALLBACK_EXHAUSTED');
  const disabled = new ModelRuntime(registry).run(request({ allowFallback: false }), policy());
  assert.equal(disabled.status, 'FAILURE');
  assert.equal(disabled.failure.code, 'PROVIDER_FAILURE');
});

test('fallback cannot bypass routing policy', () => {
  const first = definition({ providerId: 'p-a', modelId: 'a' });
  const blocked = definition({ providerId: 'p-b', modelId: 'b' });
  const result = new ModelRuntime(new ModelRegistry([first, blocked], [failingProvider('p-a', 'a', 'PROVIDER_FAILURE'), deterministicProvider('p-b', 'b')])).run(request(), policy({ allowedProviderIds: ['p-a'] }));
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'FALLBACK_EXHAUSTED');
  assert.equal(result.attemptedModels.length, 1);
});

test('provenance is preserved and mismatches fail closed', () => {
  const d = definition();
  const good = new ModelRuntime(new ModelRegistry([d], [deterministicProvider(d.providerId, d.modelId)])).run(request({ requestId: 'req-p', correlationId: 'corr-p' }), policy());
  assert.equal(good.status, 'SUCCESS');
  assert.equal(good.routing.provenance.requestId, 'req-p');
  assert.equal(good.response.requestId, 'req-p');
  const bad: ModelProvider = {
    providerId: d.providerId, modelId: d.modelId,
    generate(input) { return { ...new DeterministicTestModel().generate(input), providerId: 'wrong-provider' }; },
  };
  const mismatch = new ModelRuntime(new ModelRegistry([d], [bad])).run(request(), policy());
  assert.equal(mismatch.status, 'FAILURE');
  assert.equal(mismatch.failure.code, 'PROVENANCE_MISMATCH');
});

test('routing and runtime expose no authority or execution operations', () => {
  const d = definition();
  const registry = new ModelRegistry([d], [deterministicProvider(d.providerId, d.modelId)]);
  const routed = routeModel(request(), registry, policy());
  for (const key of ['grantedPermissions', 'grantedCapabilities', 'approvalGranted', 'workerId', 'credentialId', 'execute', 'dispatch']) assert.equal(key in routed, false);
  const runtime = new ModelRuntime(registry);
  assert.equal('getCredential' in runtime, false);
  const result = runtime.run(request(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.equal('jobId' in result, false);
  assert.equal('execute' in result, false);
  assert.equal('dispatch' in result, false);
});

test('model output remains data and runtime performs no execution side effect', () => {
  const d = definition();
  let calls = 0;
  const provider: ModelProvider = { providerId: d.providerId, modelId: d.modelId, generate(input) { calls += 1; return new DeterministicTestModel().generate(input); } };
  const result = new ModelRuntime(new ModelRegistry([d], [provider])).run(request(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(result.response.output, { kind: 'deterministic-test-output', input: { objective: 'test' } });
  assert.equal(calls, 1);
});

test('invalid model definitions and requests fail closed', () => {
  assert.throws(() => new ModelRegistry([definition({ context: { maxInputUnits: 0 } })], []), /maxInputUnits/);
  const registry = new ModelRegistry([definition()], [deterministicProvider('deterministic-test-provider', 'deterministic-test-model-v1')]);
  const result = new ModelRuntime(registry).run(request({ requestId: '' }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'INVALID_REQUEST');
});
