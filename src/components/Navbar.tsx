import React from 'react';
import { Sparkles, Cpu } from 'lucide-react';

interface NavbarProps {
  activeTab: 'offers' | 'guide' | 'analytics' | 'admin';
  setActiveTab: (tab: 'offers' | 'guide' | 'analytics' | 'admin') => void;
  onOpenAICouncil: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAICouncil,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090b0e]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('offers')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            id="brand-logo-btn"
          >
            <div className="w-8 h-8 rounded-md bg-[#10141d] border border-white/10 flex items-center justify-center text-[#38bdf8] group-hover:border-[#38bdf8]/40 transition-colors shadow-sm">
              <span className="font-mono font-bold text-sm text-[#00f2fe]">$</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-tight text-base sm:text-lg text-white group-hover:text-[#38bdf8] transition-colors">
                  signups<span className="text-[#00f2fe]">4</span>fastcash<span className="text-zinc-500 font-normal text-xs">.com</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  SSG Speed
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-[#10141d] border border-white/[0.06]">
          <button
            id="nav-offers-tab"
            onClick={() => setActiveTab('offers')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'offers'
                ? 'bg-white/10 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Verified Offers
          </button>
          
          <button
            id="nav-guide-tab"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'guide'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>$0 to $1,000 Blueprint</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
              $0 START
            </span>
          </button>

        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Omni-AI Council Matchmaker Button */}
          <button
            id="btn-omni-ai-header"
            onClick={onOpenAICouncil}
            title="Launch 5-AI Consensus Syndicate (Gemini, DeepSeek, LLaMA, Mistral, Qwen)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-medium transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] group"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden sm:inline">Ask AI</span>
            <span className="sm:hidden">AI</span>
          </button>

        </div>

      </div>
    </header>
  );
};
