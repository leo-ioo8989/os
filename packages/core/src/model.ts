export const MODEL_RESPONSE_STATUSES = ['SUCCESS', 'FAILURE'] as const;
export type ModelResponseStatus = (typeof MODEL_RESPONSE_STATUSES)[number];

export const MODEL_FAILURE_CODES = [
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'INVALID_REQUEST',
  'INVALID_RESPONSE',
  'PROVIDER_FAILURE',
  'UNSUPPORTED_OPERATION',
] as const;
export type ModelFailureCode = (typeof MODEL_FAILURE_CODES)[number];

export interface ModelBudgetMetadata {
  requestedBudget?: number;
  currency?: string;
}

export interface ModelTimeoutMetadata {
  timeoutMs?: number;
}

export interface ModelRequest<TInput = unknown> {
  requestId: string;
  providerId: string;
  modelId: string;
  purpose: string;
  input: TInput;
  context?: Readonly<Record<string, unknown>>;
  organizationId?: string;
  ownerUserId?: string;
  timestamp: string;
  correlationId: string;
  budget?: ModelBudgetMetadata;
  timeout?: ModelTimeoutMetadata;
}

export interface ModelFailure {
  code: ModelFailureCode;
  message: string;
  retryable?: boolean;
}

export interface ModelUsageMetadata {
  inputUnits?: number;
  outputUnits?: number;
  totalUnits?: number;
}

export interface ModelProvenance {
  providerId: string;
  modelId: string;
  requestId: string;
  correlationId: string;
  deterministic: boolean;
  testProvenance?: string;
}

export interface ModelResponse<TOutput = unknown> {
  responseId: string;
  requestId: string;
  providerId: string;
  modelId: string;
  output?: TOutput;
  status: ModelResponseStatus;
  failure?: ModelFailure;
  usage?: ModelUsageMetadata;
  timestamp: string;
  correlationId: string;
  provenance: ModelProvenance;
}

export interface ModelProvider {
  readonly providerId: string;
  readonly modelId: string;
  generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>): ModelResponse<TOutput>;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateModelRequest<TInput>(request: ModelRequest<TInput>): void {
  if (!request.requestId || !request.providerId || !request.modelId || !request.purpose || !request.timestamp || !request.correlationId) {
    throw new Error('Model request is missing required identity, purpose, timestamp, or correlation fields');
  }
  if (!isValidTimestamp(request.timestamp)) throw new Error('Model request timestamp must be a valid ISO timestamp');
  if (request.organizationId !== undefined && !request.organizationId.trim()) {
    throw new Error('Model request organizationId cannot be empty');
  }
  if (request.ownerUserId !== undefined && !request.ownerUserId.trim()) {
    throw new Error('Model request ownerUserId cannot be empty');
  }
  if (request.budget?.requestedBudget !== undefined && (!Number.isFinite(request.budget.requestedBudget) || request.budget.requestedBudget < 0)) {
    throw new Error('Model request budget must be a non-negative finite number');
  }
  if (request.timeout?.timeoutMs !== undefined && (!Number.isInteger(request.timeout.timeoutMs) || request.timeout.timeoutMs < 1)) {
    throw new Error('Model request timeoutMs must be a positive integer');
  }
}

export function validateModelResponse<TOutput>(response: ModelResponse<TOutput>): void {
  if (!response.responseId || !response.requestId || !response.providerId || !response.modelId || !response.timestamp || !response.correlationId) {
    throw new Error('Model response is missing required provenance fields');
  }
  if (!isValidTimestamp(response.timestamp)) throw new Error('Model response timestamp must be a valid ISO timestamp');
  if (response.status === 'SUCCESS' && response.output === undefined) {
    throw new Error('Successful model response must contain output');
  }
  if (response.status === 'FAILURE' && !response.failure) {
    throw new Error('Failed model response must contain failure information');
  }
  if (response.failure && !MODEL_FAILURE_CODES.includes(response.failure.code)) {
    throw new Error(`Unsupported model failure code: ${String(response.failure.code)}`);
  }
}

export interface DeterministicTestModelOptions {
  failure?: ModelFailure;
}

/**
 * Local deterministic provider for domain tests. It has no network, credential,
 * model SDK, or execution dependency. Its response identity and output are
 * derived only from the request and configured deterministic failure.
 */
export class DeterministicTestModel implements ModelProvider {
  readonly providerId = 'deterministic-test-provider';
  readonly modelId = 'deterministic-test-model-v1';

  constructor(private readonly options: DeterministicTestModelOptions = {}) {}

  generate<TInput = unknown, TOutput = unknown>(request: ModelRequest<TInput>): ModelResponse<TOutput> {
    validateModelRequest(request);

    const responseBase = {
      responseId: `${request.requestId}:response:${this.providerId}:${this.modelId}`,
      requestId: request.requestId,
      providerId: this.providerId,
      modelId: this.modelId,
      timestamp: request.timestamp,
      correlationId: request.correlationId,
      provenance: {
        providerId: this.providerId,
        modelId: this.modelId,
        requestId: request.requestId,
        correlationId: request.correlationId,
        deterministic: true,
        testProvenance: 'deterministic-test-model-v1',
      },
    } as const;

    if (this.options.failure) {
      const response: ModelResponse<TOutput> = {
        ...responseBase,
        status: 'FAILURE',
        failure: { ...this.options.failure },
      };
      validateModelResponse(response);
      return response;
    }

    const response: ModelResponse<TOutput> = {
      ...responseBase,
      status: 'SUCCESS',
      output: { kind: 'deterministic-test-output', input: request.input } as TOutput,
      usage: { inputUnits: 1, outputUnits: 1, totalUnits: 2 },
    };
    validateModelResponse(response);
    return response;
  }
}
