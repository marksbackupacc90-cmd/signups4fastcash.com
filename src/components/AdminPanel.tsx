import React, { useEffect, useState } from 'react';
import { 
  Bot, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Send, 
  Bell, 
  PlusCircle, 
  Trash2, 
  Sparkles, 
  Link as LinkIcon, 
  Code, 
  ShieldCheck, 
  FileText,
  AlertCircle,
  ExternalLink,
  Lock,
  Copy,
  Check,
  Search,
  Save,
  ArrowUpRight,
  MessageCircle,
  User,
  ChevronDown
} from 'lucide-react';
import { Offer, NewsletterSubscriber, EmailBlastLog, SpeedrunStep, SiteSettings, DEFAULT_SITE_SETTINGS } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface AdminPanelProps {
  pendingOffers: Offer[];
  liveOffers: Offer[];
  subscribers: NewsletterSubscriber[];
  onApproveOffer: (
    offerId: string, 
    referralCode: string, 
    referralUrl: string, 
    blastEmail: boolean,
    updatedOffer?: Partial<Offer>
  ) => void;
  onRejectOffer: (offerId: string) => void;
  onUpdateLiveOffer: (offerId: string, updates: Partial<Offer>) => void;
  onDeleteLiveOffer: (offerId: string) => void;
  onCreateCustomOffer: (newOffer: Omit<Offer, 'id' | 'clicksCount' | 'conversionsCount' | 'createdAt' | 'updatedAt'>) => void;
  blastLogs: EmailBlastLog[];
  onLockAdmin?: () => void;
  siteSettings: SiteSettings;
  onUpdateSiteSettings: (updates: Partial<SiteSettings>) => void;
  isOwnerAdmin?: boolean;
  adminUsernames?: string[];
  onUpdateAdminUsernames?: (usernames: string[]) => void;
}

interface OutreachResult {
  summary: string;
  safetyNotes: string[];
  searchQueries: string[];
  workflow: { step: number; action: string; reason: string }[];
  draftPost: string;
  disclosure: string;
}

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VisitorAnalytics {
  totalPageViews: number;
  uniqueVisitors: number;
  sources: { source: string; pageViews: number }[];
}

interface AdminAccount {
  id: string;
  email: string;
  username: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  status: 'active' | 'blocked';
  activeSessions: number;
}

interface ProviderAccountLink {
  id: string;
  label: string;
  url: string;
}

export interface UserReferralPreset {
  company: string;
  code: string;
  url: string;
  bonus: string;
  matchKeys: string[];
}

export const USER_REFERRAL_PRESETS: UserReferralPreset[] = [
  {
    company: 'Stake.us',
    code: 'fastcash',
    url: 'https://stake.us/?c=fastcash',
    bonus: '$25 Free Cash + 250k Coins',
    matchKeys: ['stake', 'stake.us'],
  },
  {
    company: 'AceBet',
    code: 'casino',
    url: 'https://acebet.cc/welcome/r/casino',
    bonus: '100% Match Bonus',
    matchKeys: ['acebet'],
  },
  {
    company: 'Freecash',
    code: 'wintercash',
    url: 'https://freecash.com/r/wintercash',
    bonus: '$5 - $250 Chest + Instant Cashout',
    matchKeys: ['freecash'],
  },
  {
    company: 'Chime',
    code: 'markwinters39',
    url: 'https://www.chime.com/r/markwinters39/',
    bonus: '$100 Direct Deposit Match',
    matchKeys: ['chime'],
  },
  {
    company: 'SoFi Checking',
    code: '',
    url: 'https://www.sofi.com/invite/money?gcp=a8ea63bc-051c-47d9-ad8b-7ca79033c0cf&isAliasGcp=false&siid=7e2e4d1d-73bd-4626-aab3-483b313a07e9',
    bonus: '$25 - $300 Instant Cash',
    matchKeys: ['sofi'],
  },
  {
    company: 'Capital One Shopping',
    code: '090a1fc7',
    url: 'https://capitaloneshopping.com/r/090a1fc7-f110-485e-a500-d6e27f6155a8',
    bonus: '$30 - $100 Shopping Rebates',
    matchKeys: ['capital one', 'capitalone'],
  },
  {
    company: 'TopCashback',
    code: 'member945942648933',
    url: 'https://www.topcashback.com/ref/member945942648933',
    bonus: '$10 Sign-up Bonus',
    matchKeys: ['topcashback', 'top cash back'],
  },
  {
    company: 'Rakuten',
    code: 'WINTER7693',
    url: 'https://www.rakuten.com/r/WINTER7693?eeid=28187',
    bonus: '$30 Welcome Bonus',
    matchKeys: ['rakuten'],
  },
  {
    company: 'Robinhood',
    code: 'hood-e0e21fe56',
    url: 'https://join.robinhood.com/hood-e0e21fe56',
    bonus: '1 Free Stock',
    matchKeys: ['robinhood'],
  },
  {
    company: 'Revolut',
    code: 'mwinters90!SEP1-26-AR-US-H1-REFBLOCK',
    url: 'https://revolut.com/referral/?referral-code=mwinters90!SEP1-26-AR-US-H1-REFBLOCK&geo-redirect',
    bonus: '$30 Cash Incentive',
    matchKeys: ['revolut'],
  },
  {
    company: 'Coinbase',
    code: 'MW4MCPR',
    url: 'https://coinbase.com/join/MW4MCPR?src=android-share',
    bonus: '$10-$25 Welcome Bonus',
    matchKeys: ['coinbase'],
  },
  {
    company: 'Kraken',
    code: 'JDNW/3irvk83z',
    url: 'https://invite.kraken.com/JDNW/3irvk83z',
    bonus: '$10 - $50 Crypto Bonus',
    matchKeys: ['kraken'],
  },
  {
    company: 'HeyCash',
    code: '9ce98bb4-4738-450d-9bb2-cbea7ebe2b05',
    url: 'https://heycash.com/register?ref=9ce98bb4-4738-450d-9bb2-cbea7ebe2b05',
    bonus: 'Cash rewards signup bonus',
    matchKeys: ['heycash'],
  },
  {
    company: 'PayPal',
    code: 'rLg9J',
    url: 'https://py.pl/rLg9J',
    bonus: '$10 Referral Reward',
    matchKeys: ['paypal'],
  },
  {
    company: 'Joko',
    code: 'mutnkj',
    url: 'https://hellojoko.app.link/mLKOoJKs6Xb',
    bonus: '$5 reward',
    matchKeys: ['joko', 'hellojoko'],
  },
  {
    company: 'Upside',
    code: 'MARK533822',
    url: 'https://upside.app.link/MARK533822',
    bonus: '15¢/gal + 10% extra cashback',
    matchKeys: ['upside'],
  },
  {
    company: 'Kalshi',
    code: '75f5cdb1-f534-4db6-8ec3-ba0ca0003a23',
    url: 'https://kalshi.com/sign-up/?referral=75f5cdb1-f534-4db6-8ec3-ba0ca0003a23&m=true&utm_source=mobile_app&utm_medium=copy&utm_campaign=referral&utm_content=referral_qr_sheet&utm_term=referrals_pill',
    bonus: 'Referral signup bonus',
    matchKeys: ['kalshi'],
  },
  {
    company: 'Verb',
    code: 'G284G5GH',
    url: 'https://verb-data.com/signup?ref=G284G5GH',
    bonus: 'Signup bonus',
    matchKeys: ['verb', 'verb-data'],
  },
  {
    company: 'Shuffle',
    code: 'Dz1S2aFLk9',
    url: 'https://shuffle.us?r=Dz1S2aFLk9',
    bonus: 'Referral bonus',
    matchKeys: ['shuffle', 'shuffle.us'],
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  pendingOffers,
  liveOffers,
  subscribers,
  onApproveOffer,
  onRejectOffer,
  onUpdateLiveOffer,
  onDeleteLiveOffer,
  onCreateCustomOffer,
  blastLogs,
  onLockAdmin,
  siteSettings,
  onUpdateSiteSettings,
  isOwnerAdmin = false,
  adminUsernames = [],
  onUpdateAdminUsernames,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'pending' | 'live' | 'create' | 'blasts' | 'assistant' | 'copilot' | 'settings' | 'accounts'>('live');
  const [outreachTask, setOutreachTask] = useState('');
  const [outreachContext, setOutreachContext] = useState('');
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    { role: 'assistant', content: 'I am your S4FC Copilot. Ask me about offers, site copy, admin tools, analytics, troubleshooting, or what to do next.' },
  ]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [visitorAnalytics, setVisitorAnalytics] = useState<VisitorAnalytics | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountActionLoading, setAccountActionLoading] = useState<string | null>(null);
  const [resettingAnalytics, setResettingAnalytics] = useState(false);
  const [analyticsResetMessage, setAnalyticsResetMessage] = useState<string | null>(null);

  // Live Offers inline draft referral inputs and filters
  const [draftCodes, setDraftCodes] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [draftLogoUrls, setDraftLogoUrls] = useState<Record<string, string>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [liveSearchFilter, setLiveSearchFilter] = useState<string>('');
  const [expandedLiveOfferId, setExpandedLiveOfferId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(siteSettings || DEFAULT_SITE_SETTINGS);
  const [adminUsernamesDraft, setAdminUsernamesDraft] = useState(adminUsernames.join(', '));
  const [providerAccountLinks, setProviderAccountLinks] = useState<ProviderAccountLink[]>([]);
  const [providerLinkLabel, setProviderLinkLabel] = useState('');
  const [providerLinkUrl, setProviderLinkUrl] = useState('');
  const [providerLinkMessage, setProviderLinkMessage] = useState<string | null>(null);

  // For pending approval review state
  const [selectedPendingId, setSelectedPendingId] = useState<string>(
    pendingOffers[0]?.id || ''
  );
  const [referralCodeInput, setReferralCodeInput] = useState<string>('');
  const [referralUrlInput, setReferralUrlInput] = useState<string>('');
  const [blastEmailCheckbox, setBlastEmailCheckbox] = useState<boolean>(true);

  // Manual create offer form state
  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'fintech' | 'brokerage' | 'cashback' | 'apps' | 'crypto'>('fintech');
  const [newIncentive, setNewIncentive] = useState('$50 Cash Bonus');
  const [newIncentiveVal, setNewIncentiveVal] = useState(50);
  const [newPayoutSpeed, setNewPayoutSpeed] = useState('Instant');
  const [newDifficulty, setNewDifficulty] = useState<'Easy (2 min)' | 'Fast (5 min)' | 'Standard (10 min)'>('Easy (2 min)');
  const [newDeposit, setNewDeposit] = useState('$1 deposit');
  const [newRefCode, setNewRefCode] = useState('Dz1S2aFLk9');
  const [newRefUrl, setNewRefUrl] = useState('https://shuffle.us?r=Dz1S2aFLk9');
  const [newHonestSummary, setNewHonestSummary] = useState('');
  const [newHonestCatch, setNewHonestCatch] = useState('');
  const [newMinHold, setNewMinHold] = useState('None');
  const [newSpeedrunSteps, setNewSpeedrunSteps] = useState<SpeedrunStep[]>([
    { step: 1, instruction: 'Click through verified link and register.', proTip: 'Match your legal name on ID.' },
    { step: 2, instruction: 'Fund minimum $1 using debit or checking.', proTip: 'Instant deposit unlocks bonus.' },
    { step: 3, instruction: 'Bonus posts to account. Withdraw back to bank.', proTip: 'Zero withdrawal fees.' },
  ]);
  const [offerBotInput, setOfferBotInput] = useState('');
  const [offerBotMessage, setOfferBotMessage] = useState<string | null>(null);
  const [offerBotVerifying, setOfferBotVerifying] = useState(false);

  const selectedPendingOffer = pendingOffers.find((o) => o.id === selectedPendingId);

  useEffect(() => {
    setSettingsDraft(siteSettings || DEFAULT_SITE_SETTINGS);
  }, [siteSettings]);

  useEffect(() => {
    setAdminUsernamesDraft(adminUsernames.join(', '));
  }, [adminUsernames]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('s4fc_provider_account_links') || '[]') as ProviderAccountLink[];
      if (Array.isArray(saved)) setProviderAccountLinks(saved.filter((link) => link && typeof link.label === 'string' && typeof link.url === 'string'));
    } catch {
      setProviderAccountLinks([]);
    }
  }, []);

  const saveProviderAccountLinks = (links: ProviderAccountLink[]) => {
    setProviderAccountLinks(links);
    localStorage.setItem('s4fc_provider_account_links', JSON.stringify(links));
  };

  const handleAddProviderAccountLink = () => {
    const label = providerLinkLabel.trim();
    const url = providerLinkUrl.trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setProviderLinkMessage('Enter a valid http or https account link.');
      return;
    }
    if (!label) return;
    saveProviderAccountLinks([...providerAccountLinks, { id: crypto.randomUUID(), label, url }]);
    setProviderLinkLabel('');
    setProviderLinkUrl('');
    setProviderLinkMessage(null);
  };

  useEffect(() => {
    if (activeAdminTab !== 'accounts' || !isOwnerAdmin) return;
    setAccountsLoading(true);
    setAccountsError(null);
    const token = localStorage.getItem('signups4fastcash_admin_token');
    fetch('/api/admin/accounts', { headers: token ? { 'x-admin-token': token } : {} })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as { accounts?: AdminAccount[]; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || 'Could not load accounts.');
        setAccounts(data?.accounts || []);
      })
      .catch((error) => setAccountsError(error instanceof Error ? error.message : 'Could not load accounts.'))
      .finally(() => setAccountsLoading(false));
  }, [activeAdminTab, isOwnerAdmin]);

  const runAccountAction = async (account: AdminAccount, action: 'toggle' | 'delete') => {
    const token = localStorage.getItem('signups4fastcash_admin_token');
    const nextStatus = account.status === 'blocked' ? 'active' : 'blocked';
    if (action === 'delete' && !window.confirm(`Permanently delete ${account.email}? This cannot be undone.`)) return;
    if (action === 'toggle' && !window.confirm(`${nextStatus === 'blocked' ? 'Block' : 'Unblock'} ${account.email}?`)) return;
    setAccountActionLoading(account.id);
    try {
      const response = await fetch(action === 'delete' ? `/api/admin/accounts/${account.id}` : `/api/admin/accounts/${account.id}/status`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        ...(action === 'toggle' ? { body: JSON.stringify({ status: nextStatus }) } : {}),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || 'Account action failed.');
      if (action === 'delete') setAccounts((current) => current.filter((entry) => entry.id !== account.id));
      else setAccounts((current) => current.map((entry) => entry.id === account.id ? { ...entry, status: nextStatus, activeSessions: nextStatus === 'blocked' ? 0 : entry.activeSessions } : entry));
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : 'Account action failed.');
    } finally {
      setAccountActionLoading(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('signups4fastcash_admin_token');
    fetch('/api/admin/analytics/visitors', {
      headers: token ? { 'x-admin-token': token } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load visitor analytics.');
        return response.json() as Promise<VisitorAnalytics>;
      })
      .then(setVisitorAnalytics)
      .catch((error) => console.error(error));
  }, []);

  const handleOutreachAssistant = async () => {
    if (!outreachTask.trim()) {
      setOutreachError('Describe the outreach task first.');
      return;
    }
    setOutreachLoading(true);
    setOutreachError(null);
    setOutreachResult(null);
    const token = localStorage.getItem('signups4fastcash_admin_token');
    try {
      const response = await fetch('/api/admin/outreach-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        body: JSON.stringify({ task: outreachTask, context: outreachContext }),
      });
      const data = await response.json().catch(() => null) as { result?: OutreachResult; error?: string } | null;
      if (!response.ok || !data?.result) {
        throw new Error(data?.error || 'The outreach assistant could not complete this task.');
      }
      setOutreachResult(data.result);
    } catch (error) {
      setOutreachError(error instanceof Error ? error.message : 'The outreach assistant could not complete this task.');
    } finally {
      setOutreachLoading(false);
    }
  };

  const handleCopilotSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const message = copilotInput.trim();
    if (!message || copilotLoading) return;
    setCopilotInput('');
    setCopilotError(null);
    setCopilotMessages((previous) => [...previous, { role: 'user', content: message }]);
    setCopilotLoading(true);
    const context = JSON.stringify({
      adminRole: isOwnerAdmin ? 'owner' : 'delegated',
      liveOffers: liveOffers.map((offer) => ({ company: offer.company, title: offer.title, category: offer.category, incentive: offer.incentiveAmount, deposit: offer.depositRequired, payout: offer.payoutSpeed })),
      pendingOfferCount: pendingOffers.length,
      subscriberCount: subscribers.length,
      siteSettings,
    });
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token');
      const response = await fetch('/api/admin/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        body: JSON.stringify({ message, context }),
      });
      const data = await response.json().catch(() => null) as { answer?: string; error?: string } | null;
      if (!response.ok || !data?.answer) throw new Error(data?.error || 'Copilot could not answer that question.');
      setCopilotMessages((previous) => [...previous, { role: 'assistant', content: data.answer as string }]);
    } catch (error) {
      setCopilotMessages((previous) => [...previous, { role: 'assistant', content: 'I could not complete that request.' }]);
      setCopilotError(error instanceof Error ? error.message : 'Copilot could not answer that question.');
    } finally {
      setCopilotLoading(false);
    }
  };

  // Sync default values when changing pending selection
  const handleSelectPending = (offer: Offer) => {
    setSelectedPendingId(offer.id);
    setReferralCodeInput(offer.referralCode === 'PENDING_ADMIN_CODE' ? '' : (offer.referralCode || ''));
    setReferralUrlInput(offer.referralUrl.includes('PENDING_ADMIN_CODE') ? '' : offer.referralUrl);
  };

  const handleApprove = () => {
    if (!selectedPendingOffer) return;
    onApproveOffer(
      selectedPendingOffer.id,
      referralCodeInput.trim() || 'CLAIM-NOW',
      referralUrlInput.trim() || selectedPendingOffer.officialMerchantUrl,
      blastEmailCheckbox
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newTitle) return;

    onCreateCustomOffer({
      company: newCompany,
      companySlug: newCompany.toLowerCase().replace(/[^a-z0-9]/g, ''),
      title: newTitle,
      category: newCategory,
      incentiveAmount: newIncentive,
      incentiveValue: newIncentiveVal,
      payoutSpeed: newPayoutSpeed,
      difficulty: newDifficulty,
      depositRequired: newDeposit,
      availability: 'Verify current country and state eligibility',
      officialMerchantUrl: newRefUrl || 'https://google.com',
      referralCode: newRefCode,
      referralUrl: newRefUrl,
      status: 'live',
      honestTruth: {
        summary: newHonestSummary || 'Review the current promotion details and eligibility requirements before applying.',
        theCatch: newHonestCatch || 'Eligibility, funding requirements, and payout timing are controlled by the provider and may change.',
        minimumHoldTime: newMinHold,
        idVerificationRequired: true,
        hiddenFeesWarning: 'Review the provider terms for account fees, transfer limits, and other conditions.',
        trustScore: 90,
      },
      speedrunHints: newSpeedrunSteps,
    });

    // Reset
    setNewCompany('');
    setNewTitle('');
    setActiveAdminTab('live');
  };

  const handleOfferBot = () => {
    const input = offerBotInput.trim();
    if (!input) {
      setOfferBotMessage('Paste the offer details first.');
      return;
    }
    const read = (labels: string[]) => {
      const pattern = labels.join('|');
      const match = input.match(new RegExp(`(?:^|\\n)\\s*(?:${pattern})\\s*[:\\-]\\s*(.+)`, 'i'));
      return match?.[1]?.trim() || '';
    };

    const company = read(['company', 'merchant', 'brand']);
    const title = read(['title', 'headline', 'offer']);
    const incentive = read(['incentive', 'bonus', 'reward', 'payout']);
    const category = read(['category', 'type']).toLowerCase();
    const deposit = read(['deposit', 'requirement', 'spend requirement']);
    const payoutSpeed = read(['payout speed', 'payout timing', 'when paid']);
    const referralCode = read(['referral code', 'promo code', 'code']);
    const referralUrl = read(['referral url', 'referral link', 'official url', 'link', 'url']);
    const catchText = read(['catch', 'fine print', 'requirements', 'terms']);
    const steps = input
      .split('\n')
      .map((line) => line.match(/^\s*(?:\d+[.)]|[-*])\s+(.+)$/)?.[1]?.trim())
      .filter((step): step is string => Boolean(step))
      .slice(0, 6)
      .map((instruction, index) => ({ step: index + 1, instruction }));

    if (company) setNewCompany(company);
    if (title) setNewTitle(title);
    if (incentive) setNewIncentive(incentive);
    if (category && ['fintech', 'brokerage', 'cashback', 'apps', 'crypto'].includes(category)) {
      setNewCategory(category as typeof newCategory);
    }
    if (deposit) setNewDeposit(deposit);
    if (payoutSpeed) setNewPayoutSpeed(payoutSpeed);
    if (referralCode) setNewRefCode(referralCode);
    if (referralUrl) {
      setNewRefUrl(referralUrl);
    }
    if (catchText) {
      setNewHonestCatch(catchText);
      setNewHonestSummary(catchText);
    }
    if (steps.length > 0) setNewSpeedrunSteps(steps);
    const parsedCount = [company, title, incentive, category, deposit, payoutSpeed, referralCode, referralUrl, catchText].filter(Boolean).length + steps.length;
    setOfferBotMessage(parsedCount > 0 ? `Draft filled from ${parsedCount} detail${parsedCount === 1 ? '' : 's'}. Review it below before publishing.` : 'No recognizable fields found. Use labels such as Company, Title, Bonus, Link, and Requirements.');
  };

  const handleVerifyOfferBot = async () => {
    if (!offerBotInput.trim() || offerBotVerifying) return;
    setOfferBotVerifying(true);
    setOfferBotMessage('Checking the public offer page and confirming the terms...');
    try {
      const token = localStorage.getItem('signups4fastcash_admin_token');
      const response = await fetch('/api/admin/verify-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        body: JSON.stringify({ pasted: offerBotInput }),
      });
      const data = await response.json().catch(() => null) as { result?: { confirmed: boolean; confidence: number; summary: string; warnings: string[]; edits?: Record<string, unknown> }; error?: string } | null;
      if (!response.ok || !data?.result) throw new Error(data?.error || 'The offer could not be verified.');
      const edits = data.result.edits || {};
      if (typeof edits.company === 'string' && edits.company) setNewCompany(edits.company);
      if (typeof edits.title === 'string' && edits.title) setNewTitle(edits.title);
      if (typeof edits.incentive === 'string' && edits.incentive) setNewIncentive(edits.incentive);
      if (typeof edits.payoutSpeed === 'string' && edits.payoutSpeed) setNewPayoutSpeed(edits.payoutSpeed);
      if (typeof edits.deposit === 'string' && edits.deposit) setNewDeposit(edits.deposit);
      if (typeof edits.referralCode === 'string' && edits.referralCode) setNewRefCode(edits.referralCode);
      if (typeof edits.referralUrl === 'string' && edits.referralUrl) setNewRefUrl(edits.referralUrl);
      if (typeof edits.catchText === 'string' && edits.catchText) {
        setNewHonestCatch(edits.catchText);
        setNewHonestSummary(edits.catchText);
      }
      if (Array.isArray(edits.steps) && edits.steps.length) {
        setNewSpeedrunSteps(edits.steps.filter((step): step is string => typeof step === 'string').map((instruction, index) => ({ step: index + 1, instruction })));
      }
      const warnings = data.result.warnings?.length ? ` Warnings: ${data.result.warnings.join(' ')}` : '';
      setOfferBotMessage(`${data.result.confirmed ? 'Offer confirmed' : 'Offer not fully confirmed'} (${Math.round(data.result.confidence * 100)}% confidence). ${data.result.summary}${warnings}`);
    } catch (error) {
      setOfferBotMessage(error instanceof Error ? error.message : 'The offer could not be verified.');
    } finally {
      setOfferBotVerifying(false);
    }
  };

  const handleDraftCodeChange = (offerId: string, val: string) => {
    setDraftCodes((prev) => ({ ...prev, [offerId]: val }));
  };

  const handleDraftUrlChange = (offerId: string, val: string) => {
    setDraftUrls((prev) => ({ ...prev, [offerId]: val }));
  };

  const handleDraftLogoUrlChange = (offerId: string, val: string) => {
    setDraftLogoUrls((prev) => ({ ...prev, [offerId]: val }));
  };

  const handleSaveOfferReferral = (offer: Offer) => {
    const newCode = draftCodes[offer.id] !== undefined ? draftCodes[offer.id] : (offer.referralCode || '');
    const newUrl = draftUrls[offer.id] !== undefined ? draftUrls[offer.id] : (offer.referralUrl || '');
    const newLogoUrl = draftLogoUrls[offer.id] !== undefined ? draftLogoUrls[offer.id] : (offer.logoUrl || '');
    onUpdateLiveOffer(offer.id, {
      referralCode: newCode.trim(),
      referralUrl: newUrl.trim(),
      logoUrl: newLogoUrl.trim() || undefined,
    });
    setSavedSuccessIds((prev) => ({ ...prev, [offer.id]: true }));
    setTimeout(() => {
      setSavedSuccessIds((prev) => ({ ...prev, [offer.id]: false }));
    }, 2500);
  };

  const handleApplyPresetToOffer = (offerId: string, preset: UserReferralPreset) => {
    setDraftCodes((prev) => ({ ...prev, [offerId]: preset.code }));
    setDraftUrls((prev) => ({ ...prev, [offerId]: preset.url }));
    onUpdateLiveOffer(offerId, {
      referralCode: preset.code,
      referralUrl: preset.url,
    });
    setSavedSuccessIds((prev) => ({ ...prev, [offerId]: true }));
    setTimeout(() => {
      setSavedSuccessIds((prev) => ({ ...prev, [offerId]: false }));
    }, 2500);
  };

  const handleVerificationUpdate = (offer: Offer, status: Offer['verificationStatus']) => {
    onUpdateLiveOffer(offer.id, {
      verificationStatus: status,
      verifiedAt: status === 'reviewed' ? new Date().toISOString() : offer.verifiedAt,
    });
    setSavedSuccessIds((prev) => ({ ...prev, [offer.id]: true }));
  };

  const handleCopyCode = (code: string, id: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const filteredLiveOffers = liveOffers.filter((o) => {
    if (!liveSearchFilter) return true;
    const q = liveSearchFilter.toLowerCase();
    return (
      o.company.toLowerCase().includes(q) ||
      o.title.toLowerCase().includes(q) ||
      (o.referralCode && o.referralCode.toLowerCase().includes(q)) ||
      (o.referralUrl && o.referralUrl.toLowerCase().includes(q)) ||
      o.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {visitorAnalytics && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-200">Unique visitors</div>
            <div className="mt-2 text-2xl font-mono font-bold text-white">{visitorAnalytics.uniqueVisitors.toLocaleString()}</div>
            <div className="mt-1 text-[11px] text-zinc-500">Privacy-preserving browser IDs</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Page views</div>
            <div className="mt-2 text-2xl font-mono font-bold text-white">{visitorAnalytics.totalPageViews.toLocaleString()}</div>
            <div className="mt-1 text-[11px] text-zinc-500">Recorded site visits</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Top source</div>
            <div className="mt-2 truncate text-lg font-mono font-bold text-white">{visitorAnalytics.sources[0]?.source || 'No data yet'}</div>
            <div className="mt-1 text-[11px] text-zinc-500">{visitorAnalytics.sources[0]?.pageViews || 0} page views</div>
          </div>
          {isOwnerAdmin && (
            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#9b7650]/35 bg-[#10131d] p-4">
              <div>
                <div className="text-xs font-semibold text-[#8ad7f5]">Analytics controls</div>
                <p className="mt-1 text-[11px] text-zinc-500">Reset visits, clicks, conversions, and offer counters to zero.</p>
              </div>
              <button
                type="button"
                disabled={resettingAnalytics}
                onClick={async () => {
                  if (!window.confirm('Reset all visits, clicks, conversions, and offer counters to zero? This cannot be undone.')) return;
                  setResettingAnalytics(true);
                  setAnalyticsResetMessage(null);
                  try {
                    const token = localStorage.getItem('signups4fastcash_admin_token');
                    const response = await fetch('/api/admin/analytics/reset', {
                      method: 'POST',
                      headers: token ? { 'x-admin-token': token } : {},
                    });
                    const data = await response.json().catch(() => null) as { error?: string } | null;
                    if (!response.ok) throw new Error(data?.error || 'Could not reset analytics.');
                    setAnalyticsResetMessage('All counters were reset to zero.');
                    window.setTimeout(() => window.location.reload(), 700);
                  } catch (error) {
                    setAnalyticsResetMessage(error instanceof Error ? error.message : 'Could not reset analytics.');
                  } finally {
                    setResettingAnalytics(false);
                  }
                }}
                className="rounded-lg border border-[#2dd4ee]/60 bg-[#2dd4ee] px-3 py-2 text-xs font-bold text-[#06131a] hover:bg-[#67e8f9] disabled:cursor-wait disabled:opacity-60"
              >
                {resettingAnalytics ? 'Resetting...' : 'Reset analytics'}
              </button>
              {analyticsResetMessage && <span className="text-xs text-[#8ad7f5]">{analyticsResetMessage}</span>}
            </div>
          )}
        </div>
      )}
      
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#0f1420] border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              Admin Control Center
            </h2>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono">
              Owner Mode
            </span>
            {onLockAdmin && (
              <button
                id="btn-lock-admin"
                onClick={onLockAdmin}
                title="Lock and hide Admin Panel until secret code is entered in search"
                className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Lock & Hide</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage live offers, review pending submissions, and keep referral details and terms accurate.
          </p>
        </div>

        {/* Compact admin section menu */}
        <label className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#07090e] p-1 font-mono text-xs text-zinc-400">
          <span className="sr-only">Admin section</span>
          <select
            value={activeAdminTab}
            onChange={(event) => setActiveAdminTab(event.target.value as typeof activeAdminTab)}
            className="max-w-[15rem] rounded-md bg-[#07090e] px-3 py-2 text-xs font-semibold text-zinc-200 outline-none"
          >
            <option value="live">Referral Links & Offers ({liveOffers.length})</option>
            <option value="pending">Review Queue{pendingOffers.length > 0 ? ` (${pendingOffers.length})` : ''}</option>
            <option value="create">Create Offer</option>
            <option value="blasts">Email History ({blastLogs.length})</option>
            <option value="settings">Site Settings</option>
            {isOwnerAdmin && <option value="accounts">Accounts</option>}
          </select>
        </label>
      </div>

      {activeAdminTab === 'accounts' && isOwnerAdmin && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-200">Registered accounts</div>
              <h3 className="mt-1 text-lg font-bold text-white">Signed-up users ({accounts.length})</h3>
            </div>
            {accountsLoading && <span className="text-xs text-zinc-400">Loading...</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Search email or username"
              className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <span className="text-xs text-zinc-500">Blocked accounts cannot sign in or use active sessions.</span>
          </div>
          {accountsError && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{accountsError}</p>}
          {!accountsLoading && !accountsError && accounts.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No accounts have signed up yet.</p>
          )}
          {accounts.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="border-b border-white/[0.08] text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Username</th>
                    <th className="px-3 py-2 font-medium">Signed up</th>
                    <th className="px-3 py-2 font-medium">Most recent login</th>
                    <th className="px-3 py-2 font-medium">Status / sessions</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.filter((account) => `${account.email} ${account.username || ''}`.toLowerCase().includes(accountSearch.toLowerCase().trim())).map((account) => (
                    <tr key={account.id} className="border-b border-white/[0.05] text-zinc-200">
                      <td className="px-3 py-3">{account.email}</td>
                      <td className="px-3 py-3">{account.username ? `@${account.username}` : 'Not chosen'}</td>
                      <td className="px-3 py-3 text-zinc-400">{account.createdAt ? new Date(account.createdAt).toLocaleString() : 'Current session data'}</td>
                      <td className="px-3 py-3 text-zinc-400">{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td className="px-3 py-3">
                        <span className={account.status === 'blocked' ? 'text-red-300' : 'text-emerald-300'}>{account.status}</span>
                        <span className="ml-2 text-zinc-500">{account.activeSessions} session{account.activeSessions === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button type="button" disabled={accountActionLoading === account.id} onClick={() => runAccountAction(account, 'toggle')} className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-200 hover:border-cyan-400 disabled:opacity-50">
                            {account.status === 'blocked' ? 'Unblock' : 'Block'}
                          </button>
                          <button type="button" disabled={accountActionLoading === account.id} onClick={() => runAccountAction(account, 'delete')} className="rounded border border-red-400/30 px-2 py-1 text-[11px] text-red-300 hover:bg-red-400/10 disabled:opacity-50">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'settings' && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-200">Branding & homepage</div>
              <h3 className="text-lg font-bold text-white mt-1">Edit your live site content</h3>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSiteSettings(settingsDraft)}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-400"
            >
              Save changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-xs text-zinc-400">
              Site name
              <input value={settingsDraft.siteName} onChange={(e) => setSettingsDraft({ ...settingsDraft, siteName: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400">
              Site tagline
              <input value={settingsDraft.siteTagline} onChange={(e) => setSettingsDraft({ ...settingsDraft, siteTagline: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Hero badge
              <input value={settingsDraft.heroBadge} onChange={(e) => setSettingsDraft({ ...settingsDraft, heroBadge: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Main headline
              <input value={settingsDraft.mainHeadline} onChange={(e) => setSettingsDraft({ ...settingsDraft, mainHeadline: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Sub-headline
              <textarea value={settingsDraft.subHeadline} onChange={(e) => setSettingsDraft({ ...settingsDraft, subHeadline: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400">
              Brand name
              <input value={settingsDraft.brandName} onChange={(e) => setSettingsDraft({ ...settingsDraft, brandName: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400">
              Brand badge
              <input value={settingsDraft.brandBadge} onChange={(e) => setSettingsDraft({ ...settingsDraft, brandBadge: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Footer blurb
              <textarea value={settingsDraft.footerBlurb} onChange={(e) => setSettingsDraft({ ...settingsDraft, footerBlurb: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400">
              Support email
              <input value={settingsDraft.supportEmail} onChange={(e) => setSettingsDraft({ ...settingsDraft, supportEmail: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-1">
              Footer disclaimer
              <textarea value={settingsDraft.footerDisclaimer} onChange={(e) => setSettingsDraft({ ...settingsDraft, footerDisclaimer: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Trust heading
              <input value={settingsDraft.trustHeading} onChange={(e) => setSettingsDraft({ ...settingsDraft, trustHeading: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Trust paragraph
              <textarea value={settingsDraft.trustParagraph} onChange={(e) => setSettingsDraft({ ...settingsDraft, trustParagraph: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Trust subtext
              <textarea value={settingsDraft.trustSubtext} onChange={(e) => setSettingsDraft({ ...settingsDraft, trustSubtext: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              SEO title
              <input value={settingsDraft.metaTitle} onChange={(e) => setSettingsDraft({ ...settingsDraft, metaTitle: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <label className="text-xs text-zinc-400 md:col-span-2">
              Meta description
              <textarea value={settingsDraft.metaDescription} onChange={(e) => setSettingsDraft({ ...settingsDraft, metaDescription: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white" />
            </label>

            <div className="md:col-span-2 border-t border-white/[0.08] pt-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-200">Site colors</div>
              <p className="mt-1 text-xs text-zinc-500">Choose the main background, accent, and panel colors used across the public site.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {([
                  ['themeBackgroundColor', 'Background color'],
                  ['themeAccentColor', 'Accent color'],
                  ['themePanelColor', 'Panel color'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#090d18] p-3 text-xs text-zinc-300">
                    <input
                      type="color"
                      value={settingsDraft[key]}
                      onChange={(event) => setSettingsDraft({ ...settingsDraft, [key]: event.target.value })}
                      className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label={label}
                    />
                    <span>
                      <span className="block font-semibold text-white">{label}</span>
                      <span className="font-mono text-[11px] text-zinc-500">{settingsDraft[key]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {isOwnerAdmin && onUpdateAdminUsernames && (
            <div className="border-t border-white/[0.08] pt-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-200">Delegated admin access</div>
              <p className="mt-1 text-xs text-zinc-400">Enter usernames separated by commas. These users must sign in with Google before the Admin button will work.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={adminUsernamesDraft}
                  onChange={(event) => setAdminUsernamesDraft(event.target.value)}
                  placeholder="ModMark, another_username"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090d18] px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => onUpdateAdminUsernames(adminUsernamesDraft.split(',').map((username) => username.trim()).filter(Boolean))}
                  className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/20"
                >
                  Save admin access
                </button>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">Current access: {adminUsernames.length ? adminUsernames.join(', ') : 'none'}</div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Pending offer review */}
      {activeAdminTab === 'pending' && (
        <div className="space-y-4">
          {pendingOffers.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#0b0e14] border border-white/[0.08]">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Review queue is clear</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                No offers are waiting for approval. New submissions can be reviewed here before they appear on the live site.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: List of pending findings */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Discovered by CashBot ({pendingOffers.length} awaiting review)
                </div>
                {pendingOffers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => handleSelectPending(offer)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedPendingId === offer.id
                        ? 'bg-[#141a26] border-amber-500/50 shadow-md'
                        : 'bg-[#0e121a] border-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CompanyLogo companyName={offer.company} slug={offer.companySlug} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono text-zinc-400 truncate">{offer.company}</div>
                        <div className="text-sm font-bold text-white truncate">{offer.title}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold shrink-0">
                        {offer.incentiveAmount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Column: Review, attach referral code, approve with blast */}
              {selectedPendingOffer && (
                <div className="lg:col-span-2 p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-5">
                  <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div className="flex items-center gap-3">
                      <CompanyLogo companyName={selectedPendingOffer.company} slug={selectedPendingOffer.companySlug} size="md" />
                      <div>
                        <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          Pending offer review
                        </div>
                        <h3 className="text-lg font-bold text-white mt-0.5">
                          {selectedPendingOffer.title}
                        </h3>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-sm">
                      {selectedPendingOffer.incentiveAmount}
                    </span>
                  </div>

                  {/* Form to insert owner referral code and URL */}
                  <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-amber-400" />
                        Attach Your Referral Code & Outbound Link
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Quick Preset:</span>
                        {USER_REFERRAL_PRESETS.map((p) => (
                          <button
                            key={p.company}
                            type="button"
                            onClick={() => {
                              setReferralCodeInput(p.code);
                              setReferralUrlInput(p.url);
                            }}
                            className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/10 text-[10px] font-mono text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                          >
                            {p.company} ({p.code})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-zinc-300 font-semibold mb-1">
                          YOUR AFFILIATE / REFERRAL CODE:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. YOURCODE2026 or fastcash"
                          value={referralCodeInput}
                          onChange={(e) => setReferralCodeInput(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400 font-semibold text-emerald-400"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                          Displayed for users to copy during registration.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-zinc-300 font-semibold mb-1">
                          YOUR PERSONAL REFERRAL LINK:
                        </label>
                        <input
                          type="url"
                          placeholder="https://merchant.com/join/YOURCODE"
                          value={referralUrlInput}
                          onChange={(e) => setReferralUrlInput(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                          The outbound destination when users click "Claim".
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Honest Truth review */}
                  <div className="p-4 rounded-lg bg-[#07090e] border border-white/[0.06] text-xs space-y-2">
                    <div className="font-mono font-semibold text-zinc-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Offer summary and terms:
                    </div>
                    <p className="text-zinc-300 font-sans">{selectedPendingOffer.honestTruth.summary}</p>
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200">
                      <strong className="font-mono text-[11px] block">THE CATCH:</strong>
                      {selectedPendingOffer.honestTruth.theCatch}
                    </div>
                  </div>

                  {/* Speedrun Hints Preview */}
                  <div className="p-4 rounded-lg bg-[#07090e] border border-white/[0.06] text-xs space-y-2">
                    <div className="font-mono font-semibold text-[#38bdf8] flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Suggested steps:
                    </div>
                    <ol className="space-y-1.5 list-decimal list-inside text-zinc-300">
                      {selectedPendingOffer.speedrunHints.map((step) => (
                        <li key={step.step} className="font-sans">
                          {step.instruction}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Email & Push blast option */}
                  <div className="p-3.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="blast-checkbox"
                        checked={blastEmailCheckbox}
                        onChange={(e) => setBlastEmailCheckbox(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/20 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="blast-checkbox" className="text-xs font-sans text-zinc-200 cursor-pointer">
                        <strong className="font-mono text-emerald-400 block">
                          Broadcast alert blast to {subscribers.length} newsletter subscribers & send push notification
                        </strong>
                        Instantly notifies our user community of this newly verified opportunity.
                      </label>
                    </div>
                    <Send className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:block" />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => onRejectOffer(selectedPendingOffer.id)}
                      className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-mono text-red-400 transition-colors"
                    >
                      Reject Finding
                    </button>
                    <button
                      onClick={handleApprove}
                      className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs font-mono transition-all flex items-center gap-2 shadow-md active:scale-[0.98]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve & Publish to Live Site
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manage Live Offers & Referral Links */}
      {activeAdminTab === 'live' && (
        <div className="space-y-5">
          {/* Header & Referral Vault Banner */}
          <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-emerald-400" />
                  Your Referral Links & Live Offers ({liveOffers.length})
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Plug in your personal referral code and invite link for every offer on the site. When visitors click or copy, they will use your exact tracking parameters.
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full md:w-72 shrink-0">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={liveSearchFilter}
                  onChange={(e) => setLiveSearchFilter(e.target.value)}
                  placeholder="Filter offers by company, code..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#141824] border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                  <Lock className="h-3.5 w-3.5 text-amber-300" />
                  Provider account links
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Save links to the provider dashboards where you check referral activity. Links are stored in this browser only. Never paste passwords or login details here.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto]">
                <input
                  value={providerLinkLabel}
                  onChange={(event) => setProviderLinkLabel(event.target.value)}
                  placeholder="Account name (e.g. Shuffle)"
                  className="rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white placeholder:text-zinc-600"
                />
                <input
                  type="url"
                  value={providerLinkUrl}
                  onChange={(event) => setProviderLinkUrl(event.target.value)}
                  placeholder="https://provider.com/affiliate/dashboard"
                  className="rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white placeholder:text-zinc-600"
                />
                <button type="button" onClick={handleAddProviderAccountLink} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black hover:bg-amber-300">
                  Save link
                </button>
              </div>
              {providerLinkMessage && <p className="text-[11px] text-red-200">{providerLinkMessage}</p>}
              {providerAccountLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {providerAccountLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#090d12] pl-3 text-xs text-zinc-200">
                      <a href={link.url} target="_blank" rel="noreferrer" className="py-2 hover:text-amber-200">{link.label}</a>
                      <button
                        type="button"
                        onClick={() => saveProviderAccountLinks(providerAccountLinks.filter((candidate) => candidate.id !== link.id))}
                        aria-label={`Remove ${link.label} account link`}
                        className="px-2 py-2 text-zinc-500 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral Vault Quick-Pill Bar */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Your Verified Referral Accounts:
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  Click any account to jump or filter
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {USER_REFERRAL_PRESETS.map((preset) => {
                  const isActiveInOffers = liveOffers.some((o) =>
                    preset.matchKeys.some((k) => o.company.toLowerCase().includes(k))
                  );
                  return (
                    <button
                      key={preset.company}
                      type="button"
                      onClick={() => setLiveSearchFilter(preset.company)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        liveSearchFilter === preset.company
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                          : 'bg-[#141824] border-white/[0.06] hover:border-white/20 text-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono text-white flex items-center justify-between">
                        <span>{preset.company}</span>
                        {isActiveInOffers && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Active on live site" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400 truncate mt-0.5 font-semibold">
                        {preset.code}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {preset.bonus}
                      </div>
                    </button>
                  );
                })}
              </div>
              {liveSearchFilter && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="text-xs font-mono text-zinc-400">
                    Showing results for: <span className="text-white font-bold">"{liveSearchFilter}"</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLiveSearchFilter('')}
                    className="text-xs font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Offers List with Dedicated In-Card Referral Editor */}
          <div className="space-y-4">
            {filteredLiveOffers.map((offer) => {
              const draftCode = draftCodes[offer.id] !== undefined ? draftCodes[offer.id] : (offer.referralCode || '');
              const draftUrl = draftUrls[offer.id] !== undefined ? draftUrls[offer.id] : (offer.referralUrl || '');
              const draftLogoUrl = draftLogoUrls[offer.id] !== undefined ? draftLogoUrls[offer.id] : (offer.logoUrl || '');
              const isSaved = !!savedSuccessIds[offer.id];
              const isCopied = copiedCodeId === offer.id;

              // Check if there is a preset for this offer
              const matchedPreset = USER_REFERRAL_PRESETS.find((p) =>
                p.matchKeys.some((k) => offer.company.toLowerCase().includes(k))
              );

              return (
                <div
                  key={offer.id}
                  className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] hover:border-white/[0.15] transition-all space-y-4"
                >
                  {/* Top Bar: Company info & tags */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setExpandedLiveOfferId((current) => current === offer.id ? null : offer.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={expandedLiveOfferId === offer.id}
                    >
                      <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="md" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold font-mono text-white">{offer.company}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
                            {offer.incentiveAmount}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 text-[10px] font-mono uppercase">
                            {offer.category}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 text-[10px] font-mono">
                            {offer.difficulty}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xl">{offer.title}</div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                          <span>
                            Clicks: <strong className="text-emerald-300">{offer.clicksCount || 0}</strong>
                          </span>
                          <span>
                            Conversions: <strong className="text-cyan-300">{offer.conversionsCount || 0}</strong>
                          </span>
                        </div>
                      </div>
                      <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expandedLiveOfferId === offer.id ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {draftUrl && (
                        <a
                          href={draftUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open your referral link in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Test Link</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove "${offer.company}" from live offers?`)) {
                            onDeleteLiveOffer(offer.id);
                          }
                        }}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Delete offer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {expandedLiveOfferId === offer.id && (
                  <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        Referral Code & Tracking URL Configuration
                      </span>
                      {matchedPreset && (
                        <button
                          type="button"
                          onClick={() => handleApplyPresetToOffer(offer.id, matchedPreset)}
                          className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors underline cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Apply {matchedPreset.company} Preset ({matchedPreset.code})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Referral Code Field */}
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                          Referral Code:
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={draftCode}
                            onChange={(e) => handleDraftCodeChange(offer.id, e.target.value)}
                            placeholder="e.g. fastcash, markwinters39"
                            className="w-full px-3 py-2 pr-9 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-emerald-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-400 font-semibold"
                          />
                          {draftCode && (
                            <button
                              type="button"
                              onClick={() => handleCopyCode(draftCode, offer.id)}
                              className="absolute right-2 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy code"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Referral URL Field */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                          Personal Referral / Affiliate Link (Destination URL):
                        </label>
                        <input
                          type="url"
                          value={draftUrl}
                          onChange={(e) => handleDraftUrlChange(offer.id, e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                          Custom Logo Image URL (optional):
                        </label>
                        <input
                          type="url"
                          value={draftLogoUrl}
                          onChange={(e) => handleDraftLogoUrlChange(offer.id, e.target.value)}
                          placeholder="https://your-site.com/logo.png"
                          className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400"
                        />
                        <p className="mt-1 text-[10px] text-zinc-500">Use a direct HTTPS image link. Leave blank to use the existing local logo.</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#0e121a] p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-300">Offer verification</p>
                          <p className="mt-1 text-[10px] text-zinc-500">
                            Mark reviewed only after checking the provider terms for this exact referral link.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerificationUpdate(offer, 'reviewed')}
                            className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-mono font-semibold text-emerald-300 hover:bg-emerald-400/20"
                          >
                            Mark reviewed today
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerificationUpdate(offer, 'terms-vary')}
                            className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-mono font-semibold text-amber-200 hover:bg-amber-300/20"
                          >
                            Terms vary
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-500">
                        <span>Status: <strong className="text-zinc-300">{offer.verificationStatus === 'reviewed' ? 'Reviewed' : 'Terms vary'}</strong></span>
                        <span>Last checked: <strong className="text-zinc-300">{offer.verifiedAt ? new Date(offer.verifiedAt).toLocaleDateString() : 'Not checked'}</strong></span>
                      </div>
                    </div>

                    {/* Bottom action bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                        <span>Clicks tracked: <strong className="text-white">{offer.clicksCount || 0}</strong></span>
                        <span>Estimated conversions: <strong className="text-emerald-400">{offer.conversionsCount || 0}</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveOfferReferral(offer)}
                        className={`px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Saved to Live Site!</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Link & Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              );
            })}

            {filteredLiveOffers.length === 0 && (
              <div className="p-10 text-center rounded-xl bg-[#0e121a] border border-white/[0.08]">
                <p className="text-xs font-mono text-zinc-400">
                  No offers matched your filter "{liveSearchFilter}".
                </p>
                <button
                  type="button"
                  onClick={() => setLiveSearchFilter('')}
                  className="mt-2 text-xs font-mono text-emerald-400 hover:underline cursor-pointer"
                >
                  Show all {liveOffers.length} offers
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Create Custom Offer */}
      {activeAdminTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="p-6 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
          <div className="rounded-xl border border-emerald-300/35 bg-[#101d1b] p-5 space-y-4 shadow-lg shadow-black/10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-emerald-300/15 p-2">
                <Bot className="h-5 w-5 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Offer Builder Bot</h3>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-300">Paste the offer details below. The bot can fill the form or check the public link for current terms. Nothing publishes until you review and click publish.</p>
              </div>
            </div>
            <label htmlFor="offer-builder-input" className="block text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Offer information
            </label>
            <textarea
              id="offer-builder-input"
              rows={5}
              value={offerBotInput}
              onChange={(event) => {
                setOfferBotInput(event.target.value);
                setOfferBotMessage(null);
              }}
              placeholder={'Company: Example Bank\nTitle: $100 signup bonus\nBonus: $100 cash\nLink: https://example.com/ref/yourcode\nRequirements: Receive a qualifying direct deposit\n1. Register through the link\n2. Complete the qualifying action'}
              className="w-full rounded-lg border border-white/20 bg-[#080d12] px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
              <button type="button" onClick={handleOfferBot} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-bold text-[#07100d] hover:bg-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Fill offer form
              </button>
              <button type="button" onClick={() => void handleVerifyOfferBot()} disabled={offerBotVerifying || !offerBotInput.trim()} className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/50 bg-cyan-300/15 px-4 py-2.5 text-sm font-bold text-cyan-50 hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50">
                <ShieldCheck className="h-3.5 w-3.5" />
                {offerBotVerifying ? 'Checking offer...' : 'Confirm & update from internet'}
              </button>
            </div>
            {offerBotMessage && (
              <div className="rounded-lg border border-emerald-200/25 bg-[#07110f] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">Bot status</p>
                <p className="mt-1 break-words text-sm leading-6 text-white">{offerBotMessage}</p>
              </div>
            )}
          </div>
          <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            Add Custom Referral Offer
          </h3>
          <p className="text-xs text-zinc-400">
            Create an offer with your custom referral parameters, honest catch breakdown, and speedrun steps.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Company / Merchant Name:</label>
              <input
                type="text"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Discover Bank"
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Offer Headline / Title:</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. $100 Statement Credit with First Purchase"
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incentive Badge:</label>
              <input
                type="text"
                value={newIncentive}
                onChange={(e) => setNewIncentive(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              >
                <option value="fintech">Banking & Fintech</option>
                <option value="brokerage">Brokerage & Stocks</option>
                <option value="cashback">Cashback & Shopping</option>
                <option value="crypto">Crypto & Web3</option>
                <option value="apps">Apps & Services</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Deposit / Spend Req:</label>
              <input
                type="text"
                value={newDeposit}
                onChange={(e) => setNewDeposit(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
              />
            </div>
          </div>

          {/* Referral Code & URL section */}
          <div className="p-4 rounded-lg bg-[#141824] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                Referral Parameters
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Insert preset:</span>
                {USER_REFERRAL_PRESETS.map((p) => (
                  <button
                    key={p.company}
                    type="button"
                    onClick={() => {
                      setNewCompany(p.company);
                      setNewRefCode(p.code);
                      setNewRefUrl(p.url);
                    }}
                    className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/10 text-[10px] font-mono text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  >
                    {p.company} ({p.code})
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1 font-semibold">Your Referral Code:</label>
                <input
                  type="text"
                  value={newRefCode}
                  onChange={(e) => setNewRefCode(e.target.value)}
                  placeholder="e.g. fastcash, markwinters39"
                  className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-emerald-400 font-semibold focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  The code visitors will copy and apply.
                </span>
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1 font-semibold">Your Referral URL:</label>
                <input
                  type="url"
                  value={newRefUrl}
                  onChange={(e) => setNewRefUrl(e.target.value)}
                  placeholder="https://merchant.com/r/..."
                  className="w-full px-3 py-2 rounded bg-[#090b0e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  The destination link opened when visitors click.
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1">The Catch & Fine Print (Honest Truth):</label>
            <textarea
              rows={2}
              value={newHonestCatch}
              onChange={(e) => setNewHonestCatch(e.target.value)}
              placeholder="State any deposit hold, card requirements, or cancellation reminders clearly."
              className="w-full px-3 py-2 rounded bg-[#141824] border border-white/10 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs transition-colors"
          >
            Publish Custom Offer to Signups4FastCash.com
          </button>
        </form>
      )}

      {/* Tab 4: Email Blast & Notification Logs */}
      {activeAdminTab === 'blasts' && (
        <div className="p-5 rounded-xl bg-[#0e121a] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-[#00f2fe]" />
              Newsletter & Push Broadcast History
            </h3>
            <span className="text-xs font-mono text-emerald-400">
              {subscribers.length} Active Subscribers
            </span>
          </div>

          {blastLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No blasts triggered yet. When you approve an offer with the blast option checked, dispatch logs will show here.
            </div>
          ) : (
            <div className="space-y-2.5">
              {blastLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-[#141824] border border-white/[0.06] text-xs font-mono flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold">{log.subject}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Sent to {log.recipientCount} subscribers • {new Date(log.sentAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                    Delivered
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'assistant' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-[#0e121a] border border-cyan-400/20 space-y-4">
            <div>
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                AI Outreach Assistant
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Give the assistant a promotion task. It will create a human-reviewable plan, search phrases,
                rule checks, and one customized draft. It never auto-posts, mass-posts, or bypasses moderation.
              </p>
              <p className="mt-2 rounded border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs leading-relaxed text-red-200">
                Never enter passwords, login details, passcodes, private messages, or account credentials here.
                The assistant cannot log in or publish for you.
              </p>
            </div>
            <textarea
              rows={4}
              value={outreachTask}
              onChange={(e) => setOutreachTask(e.target.value)}
              placeholder="Example: Find relevant Facebook communities for a transparent signup-bonus comparison resource and prepare one post for a group that allows self-promotion."
              className="w-full rounded-lg border border-white/10 bg-[#090b0e] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-400 focus:outline-none"
            />
            <textarea
              rows={2}
              value={outreachContext}
              onChange={(e) => setOutreachContext(e.target.value)}
              placeholder="Optional context: audience, location, offer category, or a group's visible rules."
              className="w-full rounded-lg border border-white/10 bg-[#090b0e] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleOutreachAssistant}
              disabled={outreachLoading}
              className="rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
            >
              {outreachLoading ? 'Preparing safe outreach plan...' : 'Create outreach plan'}
            </button>
            {outreachError && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">
                {outreachError}
              </div>
            )}
          </div>

          {outreachResult && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
                <h4 className="text-sm font-bold text-white">Plan summary</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{outreachResult.summary}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-200">Search phrases</h4>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                    {outreachResult.searchQueries.map((query) => <li key={query}>• {query}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-200">Safety checks</h4>
                  <ul className="mt-3 space-y-2 text-xs text-amber-100/80">
                    {outreachResult.safetyNotes.map((note) => <li key={note}>• {note}</li>)}
                  </ul>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Human workflow</h4>
                <ol className="mt-3 space-y-3">
                  {outreachResult.workflow.map((item) => (
                    <li key={item.step} className="text-xs text-zinc-300">
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">{item.step}</span>
                      <strong className="text-white">{item.action}</strong>
                      <span className="ml-2 text-zinc-500">{item.reason}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-200">Draft post</h4>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-100">{outreachResult.draftPost}</pre>
                <p className="mt-4 border-t border-white/10 pt-3 text-xs text-emerald-100/80">
                  Disclosure: {outreachResult.disclosure}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeAdminTab === 'copilot' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/25 bg-[#0e121a] p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-400/15 p-2 text-amber-200"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">S4FC Copilot</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">Ask for help understanding the site, improving an offer, writing public copy, diagnosing a problem, or choosing the right admin control. I can recommend changes, but you approve and save them.</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs leading-relaxed text-red-200">Never enter passwords, API keys, passcodes, private messages, bank details, or government ID.</div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {copilotMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && <Bot className="mt-2 h-4 w-4 shrink-0 text-amber-300" />}
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${message.role === 'user' ? 'bg-cyan-400/15 text-cyan-50' : 'bg-[#141824] text-zinc-200'}`}>
                    {message.content}
                  </div>
                  {message.role === 'user' && <User className="mt-2 h-4 w-4 shrink-0 text-cyan-300" />}
                </div>
              ))}
              {copilotLoading && <div className="text-xs text-zinc-500">Copilot is thinking...</div>}
            </div>
            <form onSubmit={handleCopilotSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={copilotInput}
                onChange={(event) => setCopilotInput(event.target.value)}
                placeholder="How should I improve the Freecash offer?"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090b0e] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
              />
              <button type="submit" disabled={copilotLoading || !copilotInput.trim()} className="rounded-lg bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">Ask Copilot</button>
            </form>
            {copilotError && <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{copilotError}</div>}
          </div>
        </div>
      )}

    </div>
  );
};
