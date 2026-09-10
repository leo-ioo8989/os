import type { OwnerIntent } from './intent.js';
import type { CEOReasoningContext, CEOReasoningModelInput, CEOReasoningModelOutput, DecisionProposal } from './ceo-reasoning.js';
import { CEOReasoningEngine } from './ceo-reasoning.js';
import type { GovernedMemoryContext } from './memory.js';
import { memoryContextToCEOFacts } from './memory.js';
import type { ModelProvider, ModelRequest, ModelResponse } from './model.js';
import type { ModelRequirementProfile, ModelRoutingPolicy, ModelRuntime } from './model-runtime.js';
import type { PlanProposal } from './plan-proposal.js';
import { validatePlanProposal } from './plan-validation.js';

export const LEO_EXECUTIVE_AUTHORITY = 'GOVERNED_BY_LEO_OS' as const;
export const LEO_EXECUTIVE_STATUSES = ['ACTIVE', 'PAUSED', 'RETIRED'] as const;
export type LEOExecutiveStatus = (typeof LEO_EXECUTIVE_STATUSES)[number];

export interface LEOExecutiveIdentity {
  leoId: string;
  role: 'CEO';
  organizationId: string;
  ownerUserId: string;
  purpose: string;
  responsibilities: readonly string[];
  operatingPrinciples: readonly string[];
  authority: typeof LEO_EXECUTIVE_AUTHORITY;
  status: LEOExecutiveStatus;
  createdAt: string;
  identityVersion: number;
}

export interface GovernedExecutiveContext {
  organizationId: string;
  ownerUserId: string;
  businessContext?: string;
  projectContext?: string;
  relevantFacts: readonly string[];
  currentState: readonly string[];
  memoryIds: readonly string[];
}

export interface CEOOperatingInput {
  intent: OwnerIntent;
  memoryContext?: GovernedMemoryContext;
  currentState?: readonly string[];
}

export interface DecisionAlternative {
  label: string;
  description: string;
}

export interface CEOExecutiveAnalysis {
  objective: string;
  desiredOutcome: string;
  constraints: readonly string[];
  priorities: readonly string[];
  risks: readonly string[];
  assumptions: readonly string[];
  strategyOptions: readonly DecisionAlternative[];
  recommendedStrategy: string;
  recommendedNextSteps: readonly string[];
  delegationRecommendations: readonly string[];
  approvalRecommendation: 'RECOMMENDED' | 'NOT_RECOMMENDED';
  clarificationRequired: boolean;
}

export interface CEOOperatingDecision extends DecisionProposal {
  leoId: string;
  ownerUserId: string;
  alternatives: readonly DecisionAlternative[];
  assumptions: readonly string[];
  recommendedNextSteps: readonly string[];
  delegationRecommendations: readonly string[];
  provenance: {
    intentId: string;
    requestId: string;
    correlationId: string;
    modelProviderId: string;
    modelId: string;
  };
}

export type CEOOperatingResult =
  | {
      status: 'PROPOSAL_READY';
      leo: LEOExecutiveIdentity;
      intent: OwnerIntent;
      context: GovernedExecutiveContext;
      analysis: CEOExecutiveAnalysis;
      decision: CEOOperatingDecision;
      plan: PlanProposal;
      validation: 'VALIDATED';
      approvalRecommendation: 'RECOMMENDED' | 'NOT_RECOMMENDED';
      risks: readonly string[];
      correlationId: string;
    }
  | {
      status: 'CLARIFICATION_REQUIRED';
      leo: LEOExecutiveIdentity;
      intent: OwnerIntent;
      context: GovernedExecutiveContext;
      clarification: readonly string[];
      risks: readonly string[];
      correlationId: string;
    };

export function createLEOExecutiveIdentity(input: Pick<LEOExecutiveIdentity, 'organizationId' | 'ownerUserId' | 'createdAt'> & Partial<Pick<LEOExecutiveIdentity, 'leoId'>>): LEOExecutiveIdentity {
  if (!input.organizationId || !input.ownerUserId || !input.createdAt || !Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error('LEO identity requires organization, owner, and a valid creation timestamp');
  }
  const leoId = input.leoId ?? `${input.organizationId}:leo`;
  if (!leoId.trim()) throw new Error('LEO identity requires a stable leoId');
  return {
    leoId,
    role: 'CEO',
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    purpose: 'Represent the company CEO function by interpreting Owner intent, reasoning about company context, forming governed decisions, and proposing plans.',
    responsibilities: [
      'interpret owner intent',
      'understand governed company context',
      'form strategic decisions',
      'prioritize outcomes and risks',
      'propose governed plans',
      'recommend delegation without creating workers',
      'recommend approval or clarification',
      'report decisions and company state to the Owner',
    ],
    operatingPrinciples: [
      'Owner authority remains ultimate',
      'control plane remains final authority',
      'memory is context, never authority',
      'model output is untrusted data',
      'proposals are not execution',
      'approval required is not approval granted',
      'organization identity comes from authoritative context',
      'fail closed on authority ambiguity',
    ],
    authority: LEO_EXECUTIVE_AUTHORITY,
    status: 'ACTIVE',
    createdAt: input.createdAt,
    identityVersion: 1,
  };
}

function buildContext(input: CEOOperatingInput): GovernedExecutiveContext {
  if (input.memoryContext && input.memoryContext.organizationId !== input.intent.organizationId) {
    throw new Error('Governed memory context organization does not match OwnerIntent');
  }
  return {
    organizationId: input.intent.organizationId,
    ownerUserId: input.intent.ownerUserId,
    businessContext: input.intent.businessContext,
    projectContext: input.intent.projectContext,
    relevantFacts: input.memoryContext ? memoryContextToCEOFacts(input.memoryContext) : [],
    currentState: [...(input.currentState ?? [])],
    memoryIds: [...(input.memoryContext?.memoryIds ?? [])],
  };
}

function clarificationReasons(intent: OwnerIntent): string[] {
  const reasons: string[] = [];
  const outcome = intent.requestedOutcome.trim();
  if (outcome.length < 8) reasons.push('Requested outcome is too ambiguous to form a reliable executive decision.');
  const normalizedConstraints = intent.constraints.map((constraint) => constraint.trim().toLowerCase()).filter(Boolean);
  const contradictory = normalizedConstraints.some((constraint, index) => normalizedConstraints.some((other, otherIndex) => otherIndex > index && constraint !== other && constraint.includes('must ') && other.includes('must not ') && constraint.slice(5).trim() === other.slice(9).trim()));
  if (contradictory) reasons.push('Owner constraints contain a direct must/must-not conflict.');
  if (intent.requestedDeadline !== undefined && !Number.isFinite(Date.parse(intent.requestedDeadline))) reasons.push('Requested deadline is not a valid timestamp.');
  return reasons;
}

function riskRank(risk: string): number {
  return risk === 'CRITICAL' ? 4 : risk === 'HIGH' ? 3 : risk === 'MEDIUM' ? 2 : 1;
}

function enforceRiskFloor(intent: OwnerIntent, decision: DecisionProposal): void {
  const required = intent.priority;
  if (riskRank(decision.plan.risk) < riskRank(required)) {
    throw new Error('CEO reasoning cannot downgrade risk below the authoritative OwnerIntent priority');
  }
  if ((intent.priority === 'CRITICAL' || intent.riskRequirements.length > 0) && !decision.plan.approvalRequired) {
    throw new Error('CEO reasoning cannot remove an approval requirement implied by the OwnerIntent');
  }
}

const FORBIDDEN_AUTHORITY_FIELDS = new Set([
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
  'permissionGrant',
  'capabilityGrant',
  'approvalId',
]);

function assertNoAuthorityFields(value: unknown, path = 'modelOutput'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAuthorityFields(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_AUTHORITY_FIELDS.has(key)) throw new Error(`CEO operating loop rejected authority-bearing model field: ${path}.${key}`);
    assertNoAuthorityFields(child, `${path}.${key}`);
  }
}

class RuntimeBackedCEOModel implements ModelProvider {
  readonly providerId = 'leo-model-runtime';
  readonly modelId = 'router-selected';

  constructor(private readonly runtime: ModelRuntime, private readonly policy: ModelRoutingPolicy) {}

  generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>): ModelResponse<TOutput> {
    const requirement: ModelRequirementProfile = {
      requestId: request.requestId,
      organizationId: request.organizationId,
      ownerUserId: request.ownerUserId,
      purpose: request.purpose,
      requiredCapabilities: ['reasoning', 'structured_output'],
      preferredCapabilities: ['reasoning', 'structured_output'],
      allowFallback: true,
      timestamp: request.timestamp,
      correlationId: request.correlationId,
      input: request.input,
      context: request.context,
      ...(request.timeout?.timeoutMs !== undefined ? { timeoutMs: request.timeout.timeoutMs } : {}),
      ...(request.budget?.requestedBudget !== undefined ? { maxCost: request.budget.requestedBudget } : {}),
    };
    const result = this.runtime.run<TOutput>(requirement, this.policy);
    if (result.status === 'FAILURE') {
      throw new Error(`LEO model runtime failed: ${result.failure.code}: ${result.failure.message}`);
    }
    assertNoAuthorityFields(result.response.output);
    return result.response;
  }
}

function adaptDecision(leo: LEOExecutiveIdentity, intent: OwnerIntent, requestId: string, decision: DecisionProposal, response: ModelResponse): CEOOperatingDecision {
  const metadata = decision.plan.decisionMetadata;
  const modelProviderId = typeof metadata.providerId === 'string' ? metadata.providerId : response.providerId;
  const modelId = typeof metadata.modelId === 'string' ? metadata.modelId : response.modelId;
  const alternatives: DecisionAlternative[] = [];
  return {
    ...decision,
    leoId: leo.leoId,
    ownerUserId: intent.ownerUserId,
    alternatives,
    assumptions: [],
    recommendedNextSteps: decision.plan.tasks.map((task) => task.title),
    delegationRecommendations: decision.plan.tasks.map((task) => task.proposedWorkerRole ? `Expertise may be required for: ${task.proposedWorkerRole}` : 'Bounded execution support may be required.'),
    provenance: {
      intentId: intent.intentId,
      requestId,
      correlationId: intent.correlationId,
      modelProviderId,
      modelId,
    },
  };
}

export class CEOOperatingLoop {
  private readonly reasoning = new CEOReasoningEngine();

  constructor(
    private readonly leo: LEOExecutiveIdentity,
    private readonly runtime: ModelRuntime,
    private readonly routingPolicy: ModelRoutingPolicy,
  ) {}

  run(input: CEOOperatingInput): CEOOperatingResult {
    if (input.intent.organizationId !== this.leo.organizationId) throw new Error('OwnerIntent organization does not match LEO organization');
    if (input.intent.ownerUserId !== this.leo.ownerUserId) throw new Error('OwnerIntent owner does not match LEO owner relationship');
    const context = buildContext(input);
    const clarification = clarificationReasons(input.intent);
    if (clarification.length > 0) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        leo: this.leo,
        intent: input.intent,
        context,
        clarification,
        risks: [],
        correlationId: input.intent.correlationId,
      };
    }

    const requestId = `${input.intent.intentId}:ceo-loop:1`;
    const reasoningContext: CEOReasoningContext = {
      businessContext: context.businessContext,
      projectContext: context.projectContext,
      relevantFacts: context.relevantFacts,
      priorDecisions: context.currentState,
    };
    const provider = new RuntimeBackedCEOModel(this.runtime, this.routingPolicy);
    const request = {
      requestId,
      intent: input.intent,
      context: reasoningContext,
      timestamp: new Date().toISOString(),
      correlationId: input.intent.correlationId,
    };
    const decision = this.reasoning.reason(request, provider);
    enforceRiskFloor(input.intent, decision);
    if (decision.clarificationRequired) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        leo: this.leo,
        intent: input.intent,
        context,
        clarification: ['CEO reasoning determined that additional owner clarification is required before forming a plan.'],
        risks: decision.risks,
        correlationId: input.intent.correlationId,
      };
    }
    const plan = decision.plan;
    validatePlanProposal(plan);
    const executiveDecision = adaptDecision(this.leo, input.intent, requestId, decision, {
      responseId: `${requestId}:decision-response`,
      requestId,
      providerId: plan.decisionMetadata.providerId as string,
      modelId: plan.decisionMetadata.modelId as string,
      timestamp: plan.createdAt,
      correlationId: input.intent.correlationId,
      status: 'SUCCESS',
      provenance: {
        providerId: plan.decisionMetadata.providerId as string,
        modelId: plan.decisionMetadata.modelId as string,
        requestId,
        correlationId: input.intent.correlationId,
        deterministic: Boolean(plan.decisionMetadata.deterministic),
      },
    });
    const analysis: CEOExecutiveAnalysis = {
      objective: input.intent.requestedOutcome,
      desiredOutcome: input.intent.requestedOutcome,
      constraints: [...input.intent.constraints],
      priorities: [...decision.priorities],
      risks: [...decision.risks],
      assumptions: [],
      strategyOptions: [],
      recommendedStrategy: decision.strategy,
      recommendedNextSteps: executiveDecision.recommendedNextSteps,
      delegationRecommendations: executiveDecision.delegationRecommendations,
      approvalRecommendation: decision.approvalRecommended ? 'RECOMMENDED' : 'NOT_RECOMMENDED',
      clarificationRequired: false,
    };
    return {
      status: 'PROPOSAL_READY',
      leo: this.leo,
      intent: input.intent,
      context,
      analysis,
      decision: executiveDecision,
      plan,
      validation: 'VALIDATED',
      approvalRecommendation: analysis.approvalRecommendation,
      risks: [...decision.risks],
      correlationId: input.intent.correlationId,
    };
  }
}
