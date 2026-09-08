import React from 'react';
import { Bot, Bell, ShieldCheck, BarChart3, Lock, Sparkles, Send, Cpu } from 'lucide-react';

interface NavbarProps {
  activeTab: 'offers' | 'guide' | 'analytics' | 'admin';
  setActiveTab: (tab: 'offers' | 'guide' | 'analytics' | 'admin') => void;
  pendingCount: number;
  onOpenNewsletter: () => void;
  pushEnabled: boolean;
  onTogglePush: () => void;
  onOpenExportModal: () => void;
  onOpenAICouncil: () => void;
  isAdminUnlocked: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  onOpenNewsletter,
  pushEnabled,
  onTogglePush,
  onOpenExportModal,
  onOpenAICouncil,
  isAdminUnlocked,
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

          <button
            id="nav-analytics-tab"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'analytics'
                ? 'bg-white/10 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#38bdf8]" />
            Conversion Dashboard
          </button>
          {isAdminUnlocked && (
            <button
              id="nav-admin-tab"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Admin Panel
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-mono font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
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
            <span className="hidden sm:inline">Omni-AI Council</span>
            <span className="sm:hidden">5-AI</span>
          </button>

          {/* Static SSG Export button */}
          <button
            id="btn-ssg-export"
            onClick={onOpenExportModal}
            title="Static Site Export (Fast & Secure SSG Generator)"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#10141d] border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 text-xs font-mono transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span>Export SSG</span>
          </button>

          {/* Push Notification Toggle */}
          <button
            id="btn-push-notification"
            onClick={onTogglePush}
            title={pushEnabled ? "Push notifications active" : "Enable push notifications for hot drops"}
            className={`p-2 rounded-md border text-xs transition-colors flex items-center gap-1.5 ${
              pushEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-[#10141d] border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-mono">
              {pushEnabled ? 'Push: ON' : 'Push Alerts'}
            </span>
          </button>

          {/* Newsletter Subscribe Trigger */}
          <button
            id="btn-newsletter-header"
            onClick={onOpenNewsletter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00f2fe]/10 border border-[#00f2fe]/30 hover:bg-[#00f2fe]/20 text-[#00f2fe] text-xs font-mono font-medium transition-all shadow-[0_0_15px_rgba(0,242,254,0.1)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Newsletter Drops</span>
            <span className="xs:hidden">Drops</span>
          </button>

          {/* Mobile Admin & Dashboard Shortcuts */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setActiveTab(activeTab === 'guide' ? 'offers' : 'guide')}
              className={`p-2 rounded-md border text-xs font-mono transition-colors ${
                activeTab === 'guide'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#10141d] border-white/10 text-emerald-400'
              }`}
              title="$0 to $1,000 Blueprint"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            {isAdminUnlocked && (
              <button
                onClick={() => setActiveTab(activeTab === 'admin' ? 'offers' : 'admin')}
                className="p-2 rounded-md bg-[#10141d] border border-white/10 text-amber-400 relative"
                title="Admin Panel"
              >
                <Lock className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab(activeTab === 'analytics' ? 'offers' : 'analytics')}
              className="p-2 rounded-md bg-[#10141d] border border-white/10 text-[#38bdf8]"
              title="Conversion Analytics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
