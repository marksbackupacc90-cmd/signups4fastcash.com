import React from 'react';
import { SfcCoinLogo } from './SfcCoinLogo';

interface NavbarProps {
  activeTab: 'offers' | 'surveys' | 'admin';
  setActiveTab: (tab: 'offers' | 'surveys' | 'admin') => void;
  onInstallApp: () => void;
  installAvailable: boolean;
  username?: string | null;
  onSignIn: () => void;
  onAccount: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onInstallApp,
  installAvailable,
  username,
  onSignIn,
  onAccount,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#090d18]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex min-h-16 flex-wrap items-center gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('offers')}
            className="retro-button min-w-0 flex items-center gap-2.5 text-left group focus:outline-none"
            id="brand-logo-btn"
          >
            <SfcCoinLogo />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="max-w-[calc(100vw-110px)] truncate font-mono font-bold tracking-tight text-sm sm:text-lg text-white">
                  Signups4<span className="text-cyan-300">FastCash.com</span>
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
        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto border-2 border-gray-600 border-t-white border-l-white p-1 md:order-none md:w-auto">
          <button
            id="nav-offers-tab"
            onClick={() => setActiveTab('offers')}
            className={`retro-button shrink-0 px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'offers'
                ? 'bg-blue-800 text-white font-semibold'
                : 'text-zinc-200 hover:text-white'
            }`}
          >
            Offers
          </button>
          <button
            id="nav-install-app"
            onClick={onInstallApp}
            className={`retro-button shrink-0 px-3.5 py-1.5 text-xs font-medium transition-all ${
              installAvailable
                ? 'text-blue-800'
                : 'text-zinc-200 hover:text-white'
            }`}
            title={installAvailable ? 'Install signups4fastcash as an app' : 'View app installation instructions'}
          >
            Install App
          </button>
          <button
            id="nav-surveys-tab"
            onClick={() => setActiveTab('surveys')}
            className={`retro-button shrink-0 px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'surveys' ? 'bg-blue-800 text-white font-semibold' : 'text-zinc-200 hover:text-white'
            }`}
          >
            Surveys
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {username ? (
            <>
              <button onClick={onAccount} className="retro-button px-3 py-1.5 text-xs text-cyan-200 hover:text-white">
                @{username}
              </button>
              <button onClick={onSignOut} className="retro-button px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
                Sign out
              </button>
            </>
          ) : (
            <button onClick={onSignIn} className="retro-button bg-cyan-300 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-200">
              Sign in
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
