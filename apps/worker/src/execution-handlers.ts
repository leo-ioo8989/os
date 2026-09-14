import type { ExecutionRisk } from '@founder-os/core';

export interface HandlerContext {
  organizationId: string;
  workflowId: string;
  jobId: string;
  taskId: string;
  workerId: string;
  parameters: Record<string, unknown>;
  checkpoint: (state: Record<string, unknown>) => Promise<void>;
}

export interface ExecutionHandlerResult {
  status: 'SUCCEEDED' | 'FAILED';
  output?: Record<string, unknown>;
  error?: { code: string; message: string; retryable: boolean };
}

export interface ExecutionHandler {
  id: string;
  description: string;
  requiredCapability: string;
  risk: ExecutionRisk;
  deterministic: boolean;
  testSafe: boolean;
  validateInput: (parameters: Record<string, unknown>) => boolean;
  validateOutput: (output: Record<string, unknown>) => boolean;
  execute: (context: HandlerContext) => Promise<ExecutionHandlerResult>;
}

const noParams = (parameters: Record<string, unknown>) =>
  Object.keys(parameters).length === 0;
const objectOutput = (parameters: Record<string, unknown>) =>
  typeof parameters === 'object' && parameters !== null && !Array.isArray(parameters);
const nonEmptyString = (parameters: Record<string, unknown>, key: string) =>
  typeof parameters[key] === 'string' && String(parameters[key]).trim().length > 0;

const handlers: ExecutionHandler[] = [
  {
    id: 'internal.noop',
    description: 'Deterministic no-op for control-plane verification.',
    requiredCapability: 'internal.execute',
    risk: 'LOW',
    deterministic: true,
    testSafe: true,
    validateInput: noParams,
    validateOutput: objectOutput,
    execute: async () => ({ status: 'SUCCEEDED', output: { executed: true } }),
  },
  {
    id: 'internal.calculate',
    description: 'Deterministic arithmetic over two finite numbers.',
    requiredCapability: 'internal.calculate',
    risk: 'LOW',
    deterministic: true,
    testSafe: true,
    validateInput: (parameters) =>
      typeof parameters.a === 'number' &&
      Number.isFinite(parameters.a) &&
      typeof parameters.b === 'number' &&
      Number.isFinite(parameters.b) &&
      ['add', 'subtract', 'multiply'].includes(String(parameters.operation)),
    validateOutput: (parameters) =>
      typeof parameters.result === 'number' && Number.isFinite(parameters.result),
    execute: async ({ parameters }) => {
      const a = Number(parameters.a);
      const b = Number(parameters.b);
      const operation = String(parameters.operation);
      const result = operation === 'add' ? a + b : operation === 'subtract' ? a - b : a * b;
      return { status: 'SUCCEEDED', output: { result } };
    },
  },
  {
    id: 'internal.fail',
    description: 'Deterministically fails for retry/failure-path verification.',
    requiredCapability: 'internal.execute',
    risk: 'LOW',
    deterministic: true,
    testSafe: true,
    validateInput: (parameters) =>
      typeof parameters.code === 'string' &&
      typeof parameters.message === 'string' &&
      typeof parameters.retryable === 'boolean',
    validateOutput: noParams,
    execute: async ({ parameters }) => ({
      status: 'FAILED',
      error: {
        code: String(parameters.code),
        message: String(parameters.message),
        retryable: Boolean(parameters.retryable),
      },
    }),
  },
  {
    id: 'internal.checkpoint',
    description: 'Writes a controlled checkpoint for resume verification.',
    requiredCapability: 'internal.checkpoint',
    risk: 'LOW',
    deterministic: true,
    testSafe: true,
    validateInput: objectOutput,
    validateOutput: (parameters) => parameters.checkpointed === true,
    execute: async ({ parameters, checkpoint }) => {
      await checkpoint({ phase: 'checkpointed', payload: parameters });
      return { status: 'SUCCEEDED', output: { checkpointed: true } };
    },
  },
  {
    id: 'internal.leoput.plan',
    description:
      'Validates and durably acknowledges a LeOpUT plan before creation/execution engines take over.',
    requiredCapability: 'workspace.plan',
    risk: 'LOW',
    deterministic: true,
    testSafe: true,
    validateInput: (parameters) =>
      nonEmptyString(parameters, 'workspaceId') &&
      nonEmptyString(parameters, 'intent') &&
      Array.isArray(parameters.steps) &&
      parameters.steps.length > 0 &&
      parameters.steps.every((step) => typeof step === 'string' && step.length > 0),
    validateOutput: (parameters) =>
      parameters.accepted === true && typeof parameters.workspaceId === 'string',
    execute: async ({ parameters }) => ({
      status: 'SUCCEEDED',
      output: {
        accepted: true,
        workspaceId: String(parameters.workspaceId),
        kind: typeof parameters.kind === 'string' ? parameters.kind : 'general',
      },
    }),
  },
];

export class ExecutionHandlerRegistry {
  private readonly handlers = new Map<string, ExecutionHandler>();

  constructor(extras: ExecutionHandler[] = []) {
    for (const handler of [...handlers, ...extras]) {
      if (this.handlers.has(handler.id)) {
        throw new Error(`Duplicate execution handler: ${handler.id}`);
      }
      this.handlers.set(handler.id, handler);
    }
  }

  get(id: string): ExecutionHandler | undefined {
    return this.handlers.get(id);
  }

  list(): readonly ExecutionHandler[] {
    return [...this.handlers.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

export function validateHandlerResult(
  handler: ExecutionHandler,
  result: ExecutionHandlerResult,
): { valid: true } | { valid: false; reason: string } {
  if (!result || (result.status !== 'SUCCEEDED' && result.status !== 'FAILED')) {
    return { valid: false, reason: 'Invalid result status.' };
  }

  if (result.status === 'SUCCEEDED') {
    if (!result.output || !handler.validateOutput(result.output)) {
      return { valid: false, reason: 'Handler output failed validation.' };
    }
    if (result.error) {
      return { valid: false, reason: 'Successful result cannot contain an error.' };
    }
  } else if (
    !result.error ||
    typeof result.error.code !== 'string' ||
    typeof result.error.message !== 'string' ||
    typeof result.error.retryable !== 'boolean'
  ) {
    return { valid: false, reason: 'Failed result must contain a structured error.' };
  }

  return { valid: true };
}
