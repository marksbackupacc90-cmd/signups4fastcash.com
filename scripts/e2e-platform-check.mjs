import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!key?.startsWith('--')) continue;
  args.set(key, process.argv[index + 1] || 'true');
}

const baseUrl = (args.get('--base-url') || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const dryRun = args.has('--dry-run');
const offerId = args.get('--offer-id') || 'offer-earnx';
const milestoneStep = Number(args.get('--milestone-step') || 1);
const payoutDollars = Number(args.get('--payout') || 5);
const postbackSecret = process.env.POSTBACK_SECRET?.trim();
const milestoneSecret = process.env.MILESTONE_CALLBACK_SECRET?.trim();
let cookies = '';

function record(name, status, details) {
  console.log(JSON.stringify({ name, status, details }));
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookies) headers.set('cookie', cookies);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    cookies = setCookie.split(';', 1)[0];
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function main() {
  if (dryRun) {
    record('health', 'planned', { baseUrl });
    record('registration', 'planned', { initialBalance: '0.00' });
    record('postback', 'planned', { offerId, milestoneStep, payoutDollars });
    record('concurrent-rps', 'planned', { requests: 4 });
    record('cash-out', 'planned', { minimum: 5, channel: 'paypal' });
    console.log(JSON.stringify({ status: 'dry_run_complete', steps: 5 }));
    return;
  }

  const health = await request('/api/health');
  assert.equal(health.response.status, 200, 'The platform health endpoint must respond.');
  record('health', 'passed', { database: health.body.database });

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const profile = {
    email: `e2e-${unique}@example.com`,
    username: `e2e_${unique.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
    password: 'E2E!secure-password-2026',
  };
  const signup = await request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...profile,
      deviceFingerprint: 'b'.repeat(64),
    }),
  });
  assert.ok(signup.response.status === 201 || signup.response.status === 503, `Signup returned unexpected ${signup.response.status}.`);
  if (signup.response.status !== 201) {
    record('registration', 'skipped', { reason: signup.body?.error || 'Database unavailable' });
    throw new Error('PostgreSQL-backed E2E registration is required.');
  }
  const me = await request('/api/auth/me');
  assert.equal(me.response.status, 200);
  assert.ok(me.body.user?.id);
  record('registration', 'passed', { userId: me.body.user.id, initialBalance: '0.00' });

  if (!postbackSecret) throw new Error('POSTBACK_SECRET is required for the postback phase.');
  const payoutCents = Math.round(payoutDollars * 100);
  assert.equal(payoutCents / 100, payoutDollars);
  const clickId = `e2e-click-${Date.now()}`;
  const payload = `${clickId}.${me.body.user.id}.${offerId}.${milestoneStep}.${payoutCents}`;
  const signature = createHmac('sha256', postbackSecret).update(payload).digest('hex');
  const postback = await request('/api/v1/callbacks/postback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      click_id: clickId,
      user_id: me.body.user.id,
      offer_id: offerId,
      milestone_step: String(milestoneStep),
      payout: payoutDollars.toFixed(2),
      signature,
    }).toString(),
  });
  assert.equal(postback.response.status, 200, `Postback failed: ${JSON.stringify(postback.body)}`);
  record('postback', 'passed', { offerId, payoutDollars });

  const rpsRequests = await Promise.all(
    Array.from({ length: 4 }, (_, index) => request('/api/games/rps/play', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `e2e-rps-${Date.now()}-${index}`,
      },
      body: JSON.stringify({ choice: ['rock', 'paper', 'scissors', 'rock'][index], entryBet: 0.5 }),
    })),
  );
  assert.equal(rpsRequests.every((item) => [200, 400].includes(item.response.status)), true);
  record('concurrent-rps', 'passed', { statuses: rpsRequests.map((item) => item.response.status) });

  const withdrawal = await request('/api/v1/withdrawals/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-cashout-${Date.now()}`,
    },
    body: JSON.stringify({
      amount: 5,
      channel: 'paypal',
      destination: profile.email,
    }),
  });
  assert.ok(withdrawal.response.status === 201 || withdrawal.response.status === 400);
  record('cash-out', withdrawal.response.status === 201 ? 'passed' : 'validated', {
    status: withdrawal.response.status,
    detail: withdrawal.body?.error || 'pending withdrawal created',
  });

  console.log(JSON.stringify({
    status: 'e2e_complete',
    userId: me.body.user.id,
    postbackSecret: Boolean(postbackSecret),
    milestoneSecret: Boolean(milestoneSecret),
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'e2e_failed', error: error.message }));
  process.exitCode = 1;
});
