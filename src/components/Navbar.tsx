import React from 'react';
import { SfcCoinLogo } from './SfcCoinLogo';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';

interface NavbarProps {
  siteSettings?: SiteSettings;
  activeTab: 'offers' | 'admin';
  setActiveTab: (tab: 'offers' | 'admin') => void;
  onInstallApp: () => void;
  installAvailable: boolean;
  username?: string | null;
  onSignUp: () => void;
  onSignIn: () => void;
  hideSignIn?: boolean;
  onAccount: () => void;
  onSignOut: () => void;
  onAdminAccess: () => void;
  canAccessAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  siteSettings,
  activeTab,
  setActiveTab,
  onInstallApp,
  installAvailable,
  username,
  onSignUp,
  onSignIn,
  hideSignIn = false,
  onAccount,
  onSignOut,
  onAdminAccess,
  canAccessAdmin = false,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;

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
              <div>
                <span className="block max-w-[calc(100vw-110px)] truncate font-mono font-bold tracking-tight text-sm sm:text-lg text-white">
                  {settings.brandName || settings.siteName}
                </span>
                <span className="block max-w-[calc(100vw-110px)] truncate text-[10px] font-mono text-emerald-300 sm:text-[11px]">
                  {settings.siteTagline || 'Rewards and cashback with clear terms'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center / Navigation Links */}
        <nav className="order-3 flex w-full items-center justify-center gap-2 overflow-x-auto px-1 py-1 md:order-none md:w-auto md:flex-1">
          <button
            id="nav-offers-tab"
            onClick={() => setActiveTab('offers')}
            className={`retro-button shrink-0 rounded-md border border-white/15 px-4 py-2 text-xs font-medium transition-all ${
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
            className={`retro-button shrink-0 rounded-md border border-white/15 px-4 py-2 text-xs font-medium transition-all ${
              installAvailable
                ? 'text-blue-800'
                : 'text-zinc-200 hover:text-white'
            }`}
            title={installAvailable ? 'Install signups4fastcash as an app' : 'View app installation instructions'}
          >
            Install App
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {username ? (
            <>
              <button onClick={onAccount} className="retro-button px-3 py-1.5 text-xs text-cyan-200 hover:text-white">
                @{username}
              </button>
              {canAccessAdmin && (
                <button onClick={onAdminAccess} className="retro-button border border-amber-300/40 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10">
                  Admin
                </button>
              )}
              <button onClick={onSignOut} className="retro-button px-3 py-1.5 text-xs text-zinc-300 hover:text-white">
                Sign out
              </button>
            </>
          ) : !hideSignIn ? (
            <div className="flex items-center gap-2">
              <button onClick={onSignUp} className="retro-button border border-cyan-300/50 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-300/10">
                Sign up
              </button>
              <button onClick={onSignIn} className="retro-button bg-cyan-300 px-3 py-1.5 text-xs font-bold text-black hover:bg-cyan-200">
                Sign in
              </button>
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
};
