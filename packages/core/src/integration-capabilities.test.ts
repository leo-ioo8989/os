import assert from 'node:assert/strict';
import test from 'node:test';
import { capabilityAllowed, requiredScopes } from './integration-capabilities.js';

test('maps governed capabilities to the OAuth scopes they actually require', () => {
  assert.deepEqual(requiredScopes('gmail.read'), ['https://www.googleapis.com/auth/gmail.modify']);
  assert.deepEqual(requiredScopes('slack.send'), ['chat:write']);
  assert.deepEqual(requiredScopes('github.workflow'), ['workflow']);
});

test('denies capabilities when the connected token lacks the required scope', () => {
  assert.equal(capabilityAllowed('github.workflow', ['repo']), false);
  assert.equal(capabilityAllowed('slack.send', ['channels:read']), false);
  assert.equal(capabilityAllowed('github.write', ['repo']), true);
});

test('does not grant unknown capabilities', () => {
  assert.equal(capabilityAllowed('unknown.capability', ['repo', 'workflow']), false);
  assert.deepEqual(requiredScopes('unknown.capability'), []);
});
