import type {
  ModelFailure,
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from './model.js';
import { validateModelRequest, validateModelResponse } from './model.js';

export const MODEL_CAPABILITIES = [
  'reasoning',
  'structured_output',
  'long_context',
  'vision',
  'coding',
  'tool_use',
] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export const MODEL_QUALITY_TIERS = ['BASIC', 'STANDARD', 'PREMIUM'] as const;
export type ModelQualityTier = (typeof MODEL_QUALITY_TIERS)[number];

export const MODEL_AVAILABILITY = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type ModelAvailability = (typeof MODEL_AVAILABILITY)[number];

export const MODEL_RUNTIME_FAILURE_CODES = [
  'NO_ELIGIBLE_MODEL',
  'ROUTING_POLICY_REJECTED',
  'PROVIDER_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'TIMEOUT',
  'INVALID_REQUEST',
  'INVALID_RESPONSE',
  'PROVIDER_FAILURE',
  'PROVENANCE_MISMATCH',
  'FALLBACK_EXHAUSTED',
] as const;
export type ModelRuntimeFailureCode = (typeof MODEL_RUNTIME_FAILURE_CODES)[number];

export interface ModelCostMetadata {
  costPerInputUnit: number;
  costPerOutputUnit: number;
  currency: string;
}

export interface ModelLatencyMetadata {
  expectedLatencyMs: number;
}

export interface ModelContextMetadata {
  maxInputUnits: number;
}

export interface ModelDefinition {
  providerId: string;
  modelId: string;
  capabilities: readonly ModelCapability[];
  qualityTier: ModelQualityTier;
  cost: ModelCostMetadata;
  latency: ModelLatencyMetadata;
  availability: ModelAvailability;
  context: ModelContextMetadata;
  version: string;
  provenance: string;
  organizationId?: string;
}

export interface ModelRequirementProfile {
  requestId: string;
  organizationId?: string;
  ownerUserId?: string;
  purpose: string;
  requiredCapabilities: readonly ModelCapability[];
  preferredCapabilities?: readonly ModelCapability[];
  minimumQualityTier?: ModelQualityTier;
  latencySensitive?: boolean;
  maxCost?: number;
  allowFallback: boolean;
  timestamp: string;
  correlationId: string;
  input: unknown;
  context?: Readonly<Record<string, unknown>>;
  timeoutMs?: number;
}

export interface ModelRoutingPolicy {
  policyVersion: string;
  allowedProviderIds?: readonly string[];
  allowedModelIds?: readonly string[];
  allowedQualityTiers?: readonly ModelQualityTier[];
  allowFallback: boolean;
  requireOrganizationMatch: boolean;
}

export interface ModelRoutingCandidate {
  providerId: string;
  modelId: string;
  reason: string;
}

export interface ModelRoutingResult {
  requestId: string;
  organizationId?: string;
  selectedProviderId: string;
  selectedModelId: string;
  selectionReason: string;
  eligibleModels: readonly ModelRoutingCandidate[];
  policyVersion: string;
  fallbackAllowed: boolean;
  correlationId: string;
  provenance: {
    requestId: string;
    correlationId: string;
    policyVersion: string;
    deterministic: true;
  };
}

export interface ModelRuntimeFailure {
  code: ModelRuntimeFailureCode;
  message: string;
  retryable: boolean;
  attemptedModels: readonly ModelRoutingCandidate[];
  routing?: ModelRoutingResult;
}

export interface ModelRuntimeSuccess<TOutput = unknown> {
  status: 'SUCCESS';
  response: ModelResponse<TOutput>;
  routing: ModelRoutingResult;
  attemptedModels: readonly ModelRoutingCandidate[];
}

export interface ModelRuntimeFailureResult {
  status: 'FAILURE';
  failure: ModelRuntimeFailure;
  routing?: ModelRoutingResult;
  attemptedModels: readonly ModelRoutingCandidate[];
}

export type ModelRuntimeResult<TOutput = unknown> = ModelRuntimeSuccess<TOutput> | ModelRuntimeFailureResult;

const QUALITY_RANK: Record<ModelQualityTier, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };

function hasAllCapabilities(definition: ModelDefinition, required: readonly ModelCapability[]): boolean {
  return required.every((capability) => definition.capabilities.includes(capability));
}

function hasPreferredCapability(definition: ModelDefinition, preferred: readonly ModelCapability[]): number {
  return preferred.reduce((score, capability) => score + (definition.capabilities.includes(capability) ? 1 : 0), 0);
}

function validateRequirement(requirement: ModelRequirementProfile): void {
  if (!requirement.requestId || !requirement.purpose || !requirement.timestamp || !requirement.correlationId) {
    throw new Error('Model requirement is missing request identity, purpose, timestamp, or correlation fields');
  }
  if (!Number.isFinite(Date.parse(requirement.timestamp))) throw new Error('Model requirement timestamp must be a valid ISO timestamp');
  if (requirement.organizationId !== undefined && !requirement.organizationId.trim()) throw new Error('Model requirement organizationId cannot be empty');
  if (requirement.ownerUserId !== undefined && !requirement.ownerUserId.trim()) throw new Error('Model requirement ownerUserId cannot be empty');
  if (!Number.isInteger(requirement.timeoutMs ?? 1) || (requirement.timeoutMs ?? 1) < 1) throw new Error('Model requirement timeoutMs must be a positive integer');
  if (requirement.maxCost !== undefined && (!Number.isFinite(requirement.maxCost) || requirement.maxCost < 0)) throw new Error('Model requirement maxCost must be non-negative and finite');
  for (const capability of requirement.requiredCapabilities) if (!MODEL_CAPABILITIES.includes(capability)) throw new Error(`Unsupported required model capability: ${String(capability)}`);
  for (const capability of requirement.preferredCapabilities ?? []) if (!MODEL_CAPABILITIES.includes(capability)) throw new Error(`Unsupported preferred model capability: ${String(capability)}`);
  if (requirement.minimumQualityTier !== undefined && !MODEL_QUALITY_TIERS.includes(requirement.minimumQualityTier)) throw new Error(`Unsupported quality tier: ${String(requirement.minimumQualityTier)}`);
}

function eligible(definition: ModelDefinition, requirement: ModelRequirementProfile, policy: ModelRoutingPolicy): boolean {
  if (policy.requireOrganizationMatch && definition.organizationId !== undefined && definition.organizationId !== requirement.organizationId) return false;
  if (policy.allowedProviderIds && !policy.allowedProviderIds.includes(definition.providerId)) return false;
  if (policy.allowedModelIds && !policy.allowedModelIds.includes(definition.modelId)) return false;
  if (policy.allowedQualityTiers && !policy.allowedQualityTiers.includes(definition.qualityTier)) return false;
  if (definition.availability !== 'AVAILABLE') return false;
  if (!hasAllCapabilities(definition, requirement.requiredCapabilities)) return false;
  if (requirement.minimumQualityTier && QUALITY_RANK[definition.qualityTier] < QUALITY_RANK[requirement.minimumQualityTier]) return false;
  if (requirement.maxCost !== undefined && definition.cost.costPerInputUnit > requirement.maxCost) return false;
  return true;
}

function validateDefinition(definition: ModelDefinition): void {
  if (!definition.providerId || !definition.modelId || !definition.version || !definition.provenance) throw new Error('Model definition is missing identity or provenance');
  if (!MODEL_QUALITY_TIERS.includes(definition.qualityTier)) throw new Error(`Unsupported model quality tier: ${String(definition.qualityTier)}`);
  if (!MODEL_AVAILABILITY.includes(definition.availability)) throw new Error(`Unsupported model availability: ${String(definition.availability)}`);
  if (!Number.isFinite(definition.cost.costPerInputUnit) || definition.cost.costPerInputUnit < 0 || !Number.isFinite(definition.cost.costPerOutputUnit) || definition.cost.costPerOutputUnit < 0) throw new Error('Model cost metadata must be non-negative and finite');
  if (!Number.isInteger(definition.latency.expectedLatencyMs) || definition.latency.expectedLatencyMs < 0) throw new Error('Model latency metadata must be a non-negative integer');
  if (!Number.isInteger(definition.context.maxInputUnits) || definition.context.maxInputUnits < 1) throw new Error('Model context maxInputUnits must be a positive integer');
  for (const capability of definition.capabilities) if (!MODEL_CAPABILITIES.includes(capability)) throw new Error(`Unsupported model capability: ${String(capability)}`);
}

export class ModelRegistry {
  private readonly definitions: readonly ModelDefinition[];
  private readonly providers = new Map<string, ModelProvider>();

  constructor(definitions: readonly ModelDefinition[], providers: readonly ModelProvider[]) {
    for (const definition of definitions) validateDefinition(definition);
    this.definitions = definitions.map((definition) => ({ ...definition, capabilities: [...definition.capabilities] }));
    for (const provider of providers) {
      const key = `${provider.providerId}:${provider.modelId}`;
      if (this.providers.has(key)) throw new Error(`Duplicate model provider registration: ${key}`);
      this.providers.set(key, provider);
    }
  }

  getEligible(requirement: ModelRequirementProfile, policy: ModelRoutingPolicy): ModelDefinition[] {
    validateRequirement(requirement);
    if (policy.requireOrganizationMatch && requirement.organizationId === undefined) throw new Error('Organization identity is required by routing policy');
    return this.definitions.filter((definition) => eligible(definition, requirement, policy));
  }

  providerFor(definition: ModelDefinition): ModelProvider | undefined {
    return this.providers.get(`${definition.providerId}:${definition.modelId}`);
  }
}

export function routeModel(requirement: ModelRequirementProfile, registry: ModelRegistry, policy: ModelRoutingPolicy): ModelRoutingResult {
  validateRequirement(requirement);
  const candidates = registry.getEligible(requirement, policy);
  if (candidates.length === 0) throw new Error('NO_ELIGIBLE_MODEL');

  const preferred = requirement.preferredCapabilities ?? [];
  const ranked = [...candidates].sort((a, b) => {
    const preferredDelta = hasPreferredCapability(b, preferred) - hasPreferredCapability(a, preferred);
    if (preferredDelta !== 0) return preferredDelta;
    const qualityDelta = QUALITY_RANK[b.qualityTier] - QUALITY_RANK[a.qualityTier];
    if (qualityDelta !== 0) return qualityDelta;
    const latencyDelta = (requirement.latencySensitive ? a.latency.expectedLatencyMs - b.latency.expectedLatencyMs : 0);
    if (latencyDelta !== 0) return latencyDelta;
    const costDelta = a.cost.costPerInputUnit - b.cost.costPerInputUnit;
    if (costDelta !== 0) return costDelta;
    return `${a.providerId}:${a.modelId}`.localeCompare(`${b.providerId}:${b.modelId}`);
  });

  const eligibleModels = ranked.map((model) => ({
    providerId: model.providerId,
    modelId: model.modelId,
    reason: `eligible: required capabilities matched; preferred capability score=${hasPreferredCapability(model, preferred)}; quality=${model.qualityTier}; latencyMs=${model.latency.expectedLatencyMs}; inputCost=${model.cost.costPerInputUnit}`,
  }));
  const selected = ranked[0]!;
  const fallbackAllowed = requirement.allowFallback && policy.allowFallback;

  return {
    requestId: requirement.requestId,
    organizationId: requirement.organizationId,
    selectedProviderId: selected.providerId,
    selectedModelId: selected.modelId,
    selectionReason: `deterministic ranking selected ${selected.providerId}:${selected.modelId}`,
    eligibleModels,
    policyVersion: policy.policyVersion,
    fallbackAllowed,
    correlationId: requirement.correlationId,
    provenance: {
      requestId: requirement.requestId,
      correlationId: requirement.correlationId,
      policyVersion: policy.policyVersion,
      deterministic: true,
    },
  };
}

function runtimeFailure(code: ModelRuntimeFailureCode, message: string, attemptedModels: readonly ModelRoutingCandidate[], routing?: ModelRoutingResult): ModelRuntimeFailureResult {
  return { status: 'FAILURE', failure: { code, message, retryable: code === 'PROVIDER_UNAVAILABLE' || code === 'MODEL_UNAVAILABLE' || code === 'TIMEOUT' || code === 'PROVIDER_FAILURE', attemptedModels, routing }, routing, attemptedModels };
}

function mapProviderFailure(failure: ModelFailure | undefined): ModelRuntimeFailureCode {
  switch (failure?.code) {
    case 'PROVIDER_UNAVAILABLE': return 'PROVIDER_UNAVAILABLE';
    case 'TIMEOUT': return 'TIMEOUT';
    case 'INVALID_REQUEST': return 'INVALID_REQUEST';
    case 'INVALID_RESPONSE': return 'INVALID_RESPONSE';
    case 'PROVIDER_FAILURE': return 'PROVIDER_FAILURE';
    default: return 'PROVIDER_FAILURE';
  }
}

export class ModelRuntime {
  constructor(private readonly registry: ModelRegistry) {}

  run<TOutput = unknown>(requirement: ModelRequirementProfile, policy: ModelRoutingPolicy): ModelRuntimeResult<TOutput> {
    try {
      validateRequirement(requirement);
      const routing = routeModel(requirement, this.registry, policy);
      const candidates = routing.eligibleModels;
      const attempted: ModelRoutingCandidate[] = [];
      const maxAttempts = routing.fallbackAllowed ? candidates.length : 1;

      for (let index = 0; index < maxAttempts; index += 1) {
        const candidate = candidates[index]!;
        attempted.push(candidate);
        const definition = this.registry.getEligible(requirement, policy).find((item) => item.providerId === candidate.providerId && item.modelId === candidate.modelId);
        if (!definition) return runtimeFailure('ROUTING_POLICY_REJECTED', 'Eligible model disappeared from routing registry', attempted, routing) as ModelRuntimeResult<TOutput>;
        const provider = this.registry.providerFor(definition);
        if (!provider) {
          if (routing.fallbackAllowed && index + 1 < maxAttempts) continue;
          return runtimeFailure(routing.fallbackAllowed ? 'FALLBACK_EXHAUSTED' : 'MODEL_UNAVAILABLE', 'No registered provider exists for the selected model', attempted, routing) as ModelRuntimeResult<TOutput>;
        }

        const modelRequest: ModelRequest = {
          requestId: requirement.requestId,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          purpose: requirement.purpose,
          input: requirement.input,
          context: requirement.context,
          organizationId: requirement.organizationId,
          ownerUserId: requirement.ownerUserId,
          timestamp: requirement.timestamp,
          correlationId: requirement.correlationId,
          ...(requirement.maxCost !== undefined ? { budget: { requestedBudget: requirement.maxCost } } : {}),
          ...(requirement.timeoutMs !== undefined ? { timeout: { timeoutMs: requirement.timeoutMs } } : {}),
        };
        try {
          validateModelRequest(modelRequest);
          const response = provider.generate(modelRequest);
          validateModelResponse(response);
          if (response.requestId !== requirement.requestId || response.correlationId !== requirement.correlationId || response.providerId !== candidate.providerId || response.modelId !== candidate.modelId) {
            return runtimeFailure('PROVENANCE_MISMATCH', 'Model response provenance does not match the routed request', attempted, routing) as ModelRuntimeResult<TOutput>;
          }
          if (response.provenance.requestId !== requirement.requestId || response.provenance.correlationId !== requirement.correlationId || response.provenance.providerId !== candidate.providerId || response.provenance.modelId !== candidate.modelId) {
            return runtimeFailure('PROVENANCE_MISMATCH', 'Model response provenance claims an identity different from the routed model', attempted, routing) as ModelRuntimeResult<TOutput>;
          }
          if (response.status === 'SUCCESS') return { status: 'SUCCESS', response: response as ModelResponse<TOutput>, routing, attemptedModels: attempted };
          const code = mapProviderFailure(response.failure);
          if (routing.fallbackAllowed && index + 1 < maxAttempts && ['PROVIDER_UNAVAILABLE', 'MODEL_UNAVAILABLE', 'TIMEOUT', 'PROVIDER_FAILURE'].includes(code)) continue;
          return runtimeFailure(routing.fallbackAllowed ? 'FALLBACK_EXHAUSTED' : code, response.failure?.message ?? 'Model provider failed', attempted, routing) as ModelRuntimeResult<TOutput>;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const code: ModelRuntimeFailureCode = message === 'NO_ELIGIBLE_MODEL' ? 'NO_ELIGIBLE_MODEL' : 'PROVIDER_FAILURE';
          if (routing.fallbackAllowed && index + 1 < maxAttempts && code === 'PROVIDER_FAILURE') continue;
          return runtimeFailure(routing.fallbackAllowed ? 'FALLBACK_EXHAUSTED' : code, message, attempted, routing) as ModelRuntimeResult<TOutput>;
        }
      }

      return runtimeFailure('FALLBACK_EXHAUSTED', 'All eligible fallback models were exhausted', attempted, routing) as ModelRuntimeResult<TOutput>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'NO_ELIGIBLE_MODEL') return runtimeFailure('NO_ELIGIBLE_MODEL', 'No model satisfies the request and routing policy', []);
      if (message.includes('Organization identity is required') || message.includes('routing policy')) return runtimeFailure('ROUTING_POLICY_REJECTED', message, []);
      return runtimeFailure('INVALID_REQUEST', message, []);
    }
  }
}
