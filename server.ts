import express from 'express';
import path from 'path';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Pool } from 'pg';
import { PUBLIC_OFFERS } from './src/data/initialOffers';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from './src/types';

dotenv.config({ path: '.env.local' });

const app = express();
const env = process.env as unknown as Record<string, string | undefined>;
const PORT = Number(env.PORT || 3000);
const databaseUrl = env.DATABASE_URL;
const database = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }) : null;
const cpxAppId = env.CPX_APP_ID || '36089';
const cpxSecureHash = env.CPX_SECURE_HASH;
const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;
const ownerEmails = new Set(
  [env.OWNER_EMAIL || 'winters.mark1990@gmail.com', env.OWNER_EMAIL_ALIASES || '', 'gamingbiz777@gmail.com']
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function getRequestAppUrl(req: express.Request) {
  const configuredAppUrl = env.APP_URL?.trim().replace(/\/$/, '');
  if (configuredAppUrl) return configuredAppUrl;
  return getRequestOrigin(req);
}

function getRequestOrigin(req: express.Request) {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol || 'http';
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || (req.headers.host || `localhost:${PORT}`);
  return `${forwardedProto}://${forwardedHost}`;
}

function getOAuthAppUrl(req: express.Request) {
  const configuredAppUrl = env.APP_URL?.trim().replace(/\/$/, '');
  return configuredAppUrl || getRequestOrigin(req);
}

async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error('Email provider is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
}

function newsletterEmailLayout(content: string, footer = '') {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#06131a;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;background:linear-gradient(135deg,#06131a 0%,#0d1724 55%,#102a35 100%);">
      <div style="max-width:600px;margin:0 auto;background:#0d1724;border:1px solid rgba(45,212,238,.24);border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.28);">
        <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,.08);">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#67e8f9;font-weight:700;">Signups4FastCash.com</div>
          <div style="margin-top:8px;font-size:13px;color:#94a3b8;">Rewards and cashback with clear terms</div>
        </div>
        <div style="padding:30px 28px;">${content}</div>
        <div style="padding:18px 28px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;line-height:1.6;color:#64748b;">
          ${footer || 'Independent offer comparisons. Merchant terms and availability can change.'}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function emailButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#67e8f9;color:#06131a;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:8px;">${label}</a>`;
}

function getApproximateLocation(req: express.Request) {
  const header = (name: string) => {
    const value = req.header(name)?.split(',')[0]?.trim();
    return value && value.length <= 100 ? value : '';
  };
  return {
    country: header('cf-ipcountry') || header('x-vercel-ip-country') || header('x-country') || 'Unknown',
    region: header('x-vercel-ip-country-region') || header('x-region') || 'Unknown',
  };
}
const adminTokens = new Map<string, { expiresAt: number; role: 'owner' | 'delegated' }>();
const adminUnlockAttempts = new Map<string, { count: number; resetAt: number }>();
const authSessions = new Map<string, { userId: string; expiresAt: number }>();
const authUsers = new Map<string, { id: string; googleSub: string; email: string; username: string | null; avatarUrl: string | null; paypalEmail: string | null; dateOfBirth: string | null; sex: string | null; state: string | null; accountStatus: 'active' | 'blocked'; lastLoginAt: string | null }>();
const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const cpxTransactions = new Set<string>();
const cpxBalances = new Map<string, number>();
const completionReports = new Map<string, { id: string; offerId: string; reportedAt: string }>();
const SURVEY_POINTS_PER_DOLLAR = 100;
const SURVEY_MINIMUM_PAYOUT_POINTS = 500;
const SURVEY_PAYOUT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const delegatedAdminUsernames = new Set<string>();
const temporarilyHiddenOfferIds = new Set(['offer-acebet']);
const temporarilyHiddenOfferTerms = ['triumph', 'polymarket'];

function isTemporarilyHiddenOffer(offer: { id?: string; company?: string; title?: string }) {
  const searchable = `${offer.company || ''} ${offer.title || ''}`.toLowerCase();
  return temporarilyHiddenOfferIds.has(offer.id || '') || temporarilyHiddenOfferTerms.some((term) => searchable.includes(term));
}

function applyCoinsBackTerms<T extends Record<string, any>>(offer: T): T {
  if (!`${offer.company || ''} ${offer.title || ''}`.toLowerCase().includes('coinsback')) return offer;
  return {
    ...offer,
    title: 'CoinsBack Casino: Free $2 Welcome Coin Pack + 50% CoinsBack',
    incentiveAmount: 'Free $2 welcome coin pack + 50% CoinsBack on every spin',
    incentiveValue: 2,
    payoutSpeed: 'CoinsBack timing depends on the current program terms',
    depositRequired: '$0 (no purchase necessary)',
    availability: 'Verify current country and state eligibility',
    verificationStatus: 'reviewed',
    verifiedAt: new Date().toISOString(),
    honestTruth: {
      summary: 'CoinsBack Casino advertises a free $2 welcome coin pack after account verification and 50% CoinsBack on every spin.',
      theCatch: 'The welcome coin pack requires account verification. Review the current CoinsBack terms for eligibility, gameplay, and redemption rules.',
      minimumHoldTime: 'No purchase is required for the advertised welcome coin pack; redemption timing depends on the current terms.',
      idVerificationRequired: true,
      hiddenFeesWarning: 'Confirm the current eligibility and redemption terms before playing or relying on any reward.',
      trustScore: 95,
    },
    speedrunHints: [
      { step: 1, instruction: 'Open the CoinsBack Casino referral link and create an account.', proTip: 'Use accurate information so verification can be completed.' },
      { step: 2, instruction: 'Verify your account to receive the free $2 welcome coin pack.', proTip: 'The welcome pack is advertised as requiring verification, not a purchase.' },
      { step: 3, instruction: 'Review the account for 50% CoinsBack on every spin and the current redemption terms.', proTip: 'Program terms and eligibility can change.' },
    ],
    updatedAt: new Date().toISOString(),
  };
}

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
  const verificationExpiresAt = typeof offer.verificationExpiresAt === 'string'
    ? Date.parse(offer.verificationExpiresAt)
    : NaN;
  return (
    isHttpUrl(offer.officialMerchantUrl) &&
    isHttpUrl(offer.referralUrl) &&
    offer.referralCode !== 'PENDING_ADMIN_CODE' &&
    offer.status === 'live' &&
    (!Number.isFinite(verificationExpiresAt) || verificationExpiresAt > Date.now())
  );
}

function isVerificationCurrent(offer: { verificationExpiresAt?: string }) {
  return !offer.verificationExpiresAt || Date.parse(offer.verificationExpiresAt) > Date.now();
}

app.use(express.json());
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  } else if (/\.[a-f0-9]{8,}\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// API: XML Sitemap for search engines (must be before static middleware)
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getOAuthAppUrl(req);
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: baseUrl, changefreq: 'daily', priority: '1.0' },
  ];
  const seen = new Set(urls.map((url) => url.loc));
  Object.keys(seoPageRoutes).forEach((route) => {
    const loc = `${baseUrl}${route}`;
    if (!seen.has(loc)) {
      urls.push({ loc, changefreq: 'weekly', priority: '0.8' });
      seen.add(loc);
    }
  });
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.type('application/xml').send(sitemap);
});

app.use(express.static(path.join(process.cwd(), 'public')));

const seoPageRoutes: Record<string, string> = {
  '/cashback-offers': 'cashback-offers.html',
  '/signup-bonus-sites': 'signup-bonus-sites.html',
  '/free-stock-bonuses': 'free-stock-bonuses.html',
  '/banking-signup-offers': 'banking-signup-offers.html',
  '/crypto-signup-bonuses': 'crypto-signup-bonuses.html',
  '/best-no-deposit-bonuses-this-month': 'best-no-deposit-bonuses-this-month.html',
  '/how-to-compare-referral-bonuses-safely': 'how-to-compare-referral-bonuses-safely.html',
  '/best-cashback-apps': 'best-cashback-apps.html',
  '/best-fintech-bonuses': 'best-fintech-bonuses.html',
  '/best-rewards-apps': 'best-rewards-apps.html',
  '/best-free-stock-offers-for-beginners': 'best-free-stock-offers-for-beginners.html',
  '/best-fintech-bonuses-without-deposit': 'best-fintech-bonuses-without-deposit.html',
  '/cashback-apps-that-pay-paypal': 'cashback-apps-that-pay-paypal.html',
};

const legacySeoRedirects: Record<string, string> = {
  '/best-cashback-offers.html': '/cashback-offers',
  '/best-referral-bonuses.html': '/signup-bonus-sites',
  '/best-free-stock-bonuses.html': '/free-stock-bonuses',
  '/banking-fintech-signup-bonuses.html': '/banking-signup-offers',
  '/crypto-signup-bonuses.html': '/crypto-signup-bonuses',
  '/best-no-deposit-signup-bonuses.html': '/best-no-deposit-bonuses-this-month',
  '/best-cashback-apps.html': '/best-cashback-apps',
  '/how-to-compare-referral-bonuses-safely.html': '/how-to-compare-referral-bonuses-safely',
};

Object.entries(seoPageRoutes).forEach(([route, fileName]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', fileName));
  });
  app.get(`${route}.html`, (_req, res) => {
    res.redirect(301, route);
  });
});

Object.entries(legacySeoRedirects).forEach(([route, target]) => {
  app.get(route, (_req, res) => {
    res.redirect(301, target);
  });
});

function getSessionToken(req: express.Request) {
  const cookie = req.headers.cookie?.split(';').find((part) => part.trim().startsWith('sfc_session='));
  return cookie?.split('=')[1] || null;
}

async function getAuthenticatedUser(req: express.Request) {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = authSessions.get(token);
  if (session && session.expiresAt > Date.now()) {
    const memoryUser = authUsers.get(session.userId);
    return memoryUser?.accountStatus === 'blocked' ? null : memoryUser || null;
  }
  if (session) authSessions.delete(token);
  if (!database) return null;
  const result = await database.query<{ id: string; google_sub: string; email: string; username: string | null; avatar_url: string | null; paypal_email: string | null; date_of_birth: string | null; sex: string | null; state: string | null; account_status: 'active' | 'blocked' }>(
    `SELECT users.id, users.google_sub, users.email, users.username, users.avatar_url, users.paypal_email, users.date_of_birth, users.sex, users.state, users.account_status
     FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token = $1 AND auth_sessions.expires_at > NOW()`,
    [token],
  );
  if (result.rows[0]?.account_status === 'blocked') return null;
  return result.rows[0]
    ? { id: result.rows[0].id, googleSub: result.rows[0].google_sub, email: result.rows[0].email, username: result.rows[0].username, avatarUrl: result.rows[0].avatar_url, paypalEmail: result.rows[0].paypal_email, dateOfBirth: result.rows[0].date_of_birth, sex: result.rows[0].sex, state: result.rows[0].state }
    : null;
}

function authUserResponse(user: { id: string; email: string; username: string | null; avatarUrl?: string | null; paypalEmail?: string | null; dateOfBirth?: string | null; sex?: string | null; state?: string | null } | null) {
  return user ? { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl || null, paypalEmail: user.paypalEmail || null, dateOfBirth: user.dateOfBirth || null, sex: user.sex || null, state: user.state || null } : null;
}

app.get('/api/auth/me', async (req, res) => {
  res.json({ user: authUserResponse(await getAuthenticatedUser(req)) });
});

app.get('/api/auth/google', (req, res) => {
  if (!googleClientId || !googleClientSecret) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
  }
  const redirectUri = `${getOAuthAppUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const requestAppUrl = getOAuthAppUrl(req);
  if (!googleClientId || !googleClientSecret || !code) {
    return res.status(400).send('Google sign-in could not be completed.');
  }
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: `${requestAppUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) return res.status(401).send('Google sign-in was rejected.');
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return res.status(401).send('Google did not return an identity token.');
    const identityResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
    if (!identityResponse.ok) return res.status(401).send('Google identity verification failed.');
    const identity = await identityResponse.json() as { sub?: string; email?: string; email_verified?: string; aud?: string; iss?: string };
    if (
      !identity.sub || !identity.email || identity.email_verified !== 'true' ||
      identity.aud !== googleClientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss || '')
    ) {
      return res.status(401).send('Google identity verification failed.');
    }

    const userId = randomUUID();
    let user = database
      ? (await database.query<{ id: string; google_sub: string; email: string; username: string | null; avatar_url: string | null; paypal_email: string | null; date_of_birth: string | null; sex: string | null; state: string | null; account_status: 'active' | 'blocked' }>(
        `INSERT INTO users (id, google_sub, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
         RETURNING id, google_sub, email, username, avatar_url, paypal_email, date_of_birth, sex, state, account_status`,
        [userId, identity.sub, identity.email],
      )).rows[0]
      : undefined;
    if (database && !user) return res.status(500).send('Could not create your account.');
    if (user?.account_status === 'blocked') return res.status(403).send('This account has been blocked. Please contact support.');
    const memoryUser = user
      ? { id: user.id, googleSub: user.google_sub, email: user.email, username: user.username, avatarUrl: user.avatar_url, paypalEmail: user.paypal_email, dateOfBirth: user.date_of_birth, sex: user.sex, state: user.state, accountStatus: user.account_status, lastLoginAt: new Date().toISOString() }
      : [...authUsers.values()].find((entry) => entry.googleSub === identity.sub) || { id: userId, googleSub: identity.sub, email: identity.email, username: null, avatarUrl: null, paypalEmail: null, dateOfBirth: null, sex: null, state: null, accountStatus: 'active' as const, lastLoginAt: new Date().toISOString() };
    authUsers.set(memoryUser.id, memoryUser);
    if (database) {
      await database.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [memoryUser.id]);
      await syncOwnerFriendListForUser(memoryUser.id);
    }
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000;
    authSessions.set(sessionToken, { userId: memoryUser.id, expiresAt });
    if (database) {
      await database.query(
        `INSERT INTO auth_sessions (token, user_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [sessionToken, memoryUser.id],
      );
    }
    res.setHeader('Set-Cookie', `sfc_session=${sessionToken}; Max-Age=${AUTH_SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.type('html').send(`<!doctype html><title>Sign-in complete</title><script>if(window.opener){window.opener.location.replace(${JSON.stringify(requestAppUrl)});window.opener.postMessage({type:'sfc-auth-complete'}, '*');}window.close();</script><p>Sign-in complete. You can close this window.</p>`);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    res.status(500).send('Google sign-in could not be completed.');
  }
});

app.post('/api/auth/username', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!user) return res.status(401).json({ error: 'Sign in with Google first.' });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, or underscores.' });
  }
  try {
    if (database) {
      const taken = await database.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
        [username, user.id],
      );
      if (taken.rowCount) return res.status(409).json({ error: 'Username taken. Please pick another.' });
      const result = await database.query(
        'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, avatar_url, paypal_email, date_of_birth, sex, state',
        [username, user.id],
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Account not found.' });
      return res.json({ user: result.rows[0] ? { id: result.rows[0].id, email: result.rows[0].email, username: result.rows[0].username, avatarUrl: result.rows[0].avatar_url, paypalEmail: result.rows[0].paypal_email, dateOfBirth: result.rows[0].date_of_birth, sex: result.rows[0].sex, state: result.rows[0].state } : null });
    }
    const duplicate = [...authUsers.values()].some((entry) => entry.username?.toLowerCase() === username.toLowerCase() && entry.id !== user.id);
    if (duplicate) return res.status(409).json({ error: 'That username is already taken.' });
    const memoryUser = authUsers.get(user.id);
    if (!memoryUser) return res.status(404).json({ error: 'Account not found.' });
    memoryUser.username = username;
    res.json({ user: authUserResponse(memoryUser) });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    throw error;
  }
});

app.put('/api/auth/profile', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google first.' });
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const paypalEmail = typeof req.body?.paypalEmail === 'string' ? req.body.paypalEmail.trim().toLowerCase() : '';
  const dateOfBirth = typeof req.body?.dateOfBirth === 'string' ? req.body.dateOfBirth : '';
  const sex = typeof req.body?.sex === 'string' ? req.body.sex : '';
  const state = typeof req.body?.state === 'string' ? req.body.state.trim().toUpperCase() : '';
  const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : '';
  if (avatarUrl && !/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(avatarUrl)) return res.status(400).json({ error: 'Profile picture must be a PNG, JPG, or WEBP image.' });
  if (avatarUrl.length > 180000) return res.status(400).json({ error: 'Profile picture is too large. Please choose a smaller image.' });
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, or underscores.' });
  if (paypalEmail && !SURVEY_PAYOUT_EMAIL_PATTERN.test(paypalEmail)) return res.status(400).json({ error: 'Enter a valid PayPal email address.' });
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return res.status(400).json({ error: 'Enter a valid date of birth.' });
  if (dateOfBirth && new Date(`${dateOfBirth}T00:00:00Z`) > new Date()) return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
  if (sex && !['female', 'male', 'nonbinary', 'prefer_not_to_say'].includes(sex)) return res.status(400).json({ error: 'Choose a valid sex option.' });
  if (state && !/^[A-Z]{2}$/.test(state)) return res.status(400).json({ error: 'Choose a valid US state.' });
  try {
    if (database) {
      const taken = await database.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
        [username, user.id],
      );
      if (taken.rowCount) return res.status(409).json({ error: 'Username taken. Please pick another.' });
      const result = await database.query(
        `UPDATE users SET username = $1, avatar_url = NULLIF($2, ''), paypal_email = NULLIF($3, ''), date_of_birth = NULLIF($4, '')::date,
         sex = NULLIF($5, ''), state = NULLIF($6, ''), updated_at = NOW()
         WHERE id = $7 RETURNING id, email, username, avatar_url, paypal_email, date_of_birth, sex, state`,
        [username, avatarUrl, paypalEmail, dateOfBirth, sex, state, user.id],
      );
      return res.json({ user: result.rows[0] ? { id: result.rows[0].id, email: result.rows[0].email, username: result.rows[0].username, avatarUrl: result.rows[0].avatar_url, paypalEmail: result.rows[0].paypal_email, dateOfBirth: result.rows[0].date_of_birth, sex: result.rows[0].sex, state: result.rows[0].state } : null });
    }
    const memoryUser = authUsers.get(user.id);
    if (!memoryUser) return res.status(404).json({ error: 'Account not found.' });
    memoryUser.username = username;
    memoryUser.paypalEmail = paypalEmail || null;
    memoryUser.dateOfBirth = dateOfBirth || null;
    memoryUser.sex = sex || null;
    memoryUser.state = state || null;
    return res.json({ user: authUserResponse(memoryUser) });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    throw error;
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    authSessions.delete(token);
    if (database) await database.query('DELETE FROM auth_sessions WHERE token = $1', [token]);
  }
  res.setHeader('Set-Cookie', 'sfc_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
  res.json({ ok: true });
});

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

function extractPublicUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"')]+/i);
  if (!match || !isHttpUrl(match[0])) return null;
  const url = new URL(match[0]);
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.hostname.endsWith('.local')) return null;
  return url.toString();
}

// In-memory / server state for demo & persistence
let liveOffersStore: any[] = PUBLIC_OFFERS.filter((offer) => !isTemporarilyHiddenOffer(offer));
let pendingOffersStore: any[] = [];
let subscribersStore: { id: string; email: string; subscribedAt: string; frequency: string; verified: boolean; unsubscribedAt?: string | null }[] = [];
const issueReportsStore: { id: string; offerId: string; issue: string; description: string; status: string; reportedAt: string }[] = [];
const userOfferEntriesStore = new Map<string, { offerId: string; status: 'active' | 'completed' | 'issue'; updatedAt: string }[]>();
let analyticsStore = {
  totalClicks: 0,
  totalConversions: 0,
};
type OfferImpression = {
  offerId: string;
  position: number;
  visitorId?: string;
  recordedAt: string;
};
const offerImpressionsStore: OfferImpression[] = [];
let analyticsReportCheckpoint: {
  checkedAt: string;
  totalClicks: number;
  totalConversions: number;
  totalPageViews: number;
  uniqueVisitors: Set<string>;
} | null = null;
let visitorAnalyticsStore = {
  totalPageViews: 0,
  uniqueVisitors: new Set<string>(),
  sources: new Map<string, number>(),
  locations: new Map<string, { country: string; region: string; pageViews: number; visitors: Set<string> }>(),
};
let siteSettingsStore: SiteSettings = { ...DEFAULT_SITE_SETTINGS };
const supportMemory = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
const communityMessages: Array<{ id: string; displayName: string; content: string; createdAt: string }> = [];
const communityPresence = new Map<string, { lastSeen: number; displayName: string; userId?: string }>();
const communityMessageRates = new Map<string, number[]>();

async function syncOwnerFriendListForUser(userId: string) {
  if (!database) return;
  const owner = await database.query<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [Array.from(ownerEmails)[0]],
  );
  const ownerUserId = owner.rows[0]?.id;
  if (!ownerUserId) return;

  if (userId === ownerUserId) {
    await database.query(
      `INSERT INTO friend_connections (requester_id, recipient_id, status)
       SELECT $1, u.id, 'active'
       FROM users u
       WHERE u.id <> $1
       ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = EXCLUDED.status`,
      [ownerUserId],
    );
    return;
  }

  await database.query(
    `INSERT INTO friend_connections (requester_id, recipient_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = EXCLUDED.status`,
    [ownerUserId, userId],
  );
  await database.query(
    `INSERT INTO friend_connections (requester_id, recipient_id, status)
     VALUES ($2, $1, 'active')
     ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = EXCLUDED.status`,
    [ownerUserId, userId],
  );
}

function createBuiltInSupportAnswer(message: string, previousMessages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const lower = message.toLowerCase();
  if (/hello|hi|help|start/.test(lower)) {
    return 'I can help you compare offers. Ask me about deposits, payout speed, easy steps, requirements, or the fine print.';
  }
  if (/deposit|cost|spend|purchase/.test(lower)) {
    return 'Check each offer’s Deposit Req box before clicking. Some offers are $0, while others require a purchase or deposit. Review the merchant’s current official terms before signing up.';
  }
  if (/payout|pay|when|time|cash/.test(lower)) {
    return 'Each offer shows its payout speed near the top of the card. Timing depends on the merchant and eligibility, so the official offer terms control.';
  }
  if (/remember|previous|before|earlier/.test(lower) && previousMessages.length > 0) {
    const lastTopic = previousMessages.slice(-4).find((entry) => entry.role === 'user');
    return lastTopic
      ? `I remember your recent question about “${lastTopic.content.slice(0, 80)}”. You can ask a follow-up, or open an offer to compare its requirements and fine print.`
      : 'I remember this conversation. Ask me a follow-up about the offer you were reviewing.';
  }
  return 'Open an offer card to compare its incentive, deposit requirement, payout speed, easy steps, and honest catch. I can help explain those details, but the merchant’s official terms always control.';
}

async function initializeOfferStore() {
  if (!database) {
    delegatedAdminUsernames.add('modmark');
    liveOffersStore = PUBLIC_OFFERS.filter((offer) => !isTemporarilyHiddenOffer(offer));
    return;
  }

  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    CREATE TABLE IF NOT EXISTS visitor_events (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      source TEXT NOT NULL,
      path TEXT NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const migrationClient = await database.connect();
  const migrations = [
    {
      version: 1,
      apply: async () => {
        await migrationClient.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE');
        await migrationClient.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token TEXT');
        await migrationClient.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ');
        await migrationClient.query('ALTER TABLE visitor_events ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT \'Unknown\'');
        await migrationClient.query('ALTER TABLE visitor_events ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT \'Unknown\'');
      },
    },
  ];
  try {
    for (const migration of migrations) {
      const applied = await migrationClient.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration.version]);
      if (!applied.rowCount) {
        await migrationClient.query('BEGIN');
        try {
          await migration.apply();
          await migrationClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
          await migrationClient.query('COMMIT');
        } catch (error) {
          await migrationClient.query('ROLLBACK');
          throw error;
        }
      }
    }
  } finally {
    migrationClient.release();
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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      username TEXT UNIQUE,
      paypal_email TEXT,
      date_of_birth DATE,
      sex TEXT,
      state TEXT,
      account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'blocked')),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS user_offer_entries (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'issue')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, offer_id)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS admin_access (
      username TEXT PRIMARY KEY,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'delegated', 'unknown')),
      actor TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const adminAccessCount = await database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM admin_access');
  if (adminAccessCount.rows[0]?.count === '0') {
    await database.query(`INSERT INTO admin_access (username) VALUES ('modmark')`);
  }
  delegatedAdminUsernames.clear();
  const adminAccessRows = await database.query<{ username: string }>('SELECT username FROM admin_access ORDER BY username');
  adminAccessRows.rows.forEach((row) => delegatedAdminUsernames.add(row.username.toLowerCase()));
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_email TEXT`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sex TEXT`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);
  await database.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username)) WHERE username IS NOT NULL
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS survey_payout_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL CHECK (points >= ${SURVEY_MINIMUM_PAYOUT_POINTS}),
      paypal_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `);
  await database.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_survey_payout_per_user
    ON survey_payout_requests (user_id) WHERE status IN ('pending', 'processing')
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      subscribed_at TIMESTAMPTZ NOT NULL,
      frequency TEXT NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      confirmation_token TEXT,
      unsubscribed_at TIMESTAMPTZ
    )
  `);
  await database.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE');
  await database.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token TEXT');
  await database.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ');
  await database.query(`
    CREATE TABLE IF NOT EXISTS analytics_counters (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_clicks INTEGER NOT NULL DEFAULT 0,
      total_conversions INTEGER NOT NULL DEFAULT 0
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS analytics_report_checkpoints (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      checked_at TIMESTAMPTZ NOT NULL,
      total_clicks INTEGER NOT NULL DEFAULT 0,
      total_conversions INTEGER NOT NULL DEFAULT 0,
      total_page_views INTEGER NOT NULL DEFAULT 0
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS visitor_events (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      source TEXT NOT NULL,
      path TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Unknown',
      region TEXT NOT NULL DEFAULT 'Unknown',
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('ALTER TABLE visitor_events ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT \'Unknown\'');
  await database.query('ALTER TABLE visitor_events ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT \'Unknown\'');
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_impressions (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position > 0),
      visitor_id TEXT,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS offer_impressions_offer_position_idx ON offer_impressions (offer_id, position)');
  const configuredRetentionDays = Number.parseInt(env.VISITOR_ANALYTICS_RETENTION_DAYS || '365', 10);
  const retentionDays = Number.isFinite(configuredRetentionDays)
    ? Math.min(Math.max(configuredRetentionDays, 1), 3650)
    : 365;
  await database.query('DELETE FROM visitor_events WHERE viewed_at < NOW() - ($1 * INTERVAL \'1 day\')', [retentionDays]);
  await database.query(`
    CREATE TABLE IF NOT EXISTS support_chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS community_chat_messages (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('DELETE FROM community_chat_messages');
  communityMessages.length = 0;
  await database.query(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS friend_connections (
      requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('active', 'blocked')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (requester_id, recipient_id)
    )
  `);
  const ownerUserRow = await database.query<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [Array.from(ownerEmails)[0]],
  );
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_issue_reports (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      issue TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`ALTER TABLE offer_issue_reports ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
  await database.query(`ALTER TABLE offer_issue_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'`);
  const ownerUserId = ownerUserRow.rows[0]?.id;
  if (ownerUserId) {
    await database.query(
      `INSERT INTO friend_connections (requester_id, recipient_id, status)
       SELECT $1, u.id, 'active'
       FROM users u
       WHERE u.id <> $1
       ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = EXCLUDED.status`,
      [ownerUserId],
    );
  }
  await database.query(
    `INSERT INTO analytics_counters (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );
  const [subscribers, analytics] = await Promise.all([
    database.query<{ id: string; email: string; subscribed_at: Date; frequency: string; verified: boolean }>(
      'SELECT id, email, subscribed_at, frequency, verified FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at DESC',
    ),
    database.query<{ total_clicks: number; total_conversions: number }>(
      'SELECT total_clicks, total_conversions FROM analytics_counters WHERE id = 1',
    ),
  ]);
  const visitorRows = await database.query<{ visitor_id: string; source: string; total: string }>(
    `SELECT visitor_id, source, COUNT(*)::text AS total
     FROM visitor_events GROUP BY visitor_id, source`,
  );
  const locationRows = await database.query<{ visitor_id: string; country: string; region: string; total: string }>(
    `SELECT visitor_id, country, region, COUNT(*)::text AS total
     FROM visitor_events GROUP BY visitor_id, country, region`,
  );
  const sourceTotals = new Map<string, number>();
  visitorRows.rows.forEach((row) => {
    sourceTotals.set(row.source, (sourceTotals.get(row.source) || 0) + Number(row.total));
  });
  const locationTotals = new Map<string, { country: string; region: string; pageViews: number; visitors: Set<string> }>();
  locationRows.rows.forEach((row) => {
    const country = row.country || 'Unknown';
    const region = row.region || 'Unknown';
    const key = `${country}\u0000${region}`;
    const current = locationTotals.get(key) || { country, region, pageViews: 0, visitors: new Set<string>() };
    current.pageViews += Number(row.total);
    current.visitors.add(row.visitor_id);
    locationTotals.set(key, current);
  });
  visitorAnalyticsStore = {
    totalPageViews: visitorRows.rows.reduce((sum, row) => sum + Number(row.total), 0),
    uniqueVisitors: new Set(visitorRows.rows.map((row) => row.visitor_id)),
    sources: sourceTotals,
    locations: locationTotals,
  };
  subscribersStore = subscribers.rows.map((subscriber) => ({
    id: subscriber.id,
    email: subscriber.email,
    subscribedAt: new Date(subscriber.subscribed_at).toISOString(),
    frequency: subscriber.frequency,
    verified: subscriber.verified,
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
    const catalogMap = new Map(PUBLIC_OFFERS.map((offer) => [offer.id, offer]));
    const existingOffers = existing.rows.map((row) => applyCoinsBackTerms({
      ...row.offer,
      clicksCount: Number.isFinite(Number(row.offer.clicksCount)) ? Number(row.offer.clicksCount) : 0,
      conversionsCount: Number.isFinite(Number(row.offer.conversionsCount)) ? Number(row.offer.conversionsCount) : 0,
    })).filter((offer) => !isTemporarilyHiddenOffer(offer));

    const mergedOffers = PUBLIC_OFFERS.filter((offer) => !isTemporarilyHiddenOffer(offer)).map((offer) => {
      const existingOffer = existingOffers.find((row) => row.id === offer.id);
      return {
        ...offer,
        clicksCount: Number.isFinite(Number(existingOffer?.clicksCount)) ? Number(existingOffer.clicksCount) : 0,
        conversionsCount: Number.isFinite(Number(existingOffer?.conversionsCount)) ? Number(existingOffer.conversionsCount) : 0,
      };
    });

    const extraOffers = existingOffers.filter((offer) => !catalogMap.has(offer.id));
    liveOffersStore = [...mergedOffers, ...extraOffers];
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
app.get('/api/health', async (_req, res) => {
  const emailConfigured = Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
  if (!database) {
    return res.json({
      status: 'ok',
      database: 'memory',
      email: emailConfigured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    });
  }
  try {
    await database.query('SELECT 1');
    return res.json({
      status: 'ok',
      database: 'connected',
      email: emailConfigured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check database probe failed:', error);
    return res.status(503).json({
      status: 'degraded',
      database: 'unavailable',
      email: emailConfigured ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
    });
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

app.post('/api/rewards/cashout', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google before requesting a payout.' });
  if (!database) return res.status(503).json({ error: 'Payouts require the production account database.' });
  const paypalEmail = typeof req.body?.paypalEmail === 'string' ? req.body.paypalEmail.trim().toLowerCase() : '';
  if (!SURVEY_PAYOUT_EMAIL_PATTERN.test(paypalEmail) || paypalEmail.length > 254) {
    return res.status(400).json({ error: 'Enter a valid PayPal email address.' });
  }

  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const balance = await client.query<{ points: number }>(
      'SELECT points FROM survey_reward_balances WHERE user_id = $1 FOR UPDATE',
      [user.id],
    );
    const points = Number(balance.rows[0]?.points || 0);
    if (points < SURVEY_MINIMUM_PAYOUT_POINTS) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `You need at least ${SURVEY_MINIMUM_PAYOUT_POINTS} points ($${(SURVEY_MINIMUM_PAYOUT_POINTS / SURVEY_POINTS_PER_DOLLAR).toFixed(2)}) to cash out.`,
        points,
      });
    }
    const existing = await client.query(
      `SELECT id FROM survey_payout_requests
       WHERE user_id = $1 AND status IN ('pending', 'processing')
       LIMIT 1`,
      [user.id],
    );
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already have a payout request being processed.' });
    }
    const payoutId = randomUUID();
    await client.query(
      `INSERT INTO survey_payout_requests (id, user_id, points, paypal_email)
       VALUES ($1, $2, $3, $4)`,
      [payoutId, user.id, points, paypalEmail],
    );
    await client.query(
      `UPDATE survey_reward_balances
       SET points = 0, updated_at = NOW()
       WHERE user_id = $1`,
      [user.id],
    );
    await client.query('COMMIT');
    return res.status(201).json({
      requestId: payoutId,
      status: 'pending',
      points,
      dollars: points / SURVEY_POINTS_PER_DOLLAR,
      message: 'Your PayPal payout request was received and is pending review.',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'You already have a payout request being processed.' });
    }
    throw error;
  } finally {
    client.release();
  }
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
  res.json({ offers: liveOffersStore.filter(isVerificationCurrent) });
});

app.get('/api/account/offer-entries', requireAuthenticatedUser, async (_req, res) => {
  const user = res.locals.authenticatedUser as { id: string };
  if (database) {
    const result = await database.query(
      `SELECT offer_id AS "offerId", status, updated_at AS "updatedAt"
       FROM user_offer_entries WHERE user_id = $1 ORDER BY updated_at DESC`,
      [user.id],
    );
    return res.json({ entries: result.rows });
  }
  return res.json({ entries: userOfferEntriesStore.get(user.id) || [] });
});

app.put('/api/account/offer-entries/:offerId', requireAuthenticatedUser, async (req, res) => {
  const user = res.locals.authenticatedUser as { id: string };
  const offer = liveOffersStore.find((candidate) => candidate.id === req.params.offerId);
  const status = req.body?.status;
  if (!offer) return res.status(404).json({ error: 'Offer not found.' });
  if (!['active', 'completed', 'issue'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid offer status.' });
  }
  const updatedAt = new Date().toISOString();
  if (database) {
    await database.query(
      `INSERT INTO user_offer_entries (user_id, offer_id, status, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, offer_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
      [user.id, offer.id, status, updatedAt],
    );
  } else {
    const entries = userOfferEntriesStore.get(user.id) || [];
    const next = entries.filter((entry) => entry.offerId !== offer.id);
    next.push({ offerId: offer.id, status, updatedAt });
    userOfferEntriesStore.set(user.id, next);
  }
  return res.json({ entry: { offerId: offer.id, status, updatedAt } });
});

app.post('/api/offers/:id/completion-report', (req, res) => {
  const offer = liveOffersStore.find((candidate) => candidate.id === req.params.id);
  if (!offer || !isVerificationCurrent(offer)) {
    return res.status(404).json({ error: 'Offer not found' });
  }
  if (req.body?.confirmed !== true) {
    return res.status(400).json({ error: 'Completion confirmation is required.' });
  }
  const report = {
    id: randomUUID(),
    offerId: offer.id,
    reportedAt: new Date().toISOString(),
  };
  completionReports.set(report.id, report);
  return res.status(201).json({
    success: true,
    status: 'pending_review',
    message: 'Thanks. Your report was recorded as self-reported and is not a verified conversion.',
  });

});

app.post('/api/offers/:id/issue-report', async (req, res) => {
  const offer = liveOffersStore.find((candidate) => candidate.id === req.params.id);
  const allowedIssues = new Set(['expired', 'broken-link', 'terms-wrong']);
  if (!offer || !isVerificationCurrent(offer)) return res.status(404).json({ error: 'Offer not found' });
  if (typeof req.body?.issue !== 'string' || !allowedIssues.has(req.body.issue)) {
    return res.status(400).json({ error: 'Choose a valid issue type.' });
  }
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 1000) : '';
  const report = { id: randomUUID(), offerId: offer.id, issue: req.body.issue, description, status: 'open', reportedAt: new Date().toISOString() };
  if (database) {
    await database.query(
      'INSERT INTO offer_issue_reports (id, offer_id, issue, description, reported_at) VALUES ($1, $2, $3, $4, $5)',
      [report.id, report.offerId, report.issue, report.description, report.reportedAt],
    );
  } else {
    issueReportsStore.unshift(report);
  }
  return res.status(201).json({ success: true });
});

app.get('/api/admin/offer-issue-reports', requireOwnerAdmin, async (_req, res) => {
  if (database) {
    const result = await database.query(
      `SELECT r.id, r.offer_id AS "offerId", r.issue, r.description, r.status,
              r.reported_at AS "reportedAt", o.title, o.company
       FROM offer_issue_reports r
       LEFT JOIN offers o ON o.id = r.offer_id
       ORDER BY r.reported_at DESC`,
    );
    return res.json({ reports: result.rows });
  }
  return res.json({
    reports: issueReportsStore.map((report) => ({
      ...report,
      status: report.status || 'open',
      title: liveOffersStore.find((offer) => offer.id === report.offerId)?.title || report.offerId,
      company: liveOffersStore.find((offer) => offer.id === report.offerId)?.company || '',
    })),
  });
});

app.patch('/api/admin/offer-issue-reports/:id', requireOwnerAdmin, async (req, res) => {
  const status = req.body?.status;
  if (!['open', 'reviewing', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid report status.' });
  }
  if (database) {
    const result = await database.query(
      'UPDATE offer_issue_reports SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Issue report not found.' });
    return res.json({ report: result.rows[0] });
  }
  const report = issueReportsStore.find((candidate) => candidate.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Issue report not found.' });
  report.status = status;
  return res.json({ report: { id: report.id, status } });
});

app.get('/api/site-settings', (_req, res) => {
  res.json({ settings: siteSettingsStore });
});

app.put('/api/site-settings', requireAdmin, async (req, res) => {
  const incoming = (req.body && typeof req.body === 'object' ? req.body : {}) as Partial<SiteSettings>;
  const nextSettings: SiteSettings = {
    ...siteSettingsStore,
    ...Object.fromEntries(
      Object.entries({
        siteName: incoming.siteName,
        siteTagline: incoming.siteTagline,
        heroBadge: incoming.heroBadge,
        mainHeadline: incoming.mainHeadline,
        subHeadline: incoming.subHeadline,
        brandName: incoming.brandName,
        brandBadge: incoming.brandBadge,
        footerBlurb: incoming.footerBlurb,
        supportEmail: incoming.supportEmail,
        footerDisclaimer: incoming.footerDisclaimer,
        trustHeading: incoming.trustHeading,
        trustParagraph: incoming.trustParagraph,
        trustSubtext: incoming.trustSubtext,
        metaTitle: incoming.metaTitle,
        metaDescription: incoming.metaDescription,
        themeBackgroundColor: typeof incoming.themeBackgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(incoming.themeBackgroundColor)
          ? incoming.themeBackgroundColor
          : undefined,
        themeAccentColor: typeof incoming.themeAccentColor === 'string' && /^#[0-9a-f]{6}$/i.test(incoming.themeAccentColor)
          ? incoming.themeAccentColor
          : undefined,
        themePanelColor: typeof incoming.themePanelColor === 'string' && /^#[0-9a-f]{6}$/i.test(incoming.themePanelColor)
          ? incoming.themePanelColor
          : undefined,
      }).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    ) as unknown as SiteSettings,
  };

  siteSettingsStore = nextSettings;
  await auditAdminAction(req, 'site_settings_updated', { fields: Object.keys(incoming).join(',') });
  res.json({ settings: siteSettingsStore });
});

app.post('/api/admin/unlock-user', async (req, res) => {
  const attemptKey = req.ip || req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const currentAttempts = adminUnlockAttempts.get(attemptKey);
  if (currentAttempts && currentAttempts.resetAt > now && currentAttempts.count >= 5) {
    return res.status(429).json({ error: 'Too many admin unlock attempts. Try again later.' });
  }
  if (!currentAttempts || currentAttempts.resetAt <= now) {
    adminUnlockAttempts.set(attemptKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    currentAttempts.count += 1;
  }
  const user = await getAuthenticatedUser(req);
  const username = user?.username?.trim().toLowerCase();
  const isOwner = Boolean(user && ownerEmails.has(user.email.trim().toLowerCase()));
  if (!user || (!isOwner && (!username || !delegatedAdminUsernames.has(username)))) {
    return res.status(403).json({ error: 'This account has not been granted admin access.' });
  }
  adminUnlockAttempts.delete(attemptKey);
  const token = randomUUID();
  const role = isOwner ? 'owner' : 'delegated';
  const configuredAdminSessionHours = Number.parseFloat(env.ADMIN_SESSION_HOURS || '2');
  const adminSessionHours = Number.isFinite(configuredAdminSessionHours)
    ? Math.min(Math.max(configuredAdminSessionHours, 0.25), 24)
    : 2;
  adminTokens.set(token, { expiresAt: Date.now() + adminSessionHours * 60 * 60 * 1000, role });
  await auditAdminAction(req, 'admin_unlock', { actor: user.email.toLowerCase(), role });
  res.json({ token, role });
});

app.get('/api/admin/can-access', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const username = user?.username?.trim().toLowerCase();
  const isOwner = Boolean(user && ownerEmails.has(user.email.trim().toLowerCase()));
  const canAccess = Boolean(user && (isOwner || (username && delegatedAdminUsernames.has(username))));
  res.json({ canAccess, role: isOwner ? 'owner' : 'delegated' });
});

async function requireAuthenticatedUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to save offers to your account.' });
  res.locals.authenticatedUser = user;
  return next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  next();
}

async function auditAdminAction(req: express.Request, action: string, details: Record<string, string | number | boolean | null> = {}) {
  if (!database) return;
  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : undefined;
  try {
    await database.query(
      `INSERT INTO admin_audit_log (id, action, role, actor, details)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        randomUUID(),
        action,
        session?.role || 'unknown',
        typeof details.actor === 'string' ? details.actor : null,
        JSON.stringify(details),
      ],
    );
  } catch (error) {
    console.error('Could not write admin audit log:', error);
  }
}

function hasValidAdminToken(token: string | undefined) {
  const session = token ? adminTokens.get(token) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    if (token) adminTokens.delete(token);
    return false;
  }
  return true;
}

function requireOwnerAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : undefined;
  if (!session || session.expiresAt < Date.now() || session.role !== 'owner') {
    if (token && (!session || session.expiresAt < Date.now())) adminTokens.delete(token);
    return res.status(403).json({ error: 'Owner admin access is required.' });
  }
  next();
}

function createFallbackOutreachResult(task: string, reason: string) {
  return {
    summary: `Create a human-reviewed outreach post for: ${task}`,
    safetyNotes: [
      'Review each community\'s rules before posting and ask permission when promotional links are restricted.',
      'Post manually one community at a time. Do not mass-post, scrape private groups, or evade moderation.',
      `Automated planning was unavailable (${reason}), so verify every claim and offer term against the official merchant page.`,
    ],
    searchQueries: [
      `${task} official terms referral bonus`,
      'site:reddit.com promotional offers referral rules',
      'cashback signup bonus community disclosure guidelines',
    ],
    workflow: [
      { step: 1, action: 'Open the official merchant offer and verify the current reward, requirements, eligibility, and expiration.', reason: 'Prevent outdated or misleading claims.' },
      { step: 2, action: 'Find one relevant public community and read its current self-promotion and affiliate-link rules.', reason: 'Respect community policies and avoid unwanted promotion.' },
      { step: 3, action: 'Write a concise post with the requirements first, the official link, and a clear affiliate disclosure.', reason: 'Give readers enough context to make an informed decision.' },
      { step: 4, action: 'Submit or publish manually only after checking the final text and link.', reason: 'Keep a human in control of the publication.' },
    ],
    draftPost: `I found a current signup offer for ${task}. Before applying, check the official terms for eligibility, required actions, timing, and any deposit or purchase requirements.\n\nOfficial offer: [paste the verified merchant link]\n\nDisclosure: This may be a referral or affiliate link, which may compensate the publisher at no extra cost to you. Terms and eligibility can change, so verify them on the official merchant site before signing up.`,
    disclosure: 'This may be a referral or affiliate link. The merchant controls eligibility, terms, and payout timing. Verify the official offer before participating.',
  };
}

app.get('/api/admin/access', requireOwnerAdmin, (_req, res) => {
  res.json({ usernames: [...delegatedAdminUsernames].sort() });
});

app.get('/api/admin/audit-log', requireOwnerAdmin, async (req, res) => {
  if (!database) return res.json({ entries: [] });
  const result = await database.query<{ id: string; action: string; role: string; actor: string | null; details: Record<string, unknown>; created_at: Date }>(
    `SELECT id, action, role, actor, details, created_at
     FROM admin_audit_log ORDER BY created_at DESC LIMIT 200`,
  );
  await auditAdminAction(req, 'audit_log_viewed');
  res.json({
    entries: result.rows.map((entry) => ({
      id: entry.id,
      action: entry.action,
      role: entry.role,
      actor: entry.actor,
      details: entry.details,
      createdAt: entry.created_at.toISOString(),
    })),
  });
});

app.get('/api/admin/accounts', requireOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const result = await database.query<{ id: string; email: string; username: string | null; created_at: Date; last_login_at: Date | null; account_status: 'active' | 'blocked'; active_sessions: string }>(
        `SELECT users.id, users.email, users.username, users.created_at, users.last_login_at, users.account_status,
           COUNT(auth_sessions.token) FILTER (WHERE auth_sessions.expires_at > NOW())::text AS active_sessions
         FROM users
         LEFT JOIN auth_sessions ON auth_sessions.user_id = users.id
         GROUP BY users.id
         ORDER BY users.created_at DESC`,
      );
      return res.json({
        accounts: result.rows.map((account) => ({
          id: account.id,
          email: account.email,
          username: account.username,
          createdAt: account.created_at.toISOString(),
          lastLoginAt: account.last_login_at?.toISOString() || null,
          status: account.account_status,
          activeSessions: Number(account.active_sessions || 0),
        })),
      });
    } catch (error) {
      console.error('Admin accounts query failed; retrying without session counts.', error);
      try {
        const fallback = await database.query<{ id: string; email: string; username: string | null; created_at: Date; last_login_at: Date | null; account_status: 'active' | 'blocked' }>(
          `SELECT id, email, username, created_at, last_login_at, account_status
           FROM users
           ORDER BY created_at DESC`,
        );
        return res.json({
          accounts: fallback.rows.map((account) => ({
            id: account.id,
            email: account.email,
            username: account.username,
            createdAt: account.created_at.toISOString(),
            lastLoginAt: account.last_login_at?.toISOString() || null,
            status: account.account_status,
            activeSessions: 0,
          })),
          warning: 'Active session counts are temporarily unavailable.',
        });
      } catch (fallbackError) {
        console.error('Admin accounts fallback query failed; returning memory accounts.', fallbackError);
        return res.json({
          accounts: [...authUsers.values()].map((account) => ({
            id: account.id,
            email: account.email,
            username: account.username,
            createdAt: null,
            lastLoginAt: account.lastLoginAt,
            status: account.accountStatus,
            activeSessions: [...authSessions.values()].filter((session) => session.userId === account.id && session.expiresAt > Date.now()).length,
          })),
          warning: 'The database is temporarily unavailable. Showing accounts created during this server session.',
        });
      }
    }
  }

  return res.json({
    accounts: [...authUsers.values()].map((account) => ({
      id: account.id,
      email: account.email,
      username: account.username,
      createdAt: null,
      lastLoginAt: account.lastLoginAt,
      status: account.accountStatus,
      activeSessions: [...authSessions.values()].filter((session) => session.userId === account.id && session.expiresAt > Date.now()).length,
    })),
  });
});

app.patch('/api/admin/accounts/:id/status', requireOwnerAdmin, async (req, res) => {
  const status = req.body?.status;
  if (status !== 'active' && status !== 'blocked') return res.status(400).json({ error: 'Invalid account status.' });
  if (database) {
    const result = await database.query('UPDATE users SET account_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [status, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Account not found.' });
    if (status === 'blocked') await database.query('DELETE FROM auth_sessions WHERE user_id = $1', [req.params.id]);
  } else {
    const account = authUsers.get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    account.accountStatus = status;
    if (status === 'blocked') {
      [...authSessions.entries()].forEach(([token, session]) => { if (session.userId === account.id) authSessions.delete(token); });
    }
  }
  await auditAdminAction(req, 'account_status_updated', { accountId: req.params.id, status });
  res.json({ status });
});

app.delete('/api/admin/accounts/:id', requireOwnerAdmin, async (req, res) => {
  if (database) {
    const result = await database.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Account not found.' });
  } else if (!authUsers.delete(req.params.id)) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  [...authSessions.entries()].forEach(([token, session]) => { if (session.userId === req.params.id) authSessions.delete(token); });
  await auditAdminAction(req, 'account_deleted', { accountId: req.params.id });
  res.json({ deleted: true });
});

app.put('/api/admin/access', requireOwnerAdmin, async (req, res) => {
  const incoming: unknown[] = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
  const usernames = [...new Set(incoming
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value: string) => value.trim().toLowerCase())
    .filter((value: string) => /^[a-zA-Z0-9_]{3,24}$/.test(value)))];
  if (usernames.length > 100) return res.status(400).json({ error: 'You can grant access to up to 100 usernames.' });

  if (database) {
    await database.query('BEGIN');
    try {
      await database.query('DELETE FROM admin_access');
      for (const username of usernames) {
        await database.query('INSERT INTO admin_access (username) VALUES ($1)', [username]);
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
  }
  delegatedAdminUsernames.clear();
  usernames.forEach((username) => delegatedAdminUsernames.add(username));
  await auditAdminAction(req, 'admin_access_updated', { usernameCount: usernames.length });
  res.json({ usernames: [...delegatedAdminUsernames].sort() });
});

app.post('/api/admin/copilot', requireAdmin, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';
  if (!message || message.length > 4000) {
    return res.status(400).json({ error: 'Enter a question up to 4,000 characters.' });
  }
  if (containsSensitiveCredentials(message)) {
    return res.status(400).json({
      error: 'Do not enter passwords, login details, passcodes, or private account information.',
    });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.json({
      answer: `Gemini is not configured for this server. Add a valid GEMINI_API_KEY in Render's Environment settings, redeploy, and try again. Until then, I can only provide the built-in manual guidance for: ${message}\n\nUse the Live Offers tab for offer links and codes, Site Settings for public copy and SEO, and the Outreach Assistant for a reviewed promotion plan.`,
      fallback: true,
    });

  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are S4FC Copilot, a concise and practical assistant embedded in the private admin panel for Signups4FastCash.com.
Help the administrator understand the site, diagnose issues, plan content, improve offers, and choose the correct admin-panel control.
You may recommend exact edits, field values, validation steps, and code changes, but you must not claim to have changed data, deployed code, sent emails, or published posts.
Never request or repeat passwords, API keys, login details, private messages, bank details, or government IDs.
Prefer short step-by-step answers. Flag affiliate, financial, legal, privacy, and platform-policy risks when relevant.

CURRENT SITE CONTEXT:
${context || 'No site context was provided.'}

ADMIN QUESTION:
${message}`,
      config: { temperature: 0.3 },
    });
    return res.json({ answer: response.text?.trim() || 'I could not produce an answer. Try asking in a more specific way.' });
  } catch (error) {
    console.error('Admin copilot failed:', error);
    const providerMessage = String(error).match(/API_KEY_INVALID|API key not valid/i)
      ? "The configured GEMINI_API_KEY is invalid. Replace it in Render's Environment settings, redeploy, and try again."
      : 'The Gemini service is temporarily unavailable.';
    return res.json({
      answer: `${providerMessage}\n\nI can still help you work through this manually: ${message}\n\nCheck the relevant Admin Panel tab, verify the official merchant terms, and test the change on the public site before deploying.`,
      fallback: true,
    });
  }
});

app.post('/api/support-chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim().slice(0, 120) : '';
  if (!message || message.length > 1000) {
    return res.status(400).json({ error: 'Enter a question up to 1,000 characters.' });
  }
  if (!conversationId) {
    return res.status(400).json({ error: 'A conversation ID is required.' });
  }
  if (containsSensitiveCredentials(message)) {
    return res.status(400).json({ error: 'Please do not share passwords, account details, API keys, or financial information.' });
  }

  let previousMessages = supportMemory.get(conversationId) || [];
  if (previousMessages.length === 0 && database) {
    try {
      const stored = await database.query<{ role: 'user' | 'assistant'; content: string }>(
        'SELECT role, content FROM support_chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 12',
        [conversationId],
      );
      previousMessages = stored.rows.reverse();
    } catch (error) {
      console.error('Could not load support conversation:', error);
    }
  }
  const answer = createBuiltInSupportAnswer(message, previousMessages);
  const nextMessages = [...previousMessages, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: answer }].slice(-12);
  supportMemory.set(conversationId, nextMessages);
  if (database) {
    try {
      await database.query(
        'INSERT INTO support_chat_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [randomUUID(), conversationId, 'user', message],
      );
      await database.query(
        'INSERT INTO support_chat_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [randomUUID(), conversationId, 'assistant', answer],
      );
    } catch (error) {
      console.error('Could not persist support conversation:', error);
    }
  }

  const ai = getGenAI();
  if (!ai) {
    return res.json({ answer, fallback: true, memory: true });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are S4FC Support, a friendly public customer-support assistant for Signups4FastCash.com.
Help visitors compare signup bonuses and understand offer requirements, payout timing, steps, risks, and affiliate disclosures.
Do not promise approval, payment, earnings, or eligibility. Direct visitors to official merchant terms.
Never ask for passwords, API keys, bank details, government IDs, or private account information.
Keep answers concise.

VISITOR QUESTION:
${message}`,
      config: { temperature: 0.3 },
    });
    return res.json({ answer: response.text?.trim() || answer, memory: true });
  } catch (error) {
    console.error('Support chatbot failed:', error);
    return res.json({
      answer: 'The support assistant is temporarily unavailable. You can still compare each offer’s requirements, payout speed, easy steps, and fine print directly on this page.',
      fallback: true,
    });
  }
});

app.get('/api/community-chat', async (req, res) => {
  const visitorId = typeof req.query.visitorId === 'string' ? req.query.visitorId.trim().slice(0, 120) : '';
  const displayName = typeof req.query.displayName === 'string'
    ? req.query.displayName.trim().slice(0, 40) || 'Guest'
    : 'Guest';
  const user = await getAuthenticatedUser(req);
  const presenceId = user?.id || visitorId;
  if (presenceId) communityPresence.set(presenceId, { lastSeen: Date.now(), displayName, userId: user?.id });
  const cutoff = Date.now() - 90_000;
  const stalePresenceCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [id, presence] of communityPresence) {
    if (presence.lastSeen < stalePresenceCutoff) communityPresence.delete(id);
  }
  const activeUsers = [...communityPresence.values()]
    .filter((presence) => presence.lastSeen >= cutoff)
    .map((presence) => presence.displayName)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((left, right) => left.localeCompare(right));
  const activeCount = [...communityPresence.values()].filter((presence) => presence.lastSeen >= cutoff).length;

  if (database) {
    const result = await database.query<{ id: string; display_name: string; content: string; created_at: Date }>(
      'SELECT id, display_name, content, created_at FROM community_chat_messages ORDER BY created_at DESC LIMIT 50',
    );
    return res.json({
      messages: result.rows.reverse().map((message) => ({
        id: message.id,
        displayName: message.display_name,
        content: message.content,
        createdAt: new Date(message.created_at).toISOString(),
      })),
      activeCount,
      activeUsers,
    });
  }

  return res.json({ messages: communityMessages.slice(-50), activeCount, activeUsers });
});

app.post('/api/community-chat', async (req, res) => {
  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim().slice(0, 120) : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 40) : 'Guest';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 280) : '';
  if (!visitorId || !content) return res.status(400).json({ error: 'A visitor ID and message are required.' });
  if (content.length < 1) return res.status(400).json({ error: 'Message cannot be empty.' });

  const now = Date.now();
  const recentMessages = (communityMessageRates.get(visitorId) || []).filter((timestamp) => timestamp > now - 30_000);
  if (recentMessages.length >= 5) return res.status(429).json({ error: 'Please wait a moment before sending more messages.' });
  recentMessages.push(now);
  communityMessageRates.set(visitorId, recentMessages);
  const user = await getAuthenticatedUser(req);
  communityPresence.set(user?.id || visitorId, {
    lastSeen: Date.now(),
    displayName: displayName || 'Guest',
    userId: user?.id,
  });
  const message = { id: randomUUID(), displayName: displayName || 'Guest', content, createdAt: new Date().toISOString() };
  communityMessages.push(message);
  if (communityMessages.length > 200) communityMessages.splice(0, communityMessages.length - 200);
  if (database) {
    await database.query(
      'INSERT INTO community_chat_messages (id, display_name, content) VALUES ($1, $2, $3)',
      [message.id, message.displayName, message.content],
    );
  }
  return res.status(201).json({ message });
});

app.get('/api/community-users', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to direct message other users.' });
  if (!database) return res.json({ users: [...authUsers.values()].filter((entry) => entry.id !== user.id && entry.username).map((entry) => ({ id: entry.id, username: entry.username, avatarUrl: entry.avatarUrl })) });
  const result = await database.query<{ id: string; username: string; avatar_url: string | null }>(
    'SELECT id, username, avatar_url FROM users WHERE id <> $1 AND username IS NOT NULL ORDER BY LOWER(username) LIMIT 100',
    [user.id],
  );
  return res.json({ users: result.rows.map((entry) => ({ id: entry.id, username: entry.username, avatarUrl: entry.avatar_url })) });
});

app.get('/api/friends', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to manage friends.' });
  if (!database) return res.json({ friends: [], users: [] });
  const result = await database.query(
    `SELECT u.id, u.username, u.avatar_url,
      COALESCE((
        SELECT fc.status FROM friend_connections fc
        WHERE fc.requester_id = $1 AND fc.recipient_id = u.id
        LIMIT 1
      ), 'none') AS relationship
     FROM users u
     WHERE u.id <> $1 AND u.username IS NOT NULL
     ORDER BY LOWER(u.username)`,
    [user.id],
  );
  const friends = result.rows.filter((entry) => entry.relationship === 'active');
  const blocked = result.rows.filter((entry) => entry.relationship === 'blocked');
  const presenceByUserId = new Map(
    [...communityPresence.values()]
      .filter((presence) => presence.userId)
      .map((presence) => [presence.userId as string, presence.lastSeen]),
  );
  return res.json({
    friends: friends.map((entry) => ({
      id: entry.id,
      username: entry.username,
      avatarUrl: entry.avatar_url,
      lastOnline: presenceByUserId.get(entry.id) ? new Date(presenceByUserId.get(entry.id) as number).toISOString() : null,
    })),
    blocked: blocked.map((entry) => ({ id: entry.id, username: entry.username, avatarUrl: entry.avatar_url })),
    users: result.rows.filter((entry) => entry.relationship === 'none').map((entry) => ({ id: entry.id, username: entry.username, avatarUrl: entry.avatar_url })),
  });
});

app.post('/api/friends', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const action = req.body?.action === 'block' ? 'blocked' : 'active';
  if (!user) return res.status(401).json({ error: 'Sign in to manage friends.' });
  if (!username) return res.status(400).json({ error: 'Enter a username.' });
  if (!database) return res.status(503).json({ error: 'Friends require the site database.' });
  const target = await database.query<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]);
  if (!target.rows[0] || target.rows[0].id === user.id) return res.status(404).json({ error: 'User not found.' });
  await database.query(
    `INSERT INTO friend_connections (requester_id, recipient_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = EXCLUDED.status`,
    [user.id, target.rows[0].id, action],
  );
  return res.status(201).json({ ok: true });
});

app.delete('/api/friends/:userId', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to manage friends.' });
  if (!database) return res.status(503).json({ error: 'Friends require the site database.' });
  await database.query(
    `DELETE FROM friend_connections
     WHERE (requester_id = $1 AND recipient_id = $2)
        OR (requester_id = $2 AND recipient_id = $1)`,
    [user.id, req.params.userId],
  );
  return res.json({ ok: true });
});

app.get('/api/direct-messages', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const otherUserId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!user || !otherUserId) return res.status(401).json({ error: 'Sign in to use direct messages.' });
  if (!database) return res.json({ messages: [] });
  const result = await database.query(
    `SELECT id, sender_id, recipient_id, content, created_at
     FROM direct_messages
     WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
     ORDER BY created_at ASC LIMIT 100`,
    [user.id, otherUserId],
  );
  return res.json({ messages: result.rows });
});

app.post('/api/direct-messages', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim().slice(0, 500) : '';
  if (!user || !recipientId) return res.status(401).json({ error: 'Sign in to use direct messages.' });
  if (!content) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (!database) return res.status(503).json({ error: 'Direct messages require the site database.' });
  const recipient = await database.query('SELECT 1 FROM users WHERE id = $1', [recipientId]);
  if (!recipient.rowCount) return res.status(404).json({ error: 'User not found.' });
  const result = await database.query(
    'INSERT INTO direct_messages (id, sender_id, recipient_id, content) VALUES ($1, $2, $3, $4) RETURNING id, sender_id, recipient_id, content, created_at',
    [randomUUID(), user.id, recipientId, content],
  );
  return res.status(201).json({ message: result.rows[0] });
});

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

    app.post('/api/admin/verify-offer', requireAdmin, async (req, res) => {
      const pasted = typeof req.body?.pasted === 'string' ? req.body.pasted.trim() : '';
      if (!pasted || pasted.length > 12000) return res.status(400).json({ error: 'Paste offer details up to 12,000 characters.' });
      if (containsSensitiveCredentials(pasted)) return res.status(400).json({ error: 'Do not paste passwords, login details, or private account information.' });
      const ai = getGenAI();
      if (!ai) return res.status(503).json({ error: 'Offer verification requires GEMINI_API_KEY to be configured.' });

      const sourceUrl = extractPublicUrl(pasted);
      let sourceText = 'No public URL was found in the pasted text.';
      if (sourceUrl) {
        try {
          const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Signups4FastCash-offer-verifier/1.0' } });
          if (response.ok) sourceText = (await response.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 24000);
          else sourceText = `The public page returned HTTP ${response.status}.`;
        } catch (error) {
          sourceText = `The public page could not be fetched: ${error instanceof Error ? error.message : 'request failed'}.`;
        }
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `You verify a promotional offer for an admin who will manually review it. Use only claims supported by the pasted text or fetched public page. Do not invent missing terms. Prefer the fetched page when it conflicts with pasted claims. Return conservative edits, a confirmation summary, confidence as a decimal from 0 to 1, and unresolved warnings. Never mark an offer verified merely because a URL exists.

    PASTED OFFER:
    ${pasted}

    FETCHED PUBLIC PAGE (${sourceUrl || 'none'}):
    ${sourceText}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                confirmed: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                summary: { type: Type.STRING },
                warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
                edits: {
                  type: Type.OBJECT,
                  properties: {
                    company: { type: Type.STRING },
                    title: { type: Type.STRING },
                    incentive: { type: Type.STRING },
                    payoutSpeed: { type: Type.STRING },
                    deposit: { type: Type.STRING },
                    referralCode: { type: Type.STRING },
                    referralUrl: { type: Type.STRING },
                    catchText: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
              required: ['confirmed', 'confidence', 'summary', 'warnings', 'edits'],
            },
          },
        });
        return res.json({ sourceUrl, result: JSON.parse(response.text || '{}') });
      } catch (error) {
        console.error('Offer verification failed:', error);
        return res.status(502).json({ error: 'The offer could not be verified right now. Review the official terms manually.' });
      }
    });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.json({ result: createFallbackOutreachResult(task, 'Gemini is not configured') });
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
    return res.json({ result: createFallbackOutreachResult(task, 'the AI service was unavailable') });
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
    verificationExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!isPublishableOffer(updatedOffer)) {
    return res.status(400).json({ error: 'A live offer needs valid HTTP(S) merchant and referral URLs and a referral code.' });
  }
  liveOffersStore[index] = updatedOffer;

  try {
    await saveLiveOffers();
    await auditAdminAction(req, 'offer_updated', { offerId: req.params.id });
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
    verificationExpiresAt: req.body.verificationExpiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  if (!isPublishableOffer(offer)) {
    return res.status(400).json({ error: 'A live offer needs valid HTTP(S) merchant and referral URLs and a referral code.' });
  }
  liveOffersStore = [offer, ...liveOffersStore];

  try {
    await saveLiveOffers();
    await auditAdminAction(req, 'offer_created', { offerId: offer.id });
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
    await auditAdminAction(req, 'offer_deleted', { offerId: req.params.id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Could not delete offer' });
  }
});

// API: Trigger Omni-AI Multi-Model scan
app.post('/api/cashbot/scan', requireAdmin, async (req, res) => {
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

// API: Track offer exposure telemetry. Position is the 1-based catalog position
// rendered to the visitor, so reports can compare placement performance.
app.post('/api/analytics/impression', async (req, res) => {
  const adminToken = req.header('x-admin-token');
  const adminSession = adminToken ? adminTokens.get(adminToken) : undefined;
  if (adminSession && adminSession.expiresAt > Date.now()) {
    return res.json({ success: true, excluded: true });
  }

  const offerId = typeof req.body?.offerId === 'string' ? req.body.offerId.trim() : '';
  const position = Number(req.body?.position);
  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim().slice(0, 100) : undefined;
  if (!offerId || !Number.isInteger(position) || position < 1 || position > 10000) {
    return res.status(400).json({ error: 'A valid offerId and positive position are required' });
  }
  if (!liveOffersStore.some((offer) => offer.id === offerId)) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  const impression: OfferImpression = {
    offerId,
    position,
    ...(visitorId ? { visitorId } : {}),
    recordedAt: new Date().toISOString(),
  };
  offerImpressionsStore.push(impression);
  if (database) {
    try {
      await database.query(
        `INSERT INTO offer_impressions (id, offer_id, position, visitor_id, recorded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), offerId, position, visitorId || null, impression.recordedAt],
      );
    } catch (error) {
      console.error('Could not persist offer impression:', error);
      return res.status(500).json({ error: 'Could not record offer impression.' });
    }
  }
  return res.status(201).json({ success: true });
});

// API: Track click & conversion telemetry
app.post('/api/analytics/track', (req, res) => {
  const adminToken = req.header('x-admin-token');
  const adminSession = adminToken ? adminTokens.get(adminToken) : undefined;
  if (adminSession && adminSession.expiresAt > Date.now()) {
    return res.json({ success: true, excluded: true });
  }

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
    .then(() => res.json({
      success: true,
      stats: analyticsStore,
      offer: {
        id: offer.id,
        clicksCount: offer.clicksCount,
        conversionsCount: offer.conversionsCount,
      },
    }))
    .catch(() => res.status(500).json({ error: 'Could not record analytics' }));
});

app.post('/api/analytics/pageview', async (req, res) => {
  const adminToken = req.header('x-admin-token');
  const adminSession = adminToken ? adminTokens.get(adminToken) : undefined;
  if (adminSession && adminSession.expiresAt > Date.now()) {
    return res.json({ success: true, excluded: true });
  }

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
  const location = getApproximateLocation(req);
  const locationKey = `${location.country}\u0000${location.region}`;
  const locationSummary = visitorAnalyticsStore.locations.get(locationKey)
    || { ...location, pageViews: 0, visitors: new Set<string>() };
  locationSummary.pageViews += 1;
  locationSummary.visitors.add(visitorId);
  visitorAnalyticsStore.locations.set(locationKey, locationSummary);

  if (database) {
    try {
      await database.query(
        `INSERT INTO visitor_events (id, visitor_id, source, path, country, region) VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), visitorId, source, path, location.country, location.region],
      );
    } catch (error) {
      console.error('Could not persist visitor event:', error);
      return res.status(500).json({ error: 'Could not record page view.' });
    }
  }
  return res.json({ success: true });
});

app.get('/api/admin/analytics/visitors', requireAdmin, async (req, res) => {
  const from = typeof req.query.from === 'string' ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
  const to = typeof req.query.to === 'string' ? new Date(`${req.query.to}T23:59:59.999Z`) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return res.status(400).json({ error: 'Use valid from and to dates in YYYY-MM-DD format.' });
  }
  if (database && (from || to)) {
    const result = await database.query<{ total_page_views: string; unique_visitors: string }>(
      `SELECT COUNT(*)::text AS total_page_views, COUNT(DISTINCT visitor_id)::text AS unique_visitors
       FROM visitor_events
       WHERE ($1::timestamptz IS NULL OR viewed_at >= $1)
         AND ($2::timestamptz IS NULL OR viewed_at <= $2)`,
      [from?.toISOString() || null, to?.toISOString() || null],
    );
    const sourceRows = await database.query<{ source: string; page_views: string }>(
      `SELECT source, COUNT(*)::text AS page_views FROM visitor_events
       WHERE ($1::timestamptz IS NULL OR viewed_at >= $1) AND ($2::timestamptz IS NULL OR viewed_at <= $2)
       GROUP BY source ORDER BY COUNT(*) DESC`,
      [from?.toISOString() || null, to?.toISOString() || null],
    );
    return res.json({
      totalPageViews: Number(result.rows[0]?.total_page_views || 0),
      uniqueVisitors: Number(result.rows[0]?.unique_visitors || 0),
      sources: sourceRows.rows.map((row) => ({ source: row.source, pageViews: Number(row.page_views) })),
      locations: [],
      filtered: true,
    });

    app.get('/api/admin/export', requireOwnerAdmin, async (_req, res) => {
      const offers = liveOffersStore;
      const subscribers = database
        ? (await database.query('SELECT id, email, subscribed_at, frequency, verified, unsubscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC')).rows
        : subscribersStore;
      res.setHeader('Content-Disposition', `attachment; filename="s4fc-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.json({ exportedAt: new Date().toISOString(), offers, subscribers, siteSettings: DEFAULT_SITE_SETTINGS, analytics: analyticsStore });
    });

    app.get('/api/admin/newsletter/metrics', requireAdmin, async (_req, res) => {
      if (!database) {
        return res.json({ pending: subscribersStore.length, verified: subscribersStore.length, unsubscribed: 0, recent: subscribersStore.slice(0, 10) });
      }
      const result = await database.query(`
        SELECT
          COUNT(*) FILTER (WHERE verified = FALSE AND unsubscribed_at IS NULL)::int AS pending,
          COUNT(*) FILTER (WHERE verified = TRUE AND unsubscribed_at IS NULL)::int AS verified,
          COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed,
          COUNT(*) FILTER (WHERE subscribed_at >= NOW() - INTERVAL '7 days')::int AS recent
        FROM newsletter_subscribers
      `);
      return res.json(result.rows[0] || { pending: 0, verified: 0, unsubscribed: 0, recent: 0 });
    });

    app.get('/api/admin/link-health', requireOwnerAdmin, async (_req, res) => {
      const results = await Promise.all(liveOffersStore.map(async (offer) => {
        try {
          const response = await fetch(offer.referralUrl || offer.officialMerchantUrl, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
          return { offerId: offer.id, company: offer.company, status: response.status, healthy: response.status >= 200 && response.status < 400 };
        } catch (error) {
          return { offerId: offer.id, company: offer.company, status: 0, healthy: false, error: error instanceof Error ? error.message : 'Request failed' };
        }
      }));
      return res.json({ checkedAt: new Date().toISOString(), results });
    });
  }
  const sources = [...visitorAnalyticsStore.sources.entries()]
    .map(([source, pageViews]) => ({ source, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews);
  return res.json({
    totalPageViews: visitorAnalyticsStore.totalPageViews,
    uniqueVisitors: visitorAnalyticsStore.uniqueVisitors.size,
    sources,
    locations: [...visitorAnalyticsStore.locations.values()]
      .map(({ country, region, pageViews, visitors }) => ({
        country,
        region,
        pageViews,
        uniqueVisitors: visitors.size,
      }))
      .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors || b.pageViews - a.pageViews),
    filtered: false,
  });
});

// Owner-only exposure report. Delegated admins can view visitor analytics, but
// offer placement performance is restricted because it informs monetization.
app.get(['/api/admin/analytics/exposure', '/api/admin/analytics/exposures'], requireOwnerAdmin, async (_req, res) => {
  try {
    if (database) {
      const impressionRows = await database.query<{
        offer_id: string;
        impressions: string;
      }>('SELECT offer_id, COUNT(*)::text AS impressions FROM offer_impressions GROUP BY offer_id');
      const positionRows = await database.query<{
        position: number;
        impressions: string;
      }>('SELECT position, COUNT(*)::text AS impressions FROM offer_impressions GROUP BY position ORDER BY position');
      const impressionsByOffer = new Map(impressionRows.rows.map((row) => [row.offer_id, Number(row.impressions)]));
      const offers = liveOffersStore.map((offer) => {
        const impressions = impressionsByOffer.get(offer.id) || 0;
        const clicks = Number(offer.clicksCount) || 0;
        const conversions = Number(offer.conversionsCount) || 0;
        return {
          offerId: offer.id,
          company: offer.company,
          title: offer.title,
          impressions,
          clicks,
          conversions,
          ctr: impressions ? Number((clicks / impressions * 100).toFixed(2)) : 0,
        };
      });
      const totalImpressions = offers.reduce((sum, offer) => sum + offer.impressions, 0);
      return res.json({
        totalImpressions,
        totalClicks: analyticsStore.totalClicks,
        totalConversions: analyticsStore.totalConversions,
        ctr: totalImpressions ? Number((analyticsStore.totalClicks / totalImpressions * 100).toFixed(2)) : 0,
        offers,
        positions: positionRows.rows.map((row) => ({ position: Number(row.position), impressions: Number(row.impressions) })),
      });
    }

    const impressionsByOffer = new Map<string, number>();
    const impressionsByPosition = new Map<number, number>();
    offerImpressionsStore.forEach(({ offerId, position }) => {
      impressionsByOffer.set(offerId, (impressionsByOffer.get(offerId) || 0) + 1);
      impressionsByPosition.set(position, (impressionsByPosition.get(position) || 0) + 1);
    });
    const offers = liveOffersStore.map((offer) => {
      const impressions = impressionsByOffer.get(offer.id) || 0;
      const clicks = Number(offer.clicksCount) || 0;
      const conversions = Number(offer.conversionsCount) || 0;
      return {
        offerId: offer.id,
        company: offer.company,
        title: offer.title,
        impressions,
        clicks,
        conversions,
        ctr: impressions ? Number((clicks / impressions * 100).toFixed(2)) : 0,
      };
    });
    const totalImpressions = offerImpressionsStore.length;
    return res.json({
      totalImpressions,
      totalClicks: analyticsStore.totalClicks,
      totalConversions: analyticsStore.totalConversions,
      ctr: totalImpressions ? Number((analyticsStore.totalClicks / totalImpressions * 100).toFixed(2)) : 0,
      offers,
      positions: [...impressionsByPosition.entries()]
        .sort(([a], [b]) => a - b)
        .map(([position, impressions]) => ({ position, impressions })),
    });
  } catch (error) {
    console.error('Could not generate offer exposure report:', error);
    return res.status(500).json({ error: 'Could not generate offer exposure report.' });
  }
});

app.post('/api/admin/analytics/report', requireAdmin, async (_req, res) => {
  const checkedAt = new Date();
  if (database) {
    try {
      const checkpointResult = await database.query<{
        checked_at: Date;
        total_clicks: number;
        total_conversions: number;
        total_page_views: number;
      }>('SELECT checked_at, total_clicks, total_conversions, total_page_views FROM analytics_report_checkpoints WHERE id = 1');
      const previous = checkpointResult.rows[0];
      const since = previous?.checked_at || null;
      const pageviewResult = await database.query<{ total_page_views: string; unique_visitors: string }>(
        `SELECT COUNT(*)::text AS total_page_views, COUNT(DISTINCT visitor_id)::text AS unique_visitors
         FROM visitor_events
         WHERE ($1::timestamptz IS NULL OR viewed_at > $1) AND viewed_at <= $2`,
        [since, checkedAt.toISOString()],
      );
      const sourceRows = await database.query<{ source: string; page_views: string }>(
        `SELECT source, COUNT(*)::text AS page_views
         FROM visitor_events
         WHERE ($1::timestamptz IS NULL OR viewed_at > $1) AND viewed_at <= $2
         GROUP BY source ORDER BY COUNT(*) DESC`,
        [since, checkedAt.toISOString()],
      );
      const currentPageViews = previous
        ? previous.total_page_views + Number(pageviewResult.rows[0]?.total_page_views || 0)
        : Number(pageviewResult.rows[0]?.total_page_views || 0);
      await database.query(
        `INSERT INTO analytics_report_checkpoints (id, checked_at, total_clicks, total_conversions, total_page_views)
         VALUES (1, $1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET checked_at = EXCLUDED.checked_at,
           total_clicks = EXCLUDED.total_clicks, total_conversions = EXCLUDED.total_conversions,
           total_page_views = EXCLUDED.total_page_views`,
        [checkedAt.toISOString(), analyticsStore.totalClicks, analyticsStore.totalConversions, currentPageViews],
      );
      return res.json({
        checkedAt: checkedAt.toISOString(),
        previousCheckedAt: previous?.checked_at?.toISOString() || null,
        new: {
          clicks: Math.max(0, analyticsStore.totalClicks - Number(previous?.total_clicks || 0)),
          conversions: Math.max(0, analyticsStore.totalConversions - Number(previous?.total_conversions || 0)),
          pageViews: Number(pageviewResult.rows[0]?.total_page_views || 0),
          uniqueVisitors: Number(pageviewResult.rows[0]?.unique_visitors || 0),
        },
        totals: {
          clicks: analyticsStore.totalClicks,
          conversions: analyticsStore.totalConversions,
          pageViews: currentPageViews,
        },
        sources: sourceRows.rows.map((row) => ({ source: row.source, pageViews: Number(row.page_views) })),
      });
    } catch (error) {
      console.error('Could not generate analytics report:', error);
      return res.status(500).json({ error: 'Could not generate analytics report.' });
    }
  }

  const previous = analyticsReportCheckpoint;
  const currentPageViews = visitorAnalyticsStore.totalPageViews;
  const report = {
    checkedAt: checkedAt.toISOString(),
    previousCheckedAt: previous?.checkedAt || null,
    new: {
      clicks: Math.max(0, analyticsStore.totalClicks - (previous?.totalClicks || 0)),
      conversions: Math.max(0, analyticsStore.totalConversions - (previous?.totalConversions || 0)),
      pageViews: Math.max(0, currentPageViews - (previous?.totalPageViews || 0)),
      uniqueVisitors: [...visitorAnalyticsStore.uniqueVisitors].filter((id) => !previous?.uniqueVisitors.has(id)).length,
    },
    totals: {
      clicks: analyticsStore.totalClicks,
      conversions: analyticsStore.totalConversions,
      pageViews: currentPageViews,
    },
    sources: [...visitorAnalyticsStore.sources.entries()]
      .map(([source, pageViews]) => ({ source, pageViews }))
      .sort((a, b) => b.pageViews - a.pageViews),
  };
  analyticsReportCheckpoint = {
    checkedAt: report.checkedAt,
    totalClicks: report.totals.clicks,
    totalConversions: report.totals.conversions,
    totalPageViews: report.totals.pageViews,
    uniqueVisitors: new Set(visitorAnalyticsStore.uniqueVisitors),
  };
  return res.json(report);
});

app.post('/api/admin/analytics/reset', requireOwnerAdmin, async (_req, res) => {
  analyticsStore = { totalClicks: 0, totalConversions: 0 };
  analyticsReportCheckpoint = null;
  offerImpressionsStore.length = 0;
  visitorAnalyticsStore = {
    totalPageViews: 0,
    uniqueVisitors: new Set<string>(),
    sources: new Map<string, number>(),
    locations: new Map<string, { country: string; region: string; pageViews: number; visitors: Set<string> }>(),
  };
  liveOffersStore = liveOffersStore.map((offer) => ({
    ...offer,
    clicksCount: 0,
    conversionsCount: 0,
  }));

  if (database) {
    try {
      await database.query('BEGIN');
      await database.query('UPDATE analytics_counters SET total_clicks = 0, total_conversions = 0 WHERE id = 1');
      await database.query('DELETE FROM visitor_events');
      await database.query('DELETE FROM offer_impressions');
      await database.query('DELETE FROM analytics_report_checkpoints');
      await database.query('COMMIT');
      await saveLiveOffers();
    } catch (error) {
      await database.query('ROLLBACK').catch(() => undefined);
      console.error('Could not reset analytics:', error);
      return res.status(500).json({ error: 'Could not reset analytics.' });
    }
  }

  await auditAdminAction(_req, 'analytics_reset');
  return res.json({ success: true });
});

app.post('/api/admin/newsletter/broadcast', requireAdmin, async (req, res) => {
  const { offerId } = req.body || {};
  const offer = liveOffersStore.find((candidate) => candidate.id === offerId);
  if (!offer) return res.status(404).json({ error: 'Offer not found.' });
  if (!database) return res.status(503).json({ error: 'Newsletter delivery requires a configured database.' });
  const subscribers = await database.query<{ email: string }>(
    'SELECT email FROM newsletter_subscribers WHERE verified = TRUE AND unsubscribed_at IS NULL',
  );
  if (!subscribers.rows.length) return res.json({ delivered: 0, recipientCount: 0 });
  const secret = env.NEWSLETTER_UNSUBSCRIBE_SECRET || env.ADMIN_PASSCODE || '';
  if (!secret) return res.status(503).json({ error: 'Newsletter unsubscribe signing is not configured.' });
  try {
    await Promise.all(subscribers.rows.map(({ email }) => {
      const signature = createHmac('sha256', secret).update(email).digest('hex');
      const unsubscribeUrl = `${getRequestAppUrl(req)}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&sig=${signature}`;
      return sendTransactionalEmail(
        email,
        `New offer listed: ${offer.incentiveAmount} on ${offer.company}`,
        newsletterEmailLayout(
          `<div style="display:inline-block;padding:6px 10px;border:1px solid rgba(52,211,153,.35);border-radius:999px;color:#86efac;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New offer drop</div>
           <h1 style="margin:18px 0 10px;color:#fff;font-size:28px;line-height:1.2;">${offer.company}</h1>
           <p style="margin:0 0 22px;color:#cbd5e1;font-size:16px;line-height:1.5;">${offer.title}</p>
           <div style="padding:16px;border:1px solid rgba(45,212,238,.2);border-radius:12px;background:rgba(45,212,238,.06);">
             <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Advertised reward</div>
             <div style="margin-top:6px;color:#67e8f9;font-size:24px;font-weight:700;">${offer.incentiveAmount}</div>
           </div>
           <p style="margin:22px 0;color:#cbd5e1;font-size:14px;line-height:1.6;">Review the current requirements and merchant terms before applying.</p>
           ${emailButton(offer.referralUrl, 'Review this offer')}
           <p style="margin:24px 0 0;font-size:11px;"><a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe from offer alerts</a></p>`,
          'You are receiving this because you confirmed email alerts from Signups4FastCash.com. Offers and terms can change.',
        ),
      );
    }));
    await auditAdminAction(req, 'newsletter_broadcast', { offerId: offer.id, recipientCount: subscribers.rows.length });
    return res.json({ delivered: subscribers.rows.length, recipientCount: subscribers.rows.length, status: 'delivered' });
  } catch (error) {
    console.error('Newsletter broadcast failed:', error);
    await auditAdminAction(req, 'newsletter_broadcast_failed', { offerId: offer.id, recipientCount: subscribers.rows.length });
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Newsletter delivery failed.' });
  }
});

app.post('/api/newsletter/provider-webhook', async (req, res) => {
  const webhookSecret = env.NEWSLETTER_WEBHOOK_SECRET?.trim();
  const suppliedSecret = req.header('x-newsletter-webhook-secret')?.trim();
  if (!webhookSecret || !suppliedSecret || suppliedSecret !== webhookSecret) {
    return res.status(401).json({ error: 'Webhook authentication failed.' });
  }
  const event = req.body as {
    type?: string;
    data?: { to?: string[] | string };
  };
  const shouldSuppress = event.type === 'email.bounced' || event.type === 'email.complained';
  if (!shouldSuppress || !database) return res.json({ processed: false });
  const recipients = Array.isArray(event.data?.to) ? event.data.to : [event.data?.to];
  const emails = recipients
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (emails.length > 0) {
    await database.query(
      'UPDATE newsletter_subscribers SET unsubscribed_at = NOW(), verified = FALSE WHERE LOWER(email) = ANY($1::text[])',
      [emails],
    );
  }
  return res.json({ processed: true, suppressed: emails.length });
});

// API: Newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  const { email, frequency } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const subscriberFrequency = frequency === 'daily' || frequency === 'weekly' ? frequency : 'instant';
  const confirmationToken = randomBytes(32).toString('hex');
  const confirmationUrl = `${getRequestAppUrl(req)}/api/newsletter/confirm?token=${confirmationToken}`;
  if (database) {
    try {
      await database.query(
        `INSERT INTO newsletter_subscribers (id, email, subscribed_at, frequency, confirmation_token, verified, unsubscribed_at)
         VALUES ($1, $2, NOW(), $3, $4, FALSE, NULL)
         ON CONFLICT (email) DO UPDATE SET frequency = EXCLUDED.frequency, confirmation_token = EXCLUDED.confirmation_token,
           verified = CASE WHEN newsletter_subscribers.verified AND newsletter_subscribers.unsubscribed_at IS NULL THEN TRUE ELSE FALSE END,
           unsubscribed_at = NULL`,
        [randomUUID(), normalizedEmail, subscriberFrequency, confirmationToken],
      );
      await sendTransactionalEmail(
        normalizedEmail,
        'Confirm your Signups4FastCash.com alerts',
        newsletterEmailLayout(
          `<div style="display:inline-block;padding:6px 10px;border:1px solid rgba(45,212,238,.35);border-radius:999px;color:#67e8f9;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Email alerts</div>
           <h1 style="margin:18px 0 12px;color:#fff;font-size:28px;line-height:1.2;">Confirm your subscription</h1>
           <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">You selected <strong style="color:#fff;">${subscriberFrequency}</strong> offer alerts. Confirm your email to start receiving carefully explained rewards and cashback opportunities.</p>
           ${emailButton(confirmationUrl, 'Confirm subscription')}
           <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5;">If you did not request these alerts, you can safely ignore this email.</p>`,
          'You can unsubscribe from any alert in one click. We do not sell subscriber addresses.',
        ),
      );
      const count = await database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM newsletter_subscribers WHERE verified = TRUE AND unsubscribed_at IS NULL');
      return res.json({ success: true, pendingConfirmation: true, subscriberCount: Number(count.rows[0]?.count || 0) });
    } catch (error) {
      console.error('Could not subscribe:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Could not subscribe at this time' });
    }
  }
  return res.status(503).json({ error: 'Newsletter delivery is not configured yet.' });
});

app.post('/api/telemetry/error', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 500) : '';
  if (!message) return res.status(400).json({ error: 'Error message is required.' });
  console.error('[frontend-error]', { message, path: req.body?.path, userAgent: req.get('user-agent') });
  return res.status(204).end();
});

app.get('/api/newsletter/confirm', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token || !database) return res.status(400).send('This confirmation link is invalid or expired.');
  const appUrl = getRequestAppUrl(req);
  const result = await database.query(
    `UPDATE newsletter_subscribers SET verified = TRUE, confirmation_token = NULL
     WHERE confirmation_token = $1 AND unsubscribed_at IS NULL RETURNING email`,
    [token],
  );
  if (!result.rowCount) return res.status(400).send('This confirmation link is invalid or expired.');
  const confirmedEmail = result.rows[0]?.email;
  if (confirmedEmail) {
    try {
      await sendTransactionalEmail(
        confirmedEmail,
        'You are subscribed to Signups4FastCash.com alerts',
        newsletterEmailLayout(
          `<div style="text-align:center;">
             <div style="display:inline-block;padding:6px 10px;border:1px solid rgba(134,239,172,.35);border-radius:999px;color:#86efac;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">You are in</div>
             <h1 style="margin:18px 0 12px;color:#fff;font-size:28px;line-height:1.2;">Your alerts are active</h1>
             <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">We’ll send new offer drops according to the frequency you selected. Each alert links back to the official provider and keeps the requirements visible before you click.</p>
             <a href="${appUrl}/" style="display:inline-block;margin-top:24px;background:#67e8f9;color:#06131a;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:8px;">Browse current offers</a>
           </div>`,
          'You can unsubscribe from any alert in one click. We do not sell subscriber addresses.',
        ),
      );
    } catch (error) {
      console.error('Newsletter welcome email failed:', error);
    }
  }
  res.type('html').send(newsletterEmailLayout(
    `<div style="text-align:center;"><div style="font-size:40px;color:#86efac;">✓</div><h1 style="margin:12px 0;color:#fff;">Email alerts confirmed</h1><p style="color:#cbd5e1;font-size:15px;line-height:1.6;">You are now subscribed to Signups4FastCash.com alerts.</p><a href="${appUrl}/" style="display:inline-block;margin-top:10px;color:#67e8f9;font-weight:700;">Return to the offers</a></div>`,
  ));
});

app.get('/api/newsletter/unsubscribe', async (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const signature = typeof req.query.sig === 'string' ? req.query.sig : '';
  const secret = env.NEWSLETTER_UNSUBSCRIBE_SECRET || env.ADMIN_PASSCODE || '';
  const expected = secret && email ? createHmac('sha256', secret).update(email).digest('hex') : '';
  const signaturesMatch = signature.length === expected.length
    && signature.length > 0
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!email || !signaturesMatch || !database) {
    return res.status(400).send('This unsubscribe link is invalid.');
  }
  const appUrl = getRequestAppUrl(req);
  await database.query('UPDATE newsletter_subscribers SET unsubscribed_at = NOW(), verified = FALSE WHERE email = $1', [email]);
  res.type('html').send(newsletterEmailLayout(
    `<div style="text-align:center;"><h1 style="margin:0 0 12px;color:#fff;">You are unsubscribed</h1><p style="color:#cbd5e1;font-size:15px;line-height:1.6;">You will not receive further alerts from this list.</p><a href="${appUrl}/" style="display:inline-block;margin-top:10px;color:#67e8f9;font-weight:700;">Return to the offers</a></div>`,
  ));
});

// API: Newsletter subscriber count
app.get('/api/newsletter/subscribers', async (req, res) => {
  if (!database) {
    return res.json({ count: subscribersStore.filter((subscriber) => subscriber.verified).length });
  }
  try {
    const count = await database.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM newsletter_subscribers WHERE verified = TRUE AND unsubscribed_at IS NULL',
    );
    const response: { count: number; subscribers?: typeof subscribersStore } = { count: Number(count.rows[0]?.count || 0) };
    if (hasValidAdminToken(req.header('x-admin-token'))) {
      const subscribers = await database.query<{ id: string; email: string; subscribed_at: Date; frequency: string; verified: boolean }>(
        'SELECT id, email, subscribed_at, frequency, verified FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY subscribed_at DESC',
      );
      response.subscribers = subscribers.rows.map((subscriber) => ({
        id: subscriber.id,
        email: subscriber.email,
        subscribedAt: new Date(subscriber.subscribed_at).toISOString(),
        frequency: subscriber.frequency,
        verified: subscriber.verified,
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

export { app, isVerificationCurrent };

if (env.NODE_ENV !== 'test') {
  initializeOfferStore()
    .then(startServer)
    .catch((error) => {
      console.error('Failed to initialize offer store:', error);
      process.exit(1);
    });
}
