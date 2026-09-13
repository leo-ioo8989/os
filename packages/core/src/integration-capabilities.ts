export type OAuthProvider = 'google' | 'slack' | 'github';
export type IntegrationCapability =
  | 'gmail.read' | 'gmail.send' | 'calendar.read' | 'calendar.write'
  | 'drive.read' | 'drive.write' | 'slack.read' | 'slack.send'
  | 'github.read' | 'github.write' | 'github.workflow';

const REQUIRED_SCOPES: Record<IntegrationCapability, readonly string[]> = {
  'gmail.read': ['https://www.googleapis.com/auth/gmail.modify'],
  'gmail.send': ['https://www.googleapis.com/auth/gmail.modify'],
  'calendar.read': ['https://www.googleapis.com/auth/calendar'],
  'calendar.write': ['https://www.googleapis.com/auth/calendar'],
  'drive.read': ['https://www.googleapis.com/auth/drive'],
  'drive.write': ['https://www.googleapis.com/auth/drive'],
  'slack.read': ['channels:read'],
  'slack.send': ['chat:write'],
  'github.read': ['repo'],
  'github.write': ['repo'],
  'github.workflow': ['workflow'],
};

export function requiredScopes(capability: string): readonly string[] {
  return REQUIRED_SCOPES[capability as IntegrationCapability] ?? [];
}

export function capabilityAllowed(capability: string, scopes: readonly string[]): boolean {
  const required = requiredScopes(capability);
  return required.length > 0 && required.every(scope => scopes.includes(scope));
}

export function capabilitiesForProvider(provider: OAuthProvider): IntegrationCapability[] {
  return (Object.keys(REQUIRED_SCOPES) as IntegrationCapability[]).filter(capability => {
    return capability.startsWith(provider === 'google' ? 'gmail.' : provider === 'slack' ? 'slack.' : 'github.')
      || (provider === 'google' && (capability.startsWith('calendar.') || capability.startsWith('drive.')));
  });
}
