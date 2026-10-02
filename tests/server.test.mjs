import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
const { app, buildOfferActivityReport, getOfferActivityReport, isVerificationCurrent, resolveUpdatedOfferStatus } = await import('../dist/server.cjs');

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

async function requestText(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  return {
    status: response.status,
    body: await response.text(),
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

test('sitemap contains only canonical indexable routes', async () => {
  const response = await requestText('/sitemap.xml');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/i);
  assert.match(response.body, /\/cashback-offers</);
  assert.doesNotMatch(response.body, /\.html/);
  assert.doesNotMatch(response.body, /\?offer=/);
});

test('new bank offer candidates are not exposed in the public offer catalog', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const candidateIds = [
    'candidate-wells-fargo-everyday-checking-325',
    'candidate-capital-one-360-checking-250',
    'candidate-pnc-virtual-wallet-400',
  ];
  const publicIds = response.body.offers.map((offer) => offer.id);
  candidateIds.forEach((id) => assert.equal(publicIds.includes(id), false, `${id} must stay hidden`));
});

test('new referral offer candidates are not exposed in the public offer catalog', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const candidateIds = [
    'candidate-ero-app-referral',
    'candidate-measure-protocol-msr-referral',
    'candidate-fetch-referral-a7qrrp',
    'candidate-triumph-rips-referral-jsxfnvt',
  ];
  const publicIds = response.body.offers.map((offer) => offer.id);
  candidateIds.forEach((id) => assert.equal(publicIds.includes(id), false, `${id} must stay hidden`));
});

test('offer verification expiry accepts only current or legacy dates', () => {
  assert.equal(isVerificationCurrent({ verificationExpiresAt: new Date(Date.now() + 86400000).toISOString() }), true);
  assert.equal(isVerificationCurrent({ verificationExpiresAt: new Date(Date.now() - 86400000).toISOString() }), false);
  assert.equal(isVerificationCurrent({}), true);
  assert.equal(isVerificationCurrent({ verificationExpiresAt: 'not-a-date' }), false);
});

test('editing a hidden offer link does not publish the offer', () => {
  assert.equal(resolveUpdatedOfferStatus('hidden', undefined), 'hidden');
  assert.equal(resolveUpdatedOfferStatus('hidden', 'hidden'), 'hidden');
  assert.equal(resolveUpdatedOfferStatus('hidden', 'live'), 'live');
  assert.equal(resolveUpdatedOfferStatus('live', undefined), 'live');
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

test('valid offer click events appear in the shared rolling activity report', async () => {
  const response = await request('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: 'offer-western-union-referral', type: 'click' }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.offer.id, 'offer-western-union-referral');

  const report = getOfferActivityReport(7);
  assert.equal(report.offers['offer-western-union-referral'].clicks, 1);
  assert.equal(report.totals.clicks, 1);
});

test('offer activity reports aggregate 7-day and 30-day events by offer', () => {
  const checkedAt = new Date('2026-09-28T12:00:00.000Z');
  const daysAgo = (days) => new Date(checkedAt.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const events = [
    { offerId: 'offer-a', type: 'click', recordedAt: daysAgo(1) },
    { offerId: 'offer-a', type: 'click', recordedAt: daysAgo(6) },
    { offerId: 'offer-a', type: 'conversion', recordedAt: daysAgo(6) },
    { offerId: 'offer-b', type: 'click', recordedAt: daysAgo(12) },
    { offerId: 'offer-b', type: 'conversion', recordedAt: daysAgo(29) },
    { offerId: 'offer-old', type: 'click', recordedAt: daysAgo(31) },
    { offerId: 'offer-future', type: 'click', recordedAt: new Date(checkedAt.getTime() + 1000).toISOString() },
    { offerId: 'offer-invalid', type: 'click', recordedAt: 'not-a-date' },
  ];

  const sevenDayReport = buildOfferActivityReport(events, 7, checkedAt);
  assert.equal(sevenDayReport.totals.clicks, 2);
  assert.equal(sevenDayReport.totals.conversions, 1);
  assert.deepEqual(sevenDayReport.offers['offer-a'], { clicks: 2, conversions: 1 });
  assert.equal(sevenDayReport.offers['offer-b'], undefined);

  const thirtyDayReport = buildOfferActivityReport(events, 30, checkedAt);
  assert.equal(thirtyDayReport.totals.clicks, 3);
  assert.equal(thirtyDayReport.totals.conversions, 2);
  assert.deepEqual(thirtyDayReport.offers['offer-b'], { clicks: 1, conversions: 1 });
  assert.equal(thirtyDayReport.offers['offer-old'], undefined);
});

test('offer impressions validate offer placement and record position data', async () => {
  const invalid = await request('/api/analytics/impression', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: 'offer-western-union-referral', position: 0 }),
  });
  assert.equal(invalid.status, 400);

  const recorded = await request('/api/analytics/impression', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: 'offer-western-union-referral', position: 2, visitorId: 'test-visitor' }),
  });
  assert.equal(recorded.status, 201);
  assert.deepEqual(recorded.body, { success: true });
});

test('offer exposure reports are owner-protected', async () => {
  const response = await request('/api/admin/analytics/exposures');
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Owner admin access is required.');
});

test('completion reports are separate from verified conversions', async () => {
  const response = await request('/api/offers/offer-western-union-referral/completion-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmed: true }),
  });

  test('issue reports accept visitor descriptions and remain owner-protected', async () => {
    const created = await request('/api/offers/offer-western-union-referral/issue-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue: 'terms-wrong', description: 'The requirements shown on the provider page do not match.' }),
    });
    assert.equal(created.status, 201);
    const unauthorized = await request('/api/admin/offer-issue-reports');
    assert.equal(unauthorized.status, 403);
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.status, 'pending_review');
  assert.match(response.body.message, /not a verified conversion/i);
});

test('admin analytics requires an admin token', async () => {
  const response = await request('/api/admin/analytics/visitors');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Admin authentication required');
});

test('date-range offer analytics requires an admin token', async () => {
  const response = await request('/api/admin/analytics/offers?days=7');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Admin authentication required');
});

test('analytics reports require an admin token', async () => {
  const response = await request('/api/admin/analytics/report', { method: 'POST' });
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
