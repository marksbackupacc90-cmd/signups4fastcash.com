import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import path from 'path';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { createServer as createHttpServer, type IncomingMessage } from 'node:http';
import { isIP } from 'net';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { compare as comparePassword, hash as hashPassword } from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';
import { WebSocket, WebSocketServer } from 'ws';
import { SITE_OFFER_CATALOG as PUBLIC_OFFERS } from './src/data/offerCatalog';
import { DEFAULT_SITE_SETTINGS, Offer, OfferCampaign, OfferCategory, OfferMilestone, SiteSettings } from './src/types';
import { decryptProviderCredential, encryptProviderCredential } from './src/providerCredentialCrypto';
import { createOffersRouter } from './offers.js';

export { decryptProviderCredential, encryptProviderCredential } from './src/providerCredentialCrypto';

dotenv.config({ path: '.env.local' });

const app = express();
const env = process.env as unknown as Record<string, string | undefined>;
const PORT = Number(env.PORT || 3000);
const databaseUrl = env.DATABASE_URL;
const database = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }) : null;
const providerCredentialEncryptionSecret = env.PROVIDER_CREDENTIALS_ENCRYPTION_KEY?.trim() || env.ADMIN_PASSCODE?.trim() || '';
const referralHashSecret = env.REFERRAL_HASH_SECRET || env.GOOGLE_CLIENT_SECRET;
const MEMBER_REFERRALS_ENABLED = true;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9_-]{1,22}[A-Z0-9])$/;
const REFERRAL_MIN_NET_REVENUE = 10;
const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AUTH_USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const AUTH_PASSWORD_MIN_LENGTH = 12;
const AUTH_PASSWORD_MAX_BYTES = 72;
const DUMMY_PASSWORD_HASH = '$2b$12$97DZEvxYA7xIfIXOZWSupOWT8ymgLKculOOCpkPsxWFcLDr609yk6';
const cpxAppId = env.CPX_APP_ID || '36089';
const cpxSecureHash = env.CPX_SECURE_HASH;
const milestoneCallbackSecret = env.MILESTONE_CALLBACK_SECRET;
const postbackSecret = env.POSTBACK_SECRET?.trim();
const referralCommissionPercent = (() => {
  const configured = Number(env.REFERRAL_COMMISSION_PERCENT || 10);
  return Number.isFinite(configured) && configured >= 0 && configured <= 100 ? configured : 10;
})();
const offerHousePayoutMultiplier = (() => {
  const configured = Number(env.OFFER_HOUSE_PAYOUT_MULTIPLIER || 0.85);
  return Number.isFinite(configured) && configured > 0 && configured <= 1 ? configured : 0.85;
})();
const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;
const ownerEmails = new Set(
  [env.OWNER_EMAIL || 'winters.mark1990@gmail.com', env.OWNER_EMAIL_ALIASES || '', 'gamingbiz777@gmail.com']
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function requireMemberReferralsEnabled(_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!MEMBER_REFERRALS_ENABLED) {
    return res.status(410).json({ error: 'The member referral program is temporarily paused.' });
  }
  return next();
}

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
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <style>
      :root { color-scheme: dark; }
      @font-face {
        font-family: "Glory";
        src: url("https://signups4fastcash.com/fonts/Glory-Variable.ttf") format("truetype");
        font-weight: 100 900;
        font-style: normal;
        font-display: swap;
      }
      body, table, td, div, p, h1, h2, h3, a, button {
        font-family: "Glory", sans-serif !important;
      }
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 16px 8px !important; }
        .email-content { padding: 24px 20px !important; }
        .email-header, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#04080d;color:#e5e7eb;font-family:'Glory',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#04080d" style="width:100%;border-collapse:collapse;background-color:#04080d;">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1724" style="width:100%;max-width:600px;border-collapse:separate;border:1px solid #173143;border-radius:16px;background-color:#0d1724;overflow:hidden;">
            <tr>
              <td class="email-header" bgcolor="#090d18" style="padding:22px 28px;border-bottom:1px solid #243244;background-color:#090d18;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle" bgcolor="#2dd4ee" style="width:40px;height:40px;border:2px solid #2dd4ee;border-radius:12px;background-color:#2dd4ee;color:#071016;text-align:center;vertical-align:middle;font-size:11px;font-weight:900;letter-spacing:-.5px;">S4FC</td>
                    <td valign="middle" style="padding-left:12px;vertical-align:middle;">
                      <div style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-.2px;">Signups4FastCash.com</div>
                      <div style="margin-top:3px;color:#2dd4ee;font-size:11px;">Rewards and cashback with clear terms</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:30px 28px;color:#e5e7eb;font-family:'Glory',sans-serif;">
                <div class="email-typography" style="font-family:'Glory',sans-serif !important;">${content}</div>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:18px 28px;border-top:1px solid #243244;color:#64748b;font-size:11px;line-height:1.6;">
                ${footer || 'Independent offer comparisons. Merchant terms and availability can change.'}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeEmailHtml(value: string) {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] || character);
}

function emailButton(url: string, label: string) {
  return `<a href="${escapeEmailHtml(url)}" style="display:inline-block;background:#2dd4ee;color:#04080d;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:8px;">${escapeEmailHtml(label)}</a>`;
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
const authUsers = new Map<string, { id: string; googleSub: string | null; email: string; username: string | null; avatarUrl: string | null; paypalEmail: string | null; dateOfBirth: string | null; sex: string | null; state: string | null; accountStatus: 'active' | 'blocked'; lastLoginAt: string | null }>();
const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const blockedIpCache = new Map<string, number>();
const memoryDeviceOwners = new Map<string, string>();
export type LiveActivityEvent = {
  id: string;
  type: 'offer_credit' | 'withdrawal' | 'mock';
  handle: string;
  amount: number;
  amountText: string;
  method: string;
  tag: string;
  timestamp: string;
};

export type PlatformNotification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: 'CREDIT_ALERT' | 'PVP_ALERT' | 'SYSTEM';
  created_at: string;
};

export type LiveOfferCredit = {
  id: string;
  username: string;
  offerwall: string;
  offer: string;
  payoutAmount: number;
  creditedAt: string;
};

let liveActivitySocketServer: WebSocketServer | null = null;
let notificationSocketServer: WebSocketServer | null = null;
const notificationSocketsByUser = new Map<string, Set<WebSocket>>();
const liveOfferCreditsMemory = new Map<string, LiveOfferCredit>();
let lastLiveTransactionAt = 0;
const cpxTransactions = new Map<string, { status: number; rewardPoints: number; userId: string }>();
const cpxBalances = new Map<string, number>();
const completionReports = new Map<string, { id: string; offerId: string; reportedAt: string }>();
const analyticsSecurityFailures = new Map<string, { signatureMismatch: number; chargebacks: number; securityFailures: number }>();
const SURVEY_POINTS_PER_DOLLAR = 100;
const SURVEY_MINIMUM_PAYOUT_POINTS = 500;
const RPS_DEFAULT_ENTRY_CENTS = 50;
const RPS_WIN_POT_CENTS = 100;
const RPS_PVP_MIN_WAGER_UNITS = 50;
const RPS_PVP_RAKE_RATE_BPS = 300;
const RPS_ACTIVE_MATCH_TIMEOUT_MINUTES = 5;
const RPS_WAITING_LOBBY_TIMEOUT_HOURS = 24;
const RPS_MAX_CASH_BALANCE_CENTS = 999_999_999_999;
const RPS_MAX_POINTS_BALANCE = 2_147_483_647;
const RPS_OPPONENT_NAME_PARTS = ['NeonFox', 'PixelPanda', 'LuckyLynx', 'MoonMoth', 'TurboTiger', 'CosmicKoala'];
const RPS_CHOICES = ['rock', 'paper', 'scissors'] as const;
type RpsChoice = typeof RPS_CHOICES[number];
type RpsOutcome = 'win' | 'loss' | 'draw';
type RpsWagerCurrency = 'points' | 'cash';
type RpsWager = { currency: RpsWagerCurrency; amount: number; units: number };
type RpsLobbyRow = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  wager_amount: string;
  wager_currency: RpsWagerCurrency;
  state: 'waiting' | 'active' | 'completed';
  ended_reason: 'settled' | 'expired' | null;
  created_at: Date;
};
type RpsSettlement = {
  matchId: string;
  outcome: 'player1' | 'player2' | 'draw';
  winnerId: string | null;
  poolUnits: number;
  rakeUnits: number;
  notifications: Array<{ userId: string; notification: PlatformNotification }>;
};
const EARNX_MILESTONE_TIERS = [
  { stage: 1, level: 5, rewardPoints: 200, description: 'Reach level 5' },
  { stage: 2, level: 10, rewardPoints: 750, description: 'Reach level 10' },
  { stage: 3, level: 20, rewardPoints: 2500, description: 'Reach level 20' },
] as const;
const SURVEY_PAYOUT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WITHDRAWAL_MINIMUM_CENTS = 500;
const LEADERBOARD_PRIZE_POOL_CENTS = 5000;
const LEADERBOARD_PRIZE_CENTS_BY_RANK = [1500, 1000, 700, 500, 300, 200, 200, 200, 200, 200];
const delegatedAdminUsernames = new Set<string>();
const permanentlyRemovedOfferIds = new Set([
  'offer-era-referral',
  'candidate-pnc-virtual-wallet-400',
  'candidate-wells-fargo-everyday-checking-325',
]);
const temporarilyHiddenOfferIds = new Set(['offer-acebet']);
const temporarilyHiddenOfferTerms = ['triumph', 'polymarket', 'acebet', 'debbie'];

function isTemporarilyHiddenOffer(offer: { id?: string; company?: string; title?: string; verificationStatus?: string }) {
  const searchable = `${offer.company || ''} ${offer.title || ''}`.toLowerCase();
  const isExplicitlyUnverifiedDebbieListing = offer.id === 'candidate-debbie-referral'
    && offer.verificationStatus === 'unverified';
  return permanentlyRemovedOfferIds.has(offer.id || '')
    || temporarilyHiddenOfferIds.has(offer.id || '')
    || (!isExplicitlyUnverifiedDebbieListing && temporarilyHiddenOfferTerms.some((term) => searchable.includes(term)));
}

function mergeCatalogOffer(catalogOffer: Offer, existingOffer?: Partial<Offer>) {
  const existingUpdatedAt = Date.parse(existingOffer?.updatedAt || '');
  const catalogUpdatedAt = Date.parse(catalogOffer.updatedAt);
  const refreshCatalogTerms = ['offer-joko', 'offer-kalshi', 'candidate-ero-app-referral', 'candidate-measure-protocol-msr-referral', 'offer-verb', 'offer-revolut', 'offer-coinbase', 'offer-inter-loop-points'].includes(catalogOffer.id)
    && Number.isFinite(catalogUpdatedAt)
    && (!Number.isFinite(existingUpdatedAt) || catalogUpdatedAt > existingUpdatedAt);

  return {
    ...catalogOffer,
    ...(existingOffer || {}),
    ...(refreshCatalogTerms ? {
      title: catalogOffer.title,
      incentiveAmount: catalogOffer.incentiveAmount,
      incentiveValue: catalogOffer.incentiveValue,
      payoutSpeed: catalogOffer.payoutSpeed,
      difficulty: catalogOffer.difficulty,
      depositRequired: catalogOffer.depositRequired,
      availability: catalogOffer.availability,
      referralUrl: catalogOffer.referralUrl,
      verifiedAt: catalogOffer.verifiedAt,
      verificationExpiresAt: catalogOffer.verificationExpiresAt,
      verificationStatus: catalogOffer.verificationStatus,
      honestTruth: catalogOffer.honestTruth,
      speedrunHints: catalogOffer.speedrunHints,
      updatedAt: catalogOffer.updatedAt,
      ...(catalogOffer.id === 'candidate-ero-app-referral' || catalogOffer.id === 'candidate-measure-protocol-msr-referral'
        ? { status: catalogOffer.status, featured: catalogOffer.featured }
        : {}),
    } : {}),
    clicksCount: Number.isFinite(Number(existingOffer?.clicksCount)) ? Number(existingOffer?.clicksCount) : 0,
    conversionsCount: Number.isFinite(Number(existingOffer?.conversionsCount)) ? Number(existingOffer?.conversionsCount) : 0,
  };
}

function applyCoinsBackTerms<T extends Record<string, any>>(offer: T): T {
  if (!`${offer.company || ''} ${offer.title || ''}`.toLowerCase().includes('coinsback')) return offer;
  return {
    ...offer,
    title: 'CoinsBack Casino: Reported $2 welcome coin pack and spin rewards',
    incentiveAmount: 'Reported $2 welcome coin pack; confirm spin reward terms',
    incentiveValue: 2,
    payoutSpeed: 'Confirm reward and redemption timing with CoinsBack',
    depositRequired: '$0 purchase listed for welcome pack; verify current terms',
    availability: 'Verify current country and state eligibility',
    verificationStatus: 'unverified',
    verifiedAt: undefined,
    verificationExpiresAt: undefined,
    honestTruth: {
      summary: 'An existing listing reports a $2 welcome coin pack after account verification and a spin reward. These details have not been independently confirmed.',
      theCatch: 'The reported coin pack and spin reward may be subject to account, age, location, playthrough, and redemption rules. Virtual coins may not be cash. Confirm the current terms before creating an account or playing.',
      minimumHoldTime: 'Not confirmed; check the provider’s current playthrough and redemption rules.',
      idVerificationRequired: true,
      hiddenFeesWarning: 'Do not assume virtual coins can be redeemed for cash. Check purchase requirements, playthrough, minimum redemption, and fees; do not spend money to pursue a reported reward.',
      trustScore: 95,
    },
    speedrunHints: [
      { step: 1, instruction: 'Review the current CoinsBack Casino promotion, eligibility, and sweepstakes rules before signing up.', proTip: 'The reward details listed here have not been independently confirmed.' },
      { step: 2, instruction: 'Confirm whether the coin pack is cash-redeemable and whether any playthrough or purchase is required.', proTip: 'Do not deposit or play solely to pursue a reward.' },
      { step: 3, instruction: 'If you choose to participate, follow the provider’s current verification and redemption terms.', proTip: 'The provider controls eligibility and whether any reward is issued.' },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function resolveOfferVerificationUpdate(existingOffer: Partial<Offer>, updates: Partial<Offer>): Partial<Offer> {
  const reviewDate = typeof updates.verifiedAt === 'string' ? Date.parse(updates.verifiedAt) : NaN;
  const expiryDate = typeof updates.verificationExpiresAt === 'string' ? Date.parse(updates.verificationExpiresAt) : NaN;
  if (
    updates.verificationStatus === 'reviewed'
    && Number.isFinite(reviewDate)
    && Number.isFinite(expiryDate)
    && expiryDate > Date.now()
  ) {
    return {
      verificationStatus: 'reviewed',
      verifiedAt: updates.verifiedAt,
      verificationExpiresAt: updates.verificationExpiresAt,
    };
  }

  if (updates.verificationStatus === 'terms-vary') {
    return { verificationStatus: 'terms-vary', verifiedAt: undefined, verificationExpiresAt: undefined };
  }

  const termsFields: (keyof Offer)[] = [
    'title',
    'incentiveAmount',
    'payoutSpeed',
    'difficulty',
    'depositRequired',
    'availability',
    'officialMerchantUrl',
    'referralUrl',
    'referralCode',
    'honestTruth',
    'speedrunHints',
  ];
  const termsChanged = termsFields.some((field) => Object.prototype.hasOwnProperty.call(updates, field));
  if (updates.verificationStatus === 'unverified' || termsChanged) {
    return { verificationStatus: 'unverified', verifiedAt: undefined, verificationExpiresAt: undefined };
  }

  return {
    verificationStatus: existingOffer.verificationStatus,
    verifiedAt: existingOffer.verifiedAt,
    verificationExpiresAt: existingOffer.verificationExpiresAt,
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

type OfferCampaignValidation =
  | { campaign: OfferCampaign }
  | { error: string; field: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateOfferCampaign(input: unknown, id: string, createdAt: string, updatedAt: string): OfferCampaignValidation {
  if (!isRecord(input)) return { field: 'campaign', error: 'Campaign details are required.' };
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(id)) {
    return { field: 'id', error: 'Campaign ID must use lowercase letters, numbers, hyphens, or underscores.' };
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 160) return { field: 'title', error: 'Title must be 1-160 characters.' };
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description || description.length > 5000) return { field: 'description', error: 'Description must be 1-5000 characters.' };
  const category = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
  const allowedCategories = new Set(['fintech', 'brokerage', 'cashback', 'apps', 'crypto', 'gaming']);
  if (!allowedCategories.has(category)) return { field: 'category', error: 'Choose a supported campaign category.' };
  if (!Array.isArray(input.milestones) || input.milestones.length === 0) {
    return { field: 'milestones', error: 'Add at least one milestone.' };
  }

  const milestones: OfferMilestone[] = [];
  const stepNumbers = new Set<number>();
  const levels = new Set<number>();
  let totalPayoutCents = 0;
  for (const [index, rawMilestone] of input.milestones.entries()) {
    if (!isRecord(rawMilestone)) {
      return { field: 'milestones', error: `Milestone ${index + 1} must be an object.` };
    }
    const stepNumber = rawMilestone.step_number;
    const level = rawMilestone.level === undefined ? stepNumber : rawMilestone.level;
    const milestoneDescription = typeof rawMilestone.description === 'string' ? rawMilestone.description.trim() : '';
    const payoutAmount = rawMilestone.payout_amount;
    if (typeof stepNumber !== 'number' || !Number.isSafeInteger(stepNumber) || stepNumber < 1 || stepNumber > 2147483647) {
      return { field: 'milestones', error: `Milestone ${index + 1} needs a positive step_number.` };
    }
    if (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1 || level > 1000000) {
      return { field: 'milestones', error: `Milestone ${index + 1} needs a level from 1 to 1,000,000.` };
    }
    if (stepNumbers.has(stepNumber) || levels.has(level)) {
      return { field: 'milestones', error: 'Milestone step numbers and levels must be unique.' };
    }
    if (!milestoneDescription || milestoneDescription.length > 500) {
      return { field: 'milestones', error: `Milestone ${index + 1} description must be 1-500 characters.` };
    }
    if (typeof payoutAmount !== 'number' || !Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      return { field: 'milestones', error: `Milestone ${index + 1} payout_amount must be positive.` };
    }
    const payoutCents = Math.round(payoutAmount * 100);
    if (Math.abs(payoutAmount * 100 - payoutCents) > 1e-7 || payoutCents > 2147483647) {
      return { field: 'milestones', error: `Milestone ${index + 1} payout_amount must use cents and fit the wallet ledger.` };
    }
    totalPayoutCents += payoutCents;
    if (!Number.isSafeInteger(totalPayoutCents) || totalPayoutCents > 2147483647) {
      return { field: 'total_value', error: 'Combined campaign rewards exceed the wallet limit.' };
    }
    stepNumbers.add(stepNumber);
    levels.add(level);
    milestones.push({
      step_number: stepNumber,
      level,
      description: milestoneDescription,
      payout_amount: payoutCents / 100,
    });
  }
  milestones.sort((left, right) => left.step_number - right.step_number);

  const totalValue = input.total_value === undefined ? totalPayoutCents / 100 : input.total_value;
  if (typeof totalValue !== 'number' || !Number.isFinite(totalValue) || totalValue < 0) {
    return { field: 'total_value', error: 'total_value must be a non-negative amount in dollars.' };
  }
  const totalValueCents = Math.round(totalValue * 100);
  if (Math.abs(totalValue * 100 - totalValueCents) > 1e-7 || totalValueCents !== totalPayoutCents) {
    return { field: 'total_value', error: 'total_value must equal the sum of all milestone payouts.' };
  }

  const trackingParameters: Record<string, string> = {};
  if (input.tracking_parameters !== undefined) {
    if (!isRecord(input.tracking_parameters)) {
      return { field: 'tracking_parameters', error: 'tracking_parameters must be an object of text values.' };
    }
    for (const [key, value] of Object.entries(input.tracking_parameters)) {
      if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key) || typeof value !== 'string' || value.length > 500) {
        return { field: 'tracking_parameters', error: 'Tracking keys must be short identifiers with text values up to 500 characters.' };
      }
      trackingParameters[key] = value;
    }
  }

  return {
    campaign: {
      id,
      title,
      description,
      category: category as OfferCategory,
      total_value: totalValueCents / 100,
      milestones,
      tracking_parameters: trackingParameters,
      active: true,
      created_at: createdAt,
      updated_at: updatedAt,
    },
  };
}

async function persistOfferCampaign(campaign: OfferCampaign, create: boolean, replaceMilestones: boolean) {
  if (!database) throw new Error('Persistent campaign storage is not configured.');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    if (create) {
      await client.query(
        `INSERT INTO offer_campaigns
          (id, title, description, category, total_value, milestones, tracking_parameters, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
        [
          campaign.id,
          campaign.title,
          campaign.description,
          campaign.category,
          campaign.total_value,
          JSON.stringify(campaign.milestones),
          JSON.stringify(campaign.tracking_parameters),
          campaign.active,
          campaign.created_at,
          campaign.updated_at,
        ],
      );
    } else {
      const updated = await client.query(
        `UPDATE offer_campaigns
         SET title = $2, description = $3, category = $4, total_value = $5,
             milestones = $6::jsonb, tracking_parameters = $7::jsonb,
             active = $8, updated_at = $9
         WHERE id = $1`,
        [
          campaign.id,
          campaign.title,
          campaign.description,
          campaign.category,
          campaign.total_value,
          JSON.stringify(campaign.milestones),
          JSON.stringify(campaign.tracking_parameters),
          campaign.active,
          campaign.updated_at,
        ],
      );
      if (updated.rowCount !== 1) throw new Error('Offer campaign was not found.');
    }

    if (replaceMilestones) {
      await client.query('DELETE FROM offer_milestone_tiers WHERE offer_id = $1', [campaign.id]);
      for (const tier of campaign.milestones) {
        await client.query(
          `INSERT INTO offer_milestone_tiers (offer_id, stage, level, reward_points, description, active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            campaign.id,
            tier.step_number,
            tier.level,
            Math.round(tier.payout_amount * SURVEY_POINTS_PER_DOLLAR),
            tier.description,
            campaign.active,
          ],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function isVerificationCurrent(offer: { verificationExpiresAt?: string }) {
  return !offer.verificationExpiresAt || Date.parse(offer.verificationExpiresAt) > Date.now();
}

function isIndexableOfferLandingPage(offer: any) {
  const slug = typeof offer.companySlug === 'string'
    ? offer.companySlug.toLowerCase()
    : '';

  return (
    offer.status === 'live' &&
    isVerificationCurrent(offer) &&
    !isTemporarilyHiddenOffer(offer) &&
    (offer.verificationStatus === 'reviewed' || offer.verificationStatus === 'terms-vary') &&
    String(offer.category || '').toLowerCase() !== 'surveys' &&
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(slug)
  );
}

function escapeOfferHtml(value: unknown) {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value ?? '').replace(/[&<>"']/g, (character) => replacements[character]);
}

export function resolveUpdatedOfferStatus(existingStatus: string, requestedStatus: unknown) {
  return requestedStatus === 'live' || requestedStatus === 'hidden'
    ? requestedStatus
    : existingStatus;
}

app.disable('x-powered-by');
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

export function getStrictTransportSecurityOptions(isProduction: boolean) {
  return isProduction ? { maxAge: 31_536_000 } : false;
}

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  strictTransportSecurity: getStrictTransportSecurityOptions(env.NODE_ENV === 'production'),
}));

const configuredCorsOrigins = (env.CORS_ORIGINS || env.APP_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-request-id', 'Idempotency-Key', 'X-Postback-Signature', 'X-Milestone-Signature', 'X-Milestone-Timestamp', 'X-Milestone-Event-Id'],
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/+$/, '');
    if (env.NODE_ENV !== 'production' || configuredCorsOrigins.includes(normalized)) return callback(null, true);
    return callback(new Error('Origin is not allowed.'));
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/auth')) return next();
  const ip = getClientIp(req);
  const ipHash = ip ? hashFraudIdentifier(ip) : '';
  const proxyHeaderBlocked =
    req.header('x-sfc-proxy-blocked') === '1' ||
    req.header('x-vpn-blocked') === '1' ||
    req.header('x-tor-exit') === '1';
  if (ipIsBlocked(ip) || proxyHeaderBlocked) {
    res.setHeader('x-fraud-check', ipHash ? 'blocked' : 'blocked');
    return res.status(403).json({ error: 'Proxy, VPN, or Tor access is not permitted.' });
  }
  next();
});
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

function legalCompliancePage(title: string, description: string, sections: Array<{ heading: string; paragraphs: string[] }>) {
  const sectionHtml = sections.map((section) => `
    <section>
      <h2>${section.heading}</h2>
      ${section.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
    </section>
  `).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Signups4FastCash.com</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <style>
    :root{color-scheme:dark;--bg:#02070d;--panel:#0b1520;--text:#ededed;--muted:#a1a1aa;--accent:#2dd4ee}
    body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{max-width:780px;margin:0 auto;padding:48px 20px 72px}
    a{color:var(--accent)}
    section{margin-top:28px;padding:24px;border:1px solid #ffffff1f;border-radius:16px;background:var(--panel)}
    h1{margin:0;font-size:clamp(32px,7vw,52px);line-height:1.1}
    h2{margin:0 0 10px;font-size:20px}
    p{margin:10px 0;color:#d4d4d8}
    footer{margin-top:32px;color:var(--muted);font-size:13px}
  </style>
</head>
<body><main>
  <h1>${title}</h1>
  <p style="color:var(--muted)">${description}</p>
  ${sectionHtml}
  <footer>&copy; ${new Date().getFullYear()} Signups4FastCash.com — All rights reserved. Support: <a href="mailto:support@signups4fastcash.com">support@signups4fastcash.com</a></footer>
</main></body>
</html>`;
}

app.get('/terms', (req, res) => {
  res.type('html').send(legalCompliancePage('Terms of Service', 'Rules for using Signups4FastCash.com and the platform economy.', [
    { heading: 'Accounts and acceptable use', paragraphs: [
      'Only one account is allowed per person, household, and network boundary unless S4FC explicitly approves separate accounts.',
      'Proxy, VPN, Tor, emulator, automated emulator, device-spoofing, duplicate-registration, and tracking-concealment tools may not be used to create accounts or manipulate offer tracking.',
      'Violations may result in immediate account termination, cancelled pending payouts, and forfeiture of balances or rewards confirmed to involve abuse.',
    ] },
    { heading: 'Rewards and balances', paragraphs: [
      'S4FC does not control third-party merchant approval or payout decisions. Rewards, eligibility, fees, taxes, and timing are subject to the official merchant terms.',
      'Automated tracking spoofing, falsified completions, duplicate registrations, and balance exploitation are prohibited. Confirmed fraud may trigger balance forfeiture and manual review.',
    ] },
    { heading: 'Disclaimers', paragraphs: [
      'The platform provides informational and comparison tools, not financial, tax, legal, investment, or gambling advice.',
      'External websites are operated by third parties. Their terms, security, privacy practices, and decisions control.',
    ] },
  ]));
});

app.get(['/privacy', '/privacy-policy'], (req, res) => {
  res.type('html').send(legalCompliancePage('Privacy Policy', 'How S4FC handles account, device, network, cookie, and analytics data.', [
    { heading: 'Device and network security', paragraphs: [
      'S4FC may generate a browser device fingerprint from canvas output, screen dimensions, language settings, platform, time zone, and hardware concurrency. IP-derived and network signals may be used to detect proxy, VPN, Tor, hosting, or shared-connection abuse.',
      'Fingerprint and IP-derived identifiers are handled as security data and stored as hashes where practical. They are not public account profiles.',
    ] },
    { heading: 'Cookies and browser storage', paragraphs: [
      'Essential first-party cookies support authentication, OAuth state, consent and preferences, and temporary browser tests. Browser storage may preserve account and offer state.',
      'You can clear or block cookies in your browser. Blocking essential cookies may prevent sign-in or account features from working.',
    ] },
    { heading: 'Analytics and control', paragraphs: [
      'The site uses aggregate page and offer event counters for operational reporting. Offer-click records do not include public visitor location or public IP addresses.',
      'To request access, correction, or deletion of information associated with you, or to withdraw newsletter consent, contact support@signups4fastcash.com.',
    ] },
  ]));
});

app.get(['/cookies', '/cookie-policy'], (req, res) => {
  res.type('html').send(legalCompliancePage('Cookie Policy', 'Essential first-party cookies and browser storage used by S4FC.', [
    { heading: 'Essential cookies', paragraphs: [
      'sfc_session maintains authenticated sessions as an HTTP-only cookie. sfc_oauth_state protects Google OAuth sign-in. sfc_device_fingerprint is a privacy-preserving browser fingerprint cookie used for account-security checks.',
      'Admin unlock cookies and temporary tracking-check cookies support security and diagnostics only.',
    ] },
    { heading: 'Browser storage', paragraphs: [
      'Local storage may retain offer selections, preferences, and saved dashboard state. Session storage may maintain temporary UI state. Data is not sold.',
    ] },
  ]));
});

app.get('/affiliate-disclosure', (req, res) => {
  res.type('html').send(legalCompliancePage('Affiliate Disclosure', 'How referral compensation works at Signups4FastCash.com.', [
    { heading: 'Referral compensation', paragraphs: [
      'Some offer links are referral or affiliate links. A merchant may compensate S4FC if you use a qualifying link, with no additional cost to you.',
      'Compensation does not change merchant eligibility decisions or guarantee reward issuance. Every offer is subject to the official merchant terms.',
    ] },
  ]));
});

// API: XML Sitemap for search engines (must be before static middleware)
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getOAuthAppUrl(req);
  const urls: { loc: string; changefreq: string; priority: string }[] = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/terms`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${baseUrl}/privacy`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${baseUrl}/cookies`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${baseUrl}/affiliate-disclosure`, changefreq: 'monthly', priority: '0.3' },
  ];
  const seen = new Set(urls.map((url) => url.loc));
  Object.keys(seoPageRoutes).forEach((route) => {
    const loc = `${baseUrl}${route}`;
    if (!seen.has(loc)) {
      urls.push({ loc, changefreq: 'weekly', priority: '0.8' });
      seen.add(loc);
    }
  });
  
  const offerSlugCounts = new Map<string, number>();

  for (const offer of liveOffersStore.filter(isIndexableOfferLandingPage)) {
    const slug = String(offer.companySlug).toLowerCase();
    offerSlugCounts.set(slug, (offerSlugCounts.get(slug) || 0) + 1);
  }

  for (const [slug, count] of offerSlugCounts) {
    if (count !== 1) continue;

    const loc = `${baseUrl}/offers/${encodeURIComponent(slug)}`;
    if (!seen.has(loc)) {
      urls.push({ loc, changefreq: 'weekly', priority: '0.7' });
      seen.add(loc);
    }
  }

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

const seoPageRoutes: Record<string, string> = {
  '/guides': 'guides.html',
  '/partners': 'partners.html',
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
  '/ibotta-referral-bonus': 'ibotta-referral-bonus.html',
  '/ibotta-vs-upside': 'ibotta-vs-upside.html',
  '/apps-that-pay-for-receipts': 'apps-that-pay-for-receipts.html',
};

const legacySeoRedirects: Record<string, string> = {
  '/index.html': '/',
  '/support.html': '/',
  '/about.html': '/#trust',
  '/disclosures.html': '/#trust',
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
  app.get(route, async (_req, res) => {
    try {
      await recordAggregatePageView();
    } catch (error) {
      console.error('Could not record aggregate page view for an SEO page:', error);
    }
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

app.use(express.static(path.join(process.cwd(), 'public')));

function getSessionToken(req: express.Request) {
  const cookie = req.headers.cookie?.split(';').find((part) => part.trim().startsWith('sfc_session='));
  return cookie?.split('=')[1] || null;
}

function getCookieValue(req: express.Request, name: string) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return '';
  }
}

async function createAuthSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000;
  if (database) {
    await database.query(
      `INSERT INTO auth_sessions (token, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [token, userId],
    );
  }
  authSessions.set(token, { userId, expiresAt });
  return token;
}

export function getAuthSessionCookieOptions(isProduction = env.NODE_ENV === 'production') {
  return {
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS * 1000,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProduction,
    path: '/',
  };
}

function setAuthSessionCookie(res: express.Response, token: string) {
  res.cookie('sfc_session', token, getAuthSessionCookieOptions());
}

async function getAuthenticatedUser(req: express.Request) {
  const token = getSessionToken(req);
  if (!token) return null;
  if (!database) {
    const session = authSessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) authSessions.delete(token);
      return null;
    }
    const memoryUser = authUsers.get(session.userId);
    return memoryUser?.accountStatus === 'blocked' ? null : memoryUser || null;
  }
  const result = await database.query<{ id: string; google_sub: string | null; email: string; username: string | null; avatar_url: string | null; paypal_email: string | null; date_of_birth: string | null; sex: string | null; state: string | null; account_status: 'active' | 'blocked'; is_banned: boolean }>(
    `SELECT users.id, users.google_sub, users.email, users.username, users.avatar_url, users.paypal_email, users.date_of_birth, users.sex, users.state, users.account_status, users.is_banned
     FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token = $1 AND auth_sessions.expires_at > NOW()`,
    [token],
  );
  if (!result.rows[0] || result.rows[0].account_status === 'blocked' || result.rows[0].is_banned) return null;
  return result.rows[0]
    ? { id: result.rows[0].id, googleSub: result.rows[0].google_sub, email: result.rows[0].email, username: result.rows[0].username, avatarUrl: result.rows[0].avatar_url, paypalEmail: result.rows[0].paypal_email, dateOfBirth: result.rows[0].date_of_birth, sex: result.rows[0].sex, state: result.rows[0].state }
    : null;
}

function authUserResponse(user: { id: string; email: string; username: string | null; avatarUrl?: string | null; paypalEmail?: string | null; dateOfBirth?: string | null; sex?: string | null; state?: string | null } | null) {
  return user ? { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl || null, paypalEmail: user.paypalEmail || null, dateOfBirth: user.dateOfBirth || null, sex: user.sex || null, state: user.state || null } : null;
}

function hashReferralValue(value: string) {
  if (!referralHashSecret) throw new Error('Referral hash secret is not configured.');
  return createHmac('sha256', referralHashSecret).update(value).digest('hex');
}

export function hashFraudIdentifier(value: string) {
  const secret = env.FRAUD_SECRET || referralHashSecret || googleClientSecret;
  if (secret) return createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function getClientIp(req: express.Request) {
  const socketIp = req.socket.remoteAddress || '';
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.trim();
  return socketIp;
}

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;
const AUTH_RATE_LIMIT_MAX_KEYS = 10_000;
const authRateLimitEntries = new Map<string, { count: number; resetAt: number }>();

function createAuthRateLimiter(bucket: 'login' | 'signup'): express.RequestHandler {
  return (req, res, next) => {
    const candidateIp = env.NODE_ENV === 'production' ? req.ip : getClientIp(req);
    const clientIp = isIP(candidateIp) ? candidateIp : req.socket.remoteAddress || 'unknown';
    const key = `${bucket}:${clientIp}`;
    const now = Date.now();
    let entry = authRateLimitEntries.get(key);

    if (!entry || entry.resetAt <= now) {
      if (authRateLimitEntries.size >= AUTH_RATE_LIMIT_MAX_KEYS) {
        for (const [existingKey, existingEntry] of authRateLimitEntries) {
          if (existingEntry.resetAt <= now) authRateLimitEntries.delete(existingKey);
        }
        if (authRateLimitEntries.size >= AUTH_RATE_LIMIT_MAX_KEYS) {
          const oldestKey = authRateLimitEntries.keys().next().value;
          if (oldestKey) authRateLimitEntries.delete(oldestKey);
        }
      }
      entry = { count: 0, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS };
      authRateLimitEntries.set(key, entry);
    }

    if (entry.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
    }

    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(AUTH_RATE_LIMIT_MAX_ATTEMPTS));
    res.setHeader('RateLimit-Remaining', String(AUTH_RATE_LIMIT_MAX_ATTEMPTS - entry.count));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    return next();
  };
}

function logRequestError(context: string, error: unknown) {
  if (env.NODE_ENV === 'development') console.error(`${context}:`, error);
  else console.error(`${context}: request failed.`);
}

function ipIsBlocked(ip: string) {
  if (!ip) return false;
  if (blockedIpCache.has(ip)) return blockedIpCache.get(ip)! > Date.now();
  const denyList = (env.FRAUD_DENY_IPS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (denyList.includes(ip)) {
    blockedIpCache.set(ip, Date.now() + 24 * 60 * 60 * 1000);
    return true;
  }
  return false;
}

export function isValidDeviceFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function canApproveReferralPayout(verifiedNetRevenue: number) {
  return Number.isFinite(verifiedNetRevenue) && verifiedNetRevenue >= REFERRAL_MIN_NET_REVENUE;
}

export function calculateReferralCommissionCents(payoutCents: number, percent = referralCommissionPercent) {
  if (!Number.isSafeInteger(payoutCents) || payoutCents < 0) return 0;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return 0;
  return Math.round(payoutCents * percent / 100);
}

export function isOfferAvailableInUs(record: Record<string, unknown>) {
  const locationValues = [
    record.country,
    record.countries,
    record.geo,
    record.regions,
    record.availability,
  ].filter((value) => value !== undefined && value !== null);
  if (!locationValues.length) return true;
  const text = locationValues.flatMap((value) =>
    Array.isArray(value) ? value : [value],
  ).map((value) => String(value).toLowerCase()).join(',');
  if (!text.trim()) return true;
  return /(^|[^a-z])(us|usa|united states|america|all)([^a-z]|$)/.test(text)
    || text.includes('international');
}

export function normalizeOfferFeedPayload(payload: unknown, networkName: string) {
  let records: unknown[] = [];
  if (Array.isArray(payload)) records = payload;
  else if (isRecord(payload)) {
    for (const key of ['offers', 'items', 'data', 'campaigns']) {
      if (Array.isArray(payload[key])) {
        records = payload[key] as unknown[];
        break;
      }
    }
  }
  const now = new Date().toISOString();
  return records.flatMap((raw) => {
    if (!isRecord(raw) || !isOfferAvailableInUs(raw)) return [];
    const externalId = [raw.id, raw.offer_id, raw.offerId, raw.campaign_id, raw.uuid]
      .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    const title = [raw.title, raw.name, raw.offer_name]
      .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    if (!externalId || !title) return [];
    const rawPayout = [raw.payout_usd, raw.payout, raw.reward, raw.amount, raw.incentive]
      .find((value) => typeof value === 'number' || (typeof value === 'string' && Number(value) > 0));
    const payout = typeof rawPayout === 'number' ? rawPayout : Number(rawPayout || 0);
    if (!Number.isFinite(payout) || payout <= 0) return [];
    const housePayout = Math.round(payout * offerHousePayoutMultiplier * 100) / 100;
    const urlCandidate = [raw.referralUrl, raw.referral_url, raw.url, raw.click_url, raw.tracking_url]
      .find((value) => typeof value === 'string' && /^https?:\/\//i.test(value)) as string | undefined;
    if (!urlCandidate) return [];
    const categoryValue = String(raw.category || 'apps').toLowerCase();
    const category: OfferCategory = (['fintech', 'brokerage', 'cashback', 'apps', 'crypto', 'gaming'].includes(categoryValue)
      ? categoryValue
      : 'apps') as OfferCategory;
    const id = `feed-${networkName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${externalId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const company = String(raw.advertiser || raw.company || networkName).slice(0, 160);
    const offer: Offer = {
      id,
      company,
      companySlug: company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feed-offer',
      title: title.slice(0, 160),
      category,
      incentiveAmount: `$${housePayout.toFixed(2)} reward`,
      incentiveValue: housePayout,
      payoutSpeed: String(raw.payout_speed || raw.payoutSpeed || 'Check provider terms'),
      difficulty: 'Easy (2 min)',
      depositRequired: String(raw.deposit_required || '$0 unless the provider states otherwise'),
      availability: 'United States; verify current provider eligibility',
      officialMerchantUrl: urlCandidate,
      referralUrl: urlCandidate,
      sourceUrl: urlCandidate,
      verificationStatus: 'terms-vary',
      honestTruth: {
        summary: `Synced by ${networkName}. Review the provider’s current requirements before participating.`,
        theCatch: 'Network availability and reward terms can change. S4FC does not guarantee approval or payout.',
        minimumHoldTime: 'Per provider and network terms.',
        idVerificationRequired: Boolean(raw.id_verification_required),
        hiddenFeesWarning: 'Review purchases, subscriptions, playthrough, fees, and redemption terms before starting.',
        trustScore: 50,
      },
      speedrunHints: [
        { step: 1, instruction: 'Review the live provider terms and eligibility.' },
        { step: 2, instruction: 'Complete only the required steps you understand.' },
        { step: 3, instruction: 'Keep confirmation records and allow network processing time.' },
      ],
      status: 'live',
      clicksCount: 0,
      conversionsCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    return [offer];
  });
}

function getConfiguredOfferFeeds() {
  const feeds: Array<{ name: string; url: string }> = [];
  if (env.OFFER_FEEDS_JSON) {
    try {
      const parsed = JSON.parse(env.OFFER_FEEDS_JSON);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (isRecord(item) && typeof item.name === 'string' && typeof item.url === 'string') {
            feeds.push({ name: item.name.trim().slice(0, 80), url: item.url.trim() });
          }
        });
      } else if (isRecord(parsed)) {
        Object.entries(parsed).forEach(([name, url]) => {
          if (typeof url === 'string') feeds.push({ name: name.slice(0, 80), url: url.trim() });
        });
      }
    } catch {
      console.error('OFFER_FEEDS_JSON is invalid JSON.');
    }
  }
  (env.OFFER_FEED_URLS || '').split(',').map((url) => url.trim()).filter(Boolean).forEach((url, index) => {
    let name = `feed-${index + 1}`;
    try {
      name = new URL(url).hostname.replace(/[^a-z0-9]+/gi, '-') || name;
    } catch {
      return;
    }
    feeds.push({ name, url });
  });
  return feeds.filter((feed) => /^https?:\/\//i.test(feed.url)).filter((feed, index, all) =>
    all.findIndex((candidate) => candidate.url === feed.url) === index,
  );
}

export async function runOfferFeedSync() {
  const feeds = getConfiguredOfferFeeds();
  if (!database) return { status: 'skipped', reason: 'database_unavailable', feeds: feeds.length };
  if (!feeds.length) return { status: 'skipped', reason: 'no_feeds_configured', feeds: 0 };

  let fetchedCount = 0;
  let upsertedCount = 0;
  const feedResults: Array<{ name: string; fetched: number; upserted: number; status: string }> = [];
  for (const feed of feeds) {
    const runId = randomUUID();
    await database.query(
      `INSERT INTO offer_feed_sync_runs (id, feed_name, status, fetched_count, upserted_count)
       VALUES ($1, $2, 'running', 0, 0)`,
      [runId, feed.name],
    );
    try {
      const response = await fetch(feed.url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'Signups4FastCash-OfferSync/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
      const payload = await response.json();
      const offers = normalizeOfferFeedPayload(payload, feed.name);
      let feedUpserted = 0;
      for (const offer of offers) {
        await database.query(
          `INSERT INTO offers (id, status, offer, updated_at)
           VALUES ($1, 'live', $2::jsonb, NOW())
           ON CONFLICT (id) DO UPDATE SET
             status = 'live',
             offer = EXCLUDED.offer,
             updated_at = NOW()`,
          [offer.id, JSON.stringify(offer)],
        );
        feedUpserted += 1;
      }
      fetchedCount += offers.length;
      upsertedCount += feedUpserted;
      await database.query(
        `UPDATE offer_feed_sync_runs
         SET status = 'completed', fetched_count = $2, upserted_count = $3,
             completed_at = NOW(), details = $4::jsonb
         WHERE id = $1`,
        [runId, offers.length, feedUpserted, JSON.stringify({ url: feed.url })],
      );
      feedResults.push({ name: feed.name, fetched: offers.length, upserted: feedUpserted, status: 'completed' });
    } catch (error) {
      await database.query(
        `UPDATE offer_feed_sync_runs
         SET status = 'failed', completed_at = NOW(),
             details = $2::jsonb
         WHERE id = $1`,
        [runId, JSON.stringify({ error: 'Feed sync failed.' })],
      ).catch(() => undefined);
      feedResults.push({
        name: feed.name,
        fetched: 0,
        upserted: 0,
        status: 'failed',
      });
    }
  }
  return { status: 'completed', feeds: feeds.length, fetchedCount, upsertedCount, results: feedResults };
}

async function recordOfferSecurityEvent(offerId: string, eventType: 'security_failure' | 'signature_mismatch' | 'chargeback') {
  const current = analyticsSecurityFailures.get(offerId) || {
    signatureMismatch: 0,
    chargebacks: 0,
    securityFailures: 0,
  };
  if (eventType === 'signature_mismatch') current.signatureMismatch += 1;
  if (eventType === 'chargeback') current.chargebacks += 1;
  if (eventType === 'security_failure') current.securityFailures += 1;
  analyticsSecurityFailures.set(offerId, current);
  if (database) {
    await database.query(
      'INSERT INTO offer_security_events (id, offer_id, event_type) VALUES ($1, $2, $3)',
      [randomUUID(), offerId, eventType],
    ).catch((error) => console.error('Could not record offer security event:', error));
  }
}

export function evaluateRpsOutcome(playerChoice: RpsChoice, opponentChoice: RpsChoice): RpsOutcome {
  if (playerChoice === opponentChoice) return 'draw';
  return (
    (playerChoice === 'rock' && opponentChoice === 'scissors') ||
    (playerChoice === 'paper' && opponentChoice === 'rock') ||
    (playerChoice === 'scissors' && opponentChoice === 'paper')
  ) ? 'win' : 'loss';
}

export function parseRpsWager(amount: unknown, currency: unknown): RpsWager | null {
  if (
    (currency !== 'points' && currency !== 'cash') ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) return null;

  const units = currency === 'cash' ? Math.round(amount * 100) : amount;
  const maxUnits = currency === 'cash'
    ? Math.floor(RPS_MAX_CASH_BALANCE_CENTS / 2)
    : Math.floor(RPS_MAX_POINTS_BALANCE / 2);
  if (
    !Number.isSafeInteger(units) ||
    units < RPS_PVP_MIN_WAGER_UNITS ||
    units > maxUnits ||
    (currency === 'cash' && Math.abs(amount * 100 - units) > 1e-7)
  ) return null;
  return {
    currency,
    amount: currency === 'cash' ? units / 100 : units,
    units,
  };
}

export function calculateRpsPvpRakeUnits(poolUnits: number) {
  if (!Number.isSafeInteger(poolUnits) || poolUnits <= 0) {
    throw new RangeError('The RPS wager pool must be a positive safe integer.');
  }
  return Math.round((poolUnits * RPS_PVP_RAKE_RATE_BPS) / 10_000);
}

function isRpsChoice(value: unknown): value is RpsChoice {
  return typeof value === 'string' && RPS_CHOICES.includes(value as RpsChoice);
}

export type WithdrawalChannel = 'paypal' | 'venmo' | 'crypto';

export function validateWithdrawalDestination(channel: unknown, destination: unknown):
  | { channel: WithdrawalChannel; destination: string }
  | { field: 'channel' | 'destination'; error: string } {
  if (channel !== 'paypal' && channel !== 'venmo' && channel !== 'crypto') {
    return { field: 'channel', error: 'Choose paypal, venmo, or crypto.' };
  }
  if (typeof destination !== 'string') {
    return { field: 'destination', error: 'A payout destination is required.' };
  }
  const value = destination.trim();
  if (channel === 'paypal') {
    if (!SURVEY_PAYOUT_EMAIL_PATTERN.test(value) || value.length > 254) {
      return { field: 'destination', error: 'Enter a valid PayPal email address.' };
    }
  } else if (channel === 'venmo') {
    if (!/^@?[a-zA-Z0-9_-]{3,30}$/.test(value)) {
      return { field: 'destination', error: 'Enter a valid Venmo handle.' };
    }
  } else if (!/^[a-zA-Z0-9_-]{26,128}$/.test(value)) {
    return { field: 'destination', error: 'Enter a valid crypto address.' };
  }
  return { channel, destination: value };
}

function getRpsOpponentUsername() {
  const name = RPS_OPPONENT_NAME_PARTS[randomInt(RPS_OPPONENT_NAME_PARTS.length)];
  return `${name}${randomInt(1000, 10000)}`;
}

function isValidMilestoneSignature(timestamp: string, eventId: string, userId: string, offerId: string, level: number, signature: string) {
  if (!milestoneCallbackSecret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const payload = `${timestamp}.${eventId}.${userId}.${offerId}.${level}`;
  const expected = createHmac('sha256', milestoneCallbackSecret).update(payload).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function buildPostbackSignaturePayload(clickId: string, userId: string, offerId: string, milestoneStep: number, payoutCents: number) {
  return `${clickId}.${userId}.${offerId}.${milestoneStep}.${payoutCents}`;
}

export function compileOutboundTrackingUrl(baseUrl: string, userId: string, clickUuid: string) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('subid1', userId);
    url.searchParams.set('subid2', clickUuid);
    return url.toString();
  } catch {
    return '';
  }
}

function isValidPostbackSignature(clickId: string, userId: string, offerId: string, milestoneStep: number, payoutCents: number, signature: string) {
  if (!postbackSecret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', postbackSecret)
    .update(buildPostbackSignaturePayload(clickId, userId, offerId, milestoneStep, payoutCents))
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function createGoogleOAuthState(nonce: string, referralCode: string | null, issuedAt = Date.now()) {
  if (!googleClientSecret) throw new Error('Google OAuth is not configured.');
  const payload = Buffer.from(JSON.stringify({ nonce, referralCode, issuedAt })).toString('base64url');
  const signature = createHmac('sha256', googleClientSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readGoogleOAuthState(state: string, nonce: string) {
  if (!googleClientSecret) return null;
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expectedSignature = createHmac('sha256', googleClientSecret).update(payload).digest('base64url');
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      nonce?: string;
      referralCode?: string | null;
      issuedAt?: number;
    };
    if (
      parsed.nonce !== nonce ||
      !Number.isFinite(parsed.issuedAt) ||
      Date.now() - Number(parsed.issuedAt) > 10 * 60 * 1000 ||
      Number(parsed.issuedAt) - Date.now() > 30_000 ||
      (parsed.referralCode !== null && parsed.referralCode !== undefined && !REFERRAL_CODE_PATTERN.test(parsed.referralCode))
    ) return null;
    return { referralCode: parsed.referralCode || null };
  } catch {
    return null;
  }
}

app.get('/api/auth/me', async (req, res) => {
  res.json({ user: authUserResponse(await getAuthenticatedUser(req)) });
});

app.post('/api/auth/signup', createAuthRateLimiter('signup'), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const referralCode = (
    typeof req.body?.ref === 'string' ? req.body.ref : getCookieValue(req, 'sfc_referral')
  ).trim().toUpperCase();
  const deviceFingerprint = typeof req.body?.deviceFingerprint === 'string' ? req.body.deviceFingerprint.trim().toLowerCase() : '';
  if (deviceFingerprint && !isValidDeviceFingerprint(deviceFingerprint)) {
    return res.status(400).json({ field: 'deviceFingerprint', error: 'Invalid device signature.' });
  }
  if (!AUTH_EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ field: 'email', error: 'Enter a valid email address.' });
  }
  if (!AUTH_USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ field: 'username', error: 'Username must be 3-24 letters, numbers, or underscores.' });
  }
  if (Array.from(password).length < AUTH_PASSWORD_MIN_LENGTH || Buffer.byteLength(password, 'utf8') > AUTH_PASSWORD_MAX_BYTES) {
    return res.status(400).json({ field: 'password', error: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes.' });
  }
  if (!database) return res.status(503).json({ error: 'Account creation is temporarily unavailable.' });

  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    const passwordHash = await hashPassword(password, 12);
    const signupIpHeader = req.header('cf-connecting-ip')?.trim() || '';
    const signupIp = isIP(signupIpHeader) ? signupIpHeader : req.ip;
    const signupIpHash = referralHashSecret && signupIp && isIP(signupIp)
      ? hashReferralValue(`ip:${signupIp}`)
      : null;
    const accountReferralCode = MEMBER_REFERRALS_ENABLED ? randomBytes(6).toString('hex').toUpperCase() : null;
    client = await database.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const existingDevice = deviceFingerprint
      ? await client.query<{ user_id: string }>(
          'SELECT user_id FROM account_devices WHERE fingerprint_hash = $1 LIMIT 1',
          [deviceFingerprint],
        )
      : { rows: [] as { user_id: string }[] };
    const result = await client.query<{
      id: string;
      email: string;
      username: string;
      avatar_url: string | null;
      paypal_email: string | null;
      date_of_birth: string | null;
      sex: string | null;
      state: string | null;
    }>(
      `INSERT INTO users (id, google_sub, email, username, password_hash, referral_code, signup_ip_hash, last_login_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, username, avatar_url, paypal_email, date_of_birth, sex, state`,
      [randomUUID(), email, username, passwordHash, accountReferralCode, signupIpHash],
    );
    const account = result.rows[0];
    if (accountReferralCode) {
      await client.query(
        `INSERT INTO referral_code_aliases (code, user_id)
         VALUES ($1, $2)
         ON CONFLICT (code) DO NOTHING`,
        [accountReferralCode, account.id],
      );
    }
    if (REFERRAL_CODE_PATTERN.test(referralCode) && signupIpHash && referralHashSecret) {
      const referrer = await client.query<{ user_id: string }>(
        'SELECT user_id FROM referral_code_aliases WHERE code = $1 LIMIT 1',
        [referralCode],
      );
      const referrerId = referrer.rows[0]?.user_id;
      if (referrerId && referrerId !== account.id) {
        const emailHash = hashReferralValue(`email:${email}`);
        const duplicateReferral = await client.query(
          `SELECT 1 FROM referrals
           WHERE signup_ip_hash = $1 OR referred_email_hash = $2
           LIMIT 1`,
          [signupIpHash, emailHash],
        );
        if (!duplicateReferral.rowCount) {
          await client.query(
            `UPDATE users
             SET referred_by = $1, referred_by_user_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [referrerId, account.id],
          );
          await client.query(
            `INSERT INTO referrals
              (id, referrer_id, referred_user_id, referred_email_hash, signup_ip_hash, status, bonus_amount)
             VALUES ($1, $2, $3, $4, $5, 'pending', 5.00)`,
            [randomUUID(), referrerId, account.id, emailHash, signupIpHash],
          );
        }
      }
    }
    if (deviceFingerprint) {
      await client.query(
        `INSERT INTO account_devices (user_id, fingerprint_hash, ip_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET
           last_seen_at = NOW(), ip_hash = EXCLUDED.ip_hash`,
        [account.id, deviceFingerprint, hashFraudIdentifier(getClientIp(req))],
      );
      const existingOwner = existingDevice.rows[0]?.user_id;
      if (existingOwner && existingOwner !== account.id) {
        await client.query(
          `UPDATE users
           SET fraud_status = 'suspicious', cashout_restricted = TRUE, updated_at = NOW()
           WHERE id IN ($1, $2)`,
          [existingOwner, account.id],
        );
        await client.query(
          `INSERT INTO fraud_flags (id, user_id, fingerprint_hash, reason)
           VALUES ($1, $2, $3, 'duplicate_device_registration'), ($4, $5, $3, 'duplicate_device_registration')
           ON CONFLICT DO NOTHING`,
          [randomUUID(), existingOwner, deviceFingerprint, randomUUID(), account.id],
        );
        await client.query('COMMIT');
        transactionOpen = false;
        return res.status(403).json({
          error: 'This device is linked to an existing account. Contact support for review.',
          suspicious: true,
        });
      }
      memoryDeviceOwners.set(deviceFingerprint, account.id);
    }
    await client.query('COMMIT');
    transactionOpen = false;
    const sessionToken = await createAuthSession(account.id);
    setAuthSessionCookie(res, sessionToken);
    return res.status(201).json({
      user: authUserResponse({
        id: account.id,
        email: account.email,
        username: account.username,
        avatarUrl: account.avatar_url,
        paypalEmail: account.paypal_email,
        dateOfBirth: account.date_of_birth,
        sex: account.sex,
        state: account.state,
      }),
    });
  } catch (error) {
    if (transactionOpen) await client?.query('ROLLBACK').catch(() => undefined);
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === '23505') {
      if (databaseError.constraint === 'users_email_lower_unique') {
        return res.status(409).json({ field: 'email', error: 'An account with this email already exists.' });
      }
      if (databaseError.constraint === 'users_username_lower_unique' || databaseError.constraint === 'users_username_key') {
        return res.status(409).json({ field: 'username', error: 'That username is already taken.' });
      }
    }
    console.error('Password sign-up failed:', error);
    return res.status(500).json({ error: 'Could not create your account. Please try again.' });
  } finally {
    client?.release();
  }
});

app.post('/api/auth/login', createAuthRateLimiter('login'), async (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const deviceFingerprint = typeof req.body?.deviceFingerprint === 'string' ? req.body.deviceFingerprint.trim().toLowerCase() : '';
  if (deviceFingerprint && !isValidDeviceFingerprint(deviceFingerprint)) {
    return res.status(400).json({ field: 'deviceFingerprint', error: 'Invalid device signature.' });
  }
  const isEmail = AUTH_EMAIL_PATTERN.test(identifier);
  if ((!isEmail && !AUTH_USERNAME_PATTERN.test(identifier)) || identifier.length > 254) {
    return res.status(400).json({ field: 'identifier', error: 'Enter a valid email address or username.' });
  }
  if (!password || Buffer.byteLength(password, 'utf8') > AUTH_PASSWORD_MAX_BYTES) {
    return res.status(400).json({ field: 'password', error: 'Enter a valid password.' });
  }
  if (!database) return res.status(503).json({ error: 'Sign-in is temporarily unavailable.' });

  try {
    const result = await database.query<{
      id: string;
      email: string;
      username: string | null;
      password_hash: string | null;
      avatar_url: string | null;
      paypal_email: string | null;
      date_of_birth: string | null;
      sex: string | null;
      state: string | null;
      account_status: 'active' | 'blocked';
      is_banned: boolean;
    }>(
      `SELECT id, email, username, password_hash, avatar_url, paypal_email, date_of_birth, sex, state, account_status, is_banned
       FROM users
       WHERE ${isEmail ? 'LOWER(email) = LOWER($1)' : 'LOWER(username) = LOWER($1)'}
       LIMIT 1`,
      [isEmail ? identifier.toLowerCase() : identifier],
    );
    const account = result.rows[0];
    const passwordMatches = await comparePassword(password, account?.password_hash || DUMMY_PASSWORD_HASH);
    if (!account || !account.password_hash || !passwordMatches || account.account_status !== 'active' || account.is_banned) {
      return res.status(401).json({ error: 'The email or username and password do not match.' });
    }

    if (deviceFingerprint) {
      const existingDevices = await database.query<{ user_id: string }>(
        'SELECT user_id FROM account_devices WHERE fingerprint_hash = $1 AND user_id <> $2 LIMIT 1',
        [deviceFingerprint, account.id],
      );
      if (existingDevices.rows[0]) {
        const existingOwner = existingDevices.rows[0].user_id;
        await database.query(
          `UPDATE users
           SET fraud_status = 'suspicious', cashout_restricted = TRUE, updated_at = NOW()
           WHERE id IN ($1, $2)`,
          [existingOwner, account.id],
        );
        await database.query(
          `INSERT INTO fraud_flags (id, user_id, fingerprint_hash, reason)
           VALUES ($1, $2, $3, 'duplicate_device_login'), ($4, $5, $3, 'duplicate_device_login')
           ON CONFLICT DO NOTHING`,
          [randomUUID(), existingOwner, deviceFingerprint, randomUUID(), account.id],
        );
        return res.status(403).json({
          error: 'This device is linked to multiple accounts and requires manual review.',
          suspicious: true,
        });
      }
      await database.query(
        `INSERT INTO account_devices (user_id, fingerprint_hash, ip_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET
           last_seen_at = NOW(), ip_hash = EXCLUDED.ip_hash`,
        [account.id, deviceFingerprint, hashFraudIdentifier(getClientIp(req))],
      );
    }

    await database.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [account.id]);
    const sessionToken = await createAuthSession(account.id);
    setAuthSessionCookie(res, sessionToken);
    return res.json({
      user: authUserResponse({
        id: account.id,
        email: account.email,
        username: account.username,
        avatarUrl: account.avatar_url,
        paypalEmail: account.paypal_email,
        dateOfBirth: account.date_of_birth,
        sex: account.sex,
        state: account.state,
      }),
    });
  } catch (error) {
    console.error('Password sign-in failed:', error);
    return res.status(500).json({ error: 'Could not sign in. Please try again.' });
  }
});

app.get('/api/auth/google', createAuthRateLimiter('login'), (req, res) => {
  if (!googleClientId || !googleClientSecret) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
  }
  const nonce = randomBytes(32).toString('hex');
  const requestedReferralCode = (
    typeof req.query.ref === 'string' ? req.query.ref : getCookieValue(req, 'sfc_referral')
  ).trim().toUpperCase();
  const referralCode = MEMBER_REFERRALS_ENABLED && REFERRAL_CODE_PATTERN.test(requestedReferralCode)
    ? requestedReferralCode
    : null;
  const state = createGoogleOAuthState(nonce, referralCode);
  const redirectUri = `${getOAuthAppUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  res.cookie('sfc_oauth_state', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const oauthState = typeof req.query.state === 'string' ? req.query.state : '';
  const stateCookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('sfc_oauth_state='))?.slice('sfc_oauth_state='.length) || '';
  const verifiedOAuthState = readGoogleOAuthState(oauthState, stateCookie);
  const requestAppUrl = getOAuthAppUrl(req);
  if (!verifiedOAuthState) {
    res.clearCookie('sfc_oauth_state', { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' });
    return res.status(400).send('Google sign-in could not be completed.');
  }
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

    const signupIpHeader = req.header('cf-connecting-ip')?.trim() || '';
    const signupIp = isIP(signupIpHeader) ? signupIpHeader : req.ip;
    const signupIpHash = referralHashSecret && signupIp && isIP(signupIp)
      ? hashReferralValue(`ip:${signupIp}`)
      : null;
    const userId = randomUUID();
    const accountReferralCode = MEMBER_REFERRALS_ENABLED ? randomBytes(6).toString('hex').toUpperCase() : null;
    type AuthAccountRow = {
      id: string;
      google_sub: string | null;
      email: string;
      username: string | null;
      avatar_url: string | null;
      paypal_email: string | null;
      date_of_birth: string | null;
      sex: string | null;
      state: string | null;
      account_status: 'active' | 'blocked';
      is_banned: boolean;
    };
    let user: AuthAccountRow | undefined;
    let isNewAccount = false;
    if (database) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const matchingEmail = await client.query<AuthAccountRow>(
          `SELECT id, google_sub, email, username, avatar_url, paypal_email, date_of_birth, sex, state, account_status, is_banned
           FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE`,
          [identity.email],
        );
        if (matchingEmail.rows[0]) {
          if (matchingEmail.rows[0].google_sub && matchingEmail.rows[0].google_sub !== identity.sub) {
            throw new Error('AUTH_EMAIL_CONFLICT');
          }
          const linked = await client.query<AuthAccountRow>(
            `UPDATE users
             SET google_sub = $1, email = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id, google_sub, email, username, avatar_url, paypal_email, date_of_birth, sex, state, account_status, is_banned`,
            [identity.sub, identity.email, matchingEmail.rows[0].id],
          );
          user = linked.rows[0];
        } else {
          const inserted = await client.query<AuthAccountRow>(
            `INSERT INTO users (id, google_sub, email, referral_code, signup_ip_hash)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (google_sub) DO NOTHING
             RETURNING id, google_sub, email, username, avatar_url, paypal_email, date_of_birth, sex, state, account_status, is_banned`,
            [userId, identity.sub, identity.email, accountReferralCode, signupIpHash],
          );
          user = inserted.rows[0];
          isNewAccount = Boolean(user);
        }

        if (isNewAccount && user && accountReferralCode) {
          await client.query(
            `INSERT INTO referral_code_aliases (code, user_id)
             VALUES ($1, $2)
             ON CONFLICT (code) DO NOTHING`,
            [accountReferralCode, user.id],
          );
        }

        if (MEMBER_REFERRALS_ENABLED && isNewAccount && user && verifiedOAuthState.referralCode && signupIpHash && referralHashSecret) {
          const referrerResult = await client.query<{ id: string }>(
            'SELECT user_id AS id FROM referral_code_aliases WHERE code = $1 LIMIT 1',
            [verifiedOAuthState.referralCode],
          );
          const referrer = referrerResult.rows[0];
          if (referrer && referrer.id !== user.id) {
            const emailHash = hashReferralValue(`email:${identity.email.trim().toLowerCase()}`);
            const alreadyClaimed = await client.query<{ already_claimed: boolean }>(
              `SELECT EXISTS (
                 SELECT 1 FROM referrals
                 WHERE signup_ip_hash = $1 OR referred_email_hash = $2
               ) AS already_claimed`,
              [signupIpHash, emailHash],
            );
            const duplicateAccountEmail = await client.query<{ already_registered: boolean }>(
              `SELECT EXISTS (
                 SELECT 1 FROM users
                 WHERE LOWER(email) = LOWER($1) AND id <> $2
               ) AS already_registered`,
              [identity.email, user.id],
            );
            if (!alreadyClaimed.rows[0]?.already_claimed && !duplicateAccountEmail.rows[0]?.already_registered) {
              await client.query('SAVEPOINT referral_claim');
              try {
                await client.query(
                  'UPDATE users SET referred_by = $1, referred_by_user_id = $1 WHERE id = $2',
                  [referrer.id, user.id],
                );
                await client.query(
                  `INSERT INTO referrals
                    (id, referrer_id, referred_user_id, referred_email_hash, signup_ip_hash, status, bonus_amount)
                   VALUES ($1, $2, $3, $4, $5, 'pending', 5.00)`,
                  [randomUUID(), referrer.id, user.id, emailHash, signupIpHash],
                );
                await client.query('RELEASE SAVEPOINT referral_claim');
              } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT referral_claim');
                await client.query('RELEASE SAVEPOINT referral_claim');
                if ((error as { code?: string }).code !== '23505') throw error;
              }
            }
          }
        }

        if (!user) {
          const existing = await client.query<AuthAccountRow>(
            `UPDATE users
             SET email = $1, updated_at = NOW()
             WHERE google_sub = $2
             RETURNING id, google_sub, email, username, avatar_url, paypal_email, date_of_birth, sex, state, account_status, is_banned`,
            [identity.email, identity.sub],
          );
          user = existing.rows[0];
        }
        if (!user) throw new Error('Could not create or load the Google account.');
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (database && !user) return res.status(500).send('Could not create your account.');
    if (database && user) {
      const deviceFingerprint = getCookieValue(req, 'sfc_device_fingerprint');
      if (isValidDeviceFingerprint(deviceFingerprint)) {
        const existingDevices = await database.query<{ user_id: string }>(
          'SELECT user_id FROM account_devices WHERE fingerprint_hash = $1 AND user_id <> $2 LIMIT 1',
          [deviceFingerprint, user.id],
        );
        if (existingDevices.rows[0]) {
          const existingOwner = existingDevices.rows[0].user_id;
          await database.query(
            `UPDATE users
             SET fraud_status = 'suspicious', cashout_restricted = TRUE, updated_at = NOW()
             WHERE id IN ($1, $2)`,
            [existingOwner, user.id],
          );
          await database.query(
            `INSERT INTO fraud_flags (id, user_id, fingerprint_hash, reason)
             VALUES ($1, $2, $3, 'duplicate_device_login'), ($4, $5, $3, 'duplicate_device_login')
             ON CONFLICT DO NOTHING`,
            [randomUUID(), existingOwner, deviceFingerprint, randomUUID(), user.id],
          );
          return res.status(403).send('This device is linked to multiple accounts and requires manual review.');
        }
        await database.query(
          `INSERT INTO account_devices (user_id, fingerprint_hash, ip_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, fingerprint_hash) DO UPDATE SET
             last_seen_at = NOW(), ip_hash = EXCLUDED.ip_hash`,
          [user.id, deviceFingerprint, hashFraudIdentifier(getClientIp(req))],
        );
      }
    }
    if (user?.account_status === 'blocked' || user?.is_banned) return res.status(403).send('This account has been blocked. Please contact support.');
    const memoryUser = user
      ? { id: user.id, googleSub: user.google_sub, email: user.email, username: user.username, avatarUrl: user.avatar_url, paypalEmail: user.paypal_email, dateOfBirth: user.date_of_birth, sex: user.sex, state: user.state, accountStatus: user.account_status, lastLoginAt: new Date().toISOString() }
      : [...authUsers.values()].find((entry) => entry.googleSub === identity.sub) || { id: userId, googleSub: identity.sub, email: identity.email, username: null, avatarUrl: null, paypalEmail: null, dateOfBirth: null, sex: null, state: null, accountStatus: 'active' as const, lastLoginAt: new Date().toISOString() };
    authUsers.set(memoryUser.id, memoryUser);
    if (database) {
      await database.query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [memoryUser.id]);
      await syncOwnerFriendListForUser(memoryUser.id);
    }
    const sessionToken = await createAuthSession(memoryUser.id);
    setAuthSessionCookie(res, sessionToken);
    res.clearCookie('sfc_oauth_state', {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    });
    res.type('html').send(`<!doctype html><title>Sign-in complete</title><script>if(window.opener){window.opener.location.replace(${JSON.stringify(requestAppUrl)});window.opener.postMessage({type:'sfc-auth-complete'}, '*');}window.close();</script><p>Sign-in complete. You can close this window.</p>`);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    const databaseError = error as { code?: string; constraint?: string };
    if (
      (error instanceof Error && error.message === 'AUTH_EMAIL_CONFLICT') ||
      (databaseError.code === '23505' && databaseError.constraint === 'users_email_lower_unique')
    ) {
      return res.status(409).send('This email is already connected to another account. Sign in with the existing account instead.');
    }
    res.status(500).send('Google sign-in could not be completed.');
  }
});

app.get('/api/referrals/preview', requireMemberReferralsEnabled, async (req, res) => {
  const referralCode = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
  if (!REFERRAL_CODE_PATTERN.test(referralCode)) {
    return res.status(400).json({ error: 'Enter a valid referral code.' });
  }
  if (!database) return res.status(503).json({ error: 'Referral details are temporarily unavailable.' });
  try {
    const result = await database.query<{ username: string | null }>(
      `SELECT users.username
       FROM referral_code_aliases
       JOIN users ON users.id = referral_code_aliases.user_id
       WHERE referral_code_aliases.code = $1
       LIMIT 1`,
      [referralCode],
    );
    const referrer = result.rows[0];
    if (!referrer) return res.status(404).json({ error: 'This referral link could not be verified.' });
    return res.json({
      valid: true,
      referrerName: referrer.username || 'a Signups4FastCash member',
    });
  } catch (error) {
    console.error('Could not verify referral link:', error);
    return res.status(500).json({ error: 'Referral details are temporarily unavailable.' });
  }
});

app.get('/api/referrals/me', requireMemberReferralsEnabled, async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google first.' });
  if (!database) return res.status(503).json({ error: 'Referral accounts require the database service.' });
  try {
    const result = await database.query<{
      referral_code: string;
      referral_count: number;
      pending_cents: number;
      completed_cents: number;
    }>(
      `SELECT users.referral_code,
              COUNT(referrals.id)::int AS referral_count,
              COALESCE(SUM((referrals.bonus_amount * 100)::int)
                FILTER (WHERE referrals.status = 'pending'), 0)::int AS pending_cents,
              COALESCE(SUM((referrals.bonus_amount * 100)::int)
                FILTER (WHERE referrals.status = 'completed'), 0)::int AS completed_cents
       FROM users
       LEFT JOIN referrals ON referrals.referrer_id = users.id
       WHERE users.id = $1
       GROUP BY users.id, users.referral_code`,
      [user.id],
    );
    const referral = result.rows[0];
    if (!referral?.referral_code) return res.status(404).json({ error: 'Referral code not found for this account.' });
    const progressResult = await database.query<{
      id: string;
      status: 'pending' | 'completed' | 'void';
      bonus_cents: number;
      verified_net_revenue_cents: number;
      created_at: Date | string;
      tracked_site_clicks: number;
      offers: {
        offerId: string;
        company: string;
        title: string;
        status: 'active' | 'completed' | 'issue';
        reportedCompletedAt: Date | string | null;
      }[];
    }>(
      `SELECT referrals.id,
              referrals.status,
              (referrals.bonus_amount * 100)::int AS bonus_cents,
              (referrals.verified_net_revenue * 100)::int AS verified_net_revenue_cents,
              referrals.created_at,
              (SELECT COUNT(*)::int
               FROM referral_offer_clicks AS clicks
               WHERE clicks.referral_id = referrals.id) AS tracked_site_clicks,
              COALESCE(
                (
                  SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                      'offerId', activity.offer_id,
                      'company', COALESCE(offers.offer->>'company', 'Offer'),
                      'title', COALESCE(offers.offer->>'title', activity.offer_id),
                      'status', activity.status,
                      'reportedCompletedAt', activity.reported_completed_at
                    ) ORDER BY COALESCE(activity.reported_completed_at, activity.updated_at) DESC
                  )
                  FROM (
                    SELECT entries.offer_id,
                           entries.status,
                           entries.updated_at,
                           completion.reported_at AS reported_completed_at
                    FROM user_offer_entries AS entries
                    LEFT JOIN user_offer_completion_reports AS completion
                      ON completion.user_id = entries.user_id AND completion.offer_id = entries.offer_id
                    WHERE entries.user_id = referrals.referred_user_id
                    UNION ALL
                    SELECT completion.offer_id,
                           'completed' AS status,
                           completion.reported_at AS updated_at,
                           completion.reported_at AS reported_completed_at
                    FROM user_offer_completion_reports AS completion
                    WHERE completion.user_id = referrals.referred_user_id
                      AND NOT EXISTS (
                        SELECT 1
                        FROM user_offer_entries AS entries
                        WHERE entries.user_id = completion.user_id
                          AND entries.offer_id = completion.offer_id
                      )
                  ) AS activity
                  LEFT JOIN offers ON offers.id = activity.offer_id
                ),
                '[]'::jsonb
              ) AS offers
       FROM referrals
       WHERE referrals.referrer_id = $1
       ORDER BY referrals.created_at DESC
       LIMIT 100`,
      [user.id],
    );
    return res.json({
      referralCode: referral.referral_code,
      referralUrl: `https://signups4fastcash.com/?ref=${encodeURIComponent(referral.referral_code)}`,
      referredAccounts: referral.referral_count,
      pendingBonusCents: referral.pending_cents,
      completedCashCents: referral.completed_cents,
      referralProgress: progressResult.rows.map((entry, index) => ({
        label: `Referral ${progressResult.rows.length - index}`,
        status: entry.status,
        bonusCents: entry.bonus_cents,
        verifiedNetRevenueCents: entry.verified_net_revenue_cents,
        trackedSiteClicks: entry.tracked_site_clicks,
        createdAt: new Date(entry.created_at).toISOString(),
        offers: entry.offers.map((offer) => ({
          ...offer,
          reportedCompletedAt: offer.reportedCompletedAt
            ? new Date(offer.reportedCompletedAt).toISOString()
            : null,
        })),
      })),
    });
  } catch (error) {
    console.error('Could not load referral account:', error);
    return res.status(500).json({ error: 'Could not load referral details.' });
  }
});

app.put('/api/referrals/me/code', requireMemberReferralsEnabled, async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google first.' });
  if (!database) return res.status(503).json({ error: 'Referral links require the database service.' });
  const referralCode = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : '';
  if (!REFERRAL_CODE_PATTERN.test(referralCode)) {
    return res.status(400).json({ error: 'Use 3-24 letters, numbers, hyphens, or underscores. Start and end with a letter or number.' });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not open referral-code transaction:', error);
    return res.status(500).json({ error: 'Could not update your referral code.' });
  }
  try {
    await client.query('BEGIN');
    const account = await client.query<{ referral_code: string | null }>(
      'SELECT referral_code FROM users WHERE id = $1 FOR UPDATE',
      [user.id],
    );
    if (!account.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found.' });
    }

    const savedCode = await client.query(
      `INSERT INTO referral_code_aliases (code, user_id)
       VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET user_id = EXCLUDED.user_id
       WHERE referral_code_aliases.user_id = EXCLUDED.user_id`,
      [referralCode, user.id],
    );
    if (!savedCode.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That referral code is already in use. Choose another.' });
    }
    await client.query(
      'UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2',
      [referralCode, user.id],
    );
    await client.query('COMMIT');
    return res.json({
      referralCode,
      referralUrl: `https://signups4fastcash.com/?ref=${encodeURIComponent(referralCode)}`,
      previousLinksRemainValid: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'That referral code is already in use. Choose another.' });
    }
    console.error('Could not update referral code:', error);
    return res.status(500).json({ error: 'Could not update your referral code.' });
  } finally {
    client.release();
  }
});

app.post('/api/referrals/claim', requireMemberReferralsEnabled, async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google first.' });
  if (!database) return res.status(503).json({ error: 'Referral claims require the database service.' });
  const referralCode = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : '';
  if (!REFERRAL_CODE_PATTERN.test(referralCode)) {
    return res.status(400).json({ error: 'Enter a valid referral code.' });
  }
  if (!referralHashSecret) return res.status(503).json({ error: 'Referral fraud checks are not configured.' });

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not open referral transaction:', error);
    return res.status(500).json({ error: 'Could not apply the referral code.' });
  }
  let transactionOpen = false;
  const rejectClaim = async (status: number, message: string) => {
    await client.query('ROLLBACK');
    transactionOpen = false;
    return res.status(status).json({ error: message });
  };
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const accountResult = await client.query<{
      id: string;
      email: string;
      referral_code: string | null;
      referred_by_user_id: string | null;
      signup_ip_hash: string | null;
      created_at: Date;
    }>(
      `SELECT id, email, referral_code, referred_by_user_id, signup_ip_hash, created_at
       FROM users WHERE id = $1 FOR UPDATE`,
      [user.id],
    );
    const account = accountResult.rows[0];
    if (!account) return await rejectClaim(404, 'Account not found.');
    if (account.referred_by_user_id) return await rejectClaim(409, 'A referral has already been applied to this account.');
    const createdAt = new Date(account.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 24 * 60 * 60 * 1000) {
      return await rejectClaim(409, 'Referral codes must be applied within 24 hours of account creation.');
    }
    if (!account.referral_code) return await rejectClaim(409, 'Your account does not have a referral code yet.');
    if (!account.signup_ip_hash) return await rejectClaim(409, 'Could not verify the signup IP address for this account.');

    const referrerResult = await client.query<{ id: string }>(
      'SELECT user_id AS id FROM referral_code_aliases WHERE code = $1 LIMIT 1',
      [referralCode],
    );
    const referrer = referrerResult.rows[0];
    if (!referrer) return await rejectClaim(404, 'That referral code was not found.');
    if (referrer.id === account.id) return await rejectClaim(400, 'You cannot use your own referral code.');

    const duplicateEmail = await client.query(
      'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [account.email, account.id],
    );
    if (duplicateEmail.rowCount) return await rejectClaim(409, 'This email address is already linked to another account.');

    const emailHash = hashReferralValue(`email:${account.email.trim().toLowerCase()}`);
    const duplicateClaim = await client.query(
      'SELECT 1 FROM referrals WHERE signup_ip_hash = $1 OR referred_email_hash = $2 LIMIT 1',
      [account.signup_ip_hash, emailHash],
    );
    if (duplicateClaim.rowCount) {
      return await rejectClaim(409, 'A referral bonus has already been claimed from this IP address or email.');
    }

    await client.query(
      'UPDATE users SET referred_by_user_id = $1, updated_at = NOW() WHERE id = $2',
      [referrer.id, account.id],
    );
    await client.query(
      `INSERT INTO referrals
        (id, referrer_id, referred_user_id, referred_email_hash, signup_ip_hash, bonus_amount, status)
       VALUES ($1, $2, $3, $4, $5, 5.00, 'pending')`,
      [randomUUID(), referrer.id, account.id, emailHash, account.signup_ip_hash],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return res.status(201).json({
      referralApplied: true,
      referrerBonusCents: 500,
      status: 'pending',
      message: 'Referral recorded. The $5 referrer bonus is pending review and is not an automatic payout.',
    });
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'A referral bonus has already been claimed from this IP address or email.' });
    }
    console.error('Could not apply referral code:', error);
    return res.status(500).json({ error: 'Could not apply the referral code.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/username', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!user) return res.status(401).json({ error: 'Sign in first.' });
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
  if (!user) return res.status(401).json({ error: 'Sign in first.' });
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
  res.clearCookie('sfc_session', {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });
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
const offerCampaignsStore = new Map<string, OfferCampaign>();
let pendingOffersStore: any[] = [];
let subscribersStore: { id: string; email: string; subscribedAt: string; frequency: string; verified: boolean; unsubscribedAt?: string | null }[] = [];
const issueReportsStore: { id: string; offerId: string; issue: string; description: string; status: string; reportedAt: string }[] = [];
type SiteMessage = { id: string; message: string; email: string; status: 'new' | 'read' | 'resolved'; createdAt: string };
const siteMessagesStore: SiteMessage[] = [];
const siteMessageAttempts = new Map<string, { count: number; resetAt: number }>();
const userOfferEntriesStore = new Map<string, { offerId: string; status: 'active' | 'completed' | 'issue'; updatedAt: string }[]>();
let analyticsStore = {
  totalClicks: 0,
  totalConversions: 0,
};
let aggregatePageViewCount = 0;
let aggregatePageViewsSince = new Date().toISOString();

async function recordAggregatePageView() {
  if (!database) {
    aggregatePageViewCount += 1;
    return;
  }
  const result = await database.query<{ total_page_views: number }>(
    `UPDATE analytics_counters SET total_page_views = total_page_views + 1
     WHERE id = 1 RETURNING total_page_views`,
  );
  if (!result.rows[0]) throw new Error('Aggregate page-view counter row is missing.');
  aggregatePageViewCount = result.rows[0].total_page_views;
}

export function getAggregatePageViewCount() {
  return aggregatePageViewCount;
}

type OfferAnalyticsEvent = {
  offerId: string;
  type: 'click' | 'conversion';
  recordedAt: string;
};
const offerAnalyticsEvents: OfferAnalyticsEvent[] = [];
type OfferRevenueEvent = {
  id: string;
  offerId: string;
  company: string;
  title: string;
  type: 'conversion' | 'commission';
  amount: number | null;
  note: string;
  recordedAt: string;
};
const offerRevenueEvents: OfferRevenueEvent[] = [];

export function buildOfferActivityReport(events: OfferAnalyticsEvent[], periodDays: 7 | 30, checkedAt = new Date()) {
  const to = checkedAt.getTime();
  const from = to - periodDays * 24 * 60 * 60 * 1000;
  const report = buildOfferActivitySinceReport(events, new Date(from).toISOString(), checkedAt);
  return { ...report, periodDays };
}

export function buildOfferActivitySinceReport(events: OfferAnalyticsEvent[], from: string, checkedAt = new Date()) {
  const fromTime = Date.parse(from);
  if (!Number.isFinite(fromTime)) throw new Error('A valid start time is required for the activity report.');
  const to = checkedAt.getTime();
  const offers: Record<string, { clicks: number; conversions: number }> = {};
  for (const event of events) {
    const recordedAt = Date.parse(event.recordedAt);
    if (!Number.isFinite(recordedAt) || recordedAt < fromTime || recordedAt > to) continue;
    const activity = offers[event.offerId] || (offers[event.offerId] = { clicks: 0, conversions: 0 });
    activity[event.type === 'click' ? 'clicks' : 'conversions'] += 1;
  }
  const totals = Object.values(offers).reduce(
    (result, activity) => ({
      clicks: result.clicks + activity.clicks,
      conversions: result.conversions + activity.conversions,
    }),
    { clicks: 0, conversions: 0 },
  );
  return {
    from: new Date(fromTime).toISOString(),
    to: checkedAt.toISOString(),
    totals,
    offers,
  };
}

export function getOfferActivityReport(periodDays: 7 | 30, checkedAt = new Date()) {
  return buildOfferActivityReport(offerAnalyticsEvents, periodDays, checkedAt);
}

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
const supportTicketsStore = new Map<string, {
  id: string;
  userId: string;
  transactionReferenceId: string | null;
  screenshotUrl: string | null;
  subject: string;
  message: string;
  status: 'OPEN' | 'PENDING_NETWORK_REVIEW' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
}>();
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
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      type TEXT NOT NULL CHECK (type IN ('CREDIT_ALERT', 'PVP_ALERT', 'SYSTEM')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
    ON notifications (user_id, created_at DESC)
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON notifications (user_id, created_at DESC) WHERE is_read = FALSE
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS live_offer_credits (
      id UUID PRIMARY KEY,
      transaction_reference TEXT NOT NULL UNIQUE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      masked_username TEXT NOT NULL,
      offerwall_name TEXT NOT NULL,
      offer_name TEXT NOT NULL,
      payout_amount NUMERIC(12, 2) NOT NULL CHECK (payout_amount > 0),
      credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS live_offer_credits_credited_at_idx
    ON live_offer_credits (credited_at DESC)
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
    {
      version: 2,
      apply: async () => {
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT \'active\'');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0)');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_tracking_id TEXT');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_address TEXT');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE');
        await migrationClient.query('UPDATE users SET is_banned = TRUE WHERE account_status = \'blocked\'');
        await migrationClient.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
          ON users (LOWER(username)) WHERE username IS NOT NULL
        `);
        await migrationClient.query(`
          CREATE INDEX IF NOT EXISTS users_affiliate_tracking_id_idx
          ON users (affiliate_tracking_id) WHERE affiliate_tracking_id IS NOT NULL
        `);
        await migrationClient.query(`
          DO $$
          BEGIN
            CREATE TYPE transaction_type AS ENUM ('OFFER_COMPLETION', 'PVP_WIN', 'PVP_LOSS', 'WITHDRAWAL');
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
          $$;
        `);
        await migrationClient.query(
          `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'PVP_DRAW'`,
        );
        await migrationClient.query(
          `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'LEADERBOARD_PRIZE'`,
        );
        await migrationClient.query(
          `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'REFERRAL_COMMISSION'`,
        );
        await migrationClient.query(`
          CREATE TABLE IF NOT EXISTS transactions (
            id UUID PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL,
            type transaction_type NOT NULL,
            reference_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await migrationClient.query(`
          CREATE INDEX IF NOT EXISTS transactions_user_created_at_idx
          ON transactions (user_id, created_at DESC)
        `);
        await migrationClient.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_id_unique
          ON transactions (reference_id) WHERE reference_id IS NOT NULL
        `);
      },
    },
    {
      version: 3,
      apply: async () => {
        const duplicateEmails = await migrationClient.query(`
          SELECT 1
          FROM users
          GROUP BY LOWER(email)
          HAVING COUNT(*) > 1
          LIMIT 1
        `);
        if (duplicateEmails.rowCount) {
          throw new Error('Cannot enable password authentication until duplicate account emails are resolved.');
        }
        await migrationClient.query('ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL');
        await migrationClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
        await migrationClient.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
          ON users (LOWER(email))
        `);
      },
    },
    {
      version: 4,
      apply: async () => {
        await migrationClient.query(
          `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'PVP_WAGER'`,
        );
        await migrationClient.query(
          `ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'PVP_REFUND'`,
        );
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

  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fraud_status TEXT NOT NULL DEFAULT 'clean'`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cashout_restricted BOOLEAN NOT NULL DEFAULT FALSE`);
  await database.query(`
    CREATE TABLE IF NOT EXISTS account_devices (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint_hash TEXT NOT NULL CHECK (char_length(fingerprint_hash) = 64),
      ip_hash TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, fingerprint_hash)
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS account_devices_fingerprint_idx
    ON account_devices (fingerprint_hash)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS fraud_flags (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint_hash TEXT,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, fingerprint_hash, reason)
    )
  `);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_withdrawal NUMERIC(12, 2) NOT NULL DEFAULT 0.00`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_wheel_uses INTEGER NOT NULL DEFAULT 0`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_wheel_reset_at TIMESTAMPTZ`);
  await database.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_status TEXT`);
  await database.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_channel TEXT`);
  await database.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_id_hash TEXT`);
  await database.query(`
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id UUID PRIMARY KEY,
      idempotency_key TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 5.00),
      channel TEXT NOT NULL CHECK (channel IN ('paypal', 'venmo', 'crypto')),
      destination_hash TEXT NOT NULL,
      destination_mask TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
      tracking_id_hash TEXT NOT NULL,
      provider_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      UNIQUE (user_id, idempotency_key)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS background_worker_runs (
      run_key TEXT PRIMARY KEY,
      worker_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS weekly_leaderboard_entries (
      race_key TEXT NOT NULL,
      rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
      prize NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (race_key, rank),
      UNIQUE (race_key, user_id)
    )
  `);
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
    CREATE TABLE IF NOT EXISTS daily_reward_claims (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      claim_date DATE NOT NULL,
      reward_points INTEGER NOT NULL CHECK (reward_points IN (1, 2, 5, 10, 25)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, claim_date)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS payout_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offerwall TEXT NOT NULL,
      offer_name TEXT NOT NULL,
      payout_usd NUMERIC(12, 4) NOT NULL CHECK (payout_usd > 0),
      coins INTEGER NOT NULL CHECK (coins > 0),
      status TEXT NOT NULL CHECK (status IN ('pending', 'credited', 'failed')),
      credited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS payout_logs_user_id_created_at_idx
    ON payout_logs (user_id, created_at DESC)
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS payout_logs_status_created_at_idx
    ON payout_logs (status, created_at DESC)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS game_rps_games (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      player_choice TEXT NOT NULL CHECK (player_choice IN ('rock', 'paper', 'scissors')),
      opponent_choice TEXT NOT NULL CHECK (opponent_choice IN ('rock', 'paper', 'scissors')),
      opponent_username TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
      entry_points INTEGER NOT NULL CHECK (entry_points > 0),
      payout_points INTEGER NOT NULL CHECK (payout_points >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, idempotency_key)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS rps_lobbies (
      id UUID PRIMARY KEY,
      player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      player2_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
      wager_amount NUMERIC(12, 2) NOT NULL CHECK (wager_amount > 0),
      wager_currency TEXT NOT NULL CHECK (wager_currency IN ('points', 'cash')),
      state TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'active', 'completed')),
      ended_reason TEXT CHECK (ended_reason IN ('settled', 'expired') OR ended_reason IS NULL),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (wager_currency <> 'points' OR wager_amount = TRUNC(wager_amount)),
      CHECK (player2_id IS NULL OR player2_id <> player1_id),
      CHECK (state = 'waiting' OR player2_id IS NOT NULL),
      UNIQUE (id, player1_id, player2_id)
    )
  `);
  await database.query(`ALTER TABLE rps_lobbies ADD COLUMN IF NOT EXISTS ended_reason TEXT`);
  await database.query(`
    CREATE TABLE IF NOT EXISTS rps_lobby_moves (
      lobby_id UUID NOT NULL REFERENCES rps_lobbies(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      choice TEXT NOT NULL CHECK (choice IN ('rock', 'paper', 'scissors')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (lobby_id, user_id)
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS rps_lobbies_open_created_at_idx
    ON rps_lobbies (created_at DESC)
    WHERE state = 'waiting'
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS rps_matches (
      id UUID PRIMARY KEY,
      lobby_id UUID NOT NULL UNIQUE,
      player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      player2_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      player1_choice TEXT NOT NULL CHECK (player1_choice IN ('rock', 'paper', 'scissors')),
      player2_choice TEXT NOT NULL CHECK (player2_choice IN ('rock', 'paper', 'scissors')),
      winner_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
      outcome TEXT NOT NULL CHECK (outcome IN ('player1', 'player2', 'draw')),
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (player1_id <> player2_id),
      CHECK (
        (outcome = 'player1' AND winner_id IS NOT NULL AND winner_id = player1_id) OR
        (outcome = 'player2' AND winner_id IS NOT NULL AND winner_id = player2_id) OR
        (outcome = 'draw' AND winner_id IS NULL)
      ),
      FOREIGN KEY (lobby_id, player1_id, player2_id)
        REFERENCES rps_lobbies (id, player1_id, player2_id) ON DELETE RESTRICT,
      UNIQUE (id, winner_id)
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS rps_matches_players_completed_at_idx
    ON rps_matches (player1_id, player2_id, completed_at DESC)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS rps_house_ledger (
      id UUID PRIMARY KEY,
      match_id UUID NOT NULL UNIQUE,
      winner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      currency TEXT NOT NULL CHECK (currency IN ('points', 'cash')),
      pool_amount NUMERIC(12, 2) NOT NULL CHECK (pool_amount > 0),
      rake_rate_bps INTEGER NOT NULL CHECK (rake_rate_bps BETWEEN 100 AND 300),
      rake_amount NUMERIC(12, 2) NOT NULL CHECK (rake_amount > 0 AND rake_amount <= pool_amount),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (match_id, winner_id)
        REFERENCES rps_matches (id, winner_id) ON DELETE RESTRICT
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS rps_house_ledger_created_at_idx
    ON rps_house_ledger (created_at DESC)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_milestone_tiers (
      offer_id TEXT NOT NULL,
      stage INTEGER NOT NULL CHECK (stage > 0),
      level INTEGER NOT NULL CHECK (level > 0),
      reward_points INTEGER NOT NULL CHECK (reward_points >= 0),
      description TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (offer_id, stage),
      UNIQUE (offer_id, level)
    )
  `);
  await database.query(`ALTER TABLE offer_milestone_tiers ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('fintech', 'brokerage', 'cashback', 'apps', 'crypto', 'gaming')),
      total_value NUMERIC(12, 2) NOT NULL CHECK (total_value >= 0),
      milestones JSONB NOT NULL CHECK (jsonb_typeof(milestones) = 'array'),
      tracking_parameters JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(tracking_parameters) = 'object'),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const campaignRows = await database.query<{
    id: string;
    title: string;
    description: string;
    category: OfferCampaign['category'];
    total_value: string;
    milestones: OfferMilestone[];
    tracking_parameters: Record<string, string>;
    active: boolean;
    created_at: Date;
    updated_at: Date;
  }>('SELECT id, title, description, category, total_value, milestones, tracking_parameters, active, created_at, updated_at FROM offer_campaigns');
  offerCampaignsStore.clear();
  for (const row of campaignRows.rows) {
    offerCampaignsStore.set(row.id, {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      total_value: Number(row.total_value),
      milestones: row.milestones,
      tracking_parameters: row.tracking_parameters,
      active: row.active,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    });
  }
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_milestone_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      level INTEGER NOT NULL CHECK (level > 0),
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS user_offer_milestone_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      current_level INTEGER NOT NULL DEFAULT 0 CHECK (current_level >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, offer_id)
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS user_offer_milestone_claims (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      stage INTEGER NOT NULL,
      level INTEGER NOT NULL,
      reward_points INTEGER NOT NULL CHECK (reward_points >= 0),
      event_id TEXT NOT NULL REFERENCES offer_milestone_events(event_id),
      credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, offer_id, stage)
    )
  `);
  for (const tier of EARNX_MILESTONE_TIERS) {
    await database.query(
      `INSERT INTO offer_milestone_tiers (offer_id, stage, level, reward_points, description)
       VALUES ('offer-earnx', $1, $2, $3, $4)
       ON CONFLICT (offer_id, stage) DO UPDATE
       SET description = EXCLUDED.description
       WHERE offer_milestone_tiers.description = ''`,
      [tier.stage, tier.level, tier.rewardPoints, tier.description],
    );
  }
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id TEXT REFERENCES users(id)`);
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT REFERENCES users(id)`);
  await database.query(`
    UPDATE users
    SET referred_by = referred_by_user_id
    WHERE referred_by IS NULL AND referred_by_user_id IS NOT NULL
  `);
  await database.query('CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by)');
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip_hash TEXT`);
  await database.query(`
    UPDATE users
    SET referral_code = UPPER(SUBSTRING(REPLACE(id, '-', '') FROM 1 FOR 12))
    WHERE referral_code IS NULL
  `);
  await database.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique
    ON users (referral_code) WHERE referral_code IS NOT NULL
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS referral_code_aliases (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (code = UPPER(code))
    )
  `);
  await database.query(`
    INSERT INTO referral_code_aliases (code, user_id)
    SELECT referral_code, id FROM users
    WHERE referral_code IS NOT NULL
    ON CONFLICT (code) DO NOTHING
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY,
      referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      referred_email_hash TEXT NOT NULL UNIQUE,
      signup_ip_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'void')),
      bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 5.00 CHECK (bonus_amount >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS referral_wallet_credits (
      referral_id UUID PRIMARY KEY REFERENCES referrals(id) ON DELETE CASCADE,
      referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL CHECK (points > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS referrals_ledger (
      id UUID PRIMARY KEY,
      referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_transaction_id TEXT NOT NULL UNIQUE,
      commission_amount NUMERIC(12, 2) NOT NULL CHECK (commission_amount >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS verified_net_revenue NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (verified_net_revenue >= 0)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS referral_offer_clicks (
      id UUID PRIMARY KEY,
      referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
      referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(`
    CREATE INDEX IF NOT EXISTS referral_offer_clicks_referral_offer_time_idx
    ON referral_offer_clicks (referral_id, offer_id, clicked_at DESC)
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS click_logs (
      click_uuid TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      ip_address TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS click_logs_user_offer_time_idx ON click_logs (user_id, offer_id, timestamp DESC)');
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
    CREATE TABLE IF NOT EXISTS user_offer_completion_reports (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id TEXT NOT NULL,
      reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, offer_id)
    )
  `);
  await database.query(`
    INSERT INTO user_offer_completion_reports (user_id, offer_id, reported_at)
    SELECT user_id, offer_id, updated_at
    FROM user_offer_entries
    WHERE status = 'completed'
    ON CONFLICT (user_id, offer_id) DO NOTHING
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
  await database.query(`
    CREATE TABLE IF NOT EXISTS provider_api_credentials (
      provider_slug TEXT NOT NULL,
      credential_slug TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      credential_name TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider_slug, credential_slug)
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
      total_conversions INTEGER NOT NULL DEFAULT 0,
      total_page_views INTEGER NOT NULL DEFAULT 0,
      page_views_since TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('ALTER TABLE analytics_counters ADD COLUMN IF NOT EXISTS total_page_views INTEGER NOT NULL DEFAULT 0');
  await database.query('ALTER TABLE analytics_counters ADD COLUMN IF NOT EXISTS page_views_since TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_analytics_events (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('click', 'conversion')),
      occurred_at TIMESTAMPTZ NOT NULL
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS offer_analytics_events_time_offer_idx ON offer_analytics_events (occurred_at, offer_id)');
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_revenue_events (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('conversion', 'commission')),
      amount NUMERIC,
      note TEXT NOT NULL DEFAULT '',
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS offer_revenue_events_time_offer_idx ON offer_revenue_events (recorded_at, offer_id)');
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_security_events (
      id UUID PRIMARY KEY,
      offer_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('security_failure', 'signature_mismatch', 'chargeback')),
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS offer_security_events_offer_time_idx ON offer_security_events (offer_id, occurred_at DESC)');
  await database.query(`
    CREATE TABLE IF NOT EXISTS offer_feed_sync_runs (
      id UUID PRIMARY KEY,
      feed_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      fetched_count INTEGER NOT NULL DEFAULT 0,
      upserted_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS ledger_integrity_runs (
      id UUID PRIMARY KEY,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transaction_credits NUMERIC(12, 2) NOT NULL,
      live_user_balance NUMERIC(12, 2) NOT NULL,
      difference NUMERIC(12, 2) NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('healthy', 'anomalous'))
    )
  `);
  await database.query("DELETE FROM offer_analytics_events WHERE occurred_at < NOW() - INTERVAL '365 days'");
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
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_reference_id TEXT,
      screenshot_url TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'PENDING_NETWORK_REVIEW', 'RESOLVED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
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
  await database.query(`
    CREATE TABLE IF NOT EXISTS site_messages (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query('CREATE INDEX IF NOT EXISTS site_messages_status_created_at_idx ON site_messages (status, created_at DESC)');
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
    database.query<{ total_clicks: number; total_conversions: number; total_page_views: number; page_views_since: Date }>(
      'SELECT total_clicks, total_conversions, total_page_views, page_views_since FROM analytics_counters WHERE id = 1',
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
    aggregatePageViewCount = analytics.rows[0].total_page_views;
    aggregatePageViewsSince = new Date(analytics.rows[0].page_views_since).toISOString();
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
    'SELECT offer FROM offers ORDER BY updated_at DESC',
  );

  if (existing.rowCount === 0) {
    const catalogOffers = PUBLIC_OFFERS.filter((offer) => !isTemporarilyHiddenOffer(offer));
    for (const offer of catalogOffers) {
      await database.query(
        `INSERT INTO offers (id, status, offer, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [offer.id, offer.status, offer, offer.updatedAt],
      );
    }
    liveOffersStore = catalogOffers;
  } else {
    const catalogMap = new Map(PUBLIC_OFFERS.map((offer) => [offer.id, offer]));
    const existingOffers = existing.rows.map((row) => applyCoinsBackTerms({
      ...row.offer,
      clicksCount: Number.isFinite(Number(row.offer.clicksCount)) ? Number(row.offer.clicksCount) : 0,
      conversionsCount: Number.isFinite(Number(row.offer.conversionsCount)) ? Number(row.offer.conversionsCount) : 0,
    })).filter((offer) => !isTemporarilyHiddenOffer(offer));

    const mergedOffers = PUBLIC_OFFERS.filter((offer) => !isTemporarilyHiddenOffer(offer)).map((offer) => {
      const existingOffer = existingOffers.find((row) => row.id === offer.id);
      return mergeCatalogOffer(offer, existingOffer);
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
    await database.query('DELETE FROM offers');
    for (const offer of liveOffersStore) {
      await database.query(
        `INSERT INTO offers (id, status, offer, updated_at) VALUES ($1, $2, $3, $4)`,
        [offer.id, offer.status, offer, offer.updatedAt || new Date().toISOString()],
      );
    }
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

// API: Health checks
app.get('/health', async (_req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  if (!database) {
    return res.json({
      status: 'ok',
      database: 'memory',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    });
  }
  try {
    await database.query('SELECT 1');
    return res.json({
      status: 'ok',
      database: 'connected',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      status: 'degraded',
      database: 'unavailable',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    });
  }
});

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

app.get('/api/tracking-check', async (_req, res) => {
  if (!database) return res.json({ status: 'temporary', storage: 'memory' });
  try {
    const result = await database.query<{ eventsReady: boolean; counterReady: boolean }>(
      `SELECT to_regclass('public.offer_analytics_events') IS NOT NULL AS "eventsReady",
              EXISTS (SELECT 1 FROM analytics_counters WHERE id = 1) AS "counterReady"`,
    );
    if (!result.rows[0]?.eventsReady || !result.rows[0]?.counterReady) {
      return res.status(503).json({ status: 'unavailable' });
    }
    return res.json({ status: 'ready', storage: 'database' });
  } catch (error) {
    console.error('Referral tracking readiness check failed:', error);
    return res.status(503).json({ status: 'unavailable' });
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

async function lockRpsPlayerBalances(
  client: PoolClient,
  userIds: string[],
  currency: RpsWagerCurrency,
  requireActiveAccounts = true,
) {
  const uniqueUserIds = [...new Set(userIds)].sort();
  const accountResult = await client.query<{
    id: string;
    balance: string;
    account_status: 'active' | 'blocked';
    is_banned: boolean;
  }>(
    `SELECT id, balance, account_status, is_banned
     FROM users
     WHERE id = ANY($1::text[])
     ORDER BY id
     FOR UPDATE`,
    [uniqueUserIds],
  );
  if (
    accountResult.rowCount !== uniqueUserIds.length ||
    (requireActiveAccounts && accountResult.rows.some((account) => account.account_status !== 'active' || account.is_banned))
  ) return { balances: new Map<string, number>(), error: 'A player account is not eligible for this match.' };

  if (currency === 'cash') {
    const balances = new Map<string, number>();
    for (const account of accountResult.rows) {
      const units = Math.round(Number(account.balance) * 100);
      if (!Number.isSafeInteger(units) || units < 0) {
        return { balances: new Map<string, number>(), error: 'A player wallet balance is invalid.' };
      }
      balances.set(account.id, units);
    }
    return { balances, error: null };
  }

  await client.query(
    `INSERT INTO survey_reward_balances (user_id, points)
     SELECT UNNEST($1::text[]), 0
     ON CONFLICT (user_id) DO NOTHING`,
    [uniqueUserIds],
  );
  const pointResult = await client.query<{ user_id: string; points: number }>(
    `SELECT user_id, points
     FROM survey_reward_balances
     WHERE user_id = ANY($1::text[])
     ORDER BY user_id
     FOR UPDATE`,
    [uniqueUserIds],
  );
  if (pointResult.rowCount !== uniqueUserIds.length) {
    return { balances: new Map<string, number>(), error: 'A player wallet balance is unavailable.' };
  }
  const balances = new Map<string, number>();
  for (const wallet of pointResult.rows) {
    const points = Number(wallet.points);
    if (!Number.isSafeInteger(points) || points < 0) {
      return { balances: new Map<string, number>(), error: 'A player wallet balance is invalid.' };
    }
    balances.set(wallet.user_id, points);
  }
  return { balances, error: null };
}

async function updateRpsWallet(
  client: PoolClient,
  userId: string,
  currency: RpsWagerCurrency,
  deltaUnits: number,
) {
  if (currency === 'cash') {
    const deltaDollars = deltaUnits / 100;
    const result = await client.query<{ balance: string }>(
      `UPDATE users
       SET balance = balance + $2, updated_at = NOW()
       WHERE id = $1 AND balance + $2 >= 0 AND balance + $2 <= $3
       RETURNING balance`,
      [userId, deltaDollars, RPS_MAX_CASH_BALANCE_CENTS / 100],
    );
    if (!result.rows[0]) return null;
    return Math.round(Number(result.rows[0].balance) * 100);
  }

  const result = await client.query<{ points: number }>(
    `UPDATE survey_reward_balances
     SET points = points + $2, updated_at = NOW()
     WHERE user_id = $1 AND points + $2 BETWEEN 0 AND $3
     RETURNING points`,
    [userId, deltaUnits, RPS_MAX_POINTS_BALANCE],
  );
  return result.rows[0] ? Number(result.rows[0].points) : null;
}

async function insertRpsWalletTransaction(
  client: PoolClient,
  userId: string,
  amountUnits: number,
  type: 'PVP_WAGER' | 'PVP_WIN' | 'PVP_DRAW' | 'PVP_REFUND',
  referenceId: string,
) {
  const result = await client.query(
    `INSERT INTO transactions (id, user_id, amount, type, reference_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), userId, amountUnits / 100, type, referenceId],
  );
  if (result.rowCount !== 1) throw new Error(`Duplicate PvP wallet transaction reference: ${referenceId}`);
}

async function loadRpsLobbyState(client: PoolClient, lobbyId: string, userId: string) {
  const lobbyResult = await client.query<RpsLobbyRow>(
    `SELECT id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at
     FROM rps_lobbies
     WHERE id = $1`,
    [lobbyId],
  );
  const lobby = lobbyResult.rows[0];
  if (!lobby || (lobby.player1_id !== userId && lobby.player2_id !== userId)) return null;

  const opponentId = lobby.player1_id === userId ? lobby.player2_id : lobby.player1_id;
  const moves = await client.query<{ user_id: string; choice: RpsChoice }>(
    'SELECT user_id, choice FROM rps_lobby_moves WHERE lobby_id = $1',
    [lobbyId],
  );
  const ownMove = moves.rows.find((move) => move.user_id === userId);
  const opponentMoveSubmitted = Boolean(opponentId && moves.rows.some((move) => move.user_id === opponentId));
  const state = {
    lobby: {
      id: lobby.id,
      state: lobby.state,
      endedReason: lobby.ended_reason,
      wagerAmount: Number(lobby.wager_amount),
      currency: lobby.wager_currency,
      createdAt: new Date(lobby.created_at).toISOString(),
    },
    yourChoice: ownMove?.choice || null,
    opponentMoveSubmitted,
  };
  if (lobby.state !== 'completed') return state;

  const matchResult = await client.query<{
    id: string;
    player1_choice: RpsChoice;
    player2_choice: RpsChoice;
    winner_id: string | null;
    outcome: 'player1' | 'player2' | 'draw';
    completed_at: Date;
  }>(
    `SELECT id, player1_choice, player2_choice, winner_id, outcome, completed_at
     FROM rps_matches
     WHERE lobby_id = $1`,
    [lobbyId],
  );
  const match = matchResult.rows[0];
  if (!match) return state;
  const ledgerResult = await client.query<{ pool_amount: string; rake_amount: string }>(
    'SELECT pool_amount, rake_amount FROM rps_house_ledger WHERE match_id = $1',
    [match.id],
  );
  return {
    ...state,
    opponentMoveSubmitted: true,
    match: {
      id: match.id,
      player1Choice: match.player1_choice,
      player2Choice: match.player2_choice,
      winnerId: match.winner_id,
      outcome: match.outcome,
      poolAmount: ledgerResult.rows[0]
        ? Number(ledgerResult.rows[0].pool_amount)
        : Number(lobby.wager_amount) * 2,
      rakeAmount: ledgerResult.rows[0] ? Number(ledgerResult.rows[0].rake_amount) : 0,
      completedAt: new Date(match.completed_at).toISOString(),
    },
  };
}

function formatRpsWalletUnits(currency: RpsWagerCurrency, units: number) {
  return currency === 'cash'
    ? `$${(units / 100).toFixed(2)}`
    : `${units} points ($${(units / SURVEY_POINTS_PER_DOLLAR).toFixed(2)})`;
}

async function settleRpsLobbyMatch(
  client: PoolClient,
  lobby: RpsLobbyRow,
  moves: Array<{ user_id: string; choice: RpsChoice }>,
): Promise<{ settlement: RpsSettlement } | { error: string }> {
  const player1Move = moves.find((move) => move.user_id === lobby.player1_id);
  const player2Move = lobby.player2_id
    ? moves.find((move) => move.user_id === lobby.player2_id)
    : undefined;
  if (!lobby.player2_id || !player1Move || !player2Move) {
    return { error: 'Both players must submit a move before settlement.' };
  }
  const wager = parseRpsWager(Number(lobby.wager_amount), lobby.wager_currency);
  if (!wager) throw new Error(`Invalid persisted RPS wager for lobby ${lobby.id}.`);

  const player1Result = evaluateRpsOutcome(player1Move.choice, player2Move.choice);
  const outcome = player1Result === 'draw'
    ? 'draw'
    : player1Result === 'win' ? 'player1' : 'player2';
  const winnerId = outcome === 'player1'
    ? lobby.player1_id
    : outcome === 'player2' ? lobby.player2_id : null;
  const poolUnits = wager.units * 2;
  const rakeUnits = winnerId ? calculateRpsPvpRakeUnits(poolUnits) : 0;
  const payoutUnits = winnerId ? poolUnits - rakeUnits : 0;
  const userIds = [lobby.player1_id, lobby.player2_id];
  const locked = await lockRpsPlayerBalances(client, userIds, wager.currency, false);
  if (locked.error) return { error: locked.error };

  if (winnerId) {
    const winnerBalance = locked.balances.get(winnerId);
    const maximum = wager.currency === 'cash' ? RPS_MAX_CASH_BALANCE_CENTS : RPS_MAX_POINTS_BALANCE;
    if (winnerBalance === undefined || winnerBalance + payoutUnits > maximum) {
      return { error: 'The winner wallet cannot accept the match payout yet.' };
    }
  }

  const matchId = randomUUID();
  await client.query(
    `INSERT INTO rps_matches
      (id, lobby_id, player1_id, player2_id, player1_choice, player2_choice, winner_id, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      matchId,
      lobby.id,
      lobby.player1_id,
      lobby.player2_id,
      player1Move.choice,
      player2Move.choice,
      winnerId,
      outcome,
    ],
  );

  for (const playerId of userIds) {
    const isWinner = playerId === winnerId;
    const adjustment = outcome === 'draw'
      ? wager.units
      : isWinner ? payoutUnits : 0;
    if (!adjustment) continue;
    const updatedBalance = await updateRpsWallet(client, playerId, wager.currency, adjustment);
    if (updatedBalance === null) return { error: 'A player wallet cannot accept the match settlement.' };
    const transactionType = outcome === 'draw' ? 'PVP_DRAW' : 'PVP_WIN';
    const transactionPurpose = outcome === 'draw' ? 'refund' : 'payout';
    await insertRpsWalletTransaction(
      client,
      playerId,
      adjustment,
      transactionType,
      `pvp-rps:${lobby.id}:${transactionPurpose}:${playerId}`,
    );
  }

  if (winnerId) {
    await client.query(
      `INSERT INTO rps_house_ledger
        (id, match_id, winner_id, currency, pool_amount, rake_rate_bps, rake_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        matchId,
        winnerId,
        wager.currency,
        wager.currency === 'cash' ? poolUnits / 100 : poolUnits,
        RPS_PVP_RAKE_RATE_BPS,
        wager.currency === 'cash' ? rakeUnits / 100 : rakeUnits,
      ],
    );
  }

  const completed = await client.query(
    `UPDATE rps_lobbies
     SET state = 'completed', ended_reason = 'settled', updated_at = NOW()
     WHERE id = $1 AND state = 'active'`,
    [lobby.id],
  );
  if (completed.rowCount !== 1) throw new Error(`RPS lobby ${lobby.id} was not active during settlement.`);

  const notifications: RpsSettlement['notifications'] = [];
  for (const playerId of userIds) {
    const isWinner = playerId === winnerId;
    const isLoser = winnerId !== null && !isWinner;
    const title = outcome === 'draw'
      ? 'PvP RPS match tied'
      : `PvP RPS match ${isWinner ? 'won' : 'lost'}`;
    const message = outcome === 'draw'
      ? `The match tied. Your ${formatRpsWalletUnits(wager.currency, wager.units)} wager was returned.`
      : isWinner
        ? `You won the match and received ${formatRpsWalletUnits(wager.currency, payoutUnits)} after the 3% house rake.`
        : isLoser ? `You lost the match. Your ${formatRpsWalletUnits(wager.currency, wager.units)} wager was used.` : '';
    notifications.push({
      userId: playerId,
      notification: await insertNotification(client, playerId, title, message, 'PVP_ALERT'),
    });
  }

  return {
    settlement: {
      matchId,
      outcome,
      winnerId,
      poolUnits,
      rakeUnits,
      notifications,
    },
  };
}

let rpsLobbySweepRunning = false;

async function expireStaleRpsLobbies() {
  if (!database || rpsLobbySweepRunning) return;
  rpsLobbySweepRunning = true;
  try {
    const staleLobbies = await database.query<{ id: string }>(
      `SELECT id
       FROM rps_lobbies
       WHERE (state = 'active' AND updated_at <= NOW() - INTERVAL '${RPS_ACTIVE_MATCH_TIMEOUT_MINUTES} minutes')
          OR (state = 'waiting' AND created_at <= NOW() - INTERVAL '${RPS_WAITING_LOBBY_TIMEOUT_HOURS} hours')
       ORDER BY updated_at ASC
       LIMIT 50`,
    );
    for (const { id } of staleLobbies.rows) {
      let client: PoolClient;
      try {
        client = await database.connect();
      } catch (error) {
        console.error('Could not connect to expire stale PvP RPS rooms:', error);
        return;
      }
      try {
        await client.query('BEGIN');
        const lobbyResult = await client.query<RpsLobbyRow>(
          `SELECT id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at
           FROM rps_lobbies
           WHERE id = $1
             AND ((state = 'active' AND updated_at <= NOW() - INTERVAL '${RPS_ACTIVE_MATCH_TIMEOUT_MINUTES} minutes')
               OR (state = 'waiting' AND created_at <= NOW() - INTERVAL '${RPS_WAITING_LOBBY_TIMEOUT_HOURS} hours'))
           FOR UPDATE`,
          [id],
        );
        const lobby = lobbyResult.rows[0];
        if (!lobby) {
          await client.query('ROLLBACK');
          continue;
        }

        const notifications: Array<{ userId: string; notification: PlatformNotification }> = [];
        if (lobby.state === 'active' && lobby.player2_id) {
          const wager = parseRpsWager(Number(lobby.wager_amount), lobby.wager_currency);
          if (!wager) throw new Error(`Invalid persisted RPS wager for lobby ${lobby.id}.`);
          const userIds = [lobby.player1_id, lobby.player2_id];
          const locked = await lockRpsPlayerBalances(client, userIds, wager.currency, false);
          if (locked.error) throw new Error(locked.error);
          for (const userId of userIds) {
            const balance = await updateRpsWallet(client, userId, wager.currency, wager.units);
            if (balance === null) throw new Error(`Could not refund timed-out PvP wager for ${userId}.`);
            await insertRpsWalletTransaction(
              client,
              userId,
              wager.units,
              'PVP_REFUND',
              `pvp-rps:${lobby.id}:timeout-refund:${userId}`,
            );
            notifications.push({
              userId,
              notification: await insertNotification(
                client,
                userId,
                'PvP RPS match expired',
                `The match timed out. Your ${formatRpsWalletUnits(wager.currency, wager.units)} wager was returned.`,
                'PVP_ALERT',
              ),
            });
          }
          await client.query(
            `UPDATE rps_lobbies
             SET state = 'completed', ended_reason = 'expired', updated_at = NOW()
             WHERE id = $1`,
            [lobby.id],
          );
          await client.query('DELETE FROM rps_lobby_moves WHERE lobby_id = $1', [lobby.id]);
        } else {
          notifications.push({
            userId: lobby.player1_id,
            notification: await insertNotification(
              client,
              lobby.player1_id,
              'PvP RPS room expired',
              'The room was not matched within 24 hours and has been closed.',
              'SYSTEM',
            ),
          });
          await client.query(
            'DELETE FROM rps_lobbies WHERE id = $1 AND state = \'waiting\'',
            [lobby.id],
          );
        }

        await client.query('COMMIT');
        notifications.forEach(({ userId, notification }) => {
          broadcastUserNotification(userId, notification);
        });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error(`Could not expire PvP RPS room ${id}:`, error);
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('Could not scan for stale PvP RPS rooms:', error);
  } finally {
    rpsLobbySweepRunning = false;
  }
}

function startRpsLobbyTimeoutWorker() {
  if (!database) return;
  const timer = setInterval(() => {
    void expireStaleRpsLobbies();
  }, 30_000);
  timer.unref();
  void expireStaleRpsLobbies();
}

app.post('/api/games/rps/play', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in before playing.' });
  if (!database) return res.status(503).json({ error: 'Games require the production account database.' });

  const playerChoice = req.body?.choice;
  const entryBet = req.body?.entryBet === undefined ? RPS_DEFAULT_ENTRY_CENTS / 100 : req.body.entryBet;
  if (!isRpsChoice(playerChoice)) {
    return res.status(400).json({ error: 'Choose rock, paper, or scissors.' });
  }
  if (typeof entryBet !== 'number' || !Number.isFinite(entryBet) || entryBet <= 0) {
    return res.status(400).json({ error: 'Entry bet must be a positive amount in dollars.' });
  }
  const entryCents = Math.round(entryBet * 100);
  const entryPoints = Math.round((entryCents * SURVEY_POINTS_PER_DOLLAR) / 100);
  if (
    Math.abs(entryBet * 100 - entryCents) > 1e-7 ||
    !Number.isSafeInteger(entryPoints) ||
    entryPoints <= 0 ||
    entryPoints > Math.floor(2147483647 / 2)
  ) {
    return res.status(400).json({ error: 'Entry bet must be a valid amount to the nearest cent.' });
  }

  const suppliedIdempotencyKey = req.header('Idempotency-Key')?.trim();
  if (!suppliedIdempotencyKey || !/^[A-Za-z0-9._:-]{1,200}$/.test(suppliedIdempotencyKey)) {
    return res.status(400).json({ error: 'Provide an Idempotency-Key of 1–200 letters, numbers, dots, underscores, colons, or hyphens.' });
  }
  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the wallet database for RPS:', error);
    return res.status(500).json({ error: 'Could not process the game.' });
  }
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO survey_reward_balances (user_id, points)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    );
    const balanceResult = await client.query<{ points: number }>(
      'SELECT points FROM survey_reward_balances WHERE user_id = $1 FOR UPDATE',
      [user.id],
    );
    const points = Number(balanceResult.rows[0]?.points || 0);
    const existingGame = await client.query<{
      id: string;
      player_choice: RpsChoice;
      opponent_choice: RpsChoice;
      opponent_username: string;
      outcome: RpsOutcome;
      entry_points: number;
      payout_points: number;
    }>(
      `SELECT id, player_choice, opponent_choice, opponent_username, outcome, entry_points, payout_points
       FROM game_rps_games
       WHERE user_id = $1 AND idempotency_key = $2`,
      [user.id, suppliedIdempotencyKey],
    );
    if (existingGame.rows[0]) {
      const game = existingGame.rows[0];
      if (game.player_choice !== playerChoice || Number(game.entry_points) !== entryPoints) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Idempotency-Key was already used for a different game request.' });
      }
      await client.query('COMMIT');
      return res.json({
        gameId: game.id,
        choice: game.player_choice,
        opponent: { username: game.opponent_username, choice: game.opponent_choice },
        outcome: game.outcome,
        entryBet: Number(game.entry_points) / SURVEY_POINTS_PER_DOLLAR,
        payout: Number(game.payout_points) / SURVEY_POINTS_PER_DOLLAR,
        balancePoints: points,
        balanceDollars: points / SURVEY_POINTS_PER_DOLLAR,
      });
    }
    if (points < entryPoints) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient wallet balance.',
        balancePoints: points,
        balanceDollars: points / SURVEY_POINTS_PER_DOLLAR,
      });
    }

    const opponentChoice = RPS_CHOICES[randomInt(RPS_CHOICES.length)];
    const opponentUsername = getRpsOpponentUsername();
    const outcome = evaluateRpsOutcome(playerChoice, opponentChoice);
    const winPotPoints = (RPS_WIN_POT_CENTS * SURVEY_POINTS_PER_DOLLAR) / 100;
    const payoutPoints = outcome === 'win'
      ? winPotPoints
      : outcome === 'draw'
        ? entryPoints
        : 0;
    const updatedBalance = points - entryPoints + payoutPoints;
    if (updatedBalance > 2147483647) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payout exceeds the wallet balance limit.' });
    }

    const gameId = randomUUID();
    await client.query(
      `INSERT INTO game_rps_games
        (id, user_id, idempotency_key, player_choice, opponent_choice, opponent_username, outcome, entry_points, payout_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gameId, user.id, suppliedIdempotencyKey, playerChoice, opponentChoice, opponentUsername, outcome, entryPoints, payoutPoints],
    );
    const ledgerAmount = outcome === 'win'
      ? RPS_WIN_POT_CENTS / 100
      : outcome === 'draw'
        ? 0
        : -entryCents / 100;
    const ledgerType = outcome === 'win' ? 'PVP_WIN' : outcome === 'draw' ? 'PVP_DRAW' : 'PVP_LOSS';
    await client.query(
      `INSERT INTO transactions (id, user_id, amount, type, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), user.id, ledgerAmount, ledgerType, `rps-game:${gameId}`],
    );
    const updated = await client.query<{ points: number }>(
      `UPDATE survey_reward_balances
       SET points = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING points`,
      [user.id, updatedBalance],
    );
    const outcomeLabel = outcome === 'win' ? 'won' : outcome === 'draw' ? 'drew' : 'lost';
    const notification = await insertNotification(
      client,
      user.id,
      `RPS match ${outcomeLabel}`,
      `You ${outcomeLabel} against ${opponentUsername}. ${outcome === 'win'
        ? `You received $${(payoutPoints / SURVEY_POINTS_PER_DOLLAR).toFixed(2)}.`
        : outcome === 'draw'
          ? 'Your entry fee was returned.'
          : `Your $${(entryPoints / SURVEY_POINTS_PER_DOLLAR).toFixed(2)} entry was used.`}`,
      'PVP_ALERT',
    );
    await client.query('COMMIT');
    broadcastUserNotification(user.id, notification);
    return res.json({
      gameId,
      choice: playerChoice,
      opponent: { username: opponentUsername, choice: opponentChoice },
      outcome,
      entryBet: entryPoints / SURVEY_POINTS_PER_DOLLAR,
      payout: payoutPoints / SURVEY_POINTS_PER_DOLLAR,
      balancePoints: updated.rows[0].points,
      balanceDollars: updated.rows[0].points / SURVEY_POINTS_PER_DOLLAR,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not process RPS game:', error);
    return res.status(500).json({ error: 'Could not process the game.' });
  } finally {
    client.release();
  }
});

app.post('/api/v1/rps/lobbies', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in before creating a PvP room.' });
  if (!database) return res.status(503).json({ error: 'PvP matchmaking requires the production account database.' });
  const wager = parseRpsWager(req.body?.wagerAmount, req.body?.currency);
  if (!wager) {
    return res.status(400).json({
      error: 'Enter a valid wager: at least $0.50 or 50 points, using cash or points.',
    });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the PvP wallet database:', error);
    return res.status(503).json({ error: 'PvP matchmaking is temporarily unavailable.' });
  }
  try {
    await client.query('BEGIN');
    const locked = await lockRpsPlayerBalances(client, [user.id], wager.currency);
    if (locked.error) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: locked.error });
    }
    const availableUnits = locked.balances.get(user.id) || 0;
    if (availableUnits < wager.units) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient balance for this wager.',
        currency: wager.currency,
        balance: wager.currency === 'cash' ? availableUnits / 100 : availableUnits,
      });
    }

    const lobbyId = randomUUID();
    const lobby = await client.query<RpsLobbyRow>(
      `INSERT INTO rps_lobbies
        (id, player1_id, wager_amount, wager_currency, state)
       VALUES ($1, $2, $3, $4, 'waiting')
       RETURNING id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at`,
      [lobbyId, user.id, wager.amount, wager.currency],
    );
    await client.query('COMMIT');
    return res.status(201).json({
      lobby: {
        id: lobby.rows[0].id,
        state: lobby.rows[0].state,
        wagerAmount: Number(lobby.rows[0].wager_amount),
        currency: lobby.rows[0].wager_currency,
        createdAt: new Date(lobby.rows[0].created_at).toISOString(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not create PvP RPS lobby:', error);
    return res.status(500).json({ error: 'Could not create the PvP room.' });
  } finally {
    client.release();
  }
});

app.get('/api/v1/rps/lobbies', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to browse PvP rooms.' });
  if (!database) return res.status(503).json({ error: 'PvP matchmaking requires the production account database.' });
  try {
    const result = await database.query<{
      id: string;
      username: string | null;
      wager_amount: string;
      wager_currency: RpsWagerCurrency;
      created_at: Date;
    }>(
      `SELECT lobbies.id, users.username, lobbies.wager_amount, lobbies.wager_currency, lobbies.created_at
       FROM rps_lobbies AS lobbies
       JOIN users ON users.id = lobbies.player1_id
       WHERE lobbies.state = 'waiting' AND lobbies.player1_id <> $1
       ORDER BY lobbies.created_at ASC
       LIMIT 50`,
      [user.id],
    );
    return res.json({
      lobbies: result.rows.map((lobby) => ({
        id: lobby.id,
        player1Username: lobby.username || 'Player',
        wagerAmount: Number(lobby.wager_amount),
        currency: lobby.wager_currency,
        createdAt: new Date(lobby.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Could not load open PvP RPS lobbies:', error);
    return res.status(500).json({ error: 'Could not load open PvP rooms.' });
  }
});

app.post('/api/v1/rps/lobbies/:id/join', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in before joining a PvP room.' });
  if (!database) return res.status(503).json({ error: 'PvP matchmaking requires the production account database.' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Provide a valid PvP room ID.' });
  }
  const requestedWager = parseRpsWager(req.body?.wagerAmount, req.body?.currency);
  if (!requestedWager) {
    return res.status(400).json({ error: 'Provide the room wager using a valid amount and currency.' });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the PvP wallet database:', error);
    return res.status(503).json({ error: 'PvP matchmaking is temporarily unavailable.' });
  }
  try {
    await client.query('BEGIN');
    const lobbyResult = await client.query<RpsLobbyRow>(
      `SELECT id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at
       FROM rps_lobbies
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const lobby = lobbyResult.rows[0];
    if (!lobby) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PvP room not found.' });
    }
    if (lobby.state === 'active' && lobby.player2_id === user.id) {
      await client.query('COMMIT');
      const state = await loadRpsLobbyState(client, lobby.id, user.id);
      return res.json(state);
    }
    if (lobby.state !== 'waiting') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This PvP room is no longer open.' });
    }
    if (lobby.player1_id === user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot join your own PvP room.' });
    }
    const lobbyWager = parseRpsWager(Number(lobby.wager_amount), lobby.wager_currency);
    if (!lobbyWager) throw new Error(`Invalid persisted RPS wager for lobby ${lobby.id}.`);
    if (requestedWager.currency !== lobbyWager.currency || requestedWager.units !== lobbyWager.units) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested wager does not match this room.' });
    }

    const playerIds = [lobby.player1_id, user.id];
    const locked = await lockRpsPlayerBalances(client, playerIds, lobbyWager.currency);
    if (locked.error) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: locked.error });
    }
    const playerBalances = playerIds.map((playerId) => locked.balances.get(playerId) || 0);
    if (playerBalances.some((balance) => balance < lobbyWager.units)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Both players must still have enough balance to start this match.' });
    }

    const poolUnits = lobbyWager.units * 2;
    const rakeUnits = calculateRpsPvpRakeUnits(poolUnits);
    const winningPayoutUnits = poolUnits - rakeUnits;
    const maximum = lobbyWager.currency === 'cash' ? RPS_MAX_CASH_BALANCE_CENTS : RPS_MAX_POINTS_BALANCE;
    if (playerBalances.some((balance) => balance - lobbyWager.units + winningPayoutUnits > maximum)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A player wallet cannot accept the possible match payout.' });
    }

    for (const playerId of playerIds) {
      const balance = await updateRpsWallet(client, playerId, lobbyWager.currency, -lobbyWager.units);
      if (balance === null) throw new Error(`Could not reserve PvP wager for ${playerId}.`);
      await insertRpsWalletTransaction(
        client,
        playerId,
        -lobbyWager.units,
        'PVP_WAGER',
        `pvp-rps:${lobby.id}:wager:${playerId}`,
      );
    }
    await client.query(
      `UPDATE rps_lobbies
       SET player2_id = $2, state = 'active', updated_at = NOW()
       WHERE id = $1`,
      [lobby.id, user.id],
    );
    await client.query('COMMIT');
    const state = await loadRpsLobbyState(client, lobby.id, user.id);
    return res.status(200).json(state);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not join PvP RPS lobby:', error);
    return res.status(500).json({ error: 'Could not join the PvP room.' });
  } finally {
    client.release();
  }
});

app.get('/api/v1/rps/lobbies/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view this PvP room.' });
  if (!database) return res.status(503).json({ error: 'PvP matchmaking requires the production account database.' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Provide a valid PvP room ID.' });
  }
  try {
    const client = await database.connect();
    try {
      const state = await loadRpsLobbyState(client, req.params.id, user.id);
      if (!state) return res.status(404).json({ error: 'PvP room not found.' });
      return res.json(state);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Could not load PvP RPS lobby state:', error);
    return res.status(500).json({ error: 'Could not load the PvP room.' });
  }
});

app.post('/api/v1/rps/lobbies/:id/moves', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in before submitting a PvP move.' });
  if (!database) return res.status(503).json({ error: 'PvP matchmaking requires the production account database.' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Provide a valid PvP room ID.' });
  }
  if (!isRpsChoice(req.body?.choice)) {
    return res.status(400).json({ error: 'Choose rock, paper, or scissors.' });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the PvP game database:', error);
    return res.status(503).json({ error: 'PvP matchmaking is temporarily unavailable.' });
  }
  try {
    await client.query('BEGIN');
    const lobbyResult = await client.query<RpsLobbyRow>(
      `SELECT id, player1_id, player2_id, wager_amount, wager_currency, state, ended_reason, created_at
       FROM rps_lobbies
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const lobby = lobbyResult.rows[0];
    if (!lobby || (lobby.player1_id !== user.id && lobby.player2_id !== user.id)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'PvP room not found.' });
    }
    if (lobby.state === 'completed') {
      await client.query('COMMIT');
      return res.json(await loadRpsLobbyState(client, lobby.id, user.id));
    }
    if (lobby.state !== 'active' || !lobby.player2_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Wait for another player to join before submitting a move.' });
    }

    const inserted = await client.query<{ choice: RpsChoice }>(
      `INSERT INTO rps_lobby_moves (lobby_id, user_id, choice)
       VALUES ($1, $2, $3)
       ON CONFLICT (lobby_id, user_id) DO NOTHING
       RETURNING choice`,
      [lobby.id, user.id, req.body.choice],
    );
    if (!inserted.rowCount) {
      const priorMove = await client.query<{ choice: RpsChoice }>(
        'SELECT choice FROM rps_lobby_moves WHERE lobby_id = $1 AND user_id = $2',
        [lobby.id, user.id],
      );
      if (priorMove.rows[0]?.choice !== req.body.choice) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Your move is already locked and cannot be changed.' });
      }
    } else {
      await client.query(
        'UPDATE rps_lobbies SET updated_at = NOW() WHERE id = $1 AND state = \'active\'',
        [lobby.id],
      );
    }

    const moves = await client.query<{ user_id: string; choice: RpsChoice }>(
      'SELECT user_id, choice FROM rps_lobby_moves WHERE lobby_id = $1',
      [lobby.id],
    );
    if (moves.rowCount < 2) {
      await client.query('COMMIT');
      return res.status(202).json(await loadRpsLobbyState(client, lobby.id, user.id));
    }
    const result = await settleRpsLobbyMatch(client, lobby, moves.rows);
    if ('error' in result) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: result.error });
    }
    await client.query('COMMIT');
    result.settlement.notifications.forEach(({ userId, notification }) => {
      broadcastUserNotification(userId, notification);
    });
    return res.json(await loadRpsLobbyState(client, lobby.id, user.id));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not submit PvP RPS move:', error);
    return res.status(500).json({ error: 'Could not submit your move.' });
  } finally {
    client.release();
  }
});

app.get('/api/v1/notifications', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view notifications.' });
  if (!database) return res.status(503).json({ error: 'Notifications require the production account database.' });
  try {
    const result = await database.query<PlatformNotification>(
      `SELECT id, title, message, is_read, type, created_at
       FROM notifications
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 100`,
      [user.id],
    );
    return res.json({
      notifications: result.rows.map((notification) => ({
        ...notification,
        created_at: new Date(notification.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Could not load user notifications:', error);
    return res.status(500).json({ error: 'Could not load notifications.' });
  }
});

app.patch('/api/v1/notifications/:id', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to update notifications.' });
  if (!database) return res.status(503).json({ error: 'Notifications require the production account database.' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Provide a valid notification ID.' });
  }
  if (typeof req.body?.is_read !== 'boolean') {
    return res.status(400).json({ error: 'is_read must be a boolean.' });
  }
  try {
    const result = await database.query<PlatformNotification>(
      `UPDATE notifications
       SET is_read = $3
       WHERE id = $1 AND user_id = $2 AND created_at >= NOW() - INTERVAL '30 days'
       RETURNING id, title, message, is_read, type, created_at`,
      [req.params.id, user.id, req.body.is_read],
    );
    const notification = result.rows[0];
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    return res.json({
      notification: {
        ...notification,
        created_at: new Date(notification.created_at).toISOString(),
      },
    });
  } catch (error) {
    console.error('Could not update user notification:', error);
    return res.status(500).json({ error: 'Could not update notification.' });
  }
});

app.get('/api/offers/milestones', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view offer milestones.' });
  if (!database) return res.status(503).json({ error: 'Milestones require the production account database.' });
  try {
    const result = await database.query<{
      offer_id: string;
      stage: number;
      level: number;
      reward_points: number;
      description: string;
      current_level: number;
      claimed: boolean;
    }>(
      `SELECT tiers.offer_id, tiers.stage, tiers.level, tiers.reward_points, tiers.description,
              COALESCE(progress.current_level, 0) AS current_level,
              (claims.stage IS NOT NULL) AS claimed
       FROM offer_milestone_tiers AS tiers
       LEFT JOIN user_offer_milestone_progress AS progress
         ON progress.user_id = $1 AND progress.offer_id = tiers.offer_id
       LEFT JOIN user_offer_milestone_claims AS claims
         ON claims.user_id = $1 AND claims.offer_id = tiers.offer_id AND claims.stage = tiers.stage
       WHERE tiers.active = TRUE
       ORDER BY tiers.offer_id, tiers.stage`,
      [user.id],
    );
    const campaignResult = await database.query<{
      id: string;
      title: string;
      description: string;
      category: OfferCampaign['category'];
      total_value: string;
      milestones: OfferMilestone[];
      tracking_parameters: Record<string, string>;
      active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, title, description, category, total_value, milestones, tracking_parameters, active, created_at, updated_at
       FROM offer_campaigns
       WHERE active = TRUE
       ORDER BY updated_at DESC`,
    );
    const progressByTier = new Map(result.rows.map((tier) => [`${tier.offer_id}:${tier.stage}`, tier]));
    return res.json({
      milestones: result.rows.map((tier) => ({
        offerId: tier.offer_id,
        stage: tier.stage,
        level: tier.level,
        description: tier.description,
        rewardPoints: Number(tier.reward_points),
        rewardDollars: Number(tier.reward_points) / SURVEY_POINTS_PER_DOLLAR,
        currentLevel: Number(tier.current_level),
        claimed: tier.claimed,
      })),
      campaigns: campaignResult.rows.map((row) => {
        const campaign: OfferCampaign = {
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category,
          total_value: Number(row.total_value),
          milestones: row.milestones,
          tracking_parameters: row.tracking_parameters,
          active: row.active,
          created_at: new Date(row.created_at).toISOString(),
          updated_at: new Date(row.updated_at).toISOString(),
        };
        return {
          id: campaign.id,
          title: campaign.title,
          description: campaign.description,
          category: campaign.category,
          total_value: campaign.total_value,
          active: campaign.active,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
          milestones: campaign.milestones.map((tier) => {
            const progress = progressByTier.get(`${campaign.id}:${tier.step_number}`);
            return {
              ...tier,
              current_level: Number(progress?.current_level || 0),
              claimed: Boolean(progress?.claimed),
            };
          }),
        };
      }),
    });
  } catch (error) {
    console.error('Could not load offer milestones:', error);
    return res.status(500).json({ error: 'Could not load offer milestones.' });
  }
});

app.post('/api/offers/milestones', async (req, res) => {
  if (!milestoneCallbackSecret) {
    return res.status(503).json({ error: 'Milestone callbacks are not configured.' });
  }
  if (!database) return res.status(503).json({ error: 'Milestone callbacks require the production account database.' });

  const timestamp = req.header('X-Milestone-Timestamp') || '';
  const eventId = req.header('X-Milestone-Event-Id') || '';
  const signature = req.header('X-Milestone-Signature') || '';
  const userId = req.body?.userId;
  const offerId = req.body?.offerId;
  const level = req.body?.level;
  const timestampMs = /^\d{13}$/.test(timestamp) ? Number(timestamp) : Number.NaN;
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(eventId) ||
    typeof userId !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(userId) ||
    typeof offerId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(offerId) ||
    typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1 || level > 1000000 ||
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000 ||
    !isValidMilestoneSignature(timestamp, eventId, userId, offerId, level, signature)
  ) {
    return res.status(401).json({ error: 'Invalid or expired milestone callback.' });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the wallet database for milestone callback:', error);
    return res.status(500).json({ error: 'Could not apply offer milestone.' });
  }
  try {
    await client.query('BEGIN');
    const userResult = await client.query<{ account_status: string }>(
      'SELECT account_status FROM users WHERE id = $1',
      [userId],
    );
    if (!userResult.rows[0] || userResult.rows[0].account_status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Milestone account was not found.' });
    }
    const tiersResult = await client.query<{
      stage: number;
      level: number;
      reward_points: number;
    }>(
      `SELECT stage, level, reward_points
       FROM offer_milestone_tiers
       WHERE offer_id = $1 AND active = TRUE
       ORDER BY level`,
      [offerId],
    );
    if (!tiersResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Milestone offer was not found.' });
    }

    await client.query(
      `INSERT INTO user_offer_milestone_progress (user_id, offer_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, offer_id) DO NOTHING`,
      [userId, offerId],
    );
    const progressResult = await client.query<{ current_level: number }>(
      `SELECT current_level FROM user_offer_milestone_progress
       WHERE user_id = $1 AND offer_id = $2
       FOR UPDATE`,
      [userId, offerId],
    );
    const currentLevel = Number(progressResult.rows[0].current_level);
    const recordedEvent = await client.query(
      `INSERT INTO offer_milestone_events (event_id, user_id, offer_id, level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, userId, offerId, level],
    );
    if (!recordedEvent.rowCount) {
      await client.query('ROLLBACK');
      return res.json({ duplicate: true, eventId });
    }

    const credited = [];
    let rewardPoints = 0;
    if (level > currentLevel) {
      for (const tier of tiersResult.rows) {
        if (Number(tier.level) <= currentLevel || Number(tier.level) > level) continue;
        const insertedClaim = await client.query(
          `INSERT INTO user_offer_milestone_claims
            (user_id, offer_id, stage, level, reward_points, event_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, offer_id, stage) DO NOTHING
           RETURNING stage`,
          [userId, offerId, tier.stage, tier.level, tier.reward_points, eventId],
        );
        if (insertedClaim.rowCount) {
          const points = Number(tier.reward_points);
          rewardPoints += points;
          credited.push({
            stage: Number(tier.stage),
            level: Number(tier.level),
            rewardPoints: points,
            rewardDollars: points / SURVEY_POINTS_PER_DOLLAR,
          });
        }
      }
      await client.query(
        `UPDATE user_offer_milestone_progress
         SET current_level = $3, updated_at = NOW()
         WHERE user_id = $1 AND offer_id = $2`,
        [userId, offerId, level],
      );
    }

    let balancePoints: number | null = null;
    let notification: PlatformNotification | null = null;
    if (rewardPoints > 0) {
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const balanceResult = await client.query<{ points: number }>(
        `UPDATE survey_reward_balances
         SET points = points + $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING points`,
        [userId, rewardPoints],
      );
      balancePoints = Number(balanceResult.rows[0].points);
      notification = await insertNotification(
        client,
        userId,
        'Offer milestone credited',
        `You earned $${(rewardPoints / SURVEY_POINTS_PER_DOLLAR).toFixed(2)} from ${offerId} milestones.`,
        'CREDIT_ALERT',
      );
    }
    await client.query('COMMIT');
    if (notification) broadcastUserNotification(userId, notification);
    return res.json({
      eventId,
      currentLevel: Math.max(currentLevel, level),
      credited,
      creditedPoints: rewardPoints,
      creditedDollars: rewardPoints / SURVEY_POINTS_PER_DOLLAR,
      ...(balancePoints === null ? {} : { balancePoints, balanceDollars: balancePoints / SURVEY_POINTS_PER_DOLLAR }),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not apply offer milestone callback:', error);
    return res.status(500).json({ error: 'Could not apply offer milestone.' });
  } finally {
    client.release();
  }
});

async function handleAffiliatePostback(req: express.Request, res: express.Response) {
  if (!postbackSecret) return res.status(503).type('text').send('Postback is not configured');
  const params = req.method === 'GET' ? req.query : req.body;
  if (!isRecord(params)) return res.status(400).type('text').send('Invalid postback');

  const clickId = typeof params.click_id === 'string' ? params.click_id.trim() : '';
  const userId = typeof params.user_id === 'string' ? params.user_id.trim() : '';
  const offerId = typeof params.offer_id === 'string' ? params.offer_id.trim() : '';
  const subId1 = typeof params.subid1 === 'string' ? params.subid1.trim() : '';
  const subId2 = typeof params.subid2 === 'string' ? params.subid2.trim() : '';
  const stepValue = params.milestone_step;
  const stepText = typeof stepValue === 'number' ? String(stepValue) : typeof stepValue === 'string' ? stepValue.trim() : '';
  const payoutValue = params.payout;
  const payoutText = typeof payoutValue === 'number' ? String(payoutValue) : typeof payoutValue === 'string' ? payoutValue.trim() : '';
  const signature = typeof params.signature === 'string'
    ? params.signature.trim()
    : req.header('X-Postback-Signature')?.trim() || '';
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(clickId) ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(userId) ||
    !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(offerId) ||
    !/^\d{1,10}$/.test(stepText) ||
    !/^\d+(?:\.\d{1,2})?$/.test(payoutText)
  ) {
    return res.status(400).type('text').send('Invalid postback');
  }

  const milestoneStep = Number(stepText);
  const payoutAmount = Number(payoutText);
  const payoutCents = Math.round(payoutAmount * 100);
  if (
    !Number.isSafeInteger(milestoneStep) || milestoneStep < 1 || milestoneStep > 2147483647 ||
    !Number.isFinite(payoutAmount) || payoutCents < 1 || payoutCents > 2147483647 ||
    Math.abs(payoutAmount * 100 - payoutCents) > 1e-7
  ) {
    return res.status(400).type('text').send('Invalid postback');
  }
  if (!isValidPostbackSignature(clickId, userId, offerId, milestoneStep, payoutCents, signature)) {
    await recordOfferSecurityEvent(offerId, 'signature_mismatch');
    return res.status(403).type('text').send('Invalid postback signature');
  }
  if (!database) return res.status(503).type('text').send('Postback storage is unavailable');

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the postback database:', error);
    return res.status(503).type('text').send('Postback storage is unavailable');
  }

  const referenceId = `postback:${clickId}:${offerId}:${milestoneStep}`;
  let liveOfferCredit: LiveOfferCredit | null = null;
  try {
    await client.query('BEGIN');
    if (!subId1 || !subId2 || subId1 !== userId || subId2 !== clickId) {
      await client.query('ROLLBACK');
      return res.status(403).type('text').send('Postback Sub-ID sequence is missing or mismatched');
    }
    const clickSequence = await client.query<{ click_uuid: string }>(
      `SELECT click_uuid
       FROM click_logs
       WHERE click_uuid = $1 AND user_id = $2 AND offer_id = $3
       LIMIT 1`,
      [subId2, subId1, offerId],
    );
    if (!clickSequence.rows[0]) {
      await client.query('ROLLBACK');
      await recordOfferSecurityEvent(offerId, 'security_failure');
      return res.status(403).type('text').send('Postback click sequence is not active');
    }
    const previousTransaction = await client.query<{ user_id: string; amount: string; type: string }>(
      'SELECT user_id, amount, type FROM transactions WHERE reference_id = $1 FOR UPDATE',
      [referenceId],
    );
    if (previousTransaction.rows[0]) {
      const previous = previousTransaction.rows[0];
      if (previous.user_id !== userId || previous.type !== 'OFFER_COMPLETION' || Math.round(Number(previous.amount) * 100) !== payoutCents) {
        await client.query('ROLLBACK');
        return res.status(403).type('text').send('Postback reference conflicts with a prior transaction');
      }
      await client.query('COMMIT');
      return res.status(200).type('text').send('1');
    }

    const userResult = await client.query<{
      balance: string;
      username: string | null;
      account_status: 'active' | 'blocked';
      is_banned: boolean;
    }>(
      'SELECT balance, username, account_status, is_banned FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    const user = userResult.rows[0];
    if (!user || user.account_status !== 'active' || user.is_banned) {
      await client.query('ROLLBACK');
      return res.status(403).type('text').send('Postback account is not eligible');
    }

    const tierResult = await client.query<{ reward_points: number; active: boolean }>(
      `SELECT reward_points, active
       FROM offer_milestone_tiers
       WHERE offer_id = $1 AND stage = $2
       FOR SHARE`,
      [offerId, milestoneStep],
    );
    const tier = tierResult.rows[0];
    if (!tier || !tier.active || Number(tier.reward_points) !== payoutCents) {
      await client.query('ROLLBACK');
      return res.status(403).type('text').send('Postback milestone is not eligible');
    }

    const currentBalanceCents = Math.round(Number(user.balance) * 100);
    if (!Number.isSafeInteger(currentBalanceCents) || currentBalanceCents < 0 || currentBalanceCents + payoutCents > 999999999999) {
      await client.query('ROLLBACK');
      return res.status(400).type('text').send('Postback payout exceeds the wallet limit');
    }

    const inserted = await client.query(
      `INSERT INTO transactions (id, user_id, amount, type, reference_id)
       VALUES ($1, $2, $3, 'OFFER_COMPLETION', $4)
       ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [randomUUID(), userId, payoutCents / 100, referenceId],
    );
    if (!inserted.rowCount) {
      const conflictingTransaction = await client.query<{ user_id: string; amount: string; type: string }>(
        'SELECT user_id, amount, type FROM transactions WHERE reference_id = $1',
        [referenceId],
      );
      const previous = conflictingTransaction.rows[0];
      if (!previous || previous.user_id !== userId || previous.type !== 'OFFER_COMPLETION' || Math.round(Number(previous.amount) * 100) !== payoutCents) {
        await client.query('ROLLBACK');
        return res.status(403).type('text').send('Postback reference conflicts with a prior transaction');
      }
      await client.query('COMMIT');
      return res.status(200).type('text').send('1');
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET balance = balance + $2, updated_at = NOW()
       WHERE id = $1 AND account_status = 'active' AND is_banned = FALSE
       RETURNING id`,
      [userId, payoutCents / 100],
    );
    if (updatedUser.rowCount !== 1) throw new Error('Postback account became ineligible during credit.');
    const notification = await insertNotification(
      client,
      userId,
      'Offer reward credited',
      `You earned $${(payoutCents / 100).toFixed(2)} from ${offerId}.`,
      'CREDIT_ALERT',
    );
    const offerName = await getLiveOfferName(client, offerId, offerId);
    liveOfferCredit = await insertLiveOfferCredit(client, {
      reference: referenceId,
      userId,
      username: user.username,
      offerwall: 'Affiliate network',
      offer: offerName,
      payoutAmount: payoutCents / 100,
    });
    const referee = await client.query<{ referred_by: string | null; referred_by_user_id: string | null }>(
      'SELECT referred_by, referred_by_user_id FROM users WHERE id = $1',
      [userId],
    );
    const referrerId = referee.rows[0]?.referred_by || referee.rows[0]?.referred_by_user_id || null;
    if (referrerId) {
      const commissionCents = Math.round(payoutCents * referralCommissionPercent / 100);
      if (commissionCents > 0) {
        const commissionAmount = commissionCents / 100;
        const ledgerInsert = await client.query(
          `INSERT INTO referrals_ledger
            (id, referrer_id, referee_id, original_transaction_id, commission_amount)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (original_transaction_id) DO NOTHING
           RETURNING id`,
          [randomUUID(), referrerId, userId, referenceId, commissionAmount],
        );
        if (ledgerInsert.rowCount) {
          await client.query(
            `UPDATE users
             SET balance = balance + $2, updated_at = NOW()
             WHERE id = $1 AND account_status = 'active' AND is_banned = FALSE`,
            [referrerId, commissionAmount],
          );
          await client.query(
            `INSERT INTO transactions
              (id, user_id, amount, type, reference_id)
             VALUES ($1, $2, $3, 'REFERRAL_COMMISSION', $4)
             ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
            [randomUUID(), referrerId, commissionAmount, `referral:${referenceId}:${referrerId}`],
          );
        }
      }
    }
    await client.query('COMMIT');
    broadcastUserNotification(userId, notification);
    if (liveOfferCredit) broadcastLiveOfferCredit(liveOfferCredit);
    broadcastLiveActivity({
      id: randomUUID(),
      type: 'offer_credit',
      handle: `m_${userId.slice(-4).replace(/[^a-z0-9]/gi, '*')}***`,
      amount: payoutCents / 100,
      amountText: `$${(payoutCents / 100).toFixed(2)}`,
      method: 'Offer reward',
      tag: offerId.slice(0, 24),
      timestamp: new Date().toISOString(),
    });
    return res.status(200).type('text').send('1');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not process affiliate postback:', error);
    return res.status(500).type('text').send('Postback could not be processed');
  } finally {
    client.release();
  }
}

app.get('/api/v1/callbacks/postback', handleAffiliatePostback);
app.post('/api/v1/callbacks/postback', handleAffiliatePostback);

app.get('/api/live-offers', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=15');
  if (!database) {
    const offers = [...liveOfferCreditsMemory.values()]
      .sort((left, right) => Date.parse(right.creditedAt) - Date.parse(left.creditedAt))
      .slice(0, 15);
    return res.json({ offers });
  }
  try {
    const result = await database.query<{
      id: string;
      masked_username: string;
      offerwall_name: string;
      offer_name: string;
      payout_amount: string;
      credited_at: Date;
    }>(
      `SELECT id, masked_username, offerwall_name, offer_name, payout_amount, credited_at
       FROM live_offer_credits
       ORDER BY credited_at DESC
       LIMIT 15`,
    );
    return res.json({
      offers: result.rows.map((row) => ({
        id: row.id,
        username: row.masked_username,
        offerwall: row.offerwall_name,
        offer: row.offer_name,
        payoutAmount: Number(row.payout_amount),
        creditedAt: new Date(row.credited_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Could not load the public live-offer feed:', error);
    return res.status(503).json({ error: 'The live-offer feed is temporarily unavailable.' });
  }
});

app.get('/api/rewards/wallet', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view your points wallet.' });
  if (!database) return res.status(503).json({ error: 'The points wallet requires the production account database.' });
  try {
    const [balance, payouts] = await Promise.all([
      database.query<{ points: number }>(
        'SELECT points FROM survey_reward_balances WHERE user_id = $1',
        [user.id],
      ),
      database.query<{ id: string; points: number; status: 'pending' | 'processing' | 'paid' | 'rejected'; created_at: Date | string }>(
        `SELECT id, points, status, created_at
         FROM survey_payout_requests
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id],
      ),
    ]);
    const points = Number(balance.rows[0]?.points || 0);
    return res.json({
      points,
      dollars: points / SURVEY_POINTS_PER_DOLLAR,
      pointsPerDollar: SURVEY_POINTS_PER_DOLLAR,
      minimumPayoutPoints: SURVEY_MINIMUM_PAYOUT_POINTS,
      payoutRequests: payouts.rows.map((request) => ({
        id: request.id,
        points: Number(request.points),
        status: request.status,
        createdAt: new Date(request.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Could not load points wallet:', error);
    return res.status(500).json({ error: 'Could not load your points wallet.' });
  }
});

app.get('/api/rewards/daily-spin', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view your daily spin.' });
  if (!database) return res.status(503).json({ error: 'Daily rewards require the production account database.' });
  const claimDate = getUtcDailyKey();
  try {
    const [claim, balance] = await Promise.all([
      database.query<{ reward_points: number }>(
        'SELECT reward_points FROM daily_reward_claims WHERE user_id = $1 AND claim_date = $2',
        [user.id, claimDate],
      ),
      database.query<{ points: number }>(
        'SELECT points FROM survey_reward_balances WHERE user_id = $1',
        [user.id],
      ),
    ]);
    const nextSpinAt = new Date(new Date(`${claimDate}T00:00:00.000Z`).getTime() + 86_400_000).toISOString();
    return res.json({
      claimed: Boolean(claim.rowCount),
      rewardPoints: claim.rowCount ? Number(claim.rows[0].reward_points) : null,
      balancePoints: Number(balance.rows[0]?.points || 0),
      nextSpinAt,
    });
  } catch (error) {
    console.error('Could not load daily spin status:', error);
    return res.status(500).json({ error: 'Could not load your daily spin status.' });
  }
});

app.post('/api/rewards/daily-spin', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to claim your daily spin.' });
  if (!database) return res.status(503).json({ error: 'Daily rewards require the production account database.' });

  const claimDate = getUtcDailyKey();
  const nextSpinAt = new Date(new Date(`${claimDate}T00:00:00.000Z`).getTime() + 86_400_000).toISOString();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO survey_reward_balances (user_id, points)
       VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    );
    const balance = await client.query<{ points: number }>(
      'SELECT points FROM survey_reward_balances WHERE user_id = $1 FOR UPDATE',
      [user.id],
    );
    const existing = await client.query<{ reward_points: number }>(
      'SELECT reward_points FROM daily_reward_claims WHERE user_id = $1 AND claim_date = $2',
      [user.id, claimDate],
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return res.json({
        claimed: true,
        alreadyClaimed: true,
        rewardPoints: Number(existing.rows[0].reward_points),
        balancePoints: Number(balance.rows[0]?.points || 0),
        nextSpinAt,
      });
    }

    const rewardPoints = selectDailySpinReward(randomInt(100));
    const currentPoints = Number(balance.rows[0]?.points || 0);
    if (currentPoints > 2_147_483_647 - rewardPoints) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Your points balance has reached its limit; the spin was not used.' });
    }
    await client.query(
      `INSERT INTO daily_reward_claims (user_id, claim_date, reward_points)
       VALUES ($1, $2, $3)`,
      [user.id, claimDate, rewardPoints],
    );
    const updated = await client.query<{ points: number }>(
      `UPDATE survey_reward_balances
       SET points = points + $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING points`,
      [user.id, rewardPoints],
    );
    await client.query('COMMIT');
    return res.status(201).json({
      claimed: true,
      alreadyClaimed: false,
      rewardPoints,
      balancePoints: Number(updated.rows[0].points),
      nextSpinAt,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not claim daily spin:', error);
    return res.status(500).json({ error: 'Could not claim your daily spin.' });
  } finally {
    client.release();
  }
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
    const restricted = await client.query<{ cashout_restricted: boolean; fraud_status: string }>(
      'SELECT cashout_restricted, fraud_status FROM users WHERE id = $1 FOR UPDATE',
      [user.id],
    );
    if (restricted.rows[0]?.cashout_restricted || restricted.rows[0]?.fraud_status === 'suspicious') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cash-outs are restricted while this account is under manual review.' });
    }
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

export function createWithdrawalTrackingHash(withdrawalId: string) {
  return createHash('sha256').update(`s4fc-withdrawal:${withdrawalId}`).digest('hex');
}

export function hashWithdrawalDestination(destination: string) {
  const secret = env.FRAUD_SECRET || referralHashSecret || googleClientSecret || 'local-withdrawal-secret';
  return createHmac('sha256', secret).update(destination.trim().toLowerCase()).digest('hex');
}

export function maskWithdrawalDestination(channel: WithdrawalChannel, destination: string) {
  if (channel === 'paypal') {
    const [name, domain] = destination.split('@');
    return `${name ? `${name.slice(0, 1)}***` : '***'}@${domain || 'hidden'}`;
  }
  if (channel === 'venmo') return `@***${destination.replace(/^@/, '').slice(-3)}`;
  return `${destination.slice(0, 6)}...${destination.slice(-4)}`;
}

async function fireWithdrawalWebhook(payload: Record<string, unknown>) {
  const webhookUrl = env.WITHDRAWAL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { delivered: false as const, reason: 'not_configured' as const };
  const secret = env.WITHDRAWAL_WEBHOOK_SECRET || referralHashSecret || googleClientSecret;
  if (!secret) return { delivered: false as const, reason: 'secret_not_configured' as const };
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Withdrawal-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return { delivered: response.ok as boolean, reason: response.ok ? 'delivered' : 'provider_rejected' as const };
  } catch {
    return { delivered: false as const, reason: 'delivery_failed' as const };
  }
}

export function createMockCashoutEvent(): LiveActivityEvent {
  const handles = ['m_win', 'cash_jay', 'sunnydeal', 'quickdrop', 'pixelpay', 'greenvault'];
  const tags = ['PayPal', 'USDC', 'Bank', 'Cash App', 'Venmo'];
  const offers = ['Top offer', 'Survey', 'Game', 'Referral', 'Cashback'];
  const handle = handles[randomInt(handles.length)];
  const cents = randomInt(50, 2501);
  const amount = cents / 100;
  const method = tags[randomInt(tags.length)];
  return {
    id: randomUUID(),
    type: 'mock',
    handle: `${handle}${randomInt(10, 99)}***`,
    amount,
    amountText: `$${amount.toFixed(2)}`,
    method,
    tag: offers[randomInt(offers.length)],
    timestamp: new Date().toISOString(),
  };
}

export function broadcastLiveActivity(event: LiveActivityEvent) {
  if (event.type !== 'mock') lastLiveTransactionAt = Date.now();
  if (!liveActivitySocketServer) return 0;
  const payload = JSON.stringify({ event: 'cashout.activity', data: event });
  let sent = 0;
  liveActivitySocketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent += 1;
    }
  });
  return sent;
}

export function maskPublicOfferUsername(username: unknown) {
  if (typeof username !== 'string' || !username.trim()) return 'Member';
  const cleanedUsername = username.trim();
  if (cleanedUsername.toLowerCase() === 'member') return 'Member';
  const words = cleanedUsername
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 3);
  if (!words.length) return 'Member';
  return words.map((word) => {
    const characters = Array.from(word.toLowerCase());
    const visible = characters.slice(0, 2).join('');
    return `${visible.charAt(0).toUpperCase()}${visible.slice(1)}***`;
  }).join('_');
}

function cleanLiveOfferLabel(value: string, fallback: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160);
  return cleaned || fallback;
}

async function getLiveOfferName(client: PoolClient, offerId: string, fallback: string) {
  const result = await client.query<{ offer: unknown }>(
    'SELECT offer FROM offers WHERE id = $1 LIMIT 1',
    [offerId],
  );
  const offer = result.rows[0]?.offer;
  if (isRecord(offer)) {
    const title = typeof offer.title === 'string' ? offer.title.trim() : '';
    const company = typeof offer.company === 'string' ? offer.company.trim() : '';
    if (title && company && title.toLowerCase() !== company.toLowerCase()) {
      return cleanLiveOfferLabel(`${company} - ${title}`, fallback);
    }
    if (title || company) return cleanLiveOfferLabel(title || company, fallback);
  }
  return cleanLiveOfferLabel(fallback, 'Offer reward');
}

function rememberLiveOfferCredit(reference: string, credit: LiveOfferCredit) {
  liveOfferCreditsMemory.delete(reference);
  liveOfferCreditsMemory.set(reference, credit);
  while (liveOfferCreditsMemory.size > 30) {
    const oldestReference = liveOfferCreditsMemory.keys().next().value;
    if (oldestReference === undefined) break;
    liveOfferCreditsMemory.delete(oldestReference);
  }
}

function forgetLiveOfferCredit(reference: string) {
  liveOfferCreditsMemory.delete(reference);
}

async function insertLiveOfferCredit(
  client: PoolClient,
  input: {
    reference: string;
    userId: string | null;
    username: unknown;
    offerwall: string;
    offer: string;
    payoutAmount: number;
  },
) {
  const result = await client.query<{ id: string; credited_at: Date }>(
    `INSERT INTO live_offer_credits
      (id, transaction_reference, user_id, masked_username, offerwall_name, offer_name, payout_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (transaction_reference) DO NOTHING
     RETURNING id, credited_at`,
    [
      randomUUID(),
      input.reference,
      input.userId,
      maskPublicOfferUsername(input.username),
      cleanLiveOfferLabel(input.offerwall, 'Offerwall'),
      cleanLiveOfferLabel(input.offer, 'Offer reward'),
      input.payoutAmount,
    ],
  );
  if (!result.rows[0]) return null;
  const credit: LiveOfferCredit = {
    id: result.rows[0].id,
    username: maskPublicOfferUsername(input.username),
    offerwall: cleanLiveOfferLabel(input.offerwall, 'Offerwall'),
    offer: cleanLiveOfferLabel(input.offer, 'Offer reward'),
    payoutAmount: input.payoutAmount,
    creditedAt: new Date(result.rows[0].credited_at).toISOString(),
  };
  rememberLiveOfferCredit(input.reference, credit);
  return credit;
}

function broadcastLiveOfferCredit(credit: LiveOfferCredit) {
  if (!liveActivitySocketServer) return 0;
  const payload = JSON.stringify({ event: 'offers.credit', data: credit });
  let sent = 0;
  liveActivitySocketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent += 1;
    }
  });
  return sent;
}

async function insertNotification(
  client: PoolClient,
  userId: string,
  title: string,
  message: string,
  type: PlatformNotification['type'],
) {
  const result = await client.query<{
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    type: PlatformNotification['type'];
    created_at: Date;
  }>(
    `INSERT INTO notifications (id, user_id, title, message, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, message, is_read, type, created_at`,
    [randomUUID(), userId, title, message, type],
  );
  const notification = result.rows[0];
  return {
    ...notification,
    created_at: new Date(notification.created_at).toISOString(),
  } satisfies PlatformNotification;
}

function broadcastUserNotification(userId: string, notification: PlatformNotification) {
  const sockets = notificationSocketsByUser.get(userId);
  if (!sockets) return 0;
  const payload = JSON.stringify({ event: 'notification.created', data: notification });
  let sent = 0;
  sockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      sent += 1;
    } else {
      sockets.delete(socket);
    }
  });
  if (!sockets.size) notificationSocketsByUser.delete(userId);
  return sent;
}

async function getNotificationSocketUserId(request: IncomingMessage) {
  const sessionCookie = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('sfc_session='));
  const token = sessionCookie?.slice('sfc_session='.length) || '';
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  if (database) {
    const result = await database.query<{ id: string }>(
      `SELECT users.id
       FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token = $1 AND auth_sessions.expires_at > NOW()
         AND users.account_status = 'active' AND users.is_banned = FALSE`,
      [token],
    );
    return result.rows[0]?.id || null;
  }
  const session = authSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) return null;
  const user = authUsers.get(session.userId);
  return user && user.accountStatus !== 'blocked' ? user.id : null;
}

function startMockActivityWorker() {
  const schedule = () => {
    const delay = randomInt(12_000, 45_001);
    setTimeout(() => {
      const stale = !lastLiveTransactionAt || Date.now() - lastLiveTransactionAt >= 45_000;
      if (stale) broadcastLiveActivity(createMockCashoutEvent());
      schedule();
    }, delay).unref();
  };
  schedule();
}

export function getUtcRaceKey(now = new Date()) {
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

export function getUtcDailyKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function selectDailySpinReward(roll: number) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100) {
    throw new RangeError('Daily spin roll must be an integer from 0 to 99.');
  }
  if (roll < 50) return 1;
  if (roll < 80) return 2;
  if (roll < 95) return 5;
  if (roll < 99) return 10;
  return 25;
}

export async function runDailyResetWorker(now = new Date()) {
  if (!database) return { status: 'skipped', reason: 'database_unavailable' };
  const runKey = `daily-reset:${getUtcDailyKey(now)}`;
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query<{ run_key: string }>(
      `INSERT INTO background_worker_runs (run_key, worker_name, status, details)
       VALUES ($1, 'daily-reset', 'running', '{}'::jsonb)
       ON CONFLICT (run_key) DO NOTHING
       RETURNING run_key`,
      [runKey],
    );
    if (!claimed.rows[0]) {
      await client.query('ROLLBACK');
      return { status: 'already_completed', runKey };
    }
    await client.query(
      `UPDATE users
       SET daily_wheel_uses = 0,
           daily_wheel_reset_at = NOW(),
           updated_at = NOW()
       WHERE daily_wheel_uses <> 0 OR daily_wheel_reset_at IS NULL`,
    );
    await client.query("DELETE FROM referral_offer_clicks WHERE clicked_at < NOW() - INTERVAL '48 hours'");
    await client.query("DELETE FROM offer_analytics_events WHERE occurred_at < NOW() - INTERVAL '48 hours' AND event_type = 'click'");
    await client.query(
      `UPDATE background_worker_runs
       SET status = 'completed', completed_at = NOW(), details = '{"reset":"daily"}'::jsonb
       WHERE run_key = $1`,
      [runKey],
    );
    await client.query('COMMIT');
    return { status: 'completed', runKey };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await database.query(
      `INSERT INTO background_worker_runs (run_key, worker_name, status, details)
       VALUES ($1, 'daily-reset', 'failed', $2::jsonb)
       ON CONFLICT (run_key) DO UPDATE SET status = 'failed', details = EXCLUDED.details`,
      [runKey, JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' })],
    ).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function runWeeklyLeaderboardWorker(now = new Date()) {
  if (!database) return { status: 'skipped', reason: 'database_unavailable' };
  const raceKey = getUtcRaceKey(now);
  const runKey = `weekly-leaderboard:${raceKey}`;
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query<{ run_key: string }>(
      `INSERT INTO background_worker_runs (run_key, worker_name, status, details)
       VALUES ($1, 'weekly-leaderboard', 'running', '{}'::jsonb)
       ON CONFLICT (run_key) DO NOTHING
       RETURNING run_key`,
      [runKey],
    );
    if (!claimed.rows[0]) {
      await client.query('ROLLBACK');
      return { status: 'already_completed', runKey };
    }

    const earnings = await client.query<{ user_id: string; earnings: string }>(
      `SELECT user_id, SUM(amount)::text AS earnings
       FROM transactions
       WHERE created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
         AND amount > 0
       GROUP BY user_id
       ORDER BY SUM(amount) DESC, user_id ASC
       LIMIT 10`,
      [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), now.toISOString()],
    );

    let credited = 0;
    for (const [index, row] of earnings.rows.entries()) {
      const rank = index + 1;
      const prizeCents = LEADERBOARD_PRIZE_CENTS_BY_RANK[index] || 0;
      if (prizeCents <= 0) continue;
      await client.query(
        `INSERT INTO weekly_leaderboard_entries
          (race_key, rank, user_id, earnings, prize)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (race_key, rank) DO NOTHING`,
        [raceKey, rank, row.user_id, Number(row.earnings), prizeCents / 100],
      );
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [row.user_id],
      );
      await client.query(
        `UPDATE survey_reward_balances
         SET points = points + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [row.user_id, prizeCents],
      );
      await client.query(
        `INSERT INTO transactions
          (id, user_id, amount, type, reference_id)
         VALUES ($1, $2, $3, 'LEADERBOARD_PRIZE', $4)
         ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
        [randomUUID(), row.user_id, prizeCents / 100, `leaderboard:${raceKey}:${rank}:${row.user_id}`],
      );
      credited += prizeCents;
    }

    await client.query(
      `UPDATE background_worker_runs
       SET status = 'completed', completed_at = NOW(),
           details = $2::jsonb
       WHERE run_key = $1`,
      [runKey, JSON.stringify({ raceKey, entries: earnings.rows.length, prizePoolCents: credited })],
    );
    await client.query('COMMIT');
    return { status: 'completed', runKey, raceKey, entries: earnings.rows.length, prizePoolCents: credited };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await database.query(
      `INSERT INTO background_worker_runs (run_key, worker_name, status, details)
       VALUES ($1, 'weekly-leaderboard', 'failed', $2::jsonb)
       ON CONFLICT (run_key) DO UPDATE SET status = 'failed', details = EXCLUDED.details`,
      [runKey, JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' })],
    ).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function startScheduledWorkers() {
  let lastDailyKey = '';
  let lastWeeklyKey = '';
  const poll = setInterval(() => {
    if (!database) return;
    const now = new Date();
    const dailyKey = getUtcDailyKey(now);
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && lastDailyKey !== dailyKey) {
      lastDailyKey = dailyKey;
      void runDailyResetWorker(now).catch((error) => console.error('Daily reset worker failed:', error));
    }
    if (
      now.getUTCDay() === 0 &&
      now.getUTCHours() === 23 &&
      now.getUTCMinutes() === 59 &&
      lastWeeklyKey !== getUtcRaceKey(now)
    ) {
      lastWeeklyKey = getUtcRaceKey(now);
      void runWeeklyLeaderboardWorker(now).catch((error) => console.error('Weekly leaderboard worker failed:', error));
    }
  }, 30_000);
  poll.unref();
}

function startOfferFeedWorker() {
  const poll = setInterval(() => {
    void runOfferFeedSync().catch((error) => console.error('Offer feed sync worker failed:', error));
  }, 60 * 60 * 1000);
  poll.unref();
}

app.get('/api/v1/leaderboard', async (_req, res) => {
  if (!database) return res.status(503).json({ error: 'Leaderboard storage is unavailable.' });
  try {
    const raceKey = getUtcRaceKey();
    const result = await database.query<{
      rank: number;
      earnings: string;
      prize: string;
      username: string | null;
    }>(
      `SELECT entries.rank, entries.earnings, entries.prize, users.username
       FROM weekly_leaderboard_entries AS entries
       JOIN users ON users.id = entries.user_id
       WHERE entries.race_key = $1
       ORDER BY entries.rank`,
      [raceKey],
    );
    return res.json({
      raceKey,
      prizePool: LEADERBOARD_PRIZE_POOL_CENTS / 100,
      entries: result.rows.map((row) => ({
        rank: row.rank,
        handle: row.username ? `@${row.username.slice(0, 3)}***` : '***',
        earnings: Number(row.earnings),
        prize: Number(row.prize),
      })),
    });
  } catch (error) {
    console.error('Could not load leaderboard:', error);
    return res.status(500).json({ error: 'Could not load the leaderboard.' });
  }
});

app.post('/api/v1/admin/workers/daily-reset', requireOwnerAdmin, async (_req, res) => {
  try {
    return res.json(await runDailyResetWorker());
  } catch (error) {
    console.error('Manual daily reset failed:', error);
    return res.status(500).json({ error: 'Daily reset failed.' });
  }
});

app.post('/api/v1/admin/workers/weekly-leaderboard', requireOwnerAdmin, async (_req, res) => {
  try {
    return res.json(await runWeeklyLeaderboardWorker());
  } catch (error) {
    console.error('Manual leaderboard compilation failed:', error);
    return res.status(500).json({ error: 'Leaderboard compilation failed.' });
  }
});

app.post('/api/v1/withdrawals/request', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in before requesting a withdrawal.' });
  if (!database) return res.status(503).json({ error: 'Withdrawal storage requires the production account database.' });

  const amount = req.body?.amount;
  const destinationValidation = validateWithdrawalDestination(req.body?.channel, req.body?.destination);
  const idempotencyKey = req.header('Idempotency-Key')?.trim();
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return res.status(400).json({ field: 'amount', error: 'Amount must be a dollar value.' });
  }
  const amountCents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountCents) > 1e-7 || amountCents < WITHDRAWAL_MINIMUM_CENTS) {
    return res.status(400).json({ field: 'amount', error: 'Minimum withdrawal is $5.00.' });
  }
  if ('field' in destinationValidation) return res.status(400).json(destinationValidation);
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{1,200}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: 'Provide an Idempotency-Key of 1–200 letters, numbers, dots, underscores, colons, or hyphens.' });
  }

  let client: PoolClient;
  try {
    client = await database.connect();
  } catch (error) {
    console.error('Could not connect to the withdrawal database:', error);
    return res.status(500).json({ error: 'Could not process the withdrawal.' });
  }
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      id: string;
      amount: string;
      channel: WithdrawalChannel;
      destination_hash: string;
      status: 'PENDING' | 'COMPLETED' | 'REJECTED';
      tracking_id_hash: string;
    }>(
      `SELECT id, amount, channel, destination_hash, status, tracking_id_hash
       FROM withdrawal_requests
       WHERE user_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [user.id, idempotencyKey],
    );
    const destinationHash = hashWithdrawalDestination(destinationValidation.destination);
    if (existing.rows[0]) {
      const prior = existing.rows[0];
      if (
        Math.round(Number(prior.amount) * 100) !== amountCents ||
        prior.channel !== destinationValidation.channel ||
        prior.destination_hash !== destinationHash
      ) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Idempotency-Key was already used for a different withdrawal.' });
      }
      await client.query('COMMIT');
      return res.status(200).json({
        requestId: prior.id,
        status: prior.status,
        amount: amountCents / 100,
        channel: prior.channel,
        trackingIdHash: prior.tracking_id_hash,
      });
    }

    const account = await client.query<{
      balance: string;
      pending_withdrawal: string;
      cashout_restricted: boolean;
      fraud_status: string;
    }>(
      'SELECT balance, pending_withdrawal, cashout_restricted, fraud_status FROM users WHERE id = $1 FOR UPDATE',
      [user.id],
    );
    const accountRow = account.rows[0];
    if (!accountRow || accountRow.cashout_restricted || accountRow.fraud_status === 'suspicious') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cash-outs are restricted while this account is under manual review.' });
    }
    const balanceCents = Math.round(Number(accountRow.balance) * 100);
    if (!Number.isSafeInteger(balanceCents) || balanceCents < amountCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient wallet balance.',
        balance: balanceCents / 100,
        requestedAmount: amountCents / 100,
      });
    }

    const withdrawalId = randomUUID();
    const trackingIdHash = createWithdrawalTrackingHash(withdrawalId);
    const destinationMask = maskWithdrawalDestination(destinationValidation.channel, destinationValidation.destination);
    await client.query(
      `UPDATE users
       SET balance = balance - $2,
           pending_withdrawal = pending_withdrawal + $2,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, amountCents / 100],
    );
    await client.query(
      `INSERT INTO withdrawal_requests
        (id, idempotency_key, user_id, amount, channel, destination_hash, destination_mask, status, tracking_id_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)`,
      [
        withdrawalId,
        idempotencyKey,
        user.id,
        amountCents / 100,
        destinationValidation.channel,
        destinationHash,
        destinationMask,
        trackingIdHash,
      ],
    );
    await client.query(
      `INSERT INTO transactions
        (id, user_id, amount, type, reference_id, payout_status, payout_channel, tracking_id_hash)
       VALUES ($1, $2, $3, 'WITHDRAWAL', $4, 'PENDING', $5, $6)`,
      [randomUUID(), user.id, -(amountCents / 100), `withdrawal:${withdrawalId}`, destinationValidation.channel, trackingIdHash],
    );
    await client.query('COMMIT');

    const webhook = await fireWithdrawalWebhook({
      event: 'withdrawal.requested',
      requestId: withdrawalId,
      trackingIdHash,
      amountCents,
      channel: destinationValidation.channel,
    });
    return res.status(201).json({
      requestId: withdrawalId,
      status: 'PENDING',
      amount: amountCents / 100,
      channel: destinationValidation.channel,
      destinationMask,
      trackingIdHash,
      webhook,
      balance: (balanceCents - amountCents) / 100,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not create withdrawal request:', error);
    return res.status(500).json({ error: 'Could not process the withdrawal.' });
  } finally {
    client.release();
  }
});

export async function mockWithdrawalProvider(request: {
  requestId: string;
  channel: WithdrawalChannel;
  amountCents: number;
}) {
  return {
    providerReference: `mock-${request.requestId.slice(0, 8)}`,
    channel: request.channel,
    amountCents: request.amountCents,
    status: 'COMPLETED' as const,
  };
}

app.post('/api/v1/admin/withdrawals/:id/complete', requireOwnerAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Withdrawal storage is unavailable.' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query<{ user_id: string; amount: string; channel: WithdrawalChannel; status: string }>(
      'SELECT user_id, amount, channel, status FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const row = request.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }
    if (row.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal has already been processed.' });
    }
    const amountCents = Math.round(Number(row.amount) * 100);
    const provider = await mockWithdrawalProvider({
      requestId: req.params.id,
      channel: row.channel,
      amountCents,
    });
    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'COMPLETED', provider_reference = $2, processed_at = NOW()
       WHERE id = $1`,
      [req.params.id, provider.providerReference],
    );
    await client.query(
      `UPDATE users
       SET pending_withdrawal = GREATEST(0, pending_withdrawal - $2), updated_at = NOW()
       WHERE id = $1`,
      [row.user_id, amountCents / 100],
    );
    await client.query(
      `UPDATE transactions
       SET payout_status = 'COMPLETED'
       WHERE reference_id = $1`,
      [`withdrawal:${req.params.id}`],
    );
    await client.query('COMMIT');
    broadcastLiveActivity({
      id: randomUUID(),
      type: 'withdrawal',
      handle: `c_${row.user_id.slice(-4).replace(/[^a-z0-9]/gi, '*')}***`,
      amount: amountCents / 100,
      amountText: `$${(amountCents / 100).toFixed(2)}`,
      method: row.channel === 'crypto' ? 'USDC' : row.channel === 'paypal' ? 'PayPal' : 'Venmo',
      tag: 'Cash-out',
      timestamp: new Date().toISOString(),
    });
    await fireWithdrawalWebhook({
      event: 'withdrawal.completed',
      requestId: req.params.id,
      providerReference: provider.providerReference,
      status: 'COMPLETED',
    });
    return res.json({ status: 'COMPLETED', providerReference: provider.providerReference });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not complete withdrawal:', error);
    return res.status(500).json({ error: 'Could not complete the withdrawal.' });
  } finally {
    client.release();
  }
});

app.post('/api/v1/admin/withdrawals/:id/reject', requireOwnerAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Withdrawal storage is unavailable.' });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query<{ user_id: string; amount: string; status: string }>(
      'SELECT user_id, amount, status FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const row = request.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found.' });
    }
    if (row.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal has already been processed.' });
    }
    const amountCents = Math.round(Number(row.amount) * 100);
    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'REJECTED', processed_at = NOW()
       WHERE id = $1`,
      [req.params.id],
    );
    await client.query(
      `UPDATE users
       SET balance = balance + $2,
           pending_withdrawal = GREATEST(0, pending_withdrawal - $2),
           updated_at = NOW()
       WHERE id = $1`,
      [row.user_id, amountCents / 100],
    );
    await client.query(
      `UPDATE transactions
       SET payout_status = 'REJECTED'
       WHERE reference_id = $1`,
      [`withdrawal:${req.params.id}`],
    );
    await client.query('COMMIT');
    await fireWithdrawalWebhook({
      event: 'withdrawal.rejected',
      requestId: req.params.id,
      status: 'REJECTED',
    });
    return res.json({ status: 'REJECTED', restoredAmount: amountCents / 100 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not reject withdrawal:', error);
    return res.status(500).json({ error: 'Could not reject the withdrawal.' });
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
    let notification: PlatformNotification | null = null;
    let liveOfferCredit: LiveOfferCredit | null = null;
    const liveCreditReference = `cpx:${transactionId}`;
    let removeLiveOfferCredit = false;
    let client: PoolClient;
    try {
      client = await database.connect();
    } catch (error) {
      console.error('Could not connect to the CPX postback database:', error);
      return res.status(500).send('Could not record CPX postback');
    }
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ status: number; amount_usd: number; user_id: string }>(
        'SELECT status, amount_usd, user_id FROM cpx_transactions WHERE transaction_id = $1 FOR UPDATE',
        [transactionId],
      );
      if (existing.rows[0] && existing.rows[0].user_id !== userId.slice(0, 255)) {
        await client.query('ROLLBACK');
        return res.status(403).send('CPX transaction belongs to another user');
      }
      if (existing.rows[0]?.status === Number(status)) {
        await client.query('ROLLBACK');
        return res.status(200).send('OK');
      }
      await client.query(
        `INSERT INTO cpx_transactions
          (transaction_id, status, user_id, amount_local, amount_usd, offer_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (transaction_id) DO UPDATE SET
           status = EXCLUDED.status,
           amount_local = EXCLUDED.amount_local,
           amount_usd = EXCLUDED.amount_usd,
           offer_id = EXCLUDED.offer_id`,
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
        && Number(existing.rows[0].status) === 1
        ? Math.max(0, Math.round(Number(existing.rows[0].amount_usd || 0) * SURVEY_POINTS_PER_DOLLAR))
        : 0;
      const delta = Number(status) === 1 ? rewardPoints - previousPoints : -previousPoints;
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           points = GREATEST(0, survey_reward_balances.points + $2),
           updated_at = NOW()`,
        [userId.slice(0, 255), delta],
      );
      if (delta > 0) {
        notification = await insertNotification(
          client,
          userId.slice(0, 255),
          'Survey reward credited',
          `You earned $${(delta / SURVEY_POINTS_PER_DOLLAR).toFixed(2)}${typeof offerId === 'string' && offerId ? ` from ${offerId.slice(0, 80)}` : ''}.`,
          'CREDIT_ALERT',
        );
        const account = await client.query<{ id: string; username: string | null }>(
          'SELECT id, username FROM users WHERE id = $1',
          [userId.slice(0, 255)],
        );
        const fallbackOfferName = typeof offerId === 'string' && offerId.trim()
          ? `Survey ${offerId.trim().slice(0, 120)}`
          : 'CPX Research survey';
        const offerName = await getLiveOfferName(
          client,
          typeof offerId === 'string' ? offerId.slice(0, 255) : '',
          fallbackOfferName,
        );
        liveOfferCredit = await insertLiveOfferCredit(client, {
          reference: liveCreditReference,
          userId: account.rows[0]?.id || null,
          username: account.rows[0]?.username || 'Member',
          offerwall: 'CPX Research',
          offer: offerName,
          payoutAmount: delta / SURVEY_POINTS_PER_DOLLAR,
        });
      }
      if (Number(status) === 2) {
        await client.query(
          'DELETE FROM live_offer_credits WHERE transaction_reference = $1',
          [liveCreditReference],
        );
        removeLiveOfferCredit = true;
      }
      await client.query('COMMIT');
      if (notification) broadcastUserNotification(userId.slice(0, 255), notification);
      if (liveOfferCredit) broadcastLiveOfferCredit(liveOfferCredit);
      if (removeLiveOfferCredit) forgetLiveOfferCredit(liveCreditReference);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('Could not record CPX postback:', error);
      return res.status(500).send('Could not record CPX postback');
    } finally {
      client.release();
    }
  } else {
    const previous = cpxTransactions.get(transactionId);
    if (previous && previous.userId !== userId) return res.status(403).send('CPX transaction belongs to another user');
    if (previous?.status === Number(status)) return res.status(200).send('OK');
    const previousPoints = previous?.status === 1 ? previous.rewardPoints : 0;
    const delta = Number(status) === 1 ? rewardPoints - previousPoints : -previousPoints;
    cpxTransactions.set(transactionId, { status: Number(status), rewardPoints, userId });
    cpxBalances.set(userId, Math.max(0, (cpxBalances.get(userId) || 0) + delta));
    const liveCreditReference = `cpx:${transactionId}`;
    if (delta > 0) {
      const account = authUsers.get(userId);
      const fallbackOfferName = typeof offerId === 'string' && offerId.trim()
        ? `Survey ${offerId.trim().slice(0, 120)}`
        : 'CPX Research survey';
      const credit: LiveOfferCredit = {
        id: randomUUID(),
        username: maskPublicOfferUsername(account?.username || 'Member'),
        offerwall: 'CPX Research',
        offer: cleanLiveOfferLabel(fallbackOfferName, 'CPX Research survey'),
        payoutAmount: delta / SURVEY_POINTS_PER_DOLLAR,
        creditedAt: new Date().toISOString(),
      };
      rememberLiveOfferCredit(liveCreditReference, credit);
      broadcastLiveOfferCredit(credit);
    } else if (Number(status) === 2) {
      forgetLiveOfferCredit(liveCreditReference);
    }
  }
  res.status(200).send('OK');
});

app.get('/offers/:slug', async (req, res, next) => {
  const slug = String(req.params.slug || '').toLowerCase();

  const matches = liveOffersStore.filter(
    (offer) =>
      isIndexableOfferLandingPage(offer) &&
      String(offer.companySlug).toLowerCase() === slug
  );

  if (matches.length !== 1) {
    return res.status(404).type('html').send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Offer Not Available | S4FC</title></head><body><h1>Offer Not Available</h1><p>This offer may have expired or been removed.</p><a href="/">Browse available offers</a></body></html>'
    );
  }

  if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
    return next();
  }

  try {
    const offer = matches[0];
    const htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    let html = await readFile(htmlPath, 'utf8');

    const title = `${offer.company} Signup Offer: ${offer.incentiveAmount} | S4FC`;
    const description =
      `${offer.title}. Review the reward, requirements, payout timing, and important terms before signing up.`;
    const canonical = `${getOAuthAppUrl(req)}/offers/${encodeURIComponent(slug)}`;

    const safeTitle = escapeOfferHtml(title);
    const safeDescription = escapeOfferHtml(description);
    const safeCanonical = escapeOfferHtml(canonical);

    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${safeDescription}" />`);
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${safeCanonical}" />`);
    html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${safeTitle}" />`);
    html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${safeDescription}" />`);
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${safeCanonical}" />`);
    html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${safeTitle}" />`);
    html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${safeDescription}" />`);

    return res.status(200).type('html').send(html);
  } catch (error) {
    console.error('Could not render offer landing page:', error);
    return res.status(500).send('Could not load this offer page.');
  }
});

app.get('/api/offers', (req, res) => {
  res.json({
    offers: liveOffersStore.filter((offer) =>
      offer.status === 'live'
      && isVerificationCurrent(offer)
      && !isTemporarilyHiddenOffer(offer)),
  });
});

app.get('/go/:id', async (req, res) => {
  const offer = liveOffersStore.find((candidate) =>
    candidate.id === req.params.id
    && candidate.status === 'live'
    && isVerificationCurrent(candidate)
    && !isTemporarilyHiddenOffer(candidate));
  if (!offer) return res.status(404).send('This offer is unavailable.');
  const destination = extractPublicUrl(String(offer.referralUrl || offer.officialMerchantUrl || ''));
  if (!destination) return res.status(503).send('This offer link is temporarily unavailable.');
  try {
    await recordOfferAnalyticsEvent(offer, 'click');
  } catch (error) {
    console.error('Could not record outbound offer click:', error);
    return res.status(503).send('We could not record this offer click. Please try again shortly.');
  }
  let trackedDestination = destination;
  if (database) {
    try {
      const user = await getAuthenticatedUser(req);
      if (user) {
        const clickUuid = randomUUID();
        await database.query(
          `INSERT INTO click_logs (click_uuid, user_id, offer_id, ip_address)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (click_uuid) DO NOTHING`,
          [clickUuid, user.id, offer.id, hashFraudIdentifier(getClientIp(req))],
        );
        trackedDestination = compileOutboundTrackingUrl(destination, user.id, clickUuid) || destination;
        await database.query(
          `INSERT INTO referral_offer_clicks (id, referral_id, referred_user_id, offer_id)
           SELECT $1, referrals.id, referrals.referred_user_id, $2
           FROM referrals
           WHERE referrals.referred_user_id = $3
             AND referrals.status = 'pending'`,
          [randomUUID(), offer.id, user.id],
        );
      }
    } catch (error) {
      console.error('Could not record referred-member offer attribution:', error);
    }
  }
  return res.redirect(302, trackedDestination);
});

app.use(createOffersRouter({
  database,
  requireAdmin,
  liveOffersStore,
  offerCampaignsStore,
  validateOfferCampaign,
  persistOfferCampaign,
  auditAdminAction,
  handleAffiliatePostback,
}));

app.get('/api/admin/offers', requireAdmin, async (_req, res) => {
  try {
    let campaigns = [...offerCampaignsStore.values()];
    if (database) {
      const result = await database.query<{
        id: string;
        title: string;
        description: string;
        category: OfferCampaign['category'];
        total_value: string;
        milestones: OfferMilestone[];
        tracking_parameters: Record<string, string>;
        active: boolean;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, title, description, category, total_value, milestones, tracking_parameters, active, created_at, updated_at
         FROM offer_campaigns
         ORDER BY updated_at DESC`,
      );
      campaigns = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        total_value: Number(row.total_value),
        milestones: row.milestones,
        tracking_parameters: row.tracking_parameters,
        active: row.active,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      }));
    }
    return res.json({ offers: liveOffersStore, campaigns });
  } catch (error) {
    console.error('Could not load admin offer campaigns:', error);
    return res.status(500).json({ error: 'Could not load offer campaigns.' });
  }
});

app.post('/api/v1/admin/offers/sync', requireOwnerAdmin, async (_req, res) => {
  try {
    return res.json(await runOfferFeedSync());
  } catch (error) {
    console.error('Offer feed sync failed:', error);
    return res.status(500).json({ error: 'Offer feed sync failed.' });
  }
});

app.get('/api/v1/admin/offers/sync', requireOwnerAdmin, async (_req, res) => {
  if (!database) return res.json({ feeds: getConfiguredOfferFeeds(), runs: [] });
  try {
    const result = await database.query<{
      id: string;
      feed_name: string;
      status: 'running' | 'completed' | 'failed';
      fetched_count: number;
      upserted_count: number;
      started_at: Date;
      completed_at: Date | null;
      details: Record<string, unknown>;
    }>(
      `SELECT id, feed_name, status, fetched_count, upserted_count, started_at, completed_at, details
       FROM offer_feed_sync_runs
       ORDER BY started_at DESC
       LIMIT 50`,
    );
    return res.json({
      feeds: getConfiguredOfferFeeds().map((feed) => ({ name: feed.name, urlConfigured: true })),
      runs: result.rows.map((row) => ({
        id: row.id,
        feedName: row.feed_name,
        status: row.status,
        fetchedCount: row.fetched_count,
        upsertedCount: row.upserted_count,
        startedAt: row.started_at.toISOString(),
        completedAt: row.completed_at?.toISOString() || null,
        details: row.details,
      })),
    });
  } catch (error) {
    console.error('Could not load offer feed sync status:', error);
    return res.status(500).json({ error: 'Could not load offer feed sync status.' });
  }
});

app.post('/api/admin/offers', requireAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
  if (!isRecord(req.body)) return res.status(400).json({ error: 'Campaign details are required.' });
  const allowedFields = new Set(['id', 'title', 'description', 'category', 'total_value', 'milestones', 'tracking_parameters']);
  const unexpectedField = Object.keys(req.body).find((field) => !allowedFields.has(field));
  if (unexpectedField) return res.status(400).json({ field: unexpectedField, error: 'This campaign field cannot be set.' });
  if (req.body.id !== undefined && typeof req.body.id !== 'string') {
    return res.status(400).json({ field: 'id', error: 'Campaign ID must be text.' });
  }
  const id = typeof req.body.id === 'string' ? req.body.id.trim() : `campaign-${randomUUID()}`;
  if (offerCampaignsStore.has(id) || liveOffersStore.some((offer) => offer.id === id)) {
    return res.status(409).json({ field: 'id', error: 'This campaign ID is already in use.' });
  }
  const now = new Date().toISOString();
  const validation = validateOfferCampaign(req.body, id, now, now);
  if ('error' in validation) return res.status(400).json({ field: validation.field, error: validation.error });

  try {
    const existingMilestones = await database.query(
      'SELECT 1 FROM offer_milestone_tiers WHERE offer_id = $1 LIMIT 1',
      [id],
    );
    if (existingMilestones.rowCount) {
      return res.status(409).json({ field: 'id', error: 'This ID already has milestone history and cannot be reused.' });
    }
    await persistOfferCampaign(validation.campaign, true, true);
    offerCampaignsStore.set(id, validation.campaign);
    await auditAdminAction(req, 'offer_campaign_created', { campaignId: id });
    return res.status(201).json({ campaign: validation.campaign });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ field: 'id', error: 'This campaign ID or milestone is already in use.' });
    }
    console.error('Could not create offer campaign:', error);
    return res.status(500).json({ error: 'Could not create offer campaign.' });
  }
});

app.put('/api/admin/offers/:id', requireAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
  const existing = offerCampaignsStore.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Offer campaign not found.' });
  if (!isRecord(req.body)) return res.status(400).json({ error: 'Campaign updates are required.' });

  const allowedFields = new Set(['title', 'description', 'category', 'total_value', 'milestones', 'tracking_parameters', 'milestone']);
  const unexpectedField = Object.keys(req.body).find((field) => !allowedFields.has(field));
  if (unexpectedField) return res.status(400).json({ field: unexpectedField, error: 'This campaign field cannot be updated.' });
  if (Object.keys(req.body).length === 0) return res.status(400).json({ error: 'Provide at least one campaign field to update.' });
  if (req.body.milestone !== undefined && req.body.milestones !== undefined) {
    return res.status(400).json({ field: 'milestones', error: 'Update either one milestone or the complete milestone list.' });
  }

  const candidate: Record<string, unknown> = {
    title: Object.prototype.hasOwnProperty.call(req.body, 'title') ? req.body.title : existing.title,
    description: Object.prototype.hasOwnProperty.call(req.body, 'description') ? req.body.description : existing.description,
    category: Object.prototype.hasOwnProperty.call(req.body, 'category') ? req.body.category : existing.category,
    total_value: Object.prototype.hasOwnProperty.call(req.body, 'total_value') ? req.body.total_value : existing.total_value,
    milestones: Object.prototype.hasOwnProperty.call(req.body, 'milestones') ? req.body.milestones : existing.milestones,
    tracking_parameters: Object.prototype.hasOwnProperty.call(req.body, 'tracking_parameters') ? req.body.tracking_parameters : existing.tracking_parameters,
  };
  const replaceMilestones = req.body.milestones !== undefined || req.body.milestone !== undefined;
  if (req.body.milestone !== undefined) {
    if (!isRecord(req.body.milestone)) return res.status(400).json({ field: 'milestone', error: 'Milestone updates must be an object.' });
    const milestoneFields = new Set(['step_number', 'description', 'payout_amount']);
    if (Object.keys(req.body.milestone).some((field) => !milestoneFields.has(field))) {
      return res.status(400).json({ field: 'milestone', error: 'Only step_number, description, and payout_amount can be updated.' });
    }
    const stepNumber = req.body.milestone.step_number;
    if (typeof stepNumber !== 'number' || !Number.isSafeInteger(stepNumber)) {
      return res.status(400).json({ field: 'milestone.step_number', error: 'Provide a valid step_number.' });
    }
    if (req.body.milestone.description === undefined && req.body.milestone.payout_amount === undefined) {
      return res.status(400).json({ field: 'milestone', error: 'Provide a description or payout_amount to update.' });
    }
    const tierIndex = existing.milestones.findIndex((tier) => tier.step_number === stepNumber);
    if (tierIndex < 0) return res.status(404).json({ field: 'milestone.step_number', error: 'Milestone step was not found.' });
    const milestones = [...existing.milestones];
    milestones[tierIndex] = { ...milestones[tierIndex], ...req.body.milestone };
    candidate.milestones = milestones;
  }
  if (replaceMilestones && req.body.total_value === undefined) {
    candidate.total_value = Array.isArray(candidate.milestones)
      ? candidate.milestones.reduce((sum, tier) => sum + (isRecord(tier) && typeof tier.payout_amount === 'number' ? tier.payout_amount : 0), 0)
      : existing.total_value;
  }

  const validation = validateOfferCampaign(candidate, existing.id, existing.created_at, new Date().toISOString());
  if ('error' in validation) return res.status(400).json({ field: validation.field, error: validation.error });
  validation.campaign.active = existing.active;
  try {
    await persistOfferCampaign(validation.campaign, false, replaceMilestones);
    offerCampaignsStore.set(existing.id, validation.campaign);
    await auditAdminAction(req, 'offer_campaign_updated', { campaignId: existing.id });
    return res.json({ campaign: validation.campaign });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ field: 'milestones', error: 'Milestone steps or levels must be unique.' });
    }
    console.error('Could not update offer campaign:', error);
    return res.status(500).json({ error: 'Could not update offer campaign.' });
  }
});

app.delete('/api/admin/offers/:id', requireAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Campaign management requires persistent database storage.' });
  const existing = offerCampaignsStore.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Offer campaign not found.' });
  const campaign = { ...existing, active: false, updated_at: new Date().toISOString() };
  try {
    await persistOfferCampaign(campaign, false, true);
    offerCampaignsStore.set(campaign.id, campaign);
    await auditAdminAction(req, 'offer_campaign_deactivated', { campaignId: campaign.id });
    return res.json({ campaign });
  } catch (error) {
    console.error('Could not deactivate offer campaign:', error);
    return res.status(500).json({ error: 'Could not deactivate offer campaign.' });
  }
});

async function saveUserOfferStatus(
  userId: string,
  offerId: string,
  status: 'active' | 'completed' | 'issue',
  updatedAt: string,
) {
  if (database) {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO user_offer_entries (user_id, offer_id, status, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, offer_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
        [userId, offerId, status, updatedAt],
      );
      if (status === 'completed') {
        await client.query(
          `INSERT INTO user_offer_completion_reports (user_id, offer_id, reported_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, offer_id)
           DO UPDATE SET reported_at = EXCLUDED.reported_at`,
          [userId, offerId, updatedAt],
        );
      }
      await client.query('COMMIT');
      return;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const entries = userOfferEntriesStore.get(userId) || [];
  const next = entries.filter((entry) => entry.offerId !== offerId);
  next.push({ offerId, status, updatedAt });
  userOfferEntriesStore.set(userId, next);
}

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
  try {
    await saveUserOfferStatus(user.id, offer.id, status, updatedAt);
  } catch (error) {
    console.error('Could not save account offer activity:', error);
    return res.status(500).json({ error: 'Could not save this offer update to your account.' });
  }
  return res.json({ entry: { offerId: offer.id, status, updatedAt } });
});

app.delete('/api/account/offer-entries/:offerId', requireAuthenticatedUser, async (_req, res) => {
  const user = res.locals.authenticatedUser as { id: string };
  const offerId = _req.params.offerId;
  if (database) {
    await database.query('DELETE FROM user_offer_entries WHERE user_id = $1 AND offer_id = $2', [user.id, offerId]);
  } else {
    const entries = userOfferEntriesStore.get(user.id) || [];
    const remaining = entries.filter((entry) => entry.offerId !== offerId);
    if (remaining.length) userOfferEntriesStore.set(user.id, remaining);
    else userOfferEntriesStore.delete(user.id);
  }
  return res.json({ success: true });
});

app.post('/api/offers/:id/completion-report', async (req, res) => {
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
  try {
    const user = await getAuthenticatedUser(req);
    if (user) await saveUserOfferStatus(user.id, offer.id, 'completed', report.reportedAt);
  } catch (error) {
    console.error('Could not save the account completion report:', error);
    return res.status(500).json({ error: 'Could not save your completion report.' });
  }
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
    try {
      await database.query(
        'INSERT INTO offer_issue_reports (id, offer_id, issue, description, reported_at) VALUES ($1, $2, $3, $4, $5)',
        [report.id, report.offerId, report.issue, report.description, report.reportedAt],
      );
    } catch (error) {
      console.error('Could not save visitor offer issue report:', error);
      return res.status(500).json({ error: 'Could not save your report. Please try again.' });
    }
  } else {
    issueReportsStore.unshift(report);
  }
  return res.status(201).json({ success: true });
});

app.get('/api/admin/offer-issue-reports', requireAuthenticatedOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const result = await database.query(
        `SELECT r.id, r.offer_id AS "offerId", r.issue, r.description, r.status,
                r.reported_at AS "reportedAt", o.title, o.company
         FROM offer_issue_reports r
         LEFT JOIN offers o ON o.id = r.offer_id
         ORDER BY r.reported_at DESC`,
      );
      return res.json({ reports: result.rows });
    } catch (error) {
      console.error('Could not load visitor offer issue reports:', error);
      return res.status(500).json({ error: 'Could not load offer issue reports.' });
    }
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

app.patch('/api/admin/offer-issue-reports/:id', requireAuthenticatedOwnerAdmin, async (req, res) => {
  const status = req.body?.status;
  if (!['open', 'reviewing', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid report status.' });
  }
  if (database) {
    try {
      const result = await database.query(
        'UPDATE offer_issue_reports SET status = $1 WHERE id = $2 RETURNING id, status',
        [status, req.params.id],
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Issue report not found.' });
      return res.json({ report: result.rows[0] });
    } catch (error) {
      console.error('Could not update visitor offer issue report:', error);
      return res.status(500).json({ error: 'Could not update this report.' });
    }
  }
  const report = issueReportsStore.find((candidate) => candidate.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Issue report not found.' });
  report.status = status;
  return res.json({ report: { id: report.id, status } });
});

app.post('/api/site-messages', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (message.length < 5 || message.length > 2000) {
    return res.status(400).json({ error: 'Your message must be between 5 and 2,000 characters.' });
  }
  if (email && (email.length > 254 || !SURVEY_PAYOUT_EMAIL_PATTERN.test(email))) {
    return res.status(400).json({ error: 'Enter a valid email address or leave it blank.' });
  }
  const siteMessage: SiteMessage = {
    id: randomUUID(),
    message,
    email,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  if (database) {
    try {
      await database.query(
        'INSERT INTO site_messages (id, message, email, status, created_at) VALUES ($1, $2, $3, $4, $5)',
        [siteMessage.id, siteMessage.message, siteMessage.email, siteMessage.status, siteMessage.createdAt],
      );
    } catch (error) {
      console.error('Could not save visitor site message:', error);
      return res.status(500).json({ error: 'Your message could not be saved. Please try again.' });
    }
  } else {
    siteMessagesStore.unshift(siteMessage);
  }
  return res.status(201).json({ success: true });
});

app.get('/api/admin/site-messages', requireAuthenticatedOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const [messages, unread] = await Promise.all([
        database.query(
          `SELECT id, message, email, status, created_at AS "createdAt"
           FROM site_messages ORDER BY created_at DESC LIMIT 200`,
        ),
        database.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM site_messages WHERE status = 'new'`),
      ]);
      return res.json({ messages: messages.rows, unreadCount: Number(unread.rows[0]?.count || 0) });
    } catch (error) {
      console.error('Could not load visitor site messages:', error);
      return res.status(500).json({ error: 'Could not load visitor messages.' });
    }
  }
  return res.json({
    messages: siteMessagesStore.slice(0, 200),
    unreadCount: siteMessagesStore.filter((message) => message.status === 'new').length,
  });
});

app.patch('/api/admin/site-messages/:id', requireAuthenticatedOwnerAdmin, async (req, res) => {
  const status = req.body?.status;
  if (!['new', 'read', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid message status.' });
  }
  if (database) {
    try {
      const result = await database.query(
        'UPDATE site_messages SET status = $1 WHERE id = $2 RETURNING id, status',
        [status, req.params.id],
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Visitor message not found.' });
      return res.json({ message: result.rows[0] });
    } catch (error) {
      console.error('Could not update visitor site message:', error);
      return res.status(500).json({ error: 'Could not update this message.' });
    }
  }
  const message = siteMessagesStore.find((candidate) => candidate.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Visitor message not found.' });
  message.status = status;
  return res.json({ message: { id: message.id, status: message.status } });
});

app.get('/api/admin/provider-credentials', requireOwnerAdmin, async (_req, res) => {
  if (!database) {
    return res.status(503).json({ error: 'Provider credentials require PostgreSQL storage.' });
  }
  if (!providerCredentialEncryptionSecret) {
    return res.status(503).json({ error: 'Provider credential encryption is not configured.' });
  }
  try {
    const result = await database.query<{
      provider_slug: string;
      provider_name: string;
      credential_slug: string;
      credential_name: string;
      updated_at: Date;
    }>(
      `SELECT provider_slug, provider_name, credential_slug, credential_name, updated_at
       FROM provider_api_credentials
       ORDER BY provider_name, credential_name`,
    );
    return res.json({
      credentials: result.rows.map((row) => ({
        providerSlug: row.provider_slug,
        providerName: row.provider_name,
        credentialSlug: row.credential_slug,
        credentialName: row.credential_name,
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Could not load provider credentials:', error);
    return res.status(500).json({ error: 'Could not load provider credentials.' });
  }
});

app.put('/api/admin/provider-credentials', requireOwnerAdmin, async (req, res) => {
  if (!database) {
    return res.status(503).json({ error: 'Provider credentials require PostgreSQL storage.' });
  }
  if (!providerCredentialEncryptionSecret) {
    return res.status(503).json({ error: 'Provider credential encryption is not configured.' });
  }

  const providerName = typeof req.body?.providerName === 'string' ? req.body.providerName.trim() : '';
  const credentialName = typeof req.body?.credentialName === 'string' ? req.body.credentialName.trim() : '';
  const value = typeof req.body?.value === 'string' ? req.body.value : '';
  const providerSlug = providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const credentialSlug = credentialName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (
    !providerName ||
    providerName.length > 80 ||
    /[\u0000-\u001f]/.test(providerName) ||
    !providerSlug ||
    !/^[a-z0-9][a-z0-9 _.-]{0,39}$/i.test(credentialName) ||
    !credentialSlug ||
    !value.trim() ||
    value.length > 4096
  ) {
    return res.status(400).json({ error: 'Provide a valid provider name, credential label, and secret value.' });
  }

  try {
    const encrypted = encryptProviderCredential(value, providerCredentialEncryptionSecret);
    await database.query(
      `INSERT INTO provider_api_credentials
         (provider_slug, credential_slug, provider_name, credential_name, ciphertext, nonce, auth_tag, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (provider_slug, credential_slug) DO UPDATE SET
         provider_name = EXCLUDED.provider_name,
         credential_name = EXCLUDED.credential_name,
         ciphertext = EXCLUDED.ciphertext,
         nonce = EXCLUDED.nonce,
         auth_tag = EXCLUDED.auth_tag,
         updated_at = NOW()`,
      [
        providerSlug,
        credentialSlug,
        providerName,
        credentialName,
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.authTag,
      ],
    );
    await auditAdminAction(req, 'provider_credential_saved', { provider: providerSlug, credential: credentialSlug });
    return res.status(201).json({ saved: true });
  } catch (error) {
    console.error('Could not save provider credential:', error);
    return res.status(500).json({ error: 'Could not save provider credential.' });
  }
});

app.delete('/api/admin/provider-credentials/:providerSlug/:credentialSlug', requireOwnerAdmin, async (req, res) => {
  if (!database) {
    return res.status(503).json({ error: 'Provider credentials require PostgreSQL storage.' });
  }
  const { providerSlug, credentialSlug } = req.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(providerSlug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(credentialSlug)) {
    return res.status(400).json({ error: 'Invalid provider or credential name.' });
  }
  try {
    const result = await database.query(
      `DELETE FROM provider_api_credentials
       WHERE provider_slug = $1 AND credential_slug = $2`,
      [providerSlug, credentialSlug],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Provider credential not found.' });
    await auditAdminAction(req, 'provider_credential_deleted', { provider: providerSlug, credential: credentialSlug });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Could not delete provider credential:', error);
    return res.status(500).json({ error: 'Could not delete provider credential.' });
  }
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

app.get('/api/admin/issue-alert', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  const token = req.header('x-admin-token');
  const isOwner = Boolean(user && ownerEmails.has(user.email.trim().toLowerCase()));
  if (!isOwner) return res.status(403).json({ error: 'Owner admin access is required.' });
  if (!database) return res.json({ openCount: issueReportsStore.filter((report) => report.status === 'open').length });
  try {
    const result = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM offer_issue_reports WHERE status = 'open'`,
    );
    return res.json({ openCount: Number(result.rows[0]?.count || 0) });
  } catch (error) {
    console.error('Could not load issue alert count:', error);
    return res.json({ openCount: 0, warning: 'Issue alerts are temporarily unavailable.' });
  }
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

async function requireAuthenticatedOwnerAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header('x-admin-token');
  const session = token ? adminTokens.get(token) : undefined;
  if (session && session.expiresAt >= Date.now() && session.role === 'owner') {
    return next();
  }
  if (session && session.expiresAt < Date.now()) adminTokens.delete(token as string);

  const user = await getAuthenticatedUser(req);
  const isOwner = Boolean(user && ownerEmails.has(user.email.trim().toLowerCase()));
  if (!isOwner) return res.status(403).json({ error: 'Owner admin access is required.' });
  return next();
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
      const result = await database.query<{ id: string; email: string; username: string | null; created_at: Date; last_login_at: Date | null; account_status: 'active' | 'blocked' }>(
        `SELECT id, email, username, created_at, last_login_at, account_status
         FROM users
         ORDER BY created_at DESC`,
      );
      let activeSessionsByUser = new Map<string, number>();
      let warning: string | undefined;
      try {
        const sessions = await database.query<{ user_id: string; active_sessions: string }>(
          `SELECT user_id, COUNT(*)::text AS active_sessions
           FROM auth_sessions
           WHERE expires_at > NOW()
           GROUP BY user_id`,
        );
        activeSessionsByUser = new Map(sessions.rows.map((session) => [session.user_id, Number(session.active_sessions || 0)]));
      } catch (error) {
        console.error('Admin active session count query failed; returning accounts without counts.', error);
        warning = 'Active session counts are temporarily unavailable.';
      }
      return res.json({
        accounts: result.rows.map((account) => ({
          id: account.id,
          email: account.email,
          username: account.username,
          createdAt: account.created_at.toISOString(),
          lastLoginAt: account.last_login_at?.toISOString() || null,
          status: account.account_status,
          activeSessions: activeSessionsByUser.get(account.id) || 0,
        })),
        ...(warning ? { warning } : {}),
      });
    } catch (error) {
      console.error('Admin accounts query failed; returning memory accounts.', error);
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
    const result = await database.query(
      'UPDATE users SET account_status = $1, is_banned = ($1 = \'blocked\'), updated_at = NOW() WHERE id = $2 RETURNING id',
      [status, req.params.id],
    );
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

app.post('/api/v1/support/tickets', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to submit a support ticket.' });
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const transactionReferenceId = typeof req.body?.transactionReferenceId === 'string'
    ? req.body.transactionReferenceId.trim()
    : '';
  const screenshotUrl = typeof req.body?.screenshotUrl === 'string' ? req.body.screenshotUrl.trim() : '';
  if (subject.length < 3 || subject.length > 160) {
    return res.status(400).json({ field: 'subject', error: 'Subject must be 3-160 characters.' });
  }
  if (message.length < 10 || message.length > 5000) {
    return res.status(400).json({ field: 'message', error: 'Message must be 10-5,000 characters.' });
  }
  if (transactionReferenceId && !/^[A-Za-z0-9._:-]{1,255}$/.test(transactionReferenceId)) {
    return res.status(400).json({ field: 'transactionReferenceId', error: 'Enter a valid transaction or click reference.' });
  }
  if (screenshotUrl && (!/^https?:\/\/[^\s]{8,2048}$/i.test(screenshotUrl))) {
    return res.status(400).json({ field: 'screenshotUrl', error: 'Screenshot links must be public http(s) URLs.' });
  }
  const ticketId = randomUUID();
  const now = new Date().toISOString();
  const ticket = {
    id: ticketId,
    userId: user.id,
    transactionReferenceId: transactionReferenceId || null,
    screenshotUrl: screenshotUrl || null,
    subject,
    message,
    status: 'OPEN' as const,
    createdAt: now,
    resolvedAt: null,
  };
  if (database) {
    try {
      await database.query(
        `INSERT INTO support_tickets
          (id, user_id, transaction_reference_id, screenshot_url, subject, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')`,
        [ticketId, user.id, transactionReferenceId || null, screenshotUrl || null, subject, message],
      );
    } catch (error) {
      console.error('Could not create support ticket:', error);
      return res.status(500).json({ error: 'Could not create the support ticket.' });
    }
  }
  supportTicketsStore.set(ticketId, ticket);
  return res.status(201).json({ ticket });
});

app.get('/api/v1/support/tickets', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view support tickets.' });
  if (database) {
    try {
      const result = await database.query<{
        id: string;
        transaction_reference_id: string | null;
        screenshot_url: string | null;
        subject: string;
        message: string;
        status: 'OPEN' | 'PENDING_NETWORK_REVIEW' | 'RESOLVED';
        created_at: Date;
        resolved_at: Date | null;
      }>(
        `SELECT id, transaction_reference_id, screenshot_url, subject, message, status, created_at, resolved_at
         FROM support_tickets
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [user.id],
      );
      return res.json({
        tickets: result.rows.map((row) => ({
          id: row.id,
          userId: user.id,
          transactionReferenceId: row.transaction_reference_id,
          screenshotUrl: row.screenshot_url,
          subject: row.subject,
          message: row.message,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          resolvedAt: row.resolved_at?.toISOString() || null,
        })),
      });
    } catch (error) {
      console.error('Could not load support tickets:', error);
      return res.status(500).json({ error: 'Could not load support tickets.' });
    }
  }
  return res.json({
    tickets: [...supportTicketsStore.values()].filter((ticket) => ticket.userId === user.id),
  });
});

app.get('/api/admin/support/tickets', requireOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const result = await database.query<{
        id: string;
        user_id: string;
        transaction_reference_id: string | null;
        screenshot_url: string | null;
        subject: string;
        message: string;
        status: 'OPEN' | 'PENDING_NETWORK_REVIEW' | 'RESOLVED';
        created_at: Date;
        resolved_at: Date | null;
      }>(
        `SELECT id, user_id, transaction_reference_id, screenshot_url, subject, message, status, created_at, resolved_at
         FROM support_tickets
         ORDER BY created_at DESC
         LIMIT 500`,
      );
      return res.json({
        tickets: result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          transactionReferenceId: row.transaction_reference_id,
          screenshotUrl: row.screenshot_url,
          subject: row.subject,
          message: row.message,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          resolvedAt: row.resolved_at?.toISOString() || null,
        })),
      });
    } catch (error) {
      console.error('Could not load admin support tickets:', error);
      return res.status(500).json({ error: 'Could not load support tickets.' });
    }
  }
  return res.json({ tickets: [...supportTicketsStore.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

app.patch('/api/admin/support/tickets/:id', requireOwnerAdmin, async (req, res) => {
  const status = req.body?.status;
  if (!['OPEN', 'PENDING_NETWORK_REVIEW', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ error: 'Choose OPEN, PENDING_NETWORK_REVIEW, or RESOLVED.' });
  }
  const creditAmount = req.body?.creditAmount;
  const cents = typeof creditAmount === 'number' && Number.isFinite(creditAmount)
    ? Math.round(creditAmount * 100)
    : 0;
  if (creditAmount !== undefined && (cents <= 0 || cents > 2147483647 || Math.abs(creditAmount * 100 - cents) > 1e-7)) {
    return res.status(400).json({ error: 'Credit amount must be a positive dollar amount to the nearest cent.' });
  }
  if (database) {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ user_id: string; status: string }>(
        'SELECT user_id, status FROM support_tickets WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Support ticket not found.' });
      }
      if (cents > 0) {
        await client.query(
          `INSERT INTO survey_reward_balances (user_id, points)
           VALUES ($1, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [existing.rows[0].user_id],
        );
        await client.query(
          `UPDATE survey_reward_balances
           SET points = points + $2, updated_at = NOW()
           WHERE user_id = $1`,
          [existing.rows[0].user_id, cents],
        );
        await client.query(
          `INSERT INTO transactions
            (id, user_id, amount, type, reference_id)
           VALUES ($1, $2, $3, 'OFFER_COMPLETION', $4)
           ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING`,
          [randomUUID(), existing.rows[0].user_id, cents / 100, `support-credit:${req.params.id}`],
        );
      }
      const updated = await client.query(
        `UPDATE support_tickets
         SET status = $2, resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE NULL END
         WHERE id = $1
         RETURNING id, status, resolved_at`,
        [req.params.id, status],
      );
      await client.query('COMMIT');
      return res.json({
        ticket: {
          id: updated.rows[0].id,
          status: updated.rows[0].status,
          resolvedAt: updated.rows[0].resolved_at?.toISOString() || null,
        },
        creditedCents: cents,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('Could not update support ticket:', error);
      return res.status(500).json({ error: 'Could not update the support ticket.' });
    } finally {
      client.release();
    }
  }
  const ticket = supportTicketsStore.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
  ticket.status = status;
  ticket.resolvedAt = status === 'RESOLVED' ? new Date().toISOString() : null;
  return res.json({ ticket, creditedCents: cents });
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

app.get('/api/direct-messages/notifications', async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to check messages.' });
  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : new Date(0);
  if (Number.isNaN(since.getTime())) return res.status(400).json({ error: 'Invalid message timestamp.' });
  if (!database) return res.json({ messages: [] });
  const result = await database.query(
    `SELECT id, sender_id, content, created_at
     FROM direct_messages
     WHERE recipient_id = $1 AND created_at > $2
     ORDER BY created_at ASC LIMIT 20`,
    [user.id, since.toISOString()],
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
        } catch {
          sourceText = 'The public page could not be fetched.';
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

  const existingOffer = liveOffersStore[index];
  const verificationUpdate = resolveOfferVerificationUpdate(existingOffer, req.body);
  const updatedOffer = {
    ...existingOffer,
    ...req.body,
    ...verificationUpdate,
    id: liveOffersStore[index].id,
    status: resolveUpdatedOfferStatus(liveOffersStore[index].status, req.body.status),
    updatedAt: new Date().toISOString(),
  };
  if (updatedOffer.status === 'live' && !isPublishableOffer(updatedOffer)) {
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
  const verificationUpdate = resolveOfferVerificationUpdate({}, req.body);
  const offer = {
    ...req.body,
    ...verificationUpdate,
    id: req.body.id || `custom-${Date.now()}`,
    status: 'live',
    verificationStatus: verificationUpdate.verificationStatus || 'unverified',
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
  } catch (error) {
    logRequestError('CashBot scan', error);
    res.status(500).json({ error: 'The scan could not be completed.' });
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
  } catch (error) {
    logRequestError('AI Council matchmaker', error);
    res.status(500).json({ error: 'The analysis could not be completed.' });
  }
});

app.post('/api/analytics/impression', (_req, res) => {
  return res.status(410).json({ error: 'Offer impression tracking is disabled.' });
});

async function recordOfferAnalyticsEvent(offer: Offer, type: OfferAnalyticsEvent['type']) {
  const event: OfferAnalyticsEvent = { offerId: offer.id, type, recordedAt: new Date().toISOString() };
  if (database) {
    const client = await database.connect();
    const previousAnalytics = analyticsStore;
    const previousOfferCount = type === 'click' ? offer.clicksCount : offer.conversionsCount;
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO offer_analytics_events (id, offer_id, event_type, occurred_at)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), offer.id, type, event.recordedAt],
      );
      const column = type === 'click' ? 'total_clicks' : 'total_conversions';
      const result = await client.query<{ total_clicks: number; total_conversions: number }>(
        `UPDATE analytics_counters SET ${column} = ${column} + 1 WHERE id = 1
         RETURNING total_clicks, total_conversions`,
      );
      if (!result.rows[0]) throw new Error('Analytics counter row is missing.');
      analyticsStore = {
        totalClicks: result.rows[0].total_clicks,
        totalConversions: result.rows[0].total_conversions,
      };
      if (type === 'click') offer.clicksCount += 1;
      else offer.conversionsCount += 1;
      const savedOffer = await client.query(
        `UPDATE offers SET status = $2, offer = $3::jsonb, updated_at = $4 WHERE id = $1`,
        [offer.id, offer.status, offer, offer.updatedAt || new Date().toISOString()],
      );
      if (savedOffer.rowCount !== 1) throw new Error(`Offer ${offer.id} is missing from persistent storage.`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      analyticsStore = previousAnalytics;
      if (type === 'click') offer.clicksCount = previousOfferCount;
      else offer.conversionsCount = previousOfferCount;
      throw error;
    } finally {
      client.release();
    }
  } else {
    offerAnalyticsEvents.push(event);
    if (offerAnalyticsEvents.length > 50000) offerAnalyticsEvents.shift();
    analyticsStore[type === 'click' ? 'totalClicks' : 'totalConversions'] += 1;
    if (type === 'click') offer.clicksCount += 1;
    else offer.conversionsCount += 1;
  }
  return event;
}

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
  recordOfferAnalyticsEvent(offer, type)
    .then(() => res.json({
      success: true,
      stats: analyticsStore,
      offer: {
        id: offer.id,
        clicksCount: offer.clicksCount,
        conversionsCount: offer.conversionsCount,
      },
    }))
    .catch((error) => {
      console.error('Could not persist offer analytics:', error);
      return res.status(500).json({ error: 'Could not record analytics' });
    });
});

app.get('/api/admin/analytics/offers', requireAdmin, async (req, res) => {
  const requestedDays = req.query.days === undefined ? 7 : Number(req.query.days);
  if (requestedDays !== 7 && requestedDays !== 30) {
    return res.status(400).json({ error: 'Choose a 7-day or 30-day reporting period.' });
  }
  const periodDays = requestedDays as 7 | 30;
  const checkedAt = new Date();
  if (database) {
    try {
      const from = new Date(checkedAt.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const result = await database.query<{
        offer_id: string;
        clicks: string;
        conversions: string;
      }>(
        `SELECT offer_id,
           COUNT(*) FILTER (WHERE event_type = 'click')::text AS clicks,
           COUNT(*) FILTER (WHERE event_type = 'conversion')::text AS conversions
         FROM offer_analytics_events
         WHERE occurred_at >= $1 AND occurred_at <= $2
         GROUP BY offer_id`,
        [from.toISOString(), checkedAt.toISOString()],
      );
      const offers = Object.fromEntries(result.rows.map((row) => [
        row.offer_id,
        { clicks: Number(row.clicks), conversions: Number(row.conversions) },
      ]));
      const totals = Object.values(offers).reduce(
        (sum, activity) => ({
          clicks: sum.clicks + activity.clicks,
          conversions: sum.conversions + activity.conversions,
        }),
        { clicks: 0, conversions: 0 },
      );
      return res.json({
        periodDays,
        from: from.toISOString(),
        to: checkedAt.toISOString(),
        totals,
        offers,
      });
    } catch (error) {
      console.error('Could not load date-range offer analytics:', error);
      return res.status(500).json({ error: 'Could not load date-range offer analytics.' });
    }
  }
  return res.json(getOfferActivityReport(periodDays, checkedAt));
});

app.get('/api/admin/analytics/offers/since', requireAdmin, async (req, res) => {
  const requestedFrom = typeof req.query.from === 'string' ? Date.parse(req.query.from) : NaN;
  if (!Number.isFinite(requestedFrom)) {
    return res.status(400).json({ error: 'A valid last-checked timestamp is required.' });
  }

  const checkedAt = new Date();
  const retentionFloor = checkedAt.getTime() - 365 * 24 * 60 * 60 * 1000;
  const fromTime = Math.max(Math.min(requestedFrom, checkedAt.getTime()), retentionFloor);
  const from = new Date(fromTime).toISOString();
  const limitedByRetention = requestedFrom < retentionFloor;
  if (database) {
    try {
      const result = await database.query<{
        offer_id: string;
        clicks: string;
        conversions: string;
      }>(
        `SELECT offer_id,
           COUNT(*) FILTER (WHERE event_type = 'click')::text AS clicks,
           COUNT(*) FILTER (WHERE event_type = 'conversion')::text AS conversions
         FROM offer_analytics_events
         WHERE occurred_at >= $1 AND occurred_at <= $2
         GROUP BY offer_id`,
        [from, checkedAt.toISOString()],
      );
      const offers = Object.fromEntries(result.rows.map((row) => [
        row.offer_id,
        { clicks: Number(row.clicks), conversions: Number(row.conversions) },
      ]));
      const totals = Object.values(offers).reduce(
        (sum, activity) => ({
          clicks: sum.clicks + activity.clicks,
          conversions: sum.conversions + activity.conversions,
        }),
        { clicks: 0, conversions: 0 },
      );
      return res.json({
        from,
        to: checkedAt.toISOString(),
        totals,
        offers,
        limitedByRetention,
      });
    } catch (error) {
      console.error('Could not load clicks since the last check:', error);
      return res.status(500).json({ error: 'Could not load clicks since the last check.' });
    }
  }
  return res.json({
    ...buildOfferActivitySinceReport(offerAnalyticsEvents, from, checkedAt),
    limitedByRetention,
  });
});

app.get('/api/admin/referrals', requireOwnerAdmin, async (_req, res) => {
  if (!database) return res.status(503).json({ error: 'Referral payout records require the database service.' });
  try {
    const result = await database.query<{
      id: string;
      referrer_name: string | null;
      referrer_email: string;
      referred_email: string;
      status: 'pending' | 'completed' | 'void';
      bonus_amount: string;
      verified_net_revenue: string;
      created_at: Date | string;
      offer_activity: {
        offerId: string;
        company: string;
        title: string;
        status: 'active' | 'completed' | 'issue' | 'clicked';
        updatedAt: Date | string;
        reportedCompletedAt: Date | string | null;
        currentlySaved: boolean;
        clickCount: number;
        lastClickedAt: Date | string | null;
      }[];
    }>(
      `SELECT referrals.id,
              referrer.username AS referrer_name,
              referrer.email AS referrer_email,
              referred.email AS referred_email,
              referrals.status,
              referrals.bonus_amount::text,
              referrals.verified_net_revenue::text,
              referrals.created_at,
              offer_activity.offer_activity
       FROM referrals
       JOIN users AS referrer ON referrer.id = referrals.referrer_id
       JOIN users AS referred ON referred.id = referrals.referred_user_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'offerId', tracked.offer_id,
                    'company', COALESCE(offers.offer->>'company', 'Offer'),
                    'title', COALESCE(offers.offer->>'title', tracked.offer_id),
                    'status', tracked.status,
                    'updatedAt', tracked.updated_at,
                    'reportedCompletedAt', tracked.reported_completed_at,
                    'currentlySaved', tracked.currently_saved,
                    'clickCount', COALESCE(click_activity.click_count, 0),
                    'lastClickedAt', click_activity.last_clicked_at
                  ) ORDER BY COALESCE(tracked.reported_completed_at, tracked.updated_at) DESC
                ),
                '[]'::jsonb
              ) AS offer_activity
         FROM (
           SELECT entries.user_id,
                  entries.offer_id,
                  entries.status,
                  entries.updated_at,
                  completion.reported_at AS reported_completed_at,
                  TRUE AS currently_saved
           FROM user_offer_entries AS entries
           LEFT JOIN user_offer_completion_reports AS completion
             ON completion.user_id = entries.user_id AND completion.offer_id = entries.offer_id
           WHERE entries.user_id = referrals.referred_user_id
           UNION ALL
           SELECT completion.user_id,
                  completion.offer_id,
                  'completed' AS status,
                  completion.reported_at AS updated_at,
                  completion.reported_at AS reported_completed_at,
                  FALSE AS currently_saved
           FROM user_offer_completion_reports AS completion
           WHERE completion.user_id = referrals.referred_user_id
             AND NOT EXISTS (
               SELECT 1
               FROM user_offer_entries AS entries
               WHERE entries.user_id = completion.user_id
                 AND entries.offer_id = completion.offer_id
             )
           UNION ALL
           SELECT referrals.referred_user_id,
                  clicks.offer_id,
                  'clicked' AS status,
                  MAX(clicks.clicked_at) AS updated_at,
                  NULL::timestamptz AS reported_completed_at,
                  FALSE AS currently_saved
           FROM referral_offer_clicks AS clicks
           WHERE clicks.referral_id = referrals.id
             AND NOT EXISTS (
               SELECT 1
               FROM user_offer_entries AS entries
               WHERE entries.user_id = referrals.referred_user_id
                 AND entries.offer_id = clicks.offer_id
             )
             AND NOT EXISTS (
               SELECT 1
               FROM user_offer_completion_reports AS completion
               WHERE completion.user_id = referrals.referred_user_id
                 AND completion.offer_id = clicks.offer_id
             )
           GROUP BY referrals.referred_user_id, clicks.offer_id
         ) AS tracked
         LEFT JOIN offers ON offers.id = tracked.offer_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS click_count, MAX(clicks.clicked_at) AS last_clicked_at
           FROM referral_offer_clicks AS clicks
           WHERE clicks.referral_id = referrals.id AND clicks.offer_id = tracked.offer_id
         ) AS click_activity ON TRUE
       ) AS offer_activity ON TRUE
       ORDER BY CASE WHEN referrals.status = 'pending' THEN 0 ELSE 1 END,
                referrals.created_at DESC
       LIMIT 500`,
    );
    return res.json({
      minimumNetRevenue: REFERRAL_MIN_NET_REVENUE,
      referrals: result.rows.map((row) => ({
        id: row.id,
        referrerName: row.referrer_name || 'Member without a username',
        referrerEmail: row.referrer_email,
        referredEmail: row.referred_email,
        status: row.status,
        bonusAmount: Number(row.bonus_amount),
        verifiedNetRevenue: Number(row.verified_net_revenue),
        createdAt: new Date(row.created_at).toISOString(),
        offerActivity: row.offer_activity.map((entry) => ({
          ...entry,
          updatedAt: new Date(entry.updatedAt).toISOString(),
          reportedCompletedAt: entry.reportedCompletedAt
            ? new Date(entry.reportedCompletedAt).toISOString()
            : null,
          clickCount: Number(entry.clickCount),
          lastClickedAt: entry.lastClickedAt
            ? new Date(entry.lastClickedAt).toISOString()
            : null,
        })),
      })),
    });
  } catch (error) {
    console.error('Could not load referral payout records:', error);
    return res.status(500).json({ error: 'Could not load referral payout records.' });
  }
});

app.put('/api/admin/referrals/:id/status', requireOwnerAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Referral payout records require the database service.' });
  const status = req.body?.status;
  if (status !== 'completed' && status !== 'void') {
    return res.status(400).json({ error: 'Choose completed or void as the referral status.' });
  }
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const eligibility = await client.query<{
      id: string;
      referrer_id: string;
      status: string;
      bonus_amount: string;
      verified_net_revenue: string;
    }>(
      `SELECT id, referrer_id, status, bonus_amount::text, verified_net_revenue::text
       FROM referrals WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    const referral = eligibility.rows[0];
    if (!referral || referral.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Pending referral payout not found. Refresh the queue and try again.' });
    }
    if (status === 'completed' && !canApproveReferralPayout(Number(referral.verified_net_revenue))) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `At least $${REFERRAL_MIN_NET_REVENUE.toFixed(2)} in verified net commission must be received for this signup before its $5.00 reward can be completed.`,
      });
    }

    let creditedPoints = 0;
    let walletBalancePoints: number | null = null;
    if (status === 'completed') {
      const points = Math.round(Number(referral.bonus_amount) * SURVEY_POINTS_PER_DOLLAR);
      if (!Number.isSafeInteger(points) || points <= 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This referral does not have a valid points reward.' });
      }
      await client.query(
        `INSERT INTO survey_reward_balances (user_id, points)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [referral.referrer_id],
      );
      const balance = await client.query<{ points: number }>(
        'SELECT points FROM survey_reward_balances WHERE user_id = $1 FOR UPDATE',
        [referral.referrer_id],
      );
      const previousCredit = await client.query(
        'SELECT 1 FROM referral_wallet_credits WHERE referral_id = $1',
        [referral.id],
      );
      if (!previousCredit.rowCount) {
        const currentPoints = Number(balance.rows[0]?.points || 0);
        if (currentPoints > 2_147_483_647 - points) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'The referrer wallet is at its points limit; this reward was not approved.' });
        }
        await client.query(
          `INSERT INTO referral_wallet_credits (referral_id, referrer_id, points)
           VALUES ($1, $2, $3)`,
          [referral.id, referral.referrer_id, points],
        );
        const updatedBalance = await client.query<{ points: number }>(
          `UPDATE survey_reward_balances
           SET points = points + $2, updated_at = NOW()
           WHERE user_id = $1
           RETURNING points`,
          [referral.referrer_id, points],
        );
        creditedPoints = points;
        walletBalancePoints = Number(updatedBalance.rows[0].points);
      } else {
        walletBalancePoints = Number(balance.rows[0]?.points || 0);
      }
    }
    const result = await client.query<{ id: string; status: 'completed' | 'void' }>(
      `UPDATE referrals SET status = $1 WHERE id = $2 AND status = 'pending'
       RETURNING id, status`,
      [status, referral.id],
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This referral payout changed before it could be updated. Refresh the queue and try again.' });
    }
    await client.query('COMMIT');
    return res.json({
      referral: result.rows[0],
      ...(status === 'completed' ? { creditedPoints, walletBalancePoints } : {}),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not update referral payout status:', error);
    return res.status(500).json({ error: 'Could not update referral payout status.' });
  } finally {
    client.release();
  }
});

app.put('/api/admin/referrals/:id/revenue', requireOwnerAdmin, async (req, res) => {
  if (!database) return res.status(503).json({ error: 'Referral payout records require the database service.' });
  const amount = req.body?.verifiedNetRevenue;
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 99_999_999.99 ||
    Math.abs(amount - Number(amount.toFixed(2))) > 1e-9
  ) {
    return res.status(400).json({ error: 'Enter verified net commission received to the nearest cent, between $0 and $99,999,999.99.' });
  }
  try {
    const result = await database.query<{ id: string; verified_net_revenue: string; status: string }>(
      `UPDATE referrals
       SET verified_net_revenue = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING id, verified_net_revenue::text, status`,
      [amount.toFixed(2), req.params.id],
    );
    const referral = result.rows[0];
    if (!referral) return res.status(404).json({ error: 'Pending referral record not found.' });
    return res.json({
      referral: {
        id: referral.id,
        status: referral.status,
        verifiedNetRevenue: Number(referral.verified_net_revenue),
      },
    });
  } catch (error) {
    console.error('Could not record verified referral revenue:', error);
    return res.status(500).json({ error: 'Could not record verified referral revenue.' });
  }
});

app.get('/api/admin/revenue', requireOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const result = await database.query<{
        id: string;
        offer_id: string;
        event_type: 'conversion' | 'commission';
        amount: string | null;
        note: string;
        recorded_at: Date | string;
      }>(
        `SELECT id, offer_id, event_type, amount::text, note, recorded_at
         FROM offer_revenue_events
         ORDER BY recorded_at DESC
         LIMIT 200`,
      );
      return res.json({
        events: result.rows.map((row) => {
          const offer = liveOffersStore.find((candidate) => candidate.id === row.offer_id);
          return {
            id: row.id,
            offerId: row.offer_id,
            company: offer?.company || 'Removed offer',
            title: offer?.title || row.offer_id,
            type: row.event_type,
            amount: row.amount === null ? null : Number(row.amount),
            note: row.note,
            recordedAt: new Date(row.recorded_at).toISOString(),
          };
        }),
      });
    } catch (error) {
      console.error('Could not load confirmed offer revenue:', error);
      return res.status(500).json({ error: 'Could not load the revenue ledger.' });
    }
  }
  return res.json({ events: offerRevenueEvents.slice(-200).reverse() });
});

app.post('/api/admin/revenue', requireOwnerAdmin, async (req, res) => {
  const { offerId, type } = req.body || {};
  const amount = req.body?.amount;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (typeof offerId !== 'string' || !liveOffersStore.some((offer) => offer.id === offerId)) {
    return res.status(400).json({ error: 'Choose a valid offer.' });
  }
  if (type !== 'conversion' && type !== 'commission') {
    return res.status(400).json({ error: 'Choose a confirmed conversion or received commission.' });
  }
  if (type === 'commission'
    && (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount * 100))) {
    return res.status(400).json({ error: 'Enter a received commission greater than $0 with no more than two decimal places.' });
  }
  if (type === 'conversion' && amount !== undefined && amount !== null) {
    return res.status(400).json({ error: 'Only received commissions can include an amount.' });
  }
  if (note.length > 500) return res.status(400).json({ error: 'Notes must be 500 characters or fewer.' });

  const offer = liveOffersStore.find((candidate) => candidate.id === offerId);
  const event: OfferRevenueEvent = {
    id: randomUUID(),
    offerId,
    company: offer.company,
    title: offer.title,
    type,
    amount: type === 'commission' ? amount : null,
    note,
    recordedAt: new Date().toISOString(),
  };
  if (database) {
    try {
      await database.query(
        `INSERT INTO offer_revenue_events (id, offer_id, event_type, amount, note, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, event.offerId, event.type, event.amount, event.note, event.recordedAt],
      );
    } catch (error) {
      console.error('Could not record confirmed offer revenue:', error);
      return res.status(500).json({ error: 'Could not save the revenue entry.' });
    }
  } else {
    offerRevenueEvents.push(event);
    if (offerRevenueEvents.length > 5000) offerRevenueEvents.shift();
  }
  return res.status(201).json({ event });
});

app.delete('/api/admin/revenue/:id', requireOwnerAdmin, async (req, res) => {
  const eventId = req.params.id;
  if (database) {
    try {
      const result = await database.query(
        'DELETE FROM offer_revenue_events WHERE id = $1',
        [eventId],
      );
      if (result.rowCount !== 1) return res.status(404).json({ error: 'Revenue record not found.' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Could not delete confirmed offer revenue:', error);
      return res.status(500).json({ error: 'Could not delete the revenue record.' });
    }
  }
  const eventIndex = offerRevenueEvents.findIndex((event) => event.id === eventId);
  if (eventIndex < 0) return res.status(404).json({ error: 'Revenue record not found.' });
  offerRevenueEvents.splice(eventIndex, 1);
  return res.json({ success: true });
});

app.post('/api/analytics/pageview', async (_req, res) => {
  try {
    await recordAggregatePageView();
  } catch (error) {
    console.error('Could not record aggregate page view:', error);
    return res.status(500).json({ error: 'Could not record page view.' });
  }
  return res.status(204).end();
});

app.get('/api/admin/analytics/totals', requireOwnerAdmin, async (_req, res) => {
  if (database) {
    try {
      const result = await database.query<{
        total_clicks: number;
        total_page_views: number;
        page_views_since: Date;
      }>(
        'SELECT total_clicks, total_page_views, page_views_since FROM analytics_counters WHERE id = 1',
      );
      const totals = result.rows[0];
      if (!totals) throw new Error('Analytics counter row is missing.');
      aggregatePageViewCount = totals.total_page_views;
      aggregatePageViewsSince = new Date(totals.page_views_since).toISOString();
      return res.json({
        totalClicks: totals.total_clicks,
        totalPageViews: totals.total_page_views,
        pageViewsSince: aggregatePageViewsSince,
      });
    } catch (error) {
      console.error('Could not load aggregate analytics totals:', error);
      return res.status(500).json({ error: 'Could not load analytics totals.' });
    }
  }
  return res.json({
    totalClicks: analyticsStore.totalClicks,
    totalPageViews: aggregatePageViewCount,
    pageViewsSince: aggregatePageViewsSince,
  });
});

app.get('/api/admin/analytics/summary', requireOwnerAdmin, async (_req, res) => {
  if (!database) {
    return res.json({
      totalPaidToMembersCents: 0,
      totalOffersCompleted: analyticsStore.totalConversions,
      activeUsers24h: 0,
      offerPerformance: [],
      storage: 'memory',
    });
  }
  try {
    const paid = await database.query<{ cents: string }>(
      `SELECT COALESCE(ROUND(SUM(amount) * 100), 0)::text AS cents
       FROM transactions
       WHERE type = 'WITHDRAWAL'
         AND payout_status = 'COMPLETED'`,
    );
    const completed = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM offer_analytics_events
       WHERE event_type = 'conversion'
         AND occurred_at >= NOW() - INTERVAL '24 hours'`,
    );
    const active = await database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM users
       WHERE last_login_at >= NOW() - INTERVAL '24 hours'`,
    );
    const offerRows = await database.query<{
      offer_id: string;
      conversions: string;
      clicks: string;
    }>(
      `SELECT offer_id,
              COUNT(*) FILTER (WHERE event_type = 'conversion')::text AS conversions,
              COUNT(*) FILTER (WHERE event_type = 'click')::text AS clicks
       FROM offer_analytics_events
       WHERE occurred_at >= NOW() - INTERVAL '30 days'
       GROUP BY offer_id
       ORDER BY COUNT(*) FILTER (WHERE event_type = 'conversion') DESC`,
    );
    const securityRows = await database.query<{
      offer_id: string;
      security_failures: string;
      signature_mismatches: string;
      chargebacks: string;
    }>(
      `SELECT offer_id,
              COUNT(*) FILTER (WHERE event_type = 'security_failure')::text AS security_failures,
              COUNT(*) FILTER (WHERE event_type = 'signature_mismatch')::text AS signature_mismatches,
              COUNT(*) FILTER (WHERE event_type = 'chargeback')::text AS chargebacks
       FROM offer_security_events
       WHERE occurred_at >= NOW() - INTERVAL '30 days'
       GROUP BY offer_id`,
    );
    const securityByOffer = new Map(securityRows.rows.map((row) => [row.offer_id, row]));
    const offers = offerRows.rows.map((row) => {
      const clicks = Number(row.clicks);
      const conversions = Number(row.conversions);
      const security = securityByOffer.get(row.offer_id);
      return {
        offerId: row.offer_id,
        clicks,
        conversions,
        conversionRate: clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0,
        securityFailures: security ? Number(security.security_failures) : 0,
        signatureMismatches: security ? Number(security.signature_mismatches) : 0,
        chargebacks: security ? Number(security.chargebacks) : 0,
      };
    });
    return res.json({
      totalPaidToMembersCents: Math.abs(Number(paid.rows[0]?.cents || 0)),
      totalOffersCompleted: Number(completed.rows[0]?.count || 0),
      activeUsers24h: Number(active.rows[0]?.count || 0),
      offerPerformance: offers,
      storage: 'database',
    });
  } catch (error) {
    console.error('Could not load analytics summary:', error);
    return res.status(500).json({ error: 'Could not load analytics summary.' });
  }
});

app.get('/api/admin/analytics/ledger-integrity', requireOwnerAdmin, async (_req, res) => {
  if (!database) {
    return res.json({
      status: 'not_applicable',
      storage: 'memory',
      checkedAt: new Date().toISOString(),
      transactionCreditsCents: 0,
      liveUserBalanceCents: 0,
      differenceCents: 0,
      note: 'Ledger integrity requires persistent database storage.',
    });
  }
  try {
    const aggregate = await database.query<{
      transaction_credits: string;
      live_user_balance: string;
    }>(
      `SELECT
         (SELECT COALESCE(ROUND(SUM(amount) FILTER (WHERE amount > 0) * 100), 0)
          FROM transactions)::text AS transaction_credits,
         (SELECT COALESCE(ROUND(SUM(balance) * 100), 0)
          FROM users)::text AS live_user_balance`,
    );
    const transactionCreditsCents = Math.round(Number(aggregate.rows[0]?.transaction_credits || 0));
    const liveUserBalanceCents = Math.round(Number(aggregate.rows[0]?.live_user_balance || 0));
    const differenceCents = transactionCreditsCents - liveUserBalanceCents;
    const status = Math.abs(differenceCents) === 0 ? 'healthy' : 'anomalous';
    const runId = randomUUID();
    await database.query(
      `INSERT INTO ledger_integrity_runs
        (id, checked_at, transaction_credits, live_user_balance, difference, status)
       VALUES ($1, NOW(), $2, $3, $4, $5)`,
      [runId, transactionCreditsCents / 100, liveUserBalanceCents / 100, differenceCents / 100, status],
    );
    return res.json({
      status,
      storage: 'database',
      checkedAt: new Date().toISOString(),
      runId,
      transactionCreditsCents,
      liveUserBalanceCents,
      differenceCents,
    });
  } catch (error) {
    console.error('Could not run ledger integrity audit:', error);
    return res.status(500).json({ error: 'Could not run ledger integrity audit.' });
  }
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
        } catch {
          return { offerId: offer.id, company: offer.company, status: 0, healthy: false, error: 'Request failed' };
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
  aggregatePageViewCount = 0;
  aggregatePageViewsSince = new Date().toISOString();
  analyticsReportCheckpoint = null;
  offerImpressionsStore.length = 0;
  offerAnalyticsEvents.length = 0;
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
      await database.query(
        'UPDATE analytics_counters SET total_clicks = 0, total_conversions = 0, total_page_views = 0, page_views_since = NOW() WHERE id = 1',
      );
      await database.query('DELETE FROM offer_analytics_events');
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
          `<div style="display:inline-block;padding:6px 10px;border:1px solid rgba(45,212,238,.35);border-radius:999px;color:#2dd4ee;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New offer drop</div>
           <h1 style="margin:18px 0 10px;color:#fff;font-size:28px;line-height:1.2;">${escapeEmailHtml(String(offer.company))}</h1>
           <p style="margin:0 0 22px;color:#cbd5e1;font-size:16px;line-height:1.5;">${escapeEmailHtml(String(offer.title))}</p>
           <div style="padding:16px;border:1px solid rgba(45,212,238,.2);border-radius:12px;background:rgba(45,212,238,.06);">
             <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Advertised reward</div>
             <div style="margin-top:6px;color:#2dd4ee;font-size:24px;font-weight:700;">${escapeEmailHtml(String(offer.incentiveAmount))}</div>
           </div>
           <p style="margin:22px 0;color:#cbd5e1;font-size:14px;line-height:1.6;">Review the current requirements and merchant terms before applying.</p>
           ${emailButton(offer.referralUrl, 'Review this offer')}
           <p style="margin:24px 0 0;font-size:11px;"><a href="${escapeEmailHtml(unsubscribeUrl)}" style="color:#94a3b8;">Unsubscribe from offer alerts</a></p>`,
          'You are receiving this because you confirmed email alerts from Signups4FastCash.com. Offers and terms can change.',
        ),
      );
    }));
    await auditAdminAction(req, 'newsletter_broadcast', { offerId: offer.id, recipientCount: subscribers.rows.length });
    return res.json({ delivered: subscribers.rows.length, recipientCount: subscribers.rows.length, status: 'delivered' });
  } catch (error) {
    logRequestError('Newsletter broadcast', error);
    await auditAdminAction(req, 'newsletter_broadcast_failed', { offerId: offer.id, recipientCount: subscribers.rows.length });
    return res.status(502).json({ error: 'Newsletter delivery failed. Please try again later.' });
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
          `<div style="display:inline-block;padding:6px 10px;border:1px solid rgba(45,212,238,.35);border-radius:999px;color:#2dd4ee;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Email alerts</div>
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
      logRequestError('Newsletter subscription', error);
      return res.status(500).json({ error: 'Could not subscribe at this time.' });
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
             <div style="display:inline-block;padding:6px 10px;border:1px solid rgba(45,212,238,.35);border-radius:999px;color:#2dd4ee;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">You are in</div>
             <h1 style="margin:18px 0 12px;color:#fff;font-size:28px;line-height:1.2;">Your alerts are active</h1>
             <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">We’ll send new offer drops according to the frequency you selected. Each alert links back to the official provider and keeps the requirements visible before you click.</p>
             ${emailButton(`${appUrl}/`, 'Browse current offers')}
           </div>`,
          'You can unsubscribe from any alert in one click. We do not sell subscriber addresses.',
        ),
      );
    } catch (error) {
      console.error('Newsletter welcome email failed:', error);
    }
  }
  res.type('html').send(newsletterEmailLayout(
    `<div style="text-align:center;"><div style="font-size:40px;color:#2dd4ee;">✓</div><h1 style="margin:12px 0;color:#fff;">Email alerts confirmed</h1><p style="color:#cbd5e1;font-size:15px;line-height:1.6;">You are now subscribed to Signups4FastCash.com alerts.</p>${emailButton(`${appUrl}/`, 'Return to the offers')}</div>`,
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
    `<div style="text-align:center;"><h1 style="margin:0 0 12px;color:#fff;">You are unsubscribed</h1><p style="color:#cbd5e1;font-size:15px;line-height:1.6;">You will not receive further alerts from this list.</p>${emailButton(`${appUrl}/`, 'Return to the offers')}</div>`,
  ));
});

// API: Newsletter subscriber count
app.get('/api/newsletter/subscribers', async (req, res) => {
  if (!database) {
    return res.json({ count: subscribersStore.filter((subscriber) => subscriber.verified && !subscriber.unsubscribedAt).length });
  }
  try {
    const count = await database.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM newsletter_subscribers WHERE verified = TRUE AND unsubscribed_at IS NULL',
    );
    return res.json({ count: Number(count.rows[0]?.count || 0) });
  } catch {
    return res.status(500).json({ error: 'Could not load subscribers' });
  }
});

app.get('/api/admin/newsletter/subscribers', requireOwnerAdmin, async (_req, res) => {
  if (!database) {
    return res.json({
      subscribers: subscribersStore
        .filter((subscriber) => subscriber.verified && !subscriber.unsubscribedAt)
        .map(({ id, email, subscribedAt, frequency, verified }) => ({ id, email, subscribedAt, frequency, verified })),
    });
  }
  try {
    const result = await database.query<{ id: string; email: string; subscribed_at: Date; frequency: string; verified: boolean }>(
      `SELECT id, email, subscribed_at, frequency, verified
       FROM newsletter_subscribers
       WHERE verified = TRUE AND unsubscribed_at IS NULL
       ORDER BY subscribed_at DESC`,
    );
    return res.json({
      subscribers: result.rows.map((subscriber) => ({
        id: subscriber.id,
        email: subscriber.email,
        subscribedAt: new Date(subscriber.subscribed_at).toISOString(),
        frequency: subscriber.frequency,
        verified: subscriber.verified,
      })),
    });
  } catch (error) {
    console.error('Could not load owner newsletter subscriber list:', error);
    return res.status(500).json({ error: 'Could not load subscribers' });
  }
});

const requestErrorHandler: express.ErrorRequestHandler = (error, req, res, next) => {
  const errorStatus = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  const status = typeof errorStatus === 'number' && errorStatus >= 400 && errorStatus < 500
    ? errorStatus
    : 500;
  logRequestError(`Request ${req.method} ${req.path} (${status})`, error);

  if (res.headersSent) return next(error);
  return res.status(status).json({
    error: status >= 500
      ? 'An unexpected server error occurred.'
      : 'The request could not be processed.',
  });
};

app.use(requestErrorHandler);

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
  app.use(requestErrorHandler);

  const httpServer = createHttpServer(app);
  liveActivitySocketServer = new WebSocketServer({ noServer: true });
  notificationSocketServer = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (request, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
    } catch {
      socket.destroy();
      return;
    }
    const target = pathname === '/ws/activity'
      ? liveActivitySocketServer
      : pathname === '/ws/notifications'
        ? notificationSocketServer
        : null;
    if (!target) {
      socket.destroy();
      return;
    }
    target.handleUpgrade(request, socket, head, (webSocket) => {
      target.emit('connection', webSocket, request);
    });
  });
  liveActivitySocketServer.on('connection', (socket) => {
    socket.send(JSON.stringify({
      event: 'cashout.connected',
      data: { timestamp: new Date().toISOString() },
    }));
  });
  notificationSocketServer.on('connection', (socket, request) => {
    void (async () => {
      try {
        const origin = request.headers.origin;
        const host = request.headers.host;
        if (!origin || !host || new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
          socket.close(1008, 'Same-origin connection required');
          return;
        }
        const userId = await getNotificationSocketUserId(request);
        if (!userId || socket.readyState !== WebSocket.OPEN) {
          socket.close(1008, 'Authentication required');
          return;
        }
        const sockets = notificationSocketsByUser.get(userId) || new Set<WebSocket>();
        sockets.add(socket);
        notificationSocketsByUser.set(userId, sockets);
        socket.send(JSON.stringify({
          event: 'notification.connected',
          data: { timestamp: new Date().toISOString() },
        }));
        const removeSocket = () => {
          sockets.delete(socket);
          if (!sockets.size) notificationSocketsByUser.delete(userId);
        };
        socket.on('close', removeSocket);
        socket.on('error', (error) => {
          console.error('Notification WebSocket error:', error);
          removeSocket();
        });
      } catch (error) {
        console.error('Could not authenticate notification WebSocket:', error);
        socket.close(1011, 'Could not authenticate connection');
      }
    })();
  });
  const pingTimer = setInterval(() => {
    liveActivitySocketServer?.clients.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    });
    notificationSocketServer?.clients.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    });
  }, 30_000);
  pingTimer.unref();
  startMockActivityWorker();
  startRpsLobbyTimeoutWorker();
  startScheduledWorkers();
  startOfferFeedWorker();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`signups4fastcash.com server running on http://0.0.0.0:${PORT}`);
  });
}

export { app, applyCoinsBackTerms, createGoogleOAuthState, isTemporarilyHiddenOffer, isVerificationCurrent, mergeCatalogOffer, newsletterEmailLayout, readGoogleOAuthState, resolveOfferVerificationUpdate };

if (env.NODE_ENV !== 'test') {
  initializeOfferStore()
    .then(startServer)
    .catch((error) => {
      console.error('Failed to initialize offer store:', error);
      process.exit(1);
    });
}
