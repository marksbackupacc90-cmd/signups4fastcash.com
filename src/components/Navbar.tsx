import React from 'react';

interface NavbarProps {
  activeTab: 'offers' | 'games' | 'analytics' | 'admin';
  setActiveTab: (tab: 'offers' | 'games' | 'analytics' | 'admin') => void;
  onSelectSurveys: () => void;
  onInstallApp: () => void;
  installAvailable: boolean;
  rewardPoints: number;
  onCashOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onSelectSurveys,
  onInstallApp,
  installAvailable,
  rewardPoints,
  onCashOut,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#090d18]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('offers')}
            className="retro-button flex items-center gap-2.5 text-left group focus:outline-none"
            id="brand-logo-btn"
          >
            <div className="w-9 h-9 rounded-xl border border-cyan-300/40 bg-gradient-to-br from-cyan-300 to-violet-400 flex items-center justify-center text-slate-950 shadow-[0_0_24px_rgba(56,189,248,.35)]">
              <span className="font-black text-sm">4<span className="text-violet-900">*</span></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-tight text-base sm:text-lg text-black">
                  signups4<span className="text-cyan-300">fastcash.com</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-300/20 text-[11px] font-mono text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Verified terms shown
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 p-1 border-2 border-gray-600 border-t-white border-l-white">
          <button
            id="nav-offers-tab"
            onClick={() => setActiveTab('offers')}
            className={`retro-button px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'offers'
                ? 'bg-blue-800 text-white font-semibold'
                : 'text-black'
            }`}
          >
            Offers
          </button>
          <button
            id="nav-surveys-tab"
            onClick={onSelectSurveys}
            className="retro-button px-3.5 py-1.5 text-xs font-medium transition-all"
          >
            Surveys
          </button>
          <button
            id="nav-games-tab"
            onClick={() => setActiveTab('games')}
            className={`retro-button px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'games'
                ? 'bg-blue-800 text-white font-semibold'
                : 'text-black'
            }`}
          >
            Games
          </button>
          <button
            id="nav-install-app"
            onClick={onInstallApp}
            className={`retro-button px-3.5 py-1.5 text-xs font-medium transition-all ${
              installAvailable
                ? 'text-blue-800'
                : 'text-black'
            }`}
            title={installAvailable ? 'Install signups4fastcash as an app' : 'View app installation instructions'}
          >
            Install App
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Balance</div>
            <div className="text-xs font-mono font-bold text-green-800">
              {rewardPoints.toLocaleString()} pts · ${(rewardPoints / 100).toFixed(2)}
            </div>
          </div>
          <button
            id="nav-cashout-btn"
            onClick={onCashOut}
            className="retro-button px-2.5 py-1.5 text-xs font-semibold"
          >
            Cash Out
          </button>
        </div>

      </div>
    </header>
  );
};
