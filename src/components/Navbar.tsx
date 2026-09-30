import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Download, ListChecks, Menu, Search, Share2, Sparkles, X } from 'lucide-react';
import { SfcCoinLogo } from './SfcCoinLogo';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';

interface NavbarProps {
  adminSection: 'live' | 'blasts';
  siteSettings?: SiteSettings;
  activeTab: 'offers' | 'daily' | 'admin';
  setActiveTab: (tab: 'offers' | 'daily' | 'admin') => void;
  onOpenMyOffers: () => void;
  activeOfferCount: number;
  username?: string | null;
  avatarUrl?: string | null;
  onSignIn: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  onAdminSection: (section: 'live' | 'blasts') => void;
  canAccessAdmin?: boolean;
  userId?: string;
  onShare: () => void;
  shareCopied: boolean;
  onOpenFinder: () => void;
  onOpenNewsletter: () => void;
  onFocusSearch?: () => void;
  onInstallApp?: () => void;
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
  onSignIn,
  onAccount,
  onSignOut,
  onAdminSection,
  canAccessAdmin = false,
  onShare,
  shareCopied,
  onOpenFinder,
  onOpenNewsletter,
  onFocusSearch,
  onInstallApp,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const goTo = (selector: string) => {
    setMenuOpen(false);
    setActiveTab('offers');
    window.setTimeout(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const openSignIn = () => {
    setMenuOpen(false);
    onSignIn();
  };

  return (
    <header className="site-header">
      <div className="mx-auto flex min-h-[68px] max-w-[1320px] items-center gap-2 px-3 sm:px-5 lg:px-8">
        <button
          type="button"
          onClick={() => { setActiveTab('offers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="nav-brand flex min-w-0 shrink items-center gap-2.5 text-left"
          aria-label={`${settings.brandName || settings.siteName} home`}
        >
          <SfcCoinLogo size="sm" />
          <span className="min-w-0">
            <span className="block max-w-[48vw] truncate text-[0.9rem] font-extrabold tracking-tight text-slate-900 sm:max-w-none sm:text-base">
              {settings.brandName || settings.siteName}
            </span>
            <span className="hidden text-[0.67rem] font-medium text-slate-500 sm:block">
              {settings.siteTagline || 'Clear terms. Better-informed choices.'}
            </span>
          </span>
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main navigation">
          <button type="button" onClick={() => goTo('#offers')} className="nav-link">Browse offers</button>
          <button type="button" onClick={() => goTo('#categories')} className="nav-link">Categories</button>
          <button type="button" onClick={() => goTo('#how-it-works')} className="nav-link">How it works</button>
          <button type="button" onClick={() => { onFocusSearch?.(); setMenuOpen(false); }} className="nav-link inline-flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Search
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => { onFocusSearch?.(); setMenuOpen(false); }}
            className="nav-icon-button lg:hidden"
            aria-label="Search offers"
          >
            <Search className="h-5 w-5" />
          </button>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="nav-icon-button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 lg:hidden" />}
              {!menuOpen && <span className="hidden lg:inline-flex items-center gap-2 px-1 text-sm font-semibold">{username ? `@${username}` : 'Account'}<ChevronDown className="h-4 w-4" /></span>}
            </button>

            {menuOpen && (
              <div className="nav-menu absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="grid gap-1">
                  <button type="button" onClick={() => { onOpenMyOffers(); setMenuOpen(false); }} className="nav-menu-item">
                    <ListChecks className="h-4 w-4 text-emerald-700" />
                    <span>My Offers <small>{activeOfferCount ? `${activeOfferCount} active` : 'Saved offers'}</small></span>
                  </button>
                  <button type="button" onClick={() => { onOpenFinder(); setMenuOpen(false); }} className="nav-menu-item">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <span>Find my match</span>
                  </button>
                  <button type="button" onClick={() => { onOpenNewsletter(); setMenuOpen(false); }} className="nav-menu-item">
                    <Bell className="h-4 w-4 text-emerald-700" />
                    <span>Email alerts</span>
                  </button>
                  {onInstallApp && (
                    <button type="button" onClick={() => { onInstallApp(); setMenuOpen(false); }} className="nav-menu-item">
                      <Download className="h-4 w-4 text-emerald-700" />
                      <span>Add to home screen</span>
                    </button>
                  )}
                  {username ? (
                    <>
                      <button type="button" onClick={() => { onAccount(); setMenuOpen(false); }} className="nav-menu-item">My account</button>
                      {canAccessAdmin && <button type="button" onClick={() => { onAdminSection(adminSection || 'live'); setMenuOpen(false); }} className="nav-menu-item">Admin</button>}
                      <button type="button" onClick={() => { onSignOut(); setMenuOpen(false); }} className="nav-menu-item">Sign out</button>
                    </>
                  ) : (
                    <button type="button" onClick={openSignIn} className="nav-menu-item">Sign in (optional)</button>
                  )}
                  <button type="button" onClick={() => { onShare(); setMenuOpen(false); }} className="nav-menu-item">
                    <Share2 className="h-4 w-4 text-slate-500" />
                    <span>{shareCopied ? 'Link copied' : 'Share site'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => goTo('#offers')}
            className="nav-get-started hidden min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-800 sm:inline-flex"
          >
            Get started
          </button>
        </div>
      </div>
    </header>
  );
};
