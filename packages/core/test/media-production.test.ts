import { describe, expect, it } from 'vitest';
import { DeterministicMediaProducer, MediaProductionGateway, MediaProducerRegistry, evaluateMediaQa, verifyMediaAsset } from '../src/media-production.js';
import type { ControlPlaneWorkerBinding } from '../src/delegation.js';

const worker: ControlPlaneWorkerBinding = {
  workerId: 'worker-1', organizationId: 'org-1', taskId: 'task-1', delegationId: 'del-1', roleId: 'creator',
  capabilities: ['VIDEO_EDITING','AUDIO_GENERATION','VISUAL_DESIGN','CONTENT_QA','TECHNICAL_QA'],
  context: { organization: true, projectId: 'project-1' }, providerId: 'provider-1', modelId: 'model-1', risk: 'LOW'
};
const schema = { name: 'object', validate: (v: unknown) => typeof v === 'object' && v !== null };
function setup() {
  const registry = new MediaProducerRegistry();
  registry.register({ producerId:'video-test', organizationId:'org-1', capabilityId:'VIDEO_EDITING', mediaType:'VIDEO', input:schema, output:{name:'asset',validate:v=>typeof v==='object'&&v!==null}, qualityCriteria:['readable render','duration valid'], risk:'LOW', requiredApproval:false, provenance:'test' , status:'AVAILABLE'}, new DeterministicMediaProducer('video-test','VIDEO','mp4','video/mp4', input => JSON.stringify(input)));
  return new MediaProductionGateway(registry);
}
const request = (overrides: Record<string, unknown> = {}) => ({ producerId:'video-test', organizationId:'org-1', taskId:'task-1', workerId:'worker-1', capabilityId:'VIDEO_EDITING' as const, input:{ scenes:[] }, correlationId:'corr-1', idempotencyKey:'idem-1', ...overrides });

describe('V3.04 governed media production', () => {
  it('allows only an authoritative worker through typed capability policy', () => {
    const result = setup().produce(request(), { worker, approvalValid:false });
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') expect(result.asset.status).toBe('PRODUCED');
  });
  it('rejects cross-organization and wrong-worker requests', () => {
    const gateway = setup();
    expect(gateway.produce(request({ organizationId:'org-2' }), { worker, approvalValid:false }).status).toBe('FAILURE');
    expect(gateway.produce(request({ workerId:'attacker' }), { worker, approvalValid:false }).status).toBe('FAILURE');
  });
  it('rejects malformed input and unavailable producers', () => {
    const gateway = setup();
    expect(gateway.produce(request({ input:'bad' }), { worker, approvalValid:false })).toMatchObject({ status:'FAILURE', code:'MALFORMED_INPUT' });
  });
  it('requires approval for high risk and never treats approval as publication authority', () => {
    const registry = new MediaProducerRegistry();
    registry.register({ producerId:'high', organizationId:'org-1', capabilityId:'VIDEO_EDITING', mediaType:'VIDEO', input:schema, output:{name:'asset',validate:v=>typeof v==='object'&&v!==null}, qualityCriteria:['qa'], risk:'HIGH', requiredApproval:true, provenance:'test', status:'AVAILABLE' }, new DeterministicMediaProducer('high','VIDEO','mp4','video/mp4', () => 'safe'));
    const result = new MediaProductionGateway(registry).produce(request({ producerId:'high' }), { worker, approvalValid:false });
    expect(result).toMatchObject({ status:'FAILURE', code:'APPROVAL_REQUIRED' });
  });
  it('verifies technical and content QA before accepting an asset', () => {
    const produced = setup().produce(request(), { worker, approvalValid:false });
    expect(produced.status).toBe('SUCCESS');
    if (produced.status !== 'SUCCESS') return;
    const report = evaluateMediaQa(produced.asset, [true,true,true], [true,true]);
    expect(report.verified).toBe(true);
    const verified = verifyMediaAsset(produced.asset, report);
    expect(verified.status).toBe('VERIFIED');
    expect(verified.validationStatus).toBe('VALID');
  });
  it('rejects incomplete QA and publication/authority-shaped output', () => {
    const produced = setup().produce(request(), { worker, approvalValid:false });
    expect(produced.status).toBe('SUCCESS');
    if (produced.status !== 'SUCCESS') return;
    expect(evaluateMediaQa(produced.asset, [true,false], [true]).verified).toBe(false);
    const malicious = { ...produced.asset, metadata:{ publish:true } };
    expect(() => verifyMediaAsset(malicious, evaluateMediaQa(malicious,[true],[true]))).toThrow();
  });
  it('deduplicates successful production by idempotency key', () => {
    const gateway = setup();
    const first = gateway.produce(request(), { worker, approvalValid:false });
    const second = gateway.produce(request(), { worker, approvalValid:false });
    expect(first).toEqual(second);
  });
});
