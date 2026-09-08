import React from 'react';
import { Search, Sparkles, ShieldCheck, DollarSign, Zap, Bot, Filter, SlidersHorizontal, Cpu, ArrowRight } from 'lucide-react';
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
  onOpenGuide?: () => void;
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
  onOpenGuide,
}) => {
  return (
    <section className="relative pt-8 pb-10 border-b border-white/[0.08] overflow-hidden">
      {/* Background glow & subtle technical grid */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#00f2fe]/5 blur-[120px] rounded-full"></div>
        <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Terminal / Cursor-style Monospace Eyebrow */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-zinc-400">STATUS:</span>
            <span className="text-emerald-400 font-semibold">100% NON-CUSTODIAL</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">NO PAYMENT HANDS-ON</span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-300">
            <Bot className="w-3 h-3 text-[#38bdf8]" />
            <span>CashBot 60m Scan Cycle Active</span>
          </div>

          <button
            onClick={onOpenAICouncil}
            id="hero-omni-ai-pill"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-mono text-cyan-300 transition-colors cursor-pointer"
          >
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Omni-AI Council Active: 5 Unified Engines</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </button>
        </div>

        {/* Main Headline */}
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Honest Referral Signups.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] via-[#38bdf8] to-emerald-400">
              Real Cash. Zero Bull.
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            We scour, test, and filter the internet’s top affiliate incentive promos. 
            <strong className="text-zinc-200 font-semibold"> We never touch your payments</strong>—all bonuses are deposited directly into your bank or brokerage by verified institutions. Every offer has step-by-step speedrun hints and the full honest truth.
          </p>
        </div>

        {/* Omni-AI Syndicate Banner */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-[#0d1626] via-[#09111c] to-[#070b12] border border-cyan-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">Omni-AI Multi-Model Council</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  Gemini • DeepSeek R1 • LLaMA 3.3 • Mistral • Qwen 2.5
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                5 leading free AI architectures unified into one engine to mathematically calculate yield, spot traps, and build maximum-profit stacking routines.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAICouncil}
            id="hero-launch-ai-council-btn"
            className="px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-semibold text-xs font-mono transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-cyan-950/40 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consult AI Council</span>
          </button>
        </div>

        {/* $0 to $1,000 Zero-Capital Snowball Blueprint Spotlight */}
        {onOpenGuide && (
          <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-[#0a1818] via-[#071317] to-[#080d14] border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-mono font-black text-sm">
                $0
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white font-mono">$0 to $1,000+ Zero-Capital Blueprint</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                    START WITH $0.00
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                    Accurate payout timeframes & mathematical order
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Have zero dollars in your bank? Follow this step-by-step roadmap to generate your first $35-$60 in under 24h, then compound into $650–$1,250+.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenGuide}
              id="hero-open-blueprint-btn"
              className="px-4 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs font-mono transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-emerald-950/40 active:scale-[0.98] cursor-pointer"
            >
              <span>Open $0 Blueprint</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Trust & Guarantee Indicators */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#10141d]/80 border border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Hands-Off Payouts</div>
              <div className="text-xs font-semibold text-zinc-200">100% Direct to You</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#10141d]/80 border border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#00f2fe]/10 border border-[#00f2fe]/20 flex items-center justify-center text-[#00f2fe] shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Speedrun Guides</div>
              <div className="text-xs font-semibold text-zinc-200">Fastest Way to Cash</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#10141d]/80 border border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Current Live Pool</div>
              <div className="text-xs font-semibold text-emerald-400 font-mono">${totalCashPotential}+ Available</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#10141d]/80 border border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Active Curation</div>
              <div className="text-xs font-semibold text-zinc-200">{totalOffersCount} Vetted Offers</div>
            </div>
          </div>
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
