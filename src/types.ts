export type OfferCategory = 'fintech' | 'brokerage' | 'cashback' | 'apps' | 'crypto';

export interface SpeedrunStep {
  step: number;
  instruction: string;
  proTip?: string;
  screenshotUrl?: string;
  screenshotAlt?: string;
}

export interface AICouncilReview {
  consensusScore: number; // e.g. 98 out of 100
  unanimousApproval: boolean;
  deepseekRoiEstimate: string; // e.g. "$1,250/hr effective yield"
  llamaCatchRisk: 'Low' | 'Moderate' | 'High';
  mistralCompliance: string; // e.g. "FDIC Member / SIPC Insured"
  qwenEfficiencyScore: string; // e.g. "3 steps / 2 min 40s avg"
  geminiLiveVerified: string; // e.g. "Active promo checked within 1h"
  councilSummary: string;
}

export interface Offer {
  id: string;
  company: string;
  companySlug: string;
  title: string;
  category: OfferCategory;
  incentiveAmount: string; // e.g. "$100 Cash", "Up to $200", "$25 Instant"
  incentiveValue: number; // numeric value in USD for sorting and stats
  payoutSpeed: string; // e.g. "Instant", "Within 24 hours", "2-3 business days"
  difficulty: 'Easy (2 min)' | 'Fast (5 min)' | 'Standard (10 min)' | 'Moderate (10 min)';
  depositRequired: string; // e.g. "$0", "$1 deposit", "$10 purchase"
  availability: string;
  officialMerchantUrl: string;
  referralCode?: string;
  referralCodeRequired?: boolean;
  referralUrl: string;
  sourceUrl?: string;
  verifiedAt?: string;
  verificationExpiresAt?: string;
  verificationStatus?: 'unverified' | 'reviewed' | 'terms-vary';
  
  // "Logo for each company its for displayed next to the offer title"
  logoSvgKey?: string;
  logoUrl?: string;
  logoBgColor?: string;
  logoTextColor?: string;

  // "Inform anyone of the truth and no bull crap"
  honestTruth: {
    summary: string;
    theCatch: string;
    minimumHoldTime: string;
    idVerificationRequired: boolean;
    hiddenFeesWarning: string;
    trustScore: number; // e.g. 98 out of 100
  };

  // "Hint section on every offer that tells them step by step the simplified easy way to get it done fast and efficiently"
  speedrunHints: SpeedrunStep[];

  // Multi-AI Council Consensus Breakdown
  aiCouncil?: AICouncilReview;

  status: 'live' | 'hidden' | 'pending' | 'rejected';
  featured?: boolean;
  clicksCount: number;
  conversionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfferActivity {
  clicks: number;
  conversions: number;
}

export interface OfferActivityReport {
  periodDays: 7 | 30;
  from: string;
  to: string;
  totals: OfferActivity;
  offers: Record<string, OfferActivity>;
}

export interface OfferActivitySinceReport {
  from: string;
  to: string;
  totals: OfferActivity;
  offers: Record<string, OfferActivity>;
  limitedByRetention?: boolean;
}

export interface OfferRevenueEvent {
  id: string;
  offerId: string;
  company: string;
  title: string;
  type: 'conversion' | 'commission';
  amount: number | null;
  note: string;
  recordedAt: string;
}

export interface CashBotScanResult {
  id: string;
  scannedAt: string;
  status: 'idle' | 'scanning' | 'completed' | 'failed';
  foundCount: number;
  sourceSummaries: string[];
  findings: Offer[];
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
  verified: boolean;
  frequency: 'instant' | 'daily' | 'weekly';
}

export interface EmailBlastLog {
  id: string;
  offerId: string;
  offerTitle: string;
  sentAt: string;
  recipientCount: number;
  subject: string;
  pushSent: boolean;
  status?: 'delivered' | 'failed' | 'not_configured';
  failureReason?: string;
}

export interface SiteSettings {
  siteName: string;
  siteTagline: string;
  heroBadge: string;
  mainHeadline: string;
  subHeadline: string;
  brandName: string;
  brandBadge: string;
  footerBlurb: string;
  supportEmail: string;
  footerDisclaimer: string;
  trustHeading: string;
  trustParagraph: string;
  trustSubtext: string;
  metaTitle: string;
  metaDescription: string;
  themeBackgroundColor: string;
  themeAccentColor: string;
  themePanelColor: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Signups4FastCash.com',
  siteTagline: 'Offers, with the fine print up front',
  heroBadge: 'Offers, with the fine print up front',
  mainHeadline: 'Compare rewards before you sign up.',
  subHeadline: 'Review signup bonuses, cashback offers, and referral rewards with requirements, payout timing, and important terms shown upfront.',
  brandName: 'Signups4FastCash.com',
  brandBadge: 'Check current offer terms',
  footerBlurb: 'S4FC lists referral and promo offers, notes the requirements and payout details available, and links to the company running each offer. The company decides who qualifies and whether a reward is paid.',
  supportEmail: 'support@signups4fastcash.com',
  footerDisclaimer: 'Please do not send passwords, bank details, or government ID by email. Merchant terms and payouts can change at any time.',
  trustHeading: 'Check the details before you sign up',
  trustParagraph: 'S4FC lists referral and promo offers, notes the requirements and payout details available, and links to the company running each offer. The company decides who qualifies and whether a reward is paid. S4FC does not handle applications or money.',
  trustSubtext: 'Some links may earn S4FC a referral commission at no extra cost to you. Offers can change or end, so read the company’s current terms before signing up.',
  metaTitle: 'Compare Rewards Before You Sign Up | Signups4FastCash.com',
  metaDescription: 'Compare signup bonuses, cashback offers, and referral rewards with requirements, payout timing, and important terms shown upfront.',
  themeBackgroundColor: '#02070d',
  themeAccentColor: '#2dd4ee',
  themePanelColor: '#0b1520',
};

export interface AnalyticsSummary {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  estimatedOwnerRevenue: number;
  communityCashUnlocked: number;
  dailyStats: {
    date: string;
    clicks: number;
    conversions: number;
    estimatedRevenue: number;
  }[];
}
