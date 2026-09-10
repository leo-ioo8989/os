export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  allowedTools: string[];
  forbiddenTools: string[];
  preferredModels: string[];
  permissionLevel: 'GREEN' | 'YELLOW' | 'RED';
  costLimit?: number;
  systemInstructions: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  validationRules: string[];
}

const agent = (
  id: string,
  name: string,
  role: string,
  capabilities: string[],
  permissionLevel: AgentDefinition['permissionLevel'] = 'GREEN',
): AgentDefinition => ({
  id,
  name,
  role,
  description: `${name} agent for Founder OS`,
  capabilities,
  allowedTools: [],
  forbiddenTools: [],
  preferredModels: [],
  permissionLevel,
  systemInstructions: 'Operate within Founder OS policies. Never bypass permission, approval, budget, or validation controls.',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  validationRules: ['Return structured output matching the declared contract.'],
});

export const INITIAL_AGENTS: readonly AgentDefinition[] = [
  agent('ceo', 'CEO', 'Orchestrator', ['objective-understanding', 'planning', 'delegation', 'monitoring', 'continuation'], 'YELLOW'),
  agent('research', 'Research', 'Research', ['research', 'source-validation', 'synthesis']),
  agent('product', 'Product', 'Product', ['requirements', 'prioritization', 'product-specification']),
  agent('project-manager', 'Project Manager', 'Project Management', ['planning', 'dependency-management', 'milestones']),
  agent('engineering', 'Engineering', 'Engineering', ['architecture', 'implementation', 'code-review']),
  agent('frontend-engineering', 'Frontend Engineering', 'Frontend Engineering', ['frontend', 'ui-implementation', 'accessibility']),
  agent('backend-engineering', 'Backend Engineering', 'Backend Engineering', ['backend', 'api', 'data-services']),
  agent('ai-engineering', 'AI Engineering', 'AI Engineering', ['llm-systems', 'evaluation', 'agent-runtime']),
  agent('design', 'Design', 'Design', ['visual-design', 'design-systems', 'art-direction']),
  agent('ux', 'UX', 'User Experience', ['user-flows', 'usability', 'interaction-design']),
  agent('marketing', 'Marketing', 'Marketing', ['campaigns', 'positioning', 'distribution']),
  agent('content', 'Content', 'Content', ['copywriting', 'content-production', 'editing']),
  agent('seo', 'SEO', 'SEO', ['technical-seo', 'keyword-research', 'content-seo']),
  agent('sales', 'Sales', 'Sales', ['prospecting', 'pipeline', 'sales-analysis']),
  agent('customer-support', 'Customer Support', 'Customer Support', ['support', 'triage', 'knowledge-base']),
  agent('finance', 'Finance', 'Finance', ['financial-analysis', 'budgeting', 'forecasting']),
  agent('analytics', 'Analytics', 'Analytics', ['metrics', 'experimentation', 'analysis']),
  agent('qa', 'QA', 'Quality Assurance', ['testing', 'validation', 'release-readiness']),
  agent('security', 'Security', 'Security', ['threat-modeling', 'security-review', 'risk-analysis']),
  agent('devops', 'DevOps', 'DevOps', ['deployment', 'infrastructure', 'observability'], 'YELLOW'),
  agent('operations', 'Operations', 'Operations', ['processes', 'execution', 'operations-analysis']),
];

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  constructor(definitions: readonly AgentDefinition[] = INITIAL_AGENTS) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: AgentDefinition): void {
    if (this.agents.has(definition.id)) throw new Error(`Agent already registered: ${definition.id}`);
    this.agents.set(definition.id, definition);
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }
}
