import type { ModelProvider, ModelRequest, ModelResponse } from './model.js';
import type { OwnerIntent } from './intent.js';
import type { ModelPlanOutput, PlanProposal } from './model-plan-adapter.js';
import { modelResponseToPlanProposal } from './model-plan-adapter.js';

export interface CEOReasoningContext {
  businessContext?: string;
  projectContext?: string;
  relevantFacts?: readonly string[];
  priorDecisions?: readonly string[];
}

export interface CEOReasoningRequest {
  requestId: string;
  intent: OwnerIntent;
  context?: CEOReasoningContext;
  timestamp: string;
  correlationId: string;
}

export interface CEOReasoningModelInput {
  intent: OwnerIntent;
  context?: CEOReasoningContext;
}

export interface CEOReasoningModelOutput {
  strategy: string;
  priorities: readonly string[];
  risks: readonly string[];
  rationale: string;
  clarificationRequired: boolean;
  approvalRecommended: boolean;
  plan: ModelPlanOutput;
  /** Presence of any of these fields is a fail-closed authority violation. */
  organizationId?: string;
  ownerUserId?: string;
  grantedPermissions?: readonly string[];
  grantedCapabilities?: readonly string[];
  approvalGranted?: boolean;
  workerId?: string;
  credentialId?: string;
  execute?: boolean;
  dispatch?: boolean;
  externalAction?: boolean;
}

export interface DecisionProposal {
  decisionId: string;
  sourceIntentId: string;
  organizationId: string;
  strategy: string;
  priorities: readonly string[];
  risks: readonly string[];
  rationale: string;
  clarificationRequired: boolean;
  approvalRecommended: boolean;
  plan: PlanProposal;
  authority: 'PROPOSAL_ONLY';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`CEO reasoning output field ${field} must be an array of strings`);
  }
  return [...value];
}

function forbiddenAuthorityFields(value: Record<string, unknown>): void {
  const forbidden = [
    'organizationId',
    'ownerUserId',
    'grantedPermissions',
    'grantedCapabilities',
    'approvalGranted',
    'workerId',
    'credentialId',
    'execute',
    'dispatch',
    'externalAction',
  ];
  for (const field of forbidden) {
    if (field in value) throw new Error(`CEO reasoning output contains forbidden authority field: ${field}`);
  }
}

function parseReasoningOutput(value: unknown): CEOReasoningModelOutput {
  if (!isRecord(value)) throw new Error('CEO reasoning output is not an object');
  forbiddenAuthorityFields(value);
  if (typeof value.strategy !== 'string' || !value.strategy || typeof value.rationale !== 'string' || !value.rationale) {
    throw new Error('CEO reasoning output is missing strategy or rationale');
  }
  if (typeof value.clarificationRequired !== 'boolean' || typeof value.approvalRecommended !== 'boolean') {
    throw new Error('CEO reasoning output has invalid decision flags');
  }
  if (!isRecord(value.plan)) throw new Error('CEO reasoning output is missing a governed plan');

  return {
    strategy: value.strategy,
    priorities: strings(value.priorities, 'priorities'),
    risks: strings(value.risks, 'risks'),
    rationale: value.rationale,
    clarificationRequired: value.clarificationRequired,
    approvalRecommended: value.approvalRecommended,
    plan: value.plan as unknown as ModelPlanOutput,
  };
}

function validateRequest(request: CEOReasoningRequest): void {
  if (!request.requestId || !request.timestamp || !request.correlationId) {
    throw new Error('CEO reasoning request is missing identity, timestamp, or correlation fields');
  }
  if (!request.intent.organizationId || !request.intent.ownerUserId) {
    throw new Error('CEO reasoning request requires authoritative OwnerIntent identity');
  }
  if (!Number.isFinite(Date.parse(request.timestamp))) {
    throw new Error('CEO reasoning request timestamp must be a valid ISO timestamp');
  }
}

/**
 * Provider-neutral CEO decision intelligence. It turns model output into a
 * proposal object and reuses the existing governed model-to-plan boundary.
 * It has no execution, worker, credential, policy-granting, or external-action API.
 */
export class CEOReasoningEngine {
  reason(
    request: CEOReasoningRequest,
    model: ModelProvider,
  ): DecisionProposal {
    validateRequest(request);

    const modelRequest: ModelRequest<CEOReasoningModelInput> = {
      requestId: request.requestId,
      providerId: model.providerId,
      modelId: model.modelId,
      purpose: 'ceo-reasoning-decision-proposal',
      input: { intent: request.intent, context: request.context },
      organizationId: request.intent.organizationId,
      ownerUserId: request.intent.ownerUserId,
      timestamp: request.timestamp,
      correlationId: request.correlationId,
    };

    const response = model.generate<CEOReasoningModelInput, CEOReasoningModelOutput>(modelRequest);
    if (response.status !== 'SUCCESS' || response.output === undefined) {
      throw new Error('CEO reasoning cannot create a decision proposal from a failed model response');
    }
    if (response.requestId !== request.requestId || response.correlationId !== request.correlationId) {
      throw new Error('CEO reasoning model response provenance does not match the request');
    }

    const output = parseReasoningOutput(response.output);
    const planResponse: ModelResponse<ModelPlanOutput> = {
      ...response,
      output: output.plan,
    };
    const plan = modelResponseToPlanProposal(request.intent, planResponse);

    return {
      decisionId: `${request.intent.intentId}:decision:${response.responseId}`,
      sourceIntentId: request.intent.intentId,
      organizationId: request.intent.organizationId,
      strategy: output.strategy,
      priorities: [...output.priorities],
      risks: [...output.risks],
      rationale: output.rationale,
      clarificationRequired: output.clarificationRequired,
      approvalRecommended: output.approvalRecommended,
      plan,
      authority: 'PROPOSAL_ONLY',
    };
  }
}
