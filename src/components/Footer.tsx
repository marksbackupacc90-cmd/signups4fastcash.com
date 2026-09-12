import React from 'react';
import { ShieldCheck, Lock, Bell, Moon, Sun } from 'lucide-react';

interface FooterProps {
  onOpenNewsletter: () => void;
  onSelectAdmin: () => void;
  onTogglePush?: () => void;
  pushEnabled?: boolean;
  onOpenLegal?: (section: 'privacy' | 'terms' | 'affiliate') => void;
  isAdminUnlocked?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenNewsletter,
  onSelectAdmin,
  onTogglePush,
  pushEnabled = false,
  onOpenLegal,
  isAdminUnlocked = false,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07090d] text-zinc-400 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand & Promise */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#10141d] border border-white/10 flex items-center justify-center text-[#00f2fe] font-black text-xs">
                4*
              </div>
              <span className="font-mono font-bold text-white text-base">
                signups4<span className="text-[#00f2fe]">fastcash.com</span>
              </span>
            </div>
            
            <p className="text-zinc-400 text-xs leading-relaxed max-w-md">
              signups4fastcash.com is an independent rewards comparison resource. We summarize publicly available promotions, show the requirements and fine print, and send visitors back to the official merchant website to apply.
            </p>
            <p className="text-zinc-500 text-xs leading-relaxed max-w-md">
              Questions or corrections? Email <a className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2" href="mailto:support@signups4fastcash.com">support@signups4fastcash.com</a>. Please do not send passwords, bank details, or government ID by email. Merchant terms and payouts can change at any time.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Non-Custodial: $0 User Fees
              </span>
            </div>
          </div>

          {/* Col 2: Navigation & Quick Links */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-white uppercase text-xs tracking-wider">
              Quick Navigation
            </div>
            <ul className="space-y-1.5 text-zinc-400 font-sans">
              <li>
                <a href="#offers" className="hover:text-white transition-colors">
                  All Available Offers
                </a>
              </li>
              <li>
                <a href="#surveys" className="hover:text-white transition-colors">
                  Surveys &amp; Rewards
                </a>
              </li>
              <li>
                <button onClick={onOpenNewsletter} className="hover:text-white transition-colors text-left">
                  Email Drop Alerts
                </button>
              </li>
              {onTogglePush && (
                <li>
                  <button onClick={onTogglePush} className="hover:text-white transition-colors text-left flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {pushEnabled ? 'Push Alerts On' : 'Enable Push Alerts'}
                  </button>
                </li>
              )}
              {isAdminUnlocked && (
                <li>
                  <button onClick={onSelectAdmin} className="hover:text-amber-300 transition-colors text-left flex items-center gap-1 text-zinc-500">
                    <Lock className="w-3 h-3" />
                    <span>Admin Panel</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 3: Legal & Disclosure */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-white uppercase text-xs tracking-wider">
              Legal &amp; Disclosure
            </div>
            {onOpenLegal && (
              <div className="space-y-1.5 text-zinc-300">
                <button onClick={() => onOpenLegal('privacy')} className="block hover:text-white transition-colors text-left">Privacy Policy</button>
                <button onClick={() => onOpenLegal('terms')} className="block hover:text-white transition-colors text-left">Terms &amp; Disclaimer</button>
                <button onClick={() => onOpenLegal('affiliate')} className="block hover:text-white transition-colors text-left">Affiliate Disclosure</button>
              </div>
            )}
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              <strong>Affiliate Disclosure:</strong> Some links may compensate us at no additional cost to you. Offers are controlled by their merchants; eligibility, terms, taxes, fees, and payout timing can change. We do not provide financial, tax, legal, or investment advice.
            </p>
          </div>

        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} signups4fastcash.com — All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <a href="#trust" className="text-emerald-400 hover:text-emerald-300">How offers work</a>
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            )}
          </div>
        </div>

      </div>
    </footer>
  );
};
