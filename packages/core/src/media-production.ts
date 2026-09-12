import type { ExecutionRisk } from './execution.js';
import { decideExecution, hasWorkerCapability } from './execution.js';
import type { ControlPlaneWorkerBinding } from './delegation.js';

export const V3_04_VERSION = 'v3.04' as const;
export const MEDIA_PRODUCTION_AUTHORITY = 'CONTROL_PLANE_AUTHORIZED_WORKER_ONLY' as const;

export type MediaType = 'RESEARCH_BRIEF' | 'SCRIPT' | 'AUDIO' | 'IMAGE' | 'VIDEO' | 'CAPTIONS' | 'THUMBNAIL' | 'METADATA' | 'MEDIA_PACKAGE';
export type ValidationStatus = 'UNVALIDATED' | 'VALID' | 'INVALID';
export type AssetStatus = 'PRODUCED' | 'VERIFIED' | 'REJECTED';
export type ProducerStatus = 'AVAILABLE' | 'DISABLED' | 'UNAVAILABLE';

export const MEDIA_FAILURE_CODES = [
  'PRODUCER_NOT_FOUND','PRODUCER_DISABLED','PRODUCER_UNAVAILABLE','ORG_MISMATCH','CAPABILITY_MISSING',
  'MALFORMED_INPUT','AUTHORIZATION_DENIED','APPROVAL_REQUIRED','APPROVAL_INVALID','PRODUCTION_FAILED',
  'OUTPUT_INVALID','PROVENANCE_INVALID','LINEAGE_INVALID','TECHNICAL_QA_FAILED','CONTENT_QA_FAILED',
  'PUBLISH_NOT_ALLOWED','DUPLICATE_REQUEST'
] as const;
export type MediaFailureCode = typeof MEDIA_FAILURE_CODES[number];

export interface MediaSchema { readonly name: string; readonly validate: (value: unknown) => boolean; }
export interface MediaCapabilityContract {
  capabilityId: string; mediaType: MediaType; input: MediaSchema; output: MediaSchema;
  qualityCriteria: readonly string[]; risk: ExecutionRisk; requiredApproval: boolean; provenance: string;
}
export interface ProducerDefinition extends MediaCapabilityContract {
  producerId: string; organizationId: string; status: ProducerStatus;
}
export interface MediaAsset {
  assetId: string; organizationId: string; taskId: string; correlationId: string; parentAssetIds: readonly string[];
  mediaType: MediaType; format: string; mimeType: string; createdAt: string; producerId: string;
  providerId?: string; modelId?: string; contentHash: string; storageRef: string;
  validationStatus: ValidationStatus; status: AssetStatus; metadata: Readonly<Record<string, unknown>>;
}
export interface ProductionRequest {
  producerId: string; organizationId: string; taskId: string; workerId: string; capabilityId: string;
  input: unknown; correlationId: string; idempotencyKey: string; parentAssetIds?: readonly string[]; approvalValid?: boolean;
}
export interface ProductionContext { readonly worker: ControlPlaneWorkerBinding; readonly approvalValid: boolean; }
export interface ProductionResult { status: 'SUCCESS'; asset: MediaAsset; provenance: string; }
export interface ProductionFailure { status: 'FAILURE'; code: MediaFailureCode; message: string; retryable: boolean; }
export type ProductionOutcome = ProductionResult | ProductionFailure;
export interface ProducerAdapter { readonly producerId: string; produce(input: unknown, request: ProductionRequest): ProductionResult | ProductionFailure; }

const fail = (code: MediaFailureCode, message: string, retryable = false): ProductionFailure => ({ status: 'FAILURE', code, message, retryable });
const iso = (v: string) => Number.isFinite(Date.parse(v));

export function validateCapabilityContract(c: MediaCapabilityContract): void {
  if (!c.capabilityId.trim() || !c.provenance.trim() || !c.input?.name || !c.output?.name) throw new Error('Media capability contract is incomplete');
  if (!c.qualityCriteria.length) throw new Error('Media capability requires quality criteria');
}

export function validateAsset(asset: MediaAsset): void {
  if (!asset.assetId || !asset.organizationId || !asset.taskId || !asset.correlationId || !asset.producerId || !asset.contentHash || !asset.storageRef) throw new Error('Media asset identity is incomplete');
  if (!iso(asset.createdAt)) throw new Error('Media asset timestamp is invalid');
  if (!asset.mimeType || !asset.format) throw new Error('Media asset format metadata is required');
  if (asset.validationStatus === 'VALID' && asset.status !== 'VERIFIED') throw new Error('Only verified assets may have VALID validation status');
}

export function assertNoPublicationAuthority(value: unknown): void {
  const forbidden = ['publish','upload','youtube','channelId','externalPostId','publicationId','credentialId','approvalGranted','execute','dispatch'];
  const text = JSON.stringify(value).toLowerCase();
  for (const field of forbidden) if (text.includes(`\"${field.toLowerCase()}\"`)) throw new Error(`Media output contains forbidden publication/authority field: ${field}`);
}

export class MediaProducerRegistry {
  private readonly definitions = new Map<string, ProducerDefinition>();
  private readonly adapters = new Map<string, ProducerAdapter>();
  register(definition: ProducerDefinition, adapter: ProducerAdapter): void {
    validateCapabilityContract(definition);
    if (!definition.producerId.trim() || !definition.organizationId.trim()) throw new Error('Producer identity is incomplete');
    if (definition.producerId !== adapter.producerId) throw new Error('Producer/adapter identity mismatch');
    if (this.definitions.has(definition.producerId)) throw new Error(`Duplicate producer: ${definition.producerId}`);
    this.definitions.set(definition.producerId, { ...definition }); this.adapters.set(adapter.producerId, adapter);
  }
  get(id: string): ProducerDefinition | undefined { return this.definitions.get(id); }
  adapterFor(id: string): ProducerAdapter | undefined { return this.adapters.get(id); }
  match(capabilityId: string, organizationId: string): ProducerDefinition[] {
    return [...this.definitions.values()].filter(p => p.capabilityId === capabilityId && p.organizationId === organizationId && p.status === 'AVAILABLE').sort((a,b) => a.producerId.localeCompare(b.producerId));
  }
}

export class MediaProductionGateway {
  private readonly completed = new Map<string, ProductionResult>();
  constructor(private readonly registry: MediaProducerRegistry) {}
  produce(request: ProductionRequest, context: ProductionContext): ProductionOutcome {
    const worker = context.worker;
    if (request.organizationId !== worker.organizationId) return fail('ORG_MISMATCH','Request organization does not match authoritative worker organization');
    if (request.taskId !== worker.taskId || request.workerId !== worker.workerId) return fail('AUTHORIZATION_DENIED','Request is not bound to authoritative worker/task');
    if (!request.producerId.trim() || !request.capabilityId.trim() || !request.correlationId.trim() || !request.idempotencyKey.trim()) return fail('MALFORMED_INPUT','Production identity is incomplete');
    const existing = this.completed.get(request.idempotencyKey); if (existing) return existing;
    const producer = this.registry.get(request.producerId);
    if (!producer) return fail('PRODUCER_NOT_FOUND','Producer is not registered');
    if (producer.organizationId !== worker.organizationId) return fail('ORG_MISMATCH','Producer belongs to another organization');
    if (producer.status === 'DISABLED') return fail('PRODUCER_DISABLED','Producer is disabled');
    if (producer.status === 'UNAVAILABLE') return fail('PRODUCER_UNAVAILABLE','Producer is unavailable',true);
    if (producer.capabilityId !== request.capabilityId || !hasWorkerCapability(worker, request.capabilityId)) return fail('CAPABILITY_MISSING','Worker lacks the required production capability');
    if (!producer.input.validate(request.input)) return fail('MALFORMED_INPUT','Production input failed its typed schema');
    const decision = decideExecution(producer.risk, true, context.approvalValid);
    if (decision === 'DENY') return fail('AUTHORIZATION_DENIED','Execution policy denied production');
    if (decision === 'REQUIRES_APPROVAL') return fail(context.approvalValid ? 'APPROVAL_INVALID' : 'APPROVAL_REQUIRED','Production requires valid control-plane approval');
    const adapter = this.registry.adapterFor(producer.producerId); if (!adapter) return fail('PRODUCER_NOT_FOUND','Producer adapter is not registered');
    const result = adapter.produce(request.input, request);
    if (result.status === 'FAILURE') return result;
    try { assertNoPublicationAuthority(result.asset); validateAsset(result.asset); } catch { return fail('OUTPUT_INVALID','Producer result failed asset or authority validation'); }
    if (!producer.output.validate(result.asset)) return fail('OUTPUT_INVALID','Produced asset failed its typed output schema');
    if (result.asset.organizationId !== request.organizationId || result.asset.taskId !== request.taskId || result.asset.correlationId !== request.correlationId) return fail('PROVENANCE_INVALID','Produced asset binding does not match request');
    if (result.asset.parentAssetIds.some(id => !id.trim())) return fail('LINEAGE_INVALID','Asset lineage contains an invalid parent reference');
    this.completed.set(request.idempotencyKey, result); return result;
  }
}

export interface MediaQaReport { technical: ValidationStatus; content: ValidationStatus; issues: readonly string[]; verified: boolean; }
export function evaluateMediaQa(asset: MediaAsset, technicalChecks: readonly boolean[], contentChecks: readonly boolean[]): MediaQaReport {
  const issues: string[] = [];
  if (!technicalChecks.length || technicalChecks.some(v => !v)) issues.push('Technical QA failed');
  if (!contentChecks.length || contentChecks.some(v => !v)) issues.push('Content QA failed');
  const technical = technicalChecks.length > 0 && technicalChecks.every(Boolean) ? 'VALID' : 'INVALID';
  const content = contentChecks.length > 0 && contentChecks.every(Boolean) ? 'VALID' : 'INVALID';
  return { technical, content, issues, verified: technical === 'VALID' && content === 'VALID' && asset.status === 'PRODUCED' };
}

export function verifyMediaAsset(asset: MediaAsset, report: MediaQaReport): MediaAsset {
  if (!report.verified) throw new Error(report.issues.join('; ') || 'Media QA failed');
  const verified: MediaAsset = { ...asset, validationStatus: 'VALID', status: 'VERIFIED' };
  validateAsset(verified); return verified;
}

export class DeterministicMediaProducer implements ProducerAdapter {
  constructor(public readonly producerId: string, private readonly mediaType: MediaType, private readonly format: string, private readonly mimeType: string, private readonly contentFactory: (input: unknown) => string) {}
  produce(input: unknown, request: ProductionRequest): ProductionResult {
    const content = this.contentFactory(input);
    const asset: MediaAsset = {
      assetId: `${request.taskId}:${request.idempotencyKey}:asset`, organizationId: request.organizationId, taskId: request.taskId,
      correlationId: request.correlationId, parentAssetIds: request.parentAssetIds ?? [], mediaType: this.mediaType, format: this.format,
      mimeType: this.mimeType, createdAt: new Date().toISOString(), producerId: this.producerId, contentHash: `sha256:${content.length}:${content.slice(0,32)}`,
      storageRef: `test://media/${request.idempotencyKey}`, validationStatus: 'UNVALIDATED', status: 'PRODUCED', metadata: { generatedFor: this.mediaType }
    };
    return { status: 'SUCCESS', asset, provenance: 'deterministic-media-producer-v3.04' };
  }
}
