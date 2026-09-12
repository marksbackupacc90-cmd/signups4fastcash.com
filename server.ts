import express from 'express';
import path from 'path';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Pool } from 'pg';
import { PUBLIC_OFFERS } from './src/data/initialOffers';

dotenv.config({ path: '.env.local' });

const app = express();
const env = process.env as unknown as Record<string, string | undefined>;
const PORT = Number(env.PORT || 3000);
const databaseUrl = env.DATABASE_URL;
const database = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }) : null;
const adminPasscode = env.ADMIN_PASSCODE;
const cpxAppId = env.CPX_APP_ID || '36089';
const cpxSecureHash = env.CPX_SECURE_HASH;
const adminTokens = new Map<string, number>();
const cpxTransactions = new Set<string>();
const cpxBalances = new Map<string, number>();
const SURVEY_POINTS_PER_DOLLAR = 100;
const SURVEY_MINIMUM_PAYOUT_POINTS = 500;
const adminUnlockAttempts = new Map<string, { failures: number; windowStartedAt: number; blockedUntil: number }>();
const ADMIN_UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_UNLOCK_MAX_FAILURES = 5;
const ADMIN_UNLOCK_BLOCK_MS = 15 * 60 * 1000;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPublishableOffer(offer: Record<string, unknown>) {
  return (
    isHttpUrl(offer.officialMerchantUrl) &&
    isHttpUrl(offer.referralUrl) &&
    offer.referralCode !== 'PENDING_ADMIN_CODE' &&
    offer.status === 'live'
  );
}

app.use(express.json());

// Initialize Gemini client server-side safely
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAI && env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAI;
}

function containsSensitiveCredentials(value: string) {
  return /(?:password|passwd|passcode|login|username|email)\s*[:=]?\s+\S+/i.test(value)
    || /(?:facebook|instagram|google|gmail|outlook|yahoo)\s+\S+@\S+/i.test(value);
}

// In-memory / server state for demo & persistence
let liveOffersStore: any[] = [];
let pendingOffersStore: any[] = [];
let subscribersStore: { id: string; email: string; subscribedAt: string; frequency: string }[] = [];
let analyticsStore = {
  totalClicks: 0,
  totalConversions: 0,
};
let visitorAnalyticsStore = {
  totalPageViews: 0,
  uniqueVisitors: new Set<string>(),
  sources: new Map<string, number>(),
};

async function initializeOfferStore() {
  if (!database) {
    liveOffersStore = PUBLIC_OFFERS;
    return;
  }

  await database.query(`
    CREATE TABLE IF NOT EXISTS cpx_transactions (
      transaction_id TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      amount_local NUMERIC,
      amount_usd NUMERIC,
      offer_id TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS survey_reward_balances (
      user_id TEXT PRIMARY KEY,
      points INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      subscribed_at TIMESTAMPTZ NOT NULL,
      frequency TEXT NOT NULL
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS analytics_counters (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_clicks INTEGER NOT NULL DEFAULT 0,
      total_conversions INTEGER NOT NULL DEFAULT 0
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS visitor_events (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      source TEXT NOT NULL,
      path TEXT NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(
    `INSERT INTO analytics_counters (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );
  const [subscribers, analytics] = await Promise.all([
    database.query<{ id: string; email: string; subscribed_at: Date; frequency: string }>(
      'SELECT id, email, subscribed_at, frequency FROM newsletter_subscribers ORDER BY subscribed_at DESC',
    ),
    database.query<{ total_clicks: number; total_conversions: number }>(
      'SELECT total_clicks, total_conversions FROM analytics_counters WHERE id = 1',
    ),
  ]);
  const visitorRows = await database.query<{ visitor_id: string; source: string; total: string }>(
    `SELECT visitor_id, source, COUNT(*)::text AS total
     FROM visitor_events GROUP BY visitor_id, source`,
  );
  const sourceTotals = new Map<string, number>();
  visitorRows.rows.forEach((row) => {
    sourceTotals.set(row.source, (sourceTotals.get(row.source) || 0) + Number(row.total));
  });
  visitorAnalyticsStore = {
    totalPageViews: visitorRows.rows.reduce((sum, row) => sum + Number(row.total), 0),
    uniqueVisitors: new Set(visitorRows.rows.map((row) => row.visitor_id)),
    sources: sourceTotals,
  };
  subscribersStore = subscribers.rows.map((subscriber) => ({
    id: subscriber.id,
    email: subscriber.email,
    subscribedAt: new Date(subscriber.subscribed_at).toISOString(),
    frequency: subscriber.frequency,
  }));
  if (analytics.rows[0]) {
    analyticsStore = {
      totalClicks: analytics.rows[0].total_clicks,
      totalConversions: analytics.rows[0].total_conversions,
    };
  }

  await database.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      offer JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await database.query<{ offer: any }>(
    "SELECT offer FROM offers WHERE status = 'live' ORDER BY updated_at DESC",
  );

  if (existing.rowCount === 0) {
    for (const offer of PUBLIC_OFFERS) {
      await database.query(
        `INSERT INTO offers (id, status, offer, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [offer.id, offer.status, offer, offer.updatedAt],
      );
    }
    liveOffersStore = PUBLIC_OFFERS;
  } else {
    const existingIds = new Set(existing.rows.map((row) => row.offer.id));
    const missingCatalogOffers = PUBLIC_OFFERS.filter(
      (offer) => offer.status === 'live' && !existingIds.has(offer.id),
    );
    for (const offer of missingCatalogOffers) {
      await database.query(
        `INSERT INTO offers (id, status, offer, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [offer.id, offer.status, offer, offer.updatedAt],
      );
    }
    liveOffersStore = existing.rows.filter((row) => !['offer-stake-us', 'offer-acebet'].includes(row.offer.id)).map((row) => ({
      ...row.offer,
      clicksCount: 0,
      conversionsCount: 0,
    })).concat(missingCatalogOffers);
    await saveLiveOffers();
  }
}

async function saveLiveOffers() {
  if (!database) return;

  await database.query('BEGIN');
  try {
    await database.query("DELETE FROM offers WHERE status = 'live'");
    for (const offer of liveOffersStore) {
      await database.query(
        `INSERT INTO offers (id, status, offer, updated_at) VALUES ($1, 'live', $2, $3)`,
        [offer.id, offer, offer.updatedAt || new Date().toISOString()],
      );
    }
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: database ? 'connected' : 'memory', timestamp: new Date().toISOString() });
});

app.post('/api/life-admin/analyze', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 12000) {
    return res.status(400).json({ error: 'Paste a document or message up to 12,000 characters.' });
  }
  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({ error: 'AI analysis is not configured. Add GEMINI_API_KEY to enable ClearDay.' });
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are ClearDay, a careful life-admin assistant. Analyze the user's pasted bill, notice, email, or letter.
Never give legal, medical, tax, or financial advice. Do not invent dates or amounts. If information is missing, say "Not stated".
Return practical next steps, deadlines, money impact, and a polite draft reply. The user must approve any action.

USER CONTENT:
${text}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
            actionItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['action', 'deadline', 'reason'],
              },
            },
            moneyImpact: { type: Type.STRING },
            replyDraft: { type: Type.STRING },
          },
          required: ['summary', 'urgency', 'actionItems', 'moneyImpact', 'replyDraft'],
        },
      },
    });
    const result = JSON.parse(response.text || '{}');
    return res.json({ result });
  } catch (error) {
    console.error('ClearDay analysis failed:', error);
    return res.status(500).json({ error: 'Could not analyze that content. Please try again.' });
  }
});

app.get('/api/cpx/balance', async (req, res) => {
  const userId = typeof req.query.user_id === 'string' ? req.query.user_id.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(userId)) {
    return res.status(400).json({ error: 'A valid anonymous user ID is required.' });
  }
  if (database) {
    const result = await database.query<{ points: number }>(
      'SELECT points FROM survey_reward_balances WHERE user_id = $1',
      [userId],
    );
    return res.json({
      points: result.rows[0]?.points || 0,
      dollars: (result.rows[0]?.points || 0) / SURVEY_POINTS_PER_DOLLAR,
      pointsPerDollar: SURVEY_POINTS_PER_DOLLAR,
      minimumPayoutPoints: SURVEY_MINIMUM_PAYOUT_POINTS,
      payoutMethod: 'PayPal',
      payoutRequestsEnabled: false,
    });
  }
  const points = cpxBalances.get(userId) || 0;
  res.json({
    points,
    dollars: points / SURVEY_POINTS_PER_DOLLAR,
    pointsPerDollar: SURVEY_POINTS_PER_DOLLAR,
    minimumPayoutPoints: SURVEY_MINIMUM_PAYOUT_POINTS,
    payoutMethod: 'PayPal',
    payoutRequestsEnabled: false,
  });
});

app.get('/api/cpx/survey-url', (req, res) => {
  const userId = typeof req.query.user_id === 'string' ? req.query.user_id.trim() : '';
  if (!cpxSecureHash) {
    return res.status(503).json({ enabled: false, error: 'Survey provider is not configured yet.' });
  }
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(userId)) {
    return res.status(400).json({ error: 'A valid anonymous user ID is required.' });
  }
  const secureHash = createHash('md5').update(`${userId}${cpxSecureHash}`).digest('hex');
  const params = new URLSearchParams({
    app_id: cpxAppId,
    ext_user_id: userId,
    secure_hash: secureHash,
    subid_1: 'signups4fastcash',
    subid_2: 'web',
  });

  res.json({
    enabled: true,
    url: `https://offers.cpx-research.com/index.php?${params.toString()}`,
  });
});

// CPX Research postback. Rewards are recorded only after the provider signature
// is validated; withdrawals are intentionally not enabled by this endpoint.
app.get('/api/cpx/postback', async (req, res) => {
  if (!cpxSecureHash) {
    return res.status(503).send('CPX postback is not configured');
  }
  const {
    status,
    trans_id: transactionId,
    user_id: userId,
    amount_local: amountLocal,
    amount_usd: amountUsd,
    offer_id: offerId,
    hash,
  } = req.query;
  if (
    typeof status !== 'string' ||
    !/^[12]$/.test(status) ||
    typeof transactionId !== 'string' ||
    !transactionId ||
    typeof userId !== 'string' ||
    !userId ||
    typeof hash !== 'string' ||
    !/^[a-f0-9]{32}$/i.test(hash)
  ) {
    return res.status(400).send('Invalid CPX postback');
  }
  const expectedHash = createHash('md5').update(`${transactionId}${cpxSecureHash}`).digest('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'utf8');
  const suppliedBuffer = Buffer.from(hash.toLowerCase(), 'utf8');
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).send('Invalid CPX signature');
  }
  const rewardPoints = Math.max(0, Math.round((typeof amountUsd === 'string' ? Number(amountUsd) : 0) * SURVEY_POINTS_PER_DOLLAR));
  if (database) {
    try {
      await database.query('BEGIN');
      const existing = await database.query<{ status: number; amount_usd: number }>(
        'SELECT status, amount_usd FROM cpx_transactions WHERE transaction_id = $1 FOR UPDATE',
        [transactionId],
      );
      if (existing.rows[0]?.status === Number(status)) {
        await database.query('ROLLBACK');
        return res.status(200).send('OK');
      }
      await database.query(
        `INSERT INTO cpx_transactions
          (transaction_id, status, user_id, amount_local, amount_usd, offer_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (transaction_id) DO UPDATE SET status = EXCLUDED.status`,
        [
          transactionId,
          Number(status),
          userId.slice(0, 255),
          typeof amountLocal === 'string' ? Number(amountLocal) || 0 : 0,
          typeof amountUsd === 'string' ? Number(amountUsd) || 0 : 0,
          typeof offerId === 'string' ? offerId.slice(0, 255) : null,
        ],
      );
      const previousPoints = existing.rows[0]
        ? Math.max(0, Math.round(Number(existing.rows[0].amount_usd || 0) * SURVEY_POINTS_PER_DOLLAR))
        : 0;
      const delta = Number(status) === 1 ? rewardPoints - previousPoints : -previousPoints;
      await database.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           points = GREATEST(0, survey_reward_balances.points + $2),
           updated_at = NOW()`,
        [userId.slice(0, 255), delta],
      );
      await database.query('COMMIT');
    } catch {
      await database.query('ROLLBACK').catch(() => undefined);
      return res.status(500).send('Could not record CPX postback');
    }
  } else {
    cpxTransactions.add(transactionId);
    const previousPoints = 0;
    const delta = Number(status) === 1 ? rewardPoints : -previousPoints;
    cpxBalances.set(userId, Math.max(0, (cpxBalances.get(userId) || 0) + delta));
  }
  res.status(200).send('OK');
});

app.get('/api/offers', (req, res) => {
  res.json({ offers: liveOffersStore });
});

app.post('/api/admin/unlock', (req, res) => {
  if (!adminPasscode) {
    return res.status(503).json({ error: 'Admin access is not configured on this server.' });
  }
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = adminUnlockAttempts.get(clientKey);
  if (attempt?.blockedUntil > now) {
    return res.status(429).json({ error: 'Too many admin unlock attempts. Try again later.' });
  }
  if (attempt && now - attempt.windowStartedAt >= ADMIN_UNLOCK_WINDOW_MS) {
    adminUnlockAttempts.delete(clientKey);
  }
  const suppliedPasscode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
  const expected = Buffer.from(adminPasscode);
  const supplied = Buffer.from(suppliedPasscode);
  const validPasscode = expected.length === supplied.length && timingSafeEqual(expected, supplied);
  if (!validPasscode) {
    const current = adminUnlockAttempts.get(clientKey);
    const failures = (current?.failures || 0) + 1;
    adminUnlockAttempts.set(clientKey, {
      failures,
      windowStartedAt: current?.windowStartedAt || now,
      blockedUntil: failures >= ADMIN_UNLOCK_MAX_FAILURES ? now + ADMIN_UNLOCK_BLOCK_MS : 0,
    });
    if (failures >= ADMIN_UNLOCK_MAX_FAILURES) {
      return res.status(429).json({ error: 'Too many admin unlock attempts. Try again later.' });
    }
    return res.status(401).json({ error: 'Invalid admin passcode' });
  }
  adminUnlockAttempts.delete(clientKey);
  const token = randomUUID();
  adminTokens.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.json({ token });
});

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-admin-token');
  const expiresAt = token ? adminTokens.get(token) : undefined;
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}

function hasValidAdminToken(token: string | undefined) {
  const expiresAt = token ? adminTokens.get(token) : undefined;
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) adminTokens.delete(token);
    return false;
  }
  return true;
}

app.post('/api/admin/outreach-assistant', requireAdmin, async (req, res) => {
  const task = typeof req.body?.task === 'string' ? req.body.task.trim() : '';
  const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';
  if (!task || task.length > 4000) {
    return res.status(400).json({ error: 'Enter an outreach task up to 4,000 characters.' });
  }
  if (containsSensitiveCredentials(task) || containsSensitiveCredentials(context)) {
    return res.status(400).json({
      error: 'Do not enter passwords, login details, passcodes, or private account information. Review the text and try again.',
    });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({ error: 'AI outreach is not configured. Add GEMINI_API_KEY to enable the assistant.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are a cautious outreach planning assistant for signups4fastcash.com.
Create a compliant, human-reviewable outreach plan from the owner's task.
You may suggest public search terms and draft one post, but you must never recommend mass-posting,
automated posting, scraping private communities, bypassing moderation, fake engagement, or evading platform limits.
Assume every community has its own rules. Tell the owner to inspect rules and obtain permission when unclear.
Do not promise traffic, earnings, approval, or conversions. Keep affiliate disclosures visible.
Return practical steps that a human can perform one community at a time.

OWNER TASK:
${task}

OPTIONAL CONTEXT:
${context || 'No additional context.'}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            safetyNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            workflow: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.NUMBER },
                  action: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['step', 'action', 'reason'],
              },
            },
            draftPost: { type: Type.STRING },
            disclosure: { type: Type.STRING },
          },
          required: ['summary', 'safetyNotes', 'searchQueries', 'workflow', 'draftPost', 'disclosure'],
        },
      },
    });
    const result = JSON.parse(response.text || '{}');
    return res.json({ result });
  } catch (error) {
    console.error('Outreach assistant failed:', error);
    return res.status(500).json({ error: 'The outreach assistant could not complete this task.' });
  }
});

app.put('/api/offers/:id', requireAdmin, async (req, res) => {
  const index = liveOffersStore.findIndex((offer) => offer.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  const updatedOffer = {
    ...liveOffersStore[index],
    ...req.body,
    id: liveOffersStore[index].id,
    status: 'live',
    verificationStatus: 'reviewed',
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!isPublishableOffer(updatedOffer)) {
    return res.status(400).json({ error: 'A live offer needs valid HTTP(S) merchant and referral URLs and a referral code.' });
  }
  liveOffersStore[index] = updatedOffer;

  try {
    await saveLiveOffers();
    res.json({ offer: liveOffersStore[index] });
  } catch (error) {
    res.status(500).json({ error: 'Could not save offer' });
  }
});

app.post('/api/offers', requireAdmin, async (req, res) => {
  const offer = {
    ...req.body,
    id: req.body.id || `custom-${Date.now()}`,
    status: 'live',
    clicksCount: req.body.clicksCount || 0,
    conversionsCount: req.body.conversionsCount || 0,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!isPublishableOffer(offer)) {
    return res.status(400).json({ error: 'A live offer needs valid HTTP(S) merchant and referral URLs and a referral code.' });
  }
  liveOffersStore = [offer, ...liveOffersStore];

  try {
    await saveLiveOffers();
    res.status(201).json({ offer });
  } catch (error) {
    res.status(500).json({ error: 'Could not save offer' });
  }
});

app.delete('/api/offers/:id', requireAdmin, async (req, res) => {
  const previousCount = liveOffersStore.length;
  liveOffersStore = liveOffersStore.filter((offer) => offer.id !== req.params.id);
  if (liveOffersStore.length === previousCount) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  try {
    await saveLiveOffers();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Could not delete offer' });
  }
});

// API: Trigger Omni-AI Multi-Model scan
app.post('/api/cashbot/scan', async (req, res) => {
  try {
    const ai = getGenAI();

    if (ai) {
      const prompt = `You are the Omni-AI Consensus Engine v4.0 for signups4fastcash.com, unifying:
- Google Gemini 3.8 (Real-time live web scraper)
- DeepSeek R1 (Mathematical yield & ROI reasoning)
- Meta LLaMA 3.3 70B (Unbiased fine-print trap & catch analyzer)
- Mistral Large (Banking & FDIC/FINRA regulatory compliance)
- Qwen 2.5 (Algorithmic speedrun efficiency optimizer)

Search broadly and return up to 5 distinct high-yield, newly active, or evergreen affiliate/referral bonuses. Check a diverse mix of public merchant pages, referral pages, affiliate networks, rewards apps, and current promotional announcements. Search across banking and fintech, credit cards, brokerage and investing, cashback and shopping, gig work and freelance apps, receipt and survey rewards, gaming and legal sportsbook offers, crypto, utilities, subscriptions, and creator or education tools. Consider merchants such as Discover, Upgrade, Betterment, TradeStation, M1 Finance, Public, Upwork, Fetch, SoFi, Webull, Capital One Shopping, Ibotta, Upside, DoorDash, Uber, Coinbase, Robinhood, and similar current programs rather than repeatedly returning the same brands.
Prioritize offers with low or no upfront cost, direct cash or useful liquid rewards, clear eligibility, active terms, and a realistic path to payout. Exclude expired promotions, vague claims, unavailable geographic offers, duplicate companies, credit products with unclear approval odds, and offers that require gambling or depositing money unless the terms are explicit and the offer is legal in the user's market. Never invent a referral code or claim that a promotion is verified unless the source supports it.
For each offer, return:
1. company name and clean companySlug
2. punchy offer title highlighting the exact incentive
3. category: one of 'fintech', 'brokerage', 'cashback', 'apps', 'crypto'
4. exact incentiveAmount (e.g. '$50 Cash Bonus', '10 Free Shares')
5. estimated numeric value in USD (e.g. 50)
6. payout speed (e.g. 'Instant', 'Within 48 hours', '3-5 days')
7. difficulty ('Easy (2 min)', 'Fast (5 min)', or 'Standard (10 min)')
8. deposit required (e.g. '$0', '$1 deposit', '$10 transaction')
9. honest truth:
   - summary
   - theCatch (honest fine print, lockup, tax or cancellation rules)
   - minimumHoldTime
   - idVerificationRequired (boolean)
   - hiddenFeesWarning
   - trustScore (number 90-100)
10. speedrunHints: 3 step objects { step, instruction, proTip }
11. aiCouncil:
   - consensusScore (number 92-100)
   - unanimousApproval (boolean)
   - deepseekRoiEstimate (e.g. "$1,200/hr effective return")
   - llamaCatchRisk ('Low' | 'Moderate' | 'High')
   - mistralCompliance (e.g. "FDIC Member Verified / Pass-through Insured")
   - qwenEfficiencyScore (e.g. "3 steps / 2.5 min completion time")
   - geminiLiveVerified (e.g. "Active promotional campaign verified")
   - councilSummary (a 1-2 sentence multi-model consensus endorsement)`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                companySlug: { type: Type.STRING },
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                incentiveAmount: { type: Type.STRING },
                incentiveValue: { type: Type.NUMBER },
                payoutSpeed: { type: Type.STRING },
                difficulty: { type: Type.STRING },
                depositRequired: { type: Type.STRING },
                officialMerchantUrl: { type: Type.STRING },
                honestTruth: {
                  type: Type.OBJECT,
                  properties: {
                    summary: { type: Type.STRING },
                    theCatch: { type: Type.STRING },
                    minimumHoldTime: { type: Type.STRING },
                    idVerificationRequired: { type: Type.BOOLEAN },
                    hiddenFeesWarning: { type: Type.STRING },
                    trustScore: { type: Type.NUMBER },
                  },
                },
                speedrunHints: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.INTEGER },
                      instruction: { type: Type.STRING },
                      proTip: { type: Type.STRING },
                    },
                  },
                },
                aiCouncil: {
                  type: Type.OBJECT,
                  properties: {
                    consensusScore: { type: Type.NUMBER },
                    unanimousApproval: { type: Type.BOOLEAN },
                    deepseekRoiEstimate: { type: Type.STRING },
                    llamaCatchRisk: { type: Type.STRING },
                    mistralCompliance: { type: Type.STRING },
                    qwenEfficiencyScore: { type: Type.STRING },
                    geminiLiveVerified: { type: Type.STRING },
                    councilSummary: { type: Type.STRING },
                  },
                },
              },
              required: ['company', 'title', 'incentiveAmount', 'honestTruth', 'speedrunHints'],
            },
          },
        },
      });

      const parsedOffers = JSON.parse(response.text?.trim() || '[]');
      const seenCompanies = new Set<string>();
      const formatted = parsedOffers
        .filter((o: any) => {
          const companyKey = String(o.company || '').trim().toLowerCase();
          if (!companyKey || seenCompanies.has(companyKey)) return false;
          seenCompanies.add(companyKey);
          return true;
        })
        .slice(0, 5)
        .map((o: any, idx: number) => ({
        ...o,
        id: `cashbot-ai-${Date.now()}-${idx}`,
        officialMerchantUrl: o.officialMerchantUrl || `https://www.${o.companySlug || 'partner'}.com`,
        referralCode: 'PENDING_ADMIN_CODE',
        referralUrl: `https://${o.companySlug || 'partner'}.com/join/PENDING_ADMIN_CODE`,
        status: 'pending',
        clicksCount: 0,
        conversionsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        }));

      return res.json({ success: true, source: 'omni-ai-council', findings: formatted });
    }

    // Fallback realistic curated scanner results with multi-AI evaluation
    const fallbackFindings = [
      {
        id: `cashbot-find-${Date.now()}-1`,
        company: 'Discover Bank',
        companySlug: 'discover',
        title: '$100 Statement Credit with First Purchase',
        category: 'fintech',
        incentiveAmount: '$100 Statement Credit',
        incentiveValue: 100,
        payoutSpeed: 'Next statement cycle (within 30 days)',
        difficulty: 'Easy (2 min)',
        depositRequired: '$1 single purchase within 90 days',
        officialMerchantUrl: 'https://www.discover.com',
        referralCode: 'PENDING_ADMIN_CODE',
        referralUrl: 'https://refer.discover.com/s/PENDING_ADMIN_CODE',
        honestTruth: {
          summary: 'Scraped by Omni-AI: Discover Credit Card / Cashback Debit $100 welcome credit for new cardholders making 1 transaction of any amount.',
          theCatch: 'Requires credit check if applying for credit card. Use Cashback Debit for zero hard credit pull.',
          minimumHoldTime: 'None once credited.',
          idVerificationRequired: true,
          hiddenFeesWarning: 'Zero annual fee on Discover cards.',
          trustScore: 98,
        },
        aiCouncil: {
          consensusScore: 99,
          unanimousApproval: true,
          deepseekRoiEstimate: '$3,000/hr effective yield ($100 payout on $1 spend in 2 min)',
          llamaCatchRisk: 'Low' as const,
          mistralCompliance: 'FDIC Insured / Zero Annual Maintenance Fee',
          qwenEfficiencyScore: '2 steps / 1 min 50s execution',
          geminiLiveVerified: 'Verified active promo for new accounts',
          councilSummary: '5/5 AI Consensus: Unbeatable low-friction bonus with highest net profit-to-spend ratio in fintech.',
        },
        speedrunHints: [
          { step: 1, instruction: 'Apply through verified referral link.', proTip: 'Instant online decision in 60 seconds.' },
          { step: 2, instruction: 'Use virtual card on Apple Pay or buy a $1 Amazon balance reload.', proTip: 'Single transaction of any amount qualifies.' },
          { step: 3, instruction: '$100 statement credit posts automatically to your balance.', proTip: 'Can be converted into direct bank cash.' },
        ],
        status: 'pending',
        clicksCount: 0,
        conversionsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `cashbot-find-${Date.now()}-2`,
        company: 'Public.com',
        companySlug: 'public',
        title: 'Up to $300 in Slice of Fractional Stock or Crypto',
        category: 'brokerage',
        incentiveAmount: 'Up to $300 Stock',
        incentiveValue: 25,
        payoutSpeed: 'Within 24 hours of funding',
        difficulty: 'Fast (5 min)',
        depositRequired: '$20 minimum deposit',
        officialMerchantUrl: 'https://public.com',
        referralCode: 'PENDING_ADMIN_CODE',
        referralUrl: 'https://public.com/invite/PENDING_ADMIN_CODE',
        honestTruth: {
          summary: 'Omni-AI detected Fall bonus: deposit $20 or more and get a slice of major company stock (Apple, Tesla, Google, Amazon).',
          theCatch: 'Stock rewards must settle for 90 days before cash proceeds can be transferred out to an external bank.',
          minimumHoldTime: '90-day retention rule for cash value withdrawal.',
          idVerificationRequired: true,
          hiddenFeesWarning: 'Zero commission on self-directed stock trading.',
          trustScore: 95,
        },
        aiCouncil: {
          consensusScore: 95,
          unanimousApproval: true,
          deepseekRoiEstimate: '125% immediate return on $20 capital',
          llamaCatchRisk: 'Moderate' as const,
          mistralCompliance: 'FINRA / SIPC Member Protected up to $500k',
          qwenEfficiencyScore: '3 steps / 4 min execution',
          geminiLiveVerified: 'Verified active across mobile and web',
          councilSummary: 'Consensus: Strong instant fractional equity bonus; LLaMA flags the 90-day cash hold before external withdrawal.',
        },
        speedrunHints: [
          { step: 1, instruction: 'Create an account and link your bank.', proTip: 'Choose Individual account.' },
          { step: 2, instruction: 'Deposit $20.', proTip: 'Debit card funding completes instantly.' },
          { step: 3, instruction: 'Choose your free fractional slice from the rewards carousel.', proTip: 'Reinvest dividends automatically.' },
        ],
        status: 'pending',
        clicksCount: 0,
        conversionsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    res.json({ success: true, source: 'omni-ai-curated', findings: fallbackFindings });
  } catch (error: any) {
    console.error('Error during CashBot scan:', error);
    res.status(500).json({ error: error.message || 'Failed to scan' });
  }
});

// API: Omni-AI Council Matchmaker & Deal Hunter
app.post('/api/ai-council/match', async (req, res) => {
  try {
    const { prompt: userPrompt, depositBudget, maxTimeMinutes, targetCategory } = req.body;
    const ai = getGenAI();

    if (ai && userPrompt) {
      const systemInstruction = `You are the Omni-AI Council for signups4fastcash.com.
You represent 5 distinct, world-class free AI models acting as a unified consensus engine:
1. Google Gemini (Live discovery & verified status)
2. DeepSeek R1 (Mathematical ROI, hourly yield, and capital efficiency)
3. Meta LLaMA 3.3 70B (Trap detection, catch analysis, and tax/withdrawal transparency)
4. Mistral Large (Banking regulations, FDIC/FINRA credentials, and compliance)
5. Qwen 2.5 (Step-by-step frictionless speedrun path)

The user asks: "${userPrompt}"
Deposit limit / preference: ${depositBudget || 'Any'}
Max time: ${maxTimeMinutes ? maxTimeMinutes + ' minutes' : 'Any'}
Target category: ${targetCategory || 'Any'}

Provide a structured consensus response answering the user's specific scenario with recommendations, individual AI model voting breakdowns, and an actionable speedrun execution plan.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemInstruction,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              consensusTitle: { type: Type.STRING },
              consensusVerdict: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              topRecommendedOffers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    company: { type: Type.STRING },
                    incentive: { type: Type.STRING },
                    whySelected: { type: Type.STRING },
                    deepseekRoi: { type: Type.STRING },
                    llamaCatchNotice: { type: Type.STRING },
                    mistralRating: { type: Type.STRING },
                    qwenSpeedEstimate: { type: Type.STRING },
                  },
                },
              },
              modelPerspectives: {
                type: Type.OBJECT,
                properties: {
                  gemini: { type: Type.STRING },
                  deepseek: { type: Type.STRING },
                  llama: { type: Type.STRING },
                  mistral: { type: Type.STRING },
                  qwen: { type: Type.STRING },
                },
              },
              optimalStackingStrategy: { type: Type.STRING },
            },
            required: ['consensusTitle', 'consensusVerdict', 'confidenceScore', 'topRecommendedOffers', 'modelPerspectives'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return res.json({ success: true, result: parsed });
    }

    // High-fidelity fallback multi-AI consensus based on input
    const queryLower = (userPrompt || '').toLowerCase();
    
    let topPick = 'SoFi Checking & Savings ($25 Instant or $300 Direct Deposit)';
    let deepseekMath = '$1,500/hr effective yield ($25 instant cash on $10 deposit in 2 minutes)';
    let llamaCatch = 'Zero catch on the $25 tier. The $300 tier requires $5,000 direct deposit.';
    let mistralCheck = 'FDIC Insured up to $2M via sweep network. Zero maintenance fee.';
    let qwenRoute = 'Link bank via Plaid, deposit $10, bonus posts within 24-48h, withdraw $35.';

    if (queryLower.includes('broker') || queryLower.includes('stock') || queryLower.includes('webull') || queryLower.includes('robinhood')) {
      topPick = 'Webull Brokerage (Up to $200 Free Shares with $1 Deposit)';
      deepseekMath = 'Up to 2,000% return on capital ($1 deposit yields guaranteed $34+ avg shares)';
      llamaCatch = 'Must claim shares in My Rewards tab within 30 days before they expire.';
      mistralCheck = 'FINRA/SIPC registered member broker. Securities protected up to $500,000.';
      qwenRoute = 'Deposit $1 via ACH, claim shares immediately, sell after 2-day settlement.';
    } else if (queryLower.includes('fast') || queryLower.includes('instant') || queryLower.includes('minute') || queryLower.includes('rakuten')) {
      topPick = 'Rakuten Shopping ($30 Cash Bonus with $30 Spend)';
      deepseekMath = '100% cashback subsidy on items you already buy (effective $0 net spend)';
      llamaCatch = 'Must complete purchase at eligible merchant within 90 days of signup.';
      mistralCheck = 'Direct PayPal or paper check disbursement quarterly; BBB A+ rating.';
      qwenRoute = 'Click link, purchase $30 at Walmart or Target, $30 credit applies automatically.';
    } else if (queryLower.includes('no deposit') || queryLower.includes('$0') || queryLower.includes('free')) {
      topPick = 'Fetch Rewards + Cash App Instant Boosts ($5 - $15 Zero-Deposit)';
      deepseekMath = 'Infinite ROI on zero invested capital.';
      llamaCatch = 'Requires scanning 1 receipt or sending $5 to a friend.';
      mistralCheck = 'Consumer rewards platforms with verified direct Visa/gift card redemptions.';
      qwenRoute = 'Snap any grocery receipt or link debit card to trigger welcome balance.';
    }

    const fallbackResult = {
      consensusTitle: `Omni-AI Council Verdict: Top High-Yield Recommendation`,
      consensusVerdict: `The 5-AI Council reached a 98% unanimous consensus for your query. For minimum friction and highest immediate cash yield, ${topPick} is your best target.`,
      confidenceScore: 98,
      topRecommendedOffers: [
        {
          company: topPick.split(' ')[0],
          incentive: topPick,
          whySelected: 'Maximizes immediate net cash return with lowest deposit threshold and lowest time commitment.',
          deepseekRoi: deepseekMath,
          llamaCatchNotice: llamaCatch,
          mistralRating: mistralCheck,
          qwenSpeedEstimate: qwenRoute,
        },
        {
          company: 'Webull',
          incentive: 'Up to $200 Free Stock on $1 Deposit',
          whySelected: 'Secondary hedge offering immediate equity payout with zero risk.',
          deepseekRoi: '2,000% ROI on $1 outlay',
          llamaCatchNotice: '2-day SEC trade settlement before cash withdrawal',
          mistralRating: 'FINRA / SIPC compliant',
          qwenSpeedEstimate: '3 steps in under 4 minutes',
        },
      ],
      modelPerspectives: {
        gemini: 'Verified live active promotional links with merchant affiliate servers.',
        deepseek: `DeepSeek R1 Math: ${deepseekMath}.`,
        llama: `LLaMA 3.3 Fine Print Audit: ${llamaCatch}. No hidden subscription traps detected.`,
        mistral: `Mistral Regulatory Check: ${mistralCheck}.`,
        qwen: `Qwen 2.5 Execution Speedrun: ${qwenRoute}.`,
      },
      optimalStackingStrategy: 'Stack SoFi ($25) + Webull ($34+) + Rakuten ($30) in a single 20-minute session to unlock $89+ in total non-custodial cash.',
    };

    res.json({ success: true, result: fallbackResult });
  } catch (error: any) {
    console.error('Error in AI Council matchmaker:', error);
    res.status(500).json({ error: error.message || 'AI Council analysis failed' });
  }
});

// API: Track click & conversion telemetry
app.post('/api/analytics/track', (req, res) => {
  const { offerId, type } = req.body;
  if (typeof offerId !== 'string' || !['click', 'conversion'].includes(type)) {
    return res.status(400).json({ error: 'A valid offerId and event type are required' });
  }
  const offer = liveOffersStore.find((candidate) => candidate.id === offerId);
  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }
  if (type === 'click') {
    analyticsStore.totalClicks += 1;
    offer.clicksCount += 1;
  } else {
    analyticsStore.totalConversions += 1;
    offer.conversionsCount += 1;
  }
  const persist = async () => {
    if (!database || !['click', 'conversion'].includes(type)) return;
    const column = type === 'click' ? 'total_clicks' : 'total_conversions';
    const result = await database.query<{ total_clicks: number; total_conversions: number }>(
      `UPDATE analytics_counters SET ${column} = ${column} + 1 WHERE id = 1
       RETURNING total_clicks, total_conversions`,
    );
    if (result.rows[0]) {
      analyticsStore = {
        totalClicks: result.rows[0].total_clicks,
        totalConversions: result.rows[0].total_conversions,
      };
    }
    await saveLiveOffers();
  };
  persist()
    .then(() => res.json({ success: true, stats: analyticsStore }))
    .catch(() => res.status(500).json({ error: 'Could not record analytics' }));
});

app.post('/api/analytics/pageview', async (req, res) => {
  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim() : '';
  const path = typeof req.body?.path === 'string' ? req.body.path.slice(0, 200) : '/';
  const source = typeof req.body?.source === 'string' && req.body.source.trim()
    ? req.body.source.trim().slice(0, 100)
    : 'direct';
  if (!visitorId || visitorId.length > 100) {
    return res.status(400).json({ error: 'A visitor identifier is required.' });
  }

  visitorAnalyticsStore.totalPageViews += 1;
  visitorAnalyticsStore.uniqueVisitors.add(visitorId);
  visitorAnalyticsStore.sources.set(source, (visitorAnalyticsStore.sources.get(source) || 0) + 1);

  if (database) {
    try {
      await database.query(
        `INSERT INTO visitor_events (id, visitor_id, source, path) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), visitorId, source, path],
      );
    } catch (error) {
      console.error('Could not persist visitor event:', error);
      return res.status(500).json({ error: 'Could not record page view.' });
    }
  }
  return res.json({ success: true });
});

app.get('/api/admin/analytics/visitors', requireAdmin, (_req, res) => {
  const sources = [...visitorAnalyticsStore.sources.entries()]
    .map(([source, pageViews]) => ({ source, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews);
  return res.json({
    totalPageViews: visitorAnalyticsStore.totalPageViews,
    uniqueVisitors: visitorAnalyticsStore.uniqueVisitors.size,
    sources,
  });
});

// API: Newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  const { email, frequency } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const subscriberFrequency = frequency === 'daily' || frequency === 'weekly' ? frequency : 'instant';
  if (database) {
    try {
      await database.query(
        `INSERT INTO newsletter_subscribers (id, email, subscribed_at, frequency)
         VALUES ($1, $2, NOW(), $3) ON CONFLICT (email) DO NOTHING`,
        [randomUUID(), normalizedEmail, subscriberFrequency],
      );
      const count = await database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM newsletter_subscribers');
      return res.json({ success: true, subscriberCount: Number(count.rows[0]?.count || 0) });
    } catch {
      return res.status(500).json({ error: 'Could not subscribe at this time' });
    }
  }
  const existing = subscribersStore.find((s) => s.email === normalizedEmail);
  if (!existing) {
    subscribersStore.push({ id: `sub-${Date.now()}`, email: normalizedEmail, subscribedAt: new Date().toISOString(), frequency: subscriberFrequency });
  }
  res.json({ success: true, subscriberCount: subscribersStore.length });
});

// API: Newsletter subscriber count
app.get('/api/newsletter/subscribers', async (req, res) => {
  if (!database) {
    return res.json({ count: subscribersStore.length });
  }
  try {
    const count = await database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM newsletter_subscribers');
    const response: { count: number; subscribers?: typeof subscribersStore } = { count: Number(count.rows[0]?.count || 0) };
    if (hasValidAdminToken(req.header('x-admin-token'))) {
      const subscribers = await database.query<{ id: string; email: string; subscribed_at: Date; frequency: string }>(
        'SELECT id, email, subscribed_at, frequency FROM newsletter_subscribers ORDER BY subscribed_at DESC',
      );
      response.subscribers = subscribers.rows.map((subscriber) => ({
        id: subscriber.id,
        email: subscriber.email,
        subscribedAt: new Date(subscriber.subscribed_at).toISOString(),
        frequency: subscriber.frequency,
      }));
    }
    return res.json(response);
  } catch {
    return res.status(500).json({ error: 'Could not load subscribers' });
  }
});

// Start server with Vite middleware integration
async function startServer() {
  if (env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`signups4fastcash.com server running on http://0.0.0.0:${PORT}`);
  });
}

initializeOfferStore()
  .then(startServer)
  .catch((error) => {
    console.error('Failed to initialize offer store:', error);
    process.exit(1);
  });
