import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
const { app, applyCoinsBackTerms, buildOfferActivityReport, buildOfferActivitySinceReport, getAggregatePageViewCount, getOfferActivityReport, isTemporarilyHiddenOffer, isVerificationCurrent, mergeCatalogOffer, newsletterEmailLayout, resolveOfferVerificationUpdate, resolveUpdatedOfferStatus } = await import('../dist/server.cjs');

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

test('legacy and .html SEO URLs redirect before static files can serve duplicate pages', async () => {
  const redirects = [
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
      assert.match(`${offer.honestTruth.summary} ${offer.honestTruth.theCatch}`, /report|suppl|not independently|not been independently|not been confirmed/i, `${offer.company} should identify unverified details as reported`);
    }
  }
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
  assert.match(offer.payoutSpeed, /free instant PayPal/i);
  assert.match(offer.payoutSpeed, /\$10 minimum/i);
  assert.match(offer.honestTruth.summary, /Google, ChatGPT, Facebook, Instagram, YouTube, Netflix, and others/i);
  assert.match(offer.depositRequired, /accounts or services supported by MSR/i);
  assert.match(offer.honestTruth.theCatch, /site-owner reported and may vary/i);
});

test('Joko offer clearly separates the $5 referral and $5 qualifying Plaid bank-link rewards', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-joko');
  assert.ok(offer);
  assert.match(offer.title, /\$5 signup \+ \$5 bank link/i);
  assert.match(offer.incentiveAmount, /\$5.*referral link.*\$5.*qualifying bank account/i);
  assert.match(offer.honestTruth.summary, /through Plaid for another \$5/i);
  assert.match(offer.honestTruth.summary, /account.*most of your purchases/i);
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
  assert.match(offer.incentiveAmount, /\$25–\$2,000/);
  assert.match(offer.depositRequired, /\$5/);
  assert.match(offer.honestTruth.summary, /\$25 in qualifying trading volume/);
  assert.match(offer.honestTruth.hiddenFeesWarning, /loss/);
  assert.doesNotMatch(offer.honestTruth.summary, /10% off fees/);
});

test('Verb public offer reflects reported rewards and discloses data-sharing conditions', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-verb');
  assert.ok(offer);
  assert.equal(offer.referralCode, 'G284G5GH');
  assert.match(offer.incentiveAmount, /\$3 signup bonus/);
  assert.match(offer.incentiveAmount, /\$30\/month tracker/);
  assert.match(offer.honestTruth.summary, /\$5 each for Instagram data, TikTok data, and linking email/);
  assert.match(offer.honestTruth.summary, /\$10 for each referral after that person links a bank/);
  assert.match(offer.honestTruth.hiddenFeesWarning, /purchase activity/);
  assert.match(offer.honestTruth.theCatch, /not independently confirmed/);
});

test('Revolut public offer reflects the reported requirements and conditional referrer split', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'offer-revolut');
  assert.ok(offer);
  assert.match(offer.depositRequired, /3 qualifying \$10 purchases/);
  assert.match(offer.depositRequired, /physical card/);
  assert.match(offer.incentiveAmount, /Possible \$50 share/);
  assert.match(offer.honestTruth.summary, /does not receive a Revolut bonus directly/);
  assert.match(offer.honestTruth.theCatch, /not a Revolut payment or guaranteed signup bonus/);
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
  assert.match(offer.honestTruth.theCatch, /not been independently confirmed/);
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

test('newer Verb catalog details replace stale saved terms while preserving visibility and counts', () => {
  const catalogOffer = {
    id: 'offer-verb',
    title: 'Updated Verb data rewards',
    referralUrl: 'https://verb-data.com/signup?ref=G284G5GH',
    updatedAt: '2026-10-02T16:00:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'offer-verb',
    title: 'Old Verb data rewards',
    updatedAt: '2026-09-16T22:14:44Z',
    status: 'hidden',
    clicksCount: 8,
    conversionsCount: 2,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
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
    title: 'Reported instant $10 reward for linking eligible MSR accounts',
    referralUrl: 'https://contributor.measureprotocol.com/i/7Osjyx6m',
    updatedAt: '2026-10-05T04:12:00.000Z',
    status: 'live',
    clicksCount: 0,
    conversionsCount: 0,
  };
  const savedOffer = {
    id: 'candidate-measure-protocol-msr-referral',
    title: 'Old doubled welcome bonus',
    referralUrl: 'https://contributor.measureprotocol.com/i/old',
    updatedAt: '2026-10-02T00:00:00.000Z',
    status: 'hidden',
    clicksCount: 2,
    conversionsCount: 0,
  };
  const merged = mergeCatalogOffer(catalogOffer, savedOffer);
  assert.equal(merged.title, catalogOffer.title);
  assert.equal(merged.referralUrl, catalogOffer.referralUrl);
  assert.equal(merged.status, 'live');
  assert.equal(merged.clicksCount, 2);
});

test('newer Ero referral details replace stale terms and publish the featured offer', () => {
  const catalogOffer = {
    id: 'candidate-ero-app-referral',
    title: 'Ero: 50% boost on eligible activity for 24 hours',
    referralUrl: 'https://ero.app/r/v7tfsepe5d?link=bgp4v6nfbrt6',
    updatedAt: '2026-10-04T15:25:00.000Z',
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

test('Ero cashout details are featured and distinguish the activity boost from cash', async () => {
  const response = await request('/api/offers');
  assert.equal(response.status, 200);
  const offer = response.body.offers.find((candidate) => candidate.id === 'candidate-ero-app-referral');
  assert.ok(offer);
  assert.equal(offer.status, 'live');
  assert.equal(offer.featured, true);
  assert.match(offer.payoutSpeed, /instant debit-card withdrawal/i);
  assert.doesNotMatch(offer.payoutSpeed, /fee|selfie/i);
  assert.match(offer.honestTruth.summary, /not a fixed signup payment/i);
  assert.match(offer.honestTruth.hiddenFeesWarning, /no ID required/i);
  const eroCopy = [
    offer.payoutSpeed,
    offer.honestTruth.summary,
    offer.honestTruth.theCatch,
    offer.honestTruth.minimumHoldTime,
    offer.honestTruth.hiddenFeesWarning,
    ...offer.speedrunHints.flatMap((hint) => [hint.instruction, hint.proTip]),
  ].join(' ');
  assert.doesNotMatch(eroCopy, /selfie|fee/i);
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
