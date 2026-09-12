import { randomUUID } from 'node:crypto';
import type { IntelligenceProvider, IntelligenceRequest, IntelligenceProposal } from './v503-intelligence-gateway.js';

export type ProviderRuntimeConfig = {
  openai?: { apiKey: string; model: string };
  anthropic?: { apiKey: string; model: string };
  timeoutMs?: number;
  maxRetries?: number;
};

type ProviderResponse = { content: string; inputTokens?: number; outputTokens?: number };

async function jsonRequest(url: string, init: RequestInit, timeoutMs: number, maxRetries: number): Promise<any> {
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let body: any;
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 2000) }; }
      if (response.ok) return body;
      if (response.status < 500 && response.status !== 429) throw new Error(`Provider request failed (${response.status}).`);
      last = new Error(`Provider request failed (${response.status}).`);
    } catch (error) {
      last = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw last instanceof Error ? last : new Error('Provider request failed.');
}

function proposal(request: IntelligenceRequest, provider: string, content: string, inputTokens?: number, outputTokens?: number): IntelligenceProposal {
  return {
    proposalId: randomUUID(), provider, content, confidence: 0.9,
    correlationId: request.correlationId,
    provenance: { requestId: randomUUID(), policyVersion: 'V5.03-provider-runtime-1', createdAt: new Date().toISOString() },
    ...(inputTokens === undefined && outputTokens === undefined ? {} : { usage: { inputTokens, outputTokens } } as any),
  };
}

export function createOpenAIProvider(config: { apiKey: string; model: string }, options: Pick<ProviderRuntimeConfig, 'timeoutMs' | 'maxRetries'> = {}): IntelligenceProvider {
  const timeoutMs = options.timeoutMs ?? 45000, maxRetries = options.maxRetries ?? 2;
  return { name: 'openai', async propose(request) {
    const body = await jsonRequest('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ model: config.model, input: request.prompt, max_output_tokens: request.maxTokens }),
    }, timeoutMs, maxRetries);
    const content = Array.isArray(body.output) ? body.output.flatMap((x: any) => Array.isArray(x.content) ? x.content : []).map((x: any) => x.text ?? '').join('') : '';
    return proposal(request, 'openai', content, body.usage?.input_tokens, body.usage?.output_tokens);
  }};
}

export function createAnthropicProvider(config: { apiKey: string; model: string }, options: Pick<ProviderRuntimeConfig, 'timeoutMs' | 'maxRetries'> = {}): IntelligenceProvider {
  const timeoutMs = options.timeoutMs ?? 45000, maxRetries = options.maxRetries ?? 2;
  return { name: 'anthropic', async propose(request) {
    const body = await jsonRequest('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ model: config.model, max_tokens: request.maxTokens, messages: [{ role: 'user', content: request.prompt }] }),
    }, timeoutMs, maxRetries);
    const content = Array.isArray(body.content) ? body.content.map((x: any) => x.text ?? '').join('') : '';
    return proposal(request, 'anthropic', content, body.usage?.input_tokens, body.usage?.output_tokens);
  }};
}

export function configuredProviders(config: ProviderRuntimeConfig = {
  openai: process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna' } : undefined,
  anthropic: process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5' } : undefined,
}): IntelligenceProvider[] {
  return [config.openai && createOpenAIProvider(config.openai, config), config.anthropic && createAnthropicProvider(config.anthropic, config)].filter(Boolean) as IntelligenceProvider[];
}

export function createFailoverProvider(providers: IntelligenceProvider[]): IntelligenceProvider {
  if (!providers.length) throw new Error('No intelligence providers are configured.');
  return { name: 'governed-failover', async propose(request) {
    let last: unknown;
    for (const provider of providers) {
      try { return await provider.propose(request); } catch (error) { last = error; }
    }
    throw last instanceof Error ? last : new Error('All intelligence providers failed.');
  }};
}
