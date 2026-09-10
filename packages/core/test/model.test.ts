import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DeterministicTestModel,
  validateModelRequest,
  validateModelResponse,
  type ModelRequest,
} from '../src/index.js';

const request = (overrides: Partial<ModelRequest> = {}): ModelRequest => ({
  requestId: 'model-request-1',
  providerId: 'deterministic-test-provider',
  modelId: 'deterministic-test-model-v1',
  purpose: 'plan-proposal',
  input: { outcome: 'Prepare the weekly company report', priority: 'MEDIUM' },
  organizationId: 'org-a',
  ownerUserId: 'owner-1',
  timestamp: '2026-09-10T12:00:00.000Z',
  correlationId: 'trace-model-1',
  timeout: { timeoutMs: 5000 },
  ...overrides,
});

test('model request validates required identity and governance metadata', () => {
  assert.doesNotThrow(() => validateModelRequest(request()));
  assert.throws(() => validateModelRequest(request({ requestId: '' })), /missing required/);
  assert.throws(() => validateModelRequest(request({ timeout: { timeoutMs: 0 } })), /timeoutMs/);
});

test('deterministic test model produces a successful structured response', () => {
  const response = new DeterministicTestModel().generate(request());
  assert.equal(response.status, 'SUCCESS');
  assert.deepEqual(response.output, { kind: 'deterministic-test-output', input: request().input });
  assert.equal(response.requestId, request().requestId);
  assert.equal(response.providerId, 'deterministic-test-provider');
  assert.equal(response.modelId, 'deterministic-test-model-v1');
  assert.equal(response.provenance.deterministic, true);
  assert.equal(response.provenance.testProvenance, 'deterministic-test-model-v1');
  assert.doesNotThrow(() => validateModelResponse(response));
});

test('same normalized request produces the same deterministic response', () => {
  const model = new DeterministicTestModel();
  const first = model.generate(request());
  const second = model.generate(request());
  assert.deepEqual(first, second);
});

test('model response provenance correlates request, response, provider, and model', () => {
  const response = new DeterministicTestModel().generate(request());
  assert.equal(response.provenance.requestId, response.requestId);
  assert.equal(response.provenance.correlationId, response.correlationId);
  assert.equal(response.provenance.providerId, response.providerId);
  assert.equal(response.provenance.modelId, response.modelId);
  assert.equal(response.responseId, 'model-request-1:response:deterministic-test-provider:deterministic-test-model-v1');
});

test('deterministic provider failure is represented as failure data', () => {
  const model = new DeterministicTestModel({
    failure: { code: 'PROVIDER_UNAVAILABLE', message: 'test provider unavailable', retryable: true },
  });
  const response = model.generate(request());
  assert.equal(response.status, 'FAILURE');
  assert.equal(response.output, undefined);
  assert.deepEqual(response.failure, {
    code: 'PROVIDER_UNAVAILABLE',
    message: 'test provider unavailable',
    retryable: true,
  });
  assert.doesNotThrow(() => validateModelResponse(response));
});

test('failure remains distinguishable from success and is not silently converted', () => {
  const response = new DeterministicTestModel({
    failure: { code: 'TIMEOUT', message: 'deterministic timeout' },
  }).generate(request());
  assert.equal(response.status, 'FAILURE');
  assert.equal(response.failure?.code, 'TIMEOUT');
  assert.equal(response.output, undefined);
});

test('invalid response shape fails closed', () => {
  assert.throws(() => validateModelResponse({
    responseId: 'response-1',
    requestId: 'request-1',
    providerId: 'provider',
    modelId: 'model',
    status: 'SUCCESS',
    timestamp: '2026-09-10T12:00:00.000Z',
    correlationId: 'trace',
    provenance: {
      providerId: 'provider',
      modelId: 'model',
      requestId: 'request-1',
      correlationId: 'trace',
      deterministic: true,
    },
  }), /must contain output/);
});
