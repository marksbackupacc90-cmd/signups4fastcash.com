export type OfferCategory = 'fintech' | 'brokerage' | 'cashback' | 'apps' | 'crypto';

export interface SpeedrunStep {
  step: number;
  instruction: string;
  proTip?: string;
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
  difficulty: 'Easy (2 min)' | 'Fast (5 min)' | 'Standard (10 min)';
  depositRequired: string; // e.g. "$0", "$1 deposit", "$10 purchase"
  officialMerchantUrl: string;
  referralCode?: string;
  referralUrl: string;
  sourceUrl?: string;
  verifiedAt?: string;
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

  status: 'live' | 'pending' | 'rejected';
  featured?: boolean;
  clicksCount: number;
  conversionsCount: number;
  createdAt: string;
  updatedAt: string;
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
  siteTagline: 'Rewards and cashback with clear terms',
  heroBadge: 'Rewards and cashback with clear terms',
  mainHeadline: 'Find the offers worth your time.',
  subHeadline: 'Compare the best signup bonuses, no-deposit offers, cashback rewards, and referral incentives with the actual requirements, payout timing, and fine print visible before you click through.',
  brandName: 'Signups4FastCash.com',
  brandBadge: 'Verified terms shown',
  footerBlurb: 'Signups4FastCash.com is an independent rewards comparison resource. We summarize publicly available promotions, show the requirements and fine print, and send visitors back to the official merchant website to apply.',
  supportEmail: 'support@signups4fastcash.com',
  footerDisclaimer: 'Questions or corrections? Email support@signups4fastcash.com. Please do not send passwords, bank details, or government ID by email. Merchant terms and payouts can change at any time.',
  trustHeading: 'Compare signup bonuses with confidence',
  trustParagraph: 'We organize publicly available referral and promotional offers so you can compare signup bonuses, no-deposit rewards, cashback offers, requirements, timing, and fine print before visiting the official merchant. We do not hold your money, complete applications for you, or guarantee payment.',
  trustSubtext: 'Signups4FastCash.com is an independent comparison site, not a bank, lender, broker, merchant, or government service. Some links may earn us a referral commission at no extra cost to you. Offer terms, payout timing, and eligibility can change. Please review the current official terms before signing up.',
  metaTitle: 'Best Signup Bonuses & No-Deposit Offers | Signups4FastCash.com',
  metaDescription: 'Compare signup bonuses, no-deposit offers, cashback rewards, and referral incentives with the actual requirements, payout timing, and fine print before you click through.',
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
