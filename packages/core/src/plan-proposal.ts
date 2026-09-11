import type { OwnerIntent } from './intent.js';
import type { Permission } from './rbac.js';
import type { ExecutionRisk } from './execution.js';

export interface ProposedTask {
  taskId: string;
  title: string;
  description: string;
  order: number;
  dependencies: readonly string[];
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly Permission[];
  risk: ExecutionRisk;
  approvalRequired: boolean;
  estimatedCost?: number;
  proposedWorkerRole?: string;
  targetOrganizationId: string;
}

export interface PlanProposal {
  proposalId: string;
  sourceIntentId: string;
  organizationId: string;
  objective: string;
  tasks: readonly ProposedTask[];
  requiredCapabilities: readonly string[];
  requiredPermissions: readonly Permission[];
  risk: ExecutionRisk;
  approvalRequired: boolean;
  estimatedCost?: number;
  rationale: string;
  decisionMetadata: Readonly<Record<string, unknown>>;
  proposalVersion: number;
  createdAt: string;
  authority: 'PROPOSAL_ONLY';
}

export interface DeterministicPlanner { propose(intent: OwnerIntent): PlanProposal; }

/**
 * Conservative deterministic intent-to-capability mapping. This is requirement
 * inference only: it never grants authority or selects a worker/provider.
 * Unrecognized language intentionally returns [] so the governed model/CEO path
 * can handle ambiguity rather than guessing an execution capability.
 */
export function inferWorkforceCapabilities(intent: OwnerIntent): readonly string[] {
  const text = [
    intent.requestedOutcome,
    intent.businessContext ?? '',
    intent.projectContext ?? '',
    ...(intent.constraints ?? []),
    ...(intent.riskRequirements ?? []),
    ...Object.values(intent.context ?? {}).map((value) => typeof value === 'string' ? value : ''),
  ].join(' ').toLowerCase();

  const rules: Array<[RegExp, string[]]> = [
    [/\b(website|web site|landing page|web app|frontend|front-end|ui)\b/, ['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN','VISUAL_DESIGN']],
    [/\b(api|backend|back-end|server|database|service)\b/, ['SOFTWARE_ENGINEERING','BACKEND_DEVELOPMENT']],
    [/\b(mobile app|android|ios|iphone|ipad)\b/, ['SOFTWARE_ENGINEERING','FRONTEND_DEVELOPMENT','UX_DESIGN']],
    [/\b(debug|bug|fix (the|a) (code|app)|broken|error)\b/, ['SOFTWARE_ENGINEERING','DEBUGGING']],
    [/\b(code review|review (the|this) code|pull request|pr review)\b/, ['SOFTWARE_ENGINEERING','CODE_REVIEW']],
    [/\b(architect|architecture|system design|technical design)\b/, ['ARCHITECTURE','SOFTWARE_ENGINEERING']],
    [/\b(research|investigate|literature|paper|sources|find information)\b/, ['WEB_RESEARCH','SOURCE_DISCOVERY']],
    [/\b(market research|market analysis|competitor)\b/, ['WEB_RESEARCH','MARKET_ANALYSIS','PRODUCT_ANALYSIS']],
    [/\b(data analysis|analyze data|dataset|spreadsheet|analytics|metrics)\b/, ['DATA_ANALYSIS']],
    [/\b(security audit|security review|vulnerability|penetration|threat model)\b/, ['SECURITY_REVIEW']],
    [/\b(write|writing|blog|article|copy|content|newsletter)\b/, ['COPYWRITING']],
    [/\b(seo|search engine optimization|keyword research)\b/, ['SEO','COPYWRITING']],
    [/\b(social media|instagram|facebook|linkedin|twitter|social campaign)\b/, ['SOCIAL_MEDIA','COPYWRITING','GROWTH_ANALYSIS']],
    [/\b(growth|conversion|funnel|acquisition|retention)\b/, ['GROWTH_ANALYSIS']],
    [/\b(video|reel|shorts|editing|edit a video)\b/, ['VIDEO_EDITING']],
    [/\b(audio|voice|podcast|sound)\b/, ['AUDIO_GENERATION']],
    [/\b(presentation|slides|pitch deck|powerpoint)\b/, ['PRESENTATION_DESIGN']],
    [/\b(qa|quality assurance|test|testing|validate)\b/, ['TECHNICAL_QA']],
    [/\b(content qa|proofread|fact check)\b/, ['CONTENT_QA']],
  ];

  const capabilities: string[] = [];
  for (const [pattern, values] of rules) {
    if (!pattern.test(text)) continue;
    for (const value of values) if (!capabilities.includes(value)) capabilities.push(value);
  }
  return capabilities;
}

export class DeterministicPlanGenerator implements DeterministicPlanner {
  propose(intent: OwnerIntent): PlanProposal {
    const taskId = `${intent.intentId}:task:1`;
    const capabilities = inferWorkforceCapabilities(intent);
    const approvalRequired = intent.riskRequirements.length > 0 || intent.priority === 'CRITICAL';
    const risk: ExecutionRisk = intent.priority === 'CRITICAL' ? 'CRITICAL' : intent.priority === 'HIGH' ? 'HIGH' : 'LOW';
    const permissions: readonly Permission[] = ['objective:read', 'task:read'];

    return {
      proposalId: `${intent.intentId}:proposal:1`,
      sourceIntentId: intent.intentId,
      organizationId: intent.organizationId,
      objective: intent.requestedOutcome,
      tasks: [{
        taskId,
        title: intent.requestedOutcome,
        description: intent.context ? `${intent.requestedOutcome} (context supplied)` : intent.requestedOutcome,
        order: 1,
        dependencies: [],
        requiredCapabilities: capabilities,
        requiredPermissions: permissions,
        risk,
        approvalRequired,
        ...(intent.requestedBudget !== undefined ? { estimatedCost: intent.requestedBudget } : {}),
        proposedWorkerRole: capabilities.includes('FRONTEND_DEVELOPMENT') ? 'frontend-engineer' : capabilities.includes('BACKEND_DEVELOPMENT') ? 'backend-engineer' : capabilities.includes('SOFTWARE_ENGINEERING') ? 'software-engineer' : 'general',
        targetOrganizationId: intent.organizationId,
      }],
      requiredCapabilities: capabilities,
      requiredPermissions: permissions,
      risk,
      approvalRequired,
      ...(intent.requestedBudget !== undefined ? { estimatedCost: intent.requestedBudget } : {}),
      rationale: 'Deterministic planner infers bounded workforce requirements from owner intent; authority remains proposal-only.',
      decisionMetadata: { planner: 'deterministic-v2', sourceCorrelationId: intent.correlationId, capabilityInference: 'deterministic-keyword-contracts' },
      proposalVersion: 2,
      createdAt: new Date().toISOString(),
      authority: 'PROPOSAL_ONLY',
    };
  }
}
