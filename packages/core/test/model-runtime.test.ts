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

const baseDefinition = (overrides: Partial<ModelDefinition> = {}): ModelDefinition => ({
  providerId: 'provider-a',
  modelId: 'model-a',
  capabilities: ['reasoning', 'structured_output'],
  qualityTier: 'STANDARD',
  cost: { costPerInputUnit: 0.10, costPerOutputUnit: 0.20, currency: 'TEST' },
  latency: { expectedLatencyMs: 1000 },
  availability: 'AVAILABLE',
  context: { maxInputUnits: 10000 },
  version: '1',
  provenance: 'test-registry-v1',
  ...overrides,
});

const requirement = (overrides: Record<string, unknown> = {}) => ({
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

function providerWithFailure(providerId: string, modelId: string, code: 'PROVIDER_UNAVAILABLE' | 'TIMEOUT' | 'PROVIDER_FAILURE'): ModelProvider {
  return {
    providerId,
    modelId,
    generate(request: ModelRequest): ModelResponse {
      return {
        responseId: `${request.requestId}:failure`,
        requestId: request.requestId,
        providerId,
        modelId,
        status: 'FAILURE',
        failure: { code, message: code, retryable: true },
        timestamp: request.timestamp,
        correlationId: request.correlationId,
        provenance: { providerId, modelId, requestId: request.requestId, correlationId: request.correlationId, deterministic: true },
      };
    },
  };
}

test('model capability matching selects a model with required capabilities', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = routeModel(requirement(), registry, policy());
  assert.equal(result.selectedModelId, 'model-a');
});

test('required capability mismatch rejects the model', () => {
  const registry = new ModelRegistry([baseDefinition({ capabilities: ['reasoning'] })], [new DeterministicTestModel()]);
  assert.throws(() => routeModel(requirement({ requiredCapabilities: ['vision'] }), registry, policy()), /NO_ELIGIBLE_MODEL/);
});

test('preferred capability ranking is deterministic', () => {
  const a = baseDefinition({ providerId: 'p-a', modelId: 'a', capabilities: ['reasoning'], qualityTier: 'PREMIUM' });
  const b = baseDefinition({ providerId: 'p-b', modelId: 'b', capabilities: ['reasoning', 'vision'], qualityTier: 'PREMIUM' });
  const registry = new ModelRegistry([a, b], [new DeterministicTestModel()]);
  const result = routeModel(requirement({ preferredCapabilities: ['vision'] }), registry, policy());
  assert.equal(result.selectedModelId, 'b');
});

test('quality tier is part of deterministic routing', () => {
  const basic = baseDefinition({ providerId: 'p-a', modelId: 'basic', qualityTier: 'BASIC' });
  const premium = baseDefinition({ providerId: 'p-b', modelId: 'premium', qualityTier: 'PREMIUM' });
  const registry = new ModelRegistry([basic, premium], [new DeterministicTestModel()]);
  assert.equal(routeModel(requirement(), registry, policy()).selectedModelId, 'premium');
});

test('budget-aware routing excludes models above the maximum cost', () => {
  const expensive = baseDefinition({ providerId: 'p-a', modelId: 'expensive', cost: { costPerInputUnit: 2, costPerOutputUnit: 2, currency: 'TEST' } });
  const cheap = baseDefinition({ providerId: 'p-b', modelId: 'cheap', cost: { costPerInputUnit: 0.01, costPerOutputUnit: 0.01, currency: 'TEST' } });
  const registry = new ModelRegistry([expensive, cheap], [new DeterministicTestModel()]);
  assert.equal(routeModel(requirement({ maxCost: 0.05 }), registry, policy()).selectedModelId, 'cheap');
});

test('latency-sensitive routing prefers lower latency after capability and quality ranking', () => {
  const slow = baseDefinition({ providerId: 'p-a', modelId: 'slow', latency: { expectedLatencyMs: 3000 } });
  const fast = baseDefinition({ providerId: 'p-b', modelId: 'fast', latency: { expectedLatencyMs: 100 } });
  const registry = new ModelRegistry([slow, fast], [new DeterministicTestModel()]);
  assert.equal(routeModel(requirement({ latencySensitive: true }), registry, policy()).selectedModelId, 'fast');
});

test('provider and model allowlists determine eligibility', () => {
  const a = baseDefinition({ providerId: 'p-a', modelId: 'a' });
  const b = baseDefinition({ providerId: 'p-b', modelId: 'b' });
  const registry = new ModelRegistry([a, b], [new DeterministicTestModel()]);
  const result = routeModel(requirement(), registry, policy({ allowedProviderIds: ['p-b'], allowedModelIds: ['b'] }));
  assert.equal(result.selectedProviderId, 'p-b');
  assert.equal(result.selectedModelId, 'b');
});

test('same request, registry, and policy produce the same routing result', () => {
  const registry = new ModelRegistry([baseDefinition(), baseDefinition({ providerId: 'provider-b', modelId: 'model-b', qualityTier: 'PREMIUM' })], [new DeterministicTestModel()]);
  assert.deepEqual(routeModel(requirement(), registry, policy()), routeModel(requirement(), registry, policy()));
});

test('no eligible model fails closed', () => {
  const registry = new ModelRegistry([baseDefinition({ availability: 'UNAVAILABLE' })], [new DeterministicTestModel()]);
  const result = new ModelRuntime(registry).run(requirement(), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'NO_ELIGIBLE_MODEL');
});

test('routing policy can reject requests requiring authoritative organization identity', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = new ModelRuntime(registry).run(requirement({ organizationId: undefined }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'ROUTING_POLICY_REJECTED');
});

test('provider failure is structured and does not become execution', () => {
  const definition = baseDefinition();
  const provider = providerWithFailure(definition.providerId, definition.modelId, 'PROVIDER_FAILURE');
  const result = new ModelRuntime(new ModelRegistry([definition], [provider])).run(requirement({ allowFallback: false }), policy({ allowFallback: false }));
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'PROVIDER_FAILURE');
});

test('timeout is represented as a structured runtime failure', () => {
  const definition = baseDefinition();
  const provider = providerWithFailure(definition.providerId, definition.modelId, 'TIMEOUT');
  const result = new ModelRuntime(new ModelRegistry([definition], [provider])).run(requirement({ allowFallback: false }), policy({ allowFallback: false }));
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'TIMEOUT');
});

test('fallback succeeds only with another eligible model', () => {
  const first = baseDefinition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = baseDefinition({ providerId: 'p-b', modelId: 'b', qualityTier: 'STANDARD' });
  const fallbackProvider = new DeterministicTestModel();
  const failing = providerWithFailure('p-a', 'a', 'PROVIDER_UNAVAILABLE');
  Object.defineProperty(fallbackProvider, 'providerId', { value: 'p-b' });
  Object.defineProperty(fallbackProvider, 'modelId', { value: 'b' });
  const result = new ModelRuntime(new ModelRegistry([first, second], [failing, fallbackProvider])).run(requirement(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.response.providerId, 'p-b');
  assert.equal(result.attemptedModels.length, 2);
});

test('fallback exhaustion fails closed', () => {
  const first = baseDefinition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = baseDefinition({ providerId: 'p-b', modelId: 'b', qualityTier: 'STANDARD' });
  const result = new ModelRuntime(new ModelRegistry([first, second], [providerWithFailure('p-a', 'a', 'PROVIDER_FAILURE'), providerWithFailure('p-b', 'b', 'PROVIDER_FAILURE')])).run(requirement(), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'FALLBACK_EXHAUSTED');
  assert.equal(result.attemptedModels.length, 2);
});

test('fallback cannot bypass provider/model policy', () => {
  const first = baseDefinition({ providerId: 'p-a', modelId: 'a' });
  const blocked = baseDefinition({ providerId: 'p-b', modelId: 'b' });
  const result = new ModelRuntime(new ModelRegistry([first, blocked], [providerWithFailure('p-a', 'a', 'PROVIDER_FAILURE'), new DeterministicTestModel()])).run(requirement(), policy({ allowedProviderIds: ['p-a'] }));
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'FALLBACK_EXHAUSTED');
  assert.equal(result.attemptedModels.length, 1);
});

test('provenance is preserved from request through routing and response', () => {
  const definition = baseDefinition();
  const provider = new DeterministicTestModel();
  const result = new ModelRuntime(new ModelRegistry([definition], [provider])).run(requirement({ requestId: 'req-provenance', correlationId: 'corr-provenance' }), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.routing.provenance.requestId, 'req-provenance');
  assert.equal(result.response.requestId, 'req-provenance');
  assert.equal(result.response.correlationId, 'corr-provenance');
});

test('provenance mismatch fails closed', () => {
  const definition = baseDefinition();
  const provider: ModelProvider = {
    providerId: definition.providerId,
    modelId: definition.modelId,
    generate(request) {
      return {
        ...new DeterministicTestModel().generate(request),
        providerId: 'wrong-provider',
      };
    },
  };
  const result = new ModelRuntime(new ModelRegistry([definition], [provider])).run(requirement(), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'PROVENANCE_MISMATCH');
});

test('organization isolation excludes organization-owned model definitions from another organization', () => {
  const orgB = baseDefinition({ providerId: 'p-b', modelId: 'b', organizationId: 'org-b' });
  const registry = new ModelRegistry([orgB], [new DeterministicTestModel()]);
  const result = new ModelRuntime(registry).run(requirement({ organizationId: 'org-a' }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'NO_ELIGIBLE_MODEL');
});

test('routing result contains no permission, capability grant, approval, worker, credential, execute, or dispatch authority', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = routeModel(requirement(), registry, policy());
  for (const key of ['grantedPermissions', 'grantedCapabilities', 'approvalGranted', 'workerId', 'credentialId', 'execute', 'dispatch']) {
    assert.equal(key in result, false);
  }
});

test('model capability metadata does not become an authorization grant', () => {
  const registry = new ModelRegistry([baseDefinition({ capabilities: ['coding', 'tool_use'] })], [new DeterministicTestModel()]);
  const result = routeModel(requirement({ requiredCapabilities: ['coding'] }), registry, policy());
  assert.equal(result.selectedModelId, 'model-a');
  assert.equal('grantedCapabilities' in result, false);
});

test('routing does not approve work', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = routeModel(requirement(), registry, policy());
  assert.equal('approvalGranted' in result, false);
});

test('routing does not execute or dispatch work', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = new ModelRuntime(registry).run(requirement(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.equal('execute' in result, false);
  assert.equal('dispatch' in result, false);
  assert.equal('jobId' in result, false);
});

test('routing does not access credentials', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const runtime = new ModelRuntime(registry);
  assert.equal('getCredential' in runtime, false);
  assert.equal('credentialId' in runtime, false);
});

test('model output remains provider response data', () => {
  const definition = baseDefinition();
  const provider = new DeterministicTestModel();
  const result = new ModelRuntime(new ModelRegistry([definition], [provider])).run(requirement(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(result.response.output, { kind: 'deterministic-test-output', input: { objective: 'test' } });
});

test('invalid routing input fails closed', () => {
  const registry = new ModelRegistry([baseDefinition()], [new DeterministicTestModel()]);
  const result = new ModelRuntime(registry).run(requirement({ requestId: '' }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'INVALID_REQUEST');
});

test('unregistered eligible provider fails closed', () => {
  const definition = baseDefinition();
  const result = new ModelRuntime(new ModelRegistry([definition], [])).run(requirement({ allowFallback: false }), policy({ allowFallback: false }));
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'MODEL_UNAVAILABLE');
});

test('fallback is disabled when either request or policy disallows it', () => {
  const first = baseDefinition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = baseDefinition({ providerId: 'p-b', modelId: 'b' });
  const result = new ModelRuntime(new ModelRegistry([first, second], [providerWithFailure('p-a', 'a', 'PROVIDER_FAILURE'), new DeterministicTestModel()])).run(requirement({ allowFallback: false }), policy());
  assert.equal(result.status, 'FAILURE');
  assert.equal(result.failure.code, 'PROVIDER_FAILURE');
  assert.equal(result.attemptedModels.length, 1);
});

test('fallback preserves traceable attempted model order', () => {
  const first = baseDefinition({ providerId: 'p-a', modelId: 'a', qualityTier: 'PREMIUM' });
  const second = baseDefinition({ providerId: 'p-b', modelId: 'b', qualityTier: 'STANDARD' });
  const providerB = new DeterministicTestModel();
  Object.defineProperty(providerB, 'providerId', { value: 'p-b' });
  Object.defineProperty(providerB, 'modelId', { value: 'b' });
  const result = new ModelRuntime(new ModelRegistry([first, second], [providerWithFailure('p-a', 'a', 'TIMEOUT'), providerB])).run(requirement(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(result.attemptedModels.map((item) => item.modelId), ['a', 'b']);
});

test('runtime has no execution side effects through its public result contract', () => {
  const definition = baseDefinition();
  const result = new ModelRuntime(new ModelRegistry([definition], [new DeterministicTestModel()])).run(requirement(), policy());
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(Object.keys(result.routing).sort(), ['correlationId', 'eligibleModels', 'fallbackAllowed', 'organizationId', 'policyVersion', 'provenance', 'requestId', 'selectedModelId', 'selectedProviderId', 'selectionReason'].sort());
});
