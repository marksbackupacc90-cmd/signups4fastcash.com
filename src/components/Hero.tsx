import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, Offer, OfferCategory, SiteSettings } from '../types';
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
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;

  return (
    <section className="relative pt-8 pb-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_0%,rgba(0,242,254,0.08),transparent_38%)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="retro-window">
          <div className="bg-[#141824] p-4 sm:p-6">
        
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
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-2 self-start lg:w-64">
            {featuredOffers.slice(0, 4).map((offer) => (
              <button
                key={offer.id}
                type="button"
                onClick={() => document.getElementById(`offer-card-${offer.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="group flex min-h-[6.5rem] flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-[#0e121a] p-2 text-center transition-colors hover:border-[#8bd3a7]/60 hover:bg-[#14251f]"
                title={`View ${offer.company} offer`}
              >
                <CompanyLogo companyName={offer.company} slug={offer.companySlug} logoUrl={offer.logoUrl} size="sm" />
                <span className="mt-1.5 max-w-full truncate text-[10px] font-semibold text-zinc-200 group-hover:text-white">{offer.company}</span>
                <span className="max-w-full truncate text-[9px] text-[#8bd3a7]">{offer.incentiveAmount}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-mono text-zinc-400">
          <span><strong className="text-white">{totalOffersCount}</strong> listed offers</span>
          <span><strong className="text-emerald-400">Terms shown</strong> before you click</span>
          <span><strong className="text-white">$0</strong> payment handling</span>
        </div>

        <div className="mt-6 grid gap-2 rounded-lg border border-white/[0.06] bg-[#0e121a] p-4 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-400">✓</span>
            <div>
              <p className="text-xs font-semibold text-white">Requirements first</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">See deposits, purchases, and verification before leaving the site.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-400">✓</span>
            <div>
              <p className="text-xs font-semibold text-white">Official signup links</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">Applications and payments happen directly with the merchant.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-400">✓</span>
            <div>
              <p className="text-xs font-semibold text-white">No guaranteed-income claims</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">Terms can change, so we encourage a final official-terms check.</p>
            </div>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="mt-8 rounded-lg border border-white/[0.06] bg-[#0e121a] p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          
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
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#10141d] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#00f2fe]/50 focus:ring-1 focus:ring-[#00f2fe]/50 font-sans transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
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
              className="rounded-md border border-white/10 bg-[#10141d] px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition-colors focus:border-[#6eae89]"
            >
              <option value="highest">Highest Cash</option>
              <option value="fastest">Fastest Payout</option>
              <option value="easiest">Lowest Deposit</option>
            </select>
          </div>

        </div>

        {/* Category Filter */}
        <div className="mt-4 flex items-center gap-2">
          <label htmlFor="category-filter" className="text-xs font-mono text-zinc-400">CATEGORY:</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="w-full max-w-xs rounded-md border border-white/10 bg-[#10141d] px-3 py-2 text-xs font-medium text-zinc-200 outline-none transition-colors focus:border-[#6eae89]"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
          </div>
        </div>

      </div>
    </section>
  );
};
