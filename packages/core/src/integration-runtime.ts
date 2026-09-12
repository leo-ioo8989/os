export type IntegrationName = 'openai' | 'anthropic' | 'google' | 'slack' | 'github';

export interface IntegrationConfig {
  enabled: boolean;
  configured: boolean;
  requiredSecrets: string[];
}

export interface IntegrationRegistry {
  get(name: IntegrationName): IntegrationConfig;
  list(): Record<IntegrationName, IntegrationConfig>;
}

const secret = (name: string) => Boolean(process.env[name]?.trim());

export function createIntegrationRegistry(): IntegrationRegistry {
  const configs: Record<IntegrationName, IntegrationConfig> = {
    openai: { enabled: secret('LEO_OS_OPENAI_ENABLED'), configured: secret('OPENAI_API_KEY'), requiredSecrets: ['OPENAI_API_KEY'] },
    anthropic: { enabled: secret('LEO_OS_ANTHROPIC_ENABLED'), configured: secret('ANTHROPIC_API_KEY'), requiredSecrets: ['ANTHROPIC_API_KEY'] },
    google: { enabled: secret('LEO_OS_GOOGLE_ENABLED'), configured: secret('GOOGLE_CLIENT_ID') && secret('GOOGLE_CLIENT_SECRET'), requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] },
    slack: { enabled: secret('LEO_OS_SLACK_ENABLED'), configured: secret('SLACK_BOT_TOKEN'), requiredSecrets: ['SLACK_BOT_TOKEN'] },
    github: { enabled: secret('LEO_OS_GITHUB_ENABLED'), configured: secret('GITHUB_TOKEN'), requiredSecrets: ['GITHUB_TOKEN'] },
  };
  return { get: (name) => configs[name], list: () => structuredClone(configs) };
}

export function requireIntegration(registry: IntegrationRegistry, name: IntegrationName): IntegrationConfig {
  const config = registry.get(name);
  if (!config.enabled || !config.configured) {
    throw new Error(`Integration ${name} is not enabled and configured.`);
  }
  return config;
}

export interface ProviderResponse<T> {
  provider: IntegrationName;
  model?: string;
  data: T;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await response.text();
  let payload: unknown = undefined;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = { raw: text.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`Integration request failed (${response.status}).`);
  return payload as T;
}

export interface ModelRequest { model: string; input: string; maxTokens?: number; temperature?: number; }
export interface ModelResult { text: string; raw: unknown; }

export async function callOpenAI(request: ModelRequest): Promise<ProviderResponse<ModelResult>> {
  requireIntegration(createIntegrationRegistry(), 'openai');
  const data = await requestJson<any>('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: request.model, input: request.input, max_output_tokens: request.maxTokens, temperature: request.temperature }),
  });
  const text = Array.isArray(data.output) ? data.output.flatMap((x: any) => x.content ?? []).map((x: any) => x.text ?? '').join('') : '';
  return { provider: 'openai', model: request.model, data: { text, raw: data } };
}

export async function callAnthropic(request: ModelRequest): Promise<ProviderResponse<ModelResult>> {
  requireIntegration(createIntegrationRegistry(), 'anthropic');
  const data = await requestJson<any>('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens ?? 1024, temperature: request.temperature, messages: [{ role: 'user', content: request.input }] }),
  });
  const text = Array.isArray(data.content) ? data.content.map((x: any) => x.text ?? '').join('') : '';
  return { provider: 'anthropic', model: request.model, data: { text, raw: data } };
}

export async function googleAccessToken(): Promise<string> {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) throw new Error('Google OAuth access token is not configured.');
  requireIntegration(createIntegrationRegistry(), 'google');
  return token;
}

export async function slackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireIntegration(createIntegrationRegistry(), 'slack');
  return requestJson<T>(`https://slack.com/api/${path}`, { ...init, headers: { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
}

export async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireIntegration(createIntegrationRegistry(), 'github');
  return requestJson<T>(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) } });
}
