import type { ExecutionRisk } from './execution.js';
import { decideExecution, hasWorkerCapability } from './execution.js';
import type { ControlPlaneWorkerBinding } from './delegation.js';

export const V3_02_VERSION = 'v3.02';
export const TOOL_AUTHORITY = 'CONTROL_PLANE_AUTHORIZED_WORKER_ONLY' as const;
export const TOOL_FAILURE_CODES = [
  'TOOL_NOT_FOUND','TOOL_DISABLED','TOOL_UNAVAILABLE','ORG_MISMATCH','CAPABILITY_MISSING',
  'MALFORMED_INPUT','AUTHORIZATION_DENIED','APPROVAL_REQUIRED','APPROVAL_INVALID',
  'DUPLICATE_REQUEST','TOOL_TIMEOUT','TOOL_RATE_LIMITED','EXTERNAL_FAILURE','OUTPUT_INVALID'
] as const;
export type ToolFailureCode = typeof TOOL_FAILURE_CODES[number];
export type ToolStatus = 'AVAILABLE' | 'DISABLED' | 'UNAVAILABLE';
export interface ToolSchema { readonly name: string; readonly validate: (value: unknown) => boolean; }
export interface ToolContract {
  toolId: string; organizationId: string; capabilityId: string; description: string;
  input: ToolSchema; output: ToolSchema; risk: ExecutionRisk; idempotent: boolean;
  requiredApproval: boolean; provenance: string;
}
export interface ToolDefinition extends ToolContract { status: ToolStatus; }
export interface ToolInvocationRequest {
  toolId: string; organizationId: string; taskId: string; workerId: string;
  capability: string; input: unknown; correlationId: string; idempotencyKey: string;
  approvalValid?: boolean;
}
export interface ToolInvocationContext { worker: ControlPlaneWorkerBinding; approvalValid: boolean; }
export interface ToolResult<T = unknown> {
  status: 'SUCCESS'; toolId: string; organizationId: string; taskId: string;
  workerId: string; correlationId: string; idempotencyKey: string; output: T; provenance: string;
}
export interface ToolFailure { status: 'FAILURE'; code: ToolFailureCode; message: string; retryable: boolean; }
export type ToolInvocationResult<T = unknown> = ToolResult<T> | ToolFailure;
export interface ToolAdapter { readonly toolId: string; invoke(input: unknown, request: ToolInvocationRequest): ToolResult | ToolFailure; }

const fail = (code: ToolFailureCode, message: string, retryable = false): ToolFailure => ({ status:'FAILURE', code, message, retryable });

export function validateToolContract(contract: ToolContract): void {
  if (!contract.toolId.trim() || !contract.organizationId.trim() || !contract.capabilityId.trim() || !contract.description.trim() || !contract.provenance.trim()) throw new Error('Tool contract identity is incomplete');
  if (!contract.input?.name || !contract.output?.name) throw new Error('Tool contract requires input and output schemas');
  if (!['LOW','MEDIUM','HIGH','CRITICAL'].includes(contract.risk)) throw new Error('Invalid tool risk');
}

export function assertToolResultSafe<T>(result: ToolResult<T>, request: ToolInvocationRequest): void {
  if (result.toolId !== request.toolId || result.organizationId !== request.organizationId || result.taskId !== request.taskId || result.workerId !== request.workerId || result.correlationId !== request.correlationId || result.idempotencyKey !== request.idempotencyKey) throw new Error('Tool result binding mismatch');
  if (!result.provenance.trim()) throw new Error('Tool result provenance is required');
  for (const field of ['approvalGranted','grantedPermissions','grantedCapabilities','credentialId','execute','dispatch','authorization']) if (JSON.stringify(result).includes(`\"${field}\"`)) throw new Error(`Tool result contains forbidden authority field: ${field}`);
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly adapters = new Map<string, ToolAdapter>();
  register(definition: ToolDefinition, adapter: ToolAdapter): void {
    validateToolContract(definition);
    if (definition.toolId !== adapter.toolId) throw new Error('Tool/adapter identity mismatch');
    if (this.tools.has(definition.toolId)) throw new Error(`Duplicate tool: ${definition.toolId}`);
    this.tools.set(definition.toolId, { ...definition }); this.adapters.set(adapter.toolId, adapter);
  }
  get(toolId: string): ToolDefinition | undefined { return this.tools.get(toolId); }
  adapterFor(toolId: string): ToolAdapter | undefined { return this.adapters.get(toolId); }
  match(capabilityId: string, organizationId: string): ToolDefinition[] { return [...this.tools.values()].filter(t => t.capabilityId === capabilityId && t.organizationId === organizationId && t.status === 'AVAILABLE').sort((a,b)=>a.toolId.localeCompare(b.toolId)); }
}

export class ToolGateway {
  private readonly completed = new Map<string, ToolResult>();
  constructor(private readonly registry: ToolRegistry) {}
  invoke<T = unknown>(request: ToolInvocationRequest, context: ToolInvocationContext): ToolInvocationResult<T> {
    const worker = context.worker;
    if (request.organizationId !== worker.organizationId) return fail('ORG_MISMATCH','Request organization does not match the authoritative worker organization');
    if (request.taskId !== worker.taskId || request.workerId !== worker.workerId) return fail('AUTHORIZATION_DENIED','Request is not bound to the authoritative worker/task');
    if (!request.toolId.trim() || !request.correlationId.trim() || !request.idempotencyKey.trim()) return fail('MALFORMED_INPUT','Invocation identity is incomplete');
    const existing = this.completed.get(request.idempotencyKey);
    if (existing) return existing as ToolResult<T>;
    const tool = this.registry.get(request.toolId);
    if (!tool) return fail('TOOL_NOT_FOUND','Tool is not registered');
    if (tool.organizationId !== worker.organizationId) return fail('ORG_MISMATCH','Tool belongs to a different organization');
    if (tool.status === 'DISABLED') return fail('TOOL_DISABLED','Tool is disabled');
    if (tool.status === 'UNAVAILABLE') return fail('TOOL_UNAVAILABLE','Tool is unavailable',true);
    if (tool.capabilityId !== request.capability || !hasWorkerCapability(worker, request.capability)) return fail('CAPABILITY_MISSING','Worker lacks the required capability');
    if (!tool.input.validate(request.input)) return fail('MALFORMED_INPUT','Tool input failed the typed input schema');
    const decision = decideExecution(tool.risk, true, context.approvalValid);
    if (decision === 'DENY') return fail('AUTHORIZATION_DENIED','Execution policy denied the tool invocation');
    if (decision === 'REQUIRES_APPROVAL') return fail(context.approvalValid ? 'APPROVAL_INVALID' : 'APPROVAL_REQUIRED','Tool invocation requires valid control-plane approval');
    const adapter = this.registry.adapterFor(tool.toolId);
    if (!adapter) return fail('TOOL_NOT_FOUND','Tool adapter is not registered');
    const result = adapter.invoke(request.input, request);
    if (result.status === 'FAILURE') return result;
    if (!tool.output.validate(result.output)) return fail('OUTPUT_INVALID','Tool output failed the typed output schema');
    try { assertToolResultSafe(result, request); } catch { return fail('OUTPUT_INVALID','Tool result failed binding or authority validation'); }
    this.completed.set(request.idempotencyKey, result);
    return result as ToolResult<T>;
  }
}

export class DeterministicToolAdapter implements ToolAdapter {
  constructor(public readonly toolId: string, private readonly outputFactory: (input: unknown) => unknown) {}
  invoke(input: unknown, request: ToolInvocationRequest): ToolResult {
    return { status:'SUCCESS', toolId:this.toolId, organizationId:request.organizationId, taskId:request.taskId, workerId:request.workerId, correlationId:request.correlationId, idempotencyKey:request.idempotencyKey, output:this.outputFactory(input), provenance:'deterministic-tool-adapter-v3.02' };
  }
}
