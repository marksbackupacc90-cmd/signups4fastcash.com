import React from 'react';
import { Bell, Lock, ShieldCheck } from 'lucide-react';
import { SfcCoinLogo } from './SfcCoinLogo';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types';

interface FooterProps {
  siteSettings?: SiteSettings;
  onOpenNewsletter: () => void;
  onSelectAdmin: () => void;
  onTogglePush?: () => void;
  pushEnabled?: boolean;
  onOpenLegal?: (section: 'privacy' | 'terms' | 'affiliate' | 'methodology') => void;
  isAdminUnlocked?: boolean;
  onSelectOffers: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  siteSettings,
  onOpenNewsletter,
  onSelectAdmin,
  onTogglePush,
  pushEnabled = false,
  onOpenLegal,
  isAdminUnlocked = false,
  onSelectOffers,
}) => {
  const settings = siteSettings || DEFAULT_SITE_SETTINGS;
  const brand = settings.brandName || settings.siteName;
  const disclaimer = (settings.footerDisclaimer || 'Please do not send passwords, bank details, or government ID by email. Merchant terms and payouts can change at any time.')
    .replace(/^Questions or corrections\?\s*Email\s+[^.]+\.\s*/i, '');

  return (
    <footer className="site-footer px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <SfcCoinLogo size="sm" />
              <span className="text-base font-extrabold tracking-tight text-slate-900">{brand}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              {settings.footerBlurb || 'Find offers. Understand the requirements. Make informed decisions.'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Questions or corrections?{' '}
              <a className="font-semibold text-emerald-800 underline underline-offset-2" href={`mailto:${settings.supportEmail || 'support@signups4fastcash.com'}`}>
                {settings.supportEmail || 'support@signups4fastcash.com'}
              </a>
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
              <ShieldCheck className="h-4 w-4" /> Independent comparison · $0 user fees
            </span>
          </div>

          <nav aria-label="Footer offers navigation">
            <h2 className="text-sm font-bold text-slate-900">Explore</h2>
            <ul className="mt-2 space-y-1">
              <li><button onClick={onSelectOffers} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">All available offers</button></li>
              <li><a href="/cashback-offers" className="inline-flex min-h-10 items-center text-sm text-slate-600 hover:text-emerald-800">Cashback & rewards</a></li>
              <li><a href="/banking-signup-offers" className="inline-flex min-h-10 items-center text-sm text-slate-600 hover:text-emerald-800">Banking offers</a></li>
              <li><a href="#how-it-works" className="inline-flex min-h-10 items-center text-sm text-slate-600 hover:text-emerald-800">How offers work</a></li>
            </ul>
          </nav>

          <nav aria-label="Footer legal navigation">
            <h2 className="text-sm font-bold text-slate-900">Policies & updates</h2>
            <ul className="mt-2 space-y-1">
              {onOpenLegal && (
                <>
                  <li><button onClick={() => onOpenLegal('privacy')} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">Privacy policy</button></li>
                  <li><button onClick={() => onOpenLegal('terms')} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">Terms & disclaimer</button></li>
                  <li><button onClick={() => onOpenLegal('affiliate')} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">Affiliate disclosure</button></li>
                  <li><button onClick={() => onOpenLegal('methodology')} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">Editorial methodology</button></li>
                </>
              )}
              <li><button onClick={onOpenNewsletter} className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-600 hover:text-emerald-800"><Bell className="h-4 w-4" /> Email alerts</button></li>
              {onTogglePush && (
                <li><button onClick={onTogglePush} className="min-h-10 text-left text-sm text-slate-600 hover:text-emerald-800">{pushEnabled ? 'Push alerts on' : 'Enable push alerts'}</button></li>
              )}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-bold text-slate-900">A note about offers</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-800">Affiliate disclosure:</strong> {disclaimer} Some links may compensate us at no additional cost to you. Providers control eligibility, approval, fees, terms, and payout timing. This is not financial, tax, legal, or investment advice.
            </p>
            <button onClick={onSelectAdmin} className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs text-slate-500 hover:text-slate-800">
              <Lock className="h-3.5 w-3.5" /> {isAdminUnlocked ? 'Admin panel' : 'Admin access'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {brand}. All rights reserved.</span>
          <span>{disclaimer}</span>
        </div>
      </div>
    </footer>
  );
};
