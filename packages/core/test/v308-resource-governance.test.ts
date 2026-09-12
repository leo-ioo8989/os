import assert from 'node:assert/strict';
import test from 'node:test';
import { decideResourceUse, detectUsageAnomalies, sanitizeUsageMetadata, validateUsageEvent, type UsageEvent } from '../src/v308-resource-governance.js';

const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  eventId: 'evt-1', occurredAt: '2026-09-12T00:00:00.000Z', kind: 'model', provider: 'free-provider', model: 'small-model',
  inputUnits: 100, outputUnits: 50, durationMs: 100, estimatedCost: 0.01, currency: 'USD',
  provenance: { organizationId: 'org-a', projectId: 'p1', correlationId: 'corr-1' }, ...overrides,
});

test('validates usage provenance and accounting values', () => {
  assert.equal(validateUsageEvent(event()).provenance.organizationId, 'org-a');
  assert.throws(() => validateUsageEvent(event({ estimatedCost: -1 })), /V308_INVALID_ESTIMATED_COST/);
  assert.throws(() => validateUsageEvent(event({ currency: 'US' })), /V308_INVALID_CURRENCY/);
});

test('allows compliant low-cost usage', () => {
  const result = decideResourceUse({ event: event(), policy: { currency: 'USD', quotaUnits: 10, budgetLimit: 1 }, snapshot: { quotaUsed: 1, budgetUsed: 0.1, concurrencyUsed: 0, maxObservedLatencyMs: 100 }, proposedProvider: 'free-provider', proposedModel: 'small-model', accountingEvidencePresent: true, identityEvidencePresent: true });
  assert.equal(result.decision, 'ALLOW');
});

test('fails closed when protected evidence is missing', () => {
  const result = decideResourceUse({ event: event(), policy: { currency: 'USD', budgetLimit: 1 }, snapshot: { quotaUsed: 0, budgetUsed: 0, concurrencyUsed: 0, maxObservedLatencyMs: 0 }, accountingEvidencePresent: false, identityEvidencePresent: true });
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['MISSING_IDENTITY_OR_ACCOUNTING_EVIDENCE']);
});

test('requires approval above configured cost threshold', () => {
  const result = decideResourceUse({ event: event({ estimatedCost: 0.5 }), policy: { currency: 'USD', budgetLimit: 1, requireApprovalAboveCost: 0.25 }, snapshot: { quotaUsed: 0, budgetUsed: 0, concurrencyUsed: 0, maxObservedLatencyMs: 0 }, accountingEvidencePresent: true, identityEvidencePresent: true });
  assert.equal(result.decision, 'APPROVAL_REQUIRED');
});

test('denies quota, budget and provider policy violations', () => {
  const result = decideResourceUse({ event: event({ estimatedCost: 0.6 }), policy: { currency: 'USD', quotaUnits: 2, budgetLimit: 1, allowedProviders: ['approved-provider'] }, snapshot: { quotaUsed: 2, budgetUsed: 0.5, concurrencyUsed: 0, maxObservedLatencyMs: 0 }, proposedProvider: 'other-provider', accountingEvidencePresent: true, identityEvidencePresent: true });
  assert.equal(result.decision, 'DENY');
  assert.ok(result.reasons.includes('PROVIDER_NOT_ALLOWED'));
  assert.ok(result.reasons.includes('QUOTA_EXCEEDED'));
  assert.ok(result.reasons.includes('BUDGET_EXCEEDED'));
});

test('detects cross-organization correlation and cost spikes', () => {
  const current = event({ eventId: 'evt-current', estimatedCost: 10, provenance: { organizationId: 'org-a', correlationId: 'corr-shared' } });
  const previous = [event({ eventId: 'evt-old', estimatedCost: 1 }), event({ eventId: 'evt-foreign', estimatedCost: 1, provenance: { organizationId: 'org-b', correlationId: 'corr-shared' } })];
  const signals = detectUsageAnomalies(current, previous);
  assert.ok(signals.some((signal) => signal.code === 'CROSS_ORG_ATTRIBUTION'));
  assert.ok(signals.some((signal) => signal.code === 'COST_SPIKE'));
});

test('sanitizes credential-like metadata', () => {
  const sanitized = sanitizeUsageMetadata({ safe: 'ok', count: 2, apiKey: 'x', authorization: 'x', password: 'x' });
  assert.deepEqual(sanitized, { safe: 'ok', count: 2 });
});
