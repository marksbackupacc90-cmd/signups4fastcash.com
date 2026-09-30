import React, { useEffect, useMemo, useRef } from 'react';
import {
  ArrowRight,
  BellRing,
  Check,
  Download,
  ExternalLink,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, Offer, SiteSettings } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface HeroProps {
  siteSettings?: SiteSettings;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: 'random' | 'highest' | 'fastest' | 'easiest';
  setSortBy: (sort: 'random' | 'highest' | 'fastest' | 'easiest') => void;
  offerFilter: 'all' | 'no-deposit' | 'paypal' | 'fast' | 'beginner' | 'purchase';
  setOfferFilter: (filter: 'all' | 'no-deposit' | 'paypal' | 'fast' | 'beginner' | 'purchase') => void;
  totalOffersCount: number;
  featuredOffers: Offer[];
  onOpenFinder?: () => void;
  onOpenNewsletter?: () => void;
  onInstallApp?: () => void;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All offers' },
  { id: 'fintech', label: 'Bank bonuses' },
  { id: 'brokerage', label: 'Stocks & investing' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'apps', label: 'Apps & rewards' },
  { id: 'crypto', label: 'Crypto' },
];

const REQUIREMENT_FILTERS = [
  ['all', 'Any requirement'],
  ['no-deposit', 'No deposit'],
  ['paypal', 'PayPal cashout'],
  ['fast', 'Fast payout'],
  ['beginner', 'Beginner-friendly'],
  ['purchase', 'Purchase required'],
] as const;

const CATEGORY_LABELS: Record<Offer['category'], string> = {
  fintech: 'Banking',
  brokerage: 'Investing',
  cashback: 'Cashback',
  apps: 'Apps & rewards',
  crypto: 'Crypto',
};

export const Hero: React.FC<HeroProps> = ({
  siteSettings,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  offerFilter,
  setOfferFilter,
  totalOffersCount,
  featuredOffers,
  onOpenFinder,
  onOpenNewsletter,
  onInstallApp,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const searchRef = useRef<HTMLInputElement | null>(null);
  const previewOffers = useMemo(() => featuredOffers.slice(0, 3), [featuredOffers]);

  useEffect(() => {
    const focusSearchShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', focusSearchShortcut);
    return () => window.removeEventListener('keydown', focusSearchShortcut);
  }, []);

  const scrollToOffers = () => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="hero-section" aria-label="Find rewards and offers">
      <div className="hero-layout">
        <div className="hero-copy">
          <p className="hero-eyebrow"><Sparkles className="h-4 w-4" aria-hidden="true" /> {settings.heroBadge || 'Rewards, with the fine print included'}</p>
          <h1 className="hero-title">{settings.mainHeadline || 'Find offers worth your time.'}</h1>
          <p className="hero-description">{settings.subHeadline || 'Compare signup bonuses, cashback, and rewards in one place — with the requirements and important details clearly laid out.'}</p>
          <p className="hero-note">Independent comparison. Providers set eligibility, approval, and payout terms. Always check the official offer before signing up.</p>
          <div className="hero-actions">
            <button type="button" onClick={scrollToOffers} className="button-primary">
              Explore offers <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a href="#how-it-works" className="button-secondary">
              How it works
            </a>
            {onOpenFinder && (
              <button type="button" onClick={onOpenFinder} className="button-secondary">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Find my match
              </button>
            )}
            {onInstallApp && (
              <button type="button" onClick={onInstallApp} className="button-secondary">
                <Download className="h-4 w-4" aria-hidden="true" /> Add to home screen
              </button>
            )}
          </div>
        </div>

        <aside className="hero-preview" aria-label="Examples from current offers">
          <div className="hero-preview-heading">
            <span>Offers, at a glance</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> Real listings</span>
          </div>
          {previewOffers.length > 0 ? (
            <>
              <div className="hero-preview-list">
                {previewOffers.map((offer) => (
                  <div className="hero-preview-row" key={offer.id}>
                    <CompanyLogo
                      companyName={offer.company}
                      slug={offer.companySlug}
                      logoUrl={offer.logoUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="hero-preview-company">{offer.company}</p>
                      <p className="hero-preview-requirement">{offer.depositRequired}</p>
                    </div>
                    <p className="hero-preview-reward">{offer.incentiveAmount}</p>
                  </div>
                ))}
              </div>
              <p className="hero-preview-caption">Rewards and requirements shown from listed offers. Provider terms and eligibility can change.</p>
            </>
          ) : (
            <p className="hero-preview-caption">Browse current offers to compare provider rewards and requirements.</p>
          )}
        </aside>
      </div>

      <div className="trust-strip" aria-label="How we help you compare">
        <div className="trust-strip-item"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Requirements shown before you visit</div>
        <div className="trust-strip-item"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Apply directly with the provider</div>
        <div className="trust-strip-item"><Check className="h-4 w-4" aria-hidden="true" /> Affiliate links disclosed</div>
      </div>

      <div className="hero-controls" aria-label="Search and filter offers">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="hero-search min-w-0 flex-1">
            <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              id="search-offers-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearchSubmit?.((event.target as HTMLInputElement).value);
              }}
              placeholder="Search offers, brands, or categories..."
              aria-label="Search offers"
              autoComplete="off"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery('')} className="offer-search-clear" aria-label="Clear offer search">Clear</button>
            ) : (
              <kbd className="search-shortcut" aria-hidden="true">/</kbd>
            )}
          </label>
          <label className="sr-only" htmlFor="sort-offers">Sort offers</label>
          <select
            id="sort-offers"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as HeroProps['sortBy'])}
            aria-label="Sort offers"
          >
            <option value="random">Recommended order</option>
            <option value="highest">Highest reward</option>
            <option value="fastest">Fastest payout</option>
            <option value="easiest">Lowest deposit</option>
          </select>
        </div>

        <nav className="category-nav" id="categories" aria-label="Offer categories">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setSelectedCategory(id); scrollToOffers(); }}
              aria-pressed={selectedCategory === id}
              className="category-chip"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="requirement-nav" aria-label="Filter offers by requirements">
          {REQUIREMENT_FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setOfferFilter(id); scrollToOffers(); }}
              aria-pressed={offerFilter === id}
              className="requirement-chip"
            >
              {label}
            </button>
          ))}
        </div>

        {(searchQuery || selectedCategory !== 'all' || offerFilter !== 'all') && (
          <div className="active-filter-list" aria-label="Active filters">
            {searchQuery && <button type="button" className="active-filter-chip" onClick={() => setSearchQuery('')}>Search: {searchQuery} <span aria-hidden="true">×</span></button>}
            {selectedCategory !== 'all' && <button type="button" className="active-filter-chip" onClick={() => setSelectedCategory('all')}>{CATEGORIES.find((item) => item.id === selectedCategory)?.label || selectedCategory} <span aria-hidden="true">×</span></button>}
            {offerFilter !== 'all' && <button type="button" className="active-filter-chip" onClick={() => setOfferFilter('all')}>{REQUIREMENT_FILTERS.find(([id]) => id === offerFilter)?.[1] || offerFilter} <span aria-hidden="true">×</span></button>}
            <button type="button" className="active-filter-clear" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setOfferFilter('all'); }}>Clear all</button>
          </div>
        )}
      </div>

      <div className="popular-guides" aria-label="Popular guides">
        <span>Popular guides:</span>
        <a href="/cashback-offers">Cashback offers</a>
        <a href="/signup-bonus-sites">Signup bonuses</a>
        <a href="/best-no-deposit-bonuses-this-month">No-deposit offers</a>
        <a href="/how-to-compare-referral-bonuses-safely">Compare safely</a>
      </div>

      {onOpenNewsletter && (
        <div className="mx-auto mt-4 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce6df] bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BellRing className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-sm text-slate-700">Get offer updates by email. Choose a frequency and unsubscribe anytime.</p>
          </div>
          <button type="button" onClick={onOpenNewsletter} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
            Email alerts <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="sr-only">{totalOffersCount} offers listed</p>
    </section>
  );
};
