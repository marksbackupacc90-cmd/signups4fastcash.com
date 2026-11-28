import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
process.env.GOOGLE_CLIENT_ID = 'test-google-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.REFERRAL_HASH_SECRET = 'test-referral-secret';
process.env.MILESTONE_CALLBACK_SECRET = 'test-milestone-secret';
process.env.POSTBACK_SECRET = 'test-postback-secret';
process.env.CPX_SECURE_HASH = 'test-cpx-secret';
const { app, applyCoinsBackTerms, broadcastLiveActivity, buildOfferActivityReport, buildOfferActivitySinceReport, buildPostbackSignaturePayload, calculateReferralCommissionCents, calculateRpsPvpRakeUnits, canApproveReferralPayout, compileOutboundTrackingUrl, createGoogleOAuthState, createMockCashoutEvent, createWithdrawalTrackingHash, decryptProviderCredential, encryptProviderCredential, evaluateRpsOutcome, getAggregatePageViewCount, getAuthSessionCookieOptions, getOfferActivityReport, getStrictTransportSecurityOptions, getUtcDailyKey, getUtcRaceKey, hashFraudIdentifier, hashWithdrawalDestination, isOfferAvailableInUs, isTemporarilyHiddenOffer, isValidDeviceFingerprint, isVerificationCurrent, maskPublicOfferUsername, maskWithdrawalDestination, mergeCatalogOffer, mockWithdrawalProvider, newsletterEmailLayout, normalizeOfferFeedPayload, parseRpsWager, readGoogleOAuthState, resolveOfferVerificationUpdate, resolveUpdatedOfferStatus, selectDailySpinReward, validateOfferCampaign, validateWithdrawalDestination } = await import('../dist/server.cjs');
const { seedCampaigns, seedProfiles, SEED_PREFIX } = await import('../scripts/seed-config.mjs');

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
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const publicHealth = await request('/health');
  assert.equal(publicHealth.status, 200);
  assert.equal(publicHealth.body.status, 'ok');
  assert.equal(publicHealth.body.database, 'memory');
  assert.ok(Number.isInteger(publicHealth.body.uptimeSeconds));
});

test('daily spin reward bands match the published odds and reject invalid rolls', () => {
  for (const [roll, expected] of [[0, 1], [49, 1], [50, 2], [79, 2], [80, 5], [94, 5], [95, 10], [98, 10], [99, 25]]) {
    assert.equal(selectDailySpinReward(roll), expected);
  }
  for (const roll of [-1, 100, 1.5]) {
    assert.throws(() => selectDailySpinReward(roll), RangeError);
  }
});

test('wallet and daily spin endpoints require a signed-in account', async () => {
  for (const path of ['/api/rewards/wallet', '/api/rewards/daily-spin']) {
    const response = await request(path);
    assert.equal(response.status, 401);
  }
  for (const path of ['/api/rewards/cashout', '/api/rewards/daily-spin']) {
    const response = await request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  }
});

test('provider API credentials are encrypted and authenticated before decryption', () => {
  const secretValue = 'provider-test-secret';
  const encryptionSecret = 'test-encryption-secret';
  const encrypted = encryptProviderCredential(secretValue, encryptionSecret);
  assert.notEqual(encrypted.ciphertext, secretValue);
  assert.equal(decryptProviderCredential(encrypted, encryptionSecret), secretValue);
  assert.throws(() => decryptProviderCredential(encrypted, 'different-encryption-secret'), /authenticate/i);
});

test('provider credential management requires owner admin authorization', async () => {
  const list = await request('/api/admin/provider-credentials');
  assert.equal(list.status, 403);
  const save = await request('/api/admin/provider-credentials', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerName: 'Example', credentialName: 'API key', value: 'do-not-store' }),
  });
  assert.equal(save.status, 403);
  const remove = await request('/api/admin/provider-credentials/example/api-key', { method: 'DELETE' });
  assert.equal(remove.status, 403);
});

test('compliance pages expose terms, privacy, cookies, and affiliate disclosure', async () => {
  for (const [path, text] of [
    ['/terms', 'Only one account is allowed per person, household'],
    ['/privacy', 'Device and network security'],
    ['/cookies', 'Essential cookies'],
    ['/affiliate-disclosure', 'Referral compensation'],
  ]) {
    const response = await requestText(path);
    assert.equal(response.status, 200);
    assert.match(response.body, new RegExp(text));
  }
});

test('RPS outcomes cover every winning, losing, and drawing choice', () => {
  assert.equal(evaluateRpsOutcome('rock', 'scissors'), 'win');
  assert.equal(evaluateRpsOutcome('paper', 'rock'), 'win');
  assert.equal(evaluateRpsOutcome('scissors', 'paper'), 'win');
  assert.equal(evaluateRpsOutcome('rock', 'paper'), 'loss');
  assert.equal(evaluateRpsOutcome('paper', 'scissors'), 'loss');
  assert.equal(evaluateRpsOutcome('scissors', 'rock'), 'loss');
  for (const choice of ['rock', 'paper', 'scissors']) {
    assert.equal(evaluateRpsOutcome(choice, choice), 'draw');
  }
});

test('PvP RPS wager validation and rake use the wallet currency precision', () => {
  assert.deepEqual(parseRpsWager(0.5, 'cash'), { currency: 'cash', amount: 0.5, units: 50 });
  assert.deepEqual(parseRpsWager(50, 'points'), { currency: 'points', amount: 50, units: 50 });
  assert.equal(parseRpsWager(0.49, 'cash'), null);
  assert.equal(parseRpsWager(50.5, 'points'), null);
  assert.equal(parseRpsWager(50, 'credits'), null);
  assert.equal(calculateRpsPvpRakeUnits(100), 3);
  assert.equal(calculateRpsPvpRakeUnits(200), 6);
});

test('RPS and milestones require an authenticated account and persistent storage', async () => {
  const game = await request('/api/games/rps/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice: 'rock' }),
  });
  assert.equal(game.status, 401);

  const milestones = await request('/api/offers/milestones');
  assert.equal(milestones.status, 401);

  const callback = await request('/api/offers/milestones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Milestone-Timestamp': String(Date.now()),
      'X-Milestone-Event-Id': 'test-event',
      'X-Milestone-Signature': '0'.repeat(64),
    },
    body: JSON.stringify({ userId: 'test-user', offerId: 'offer-earnx', level: 5 }),
  });
  assert.equal(callback.status, 503);
});

test('PvP RPS matchmaking and move endpoints require authentication', async () => {
  const requests = [
    request('/api/v1/rps/lobbies'),
    request('/api/v1/rps/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wagerAmount: 0.5, currency: 'cash' }),
    }),
    request('/api/v1/rps/lobbies/00000000-0000-4000-8000-000000000001'),
    request('/api/v1/rps/lobbies/00000000-0000-4000-8000-000000000001/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wagerAmount: 0.5, currency: 'cash' }),
    }),
    request('/api/v1/rps/lobbies/00000000-0000-4000-8000-000000000001/moves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: 'rock' }),
    }),
  ];
  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401]);
});

test('notification history and read-state updates require an authenticated account', async () => {
  const history = await request('/api/v1/notifications');
  assert.equal(history.status, 401);

  const update = await request('/api/v1/notifications/00000000-0000-4000-8000-000000000001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true }),
  });
  assert.equal(update.status, 401);
});

test('device fingerprints are hashed and VPN or proxy auth requests are blocked', async () => {
  assert.equal(isValidDeviceFingerprint('a'.repeat(64)), true);
  assert.equal(isValidDeviceFingerprint('not-a-fingerprint'), false);
  assert.equal(hashFraudIdentifier(' 203.0.113.10 ').length, 64);

  const blockedSignup = await request('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SFC-Proxy-Blocked': '1',
    },
    body: JSON.stringify({
      email: 'test@example.com',
      username: 'cashfinder',
      password: 'a-secure-password',
      deviceFingerprint: 'a'.repeat(64),
    }),
  });
  assert.equal(blockedSignup.status, 403);
});

test('withdrawal validation accepts supported channels and rejects unsafe targets', async () => {
  assert.deepEqual(validateWithdrawalDestination('paypal', ' user@example.com '), {
    channel: 'paypal',
    destination: 'user@example.com',
  });
  assert.equal(validateWithdrawalDestination('venmo', '@ok').field, 'destination');
  assert.equal(validateWithdrawalDestination('crypto', 'short-address').field, 'destination');
  assert.equal(validateWithdrawalDestination('bank', '123').field, 'channel');
  assert.equal(hashWithdrawalDestination('user@example.com').length, 64);
  assert.match(maskWithdrawalDestination('paypal', 'avery@example.com'), /\*\*\*@/);
  assert.equal(createWithdrawalTrackingHash('request-1').length, 64);

  const response = await request('/api/v1/withdrawals/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'withdrawal-test-1' },
    body: JSON.stringify({ amount: 5, channel: 'paypal', destination: 'user@example.com' }),
  });
  assert.equal(response.status, 401);
});

test('live cash-out activity produces masked mock and broadcast payloads', () => {
  const mock = createMockCashoutEvent();
  assert.equal(mock.type, 'mock');
  assert.match(mock.handle, /\*\*\*$/);
  assert.ok(mock.amount >= 0.5 && mock.amount <= 25);
  assert.match(mock.amountText, /^\$\d+\.\d{2}$/);
  assert.equal(broadcastLiveActivity(mock), 0);
});

test('background worker schedule keys and protected routes are deterministic', async () => {
  const sunday = new Date('2026-11-24T23:59:30.000Z');
  assert.equal(getUtcDailyKey(sunday), '2026-11-24');
  assert.equal(getUtcRaceKey(sunday), '2026-11-22');

  const leaderboard = await request('/api/v1/leaderboard');
  assert.equal(leaderboard.status, 503);

  const dailyReset = await request('/api/v1/admin/workers/daily-reset', { method: 'POST' });
  assert.equal(dailyReset.status, 403);
  const leaderboardRun = await request('/api/v1/admin/workers/weekly-leaderboard', { method: 'POST' });
  assert.equal(leaderboardRun.status, 403);
});

test('platform analytics and ledger integrity routes require owner admin access', async () => {
  const summary = await request('/api/admin/analytics/summary');
  assert.equal(summary.status, 403);

  const integrity = await request('/api/admin/analytics/ledger-integrity');
  assert.equal(integrity.status, 403);
});

test('E2E postback payload signs the canonical click, user, offer, tier, and cents', () => {
  const payload = buildPostbackSignaturePayload('click-e2e', 'user-e2e', 'offer-e2e', 1, 500);
  assert.equal(payload, 'click-e2e.user-e2e.offer-e2e.1.500');
  const signature = createHmac('sha256', 'test-postback-secret').update(payload).digest('hex');
  assert.equal(signature.length, 64);
});

test('offer feed inventory filters territories and normalizes US payouts', () => {
  assert.equal(isOfferAvailableInUs({ country: 'US' }), true);
  assert.equal(isOfferAvailableInUs({ countries: ['CA', 'GB'] }), false);
  assert.equal(isOfferAvailableInUs({ countries: ['US', 'CA'] }), true);

  const offers = normalizeOfferFeedPayload({
    offers: [{
      id: 'lootably-1',
      name: 'Test Wallet Reward',
      category: 'fintech',
      country: 'US',
      payout_usd: 10,
      url: 'https://example.com/feed-offer',
    }],
  }, 'Lootably');
  assert.equal(offers.length, 1);
  assert.equal(offers[0].incentiveValue, 8.5);
  assert.equal(offers[0].category, 'fintech');
});

test('S2S tracking URLs append user and click Sub-IDs safely', () => {
  const tracked = compileOutboundTrackingUrl('https://example.com/offer?campaign=seed', 'user-123', 'click-456');
  const url = new URL(tracked);
  assert.equal(url.searchParams.get('subid1'), 'user-123');
  assert.equal(url.searchParams.get('subid2'), 'click-456');
  assert.equal(url.searchParams.get('campaign'), 'seed');
  assert.equal(compileOutboundTrackingUrl('not-a-url', 'user', 'click'), '');
});

test('database seed configuration provides three campaigns and 15 American profiles', () => {
  assert.equal(SEED_PREFIX, 'seed_s4fc_');
  assert.equal(seedCampaigns.length, 3);
  assert.deepEqual(seedCampaigns.map((campaign) => campaign.category), ['gaming', 'fintech', 'crypto']);
  const monopoly = seedCampaigns.find((campaign) => campaign.id.endsWith('monopoly-go'));
  assert.deepEqual(monopoly.milestones.map((tier) => tier.payoutAmount), [2, 7.5, 25]);
  assert.equal(seedCampaigns.find((campaign) => campaign.id.endsWith('sofi-checking')).totalValue, 4.9);
  assert.equal(seedCampaigns.find((campaign) => campaign.id.endsWith('kraken-trade')).totalValue, 12);
  assert.equal(seedProfiles.length, 15);
  assert.equal(new Set(seedProfiles.map((profile) => profile[1])).size >= 15, true);
});

test('E2E withdrawal and RPS flows remain idempotent and balance-guarded', async () => {
  const rps = await request('/api/games/rps/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-rps-key' },
    body: JSON.stringify({ choice: 'rock', entryBet: 0.5 }),
  });
  assert.equal(rps.status, 401);

  const withdrawal = await request('/api/v1/withdrawals/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-withdrawal-key' },
    body: JSON.stringify({ amount: 5, channel: 'paypal', destination: 'e2e@example.com' }),
  });
  assert.equal(withdrawal.status, 401);
});

test('password signup validates email, username, and bcrypt input length before database access', async () => {
  const invalidEmail = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', username: 'cashfinder', password: 'a-secure-password' }),
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.body.field, 'email');

  const invalidUsername = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', username: 'x', password: 'a-secure-password' }),
  });
  assert.equal(invalidUsername.status, 400);
  assert.equal(invalidUsername.body.field, 'username');

  const invalidPassword = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', username: 'cashfinder', password: 'short' }),
  });
  assert.equal(invalidPassword.status, 400);
  assert.equal(invalidPassword.body.field, 'password');

  const oversizedPassword = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', username: 'cashfinder', password: 'é'.repeat(37) }),
  });
  assert.equal(oversizedPassword.status, 400);
  assert.equal(oversizedPassword.body.field, 'password');

  const validSignupWithoutDatabase = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', username: 'cashfinder', password: 'a-secure-password' }),
  });
  assert.equal(validSignupWithoutDatabase.status, 503);
});

test('password login validates identifiers and reports unavailable persistent storage', async () => {
  const invalidIdentifier = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'bad identifier', password: 'a-secure-password' }),
  });
  assert.equal(invalidIdentifier.status, 400);
  assert.equal(invalidIdentifier.body.field, 'identifier');

  const validLoginWithoutDatabase = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'cashfinder', password: 'a-secure-password' }),
  });
  assert.equal(validLoginWithoutDatabase.status, 503);
  assert.equal(validLoginWithoutDatabase.headers.get('set-cookie'), null);
});

test('auth session cookies are strict and secure in production', () => {
  assert.deepEqual(getAuthSessionCookieOptions(true), {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
  });
  assert.equal(getAuthSessionCookieOptions(false).secure, false);
});

test('HSTS is enabled only for production with a one-year lifetime', () => {
  assert.deepEqual(getStrictTransportSecurityOptions(true), { maxAge: 31_536_000 });
  assert.equal(getStrictTransportSecurityOptions(false), false);
});

test('signup and login requests are rate limited per client IP', async () => {
  for (const [path, ip] of [
    ['/api/auth/signup', '198.51.100.71'],
    ['/api/auth/login', '198.51.100.72'],
  ]) {
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
        body: JSON.stringify(path.endsWith('signup')
          ? { email: 'limit@example.test', username: 'limituser', password: 'a-secure-password' }
          : { identifier: 'limituser', password: 'a-secure-password' }),
      }));
    }

    assert.ok(responses.slice(0, 10).every((response) => response.status === 503));
    assert.equal(responses[10].status, 429);
    assert.equal(responses[10].body.error, 'Too many authentication attempts. Please try again later.');
    assert.ok(Number(responses[10].headers.get('retry-after')) > 0);
  }
});

test('malformed JSON errors return a generic response instead of a development trace', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'The request could not be processed.' });
  assert.equal(JSON.stringify(response.body).includes('SyntaxError'), false);
});

test('offer campaign schema validates flexible milestone tiers and payout totals', () => {
  const milestones = Array.from({ length: 25 }, (_, index) => ({
    step_number: index + 1,
    level: index + 1,
    description: `Complete milestone ${index + 1}`,
    payout_amount: 0.01,
  }));
  const valid = validateOfferCampaign({
    title: 'Seasonal game campaign',
    description: 'Complete stages to earn the listed rewards.',
    category: 'Gaming',
    total_value: 0.25,
    milestones,
    tracking_parameters: { source: 'newsletter' },
  }, 'seasonal-game', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  assert.ok(valid.campaign);
  assert.equal(valid.campaign.milestones.length, 25);
  assert.equal(valid.campaign.category, 'gaming');
  assert.equal(valid.campaign.total_value, 0.25);

  const defaultLevel = validateOfferCampaign({
    title: 'Level-based campaign',
    description: 'Reach the configured step.',
    category: 'fintech',
    milestones: [{ step_number: 10, description: 'Reach level 10', payout_amount: 1 }],
  }, 'level-based', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  assert.equal(defaultLevel.campaign.milestones[0].level, 10);
  assert.equal(defaultLevel.campaign.total_value, 1);

  const invalidTotal = validateOfferCampaign({
    title: 'Campaign',
    description: 'Campaign details.',
    category: 'fintech',
    total_value: 0.26,
    milestones,
  }, 'campaign', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  assert.equal(invalidTotal.field, 'total_value');

  const duplicateSteps = validateOfferCampaign({
    title: 'Campaign',
    description: 'Campaign details.',
    category: 'fintech',
    milestones: [{ ...milestones[0] }, { ...milestones[1], step_number: milestones[0].step_number }],
  }, 'campaign', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  assert.equal(duplicateSteps.field, 'milestones');
});

test('offer campaign create, update, and deactivate routes require an admin token', async () => {
  const create = await request('/api/admin/offers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Campaign' }),
  });
  assert.equal(create.status, 401);

  const update = await request('/api/admin/offers/seasonal-game', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Updated copy.' }),
  });
  assert.equal(update.status, 401);

  const deactivate = await request('/api/admin/offers/seasonal-game', { method: 'DELETE' });
  assert.equal(deactivate.status, 401);
});

test('affiliate postbacks reject malformed or unsigned payouts before storage access', async () => {
  const missingFields = await request('/api/v1/callbacks/postback');
  assert.equal(missingFields.status, 400);

  const event = {
    click_id: 'click-001',
    user_id: 'user-001',
    offer_id: 'offer-earnx',
    milestone_step: '1',
    payout: '2.00',
  };
  const unsignedPath = `/api/v1/callbacks/postback?${new URLSearchParams({ ...event, signature: '0'.repeat(64) })}`;
  const unsigned = await request(unsignedPath);
  assert.equal(unsigned.status, 403);

  const payload = buildPostbackSignaturePayload(event.click_id, event.user_id, event.offer_id, 1, 200);
  const signature = createHmac('sha256', process.env.POSTBACK_SECRET).update(payload).digest('hex');
  const signedBody = new URLSearchParams({ ...event, signature }).toString();
  const signed = await request('/api/v1/callbacks/postback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: signedBody,
  });
  assert.equal(signed.status, 503);
});

test('public live-offer feed masks usernames and only includes credited CPX transactions', async () => {
  assert.equal(maskPublicOfferUsername('MarkWinters'), 'Ma***_Wi***');
  assert.equal(maskPublicOfferUsername(''), 'Member');

  const transactionId = 'cpx-live-feed-test';
  const hash = createHash('md5').update(`${transactionId}${process.env.CPX_SECURE_HASH}`).digest('hex');
  const credited = await request(`/api/cpx/postback?${new URLSearchParams({
    status: '1',
    trans_id: transactionId,
    user_id: 'anonymous-cpx-user',
    amount_usd: '1.25',
    offer_id: 'survey-123',
    hash,
  })}`);
  assert.equal(credited.status, 200);
  const duplicate = await request(`/api/cpx/postback?${new URLSearchParams({
    status: '1',
    trans_id: transactionId,
    user_id: 'anonymous-cpx-user',
    amount_usd: '1.25',
    offer_id: 'survey-123',
    hash,
  })}`);
  assert.equal(duplicate.status, 200);
  const mismatchedUser = await request(`/api/cpx/postback?${new URLSearchParams({
    status: '2',
    trans_id: transactionId,
    user_id: 'different-user',
    amount_usd: '1.25',
    offer_id: 'survey-123',
    hash,
  })}`);
  assert.equal(mismatchedUser.status, 403);

  const feed = await request('/api/live-offers');
  assert.equal(feed.status, 200);
  assert.equal(feed.body.offers.length, 1);
  assert.deepEqual(feed.body.offers[0], {
    id: feed.body.offers[0].id,
    username: 'Member',
    offerwall: 'CPX Research',
    offer: 'Survey survey-123',
    payoutAmount: 1.25,
    creditedAt: feed.body.offers[0].creditedAt,
  });
  assert.equal(feed.headers.get('cache-control'), 'public, max-age=5, stale-while-revalidate=15');

  const reversalHash = createHash('md5').update(`${transactionId}${process.env.CPX_SECURE_HASH}`).digest('hex');
  const reversed = await request(`/api/cpx/postback?${new URLSearchParams({
    status: '2',
    trans_id: transactionId,
    user_id: 'anonymous-cpx-user',
    amount_usd: '1.25',
    offer_id: 'survey-123',
    hash: reversalHash,
  })}`);
  assert.equal(reversed.status, 200);
  const afterReversal = await request('/api/live-offers');
  assert.deepEqual(afterReversal.body.offers, []);
});

test('tracking readiness check reports temporary storage without creating an offer click', async () => {
  const clicksBefore = getOfferActivityReport(7).totals.clicks;
  const response = await request('/api/tracking-check');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'temporary', storage: 'memory' });
  assert.equal(getOfferActivityReport(7).totals.clicks, clicksBefore);
});

test('responses preserve a caller request ID for support diagnostics', async () => {
  const response = await request('/api/health', {
    headers: { 'x-request-id': 'test-request-123' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), 'test-request-123');
});

test('homepage suggestions are stored and only the owner can read them', async () => {
  const submitted = await request('/api/site-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Please add more no-deposit offers.', email: 'visitor@example.com' }),
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.success, true);

  const unauthorized = await request('/api/admin/site-messages');
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorized.body.error, 'Owner admin access is required.');

  const invalidEmail = await request('/api/site-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'A valid length message.', email: 'not-an-email' }),
  });
  assert.equal(invalidEmail.status, 400);
});

test('member referral endpoints require sign-in and database-backed referrals', async () => {
  const account = await request('/api/referrals/me');
  assert.equal(account.status, 401);
  assert.match(account.body.error, /sign in/i);
  const claim = await request('/api/referrals/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode: 'ABCDEF123456' }),
  });
  assert.equal(claim.status, 401);

  const updateCode = await request('/api/referrals/me/code', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode: 'MY-CUSTOM-LINK' }),
  });
  assert.equal(updateCode.status, 401);

  const preview = await request('/api/referrals/preview?code=MY-CUSTOM-LINK');
  assert.equal(preview.status, 503);
  assert.match(preview.body.error, /temporarily unavailable/i);
});

test('missing-credit support tickets require auth and reject unsafe details', async () => {
  const unauthorized = await request('/api/v1/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Missing offer credit',
      message: 'My offer completed but no credit arrived.',
      transactionReferenceId: 'offer-click-123',
      screenshotUrl: 'https://example.com/screenshot.png',
    }),
  });
  assert.equal(unauthorized.status, 401);

  const adminList = await request('/api/admin/support/tickets');
  assert.equal(adminList.status, 403);
});

test('lifetime referral commission calculates a capped 10-percent payout share', () => {
  assert.equal(calculateReferralCommissionCents(200, 10), 20);
  assert.equal(calculateReferralCommissionCents(250, 10), 25);
  assert.equal(calculateReferralCommissionCents(1, 10), 0);
  assert.equal(calculateReferralCommissionCents(-100, 10), 0);
});

test('referral payouts require twice the reward in verified net commission', () => {
  assert.equal(canApproveReferralPayout(9.99), false);
  assert.equal(canApproveReferralPayout(10), true);
  assert.equal(canApproveReferralPayout(Number.NaN), false);
  assert.equal(canApproveReferralPayout(Number.POSITIVE_INFINITY), false);
});

test('Google OAuth referral state is signed, nonce-bound, and expires', () => {
  const issuedAt = Date.now();
  const state = createGoogleOAuthState('test-nonce', 'ABCDEF123456', issuedAt);
  assert.deepEqual(readGoogleOAuthState(state, 'test-nonce'), { referralCode: 'ABCDEF123456' });
  assert.equal(readGoogleOAuthState(state, 'other-nonce'), null);
  assert.equal(readGoogleOAuthState(`${state}tampered`, 'test-nonce'), null);

  const expiredState = createGoogleOAuthState('test-nonce', 'ABCDEF123456', issuedAt - 11 * 60 * 1000);
  assert.equal(readGoogleOAuthState(expiredState, 'test-nonce'), null);
});

test('Google signup preserves valid referral codes in OAuth state', async () => {
  const response = await requestText('/api/auth/google?ref=MARK-REF_1', { redirect: 'manual' });
  assert.equal(response.status, 302);
  const redirectUrl = new URL(response.headers.get('location'));
  assert.equal(redirectUrl.searchParams.get('client_id'), 'test-google-client');
  const state = redirectUrl.searchParams.get('state');
  const cookie = response.headers.get('set-cookie');
  const nonce = cookie?.match(/sfc_oauth_state=([a-f0-9]+)/)?.[1];
  assert.match(cookie || '', /SameSite=Lax/i);
  assert.ok(state);
  assert.ok(nonce);
  assert.deepEqual(readGoogleOAuthState(state, nonce), { referralCode: 'MARK-REF_1' });

  const malformedCode = await requestText('/api/auth/google?ref=bad%20code', { redirect: 'manual' });
  assert.equal(malformedCode.status, 302);
  const malformedState = new URL(malformedCode.headers.get('location')).searchParams.get('state');
  const malformedNonce = malformedCode.headers.get('set-cookie')?.match(/sfc_oauth_state=([a-f0-9]+)/)?.[1];
  assert.ok(malformedState);
  assert.ok(malformedNonce);
  assert.deepEqual(readGoogleOAuthState(malformedState, malformedNonce), { referralCode: null });
});

test('sitemap contains only canonical indexable routes', async () => {
  const response = await requestText('/sitemap.xml');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/i);
  assert.match(response.body, /\/cashback-offers</);
  assert.match(response.body, /\/partners</);
  assert.match(response.body, /\/guides</);
  assert.match(response.body, /\/best-fintech-bonuses</);
  assert.match(response.body, /\/terms</);
  assert.match(response.body, /\/privacy</);
  assert.match(response.body, /\/cookies</);
  assert.match(response.body, /\/affiliate-disclosure</);
  assert.equal((response.body.match(/<loc>/g) || []).length, 35);
  assert.match(response.body, /\/offers\/chime</);
  assert.doesNotMatch(response.body, /\.html/);
  assert.doesNotMatch(response.body, /\?offer=/);
});

test('guides directory links to all canonical editorial pages', async () => {
  const response = await requestText('/guides');
  assert.equal(response.status, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/guides"/);
  for (const route of [
    '/cashback-offers',
    '/signup-bonus-sites',
    '/free-stock-bonuses',
    '/banking-signup-offers',
    '/crypto-signup-bonuses',
    '/best-no-deposit-bonuses-this-month',
    '/how-to-compare-referral-bonuses-safely',
    '/best-cashback-apps',
    '/best-fintech-bonuses',
    '/best-rewards-apps',
    '/best-free-stock-offers-for-beginners',
    '/best-fintech-bonuses-without-deposit',
    '/cashback-apps-that-pay-paypal',
    '/ibotta-referral-bonus',
    '/ibotta-vs-upside',
    '/apps-that-pay-for-receipts',
  ]) {
    assert.match(response.body, new RegExp(`href="${route}"`), `${route} should be linked from the directory`);
  }
});

test('publisher partnership page explains current tracking and contact details', async () => {
  const response = await requestText('/partners');
  assert.equal(response.status, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/partners"/);
  assert.match(response.body, /do not currently claim to verify game milestones/i);
  assert.match(response.body, /server-to-server postbacks/i);
  assert.match(response.body, /mailto:support@signups4fastcash\.com/);
});

test('robots.txt allows crawling and identifies the submitted sitemap', async () => {
  const response = await requestText('/robots.txt');
  assert.equal(response.status, 200);
  assert.match(response.body, /User-agent:\s*\*\s*Allow:\s*\/?/i);
  assert.match(response.body, /Sitemap:\s*https:\/\/signups4fastcash\.com\/sitemap\.xml/i);
});

test('Ibotta referral guide gives specific eligibility and tracking guidance', async () => {
  const response = await requestText('/ibotta-referral-bonus');
  assert.equal(response.status, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/ibotta-referral-bonus"/);
  assert.match(response.body, /Referral reward versus regular cashback/);
  assert.match(response.body, /Before making a purchase/);
});

test('Ibotta vs Upside guide answers the cashback comparison queries', async () => {
  const response = await requestText('/ibotta-vs-upside');
  assert.equal(response.status, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/ibotta-vs-upside"/);
  assert.match(response.body, /Ibotta vs\. Upside: Which Cashback App Is Better for You\?/);
  assert.match(response.body, /Ibotta vs\. Upside for retail rewards/);
  assert.match(response.body, /How do the apps track a qualifying purchase/);
  assert.match(response.body, /do not give shoppers a shared, independent measure/);
  assert.match(response.body, /https:\/\/www\.ibotta\.com\//);
  assert.match(response.body, /https:\/\/www\.upside\.com\//);
});

test('signup bonus guide explains simple signup requirements without promising easy rewards', async () => {
  const response = await requestText('/signup-bonus-sites');
  assert.equal(response.status, 200);
  assert.match(response.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/signup-bonus-sites"/);
  assert.match(response.body, /Simple Sign-Up Bonus Sites: Compare Offers \| S4FC/);
  assert.match(response.body, /What makes a sign-up bonus simple/);
  assert.match(response.body, /Frequently asked questions/);
  assert.match(response.body, /may still require verification or activity/);
  assert.match(response.body, /requirements and payout terms, not just the headline reward/);
});

test('legacy and .html SEO URLs redirect before static files can serve duplicate pages', async () => {
  const redirects = [
    ['/index.html', '/'],
    ['/support.html', '/'],
    ['/about.html', '/#trust'],
    ['/disclosures.html', '/#trust'],
    ['/cashback-offers.html', '/cashback-offers'],
    ['/best-cashback-offers.html', '/cashback-offers'],
    ['/banking-fintech-signup-bonuses.html', '/banking-signup-offers'],
  ];
  for (const [path, canonicalPath] of redirects) {
    const response = await requestText(path, { redirect: 'manual' });
    assert.equal(response.status, 301, `${path} should redirect`);
    assert.equal(response.headers.get('location'), canonicalPath);
  }

  const canonicalPage = await requestText('/cashback-offers');
  assert.equal(canonicalPage.status, 200);
  assert.match(canonicalPage.body, /rel="canonical" href="https:\/\/signups4fastcash\.com\/cashback-offers"/);
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

test('removed offers do not remain in the hidden offers catalog', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  for (const offer of [
    { id: 'offer-era-referral', company: 'Era' },
    { id: 'candidate-pnc-virtual-wallet-400', company: 'PNC Bank' },
    { id: 'candidate-wells-fargo-everyday-checking-325', company: 'Wells Fargo' },
  ]) {
    assert.equal(isTemporarilyHiddenOffer(offer), true, `${offer.company} should be removed from the offer catalog`);
    assert.equal(response.body.offers.some((candidate) => candidate.id === offer.id), false);
  }
});

test('hidden referral offer candidates are not exposed in the public offer catalog', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const candidateIds = [
    'candidate-fetch-referral-a7qrrp',
    'candidate-triumph-rips-referral-jsxfnvt',
  ];
  const publicIds = response.body.offers.map((offer) => offer.id);
  candidateIds.forEach((id) => assert.equal(publicIds.includes(id), false, `${id} must stay hidden`));
});

test('EarnX offer clearly lists the referral reward, cashout thresholds, and verification terms', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-earnx');

  assert.ok(offer, 'EarnX should be in the public offer catalog');
  assert.equal(offer.referralCode, '8HLWMZ');
  assert.equal(offer.referralCodeRequired, true);
  assert.equal(offer.referralUrl, 'https://earnx.gg/r/8HLWMZ');
  assert.equal(offer.incentiveValue, 2);
  assert.match(offer.incentiveAmount, /\$2/);
  assert.match(offer.honestTruth.minimumHoldTime, /first cashout.*\$20.*later cashouts.*\$1/i);
  assert.match(offer.honestTruth.hiddenFeesWarning, /selfie/i);
  assert.match(offer.honestTruth.theCatch, /\$0\.50.*free spin/i);
  assert.match(offer.speedrunHints[3].instruction, /offer-tracking check/i);
  assert.match(offer.speedrunHints[3].proTip, /does not guarantee/i);

  const logo = await request('/company-logos/earnx.gg-logo.jpg');
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/jpeg/i);
});

test('public offers disclose complete requirements without unsupported trust or payout guarantees', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offers = response.body.offers;
  assert.ok(offers.length >= 20, 'the audit should cover the full public offer catalog');
  assert.equal(new Set(offers.map((offer) => offer.id)).size, offers.length, 'offer IDs should be unique');

  for (const offer of offers) {
    assert.equal(offer.status, 'live', `${offer.company} should be live`);
    assert.ok(offer.id && offer.company && offer.title, `${offer.company} should have identifying details`);
    assert.ok(offer.category, `${offer.company} should have a category`);
    assert.ok(offer.incentiveAmount, `${offer.company} should state the advertised reward`);
    assert.ok(Number.isFinite(offer.incentiveValue) && offer.incentiveValue >= 0, `${offer.company} should have a valid sort value`);
    assert.ok(offer.payoutSpeed, `${offer.company} should disclose reward timing`);
    assert.ok(offer.difficulty, `${offer.company} should disclose setup effort`);
    assert.ok(offer.depositRequired, `${offer.company} should disclose upfront requirements`);
    assert.ok(offer.availability, `${offer.company} should disclose availability`);
    assert.match(offer.officialMerchantUrl, /^https:/, `${offer.company} provider URL should use HTTPS`);
    assert.match(offer.referralUrl, /^https:/, `${offer.company} referral URL should use HTTPS`);
    assert.ok(offer.honestTruth?.summary, `${offer.company} should summarize what the user may receive`);
    assert.ok(offer.honestTruth?.theCatch, `${offer.company} should disclose conditions`);
    assert.ok(offer.honestTruth?.minimumHoldTime, `${offer.company} should disclose when the reward may be available`);
    assert.ok(offer.honestTruth?.hiddenFeesWarning, `${offer.company} should disclose costs and risks`);
    assert.equal(typeof offer.honestTruth?.idVerificationRequired, 'boolean', `${offer.company} should state ID verification information`);
    assert.ok(Array.isArray(offer.speedrunHints) && offer.speedrunHints.length > 0, `${offer.company} should have qualifying steps`);
    offer.speedrunHints.forEach((hint, index) => {
      assert.equal(hint.step, index + 1, `${offer.company} steps should be in order`);
      assert.ok(hint.instruction, `${offer.company} step ${index + 1} should be explained`);
    });
    assert.ok(!offer.verificationStatus || ['unverified', 'reviewed', 'terms-vary'].includes(offer.verificationStatus), `${offer.company} should have a recognized review status`);
    if (offer.verificationStatus === 'unverified') {
      assert.match(`${offer.honestTruth.summary} ${offer.honestTruth.theCatch}`, /possible|may |current .*terms|check .*terms|can change/i, `${offer.company} should explain that offer details may vary and direct users to current terms`);
    }
  }
});

test('Inter offer explains Loop points value and required referral code', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-inter-loop-points');

  assert.ok(offer, 'Inter should be in the public offer catalog');
  assert.equal(offer.referralCode, 'OVTHOJDC');
  assert.equal(offer.referralCodeRequired, true);
  assert.match(offer.referralUrl, /^https:\/\/inter\.co\/us\/$/);
  assert.equal(offer.incentiveValue, 25);
  assert.match(offer.title, /\$25 in Loop points/i);
  assert.match(offer.incentiveAmount, /10,000 Loop points.*about \$25.*not cash/i);
  assert.match(offer.honestTruth.summary, /eligible new member and referrer may each receive 10,000 Loop points/i);
  assert.match(offer.honestTruth.summary, /enter referral code OVTHOJDC during signup/i);
  assert.match(offer.honestTruth.theCatch, /depend on Inter.s current Loop Rewards terms/i);
  assert.match(offer.honestTruth.hiddenFeesWarning, /not cash/i);
  assert.equal(offer.honestTruth.idVerificationRequired, true);
});

test('unsupported Acebet and Debbie promos are kept out of public listings', () => {
  assert.equal(isTemporarilyHiddenOffer({ id: 'custom-acebet', company: 'Acebet' }), true);
  assert.equal(isTemporarilyHiddenOffer({ id: 'custom-debbie', company: 'Debbie' }), true);
  assert.equal(isTemporarilyHiddenOffer({
    id: 'candidate-debbie-referral',
    company: 'Debbie',
    title: 'Debbie: Check current referral rewards',
    verificationStatus: 'unverified',
  }), false);
  assert.equal(isTemporarilyHiddenOffer({ id: 'offer-ibotta', company: 'Ibotta' }), false);
});

test('CoinsBack details remain explicitly unverified after offer-store initialization', () => {
  const offer = applyCoinsBackTerms({
    company: 'Coinsback Casino',
    verifiedAt: '2026-10-01T00:00:00.000Z',
    verificationExpiresAt: '2026-11-01T00:00:00.000Z',
  });
  assert.equal(offer.verificationStatus, 'unverified');
  assert.equal(offer.verifiedAt, undefined);
  assert.equal(offer.verificationExpiresAt, undefined);
  assert.match(offer.honestTruth.theCatch, /not independently confirmed|may not be cash/i);
  assert.match(offer.incentiveAmount, /reported/i);
});

test('offer content edits invalidate old reviews until details are checked again', () => {
  const existing = {
    verificationStatus: 'reviewed',
    verifiedAt: '2026-10-01T00:00:00.000Z',
    verificationExpiresAt: '2026-11-01T00:00:00.000Z',
  };
  const edited = resolveOfferVerificationUpdate(existing, { incentiveAmount: '$50 reported bonus' });
  assert.equal(edited.verificationStatus, 'unverified');
  assert.equal(edited.verifiedAt, undefined);
  assert.equal(edited.verificationExpiresAt, undefined);

  const markedReviewed = resolveOfferVerificationUpdate(existing, {
    verificationStatus: 'reviewed',
    verifiedAt: new Date().toISOString(),
    verificationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(markedReviewed.verificationStatus, 'reviewed');
});

test('Measure Protocol offer describes its broad range of eligible account connections', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'candidate-measure-protocol-msr-referral');
  assert.ok(offer);
  assert.equal(offer.status, 'live');
  assert.equal(offer.referralCode, '7Osjyx6m');
  assert.match(offer.incentiveAmount, /\$10/);
  assert.match(offer.payoutSpeed, /check PayPal withdrawal timing and minimum/i);
  assert.match(offer.honestTruth.summary, /Google, ChatGPT, Facebook, Instagram, YouTube, Netflix, and others/i);
  assert.match(offer.depositRequired, /accounts or services supported by MSR/i);
  assert.match(offer.honestTruth.theCatch, /Connected services can share account or activity data/i);
});

test('Joko offer clearly separates the $5 referral and $5 qualifying Plaid bank-link rewards', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-joko');
  assert.ok(offer);
  assert.match(offer.title, /\$5 signup \+ \$5 bank link/i);
  assert.match(offer.incentiveAmount, /\$5.*referral link.*\$5.*qualifying bank account/i);
  assert.match(offer.honestTruth.summary, /through Plaid for another \$5/i);
  assert.match(offer.honestTruth.summary, /bank account you use for most purchases/i);
  assert.match(offer.speedrunHints[1].instruction, /qualifying bank account through Plaid/i);
});

test('Debbie referral card is available without unsupported reward or payout claims', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'candidate-debbie-referral');
  assert.ok(offer);
  assert.equal(offer.verificationStatus, 'unverified');
  assert.equal(offer.incentiveValue, 0);
  assert.equal(offer.referralUrl, 'https://www.joindebbie.com/referral?name=Mark&ref_id=2FMKVWHWZ');
  assert.match(offer.honestTruth.summary, /current reward amount.*have not been confirmed/i);
  assert.doesNotMatch(`${offer.incentiveAmount} ${offer.honestTruth.summary}`, /\$\d/);
});

test('SoFi remains available in the public offers catalog without the featured money path', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  assert.ok(response.body.offers.some((offer) => offer.id === 'offer-sofi-banking'));
  assert.ok(response.body.offers.some((offer) => offer.id === 'candidate-debbie-referral'));
});

test('the old Era subscription offer is removed from the public catalog', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  assert.equal(response.body.offers.some((offer) => offer.id === 'offer-era-referral'), false);
});

test('Kalshi public offer reflects the supplied referral URL and reward conditions', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-kalshi');
  assert.ok(offer);
  assert.equal(offer.referralUrl, 'https://kalshi.com/r/75f5cdb1-f534-4db6-8ec3-ba0ca0003a23');
  assert.match(offer.incentiveAmount, /\$25\u2013\$2,000/);
  assert.match(offer.depositRequired, /\$5/);
  assert.match(offer.honestTruth.summary, /\$25 in qualifying trading volume/);
  assert.match(offer.honestTruth.hiddenFeesWarning, /loss/);
  assert.doesNotMatch(offer.honestTruth.summary, /10% off fees/);
});

test('Verb public offer lists possible rewards and discloses data-sharing conditions', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-verb');
  assert.ok(offer);
  assert.equal(offer.referralCode, 'G284G5GH');
  assert.match(offer.incentiveAmount, /\$3 signup bonus/);
  assert.match(offer.incentiveAmount, /\$30\/month tracker/);
  assert.match(offer.honestTruth.summary, /possible \$5 rewards for Instagram data, TikTok data, and linking email/);
  assert.match(offer.honestTruth.summary, /A \$10 referral reward may require the referred user to link a bank/);
  assert.match(offer.honestTruth.hiddenFeesWarning, /purchase activity/);
  assert.match(offer.honestTruth.theCatch, /Reward amounts and requirements can change/);
});

test('Revolut public offer lists its requirements and conditional S4FC share', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-revolut');
  assert.ok(offer);
  assert.match(offer.depositRequired, /3 qualifying \$10 purchases/);
  assert.match(offer.depositRequired, /physical card/);
  assert.match(offer.incentiveAmount, /Possible \$50 share/);
  assert.match(offer.honestTruth.summary, /Revolut does not pay this share directly to the new customer/);
  assert.match(offer.honestTruth.theCatch, /it is not a Revolut signup bonus and is not guaranteed/i);
  assert.match(offer.speedrunHints[3].instruction, /support@signups4fastcash\.com/);
});

test('Coinbase public offer reflects the reported $20 reward and crypto-trade condition', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-coinbase');
  assert.ok(offer);
  assert.match(offer.incentiveAmount, /\$20 reward/);
  assert.match(offer.depositRequired, /\$15/);
  assert.equal(offer.verificationStatus, 'unverified');
  assert.match(offer.honestTruth.hiddenFeesWarning, /lose value/);
  assert.match(offer.honestTruth.theCatch, /Review Coinbase.s current terms before trading/);
});

test('newer Kalshi catalog terms replace stale saved terms while preserving offer status and counts', () => {
  const catalogOffer = {
    id: 'offer-kalshi',
    title: 'Current reward',
    referralUrl: 'https://kalshi.com/r/current',
    updatedAt: '2026-10-02T15:45:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'offer-kalshi',
    title: 'Old reward',
    referralUrl: 'https://kalshi.com/r/old',
    updatedAt: '2026-09-16T22:25:33Z',
    status: 'hidden',
    clicksCount: 12,
    conversionsCount: 3,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, 'Current reward');
  assert.equal(merged.referralUrl, 'https://kalshi.com/r/current');
  assert.equal(merged.status, 'hidden');
  assert.equal(merged.clicksCount, 12);
  assert.equal(merged.conversionsCount, 3);

  const newerSaved = { ...savedOffer, title: 'Admin-edited title', updatedAt: '2026-10-03T00:00:00.000Z' };
  assert.equal(mergeCatalogOffer(catalogOffer, newerSaved).title, 'Admin-edited title');
});

test('newer Joko terms replace stale saved offer copy while preserving referral counts', () => {
  const catalogOffer = {
    id: 'offer-joko',
    title: 'Get up to $10 with Joko: $5 signup + $5 bank link',
    incentiveAmount: '$5 for joining through the referral link + $5 for linking a qualifying bank account',
    updatedAt: '2026-10-05T04:15:00.000Z',
    honestTruth: {
      summary: 'Use the referral link for $5, then connect a qualifying bank through Plaid for another $5.',
    },
  };
  const savedOffer = {
    id: 'offer-joko',
    title: 'Get a $5 reward after signup',
    incentiveAmount: '$5 Reward',
    updatedAt: '2026-09-12T00:00:00.000Z',
    status: 'live',
    clicksCount: 8,
    conversionsCount: 2,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.incentiveAmount, catalogOffer.incentiveAmount);
  assert.equal(merged.honestTruth.summary, catalogOffer.honestTruth.summary);
  assert.equal(merged.clicksCount, 8);
  assert.equal(merged.conversionsCount, 2);
});

test('newer Inter reward wording replaces stale saved copy while preserving referral counts', () => {
  const catalogOffer = {
    id: 'offer-inter-loop-points',
    title: 'Get $25 in Loop points with Inter',
    incentiveAmount: '10,000 Loop points (about $25; not cash)',
    updatedAt: '2026-10-27T05:00:00.000Z',
    honestTruth: {
      summary: '10,000 Loop points are worth about $25, not cash.',
    },
  };
  const savedOffer = {
    id: 'offer-inter-loop-points',
    title: 'Get 10,000 Loop points with Inter',
    incentiveAmount: '10,000 Loop points (reported equivalent: $25)',
    updatedAt: '2026-10-24T00:00:00.000Z',
    status: 'live',
    clicksCount: 9,
    conversionsCount: 2,
  };

  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.incentiveAmount, catalogOffer.incentiveAmount);
  assert.equal(merged.honestTruth.summary, catalogOffer.honestTruth.summary);
  assert.equal(merged.status, 'live');
  assert.equal(merged.clicksCount, 9);
  assert.equal(merged.conversionsCount, 2);
});

test('newer Verb catalog details replace stale saved terms while preserving visibility and counts', () => {
  const catalogOffer = {
    id: 'offer-verb',
    title: 'Possible $3 Verb signup bonus plus data rewards',
    incentiveAmount: '$3 signup bonus; possible $5 data rewards and $30/month tracker',
    referralUrl: 'https://verb-data.com/signup?ref=G284G5GH',
    updatedAt: '2026-10-29T22:00:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
    honestTruth: {
      summary: 'S4FC lists a possible $3 signup bonus and possible additional data rewards.',
    },
    payoutSpeed: 'Timing and approval vary; check tracker terms with Verb',
  };
  const savedOffer = {
    id: 'offer-verb',
    title: 'Get a reported $3 Verb signup bonus plus data rewards',
    incentiveAmount: '$3 signup bonus; reported $5 data rewards and $30/month tracker',
    updatedAt: '2026-10-24T14:31:06.371Z',
    status: 'hidden',
    clicksCount: 8,
    conversionsCount: 2,
    honestTruth: {
      summary: 'Additional reported rewards are available.',
    },
    payoutSpeed: 'Tracker reward is reported as monthly',
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.incentiveAmount, catalogOffer.incentiveAmount);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.honestTruth.summary, catalogOffer.honestTruth.summary);
  assert.equal(merged.payoutSpeed, catalogOffer.payoutSpeed);
  assert.equal(merged.status, 'hidden');
  assert.equal(merged.clicksCount, 8);
  assert.equal(merged.conversionsCount, 2);
});

test('newer Revolut catalog terms replace stale saved terms while preserving visibility and counts', () => {
  const catalogOffer = {
    id: 'offer-revolut',
    title: 'Updated Revolut referral terms',
    referralUrl: 'https://revolut.com/referral/current',
    updatedAt: '2026-10-02T16:05:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'offer-revolut',
    title: 'Old Revolut reward',
    updatedAt: '2026-09-12T00:00:00Z',
    status: 'hidden',
    clicksCount: 5,
    conversionsCount: 1,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.status, 'hidden');
  assert.equal(merged.clicksCount, 5);
  assert.equal(merged.conversionsCount, 1);
});

test('newer Coinbase catalog terms replace stale saved terms while preserving visibility and counts', () => {
  const catalogOffer = {
    id: 'offer-coinbase',
    title: 'Reported $20 reward',
    referralUrl: 'https://coinbase.com/join/MW4MCPR',
    verifiedAt: undefined,
    verificationStatus: 'unverified',
    updatedAt: '2026-10-02T16:10:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'offer-coinbase',
    title: 'Old $25 reward',
    referralUrl: 'https://coinbase.com/join/old',
    verifiedAt: '2026-09-16T00:00:00Z',
    verificationStatus: 'reviewed',
    updatedAt: '2026-09-12T00:00:00Z',
    status: 'hidden',
    clicksCount: 7,
    conversionsCount: 2,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.verifiedAt, undefined);
  assert.equal(merged.verificationStatus, 'unverified');
  assert.equal(merged.status, 'hidden');
  assert.equal(merged.clicksCount, 7);
  assert.equal(merged.conversionsCount, 2);
});

test('newer Measure Protocol terms update stale saved terms and publish the offer', () => {
  const catalogOffer = {
    id: 'candidate-measure-protocol-msr-referral',
    title: 'MSR: Free instant PayPal cashout at $10',
    referralUrl: 'https://contributor.measureprotocol.com/i/7Osjyx6m',
    updatedAt: '2026-10-27T04:30:00.000Z',
    payoutSpeed: 'Check PayPal withdrawal timing and minimum in the app',
    honestTruth: {
      summary: 'Join Measure Protocol using the referral link and review the current reward terms.',
    },
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'candidate-measure-protocol-msr-referral',
    title: 'Old doubled welcome bonus',
    referralUrl: 'https://contributor.measureprotocol.com/i/old',
    payoutSpeed: 'Free instant PayPal withdrawal after the $10 minimum (owner-reported)',
    honestTruth: {
      summary: 'The site owner reports an instant reward.',
    },
    updatedAt: '2026-10-24T14:31:09.426Z',
    status: 'hidden',
    clicksCount: 2,
    conversionsCount: 0,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.payoutSpeed, catalogOffer.payoutSpeed);
  assert.equal(merged.honestTruth.summary, catalogOffer.honestTruth.summary);
  assert.equal(merged.status, 'live');
  assert.equal(merged.clicksCount, 2);
});

test('newer Ero referral details replace stale terms and publish the featured guide', () => {
  const catalogOffer = {
    id: 'candidate-ero-app-referral',
    title: 'Ero: Guide to the reported $40 Kraken offer',
    referralUrl: 'https://ero.app/r/v7tfsepe5d?link=bgp4v6nfbrt6',
    updatedAt: '2026-11-11T22:25:00.000Z',
    status: 'live',
    featured: true,
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'candidate-ero-app-referral',
    title: 'Old Ero reward',
    updatedAt: '2026-10-02T00:00:00.000Z',
    status: 'live',
    clicksCount: 4,
    conversionsCount: 1,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.status, 'live');
  assert.equal(merged.featured, true);
  assert.equal(merged.clicksCount, 4);
  assert.equal(merged.conversionsCount, 1);
});

test('Ero offer details distinguish the reported Kraken reward and cashout claims from verified terms', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'candidate-ero-app-referral');
  assert.ok(offer);
  assert.equal(offer.status, 'live');
  assert.equal(offer.featured, true);
  assert.equal(offer.referralUrl, 'https://ero.app/r/v7tfsepe5d?link=bgp4v6nfbrt6');
  assert.equal(offer.incentiveValue, 0);
  assert.match(offer.incentiveAmount, /reported \$40 Kraken offer/i);
  assert.match(offer.payoutSpeed, /timing vary/i);
  assert.match(offer.honestTruth.summary, /not a verified or guaranteed promotion/i);
  assert.match(offer.honestTruth.summary, /at least \$13/i);
  assert.match(offer.honestTruth.summary, /after a \$10 Kraken deposit/i);
  assert.match(offer.honestTruth.hiddenFeesWarning, /mentions a \$2/i);
  assert.equal(offer.honestTruth.idVerificationRequired, true);
  const eroCopy = [
    offer.title,
    offer.incentiveAmount,
    offer.payoutSpeed,
    offer.honestTruth.summary,
    offer.honestTruth.theCatch,
    offer.honestTruth.minimumHoldTime,
    offer.honestTruth.hiddenFeesWarning,
    ...offer.speedrunHints.flatMap((hint) => [hint.instruction, hint.proTip]),
  ].join(' ');
  assert.match(eroCopy, /reported \$40/i);
  assert.match(eroCopy, /neither is verified here/i);
  assert.match(eroCopy, /fee/i);
});

test('newsletter email layout uses the website theme and Glory typography', () => {
  const html = newsletterEmailLayout('<h1>Test message</h1>');
  assert.match(html, /font-family: "Glory", sans-serif/);
  assert.match(html, /https:\/\/signups4fastcash\.com\/fonts\/Glory-Variable\.ttf/);
  assert.match(html, /class="email-typography" style="font-family:'Glory',sans-serif !important;"/);
  assert.match(html, /bgcolor="#04080d"/);
  assert.match(html, /bgcolor="#0d1724"/);
  assert.match(html, /#2dd4ee/);
  assert.match(html, /Test message/);
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

test('page-view endpoint records anonymous aggregate loads without returning the count', async () => {
  const before = getAggregatePageViewCount();
  const first = await request('/api/analytics/pageview', { method: 'POST' });
  const second = await request('/api/analytics/pageview', { method: 'POST' });
  assert.equal(first.status, 204);
  assert.equal(first.body, null);
  assert.equal(second.status, 204);
  assert.equal(second.body, null);
  assert.equal(getAggregatePageViewCount(), before + 2);
});

test('aggregate analytics totals are restricted to the owner admin', async () => {
  const response = await request('/api/admin/analytics/totals');
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Owner admin access is required.');
});

test('subscriber count endpoint never returns private subscriber records', async () => {
  const response = await request('/api/newsletter/subscribers', {
    headers: { 'x-admin-token': 'not-a-valid-token' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['count']);
});

test('subscriber email list requires owner admin access', async () => {
  const response = await request('/api/admin/newsletter/subscribers');
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Owner admin access is required.');
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

test('first-party offer redirects record one click before redirecting', async () => {
  const before = getOfferActivityReport(7).offers['offer-western-union-referral']?.clicks || 0;
  const publicBefore = await request('/api/offers');
  const publicCountBefore = publicBefore.body.offers.find((offer) => offer.id === 'offer-western-union-referral').clicksCount;
  const response = await requestText('/go/offer-western-union-referral', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /^https:\/\/.+/);
  const after = getOfferActivityReport(7).offers['offer-western-union-referral']?.clicks || 0;
  const publicAfter = await request('/api/offers');
  const publicCountAfter = publicAfter.body.offers.find((offer) => offer.id === 'offer-western-union-referral').clicksCount;
  assert.equal(after, before + 1);
  assert.equal(publicCountAfter, publicCountBefore + 1);
});

test('first-party offer redirects reject unavailable offers without recording clicks', async () => {
  const response = await requestText('/go/not-a-live-offer', { redirect: 'manual' });
  assert.equal(response.status, 404);
  assert.equal(response.body, 'This offer is unavailable.');
});

test('confirmed revenue ledger is owner-only for reads and writes', async () => {
  const getResponse = await request('/api/admin/revenue');
  assert.equal(getResponse.status, 403);
  assert.equal(getResponse.body.error, 'Owner admin access is required.');
  const deleteResponse = await request('/api/admin/revenue/test-event-id', { method: 'DELETE' });
  assert.equal(deleteResponse.status, 403);
  assert.equal(deleteResponse.body.error, 'Owner admin access is required.');
  const postResponse = await request('/api/admin/revenue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      offerId: 'offer-western-union-referral',
      type: 'commission',
      amount: 1,
    }),
  });
  assert.equal(postResponse.status, 403);
  assert.equal(postResponse.body.error, 'Owner admin access is required.');
});

test('referral payout queue and status updates require owner admin access', async () => {
  const list = await request('/api/admin/referrals');
  assert.equal(list.status, 403);
  assert.equal(list.body.error, 'Owner admin access is required.');

  const update = await request('/api/admin/referrals/test-referral-id/status', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(update.status, 403);
  assert.equal(update.body.error, 'Owner admin access is required.');

  const revenue = await request('/api/admin/referrals/test-referral-id/revenue', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verifiedNetRevenue: 100 }),
  });
  assert.equal(revenue.status, 403);
  assert.equal(revenue.body.error, 'Owner admin access is required.');
});

test('valid offer click events appear in the shared rolling activity report', async () => {
  const before = getOfferActivityReport(7).offers['offer-western-union-referral']?.clicks || 0;
  const totalBefore = getOfferActivityReport(7).totals.clicks;
  const response = await request('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: 'offer-western-union-referral', type: 'click' }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.offer.id, 'offer-western-union-referral');

  const report = getOfferActivityReport(7);
  assert.equal(report.offers['offer-western-union-referral'].clicks, before + 1);
  assert.equal(report.totals.clicks, totalBefore + 1);
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

test('offer activity since a saved cursor reports only newly recorded events by offer', () => {
  const from = new Date('2026-10-01T00:00:00.000Z');
  const checkedAt = new Date('2026-10-02T12:00:00.000Z');
  const report = buildOfferActivitySinceReport([
    { offerId: 'offer-ibotta', type: 'click', recordedAt: '2026-09-30T23:59:59.000Z' },
    { offerId: 'offer-ibotta', type: 'click', recordedAt: '2026-10-01T00:00:00.000Z' },
    { offerId: 'offer-chime', type: 'click', recordedAt: '2026-10-02T11:00:00.000Z' },
    { offerId: 'offer-chime', type: 'conversion', recordedAt: '2026-10-02T11:30:00.000Z' },
    { offerId: 'offer-ibotta', type: 'click', recordedAt: '2026-10-02T12:00:01.000Z' },
  ], from.toISOString(), checkedAt);
  assert.equal(report.from, from.toISOString());
  assert.equal(report.to, checkedAt.toISOString());
  assert.deepEqual(report.totals, { clicks: 2, conversions: 1 });
  assert.deepEqual(report.offers, {
    'offer-ibotta': { clicks: 1, conversions: 0 },
    'offer-chime': { clicks: 1, conversions: 1 },
  });
});

test('offer impression tracking endpoint is disabled', async () => {
  const response = await request('/api/analytics/impression', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: 'offer-western-union-referral', position: 2, visitorId: 'test-visitor' }),
  });
  assert.equal(response.status, 410);
  assert.equal(response.body.error, 'Offer impression tracking is disabled.');
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

