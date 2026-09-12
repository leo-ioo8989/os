import type { ModelDefinition, ModelRequirementProfile, ModelResponse, ModelRoutingCandidate, ModelRoutingPolicy } from './model-runtime.js';
import { MODEL_CAPABILITIES, ModelRuntime, ModelRegistry, routeModel } from './model-runtime.js';
import type { ModelRequest, ModelUsageMetadata } from './model.js';
import { validateModelRequest, validateModelResponse } from './model.js';
import type { CredentialReference } from './provider-credential-foundation.js';

export const V3_03_VERSION = 'v3.03';

export interface AsyncHttpRequest {
  url: string;
  method: 'POST';
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMs: number;
}

export interface AsyncHttpResponse {
  status: number;
  body: unknown;
  headers?: Readonly<Record<string, string>>;
}

export type AsyncHttpTransport = (request: AsyncHttpRequest) => Promise<AsyncHttpResponse>;

export interface SecretLease {
  readonly credentialId: string;
  readonly providerId: string;
  readonly secret: string;
}

export interface AsyncCredentialBroker {
  withCredential<T>(reference: CredentialReference, operation: (lease: SecretLease) => Promise<T>): Promise<T>;
}

export interface RealProviderConfig {
  baseUrl?: string;
  defaultTimeoutMs?: number;
}

export interface AsyncModelProvider {
  readonly providerId: string;
  readonly modelId: string;
  generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>, credential: SecretLease): Promise<ModelResponse<TOutput>>;
}

export interface ProviderAdapterFailure {
  code: 'RATE_LIMITED' | 'TIMEOUT' | 'AUTHENTICATION_FAILED' | 'AUTHORIZATION_FAILED' | 'INVALID_REQUEST' | 'PROVIDER_ERROR' | 'RESPONSE_INVALID';
  message: string;
  retryable: boolean;
}

function responseBase(request: ModelRequest, providerId: string, modelId: string, deterministic = false) {
  return {
    requestId: request.requestId,
    providerId,
    modelId,
    timestamp: new Date().toISOString(),
    correlationId: request.correlationId,
    provenance: {
      providerId,
      modelId,
      requestId: request.requestId,
      correlationId: request.correlationId,
      deterministic,
    },
  };
}

function usageFromOpenAi(value: any): ModelUsageMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = typeof value.prompt_tokens === 'number' ? value.prompt_tokens : undefined;
  const output = typeof value.completion_tokens === 'number' ? value.completion_tokens : undefined;
  const total = typeof value.total_tokens === 'number' ? value.total_tokens : undefined;
  if (input === undefined && output === undefined && total === undefined) return undefined;
  return { inputUnits: input, outputUnits: output, totalUnits: total };
}

function usageFromAnthropic(value: any): ModelUsageMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = typeof value.input_tokens === 'number' ? value.input_tokens : undefined;
  const output = typeof value.output_tokens === 'number' ? value.output_tokens : undefined;
  if (input === undefined && output === undefined) return undefined;
  return { inputUnits: input, outputUnits: output, totalUnits: input !== undefined && output !== undefined ? input + output : undefined };
}

function textFromContent(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const text = value.filter((item) => item && typeof item.text === 'string').map((item) => item.text).join('');
    return text || undefined;
  }
  return undefined;
}

export class OpenAIModelProvider implements AsyncModelProvider {
  readonly providerId = 'openai';
  constructor(readonly modelId: string, private readonly transport: AsyncHttpTransport, private readonly config: RealProviderConfig = {}) {}

  async generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>, credential: SecretLease): Promise<ModelResponse<TOutput>> {
    validateModelRequest(request);
    if (credential.providerId !== this.providerId) throw new Error('Credential provider mismatch');
    const timeoutMs = request.timeout?.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const input = typeof request.input === 'string' ? request.input : JSON.stringify(request.input);
    try {
      const response = await this.transport({
        url: `${baseUrl}/chat/completions`, method: 'POST', timeoutMs,
        headers: { authorization: `Bearer ${credential.secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.modelId, messages: [{ role: 'user', content: input }] }),
      });
      if (response.status === 401) throw Object.assign(new Error('Provider authentication failed'), { code: 'AUTHENTICATION_FAILED' });
      if (response.status === 403) throw Object.assign(new Error('Provider authorization failed'), { code: 'AUTHORIZATION_FAILED' });
      if (response.status === 429) throw Object.assign(new Error('Provider rate limit'), { code: 'RATE_LIMITED' });
      if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`OpenAI provider returned HTTP ${response.status}`), { code: 'PROVIDER_ERROR' });
      const body: any = response.body;
      const content = textFromContent(body?.choices?.[0]?.message?.content);
      if (content === undefined) throw Object.assign(new Error('OpenAI response content is invalid'), { code: 'RESPONSE_INVALID' });
      const result: ModelResponse<TOutput> = {
        responseId: `${request.requestId}:response:openai:${this.modelId}`,
        ...responseBase(request, this.providerId, this.modelId), status: 'SUCCESS', output: content as TOutput,
        usage: usageFromOpenAi(body?.usage),
      };
      validateModelResponse(result); return result;
    } catch (error) {
      const e: any = error;
      const code = e?.code ?? 'PROVIDER_ERROR';
      const allowed = ['RATE_LIMITED','TIMEOUT','AUTHENTICATION_FAILED','AUTHORIZATION_FAILED','INVALID_REQUEST','PROVIDER_ERROR','RESPONSE_INVALID'];
      const failureCode = allowed.includes(code) ? code : 'PROVIDER_ERROR';
      const result: ModelResponse<TOutput> = { responseId: `${request.requestId}:failure:openai:${this.modelId}`, ...responseBase(request, this.providerId, this.modelId), status: 'FAILURE', failure: { code: 'PROVIDER_FAILURE', message: `${failureCode}: ${e instanceof Error ? e.message : String(e)}`, retryable: ['RATE_LIMITED','TIMEOUT','PROVIDER_ERROR'].includes(failureCode) } };
      validateModelResponse(result); return result;
    }
  }
}

export class AnthropicModelProvider implements AsyncModelProvider {
  readonly providerId = 'anthropic';
  constructor(readonly modelId: string, private readonly transport: AsyncHttpTransport, private readonly config: RealProviderConfig = {}) {}

  async generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>, credential: SecretLease): Promise<ModelResponse<TOutput>> {
    validateModelRequest(request);
    if (credential.providerId !== this.providerId) throw new Error('Credential provider mismatch');
    const timeoutMs = request.timeout?.timeoutMs ?? this.config.defaultTimeoutMs ?? 60_000;
    const baseUrl = (this.config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    const input = typeof request.input === 'string' ? request.input : JSON.stringify(request.input);
    try {
      const response = await this.transport({
        url: `${baseUrl}/messages`, method: 'POST', timeoutMs,
        headers: { 'x-api-key': credential.secret, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.modelId, max_tokens: 4096, messages: [{ role: 'user', content: input }] }),
      });
      if (response.status === 401) throw Object.assign(new Error('Provider authentication failed'), { code: 'AUTHENTICATION_FAILED' });
      if (response.status === 403) throw Object.assign(new Error('Provider authorization failed'), { code: 'AUTHORIZATION_FAILED' });
      if (response.status === 429) throw Object.assign(new Error('Provider rate limit'), { code: 'RATE_LIMITED' });
      if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`Anthropic provider returned HTTP ${response.status}`), { code: 'PROVIDER_ERROR' });
      const body: any = response.body;
      const content = textFromContent(body?.content);
      if (content === undefined) throw Object.assign(new Error('Anthropic response content is invalid'), { code: 'RESPONSE_INVALID' });
      const result: ModelResponse<TOutput> = {
        responseId: `${request.requestId}:response:anthropic:${this.modelId}`,
        ...responseBase(request, this.providerId, this.modelId), status: 'SUCCESS', output: content as TOutput,
        usage: usageFromAnthropic(body?.usage),
      };
      validateModelResponse(result); return result;
    } catch (error) {
      const e: any = error;
      const code = e?.code ?? 'PROVIDER_ERROR';
      const retryable = ['RATE_LIMITED','TIMEOUT','PROVIDER_ERROR'].includes(code);
      const result: ModelResponse<TOutput> = { responseId: `${request.requestId}:failure:anthropic:${this.modelId}`, ...responseBase(request, this.providerId, this.modelId), status: 'FAILURE', failure: { code: 'PROVIDER_FAILURE', message: `${code}: ${e instanceof Error ? e.message : String(e)}`, retryable } };
      validateModelResponse(result); return result;
    }
  }
}

export class FetchHttpTransport {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  async request(request: AsyncHttpRequest): Promise<AsyncHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await this.fetchImpl(request.url, { method: request.method, headers: request.headers, body: request.body, signal: controller.signal });
      let body: unknown;
      const text = await response.text();
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: response.status, body };
    } catch (error) {
      if ((error as any)?.name === 'AbortError') throw Object.assign(new Error('Provider request timed out'), { code: 'TIMEOUT' });
      throw error;
    } finally { clearTimeout(timer); }
  }
}

export class EnvironmentCredentialBroker implements AsyncCredentialBroker {
  constructor(private readonly secretResolver: (reference: CredentialReference) => string | undefined) {}
  async withCredential<T>(reference: CredentialReference, operation: (lease: SecretLease) => Promise<T>): Promise<T> {
    if (reference.status !== 'ACTIVE') throw new Error(`Credential ${reference.credentialId} is not active`);
    const secret = this.secretResolver(reference);
    if (!secret) throw new Error('Credential secret unavailable');
    return operation({ credentialId: reference.credentialId, providerId: reference.providerId, secret });
  }
}

export interface AsyncProviderBinding {
  providerId: string;
  modelId: string;
  organizationId: string;
  credential: CredentialReference;
  provider: AsyncModelProvider;
}

export interface AsyncProviderRuntimeResult<T = unknown> {
  status: 'SUCCESS' | 'FAILURE';
  response?: ModelResponse<T>;
  routing?: { selectedProviderId: string; selectedModelId: string; eligibleModels: readonly ModelRoutingCandidate[]; policyVersion: string };
  attemptedModels: readonly ModelRoutingCandidate[];
  failure?: { code: string; message: string; retryable: boolean };
}

export class GovernedRealModelRuntime {
  private readonly legacyRuntime: ModelRuntime;
  constructor(private readonly definitions: readonly ModelDefinition[], private readonly bindings: readonly AsyncProviderBinding[], private readonly credentialBroker: AsyncCredentialBroker) {
    this.legacyRuntime = new ModelRuntime(new ModelRegistry([], []));
  }

  private eligible(requirement: ModelRequirementProfile, policy: ModelRoutingPolicy): ModelDefinition[] {
    const qualityRank: Record<string, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };
    return this.definitions.filter((d) => {
      if (d.availability !== 'AVAILABLE') return false;
      if (policy.allowedProviderIds && !policy.allowedProviderIds.includes(d.providerId)) return false;
      if (policy.allowedModelIds && !policy.allowedModelIds.includes(d.modelId)) return false;
      if (policy.allowedQualityTiers && !policy.allowedQualityTiers.includes(d.qualityTier)) return false;
      if (policy.requireOrganizationMatch && d.organizationId !== undefined && d.organizationId !== requirement.organizationId) return false;
      if (!requirement.requiredCapabilities.every((c) => d.capabilities.includes(c))) return false;
      if (requirement.minimumQualityTier && qualityRank[d.qualityTier] < qualityRank[requirement.minimumQualityTier]) return false;
      if (requirement.maxCost !== undefined && d.cost.costPerInputUnit > requirement.maxCost) return false;
      return true;
    });
  }

  async run<T = unknown>(requirement: ModelRequirementProfile, policy: ModelRoutingPolicy): Promise<AsyncProviderRuntimeResult<T>> {
    const candidates = this.eligible(requirement, policy).sort((a,b) => `${a.providerId}:${a.modelId}`.localeCompare(`${b.providerId}:${b.modelId}`));
    const routing = candidates.length ? { selectedProviderId: candidates[0]!.providerId, selectedModelId: candidates[0]!.modelId, eligibleModels: candidates.map((d) => ({ providerId: d.providerId, modelId: d.modelId, reason: 'policy/capability eligible' })), policyVersion: policy.policyVersion } : undefined;
    if (!routing) return { status: 'FAILURE', attemptedModels: [], failure: { code: 'NO_ELIGIBLE_MODEL', message: 'No eligible real model', retryable: false } };
    const attempted: ModelRoutingCandidate[] = [];
    const max = requirement.allowFallback && policy.allowFallback ? candidates.length : 1;
    for (let i=0; i<max; i++) {
      const definition = candidates[i]!; const candidate = { providerId: definition.providerId, modelId: definition.modelId, reason: 'policy/capability eligible' }; attempted.push(candidate);
      const binding = this.bindings.find((b) => b.providerId === definition.providerId && b.modelId === definition.modelId);
      if (!binding) { if (i + 1 < max) continue; return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'MODEL_UNAVAILABLE', message: 'No authorized provider binding exists', retryable: false } }; }
      if (binding.organizationId !== requirement.organizationId || binding.credential.organizationId !== requirement.organizationId) return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'ORG_MISMATCH', message: 'Provider binding organization does not match authoritative request organization', retryable: false } };
      if (binding.credential.providerId !== binding.providerId) return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'CREDENTIAL_PROVIDER_MISMATCH', message: 'Credential is bound to a different provider', retryable: false } };
      const modelRequest: ModelRequest = { requestId: requirement.requestId, providerId: definition.providerId, modelId: definition.modelId, purpose: requirement.purpose, input: requirement.input, context: requirement.context, organizationId: requirement.organizationId, ownerUserId: requirement.ownerUserId, timestamp: requirement.timestamp, correlationId: requirement.correlationId, ...(requirement.timeoutMs ? { timeout: { timeoutMs: requirement.timeoutMs } } : {}) };
      try {
        const response = await this.credentialBroker.withCredential(binding.credential, (lease) => binding.provider.generate(modelRequest, lease));
        validateModelResponse(response);
        if (response.providerId !== definition.providerId || response.modelId !== definition.modelId || response.requestId !== requirement.requestId || response.correlationId !== requirement.correlationId || response.provenance.providerId !== definition.providerId || response.provenance.modelId !== definition.modelId) return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'PROVENANCE_MISMATCH', message: 'Real provider response provenance does not match routed identity', retryable: false } };
        if (response.status === 'SUCCESS') return { status: 'SUCCESS', response: response as ModelResponse<T>, routing, attemptedModels: attempted };
        if (requirement.allowFallback && policy.allowFallback && response.failure?.retryable && i + 1 < max) continue;
        return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: response.failure?.code ?? 'PROVIDER_FAILURE', message: response.failure?.message ?? 'Provider failed', retryable: response.failure?.retryable ?? false } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (requirement.allowFallback && policy.allowFallback && i + 1 < max) continue;
        return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'PROVIDER_FAILURE', message, retryable: true } };
      }
    }
    return { status: 'FAILURE', routing, attemptedModels: attempted, failure: { code: 'FALLBACK_EXHAUSTED', message: 'All eligible real providers failed', retryable: false } };
  }
}

export function standardRealModelDefinition(providerId: string, modelId: string, organizationId: string): ModelDefinition {
  return { providerId, modelId, organizationId, capabilities: [...MODEL_CAPABILITIES], qualityTier: 'PREMIUM', cost: { costPerInputUnit: 0, costPerOutputUnit: 0, currency: 'USD' }, latency: { expectedLatencyMs: 10_000 }, availability: 'AVAILABLE', context: { maxInputUnits: 200_000 }, version: 'v1', provenance: `${V3_03_VERSION}:${providerId}:${modelId}` };
}
