import React, { useEffect, useRef, useState } from 'react';
import { SfcCoinLogo } from './SfcCoinLogo';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';
import { Bell, ChevronDown, ListChecks, Search, Share2 } from 'lucide-react';

interface NavbarProps {
  adminSection: 'live' | 'blasts';
  siteSettings?: SiteSettings;
  activeTab: 'offers' | 'admin';
  setActiveTab: (tab: 'offers' | 'admin') => void;
  onOpenMyOffers: () => void;
  activeOfferCount: number;
  username?: string | null;
  avatarUrl?: string | null;
  onSignUp: () => void;
  onSignIn: () => void;
  hideSignIn?: boolean;
  onAccount: () => void;
  onSignOut: () => void;
  onAdminSection: (section: 'live' | 'blasts') => void;
  canAccessAdmin?: boolean;
  userId?: string;
  onShare: () => void;
  shareCopied: boolean;
  onOpenFinder: () => void;
  onOpenNewsletter: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  siteSettings,
  adminSection,
  activeTab,
  setActiveTab,
  onOpenMyOffers,
  activeOfferCount,
  username,
  avatarUrl,
  onSignUp,
  onSignIn,
  hideSignIn = false,
  onAccount,
  onSignOut,
  onAdminSection,
  canAccessAdmin = false,
  userId,
  onShare,
  shareCopied,
  onOpenFinder,
  onOpenNewsletter,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [accountMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#090d18]/85 backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 lg:px-8">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('offers')}
            className="retro-button focus-ring min-w-0 flex items-center gap-2.5 text-left group focus:outline-none"
            id="brand-logo-btn"
            aria-label={settings.brandName || settings.siteName}
          >
            <SfcCoinLogo />
            <div className="min-w-0">
              <span className="block max-w-[calc(100vw-125px)] truncate font-mono text-sm font-bold tracking-tight text-white sm:text-lg">
                {settings.brandName || settings.siteName}
              </span>
              <span className="hidden max-w-[calc(100vw-125px)] truncate text-[10px] font-mono text-cyan-300 sm:block sm:text-[11px]">
                {settings.siteTagline || 'Rewards and cashback with clear terms'}
              </span>
            </div>
          </button>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden flex-1 items-center justify-center gap-2 overflow-visible px-1 py-1 md:flex">
          <button
            id="nav-offers-tab"
            onClick={() => setActiveTab('offers')}
            className={`retro-button focus-ring shrink-0 rounded-md border border-white/15 px-4 py-2 text-xs font-medium transition-all ${
              activeTab === 'offers'
                ? 'border-[#2dd4ee]/60 bg-[#2dd4ee] text-[#06131a] font-semibold'
                : 'text-zinc-200 hover:bg-[#141824] hover:text-[#f1e6cf]'
            }`}
          >
            Offers
          </button>
          <button
            id="nav-in-progress"
            type="button"
            onClick={onOpenMyOffers}
            className="retro-button focus-ring hidden shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-4 py-2 text-xs font-medium text-zinc-200 transition-all hover:bg-[#141824] hover:text-white md:inline-flex"
            aria-label={`Open In Progress, ${activeOfferCount} active`}
          >
            <ListChecks className="h-3.5 w-3.5 text-cyan-300" />
            In Progress
            {activeOfferCount > 0 && <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-black text-[#071016]">{activeOfferCount}</span>}
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {username ? (
            <div ref={accountMenuRef} className="relative">
              <button onClick={() => setAccountMenuOpen((open) => !open)} className="retro-button focus-ring inline-flex max-w-[10rem] items-center gap-1.5 truncate px-2 py-1.5 text-xs text-cyan-200 hover:text-white sm:px-3" aria-expanded={accountMenuOpen} aria-label={`Open account menu for ${username}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-cyan-300/40" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-300/25">
                    {username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                @{username}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-white/10 bg-[#0e121a] p-1.5 shadow-2xl">
                  <button onClick={() => { onAccount(); setAccountMenuOpen(false); }} className="focus-ring block w-full rounded-md px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10">My account</button>
                  {canAccessAdmin && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">Admin</div>
                      {([
                        ['live', 'Offers'],
                        ['blasts', 'Email'],
                      ] as const).map(([section, label]) => (
                        <button
                          key={section}
                          onClick={() => { onAdminSection(section); setAccountMenuOpen(false); }}
                          className={`focus-ring block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-amber-300/10 ${adminSection === section ? 'font-semibold text-amber-100' : 'text-zinc-200'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </>
                  )}
                  <button onClick={() => { onOpenNewsletter(); setAccountMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10"><Bell className="h-3.5 w-3.5" /> Subscribe to alerts</button>
                  <button onClick={() => { onOpenFinder(); setAccountMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10"><Search className="h-3.5 w-3.5" /> Find my best offers</button>
                  <button onClick={() => { onShare(); setAccountMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/10"><Share2 className="h-3.5 w-3.5" /> {shareCopied ? 'Message copied' : 'Share site'}</button>
                  <button onClick={() => { onSignOut(); setAccountMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/10">Sign out</button>
                </div>
              )}
            </div>
          ) : !hideSignIn ? (
            <div className="flex items-center gap-2">
              <button onClick={onSignUp} className="retro-button focus-ring border border-cyan-300/50 px-2.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-300/10 sm:px-3">
                Sign up
              </button>
              <button onClick={onSignIn} className="retro-button focus-ring border border-white/15 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 sm:px-3">
                Sign in
              </button>
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
};
