import React, { useMemo, useState } from 'react';
import { ExternalLink, Link as LinkIcon, Save, Search, WalletCards } from 'lucide-react';
import { Offer } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface AdminOffersPageProps {
  liveOffers: Offer[];
  onUpdateLiveOffer: (offerId: string, updates: Partial<Offer>) => void;
  onDeleteLiveOffer: (offerId: string) => void;
}

interface ProviderAccountLink {
  id: string;
  label: string;
  url: string;
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
  category: offer.category || 'apps',
  referralCode: String(offer.referralCode || ''),
  referralUrl: String(offer.referralUrl || ''),
  officialMerchantUrl: String(offer.officialMerchantUrl || ''),
}));

export const AdminOffersPage: React.FC<AdminOffersPageProps> = ({
  liveOffers,
  onUpdateLiveOffer,
  onDeleteLiveOffer,
}) => {
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { code: string; url: string }>>({});
  const [providerLinks, setProviderLinks] = useState<ProviderAccountLink[]>([]);
  const offers = useMemo(() => safeOffers(liveOffers), [liveOffers]);
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
    const company = `${offer.company} ${offer.companySlug}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return providerLinks.find((link) => {
      const label = link.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      return company.includes(label.replace(/affiliate|referrals|referralprogram|dashboard|invitefriends/g, ''))
        || label.includes(company);
    });
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
            return (
              <section key={offer.id} className="rounded-xl border border-white/[0.08] bg-[#0e121a] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : offer.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">{offer.company}</span>
                      <span className="block truncate text-xs text-zinc-400">{offer.title}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wider text-emerald-300">{offer.incentiveAmount}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {providerLink && (
                      <a href={providerLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100 hover:bg-amber-300/20" title={`Open ${providerLink.label} to check referral earnings`}>
                        <WalletCards className="h-3.5 w-3.5" /> Check earnings
                      </a>
                    )}
                    {(draft.url || offer.officialMerchantUrl) && (
                      <a href={draft.url || offer.officialMerchantUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/25 px-2.5 py-2 text-xs text-emerald-200 hover:bg-emerald-300/10">
                        <ExternalLink className="h-3.5 w-3.5" /> Open target website
                      </a>
                    )}
                    <button type="button" onClick={() => setExpandedId(expanded ? null : offer.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10">
                      {expanded ? 'Close' : 'Edit'}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-4 grid gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-2">
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
