import { describe, expect, it } from 'vitest';
import { AnthropicModelProvider, GovernedRealModelRuntime, OpenAIModelProvider, type AsyncHttpRequest, type AsyncHttpResponse, EnvironmentCredentialBroker, standardRealModelDefinition } from '../src/real-model-providers.js';
import type { CredentialReference } from '../src/provider-credential-foundation.js';

const credential = (providerId: string): CredentialReference => ({ credentialId: `${providerId}-credential`, organizationId: 'org-a', providerId, status: 'ACTIVE', scope: 'model.inference', version: 1 });
const request = { requestId: 'req-303', purpose: 'reasoning', input: 'hello', organizationId: 'org-a', ownerUserId: 'owner-a', timestamp: '2026-09-12T00:00:00.000Z', correlationId: 'corr-303', requiredCapabilities: ['reasoning'] as const, allowFallback: true, timeoutMs: 1000 };
const policy = { policyVersion: 'v3.03-test', allowFallback: true, requireOrganizationMatch: true };

function transportFor(body: unknown, status = 200, capture?: AsyncHttpRequest[]): (r: AsyncHttpRequest) => Promise<AsyncHttpResponse> {
  return async (r) => { capture?.push(r); return { status, body }; };
}

describe('V3.03 real provider adapters', () => {
  it('translates an OpenAI request and keeps the secret in the adapter boundary', async () => {
    const calls: AsyncHttpRequest[] = [];
    const provider = new OpenAIModelProvider('test-model', transportFor({ choices: [{ message: { content: 'hello from openai' } }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }, 200, calls));
    const broker = new EnvironmentCredentialBroker(() => 'SECRET-A');
    const response = await broker.withCredential(credential('openai'), (lease) => provider.generate({ ...request, providerId: 'openai', modelId: 'test-model' }, lease));
    expect(response.status).toBe('SUCCESS'); expect(response.output).toBe('hello from openai'); expect(calls[0]!.headers.authorization).toBe('Bearer SECRET-A');
  });

  it('translates an Anthropic request', async () => {
    const calls: AsyncHttpRequest[] = [];
    const provider = new AnthropicModelProvider('test-model', transportFor({ content: [{ type: 'text', text: 'hello from anthropic' }], usage: { input_tokens: 2, output_tokens: 4 } }, 200, calls));
    const broker = new EnvironmentCredentialBroker(() => 'SECRET-B');
    const response = await broker.withCredential(credential('anthropic'), (lease) => provider.generate({ ...request, providerId: 'anthropic', modelId: 'test-model' }, lease));
    expect(response.output).toBe('hello from anthropic'); expect(calls[0]!.headers['x-api-key']).toBe('SECRET-B');
  });

  it('routes only policy-eligible organization-bound real providers', async () => {
    const provider = new OpenAIModelProvider('model-a', transportFor({ choices: [{ message: { content: 'ok' } }] }));
    const runtime = new GovernedRealModelRuntime([standardRealModelDefinition('openai', 'model-a', 'org-a')], [{ providerId: 'openai', modelId: 'model-a', organizationId: 'org-a', credential: credential('openai'), provider }], new EnvironmentCredentialBroker(() => 'SECRET'));
    const result = await runtime.run(request, policy);
    expect(result.status).toBe('SUCCESS'); expect(result.routing?.selectedProviderId).toBe('openai');
  });

  it('fails closed on organization mismatch before provider invocation', async () => {
    let called = false;
    const provider = new OpenAIModelProvider('model-a', async () => { called = true; return { status: 200, body: { choices: [{ message: { content: 'bad' } }] } }; });
    const runtime = new GovernedRealModelRuntime([standardRealModelDefinition('openai', 'model-a', 'org-a')], [{ providerId: 'openai', modelId: 'model-a', organizationId: 'org-b', credential: credential('openai'), provider }], new EnvironmentCredentialBroker(() => 'SECRET'));
    const result = await runtime.run(request, policy);
    expect(result.status).toBe('FAILURE'); expect(result.failure?.code).toBe('ORG_MISMATCH'); expect(called).toBe(false);
  });

  it('does not expose credential material in model responses or routing', async () => {
    const provider = new OpenAIModelProvider('model-a', transportFor({ choices: [{ message: { content: 'safe result' } }] }));
    const runtime = new GovernedRealModelRuntime([standardRealModelDefinition('openai', 'model-a', 'org-a')], [{ providerId: 'openai', modelId: 'model-a', organizationId: 'org-a', credential: credential('openai'), provider }], new EnvironmentCredentialBroker(() => 'TOP-SECRET'));
    const result = await runtime.run(request, policy);
    expect(JSON.stringify(result)).not.toContain('TOP-SECRET'); expect(JSON.stringify(result)).not.toContain('credential');
  });
});
