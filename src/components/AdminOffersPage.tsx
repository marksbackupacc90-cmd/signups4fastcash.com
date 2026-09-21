import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Link as LinkIcon, Save, Search, WalletCards } from 'lucide-react';
import { Offer, SpeedrunStep } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface AdminOffersPageProps {
  liveOffers: Offer[];
  onUpdateLiveOffer: (offerId: string, updates: Partial<Offer>) => void;
  onDeleteLiveOffer: (offerId: string) => void;
  onCreateCustomOffer: (offer: Omit<Offer, 'id' | 'clicksCount' | 'conversionsCount' | 'createdAt' | 'updatedAt'>) => void;
}

interface ProviderAccountLink {
  id: string;
  label: string;
  url: string;
}

interface OfferIssueReport {
  id: string;
  offerId: string;
  issue: string;
  description: string;
  status: 'open' | 'reviewing' | 'resolved';
  reportedAt: string;
}

const DEFAULT_PROVIDER_ACCOUNT_LINKS: ProviderAccountLink[] = [
  { id: 'provider-stake', label: 'Stake Affiliate', url: 'https://stake.us/affiliate/overview' },
  { id: 'provider-acebet', label: 'AceBet Affiliate', url: 'https://acebet.cc/affiliates?tab=referrals' },
  { id: 'provider-kraken', label: 'Kraken Referrals', url: 'https://www.kraken.com/c/offers?tab=referrals' },
  { id: 'provider-myprize', label: 'MyPrize Referrals', url: 'https://myprize.us/referrals' },
  { id: 'provider-sofi', label: 'SoFi Referral Program', url: 'https://www.sofi.com/referral-program/' },
  { id: 'provider-joko', label: 'Joko Dashboard', url: 'https://app.joko.com/home' },
  { id: 'provider-chime', label: 'Chime Invite Friends', url: 'https://app.chime.com/invite-friends' },
  { id: 'provider-coinsbackcasino', label: 'CoinsBackCasino Referrals', url: 'https://www.coinsbackcasino.com/refer' },
];

const safeOffers = (offers: Offer[]) => (Array.isArray(offers) ? offers.filter(Boolean) : []).map((offer) => ({
  ...offer,
  id: String(offer.id || ''),
  company: String(offer.company || 'Unknown provider'),
  title: String(offer.title || 'Untitled offer'),
  companySlug: String(offer.companySlug || ''),
  category: typeof offer.category === 'string' ? offer.category : 'apps',
  referralCode: String(offer.referralCode || ''),
  referralUrl: String(offer.referralUrl || ''),
  officialMerchantUrl: String(offer.officialMerchantUrl || ''),
}));

export const AdminOffersPage: React.FC<AdminOffersPageProps> = ({
  liveOffers,
  onUpdateLiveOffer,
  onDeleteLiveOffer,
  onCreateCustomOffer,
}) => {
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { code: string; url: string }>>({});
  const [providerLinks, setProviderLinks] = useState<ProviderAccountLink[]>([]);
  const [offerEarningsLinks, setOfferEarningsLinks] = useState<Record<string, ProviderAccountLink>>({});
  const [earningsDrafts, setEarningsDrafts] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [issueReports, setIssueReports] = useState<OfferIssueReport[]>([]);
  const [issueActionLoading, setIssueActionLoading] = useState<string | null>(null);
  const [newOffer, setNewOffer] = useState({
    company: '', title: '', category: 'fintech' as Offer['category'], incentiveAmount: '',
    incentiveValue: 0, payoutSpeed: '', difficulty: 'Easy (2 min)' as Offer['difficulty'],
    depositRequired: '$0', referralCode: '', referralUrl: '', officialMerchantUrl: '',
    summary: '', catchText: '', minimumHoldTime: 'None',
  });
  const offers = useMemo(() => safeOffers(liveOffers), [liveOffers]);
  React.useEffect(() => {
    let cancelled = false;
    const loadIssueReports = async () => {
      const token = localStorage.getItem('signups4fastcash_admin_token');
      const response = await fetch('/api/admin/offer-issue-reports', {
        headers: token ? { 'x-admin-token': token } : {},
        cache: 'no-store',
      }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null) as { reports?: OfferIssueReport[] } | null;
      if (!cancelled) setIssueReports(Array.isArray(data?.reports) ? data.reports.filter((report) => report.status !== 'resolved') : []);
    };
    void loadIssueReports();
    const timer = window.setInterval(loadIssueReports, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('s4fc_provider_account_links') || '[]') as ProviderAccountLink[];
      const valid = Array.isArray(saved)
        ? saved.filter((link) => link && typeof link.label === 'string' && /^https?:\/\//i.test(link.url))
        : [];
      const savedUrls = new Set(valid.map((link) => link.url));
      setProviderLinks([...valid, ...DEFAULT_PROVIDER_ACCOUNT_LINKS.filter((link) => !savedUrls.has(link.url))]);
    } catch {
      setProviderLinks(DEFAULT_PROVIDER_ACCOUNT_LINKS);
    }
    try {
      const saved = JSON.parse(localStorage.getItem('s4fc_offer_earnings_links') || '{}') as Record<string, ProviderAccountLink>;
      setOfferEarningsLinks(saved && typeof saved === 'object' ? saved : {});
    } catch {
      setOfferEarningsLinks({});
    }
  }, []);
  const filteredOffers = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return offers.filter((offer) => !query || [
      offer.company,
      offer.title,
      offer.category,
      offer.referralCode,
      offer.referralUrl,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [filter, offers]);

  const getDraft = (offer: Offer) => drafts[offer.id] || {
    code: offer.referralCode || '',
    url: offer.referralUrl || '',
  };
  const getProviderLink = (offer: Offer) => {
    if (offerEarningsLinks[offer.id]?.url) return offerEarningsLinks[offer.id];
    const company = `${offer.company} ${offer.companySlug}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return providerLinks.find((link) => {
      const label = link.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      return company.includes(label.replace(/affiliate|referrals|referralprogram|dashboard|invitefriends/g, ''))
        || label.includes(company);
    });
  };
  const saveOfferEarningsLink = (offer: Offer) => {
    const url = (earningsDrafts[offer.id] || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    const next = { ...offerEarningsLinks, [offer.id]: { id: `offer-${offer.id}`, label: `${offer.company} earnings`, url } };
    setOfferEarningsLinks(next);
    localStorage.setItem('s4fc_offer_earnings_links', JSON.stringify(next));
  };
  const reportsForOffer = (offerId: string) => issueReports.filter((report) => report.offerId === offerId);
  const markIssueFixed = async (reportId: string) => {
    setIssueActionLoading(reportId);
    const token = localStorage.getItem('signups4fastcash_admin_token');
    const response = await fetch(`/api/admin/offer-issue-reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
      body: JSON.stringify({ status: 'resolved' }),
    }).catch(() => null);
    if (response?.ok) setIssueReports((reports) => reports.filter((report) => report.id !== reportId));
    setIssueActionLoading(null);
  };
  const updateNewOffer = (field: keyof typeof newOffer, value: string | number) => {
    setNewOffer((current) => ({ ...current, [field]: value }));
  };
  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newOffer.company.trim() || !newOffer.title.trim() || !newOffer.referralUrl.trim()) return;
    const steps: SpeedrunStep[] = [
      { step: 1, instruction: 'Open the referral link and register with accurate information.' },
      { step: 2, instruction: 'Complete the qualifying requirement shown by the provider.' },
      { step: 3, instruction: 'Confirm the reward and payout terms in the provider account.' },
    ];
    onCreateCustomOffer({
      company: newOffer.company.trim(),
      companySlug: newOffer.company.toLowerCase().replace(/[^a-z0-9]/g, ''),
      title: newOffer.title.trim(),
      category: newOffer.category,
      incentiveAmount: newOffer.incentiveAmount.trim() || 'Reward varies',
      incentiveValue: Number(newOffer.incentiveValue) || 0,
      payoutSpeed: newOffer.payoutSpeed.trim() || 'Confirm with provider',
      difficulty: newOffer.difficulty,
      depositRequired: newOffer.depositRequired.trim() || '$0',
      availability: 'Verify current country and state eligibility',
      officialMerchantUrl: newOffer.officialMerchantUrl.trim() || newOffer.referralUrl.trim(),
      referralCode: newOffer.referralCode.trim(),
      referralUrl: newOffer.referralUrl.trim(),
      status: 'live',
      honestTruth: {
        summary: newOffer.summary.trim() || 'Review the current promotion details and eligibility before applying.',
        theCatch: newOffer.catchText.trim() || 'Requirements and payout timing are controlled by the provider and may change.',
        minimumHoldTime: newOffer.minimumHoldTime.trim() || 'None stated',
        idVerificationRequired: true,
        hiddenFeesWarning: 'Review the provider terms for fees, limits, and other conditions.',
        trustScore: 90,
      },
      speedrunHints: steps,
    });
    setNewOffer((current) => ({ ...current, company: '', title: '', referralCode: '', referralUrl: '', officialMerchantUrl: '', summary: '', catchText: '' }));
    setCreating(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-white">
              <LinkIcon className="h-4 w-4 text-emerald-400" />
              Offers
            </h1>
            <p className="mt-1 text-xs text-zinc-400">{filteredOffers.length} live offers available to manage.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => setCreating((current) => !current)} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#061016] hover:bg-emerald-300">
              {creating ? 'Close creator' : '+ Create new offer'}
            </button>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search offers"
              className="w-full rounded-lg border border-white/10 bg-[#090d12] py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-400"
            />
          </div>
            </div>
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="rounded-xl border border-emerald-300/25 bg-[#0e121a] p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-200">Create new offer</h2>
            <p className="mt-1 text-xs text-zinc-400">Fill in the details and the offer will use the same card format as the existing offers.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ['company', 'Company / merchant name', 'e.g. Discover Bank'],
                ['title', 'Offer title', 'e.g. Earn $100 after qualifying deposit'],
                ['incentiveAmount', 'Reward shown on card', '$100 cash bonus'],
                ['payoutSpeed', 'Payout speed', 'Instant or within 24 hours'],
                ['depositRequired', 'Deposit / spend requirement', '$0 or $500 direct deposit'],
                ['referralCode', 'Referral code', 'Your provider code'],
                ['referralUrl', 'Your referral link', 'https://...'],
                ['officialMerchantUrl', 'Public offer website', 'https://...'],
                ['summary', 'What you get', 'Short honest summary'],
                ['catchText', 'Important catch', 'Requirement or limitation'],
              ] as const).map(([field, label, placeholder]) => (
                <label key={field} className="text-xs text-zinc-400">
                  {label}
                  <input required={field === 'company' || field === 'title' || field === 'referralUrl'} type={field.toLowerCase().includes('url') ? 'url' : 'text'} value={String(newOffer[field])} onChange={(event) => updateNewOffer(field, event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400" />
                </label>
              ))}
              <label className="text-xs text-zinc-400">Reward value for sorting
                <input type="number" min="0" value={newOffer.incentiveValue} onChange={(event) => updateNewOffer('incentiveValue', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white" />
              </label>
              <label className="text-xs text-zinc-400">Category
                <select value={newOffer.category} onChange={(event) => updateNewOffer('category', event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white">
                  <option value="fintech">Banking & Fintech</option><option value="brokerage">Brokerage & Stocks</option><option value="cashback">Cashback & Shopping</option><option value="apps">Apps & Services</option><option value="crypto">Crypto & Web3</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400">Difficulty
                <select value={newOffer.difficulty} onChange={(event) => updateNewOffer('difficulty', event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white">
                  <option>Easy (2 min)</option><option>Fast (5 min)</option><option>Standard (10 min)</option><option>Moderate (10 min)</option>
                </select>
              </label>
            </div>
            <button type="submit" className="mt-4 rounded-lg bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#061016] hover:bg-emerald-300">Publish new offer</button>
          </form>
        )}
      </div>

      {filteredOffers.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-10 text-center text-sm text-zinc-400">
          No live offers match this search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOffers.map((offer) => {
            const draft = getDraft(offer);
            const providerLink = getProviderLink(offer);
            const expanded = expandedId === offer.id;
            const offerReports = reportsForOffer(offer.id);
            return (
              <section key={offer.id} className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
                {offerReports.length > 0 && (
                  <div className="mb-3 rounded-lg border border-rose-300/30 bg-rose-300/10 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-100">
                      <AlertCircle className="h-4 w-4" /> {offerReports.length} issue{offerReports.length === 1 ? '' : 's'} reported
                    </div>
                    <div className="mt-2 space-y-2">
                      {offerReports.map((report) => (
                        <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-100/80">
                          <span>{report.description || report.issue}</span>
                          <button
                            type="button"
                            onClick={() => void markIssueFixed(report.id)}
                            disabled={issueActionLoading === report.id}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-300 px-2 py-1 font-bold text-[#061016] disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3 w-3" /> {issueActionLoading === report.id ? 'Saving...' : 'Mark fixed'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : offer.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">{offer.company}</span>
                      <span className="block truncate text-xs text-zinc-400">{offer.title}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wider text-emerald-300">{offer.incentiveAmount}</span>
                      <span className="mt-1 block text-[10px] font-mono text-cyan-200">{Number(offer.clicksCount || 0).toLocaleString()} clicks</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {providerLink && (
                      <a href={providerLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200/60 bg-amber-300 px-3 py-2 text-xs font-bold text-[#171008] shadow-sm shadow-amber-950/30 hover:bg-amber-200" title={`Open ${providerLink.label} to check referral earnings`}>
                        <WalletCards className="h-3.5 w-3.5" /> Check earnings
                      </a>
                    )}
                    {(draft.url || offer.officialMerchantUrl) && (
                      <a href={draft.url || offer.officialMerchantUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-300/70 bg-emerald-400 px-3 py-2 text-xs font-bold text-[#061016] shadow-sm shadow-emerald-950/30 hover:bg-emerald-300">
                        <ExternalLink className="h-3.5 w-3.5" /> Open offer website
                      </a>
                    )}
                    <button type="button" onClick={() => setExpandedId(expanded ? null : offer.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10">
                      {expanded ? 'Close' : 'Edit'}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4 grid gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
                      <label className="block text-xs font-semibold text-amber-100">
                        Check earnings link for this offer
                        <input
                          type="url"
                          value={earningsDrafts[offer.id] ?? providerLink?.url ?? ''}
                          onChange={(event) => setEarningsDrafts((current) => ({ ...current, [offer.id]: event.target.value }))}
                          placeholder="https://provider.com/affiliate/dashboard"
                          className="mt-1 w-full rounded-lg border border-amber-200/20 bg-[#090d12] px-3 py-2 text-xs text-white outline-none focus:border-amber-300"
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => saveOfferEarningsLink(offer)} className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-[#171008] hover:bg-amber-200">
                          Save earnings link
                        </button>
                        {providerLink && <span className="text-[11px] text-zinc-400">The Check earnings button currently opens this link.</span>}
                      </div>
                    </div>
                    {providerLink && (
                      <a href={providerLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/20 sm:col-span-2">
                        <WalletCards className="h-3.5 w-3.5" /> Open {providerLink.label} to check or claim referral earnings
                      </a>
                    )}
                    <label className="text-xs text-zinc-400">
                      Referral code
                      <input value={draft.code} onChange={(event) => setDrafts((current) => ({ ...current, [offer.id]: { ...draft, code: event.target.value } }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white" />
                    </label>
                    <label className="text-xs text-zinc-400">
                      Referral URL
                      <input value={draft.url} onChange={(event) => setDrafts((current) => ({ ...current, [offer.id]: { ...draft, url: event.target.value } }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090d12] px-3 py-2 text-xs text-white" />
                    </label>
                    <button type="button" onClick={() => onUpdateLiveOffer(offer.id, { referralCode: draft.code, referralUrl: draft.url })} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black sm:col-span-2">
                      <Save className="h-3.5 w-3.5" /> Save offer link
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
