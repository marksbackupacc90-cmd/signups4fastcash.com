export type OfferCategory = 'fintech' | 'brokerage' | 'cashback' | 'apps' | 'crypto' | 'surveys';

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
  verificationStatus?: 'unverified' | 'reviewed';
  
  // "Logo for each company its for displayed next to the offer title"
  logoSvgKey?: string;
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
