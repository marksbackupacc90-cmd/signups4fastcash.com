import React from 'react';
import { ArrowRight, BellRing, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, Offer, SiteSettings } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface HeroProps {
  siteSettings?: SiteSettings;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: 'random' | 'highest' | 'fastest' | 'easiest';
  setSortBy: (sort: 'random' | 'highest' | 'fastest' | 'easiest') => void;
  offerFilter: 'all' | 'no-deposit' | 'paypal' | 'fast' | 'beginner' | 'purchase';
  setOfferFilter: (filter: 'all' | 'no-deposit' | 'paypal' | 'fast' | 'beginner' | 'purchase') => void;
  totalOffersCount: number;
  featuredOffers: Offer[];
  onOpenFinder?: () => void;
  onOpenNewsletter?: () => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All Offers' },
  { id: 'fintech', label: 'Banking & Fintech' },
  { id: 'brokerage', label: 'Free Stocks & Brokerages' },
  { id: 'cashback', label: 'Cashback & Rebates' },
  { id: 'apps', label: 'Apps & Rewards' },
  { id: 'crypto', label: 'Crypto & Web3' },
];

export const Hero: React.FC<HeroProps> = ({
  siteSettings,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  offerFilter,
  setOfferFilter,
  totalOffersCount,
  featuredOffers,
  onOpenFinder,
  onOpenNewsletter,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const marqueeOffers = featuredOffers.length > 0 ? [...featuredOffers, ...featuredOffers] : [];

  return (
    <section className="relative overflow-hidden pb-5 pt-5 sm:pb-6 sm:pt-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="retro-window">
          <div className="bg-[#0d1724] p-4 sm:p-6 lg:p-7">
        
        {/* Main Headline */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
            {settings.mainHeadline}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            {settings.subHeadline}
          </p>
          <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
            This site is an independent comparison resource. We do not guarantee that every offer will pay, and merchant terms can change at any time. Always review the current official offer before signing up.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[#2dd4ee] px-4 py-2.5 text-xs font-bold text-[#06131a] shadow-sm transition-colors hover:bg-[#67e8f9]"
            >
              Browse offers
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {onOpenFinder && (
              <button
                type="button"
                onClick={onOpenFinder}
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                Find my best match
              </button>
            )}
          </div>
          </div>
          <div className="w-full max-w-[13rem] self-start sm:max-w-[15rem] lg:w-64">
            <div className="overflow-hidden rounded-xl bg-transparent py-2">
              <div className="logo-marquee-track flex w-max items-center gap-3">
                {marqueeOffers.map((offer, index) => (
                  <div
                    key={`${offer.id}-${index}`}
                    className="flex shrink-0 items-center justify-center"
                  >
                    <CompanyLogo
                      companyName={offer.company}
                      slug={offer.companySlug}
                      logoUrl={offer.logoUrl}
                      size="sm"
                      loading="eager"
                      className="!h-14 !w-14 sm:!h-16 sm:!w-16"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-mono text-zinc-400">
          <span><strong className="text-white">{totalOffersCount}</strong> listed offers</span>
          <span><strong className="text-emerald-400">Terms shown</strong> before you click</span>
          <span><strong className="text-white">$0</strong> payment handling</span>
        </div>

        {onOpenNewsletter && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                <BellRing className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Get the best new offers sent to you</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">Choose instant drops, a daily digest, or a weekly shortlist. Confirm your email and unsubscribe anytime.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenNewsletter}
              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-[#06131a] transition-colors hover:bg-cyan-200"
            >
              Subscribe to alerts
              <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
          <span className="mr-1 font-mono uppercase tracking-[0.12em] text-zinc-400">Popular guides:</span>
          <a href="/cashback-offers" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Cashback offers</a>
          <a href="/signup-bonus-sites" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Signup bonus sites</a>
          <a href="/best-no-deposit-bonuses-this-month" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">No-deposit bonuses</a>
          <a href="/how-to-compare-referral-bonuses-safely" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Referral safety guide</a>
          <a href="/best-fintech-bonuses" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Fintech bonuses</a>
          <a href="/best-rewards-apps" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Rewards apps</a>
          <a href="/best-free-stock-offers-for-beginners" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">Free stock for beginners</a>
          <a href="/best-fintech-bonuses-without-deposit" className="rounded-full border border-white/10 bg-[#10141d] px-2.5 py-1 hover:border-cyan-300/40 hover:text-white">No-deposit fintech</a>
        </div>

        {/* Search and Filters Bar */}
        <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-lg border border-white/[0.06] bg-[#0e121a] p-4 md:flex-row md:items-center">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              id="search-offers-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSearchSubmit?.((e.target as HTMLInputElement).value);
                }
              }}
              placeholder="Search companies, cash bonuses, or $0 deposit..."
              className="w-full rounded-lg border border-white/10 bg-[#10141d] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-[#00f2fe]/50 focus:outline-none focus:ring-1 focus:ring-[#00f2fe]/50 font-sans"
              aria-label="Search offers"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="focus-ring absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded px-1 text-xs text-zinc-400 hover:text-white"
                aria-label="Clear offer search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            <label htmlFor="sort-offers" className="text-xs font-mono text-zinc-400">SORT:</label>
            <select
              id="sort-offers"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'random' | 'highest' | 'fastest' | 'easiest')}
              className="rounded-md border border-white/10 bg-[#10141d] px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition-colors focus:border-[#2dd4ee]"
            >
              <option value="random">Random order</option>
              <option value="highest">Highest Cash</option>
              <option value="fastest">Fastest Payout</option>
              <option value="easiest">Lowest Deposit</option>
            </select>
          </div>

        </div>

        {/* Quick category filters */}
        <div className="mt-4" aria-label="Filter offers by category">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  aria-pressed={isSelected}
                  className={`focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-cyan-300/60 bg-cyan-300 text-[#06131a]'
                      : 'border-white/10 bg-[#10141d] text-zinc-300 hover:border-cyan-300/40 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Filter offers by requirements">
            {([
              ['all', 'All requirements'],
              ['no-deposit', 'No deposit'],
              ['paypal', 'PayPal cashout'],
              ['fast', 'Fast payout'],
              ['beginner', 'Beginner-friendly'],
              ['purchase', 'Purchase required'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOfferFilter(id)}
                aria-pressed={offerFilter === id}
                className={`focus-ring rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                  offerFilter === id
                    ? 'border-emerald-300/60 bg-emerald-300 text-[#06131a]'
                    : 'border-white/10 bg-[#10141d] text-zinc-400 hover:border-emerald-300/40 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
          </div>
        </div>

      </div>
    </section>
  );
};
