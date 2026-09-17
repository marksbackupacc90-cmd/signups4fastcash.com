import React, { useEffect, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, Offer, SiteSettings } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface HeroProps {
  siteSettings?: SiteSettings;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: 'highest' | 'fastest' | 'easiest';
  setSortBy: (sort: 'highest' | 'fastest' | 'easiest') => void;
  totalOffersCount: number;
  featuredOffers: Offer[];
  onOpenFinder?: () => void;
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
  totalOffersCount,
  featuredOffers,
  onOpenFinder,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const [logoPage, setLogoPage] = useState(0);
  const logoPageCount = Math.max(1, Math.ceil(featuredOffers.length / 4));

  useEffect(() => {
    setLogoPage((currentPage) => currentPage % logoPageCount);
  }, [logoPageCount]);

  useEffect(() => {
    if (logoPageCount <= 1) return;
    const interval = window.setInterval(() => {
      setLogoPage((currentPage) => (currentPage + 1) % logoPageCount);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [logoPageCount]);

  const visibleLogoOffers = featuredOffers.slice(logoPage * 4, logoPage * 4 + 4);

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
          <p className="mt-3 text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-2xl">
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
            <div className="grid grid-cols-2 gap-3">
            {visibleLogoOffers.map((offer) => (
              <div
                key={offer.id}
                className="animate-in fade-in flex aspect-square items-center justify-center rounded-lg border border-white/[0.08] bg-[#0a1220] p-2 transition-colors duration-700 hover:border-[#2dd4ee]/40 hover:bg-[#0f1d2d] sm:p-3"
              >
                <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" loading="eager" className="!h-14 !w-14 rounded-md sm:!h-16 sm:!w-16" />
              </div>
            ))}
            </div>
            {logoPageCount > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5" aria-label="Rotating featured offers">
                {Array.from({ length: logoPageCount }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Show featured offers ${index + 1} of ${logoPageCount}`}
                    onClick={() => setLogoPage(index)}
                    className={`h-1.5 rounded-full transition-all ${index === logoPage ? 'w-5 bg-[#2dd4ee]' : 'w-1.5 bg-white/25 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-mono text-zinc-400">
          <span><strong className="text-white">{totalOffersCount}</strong> listed offers</span>
          <span><strong className="text-emerald-400">Terms shown</strong> before you click</span>
          <span><strong className="text-white">$0</strong> payment handling</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
          <span className="mr-1 font-mono uppercase tracking-[0.12em] text-zinc-500">Popular guides:</span>
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
                className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 rounded px-1 text-xs text-zinc-400 hover:text-white"
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
              onChange={(event) => setSortBy(event.target.value as 'highest' | 'fastest' | 'easiest')}
              className="rounded-md border border-white/10 bg-[#10141d] px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition-colors focus:border-[#2dd4ee]"
            >
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
        </div>
          </div>
        </div>

      </div>
    </section>
  );
};
