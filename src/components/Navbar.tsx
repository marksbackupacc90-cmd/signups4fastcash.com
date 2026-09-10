import React from 'react';

interface NavbarProps {
  activeTab: 'offers' | 'analytics' | 'admin';
  setActiveTab: (tab: 'offers' | 'analytics' | 'admin') => void;
  onSelectSurveys: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onSelectSurveys,
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
              <span className="font-black text-sm text-[#00f2fe]">4*</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-tight text-base sm:text-lg text-white group-hover:text-[#38bdf8] transition-colors">
                  signups4<span className="text-[#00f2fe]">fastcash.com</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Verified terms shown
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
            Offers
          </button>
          <button
            id="nav-surveys-tab"
            onClick={onSelectSurveys}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            Surveys
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          
        </div>

      </div>
    </header>
  );
};
