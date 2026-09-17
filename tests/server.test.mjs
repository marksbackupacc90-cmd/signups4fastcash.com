import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
const { app, isVerificationCurrent } = await import('../dist/server.cjs');

const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    headers: response.headers,
  };
}

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health endpoint reports memory readiness without a database', async () => {
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'memory');
  assert.ok(['configured', 'not_configured'].includes(response.body.email));
});

test('responses preserve a caller request ID for support diagnostics', async () => {
  const response = await request('/api/health', {
    headers: { 'x-request-id': 'test-request-123' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), 'test-request-123');
});

test('offer verification expiry accepts only current or legacy dates', () => {
  assert.equal(isVerificationCurrent({ verificationExpiresAt: new Date(Date.now() + 86400000).toISOString() }), true);
  assert.equal(isVerificationCurrent({ verificationExpiresAt: new Date(Date.now() - 86400000).toISOString() }), false);
  assert.equal(isVerificationCurrent({}), true);
  assert.equal(isVerificationCurrent({ verificationExpiresAt: 'not-a-date' }), false);
});

test('pageview analytics rejects missing visitor identifiers', async () => {
  const response = await request('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '/', source: 'test' }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'A visitor identifier is required.');
});

test('pageview analytics records a valid memory-mode event', async () => {
  const response = await request('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorId: 'test-visitor', path: '/', source: 'test' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true });
});

test('offer analytics rejects malformed telemetry payloads', async () => {
  const response = await request('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: '', type: 'view' }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'A valid offerId and event type are required');
});

test('admin analytics requires an admin token', async () => {
  const response = await request('/api/admin/analytics/visitors');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Admin authentication required');
});

test('newsletter subscription fails explicitly when delivery is unconfigured', async () => {
  const response = await request('/api/newsletter/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', frequency: 'weekly' }),
  });
  assert.equal(response.status, 503);
  assert.match(response.body.error, /not configured/i);
});

test('newsletter provider webhook rejects unauthenticated requests', async () => {
  const response = await request('/api/newsletter/provider-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email.bounced', data: { to: ['test@example.com'] } }),
  });
  assert.equal(response.status, 401);
});
