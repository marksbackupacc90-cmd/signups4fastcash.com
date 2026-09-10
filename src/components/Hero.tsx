import React from 'react';
import { Search, SlidersHorizontal, Cpu, ArrowRight } from 'lucide-react';
import { OfferCategory } from '../types';

interface HeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: 'highest' | 'fastest' | 'easiest';
  setSortBy: (sort: 'highest' | 'fastest' | 'easiest') => void;
  totalOffersCount: number;
  totalCashPotential: number;
  onOpenAICouncil: () => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All Offers' },
  { id: 'fintech', label: 'Banking & Fintech' },
  { id: 'brokerage', label: 'Free Stocks & Brokerages' },
  { id: 'cashback', label: 'Cashback & Rebates' },
  { id: 'crypto', label: 'Crypto & Web3' },
];

export const Hero: React.FC<HeroProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  totalOffersCount,
  totalCashPotential,
  onOpenAICouncil,
}) => {
  return (
    <section className="relative pt-12 pb-8 border-b border-white/[0.08] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_0%,rgba(0,242,254,0.08),transparent_38%)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="flex items-center gap-2 mb-5 text-xs font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Offers with clear terms and direct merchant payouts
        </div>

        {/* Main Headline */}
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
            Find the offers worth your time.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            Compare real referral bonuses with the deposit, payout speed, and fine print visible up front. No hype, no payment handling.
          </p>
          <button
            onClick={onOpenAICouncil}
            id="hero-launch-ai-council-btn"
            className="mt-6 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-semibold text-xs font-mono transition-colors inline-flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            Ask the 5-AI Council
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-mono text-zinc-400">
          <span><strong className="text-white">{totalOffersCount}</strong> vetted offers</span>
          <span><strong className="text-emerald-400">${totalCashPotential}+</strong> potential rewards</span>
          <span><strong className="text-white">$0</strong> payment handling</span>
        </div>

        {/* Search and Filters Bar */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          
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
                  setSearchQuery((e.target as HTMLInputElement).value);
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
            <span className="text-xs font-mono text-zinc-400">SORT:</span>
            <div className="flex items-center rounded-md bg-[#10141d] border border-white/10 p-0.5">
              <button
                id="sort-highest"
                onClick={() => setSortBy('highest')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  sortBy === 'highest'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Highest Cash
              </button>
              <button
                id="sort-fastest"
                onClick={() => setSortBy('fastest')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  sortBy === 'fastest'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Fastest Payout
              </button>
              <button
                id="sort-easiest"
                onClick={() => setSortBy('easiest')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  sortBy === 'easiest'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lowest Deposit
              </button>
            </div>
          </div>

        </div>

        {/* Category Filter Chips */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              id={`filter-category-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#00f2fe]/10 border border-[#00f2fe]/40 text-[#00f2fe] font-semibold shadow-sm'
                  : 'bg-[#10141d] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/15'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
};
